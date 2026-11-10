import { bankLedgerFor, eligiblePayments } from './model.mjs';

const isMinor = v => typeof v === 'string' && /^(0|[1-9]\d*)$/.test(v) && BigInt(v) <= 999999999999n;
export const MAX_REASON = 1000;

/** Only active, write-permitted receipts with a known request id may be corrected. */
export const canCorrect = (match, canWrite) => canWrite === true && match?.active === true && typeof match.request_id === 'string' && !!match.request_id && !match.correction_request_id;

/** Partition matches for a statement line into active and corrected (history) receipts. Original receipts are never dropped. */
export function matchHistory(matches, statementId) {
  const all = (matches || []).filter(m => m && m.bank_transaction_id === statementId);
  return { active: all.filter(m => m.active === true), corrected: all.filter(m => m.active !== true) };
}

/** Body for review (no token) and confirm (with token). Releases the whole receipt; no amount or date is sent. */
export function buildCorrectionBody({ requestId, match, reason }) {
  if (!match?.request_id || match.active !== true) return { error: 'Only an active match can be corrected. Refresh.' };
  const r = String(reason ?? '').trim();
  if (!r) return { error: 'Enter a reason for the correction.' };
  if (r.length > MAX_REASON) return { error: 'The reason must be at most 1,000 characters.' };
  return { body: { request_id: requestId, match_request_id: match.request_id, reason: r } };
}

export function verifyCorrectionReview(review, body, match) {
  const m = review?.match;
  if (!review || typeof review.review_token !== 'string' || !review.review_token || !m) throw new Error('The correction review could not be verified. Nothing was changed.');
  if (m.request_id !== body.match_request_id || (match && (m.bank_transaction_id !== match.bank_transaction_id || m.payment_id !== match.payment_id || m.amount_minor !== match.amount_minor)))
    throw new Error('The correction review does not match the selected receipt. Nothing was changed.');
  if (!isMinor(m.amount_minor) || !isMinor(review.statement_remaining_minor) || !isMinor(review.payment_remaining_minor)) throw new Error('The correction review amounts could not be verified. Nothing was changed.');
  if (review.intent?.request_id && review.intent.request_id !== body.request_id) throw new Error('The correction review belongs to another request. Nothing was changed.');
  return review;
}

/** Receipt must echo the exact request, match and full released amount (when known). */
export function verifyCorrectionReceipt(r, body, expectedAmount) {
  if (r?.status === 'unknown' && r.request_id === body.request_id) return { status: 'unknown' };
  if (r?.status !== 'recorded' || r.request_id !== body.request_id || r.match_request_id !== body.match_request_id || !isMinor(r.released_minor)
    || typeof r.effective_at !== 'string' || Number.isNaN(Date.parse(r.effective_at)) || (expectedAmount && r.released_minor !== expectedAmount))
    throw new Error('The correction receipt could not be verified.');
  return { status: 'recorded', receipt: r };
}

/**
 * Payment options respecting an explicit payment direction when provided.
 * Refund payments are offered only when the server flags refund matching support.
 * Payments without a direction fall back to the existing party-type rule.
 */
export function directionalPayments(ctx, statement) {
  const base = eligiblePayments(ctx, statement);
  if (!ctx || !statement) return base;
  const ledger = bankLedgerFor(ctx, statement.bank_account_id);
  const refunds = ctx.supports_refund_matching === true;
  const directed = (ctx.payments || []).filter(p => p && (p.direction === 'in' || p.direction === 'out'));
  if (!directed.length || statement.native !== true || statement.status === 'matched') return base.filter(p => p.kind !== 'refund' || refunds);
  const keep = p => (p.kind !== 'refund' || refunds) && ledger && p.bank_ledger_account_id === ledger && isMinor(p.remaining_minor) && BigInt(p.remaining_minor) > 0n;
  const fromDirection = directed.filter(p => p.direction === statement.direction && keep(p));
  const undirected = base.filter(p => p.direction !== 'in' && p.direction !== 'out' && keep(p));
  return [...fromDirection, ...undirected];
}

export const formatWhen = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/London' }); };
