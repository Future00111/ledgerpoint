import { MAX_PENCE } from '../financialDrafts/contract';

/**
 * Pure financial-history projection. This is not a posting/correction command.
 *
 * The amendments reader loads the complete immutable history and an
 * independently bound head revision in one consistent database snapshot, and
 * verifies journal relationships and source/tax evidence before this helper.
 * The protected correction command additionally validates quantities, periods and
 * current capabilities. UUIDs/hashes here validate shape and
 * continuity; they do not establish authority or the existence of a journal.
 *
 * Document, settlement, report and credit admission readers share that validated
 * projection. Both persistence tables absent preserves original-only behavior;
 * partial or inconsistent installed history fails closed. Metadata-only revisions
 * remain separate.
 */
export type ProjectedDocumentKind = 'sales_invoice' | 'purchase_bill' | 'sales_credit_note' | 'supplier_credit_note';
export interface DocumentAmounts {
  readonly net_pence: string;
  readonly vat_pence: string;
  readonly gross_pence: string;
}
export interface DocumentLineAmounts extends DocumentAmounts {
  readonly original_line_ref: number;
}
export interface DocumentMoneySnapshot extends DocumentAmounts {
  readonly lines: readonly DocumentLineAmounts[];
}
export interface PostedDocumentOrigin {
  readonly company_id: string;
  readonly document_id: string;
  readonly kind: ProjectedDocumentKind;
  readonly currency: 'GBP';
  readonly status: 'posted';
  readonly revision: string;
  readonly effective_date: string;
  readonly journal_id: string;
  /** Frozen party, number, tax evidence, currency and account mapping context. */
  readonly financial_context_hash: string;
  readonly money: DocumentMoneySnapshot;
}
export interface FinancialDocumentAmendment {
  readonly company_id: string;
  readonly document_id: string;
  readonly event_id: string;
  readonly request_id: string;
  readonly kind: 'financial_correction';
  readonly status: 'posted';
  readonly previous_revision: string;
  readonly revision: string;
  readonly effective_date: string;
  readonly journal_id: string;
  readonly financial_context_hash: string;
  readonly before: DocumentMoneySnapshot;
  readonly after: DocumentMoneySnapshot;
  /** Signed changes in document value, NOT debit/credit or VAT-box signs. */
  readonly delta: DocumentMoneySnapshot;
}
export interface DocumentProjectionInput {
  readonly company_id: string;
  readonly document_id: string;
  readonly head_revision: string;
  readonly as_of: string;
  readonly original: PostedDocumentOrigin;
  /** Complete chain in revision order; unordered input is rejected, not sorted. */
  readonly amendments: readonly FinancialDocumentAmendment[];
}
export interface DocumentValueMovement {
  readonly kind: 'original' | 'financial_correction';
  readonly event_id: string | null;
  readonly revision: string;
  readonly effective_date: string;
  readonly journal_id: string;
  readonly delta: DocumentMoneySnapshot;
}
export interface DocumentAsOfProjection {
  readonly company_id: string;
  readonly document_id: string;
  readonly kind: ProjectedDocumentKind;
  readonly currency: 'GBP';
  readonly as_of: string;
  readonly head_revision: string;
  readonly original_revision: string;
  readonly exists: boolean;
  readonly financial_revision: string | null;
  readonly money: DocumentMoneySnapshot | null;
  readonly movements: readonly DocumentValueMovement[];
  readonly included_amendment_ids: readonly string[];
  readonly excluded_amendment_ids: readonly string[];
}

type ProjectionErrorCode = 'SHAPE_INVALID' | 'IDENTITY_INVALID' | 'SCOPE_MISMATCH' | 'CONTEXT_MISMATCH'
  | 'DATE_INVALID' | 'DATE_ORDER_INVALID' | 'MONEY_INVALID' | 'MONEY_MISMATCH' | 'LINE_IDENTITY_INVALID'
  | 'REVISION_CHAIN_INVALID' | 'DUPLICATE_EVENT' | 'DUPLICATE_REQUEST' | 'DUPLICATE_JOURNAL'
  | 'BEFORE_SNAPSHOT_MISMATCH' | 'DELTA_MISMATCH' | 'HEAD_REVISION_MISMATCH'
  | 'NO_FINANCIAL_CHANGE' | 'ZERO_AGGREGATE_CHANGE_UNSUPPORTED';

export class DocumentProjectionError extends Error {
  constructor(public readonly code: ProjectionErrorCode, public readonly path: string) {
    super(`DOCUMENT_PROJECTION_${code}`);
    this.name = 'DocumentProjectionError';
  }
}
function reject(code: ProjectionErrorCode, path: string): never { throw new DocumentProjectionError(code, path); }
const amountFields = ['net_pence', 'vat_pence', 'gross_pence'] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const kinds = new Set(['sales_invoice', 'purchase_bill', 'sales_credit_note', 'supplier_credit_note']);

function object(value: unknown, fields: readonly string[], path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) reject('SHAPE_INVALID', path);
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some(key => !fields.includes(key))
      || fields.some(key => !Object.hasOwn(row, key))) reject('SHAPE_INVALID', path);
  return row;
}
function id(value: unknown, path: string): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) reject('IDENTITY_INVALID', path);
  return value.toLowerCase();
}
function hash(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) reject('IDENTITY_INVALID', path);
  return value;
}
function date(value: unknown, path: string, posting = false): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)
      || value < (posting ? '1900-01-01' : '0001-01-01')
      || value > (posting ? '2199-12-31' : '9999-12-31')
      || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))
      || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) reject('DATE_INVALID', path);
  return value;
}
function minor(value: unknown, signed: boolean, path: string): string {
  if (typeof value !== 'string' || value.length > 13
      || !(signed ? /^(?:0|-?[1-9]\d*)$/ : /^(?:0|[1-9]\d*)$/).test(value)) reject('MONEY_INVALID', path);
  const n = BigInt(value);
  if (n > MAX_PENCE || n < -MAX_PENCE) reject('MONEY_INVALID', path);
  return value;
}
function amounts(row: Record<string, unknown>, signed: boolean, path: string): DocumentAmounts {
  const result = {
    net_pence: minor(row.net_pence, signed, `${path}/net_pence`),
    vat_pence: minor(row.vat_pence, signed, `${path}/vat_pence`),
    gross_pence: minor(row.gross_pence, signed, `${path}/gross_pence`),
  };
  if (BigInt(result.net_pence) + BigInt(result.vat_pence) !== BigInt(result.gross_pence)) reject('MONEY_MISMATCH', path);
  return result;
}
function snapshot(value: unknown, signed: boolean, path: string): DocumentMoneySnapshot {
  const row = object(value, [...amountFields, 'lines'], path);
  const totals = amounts(row, signed, path);
  if (!Array.isArray(row.lines) || row.lines.length < 1 || row.lines.length > 200) reject('SHAPE_INVALID', `${path}/lines`);
  const refs = new Set<number>();
  const lines = Array.from(row.lines, (value, index) => {
    const p = `${path}/lines/${index}`;
    const line = object(value, [...amountFields, 'original_line_ref'], p);
    const ref = line.original_line_ref;
    if (typeof ref !== 'number' || !Number.isSafeInteger(ref) || ref < 0 || ref >= 200 || refs.has(ref)) reject('LINE_IDENTITY_INVALID', p);
    refs.add(ref);
    return Object.freeze({ original_line_ref: ref, ...amounts(line, signed, p) });
  });
  for (const field of amountFields) {
    if (lines.reduce((sum, line) => sum + BigInt(line[field]), 0n) !== BigInt(totals[field])) reject('MONEY_MISMATCH', path);
  }
  if (!signed && BigInt(totals.gross_pence) <= 0n) reject('MONEY_INVALID', path);
  return Object.freeze({ ...totals, lines: Object.freeze(lines) });
}
function sameRefs(a: DocumentMoneySnapshot, b: DocumentMoneySnapshot, path: string) {
  if (a.lines.length !== b.lines.length || a.lines.some((line, i) => line.original_line_ref !== b.lines[i]?.original_line_ref)) reject('LINE_IDENTITY_INVALID', path);
}
function equalMoney(a: DocumentMoneySnapshot, b: DocumentMoneySnapshot): boolean {
  return amountFields.every(field => a[field] === b[field]) && a.lines.length === b.lines.length
    && a.lines.every((line, i) => line.original_line_ref === b.lines[i]?.original_line_ref
      && amountFields.every(field => line[field] === b.lines[i]?.[field]));
}
function verifyDelta(before: DocumentMoneySnapshot, after: DocumentMoneySnapshot, delta: DocumentMoneySnapshot, path: string) {
  for (const field of amountFields) {
    if (BigInt(after[field]) - BigInt(before[field]) !== BigInt(delta[field])) reject('DELTA_MISMATCH', path);
    for (let i = 0; i < before.lines.length; i++) {
      if (BigInt(after.lines[i]![field]) - BigInt(before.lines[i]![field]) !== BigInt(delta.lines[i]![field])) reject('DELTA_MISMATCH', `${path}/lines/${i}`);
    }
  }
}

/**
 * Validates the full financial chain, including events later than as_of, before
 * returning any result. This prevents a bad or truncated tail from being hidden
 * by an old cutoff. Input/returned snapshots never share mutable object refs.
 *
 * Initial bounded slice: monetary changes require a distinct posted journal ID.
 * Zero aggregate changes (including real per-line redistribution) are rejected
 * until their audit/journal contract is implemented. No zero journal is invented.
 */
export function projectDocumentAsOf(input: unknown): DocumentAsOfProjection {
  const row = object(input, ['company_id', 'document_id', 'head_revision', 'as_of', 'original', 'amendments'], '');
  const company = id(row.company_id, '/company_id');
  const document = id(row.document_id, '/document_id');
  const head = id(row.head_revision, '/head_revision');
  const cutoff = date(row.as_of, '/as_of');
  const origin = object(row.original, ['company_id', 'document_id', 'kind', 'currency', 'status', 'revision', 'effective_date', 'journal_id', 'financial_context_hash', 'money'], '/original');
  if (id(origin.company_id, '/original/company_id') !== company || id(origin.document_id, '/original/document_id') !== document) reject('SCOPE_MISMATCH', '/original');
  if (typeof origin.kind !== 'string' || !kinds.has(origin.kind) || origin.currency !== 'GBP' || origin.status !== 'posted') reject('SHAPE_INVALID', '/original');
  const originalRevision = id(origin.revision, '/original/revision');
  const originalDate = date(origin.effective_date, '/original/effective_date', true);
  const originalJournal = id(origin.journal_id, '/original/journal_id');
  const contextHash = hash(origin.financial_context_hash, '/original/financial_context_hash');
  const originalMoney = snapshot(origin.money, false, '/original/money');
  if (!Array.isArray(row.amendments) || row.amendments.length > 10000) reject('SHAPE_INVALID', '/amendments');
  const revisions = new Set([originalRevision]), journals = new Set([originalJournal]);
  const events = new Set<string>(), requests = new Set<string>();
  const included: string[] = [], excluded: string[] = [];
  const movements: DocumentValueMovement[] = [];
  const exists = originalDate <= cutoff;
  let currentMoney: DocumentMoneySnapshot | null = exists ? originalMoney : null;
  let currentRevision: string | null = exists ? originalRevision : null;
  let previousMoney = originalMoney, previousRevision = originalRevision, previousDate = originalDate;
  if (exists) movements.push(Object.freeze({ kind: 'original', event_id: null, revision: originalRevision, effective_date: originalDate, journal_id: originalJournal, delta: originalMoney }));

  for (const [index, value] of row.amendments.entries()) {
    const p = `/amendments/${index}`;
    const event = object(value, ['company_id', 'document_id', 'event_id', 'request_id', 'kind', 'status', 'previous_revision', 'revision', 'effective_date', 'journal_id', 'financial_context_hash', 'before', 'after', 'delta'], p);
    if (id(event.company_id, `${p}/company_id`) !== company || id(event.document_id, `${p}/document_id`) !== document) reject('SCOPE_MISMATCH', p);
    if (event.kind !== 'financial_correction' || event.status !== 'posted') reject('SHAPE_INVALID', p);
    if (hash(event.financial_context_hash, `${p}/financial_context_hash`) !== contextHash) reject('CONTEXT_MISMATCH', p);
    const eventId = id(event.event_id, `${p}/event_id`), requestId = id(event.request_id, `${p}/request_id`);
    const revision = id(event.revision, `${p}/revision`), journal = id(event.journal_id, `${p}/journal_id`);
    if (events.has(eventId)) reject('DUPLICATE_EVENT', p);
    if (requests.has(requestId)) reject('DUPLICATE_REQUEST', p);
    if (journals.has(journal)) reject('DUPLICATE_JOURNAL', p);
    if (revisions.has(revision) || id(event.previous_revision, `${p}/previous_revision`) !== previousRevision) reject('REVISION_CHAIN_INVALID', p);
    const effectiveDate = date(event.effective_date, `${p}/effective_date`, true);
    if (effectiveDate < previousDate) reject('DATE_ORDER_INVALID', p);
    const before = snapshot(event.before, false, `${p}/before`);
    const after = snapshot(event.after, false, `${p}/after`);
    const delta = snapshot(event.delta, true, `${p}/delta`);
    sameRefs(originalMoney, before, `${p}/before`);
    sameRefs(originalMoney, after, `${p}/after`);
    sameRefs(originalMoney, delta, `${p}/delta`);
    if (!equalMoney(previousMoney, before)) reject('BEFORE_SNAPSHOT_MISMATCH', p);
    verifyDelta(before, after, delta, `${p}/delta`);
    if (equalMoney(before, after)) reject('NO_FINANCIAL_CHANGE', p);
    if (amountFields.every(field => delta[field] === '0')) reject('ZERO_AGGREGATE_CHANGE_UNSUPPORTED', p);
    events.add(eventId); requests.add(requestId); revisions.add(revision); journals.add(journal);
    previousMoney = after; previousRevision = revision; previousDate = effectiveDate;
    if (effectiveDate <= cutoff) {
      currentMoney = after; currentRevision = revision; included.push(eventId);
      movements.push(Object.freeze({ kind: 'financial_correction', event_id: eventId, revision, effective_date: effectiveDate, journal_id: journal, delta }));
    } else excluded.push(eventId);
  }
  if (previousRevision !== head) reject('HEAD_REVISION_MISMATCH', '/head_revision');
  return Object.freeze({
    company_id: company, document_id: document, kind: origin.kind as ProjectedDocumentKind,
    currency: 'GBP', as_of: cutoff, head_revision: head, original_revision: originalRevision,
    exists, financial_revision: currentRevision, money: currentMoney,
    movements: Object.freeze(movements), included_amendment_ids: Object.freeze(included), excluded_amendment_ids: Object.freeze(excluded),
  });
}
