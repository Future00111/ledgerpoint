import { fail } from '../financialDrafts/contract';
import { hash, type Queryable } from './core';
import { projectDocumentAsOf, DocumentProjectionError } from './documentEvents';
import { amendmentContextHash, amendmentMoney, amendmentJournalLines, sameJournalLines } from './amendmentsMath';
import { journalLines } from './documentJournal';
import { prepareConditionalOriginal, verifiedOriginal } from './conditionalDiscount';

export async function amendmentSchema(q: Queryable): Promise<boolean> {
  const row = (await q.query(`SELECT to_regclass('public.accounting_document_amendments') amendments,
    to_regclass('public.accounting_document_amendment_heads') heads`)).rows[0];
  if (!row.amendments && !row.heads) return false;
  if (!row.amendments || !row.heads) fail(503, 'CORRECTION_SCHEMA_INCOMPLETE');
  return true;
}

const identity = (row: any) => `document-correction:${row.document_id}:${row.request_id}`;
export const correctionIdentity = identity;
const evidence = (row: any) => hash({ source: row.source, money: row.money, tax_context: row.tax_context, accounts: row.posting_accounts });
export const documentEvidenceHash = evidence;

/** Conditional originals commit their full agreement binding, not merely the
 * financial snapshot. Verify that immutable original; never substitute a new
 * replacement or corrected financial hash for the original posting identity. */
export async function originalPostingEvidence(q: Queryable, company: string, original: any) {
  if (!original.source?.conditional_discount) return evidence(original);
  const prepared = await prepareConditionalOriginal(q, company, original);
  if (!await verifiedOriginal(q, company, original.id, prepared.bindingHash)) fail(503,'CORRECTION_JOURNAL_INVALID');
  return prepared.bindingHash;
}

/** Validates the complete persisted chain before a current OR historical projection. */
export async function amendmentHistory(q: Queryable, company: string, original: any, asOf = '9999-12-31') {
  const unavailable = !await amendmentSchema(q);
  if (unavailable || original.status !== 'posted') return { available: !unavailable, rows: [], current: original,
    original, head_revision: original.revision, latest_date: original.source.issue_date, projection: null };
  const heads = (await q.query(`SELECT * FROM accounting_document_amendment_heads WHERE company_id=$1 AND document_id=$2`, [company, original.id])).rows;
  const rows = (await q.query(`SELECT a.*,a.effective_date::text FROM accounting_document_amendments a
    WHERE company_id=$1 AND document_id=$2 ORDER BY sequence`, [company, original.id])).rows;
  if (!rows.length) {
    if (heads.length) fail(503, 'CORRECTION_HISTORY_INVALID');
    return { available: true, rows, current: original, original, head_revision: original.revision,
      latest_date: original.source.issue_date, projection: null };
  }
  if (heads.length !== 1 || Number(heads[0].sequence) !== rows.length || heads[0].current_revision !== rows.at(-1).revision || rows.length > 10000)
    fail(503, 'CORRECTION_HISTORY_INVALID');
  if (!['sales_invoice', 'purchase_bill'].includes(original.kind)) fail(503, 'CORRECTION_HISTORY_INVALID');
  const ids = [original.journal_id, ...rows.map(row => row.journal_id)];
  const entries = (await q.query(`SELECT j.*,j.posting_date::text FROM canonical_journal_entries j
    WHERE company_id=$1 AND id=ANY($2::uuid[])`, [company, ids])).rows;
  const lines = (await q.query(`SELECT * FROM canonical_journal_lines WHERE company_id=$1
    AND journal_entry_id=ANY($2::uuid[]) ORDER BY journal_entry_id,line_number`, [company, ids])).rows;
  const relations = (await q.query(`SELECT * FROM canonical_journal_relations WHERE company_id=$1
    AND (original_journal_id=ANY($2::uuid[]) OR related_journal_id=ANY($2::uuid[]))`, [company, ids])).rows;
  const audits = (await q.query(`SELECT * FROM accounting_audit_events WHERE company_id=$1
    AND journal_id=ANY($2::uuid[]) AND action='correction' AND outcome='posted'`, [company, rows.map(row => row.journal_id)])).rows;
  const effects = (await q.query(`SELECT * FROM accounting_posting_effects WHERE company_id=$1
    AND journal_id=ANY($2::uuid[])`, [company, rows.map(row => row.journal_id)])).rows;
  const first = entries.find(entry => entry.id === original.journal_id);
  if (!first || first.status !== 'posted' || first.source_type !== original.kind || first.source_id !== original.id ||
    first.source_revision !== original.revision || first.source_evidence_hash !== await originalPostingEvidence(q,company,original) ||
    !sameJournalLines(lines.filter(line => line.journal_entry_id === first.id), journalLines(original))) fail(503, 'CORRECTION_JOURNAL_INVALID');
  if (relations.length !== rows.length || relations.some(relation => relation.relation_type !== 'correction' ||
    relation.original_journal_id !== original.journal_id || !rows.some(row => row.journal_id === relation.related_journal_id)))
    fail(503, 'CORRECTION_JOURNAL_INVALID');
  const context = amendmentContextHash(original);
  let previous = original;
  const events = [];
  for (const [index, row] of rows.entries()) {
    if (Number(row.sequence) !== index + 1 || row.origin_journal_id !== original.journal_id ||
      row.financial_context_hash !== context || hash(row.before_source) !== hash(previous.source) ||
      hash(row.before_money) !== hash(previous.money)) fail(503, 'CORRECTION_HISTORY_INVALID');
    const after = { ...original, source: row.after_source, money: row.after_money, tax_context: row.after_tax_context, revision: row.revision };
    if (amendmentContextHash(after) !== context || row.after_tax_context.source_fingerprint !== hash(row.after_source))
      fail(503, 'CORRECTION_HISTORY_INVALID');
    const entry = entries.find(entry => entry.id === row.journal_id);
    const relation = relations.find(item => item.related_journal_id === row.journal_id);
    const effect = effects.find(item => item.journal_id === row.journal_id);
    const audit = audits.find(item => item.journal_id === row.journal_id);
    if (!entry || entry.status !== 'posted' || entry.source_type !== 'canonical_journal' || entry.source_id !== original.journal_id ||
      entry.source_revision !== original.revision || entry.source_evidence_hash !== await originalPostingEvidence(q,company,original) || entry.currency_code !== 'GBP' ||
      entry.posting_kind !== 'document_correction' || entry.posting_date !== row.effective_date ||
      entry.reversal_of_id !== original.journal_id || entry.correction_reason !== row.reason ||
      entry.created_by_type !== 'user' || entry.created_by_id !== row.actor_id || entry.economic_effect_id !== identity(row) ||
      !relation || relation.reason !== row.reason || relation.actor_id !== row.actor_id || relation.actor_type !== 'user' ||
      relation.idempotency_key !== identity(row) || relation.economic_effect_id !== identity(row) ||
      !effect || effect.status !== 'posted' || effect.idempotency_key !== identity(row) || effect.economic_effect_id !== identity(row) ||
      !audit || audit.actor_id !== row.actor_id || audit.capability !== 'accounting.correct' || audit.reason !== row.reason ||
      audit.posting_effect_id !== effect.id || !sameJournalLines(lines.filter(line => line.journal_entry_id === row.journal_id), amendmentJournalLines(previous, after)))
      fail(503, 'CORRECTION_JOURNAL_INVALID');
    events.push({ company_id: company, document_id: original.id, event_id: row.id, request_id: row.request_id,
      kind: 'financial_correction', status: 'posted', previous_revision: row.previous_revision, revision: row.revision,
      effective_date: row.effective_date, journal_id: row.journal_id, financial_context_hash: context,
      before: amendmentMoney(row.before_money), after: amendmentMoney(row.after_money), delta: row.delta_money });
    previous = after;
  }
  let projection;
  try {
    projection = projectDocumentAsOf({ company_id: company, document_id: original.id, head_revision: heads[0].current_revision, as_of: asOf,
      original: { company_id: company, document_id: original.id, kind: original.kind, currency: 'GBP', status: 'posted',
        revision: original.revision, effective_date: original.source.issue_date, journal_id: original.journal_id,
        financial_context_hash: context, money: amendmentMoney(original.money) }, amendments: events });
  } catch (error) { if (error instanceof DocumentProjectionError) fail(503, 'CORRECTION_HISTORY_INVALID'); throw error; }
  const last = rows.filter(row => row.effective_date <= asOf).at(-1);
  const current = last ? { ...original, source: last.after_source, money: last.after_money, tax_context: last.after_tax_context,
    revision: last.revision, updated_at: last.created_at } : original;
  return { available: true, rows, original, current: { ...current, original_revision: original.revision, original_money: original.money,
    correction_count: rows.filter(row => row.effective_date <= asOf).length, latest_correction_date: last?.effective_date ?? null },
    head_revision: heads[0].current_revision, latest_date: rows.at(-1).effective_date, projection };
}

export async function assertUncorrectedOriginal(q: Queryable, company: string, original: any) {
  const history = await amendmentHistory(q, company, original);
  if (history.rows.length) fail(409, 'CORRECTED_DOCUMENT_DEPENDENCY_UNSUPPORTED');
}
