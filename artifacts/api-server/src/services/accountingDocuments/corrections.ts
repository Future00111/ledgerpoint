import { randomUUID } from 'node:crypto';
import { fail, uuid } from '../financialDrafts/contract';
import { correctCanonicalJournal, roleHasAccountingCapability, type DatabaseTransaction, type LockedAuthority,
  type PostingContext } from '../accounting/canonicalPosting';
import { document, exactFields, hash, pounds, queryAdapter, sales, scope, supportedCompany, tables, transact, type Kind, type Queryable } from './core';
import { calculateDocument } from './documents';
import { appliedTo, paymentEvents, settlementAmounts } from './settlement';
import { amendmentHistory, amendmentSchema, correctionIdentity, originalPostingEvidence } from './amendments';
import { amendmentContextHash, amendmentDelta, amendmentJournalLines, correctionLineSource, sameJournalLines } from './amendmentsMath';
import { journalLines } from './documentJournal';
import { assertCreditCapacity } from './creditCapacity';

const blockerMessages: Record<string, string> = {
  CORRECTION_SCHEMA_UNAVAILABLE: 'Document corrections have not been enabled in this development database.',
  CORRECTION_KIND_UNSUPPORTED: 'This correction workflow currently supports posted invoices and bills.',
  CORRECTION_CHILD_CREDITS: 'A linked credit draft is awaiting review. Resolve it before correcting the original.',
  CORRECTION_ACTIVE_CLAIMS: 'This bill has items awaiting credit. Resolve those claims before a financial correction.',
  CORRECTION_JOURNAL_UNSUPPORTED: 'The original journal or its history needs review before this correction is available.',
  CORRECTION_LEGACY_SETTLEMENT: 'Legacy settlement links need review before this correction is available.',
};

async function authority(q: Queryable, company: string, actor: string, lock = false, required = false) {
  const business = await scope(q, company, actor, false, lock);
  const members = (await q.query(`SELECT role,is_active FROM company_users WHERE company_id=$1 AND user_id=$2${lock ? ' FOR UPDATE' : ''}`, [company, actor])).rows;
  const allowed = members.length === 1 && members[0].is_active === true && roleHasAccountingCapability(members[0].role, 'accounting.correct');
  if (required && !allowed) fail(403, 'CAPABILITY_DENIED');
  return { business, allowed };
}

export function correctionIntent(body: unknown) {
  const b = exactFields(body, ['request_id', 'reason', 'effective_date', 'line_items', 'review_token']);
  if (typeof b.reason !== 'string' || !b.reason.trim() || b.reason.length > 1000 || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(b.reason)) fail(422, 'CORRECTION_REASON_REQUIRED');
  if (typeof b.effective_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.effective_date) || b.effective_date < '1900-01-01' || b.effective_date > '2199-12-31' ||
    !Number.isFinite(Date.parse(b.effective_date + 'T00:00:00Z')) || new Date(b.effective_date + 'T00:00:00Z').toISOString().slice(0, 10) !== b.effective_date) fail(422, 'DATE_INVALID');
  if (!Array.isArray(b.line_items) || b.line_items.length < 1 || b.line_items.length > 200) fail(422, 'CORRECTION_LINE_SHAPE_CHANGED');
  return { request_id: uuid(b.request_id).toLowerCase(), reason: b.reason.trim(), effective_date: b.effective_date,
    line_items: b.line_items.map((value: unknown) => { const item = exactFields(value, ['quantity', 'unit_price']); return { quantity: item.quantity, unit_price: item.unit_price }; }) };
}

async function blockers(q: Queryable, company: string, original: any, history: Awaited<ReturnType<typeof amendmentHistory>>) {
  const codes: string[] = [];
  if (!history.available) return ['CORRECTION_SCHEMA_UNAVAILABLE'];
  if (!['sales_invoice', 'purchase_bill'].includes(original.kind) || original.status !== 'posted') return ['CORRECTION_KIND_UNSUPPORTED'];
  if(original.source?.conditional_discount && (await q.query("SELECT 1 FROM accounting_paid_credit_operations WHERE company_id=$1 AND intent->>'original_id'=$2::text AND intent ? 'conditional_admission' LIMIT 1",[company,original.id])).rowCount)
    return ['CORRECTION_JOURNAL_UNSUPPORTED'];
  const entries = (await q.query(`SELECT * FROM canonical_journal_entries WHERE company_id=$1 AND id=$2`, [company, original.journal_id])).rows;
  const entry = entries[0];
  const lines = (await q.query(`SELECT * FROM canonical_journal_lines WHERE company_id=$1 AND journal_entry_id=$2 ORDER BY line_number`, [company, original.journal_id])).rows;
  const relations = (await q.query(`SELECT * FROM canonical_journal_relations WHERE company_id=$1
    AND (original_journal_id=$2 OR related_journal_id=$2)`, [company, original.journal_id])).rows;
  if (!entry || entry.status !== 'posted' || entry.source_type !== original.kind || entry.source_id !== original.id ||
    entry.source_revision !== original.revision || entry.source_evidence_hash !== await originalPostingEvidence(q,company,original) ||
    !sameJournalLines(lines, journalLines(original)) || relations.length !== history.rows.length ||
    relations.some(relation => relation.relation_type !== 'correction' || relation.original_journal_id !== original.journal_id ||
      !history.rows.some(row => row.journal_id === relation.related_journal_id))) codes.push('CORRECTION_JOURNAL_UNSUPPORTED');
  if ((await q.query("SELECT id FROM accounting_document_sources WHERE company_id=$1 AND original_id=$2 AND status='draft' LIMIT 1", [company, original.id])).rowCount) codes.push('CORRECTION_CHILD_CREDITS');
  if (original.kind === 'purchase_bill' && (await q.query('SELECT id FROM supplier_credit_claims WHERE company_id=$1 AND bill_id=$2 AND NOT cancelled LIMIT 1', [company, original.id])).rowCount) codes.push('CORRECTION_ACTIVE_CLAIMS');
  if ((await q.query(`SELECT id FROM bank_transactions b WHERE company_id=$1 AND
    (to_jsonb(b)->>'linked_invoice_id'=$2::text OR to_jsonb(b)->>'linked_bill_id'=$2::text OR matched_record_id=$2::text) LIMIT 1`, [company, original.id])).rowCount) codes.push('CORRECTION_LEGACY_SETTLEMENT');
  return codes;
}

function publicHistory(history: Awaited<ReturnType<typeof amendmentHistory>>) {
  return { document_id: history.original.id, original_revision: history.original.revision, current_revision: history.head_revision,
    amendments: history.rows.map(row => ({ id: row.id, request_id: row.request_id, revision: row.revision, previous_revision: row.previous_revision,
      actor_id: row.actor_id, reason: row.reason, effective_date: row.effective_date, journal_id: row.journal_id, created_at: row.created_at,
      before_source: row.before_source, after_source: row.after_source, before_money: row.before_money, after_money: row.after_money, delta_money: row.delta_money })) };
}

export async function correctionContext(company: string, actor: string, id: string) {
  return transact(async q => {
    const auth = await authority(q, company, actor);
    const original = await document(q, company, id);
    const history = await amendmentHistory(q, company, original);
    const reasons = await blockers(q, company, original, history);
    const parties = (await q.query(`SELECT name FROM ${sales(original.kind) ? 'customers' : 'suppliers'} WHERE company_id=$1 AND id=$2`, [company, original.party_id])).rows;
    return { document: { ...history.current, party_name: parties[0]?.name ?? '' }, original,
      capabilities: { review_corrections: auth.allowed && history.available, correct_documents: auth.allowed && history.available },
      blockers: reasons.map(code => ({ code, message: blockerMessages[code] })), history: publicHistory(history) };
  }, true);
}

export async function correctionHistory(company: string, actor: string, id: string) {
  return transact(async q => { await authority(q, company, actor); return publicHistory(await amendmentHistory(q, company, await document(q, company, id))); }, true);
}

/** Read-only outcome lookup. Unknown is not proof of failure: an in-flight
 * transaction may still commit. Never retry or create an operation here. */
export async function recoverCorrection(company:string,actor:string,id:string,requestId:string) {
  const request=uuid(requestId).toLowerCase();
  return transact(async q=>{
    await authority(q,company,actor,false,true);
    if(!await amendmentSchema(q)) fail(503,'CORRECTION_SCHEMA_UNAVAILABLE');
    const original=await document(q,company,id);
    const history=await amendmentHistory(q,company,original);
    const row=history.rows.find(row=>row.request_id===request);
    if(!row) return {state:'unknown',request_id:request,document_id:id};
    if(row.actor_id!==actor) fail(404,'RESOURCE_NOT_FOUND');
    return {state:'known',request_id:request,document_id:id,receipt:{
      status:'posted',id:request,document_id:id,revision:row.revision,journal_id:row.journal_id}};
  },true);
}

async function plan(q: Queryable, company: string, actor: string, id: string, expected: string, intent: ReturnType<typeof correctionIntent>) {
  supportedCompany((await authority(q, company, actor, true, true)).business);
  const original = await document(q, company, id, true);
  const history = await amendmentHistory(q, company, original);
  const blocked = await blockers(q, company, original, history);
  if (blocked.length) fail(blocked[0] === 'CORRECTION_SCHEMA_UNAVAILABLE' ? 503 : 409, blocked[0]!);
  if (history.head_revision !== expected) fail(409, 'REVISION_CONFLICT');
  const current = history.current;
  const credits = await assertCreditCapacity(q, company, current);
  const credited = credits.reduce((sum:bigint,c:any)=>sum+BigInt(c.money.gross_pence),0n).toString();
  const events = await paymentEvents(q, company);
  const related = events.filter(event => event.allocations.some((allocation: any) => allocation.document_id === id));
  if (intent.effective_date < history.latest_date || intent.effective_date < original.source.issue_date || related.some(event => event.effective_date > intent.effective_date) ||
    credits.some((c:any)=>c.posting_date>intent.effective_date)) fail(409, 'DATE_PRECEDES_SETTLEMENT_ACTIVITY');
  const periods = (await q.query(`SELECT *,start_date::text,end_date::text FROM accounting_document_periods WHERE company_id=$1
    AND start_date<=$2::date AND end_date>=$2::date ORDER BY id FOR UPDATE`, [company, intent.effective_date])).rows;
  if (periods.length !== 1 || periods[0].status !== 'OPEN') fail(409, 'PERIOD_NOT_WRITABLE');
  const source = correctionLineSource(current, intent.line_items);
  const after = { ...original, ...await calculateDocument(q, company, original.kind, { source }, current) };
  const context = amendmentContextHash(original);
  if (amendmentContextHash(current) !== context || amendmentContextHash(after) !== context) fail(409, 'CORRECTION_AUTHORITY_CHANGED');
  const delta = amendmentDelta(current.money, after.money);
  if (['net_pence', 'vat_pence', 'gross_pence'].every(field => (delta as any)[field] === '0')) fail(422, 'CORRECTION_ZERO_CHANGE_UNSUPPORTED');
  if (BigInt(after.money.gross_pence) <= 0n) fail(422, 'CORRECTION_POSITIVE_TOTAL_REQUIRED');
  await assertCreditCapacity(q, company, after);
  const paid = appliedTo(events, id).toString();
  if (BigInt(after.money.gross_pence)-BigInt(credited) < BigInt(paid)) fail(409, 'CORRECTION_BELOW_PAID');
  const beforeSettlement = settlementAmounts(current.money.gross_pence, credited, paid), afterSettlement = settlementAmounts(after.money.gross_pence, credited, paid);
  const compatibility = (await q.query(`SELECT amount_paid,balance_due FROM ${tables[original.kind as Kind]} WHERE company_id=$1 AND id=$2 FOR UPDATE`, [company, id])).rows[0];
  if (!compatibility || compatibility.amount_paid !== pounds(paid) || compatibility.balance_due !== pounds(beforeSettlement.open_minor)) fail(409, 'CORRECTION_LEGACY_SETTLEMENT');
  const lines = amendmentJournalLines(current, after);
  const originAccounts = (await q.query('SELECT DISTINCT account_id FROM canonical_journal_lines WHERE company_id=$1 AND journal_entry_id=$2', [company, original.journal_id])).rows.map(row => row.account_id);
  if (lines.some(line => !originAccounts.includes(line.accountId))) fail(409, 'CORRECTION_NEW_ACCOUNT_LEG_UNSUPPORTED');
  const accounts = (await q.query('SELECT * FROM chart_of_accounts WHERE company_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE', [company, originAccounts])).rows;
  if (accounts.length !== originAccounts.length || accounts.some(account => account.is_active !== true)) fail(409, 'CORRECTION_AUTHORITY_CHANGED');
  const settlement = { paid_minor: paid, credited_minor: credited, before_open_minor: beforeSettlement.open_minor, after_open_minor: afterSettlement.open_minor };
  const review = { intent, expected_revision: expected, before: { source: current.source, money: current.money, revision: expected },
    after: { source: after.source, money: after.money }, delta, settlement, journal_lines: lines };
  const token = hash({ company, actor, document_id: id, ...review, period: periods[0], accounts,
    configuration_revision: after.mapping_revision, authority_hash: context, payment_events: related, credits });
  return { ...review, review_token: token, original, current, afterRow: after, history, period: periods[0], accounts, afterSettlement, context,
    postingEvidence: await originalPostingEvidence(q,company,original) };
}

const reviewResult = (p: Awaited<ReturnType<typeof plan>>) => ({ intent: p.intent, expected_revision: p.expected_revision, review_token: p.review_token,
  before: p.before, after: p.after, delta: p.delta, settlement: p.settlement, journal_lines: p.journal_lines });

export async function reviewCorrection(company: string, actor: string, id: string, expected: string, body: unknown) {
  const intent = correctionIntent(body); uuid(expected);
  return transact(async q => reviewResult(await plan(q, company, actor, id, expected, intent)));
}

class Replayed extends Error { constructor(public result: any) { super('Correction already recorded'); } }
export async function commitCorrection(company: string, actor: string, id: string, expected: string, body: unknown, testHook?: (tx: DatabaseTransaction) => Promise<void>) {
  const intent = correctionIntent(body); uuid(expected);
  const reviewToken = (body as any).review_token;
  if (typeof reviewToken !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(reviewToken)) fail(428, 'CORRECTION_REVIEW_REQUIRED');
  const requestHash = hash({ company, actor, document_id: id, expected_revision: expected, intent, review_token: reviewToken });
  const replay = async (q: Queryable) => {
    await authority(q, company, actor, true, true);
    if (!await amendmentSchema(q)) fail(503, 'CORRECTION_SCHEMA_UNAVAILABLE');
    const previous = (await q.query('SELECT * FROM accounting_document_amendments WHERE company_id=$1 AND request_id=$2', [company, intent.request_id])).rows[0];
    if (!previous) return null;
    if (previous.document_id !== id || previous.actor_id !== actor || previous.request_hash !== requestHash) fail(409, 'IDEMPOTENCY_CONFLICT');
    await amendmentHistory(q, company, await document(q, company, id));
    return { status: 'duplicate', id: intent.request_id, document_id: id, revision: previous.revision, journal_id: previous.journal_id };
  };
  const initial = await transact(async q => {
    const prior = await replay(q); if (prior) return { replay: prior };
    const p = await plan(q, company, actor, id, expected, intent);
    if (p.review_token !== reviewToken) fail(409, 'CORRECTION_REVIEW_STALE');
    return { plan: p };
  });
  if (initial.replay) return initial.replay;
  let current = initial.plan!, tx: DatabaseTransaction, journal: any;
  const eventId = randomUUID(), revision = randomUUID();
  const identity = correctionIdentity({ document_id: id, request_id: intent.request_id });
  try {
    const posted = await correctCanonicalJournal({ principal: { kind: 'user', userId: actor, requestedCompanyId: company }, requestedCompanyId: company,
      originalJournalId: current.original.journal_id, reason: intent.reason, postingDate: intent.effective_date,
      configurationVersionId: current.original.mapping_revision, postingKind: 'document_correction', economicEffectId: identity, idempotencyKey: identity,
      replacementDescription: `Correction: ${current.original.number}`, reference: current.original.source.reference }, {
      contextProvider: { async lockForPosting(input, transaction) {
        tx = transaction; const q = queryAdapter(transaction);
        const prior = await replay(q); if (prior) throw new Replayed(prior);
        current = await plan(q, company, actor, id, expected, intent);
        if (current.review_token !== reviewToken) fail(409, 'CORRECTION_REVIEW_STALE');
        const context: PostingContext = { companyId: company, financialYearId: current.period.financial_year_id,
          accountingPeriodId: current.period.id, periodStatus: 'OPEN', configurationVersionId: current.original.mapping_revision, currencyCode: 'GBP',
          accounts: Object.fromEntries(current.accounts.map(account => [account.id, { id: account.id, companyId: company, isActive: true, isEligible: true, currencyCode: 'GBP' }])),
          metadata: { source_revision: input.source.sourceRevision, source_evidence_hash: input.source.evidenceHash,
            correction_review_token: reviewToken, document_revision: expected, business_accounting_basis: 'accrual' } };
        const authority: LockedAuthority<PostingContext> = { authority: context, recordKeys: [`companies:${company}`, `accounting_document_sources:${id}`,
          `accounting_document_periods:${current.period.id}`], capturedToken: { revision: expected }, lockMode: 'FOR UPDATE', transactionBound: true,
          validateCurrent: ({ command, companyId, source }) => companyId === company && current.review_token === reviewToken && current.history.head_revision === expected &&
            command.sourceId === current.original.journal_id && source?.sourceRevision === current.original.revision && source?.evidenceHash === current.postingEvidence
            ? { ok: true } : { ok: false, code: 'transaction_contract_invalid', message: 'Reviewed correction state changed.' } };
        return authority;
      } },
      lineBuilder: { async build() { return current.journal_lines; } },
      hooks: {
        afterJournalInsert: async input => { journal = input.journal; },
        beforeAuditInsert: async () => {
          const q = queryAdapter(tx!); const sequence = current.history.rows.length + 1;
          await q.query(`INSERT INTO accounting_document_amendments(id,company_id,document_id,sequence,previous_revision,revision,
            request_id,request_hash,review_token,actor_id,reason,effective_date,origin_journal_id,journal_id,financial_context_hash,
            before_source,after_source,before_money,after_money,delta_money,after_tax_context)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
          [eventId, company, id, sequence, expected, revision, intent.request_id, requestHash, reviewToken, actor, intent.reason, intent.effective_date,
            current.original.journal_id, journal.id, current.context, current.before.source, current.after.source, current.before.money,
            current.after.money, current.delta, current.afterRow.tax_context]);
          if (sequence === 1) await q.query(`INSERT INTO accounting_document_amendment_heads(company_id,document_id,current_revision,sequence) VALUES($1,$2,$3,$4)`, [company, id, revision, sequence]);
          else await q.query(`UPDATE accounting_document_amendment_heads SET current_revision=$3,sequence=$4 WHERE company_id=$1 AND document_id=$2`, [company, id, revision, sequence]);
          const projectedLines = current.after.source.line_items.map((line: any, index: number) => ({ ...line, entered_unit_price: line.unit_price,
            unit_price: current.afterRow.unit_net_prices[index], price_basis: current.after.source.price_basis,
            amount: pounds(current.after.money.lines[index].net_pence), vat_amount: pounds(current.after.money.lines[index].vat_pence),
            line_total: pounds(current.after.money.lines[index].gross_pence), vat_rate: current.afterRow.tax_context.lines[index].rate,
            tax_treatment: current.afterRow.tax_context.lines[index].treatment }));
          const projection = await q.query(`UPDATE ${tables[current.original.kind as Kind]} SET amount_paid=$3,balance_due=$4,status=$5,
            line_items=$6,subtotal=$7,vat_total=$8,total=$9,updated_at=clock_timestamp() WHERE company_id=$1 AND id=$2 AND status IN ('posted','part_paid','paid')`,
            [company, id, pounds(current.settlement.paid_minor), pounds(current.afterSettlement.open_minor),
              current.afterSettlement.settlement === 'settled' ? 'paid' : current.afterSettlement.settlement === 'part_paid' ? 'part_paid' : 'posted',
              JSON.stringify(projectedLines), pounds(current.after.money.net_pence), pounds(current.after.money.vat_pence), pounds(current.after.money.gross_pence)]);
          if (projection.rowCount !== 1) fail(409, 'SOURCE_PROJECTION_MISMATCH');
          await q.query(`INSERT INTO accounting_document_audit(id,company_id,document_id,actor_id,action,before_source,after_source)
            VALUES($1,$2,$3,$4,'correct',$5,$6)`, [randomUUID(), company, id, actor, current.before.source, current.after.source]);
          await testHook?.(tx!);
        },
      },
    });
    return { status: posted.status, id: intent.request_id, document_id: id, revision, journal_id: posted.journalId };
  } catch (error) { if (error instanceof Replayed) return error.result; throw error; }
}
