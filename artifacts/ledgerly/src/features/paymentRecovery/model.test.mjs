import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountingClient } from '../../api/accountingDocuments.mjs';
import { bindPaymentReview, paymentPostBody } from '../../lib/paymentRequestScope.mjs';
import { createPaymentRecovery, canConfigurePayments, canPostPayments, recoveryBusy, recoveryUnresolved } from './model.mjs';

const owner = { configure_payments: true, review_payments: true, post_payments: true };
const admin = { configure_payments: true, review_payments: true, post_payments: false };
const viewer = { configure_payments: false, review_payments: false, post_payments: false };
const input = (kind = 'payment') => ({ id: 'synthetic-event', kind, party_type: 'supplier', party_id: 'synthetic-party',
  payment_id: kind === 'payment' ? null : 'original-payment', date: '2026-10-30', reference: 'Synthetic payment',
  amount_minor: '9007199254740993', allocations: ['refund', 'reversal'].includes(kind) ? [] : [{ document_id: 'synthetic-bill', amount_minor: '12345' }] });
const review = (kind = 'payment', company = 'company-a') => bindPaymentReview(company, input(kind), { review_token: 'reviewed-token' });
const event = (kind = 'payment') => ({ ...input(kind), effective_date: '2026-10-30', journal_id: `journal-${kind}` });
const outcome = (kind = 'payment') => ({status:'recorded',id:'synthetic-event',journal_id:`journal-${kind}`});
const unknown = () => ({status:'unknown',id:'synthetic-event'});
const json = data => ({ ok: true, status: 200, json: async () => ({ data }) });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('a lost response after a committed request resolves through a read without reposting', async () => {
  const calls = [], stored = [];
  const api = createAccountingClient(async (url, options) => {
    calls.push({ url, method: options.method });
    if (options.method === 'POST') {
      stored.push({ id: 'synthetic-event', events: [event()] });
      throw new TypeError('Connection lost after recording');
    }
    return json(outcome());
  });
  const recovery = createPaymentRecovery('company-a', api);
  await recovery.record(review(), owner);
  assert.equal(recovery.getSnapshot().phase, 'unknown');
  assert.equal(recoveryUnresolved(recovery.getSnapshot()), true);
  await recovery.check();
  assert.equal(recovery.getSnapshot().phase, 'recorded');
  assert.deepEqual(recovery.getSnapshot().result, { status: 'recorded', id: 'synthetic-event', journal_id: 'journal-payment' });
  assert.deepEqual(calls, [
    { url: '/api/companies/company-a/accounting-payments', method: 'POST' },
    { url: '/api/companies/company-a/accounting-payments/operations/synthetic-event', method: 'GET' },
  ]);
  assert.equal(await recovery.retry(owner), false);
  assert.equal(stored.length, 1);
});

test('not found remains unknown and retry sends identical ID, body, precision and review token', async () => {
  const sent = [], recordedIds = new Set();
  const api = createAccountingClient(async (_url, options) => {
    if (options.method === 'GET') return json(unknown());
    sent.push(options.body);
    const body = JSON.parse(options.body), duplicate = recordedIds.has(body.id);
    recordedIds.add(body.id);
    if (sent.length === 1) throw new Error('Lost response');
    return json({ status: duplicate ? 'duplicate' : 'posted', id: body.id, journal_id: 'original-journal' });
  });
  const recovery = createPaymentRecovery('company-a', api), bound = review();
  await recovery.record(bound, owner);
  assert.equal(await recovery.record(bindPaymentReview('company-a', { ...input(), id: 'new-id' }, { review_token: 'new-token' }), owner), false);
  await recovery.check();
  assert.equal(recovery.getSnapshot().phase, 'unknown');
  assert.equal(recovery.getSnapshot().check, 'not_found');
  assert.throws(() => { recovery.getSnapshot().body.allocations[0].amount_minor = '1'; }, TypeError);
  await recovery.retry(owner);
  assert.equal(recovery.getSnapshot().result.status, 'duplicate');
  assert.equal(recordedIds.size, 1);
  assert.equal(sent.length, 2);
  assert.equal(sent[0], sent[1]);
  assert.deepEqual(JSON.parse(sent[1]), paymentPostBody('company-a', bound));
  assert.equal(JSON.parse(sent[1]).amount_minor, '9007199254740993');
});

test('a stale, denied or failed retry never erases an earlier uncertain outcome', async () => {
  for (const [status, code] of [[409, 'PAYMENT_REVIEW_STALE'], [403, 'CAPABILITY_DENIED'], [500, 'ACCOUNTING_OPERATION_FAILED']]) {
    let posts = 0;
    const recovery = createPaymentRecovery('company-a', {
      postPayment: async () => { if (++posts === 1) throw new TypeError('Lost response'); throw Object.assign(new Error('Latest request rejected'), { status, code }); },
      recoverPayment: async () => unknown(),
    });
    await recovery.record(review(), owner);
    const retained = recovery.getSnapshot().body;
    await recovery.retry(owner);
    assert.equal(recovery.getSnapshot().phase, 'unknown');
    assert.equal(recovery.getSnapshot().body, retained);
    assert.equal(recovery.getSnapshot().error.code, code);
    recovery.clearRecorded();
    assert.equal(recoveryUnresolved(recovery.getSnapshot()), true);
  }
});

test('empty, malformed or mismatched recording responses never claim a successful payment', async () => {
  for (const response of [undefined, {}, { status: 'posted', id: 'other-event', journal_id: 'journal' }, { status: 'posted', id: 'synthetic-event' }]) {
    const recovery = createPaymentRecovery('company-a', { postPayment: async () => response });
    await recovery.record(review(), owner);
    assert.equal(recovery.getSnapshot().phase, 'unknown');
    assert.equal(recovery.getSnapshot().body.id, 'synthetic-event');
  }
});

test('status lookup resolves payment, allocation, unallocation, refund and reversal by event ID', async () => {
  for (const kind of ['payment', 'allocation', 'unallocation', 'refund', 'reversal']) {
    const recovery = createPaymentRecovery('company-a', {
      postPayment: async () => { throw new Error('Unknown'); }, recoverPayment: async () => outcome(kind),
    });
    await recovery.record(review(kind), owner);
    await recovery.check();
    assert.equal(recovery.getSnapshot().result.journal_id, `journal-${kind}`);
  }
});

test('failed and malformed history reads retain the recovery request and do not write', async () => {
  for (const read of [async () => { throw new Error('Read unavailable'); }, async () => undefined, async () => [{ events: [{ id: 'synthetic-event' }] }]]) {
    let posts = 0;
    const recovery = createPaymentRecovery('company-a', {
      postPayment: async () => { posts++; throw new Error('Unknown'); }, recoverPayment: read,
    });
    await recovery.record(review(), owner);
    const retained = recovery.getSnapshot().body;
    await recovery.check();
    assert.equal(recovery.getSnapshot().phase, 'unknown');
    assert.equal(recovery.getSnapshot().body, retained);
    assert.ok(recovery.getSnapshot().error);
    assert.equal(posts, 1);
  }
});

test('double clicks cannot overlap recording, checking or retry requests', async () => {
  const post = deferred(), check = deferred();
  let posts = 0, reads = 0;
  const recovery = createPaymentRecovery('company-a', {
    postPayment: () => { posts++; return post.promise; }, recoverPayment: () => { reads++; return check.promise; },
  });
  const recording = recovery.record(review(), owner);
  assert.equal(recoveryBusy(recovery.getSnapshot()), true);
  assert.equal(await recovery.record(review(), owner), false);
  assert.equal(await recovery.retry(owner), false);
  assert.equal(await recovery.check(), false);
  assert.equal(recovery.abandon(), false);
  post.reject(new Error('Unknown')); await recording;
  const checking = recovery.check();
  assert.equal(recoveryBusy(recovery.getSnapshot()), true);
  assert.equal(await recovery.check(), false);
  assert.equal(await recovery.retry(owner), false);
  check.resolve(unknown()); await checking;
  assert.equal(posts, 1); assert.equal(reads, 1);
});

test('company switch clears recovery and ignores late recording and history responses', async () => {
  for (const operation of ['post', 'check']) {
    const late = deferred(), notifications = [];
    const a = createPaymentRecovery('company-a', {
      postPayment: operation === 'post' ? () => late.promise : async () => { throw new Error('Unknown'); },
      recoverPayment: () => late.promise,
    });
    a.subscribe(() => notifications.push(a.getSnapshot()?.phase ?? null));
    let pending = a.record(review(), owner);
    if (operation === 'check') { await pending; pending = a.check(); }
    a.reset();
    const b = createPaymentRecovery('company-b', {});
    const count = notifications.length;
    late.resolve(operation === 'post' ? { status: 'posted', id: 'synthetic-event', journal_id: 'old-journal' } : outcome());
    await pending;
    assert.equal(a.getSnapshot(), null); assert.equal(b.getSnapshot(), null);
    assert.equal(notifications.length, count);
    assert.equal(await a.retry(owner), false);
    await assert.rejects(() => b.record(review(), owner), /selected company/);
  }
});

test('permissions fail closed for writes while status reads remain available after role changes', async () => {
  let writes = 0, reads = 0;
  const recovery = createPaymentRecovery('company-a', {
    postPayment: async () => { writes++; throw new Error('Unknown'); },
    recoverPayment: async () => { reads++; return outcome(); },
  });
  for (const capabilities of [undefined, {}, viewer, admin, { post_payments: 'true' }]) {
    assert.equal(await recovery.record(review(), capabilities), false);
    assert.equal(canPostPayments(capabilities), false);
  }
  assert.equal(canConfigurePayments(admin), true);
  assert.equal(canConfigurePayments(viewer), false);
  assert.equal(canConfigurePayments({ configure_payments: 'true' }), false);
  await recovery.record(review(), owner);
  assert.equal(await recovery.retry(viewer), false);
  assert.equal(await recovery.retry(admin), false);
  await recovery.check();
  assert.equal(recovery.getSnapshot().phase, 'recorded');
  assert.equal(writes, 1); assert.equal(reads, 1);
});

test('explicit abandon clears only this view and never issues a cancellation or another write', async () => {
  let writes = 0;
  const recovery = createPaymentRecovery('company-a', { postPayment: async () => { writes++; throw new Error('Unknown'); } });
  await recovery.record(review(), owner);
  assert.equal(recovery.abandon(), true);
  assert.equal(recovery.getSnapshot(), null);
  assert.equal(await recovery.retry(owner), false);
  assert.equal(writes, 1);
});
