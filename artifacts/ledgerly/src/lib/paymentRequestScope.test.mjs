import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentRequestScope, runPaymentRequest, bindPaymentReview, paymentPostBody, paymentForEvent } from './paymentRequestScope.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const callbacks = log => ({
  success: value => log.push(['success', value]),
  failure: error => log.push(['error', error.message]),
  finished: () => log.push(['finished']),
});

test('switching company or leaving the payment page discards late success and finally updates', async () => {
  const a = createPaymentRequestScope('company-a'), b = createPaymentRequestScope('company-b');
  const old = deferred(), log = [];
  const pending = runPaymentRequest(a, company => { assert.equal(company, 'company-a'); return old.promise; }, callbacks(log));
  a.invalidate();
  await runPaymentRequest(b, async company => { assert.equal(company, 'company-b'); return 'new review'; }, callbacks(log));
  old.resolve('old review'); await pending;
  assert.deepEqual(log, [['success', 'new review'], ['finished']]);
});

test('late old failure cannot replace a new form error or release its pending state', async () => {
  const scope = createPaymentRequestScope('company-a'), old = deferred(), current = deferred(), log = [];
  const p1 = runPaymentRequest(scope, () => old.promise, callbacks(log));
  const p2 = runPaymentRequest(scope, () => current.promise, callbacks(log));
  old.reject(new Error('old failure')); await p1;
  assert.deepEqual(log, []);
  current.reject(new Error('current failure')); await p2;
  assert.deepEqual(log, [['error', 'current failure'], ['finished']]);
});

test('post-refresh completion checks the same request lifetime after its second await', async () => {
  const scope = createPaymentRequestScope('company-a'), refresh = deferred(), log = [];
  const request = runPaymentRequest(scope, async () => 'posted', {
    ...callbacks(log),
    success: async (result, ticket) => { await refresh.promise; if (ticket.isCurrent()) log.push(['result', result]); },
  });
  await Promise.resolve();
  scope.invalidate(); refresh.resolve(); await request;
  assert.deepEqual(log, []);
});

test('review captures the exact company, decimal strings, allocations and retry identity', () => {
  const input = { id: 'request-1', amount_minor: '9007199254740993', reference: 'Original', allocations: [{ document_id: 'bill-1', amount_minor: '12000' }] };
  const plan = { review_token: 'server-review-token', lines: [{ debitMinor: '9007199254740993' }] };
  const review = bindPaymentReview('company-a', input, plan);
  input.reference = 'Edited'; input.allocations[0].amount_minor = '50'; plan.lines[0].debitMinor = '1';
  const first = paymentPostBody('company-a', review), retry = paymentPostBody('company-a', review);
  assert.deepEqual(first, retry);
  assert.equal(first.id, 'request-1'); assert.equal(first.amount_minor, '9007199254740993');
  assert.equal(first.reference, 'Original'); assert.equal(first.allocations[0].amount_minor, '12000');
  assert.equal(review.lines[0].debitMinor, '9007199254740993');
  first.allocations[0].amount_minor = '2';
  assert.equal(paymentPostBody('company-a', review).allocations[0].amount_minor, '12000');
  assert.throws(() => paymentPostBody('company-b', review), /selected company/);
  assert.throws(() => paymentPostBody('company-a', null), /selected company/);
});

test('event deep links choose the requested payment, including allocation and refund events', () => {
  const rows = [{ id: 'p1', events: [{ id: 'paid-1' }, { id: 'allocation-1' }] }, { id: 'p2', events: [{ id: 'refund-2' }] }];
  assert.equal(paymentForEvent(rows, 'allocation-1').id, 'p1');
  assert.equal(paymentForEvent(rows, 'refund-2').id, 'p2');
  assert.equal(paymentForEvent(rows, 'another-company-event'), null);
  assert.equal(paymentForEvent(rows, ''), null);
  assert.equal(paymentForEvent(null, 'paid-1'), null);
});
