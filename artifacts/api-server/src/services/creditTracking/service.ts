import { randomUUID } from 'node:crypto';
import { canWriteDraft, decimal, fail, uuid } from '../financialDrafts/contract';
import { document, exactFields, hash, scope, transact, type Queryable } from '../accountingDocuments/core';
import { expectedClaim, creditCandidate, claimProgress } from './domain';

type Row = Record<string, any>;
type TestHook = (q: Queryable) => Promise<void>;
const commandFields = ['request_id', 'bill_id', 'bill_revision', 'reason', 'return_reference', 'returned_on', 'expected_by', 'lines'];
function text(value: unknown, limit: number, required = false, multiline = false): string {
  const controls = multiline ? /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/ : /[\x00-\x1f\x7f]/;
  if (typeof value !== 'string' || value.length > limit || controls.test(value) || (required && !value.trim())) fail(422, 'FIELD_INVALID');
  return value.trim();
}
function date(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2199-12-31' ||
    !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) fail(422, 'FIELD_INVALID');
  return value;
}
async function liveJournal(q: Queryable, company: string, row: Row) {
  if (row.status !== 'posted' || !row.journal_id) return false;
  const r = await q.query(`SELECT j.id FROM canonical_journal_entries j
    WHERE j.company_id=$1 AND j.id=$2 AND j.source_id=$3 AND j.status='posted'
    AND j.source_type=$4 AND j.source_revision=$5
    AND NOT EXISTS(SELECT 1 FROM canonical_journal_relations r
      WHERE r.company_id=j.company_id AND r.original_journal_id=j.id AND r.relation_type='reversal')`, [company, row.journal_id, row.id, row.kind, row.revision]);
  return r.rowCount === 1;
}
async function claimRow(q: Queryable, company: string, id: string) {
  const r = await q.query('SELECT * FROM supplier_credit_claims WHERE company_id=$1 AND id=$2 FOR UPDATE', [company, uuid(id)]);
  if (r.rowCount !== 1) fail(404, 'RESOURCE_NOT_FOUND');
  return r.rows[0];
}
async function command<T>(company: string, actor: string, action: string, body: Row, expected: string | undefined,
  run: (q: Queryable) => Promise<{ result: T; ids: string[] }>, hook?: TestHook) {
  const requestId = uuid(body.request_id), fingerprint = hash({ actor, action, body, expected: expected ?? null });
  return transact(async q => {
    // Same company lock order as posting. Serializes retries/duplicate receipts,
    // current membership, and journal reversals against confirmation.
    await scope(q, company, actor, true, true);
    const previous = await q.query('SELECT request_hash,result FROM supplier_credit_claim_commands WHERE company_id=$1 AND request_id=$2', [company, requestId]);
    if (previous.rowCount) {
      if (previous.rows[0].request_hash !== fingerprint) fail(409, 'REQUEST_ID_CONFLICT');
      return previous.rows[0].result as T;
    }
    const { result, ids } = await run(q);
    await q.query(`INSERT INTO supplier_credit_claim_commands(company_id,request_id,actor_id,action,request_hash,claim_ids,result)
      VALUES($1,$2,$3,$4,$5,$6,$7)`, [company, requestId, actor, action, fingerprint, JSON.stringify(ids), result]);
    await hook?.(q);
    return result;
  });
}
export async function createClaims(company: string, actor: string, input: unknown, hook?: TestHook) {
  const body = exactFields(input, commandFields);
  return command(company, actor, 'create', body, undefined, async q => {
    const bill = await document(q, company, uuid(body.bill_id), true);
    if (bill.kind !== 'purchase_bill' || !await liveJournal(q, company, bill)) fail(409, 'POSTED_BILL_REQUIRED');
    if (uuid(body.bill_revision) !== bill.revision) fail(409, 'REVISION_CONFLICT');
    const reason = text(body.reason, 1000, true, true), returnReference = text(body.return_reference ?? '', 200);
    const returnedOn = date(body.returned_on), expectedBy = date(body.expected_by);
    if (returnedOn && returnedOn < bill.source.issue_date) fail(422, 'RETURN_PRECEDES_BILL');
    if (returnedOn && expectedBy && expectedBy < returnedOn) fail(422, 'EXPECTED_DATE_PRECEDES_RETURN');
    if (!Array.isArray(body.lines) || body.lines.length < 1 || body.lines.length > 200) fail(422, 'LINES_RANGE');
    const seen = new Set<number>(), ids: string[] = [];
    // Existing posted credits must not silently satisfy a newly recorded return.
    const baseline = (await q.query("SELECT id FROM accounting_document_sources WHERE company_id=$1 AND original_id=$2 AND kind='supplier_credit_note' AND status='posted'", [company, bill.id])).rows.map(r => r.id);
    for (const raw of body.lines) {
      const line = exactFields(raw, ['original_line_ref', 'quantity', 'part_reference', 'job_reference']);
      if (!Number.isInteger(line.original_line_ref) || seen.has(line.original_line_ref)) fail(422, 'LINE_REFERENCE_INVALID');
      seen.add(line.original_line_ref);
      const snapshot = expectedClaim(bill, line.original_line_ref, line.quantity);
      const existing = await q.query('SELECT id FROM supplier_credit_claims WHERE company_id=$1 AND bill_id=$2 AND original_line_ref=$3 AND NOT cancelled', [company, bill.id, line.original_line_ref]);
      if (existing.rowCount) fail(409, 'LINE_ALREADY_TRACKED');
      const id = randomUUID(); ids.push(id);
      await q.query(`INSERT INTO supplier_credit_claims(id,company_id,bill_id,bill_revision,party_id,original_line_ref,revision,
        quantity,description,expected,reason,return_reference,part_reference,job_reference,returned_on,expected_by,baseline_credit_ids,created_by)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [id, company, bill.id, bill.revision, bill.party_id, line.original_line_ref, randomUUID(), snapshot.quantity, snapshot.description,
        snapshot.expected, reason, returnReference, text(line.part_reference ?? '', 200), text(line.job_reference ?? '', 200), returnedOn, expectedBy, JSON.stringify(baseline), actor]);
    }
    return { result: { ids }, ids };
  }, hook);
}
export async function confirmReceipt(company: string, actor: string, id: string, expected: string, input: unknown, hook?: TestHook) {
  const body = exactFields(input, ['request_id', 'credit_id', 'credit_revision', 'credit_line_ref']);
  return command(company, actor, 'receive', { ...body, claim_id: uuid(id) }, expected, async q => {
    const claim = await claimRow(q, company, id);
    if (claim.cancelled) fail(409, 'CLAIM_CANCELLED');
    if (claim.revision !== expected) fail(409, 'REVISION_CONFLICT');
    const bill = await document(q, company, claim.bill_id, true);
    if (bill.revision !== claim.bill_revision || !await liveJournal(q, company, bill)) fail(409, 'ORIGINAL_BILL_NOT_CURRENT');
    const credit = await document(q, company, uuid(body.credit_id), true);
    if (credit.revision !== uuid(body.credit_revision)) fail(409, 'CREDIT_REVISION_CONFLICT');
    if (!creditCandidate(claim, credit, body.credit_line_ref) || !await liveJournal(q, company, credit)) fail(409, 'CREDIT_MATCH_INVALID');
    if (claim.baseline_credit_ids.includes(credit.id)) fail(409, 'CREDIT_PREDATES_CLAIM');
    const duplicate = await q.query('SELECT id FROM supplier_credit_receipts WHERE company_id=$1 AND credit_id=$2 AND credit_line_ref=$3', [company, credit.id, body.credit_line_ref]);
    if (duplicate.rowCount) fail(409, 'CREDIT_ALREADY_RECEIVED');
    const money = credit.money.lines[body.credit_line_ref], quantity = credit.source.line_items[body.credit_line_ref].quantity;
    // Validate the persisted receipt snapshot using the same pure projection.
    claimProgress(claim.expected, [{ money, quantity, active: true }]);
    const revision = randomUUID();
    await q.query(`INSERT INTO supplier_credit_receipts(id,company_id,claim_id,credit_id,credit_revision,credit_line_ref,quantity,money,confirmed_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [randomUUID(), company, id, credit.id, credit.revision, body.credit_line_ref, quantity, money, actor]);
    await q.query('UPDATE supplier_credit_claims SET revision=$3 WHERE company_id=$1 AND id=$2', [company, id, revision]);
    return { result: { claim_id: id, revision }, ids: [id] };
  }, hook);
}
export async function cancelClaim(company: string, actor: string, id: string, expected: string, input: unknown, hook?: TestHook) {
  const body = exactFields(input, ['request_id']);
  return command(company, actor, 'cancel', { ...body, claim_id: uuid(id) }, expected, async q => {
    const claim = await claimRow(q, company, id);
    if (claim.revision !== expected) fail(409, 'REVISION_CONFLICT');
    const receipts = await q.query('SELECT id FROM supplier_credit_receipts WHERE company_id=$1 AND claim_id=$2', [company, id]);
    if (claim.cancelled || receipts.rowCount) fail(409, 'CLAIM_CANNOT_CANCEL');
    const revision = randomUUID();
    await q.query('UPDATE supplier_credit_claims SET cancelled=true,revision=$3 WHERE company_id=$1 AND id=$2', [company, id, revision]);
    return { result: { claim_id: id, revision }, ids: [id] };
  }, hook);
}
export async function listClaims(company: string, actor: string, billId?: string) {
  if (billId !== undefined) uuid(billId);
  return transact(async q => {
    await scope(q, company, actor);
    const role = (await q.query('SELECT role FROM company_users WHERE company_id=$1 AND user_id=$2', [company, actor])).rows[0].role;
    const rows = (await q.query(`SELECT c.*, to_char(c.returned_on,'YYYY-MM-DD') returned_on, to_char(c.expected_by,'YYYY-MM-DD') expected_by,
      b.number bill_number, p.name party_name FROM supplier_credit_claims c
      JOIN accounting_document_sources b ON b.company_id=c.company_id AND b.id=c.bill_id
      JOIN suppliers p ON p.company_id=c.company_id AND p.id=c.party_id
      WHERE c.company_id=$1 AND ($2::uuid IS NULL OR c.bill_id=$2) ORDER BY c.created_at DESC,c.id`, [company, billId ?? null])).rows;
    const claims = [];
    for (const claim of rows) {
      const bill = await document(q, company, claim.bill_id);
      const originalActive = bill.revision === claim.bill_revision && await liveJournal(q, company, bill);
      const credits = (await q.query("SELECT * FROM accounting_document_sources WHERE company_id=$1 AND original_id=$2 AND kind='supplier_credit_note' ORDER BY created_at,id", [company, claim.bill_id])).rows;
      const allocations = (await q.query('SELECT * FROM supplier_credit_receipts WHERE company_id=$1 AND credit_id=ANY($2::uuid[])', [company, credits.map(r => r.id)])).rows;
      const receipts = [], candidates = [];
      for (const credit of credits) {
        const active = originalActive && await liveJournal(q, company, credit);
        for (let index = 0; index < credit.source.line_items.length; index++) {
          const allocation = allocations.find(r => r.credit_id === credit.id && r.credit_line_ref === index);
          if (allocation?.claim_id === claim.id) receipts.push({ ...allocation, number: credit.number,
            active: active && credit.revision === allocation.credit_revision && creditCandidate(claim, credit, index) });
          if (claim.cancelled || allocation || claim.baseline_credit_ids.includes(credit.id) || !creditCandidate(claim, credit, index) || (credit.status==='posted' && !active)) continue;
          candidates.push({ credit_id: credit.id, credit_revision: credit.revision, credit_line_ref: index, number: credit.number,
            status: credit.status, quantity: credit.source.line_items[index].quantity, money: credit.money.lines[index],
            can_confirm: active && canWriteDraft(role, true) });
        }
      }
      const progress = claimProgress(claim.expected, receipts);
      // Quantity is evidence independent of amount: a reduced-price full-quantity
      // credit can still be partial by value. Excess quantity needs review.
      const receivedUnits = receipts.filter(r => r.active).reduce((n, r) => n + decimal(r.quantity, true), 0n);
      if (!originalActive || receivedUnits > decimal(claim.quantity, true)) progress.status = 'needs_review';
      claims.push({ ...claim, ...progress, candidates, receipts });
    }
    return { can_manage: canWriteDraft(role, true), claims };
  }, true);
}
