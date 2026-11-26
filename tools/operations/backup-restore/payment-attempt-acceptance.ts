// Loaded only after runtime-acceptance has checked its fixed disposable target.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { previewPayment, postPayment, recoverPayment, discoverPayments, terminatePaymentAttempt }
  from '../../../artifacts/api-server/src/services/accountingDocuments/payments';

const states = ['pending', 'no_effect', 'recorded'];
const binding = (receipt: any) => ({ request_hash: receipt.request_hash, review_hash: receipt.review_hash });
const json = (value: any) => JSON.parse(JSON.stringify(value));
const denied = (error: any) => error.status === 404 && error.code === 'RESOURCE_NOT_FOUND';
const noEffect = { events: 0, journals: 0, effects: 0, transactions: 0, witnesses: 0 };

async function effects(q: any, company: string, id: string) {
  return (await q.query(`SELECT
    (SELECT count(*)::int FROM accounting_payment_events WHERE company_id=$1 AND id=$2) events,
    (SELECT count(*)::int FROM canonical_journal_entries WHERE company_id=$1 AND source_type='accounting_payment_event' AND source_id=$2::text) journals,
    (SELECT count(*)::int FROM accounting_posting_effects WHERE company_id=$1 AND source_type='accounting_payment_event' AND source_id=$2::text) effects,
    (SELECT count(*)::int FROM conditional_discount_payment_transactions WHERE company_id=$1 AND event_id=$2) transactions,
    (SELECT count(*)::int FROM conditional_discount_commit_witnesses WHERE company_id=$1 AND event_id=$2) witnesses`, [company, id])).rows[0];
}

async function snapshot(q: any, fixture: any) {
  const ids = fixture.attempts.map((attempt: any) => attempt.body.id);
  const admissions = (await q.query('SELECT * FROM payment_attempt_admissions WHERE company_id=$1 AND request_id=ANY($2::uuid[]) ORDER BY request_id', [fixture.company, ids])).rows;
  const terminals = (await q.query('SELECT * FROM payment_attempt_no_effect WHERE company_id=$1 AND request_id=ANY($2::uuid[]) ORDER BY request_id', [fixture.company, ids])).rows;
  const outcomes = [];
  for (const id of ids) outcomes.push({ id, counts: await effects(q, fixture.company, id) });
  return json({ admissions, terminals, outcomes });
}

async function reviewed(company: string, actor: string, template: any, reference: string) {
  const body = { ...template, id: randomUUID(), reference, amount_minor: '100', allocations: [] };
  const review = await previewPayment(company, actor, body);
  return { ...body, review_token: review.review_token };
}

async function interrupted(company: string, actor: string, body: any) {
  const interruption = new Error('Synthetic restore interruption after durable admission');
  await assert.rejects(() => postPayment(company, actor, body, undefined, undefined, async () => { throw interruption; }), error => error === interruption);
  const receipt = await recoverPayment(company, actor, body.id);
  assert.equal(receipt.status, 'pending');
  return receipt;
}

export async function preparePaymentAttempts(q: any, input: any) {
  const { company, actor, template, foreignCompany, foreignActor } = input;
  assert.equal(actor, 'synthetic-witness-owner');
  assert.notEqual(company, foreignCompany);
  const recordedBody = await reviewed(company, actor, template, 'Synthetic restored recorded payment attempt');
  const posted = await postPayment(company, actor, recordedBody);
  assert.equal(posted.status, 'posted');
  const terminalBody = await reviewed(company, actor, template, 'Synthetic restored closed payment attempt');
  const terminalAdmission = await interrupted(company, actor, terminalBody);
  assert.deepEqual(await terminatePaymentAttempt(company, actor, terminalBody.id, binding(terminalAdmission)), { status: 'no_effect', id: terminalBody.id });
  // The unresolved admission is last: it must fence all later replacement writes.
  const pendingBody = await reviewed(company, actor, template, 'Synthetic restored pending payment attempt');
  await interrupted(company, actor, pendingBody);
  const attempts = [];
  for (const [status, body] of [['pending', pendingBody], ['no_effect', terminalBody], ['recorded', recordedBody]] as const) {
    const receipt = await recoverPayment(company, actor, body.id);
    assert.equal(receipt.status, status);
    attempts.push({ status, body, receipt });
  }
  const fixture: any = { company, actor, foreignCompany, foreignActor, deniedActor: `synthetic-restore-nonmember-${randomUUID()}`, unknownId: randomUUID(), attempts };
  fixture.discovery = await discoverPayments(company, actor);
  assert.ok(fixture.discovery.pending.some((row: any) => row.id === pendingBody.id));
  assert.ok(!fixture.discovery.pending.some((row: any) => row.id === terminalBody.id || row.id === recordedBody.id));
  fixture.snapshot = await snapshot(q, fixture);
  assert.equal(fixture.snapshot.admissions.length, 3);
  assert.equal(fixture.snapshot.terminals.length, 1);
  for (const attempt of attempts) assert.deepEqual(await effects(q, company, attempt.body.id), attempt.status === 'recorded'
    ? { events: 1, journals: 1, effects: 1, transactions: 1, witnesses: 1 } : noEffect);
  return fixture;
}

export async function verifyPaymentAttempts(q: any, fixture: any) {
  // Reject incomplete handoff before any restore-side command can execute.
  assert.ok(fixture && fixture.actor === 'synthetic-witness-owner');
  assert.deepEqual(fixture.attempts?.map((attempt: any) => attempt.status), states);
  assert.equal(new Set(fixture.attempts.map((attempt: any) => attempt.body?.id)).size, 3);
  assert.equal(fixture.snapshot?.admissions?.length, 3);
  assert.equal(fixture.snapshot?.terminals?.length, 1);
  for (const attempt of fixture.attempts) {
    assert.equal(attempt.receipt?.id, attempt.body?.id);
    assert.equal(attempt.receipt?.status, attempt.status);
    assert.match(attempt.body.review_token, /^sha256:[a-f0-9]{64}$/);
  }
  const { company, actor } = fixture;
  const beforeReads = await snapshot(q, fixture);
  assert.deepEqual(beforeReads, fixture.snapshot, 'Durable attempt bindings or financial outcomes changed across restore');
  for (const attempt of fixture.attempts)
    assert.deepEqual(await recoverPayment(company, actor, attempt.body.id), attempt.receipt);
  assert.deepEqual(json(await discoverPayments(company, actor)), fixture.discovery, 'Actor-owned discovery changed across restore');
  assert.deepEqual(await recoverPayment(company, actor, fixture.unknownId), { status: 'unknown', id: fixture.unknownId });
  assert.equal((await q.query('SELECT 1 FROM company_users WHERE company_id=$1 AND user_id=$2', [company, fixture.deniedActor])).rowCount, 0);
  for (const attempt of fixture.attempts.filter((item: any) => item.status !== 'recorded')) {
    await assert.rejects(() => recoverPayment(company, fixture.deniedActor, attempt.body.id), denied);
    assert.deepEqual(await recoverPayment(fixture.foreignCompany, fixture.foreignActor, attempt.body.id), { status: 'unknown', id: attempt.body.id });
  }
  await assert.rejects(() => discoverPayments(company, fixture.deniedActor), denied);
  assert.deepEqual(await snapshot(q, fixture), beforeReads, 'Recovery/discovery must not change durable attempts or financial effects');

  for (const table of ['payment_attempt_admissions', 'payment_attempt_no_effect']) {
    for (const sql of [`UPDATE ${table} SET actor_id=actor_id WHERE false`, `DELETE FROM ${table} WHERE false`, `TRUNCATE ${table}`])
      await assert.rejects(() => q.query(sql), (error: any) => error.code === '42501');
  }
  const guards = (await q.query(`SELECT tgname,tgenabled FROM pg_trigger WHERE tgname IN
    ('payment_attempt_admission_immutable','payment_attempt_admission_no_truncate','payment_attempt_terminal_immutable','payment_attempt_terminal_no_truncate') ORDER BY tgname`)).rows;
  assert.deepEqual(guards, ['payment_attempt_admission_immutable', 'payment_attempt_admission_no_truncate', 'payment_attempt_terminal_immutable', 'payment_attempt_terminal_no_truncate'].map(tgname => ({ tgname, tgenabled: 'A' })));

  const [pending, terminal, recorded] = fixture.attempts;
  await assert.rejects(() => terminatePaymentAttempt(company, fixture.deniedActor, pending.body.id, binding(pending.receipt)), denied);
  await assert.rejects(() => terminatePaymentAttempt(fixture.foreignCompany, fixture.foreignActor, pending.body.id, binding(pending.receipt)), denied);
  await assert.rejects(() => terminatePaymentAttempt(company, actor, pending.body.id, { ...binding(pending.receipt), request_hash: 'sha256:' + '0'.repeat(64) }), (error: any) => error.code === 'IDEMPOTENCY_CONFLICT');
  assert.deepEqual(await snapshot(q, fixture), beforeReads, 'Denied closure must not mutate restored evidence');
  const fresh = await recoverPayment(company, actor, pending.body.id);
  assert.equal(fresh.status, 'pending');
  assert.deepEqual(await terminatePaymentAttempt(company, actor, pending.body.id, binding(fresh)), { status: 'no_effect', id: pending.body.id });
  assert.deepEqual(await recoverPayment(company, actor, pending.body.id), { ...pending.receipt, status: 'no_effect' });
  for (const attempt of [pending, terminal]) {
    const beforeRetry = await snapshot(q, fixture);
    assert.deepEqual(await terminatePaymentAttempt(company, actor, attempt.body.id, binding(attempt.receipt)), { status: 'no_effect', id: attempt.body.id });
    // Exact saved reviewed body: a conflict from a different body would not prove the terminal fence.
    await assert.rejects(() => postPayment(company, actor, attempt.body), (error: any) => error.code === 'PAYMENT_ATTEMPT_TERMINATED');
    assert.deepEqual(await effects(q, company, attempt.body.id), noEffect);
    assert.deepEqual(await snapshot(q, fixture), beforeRetry, 'Closed request replay or repeated closure changed restored history');
  }
  const beforeReplay = await snapshot(q, fixture);
  const replay = await postPayment(company, actor, recorded.body);
  assert.equal(replay.status, 'duplicate');
  assert.equal(replay.journal_id, recorded.receipt.journal_id);
  assert.deepEqual(await snapshot(q, fixture), beforeReplay, 'Recorded replay added another financial effect');
  assert.deepEqual(await recoverPayment(company, actor, recorded.body.id), recorded.receipt);
  assert.ok(!(await discoverPayments(company, actor)).pending.some((row: any) => [pending.body.id, terminal.body.id].includes(row.id)));
  return { states, persistedRequestBindings: true, restoredPendingClosed: true, terminalRequestsFenced: true,
    recordedReplaySingleEffect: true, readOnlyDiscoveryPreserved: true, unknownAndCrossCompanyIsolated: true, immutableRuntimeHistory: true };
}
