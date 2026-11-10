import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCorrectionBody, canCorrect, directionalPayments, matchHistory, verifyCorrectionReceipt, verifyCorrectionReview } from './correctionModel.mjs';

const match = { request_id: 'm1', bank_transaction_id: 's1', payment_id: 'p1', amount_minor: '1250', journal_id: 'j1', active: true };

test('only active receipts by writers can be corrected', () => {
  assert.equal(canCorrect(match, true), true);
  assert.equal(canCorrect(match, false), false);
  assert.equal(canCorrect({ ...match, active: false }, true), false);
  assert.equal(canCorrect({ ...match, active: undefined }, true), false);
});

test('history keeps corrected originals', () => {
  const h = matchHistory([match, { ...match, request_id: 'm0', active: false, correction_request_id: 'c0' }, { ...match, bank_transaction_id: 'x' }], 's1');
  assert.deepEqual(h.active.map(m => m.request_id), ['m1']);
  assert.deepEqual(h.corrected.map(m => m.request_id), ['m0']);
});

test('body requires reason <=1000 and sends no amount or date', () => {
  assert.match(buildCorrectionBody({ requestId: 'r', match, reason: '  ' }).error, /reason/);
  assert.match(buildCorrectionBody({ requestId: 'r', match, reason: 'x'.repeat(1001) }).error, /1,000/);
  assert.match(buildCorrectionBody({ requestId: 'r', match: { ...match, active: false }, reason: 'x' }).error, /active/);
  assert.deepEqual(buildCorrectionBody({ requestId: 'r', match, reason: ' wrong payment ' }).body, { request_id: 'r', match_request_id: 'm1', reason: 'wrong payment' });
});

test('review must echo the exact receipt', () => {
  const body = { request_id: 'r', match_request_id: 'm1', reason: 'x' };
  const ok = { review_token: 't', match: { request_id: 'm1', amount_minor: '1250', journal_id: 'j1', bank_transaction_id: 's1', payment_id: 'p1' }, statement_remaining_minor: '1250', payment_remaining_minor: '1250' };
  assert.equal(verifyCorrectionReview(ok, body, match), ok);
  assert.throws(() => verifyCorrectionReview({ ...ok, match: { ...ok.match, amount_minor: '1000' } }, body, match));
  assert.throws(() => verifyCorrectionReview({ ...ok, match: { ...ok.match, request_id: 'm2' } }, body, match));
  assert.throws(() => verifyCorrectionReview({ ...ok, statement_remaining_minor: 12.5 }, body, match));
  assert.throws(() => verifyCorrectionReview({ ...ok, review_token: '' }, body, match));
});

test('receipt verification: unknown, recorded, mismatches', () => {
  const body = { request_id: 'r', match_request_id: 'm1', reason: 'x', review_token: 't' };
  assert.deepEqual(verifyCorrectionReceipt({ status: 'unknown', request_id: 'r' }, body), { status: 'unknown' });
  const rec = { status: 'recorded', request_id: 'r', match_request_id: 'm1', bank_transaction_id: 's1', payment_id: 'p1', released_minor: '1250', journal_id: 'j1', reason: 'x', effective_at: '2026-11-05T10:00:00Z', actor_id: 'u' };
  assert.equal(verifyCorrectionReceipt(rec, body, '1250').status, 'recorded');
  assert.throws(() => verifyCorrectionReceipt({ ...rec, released_minor: '1000' }, body, '1250'));
  assert.throws(() => verifyCorrectionReceipt({ ...rec, request_id: 'other' }, body));
  assert.throws(() => verifyCorrectionReceipt({ ...rec, effective_at: 'nope' }, body));
  assert.throws(() => verifyCorrectionReceipt({ status: 'unknown', request_id: 'other' }, body));
});

test('payment options respect direction; refunds only when flagged', () => {
  const st = { native: true, status: 'unmatched', direction: 'in', bank_account_id: 'b' };
  const pay = (id, extra) => ({ id, bank_ledger_account_id: 'L', remaining_minor: '100', ...extra });
  const base = { bank_ledger_account_id: 'L', banks: [], payments: [pay('c', { party_type: 'customer' }), pay('s', { party_type: 'supplier' })] };
  assert.deepEqual(directionalPayments(base, st).map(p => p.id), ['c']);
  const withRefunds = { ...base, payments: [...base.payments, pay('r', { party_type: 'supplier', kind: 'refund', direction: 'in' }), pay('o', { party_type: 'customer', kind: 'refund', direction: 'out' })] };
  assert.deepEqual(directionalPayments(withRefunds, st).map(p => p.id), ['c']);
  assert.deepEqual(directionalPayments({ ...withRefunds, supports_refund_matching: true }, st).map(p => p.id).sort(), ['c', 'r']);
});
