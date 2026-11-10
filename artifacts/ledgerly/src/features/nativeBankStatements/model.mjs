import { buildBankPreview, parseStatementDate, parseStatementMoney } from '../bankImport/model.mjs';

export const MAX_MINOR = 999999999999n;
export const MAX_REFERENCE = 500;
export const MAX_BATCH_ROWS = 500;
const isMinor = v => typeof v === 'string' && /^(0|[1-9]\d*)$/.test(v) && BigInt(v) <= MAX_MINOR;

/** Integer pence string -> "1,234.56" (exact; never via floating point). */
export function formatMinor(minor) {
  if (typeof minor !== 'string' || !/^-?\d+$/.test(minor)) return '—';
  const n = BigInt(minor), abs = n < 0n ? -n : n;
  const pounds = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${n < 0n ? '-' : ''}£${pounds}.${String(abs % 100n).padStart(2, '0')}`;
}

/** Strict pounds -> positive pence string for a partial match amount. Null when invalid. */
export function poundsToMinor(input) {
  const s = String(input ?? '').trim();
  const m = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const p = BigInt(m[1].replace(/,/g, '')) * 100n + BigInt((m[2] || '').padEnd(2, '0'));
  return p > 0n && p <= MAX_MINOR ? p.toString() : null;
}
export const minorToPounds = minor => isMinor(minor) ? `${BigInt(minor) / 100n}.${String(BigInt(minor) % 100n).padStart(2, '0')}` : '';

/** Existing CSV parser/mapping output -> exact API row fields (decimal strings, no float). */
export function rowsFromCsv(file, { columnMap, dateFormat, companyId, bankAccountId }) {
  const checked = buildBankPreview({ ...file, columnMap, dateFormat, companyId, bankAccountId });
  if (checked.errors.length) return { rows: [], errors: checked.errors };
  return { errors: [], rows: checked.transactions.map(t => ({
    key: `csv-${t.sourceRow}`, source: `CSV row ${t.sourceRow}`,
    date: t.payload.date, description: t.payload.description, reference: t.payload.reference || '',
    money_in: t.inDecimal, money_out: t.outDecimal,
  })) };
}

export const blankManualRow = n => ({ key: `manual-${n}`, source: 'Manual entry', date: '', description: '', reference: '', money_in: '', money_out: '' });

/** Validates one editable row (CSV or manual) to exact API fields. */
export function normaliseRow(row) {
  const date = parseStatementDate(row.date, 'iso');
  const description = String(row.description ?? '').trim();
  if (!description || description.length > 1000) throw new Error('Description must contain 1-1,000 characters.');
  const reference = String(row.reference ?? '').trim();
  if (reference.length > MAX_REFERENCE) throw new Error('Reference must be at most 500 characters.');
  const inn = parseStatementMoney(row.money_in), out = parseStatementMoney(row.money_out);
  if ((inn.pence !== '0') === (out.pence !== '0')) throw new Error('Enter a positive amount in exactly one of Money in or Money out.');
  return { date, description, reference, money_in: inn.decimal, money_out: out.decimal };
}

export function buildImportBody({ requestId, bankAccountId, rows }) {
  const errors = [];
  if (!bankAccountId) errors.push({ message: 'Choose a bank account.' });
  if (!rows.length) errors.push({ message: 'Add at least one statement row.' });
  if (rows.length > MAX_BATCH_ROWS) errors.push({ message: 'Import no more than 500 rows at a time.' });
  const out = [];
  rows.forEach((row, index) => {
    try { out.push(normaliseRow(row)); } catch (e) { errors.push({ index, message: `${row.source || `Row ${index + 1}`}: ${e.message}` }); }
  });
  if (errors.length) return { errors };
  return { body: { request_id: requestId, bank_account_id: bankAccountId, rows: out } };
}

export function verifyImportReview(review, body) {
  if (!review || typeof review.review_token !== 'string' || !review.review_token || typeof review.can_import !== 'boolean' || !Array.isArray(review.duplicates)) throw new Error('The import review could not be verified. Nothing was imported.');
  if (review.intent && review.intent.request_id && review.intent.request_id !== body.request_id) throw new Error('The import review belongs to another request. Nothing was imported.');
  return review;
}

export function verifyImportReceipt(receipt, body) {
  if (receipt?.status === 'unknown' && receipt.request_id === body.request_id) return { status: 'unknown' };
  if (!receipt || receipt.request_id !== body.request_id || !Array.isArray(receipt.rows) || receipt.rows.length !== body.rows.length) throw new Error('The import receipt could not be verified.');
  return { status: 'recorded', count: receipt.rows.length, receipt };
}

/** A bank's own opening-mapped ledger wins; otherwise the company payment default. */
export function bankLedgerFor(context, bankId) {
  const bank = (context?.banks || []).find(b => b.id === bankId);
  return bank?.bank_ledger_account_id || context?.bank_ledger_account_id || null;
}

/** True when the duplicate list or can_import blocks importing. Any duplicate always blocks. */
export const importBlocked = review => !review || review.can_import !== true || !Array.isArray(review.duplicates) || review.duplicates.length > 0;

/** Customer receipts settle money in, supplier payments settle money out. Server re-verifies. */
export function eligiblePayments(context, statement) {
  if (!context || !statement || statement.native !== true || statement.status === 'matched') return [];
  const ledger = bankLedgerFor(context, statement.bank_account_id);
  const party = statement.direction === 'in' ? 'customer' : statement.direction === 'out' ? 'supplier' : null;
  return (context.payments || []).filter(p => party && p.party_type === party && ledger &&
    p.bank_ledger_account_id === ledger && isMinor(p.remaining_minor) && BigInt(p.remaining_minor) > 0n);
}

export function buildMatchBody({ requestId, statement, payment, amount }) {
  if (!statement || !payment) return { error: 'Choose a statement line and a payment.' };
  const amount_minor = poundsToMinor(amount);
  if (!amount_minor) return { error: 'Enter a positive amount in pounds with at most two decimal places.' };
  if (!isMinor(statement.remaining_minor) || !isMinor(payment.remaining_minor)) return { error: 'Remaining amounts could not be verified. Refresh.' };
  if (BigInt(amount_minor) > BigInt(statement.remaining_minor)) return { error: 'The amount exceeds what remains on the statement line.' };
  if (BigInt(amount_minor) > BigInt(payment.remaining_minor)) return { error: 'The amount exceeds what remains on the payment.' };
  return { body: { request_id: requestId, bank_transaction_id: statement.id, payment_id: payment.id, amount_minor } };
}
export const defaultMatchAmount = (statement, payment) => {
  if (!isMinor(statement?.remaining_minor) || !isMinor(payment?.remaining_minor)) return '';
  const s = BigInt(statement.remaining_minor), p = BigInt(payment.remaining_minor);
  return minorToPounds((s < p ? s : p).toString());
};

export function verifyMatchReview(review, body) {
  if (!review || typeof review.review_token !== 'string' || !review.review_token) throw new Error('The match review could not be verified. Nothing was recorded.');
  if (review.statement?.id && review.statement.id !== body.bank_transaction_id) throw new Error('The match review does not match your selection.');
  if (review.payment?.id && review.payment.id !== body.payment_id) throw new Error('The match review does not match your selection.');
  return review;
}
export function verifyMatchReceipt(r, body) {
  if (r?.status === 'unknown' && r.request_id === body.request_id) return { status: 'unknown' };
  if (r?.status !== 'recorded' || r.request_id !== body.request_id || r.bank_transaction_id !== body.bank_transaction_id || r.payment_id !== body.payment_id || r.amount_minor !== body.amount_minor) throw new Error('The match receipt could not be verified.');
  return { status: 'recorded', receipt: r };
}

export function statusExplanation(s) {
  if (s.status === 'matched') return 'Fully matched to recorded payments. Nothing remains to explain.';
  if (s.status === 'partial') return `${formatMinor(s.remaining_minor)} is still unexplained. Match another payment, or record the missing payment first.`;
  return `${formatMinor(s.remaining_minor)} is unexplained. No recorded payment has been matched yet.`;
}

const key = (c, op) => `ledgerpoint:bank-statements:pending:${c}:${op}`;
/** One pending submitted body per company and operation ('import' | 'match'). Holds the exact body for exact retry. */
export const pendingStore = (storage = globalThis.sessionStorage) => ({
  read(c, op) { try { const v = storage?.getItem(key(c, op)); const p = v ? JSON.parse(v) : null; return p?.body?.request_id ? p : null; } catch { return null; } },
  write(c, op, body) {
    try { if (!storage) return false; const v = JSON.stringify({ body }); storage.setItem(key(c, op), v); return storage.getItem(key(c, op)) === v; } catch { return false; }
  },
  clear(c, op) { try { storage?.removeItem(key(c, op)); } catch { /* storage unavailable */ } },
});

/** Ignore responses from a superseded request, company or unmount. */
export function createGate() {
  let v = 0;
  return { begin: () => ++v, current: t => t === v, cancel: () => { v++; } };
}
export const newRequestId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** A failed GET/retry cannot establish that an earlier POST did not commit. */
export function unresolvedRecovery(error) {
  return `The earlier outcome is still unconfirmed. Keep this request and check again when access is restored. ${error?.message || 'Outcome lookup failed.'}`;
}
export const retainPendingOnFailure = (error, phase) => phase === 'recovery' || !error?.status || error.status >= 500;
/** Only called after a verified receipt. Closing invalidates stale reviews/warnings. */
export function refreshRecoveredMatch(closeMatch, reloadContext) {
  closeMatch(null);
  return reloadContext();
}
