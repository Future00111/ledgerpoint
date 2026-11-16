import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountingClient } from '../../api/accountingDocuments.mjs';
import { bindPaymentReview, paymentPostBody } from '../../lib/paymentRequestScope.mjs';
import { createPaymentRecovery, canConfigurePayments, canPostPayments, recoveryBusy, recoveryUnresolved } from './model.mjs';

const owner = { configure_payments: true, review_payments: true, post_payments: true };
const admin = { configure_payments: true, review_payments: true, post_payments: false };
const viewer = { configure_payments: false, review_payments: false, post_payments: false };
const requestId = '11111111-1111-4111-8111-111111111111';
const journalId = '22222222-2222-5222-8222-222222222222';
const otherId = '33333333-3333-4333-8333-333333333333';
const input = (kind = 'payment') => ({ id: requestId, kind, party_type: 'supplier', party_id: 'synthetic-party',
  payment_id: kind === 'payment' ? null : 'original-payment', date: '2026-10-30', reference: 'Synthetic payment',
  amount_minor: '9007199254740993', allocations: ['refund', 'reversal'].includes(kind) ? [] : [{ document_id: 'synthetic-bill', amount_minor: '12345' }] });
const review = (kind = 'payment', company = 'company-a') => bindPaymentReview(company, input(kind), { review_token: 'reviewed-token' });
const event = (kind = 'payment') => ({ ...input(kind), effective_date: '2026-10-30', journal_id: journalId });
const outcome = () => ({status:'recorded',id:requestId,journal_id:journalId});
const unknown = () => ({status:'unknown',id:requestId});
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
      stored.push({ id: requestId, events: [event()] });
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
  assert.deepEqual(recovery.getSnapshot().result, outcome());
  assert.deepEqual(calls, [
    { url: '/api/companies/company-a/accounting-payments', method: 'POST' },
    { url: `/api/companies/company-a/accounting-payments/operations/${requestId}`, method: 'GET' },
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
    return json({ status: duplicate ? 'duplicate' : 'posted', id: body.id, journal_id: journalId });
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
  for (const response of [undefined, {}, { status: 'posted', id: otherId, journal_id: journalId }, { status: 'posted', id: requestId }]) {
    const recovery = createPaymentRecovery('company-a', { postPayment: async () => response });
    await recovery.record(review(), owner);
    assert.equal(recovery.getSnapshot().phase, 'unknown');
    assert.equal(recovery.getSnapshot().body.id, requestId);
  }
});

test('status lookup resolves payment, allocation, unallocation, refund and reversal by event ID', async () => {
  for (const kind of ['payment', 'allocation', 'unallocation', 'refund', 'reversal']) {
    const recovery = createPaymentRecovery('company-a', {
      postPayment: async () => { throw new Error('Unknown'); }, recoverPayment: async () => outcome(kind),
    });
    await recovery.record(review(kind), owner);
    await recovery.check();
    assert.equal(recovery.getSnapshot().result.journal_id, journalId);
  }
});

test('failed and malformed history reads retain the recovery request and do not write', async () => {
  for (const read of [async () => { throw new Error('Read unavailable'); }, async () => undefined, async () => [{ events: [{ id: requestId }] }]]) {
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
    late.resolve(operation === 'post' ? { status: 'posted', id: requestId, journal_id: journalId } : outcome());
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

test('unknown outcomes cannot be abandoned or replaced with another write', async () => {
  let writes = 0;
  const recovery = createPaymentRecovery('company-a', { postPayment: async () => { writes++; throw new Error('Unknown'); } });
  await recovery.record(review(), owner);
  assert.equal(recovery.abandon(), false);
  assert.equal(recovery.getSnapshot().phase, 'unknown');
  assert.equal(await recovery.record(review(), owner), false);
  assert.equal(writes, 1);
});
test('restored locator is read-only across server restart, absence and revoked access', async () => {
  let forgotten=null, response=unknown(), writes=0;
  const recovery=createPaymentRecovery('company-a',{
    postPayment:async()=>{writes++;}, recoverPayment:async()=>{if(response instanceof Error)throw response;return response;}
  },{recoveryRequestId:requestId,forgetRequest:id=>{forgotten=id;}});
  assert.equal(await recovery.retry(owner),false);
  assert.equal(await recovery.record(review(),owner),false);
  await recovery.check();assert.equal(recovery.getSnapshot().check,'not_found');
  response=Object.assign(Error('revoked'),{status:403});await recovery.check();
  assert.equal(recovery.getSnapshot().phase,'unknown');assert.equal(forgotten,null);
  response=outcome();await recovery.check();assert.equal(recovery.getSnapshot().phase,'recorded');
  recovery.clearRecorded();assert.equal(forgotten,requestId);assert.equal(writes,0);
});
test('locator is saved before POST and storage failure sends no request', async () => {
  let writes=0, remembered=null;
  const api={postPayment:async()=>{writes++;assert.equal(remembered,requestId);throw Error('lost');}};
  const failed=createPaymentRecovery('company-a',api,{rememberRequest:()=>{throw Error('storage');}});
  await assert.rejects(()=>failed.record(review(),owner),/storage/);assert.equal(writes,0);
  const working=createPaymentRecovery('company-a',api,{rememberRequest:id=>{remembered=id;}});
  await working.record(review(),owner);working.reset();assert.equal(remembered,requestId);assert.equal(writes,1);
});
test('confirming one event restores another unresolved locator before any new write',async()=>{
 const r=createPaymentRecovery('company-a',{recoverPayment:async()=>outcome()},
  {recoveryRequestId:requestId,nextRecoveryRequest:()=> otherId});
 await r.check();assert.equal(r.getSnapshot().phase,'recorded');
 r.clearRecorded();assert.equal(r.getSnapshot().body.id,otherId);
 assert.equal(r.getSnapshot().readOnly,true);
 assert.equal(await r.record(review(),owner),false);assert.equal(await r.retry(owner),false);
});

const kinds = ['payment', 'allocation', 'unallocation', 'refund', 'reversal'];
const malformedReceipts = [
  ...['', 'not-a-journal', null, undefined, 42, {}, [], '00000000-0000-0000-0000-000000000000']
    .map(journal_id => ({ ...outcome(), journal_id })),
  ...['', 'not-a-request', null, undefined, 42, otherId]
    .map(id => ({ ...outcome(), id })),
  ...['', 'failed', 'unknown', 'POSTED', null, undefined, 42]
    .map(status => ({ ...outcome(), status })),
];

for (const kind of kinds) {
  test(`${kind}: POST and recovery accept only valid matching successful receipts`, async () => {
    for (const path of ['post', 'read']) {
      for (const status of ['posted', 'duplicate', 'recorded']) {
        const receipt = { ...outcome(), status };
        const recovery = createPaymentRecovery('company-a', {
          postPayment: async () => receipt, recoverPayment: async () => receipt,
        }, path === 'read' ? { recoveryRequestId: requestId } : {});
        if (path === 'post') await recovery.record(review(kind), owner);
        else await recovery.check();
        assert.equal(recovery.getSnapshot().phase, 'recorded');
        assert.deepEqual(recovery.getSnapshot().result, receipt);
      }
    }
  });

  test(`${kind}: malformed POST/read receipts retain locator and lock replacement until valid recovery`, async () => {
    for (const path of ['post', 'read']) {
      for (const receipt of malformedReceipts) {
        let response = receipt, writes = 0, locator = path === 'read' ? requestId : null;
        const forgotten = [];
        const recovery = createPaymentRecovery('company-a', {
          postPayment: async () => { writes++; return response; },
          recoverPayment: async () => response,
        }, {
          recoveryRequestId: locator,
          rememberRequest: id => { locator = id; },
          forgetRequest: id => { forgotten.push(id); locator = null; },
        });
        if (path === 'post') await recovery.record(review(kind), owner);
        else await recovery.check();
        assert.equal(recovery.getSnapshot().phase, 'unknown');
        assert.equal(recovery.getSnapshot().result, null);
        assert.equal(recovery.getSnapshot().body.id, requestId);
        recovery.clearRecorded();
        assert.equal(locator, requestId);
        assert.deepEqual(forgotten, []);
        assert.equal(recovery.abandon(), false);
        assert.equal(await recovery.record(review(kind), owner), false);
        if (path === 'read') assert.equal(await recovery.retry(owner), false);
        assert.equal(writes, path === 'post' ? 1 : 0);
        response = outcome();
        await recovery.check();
        assert.equal(recovery.getSnapshot().phase, 'recorded');
        recovery.clearRecorded();
        assert.deepEqual(forgotten, [requestId]);
        assert.equal(locator, null);
        assert.equal(recovery.getSnapshot(), null);
      }
    }
  });
}

test('matching malformed request IDs cannot verify a receipt on POST or restored recovery', async () => {
  for (const id of ['not-a-request', 42, '00000000-0000-0000-0000-000000000000']) {
    for (const path of ['post', 'read']) {
      let forgotten = false;
      const receipt = { ...outcome(), id };
      const recovery = createPaymentRecovery('company-a', {
        postPayment: async () => receipt, recoverPayment: async () => receipt,
      }, { recoveryRequestId: path === 'read' ? id : null, forgetRequest: () => { forgotten = true; } });
      if (path === 'post') await recovery.record(bindPaymentReview('company-a', { ...input(), id }, { review_token: 'reviewed-token' }), owner);
      else await recovery.check();
      assert.equal(recovery.getSnapshot().phase, 'unknown');
      recovery.clearRecorded();
      assert.equal(forgotten, false);
    }
  }
});


const discoveryReceipt = (id=requestId) => ({...outcome(),id,kind:'payment',party_type:'supplier',reference:'Original payment',
  amount_minor:'12000',effective_date:'2026-11-16',recorded_at:'2026-11-16T12:00:00Z'});
test('lost response and lost browser locator discover original server receipt, then fresh read, never repost',async()=>{
  let posts=0,reads=0,lists=0;
  const api={postPayment:async()=>{posts++;throw Error('Reply lost after commit');},
    discoverPayments:async()=>{lists++;return {receipts:[discoveryReceipt(),discoveryReceipt(otherId)],has_more:false};},
    recoverPayment:async(c,id)=>{reads++;return {...outcome(),id};}};
  const original=createPaymentRecovery('company-a',api);await original.record(review(),owner);
  original.reset(); // Browser reference and in-memory intent both gone.
  const restored=createPaymentRecovery('company-a',api,{discoverLostReference:true});
  assert.equal(recoveryUnresolved(restored.getSnapshot()),true);
  assert.equal(await restored.record(review(),owner),false);
  await restored.discover();
  assert.equal(restored.getSnapshot().phase,'discovery');assert.equal(reads,0);
  assert.equal(restored.getSnapshot().candidates.length,2); // Ambiguous until explicit recognition.
  assert.equal(await restored.retry(owner),false);assert.equal(await restored.abandon(),false);
  assert.equal(await restored.selectReceipt(journalId),false);
  await restored.selectReceipt(requestId);
  assert.equal(restored.getSnapshot().phase,'recorded');assert.equal(restored.getSnapshot().result.id,requestId);
  assert.equal(restored.getSnapshot().readOnly,true);assert.equal(posts,1);assert.equal(reads,1);assert.equal(lists,1);
});
test('empty, truncated, malformed or failed discovery never unlocks payment recording',async()=>{
  for(const response of [{receipts:[],has_more:false},{receipts:[discoveryReceipt()],has_more:true},
    {receipts:[discoveryReceipt(),discoveryReceipt()],has_more:false},
    {receipts:[{...discoveryReceipt(),journal_id:'invalid'}],has_more:false},new Error('revoked')]) {
    const r=createPaymentRecovery('company-a',{discoverPayments:async()=>{if(response instanceof Error)throw response;return response;}},{discoverLostReference:true});
    await r.discover();assert.equal(r.getSnapshot().phase,'discovery');
    assert.equal(await r.record(review(),owner),false);assert.equal(await r.retry(owner),false);r.clearRecorded();
    assert.equal(recoveryUnresolved(r.getSnapshot()),true);
  }
});
test('selected discovery must recheck authorization and exact outcome; unknown or foreign receipt stays locked',async()=>{
  for(const response of [unknown(),{...outcome(),id:otherId},{...outcome(),journal_id:otherId},new Error('membership revoked')]) {
    const r=createPaymentRecovery('company-a',{discoverPayments:async()=>({receipts:[discoveryReceipt()],has_more:false}),
      recoverPayment:async()=>{if(response instanceof Error)throw response;return response;}},{discoverLostReference:true});
    await r.discover();await r.selectReceipt(requestId);
    assert.equal(r.getSnapshot().phase,'discovery');assert.ok(r.getSnapshot().error);
    assert.equal(await r.record(review(),owner),false);
  }
});
test('company exit invalidates delayed discovery and delayed selected receipt',async()=>{
  for(const phase of ['list','selection']) {
    const late=deferred();
    const r=createPaymentRecovery('company-a',{discoverPayments:()=>phase==='list'?late.promise:Promise.resolve({receipts:[discoveryReceipt()],has_more:false}),
      recoverPayment:()=>late.promise},{discoverLostReference:true});
    const pending=phase==='list'?r.discover():(await r.discover(),r.selectReceipt(requestId));
    r.reset();late.resolve(phase==='list'?{receipts:[discoveryReceipt()],has_more:false}:outcome());await pending;
    assert.equal(r.getSnapshot(),null);
  }
});

test('pending admission is shown ahead of history and explicit selection stays read-only until same ID commits',async()=>{
 let posts=0,committed=false,saved=[];
 const pending={...discoveryReceipt(),status:'pending'};delete pending.journal_id;
 const r=createPaymentRecovery('company-a',{discoverPayments:async()=>({pending:[pending],receipts:[discoveryReceipt(otherId)],has_more:true}),
  recoverPayment:async()=>committed?outcome():{status:'pending',id:requestId},postPayment:async()=>{posts++;}},
  {discoverLostReference:true,rememberRequest:id=>saved.push(id)});
 await r.discover();assert.equal(r.getSnapshot().candidates[0].status,'pending');
 await r.selectReceipt(requestId);assert.equal(r.getSnapshot().phase,'unknown');assert.equal(r.getSnapshot().readOnly,true);
 assert.deepEqual(saved,[requestId]);await r.retry({post_payments:true});assert.equal(posts,0);
 committed=true;await r.check();assert.equal(r.getSnapshot().phase,'recorded');assert.equal(posts,0);
});
test('terminal status disables retained in-memory retry without unlocking a replacement',async()=>{
 let posts=0;const r=createPaymentRecovery('company-a',{postPayment:async()=>{posts++;throw new Error('Lost response');},recoverPayment:async()=>({status:'no_effect',id:requestId})});
 await r.record(review(),owner);assert.notEqual(r.getSnapshot().readOnly,true);
 await r.check();assert.equal(r.getSnapshot().readOnly,true);assert.equal(await r.retry({post_payments:true}),false);
 assert.equal(r.abandon(),false);assert.equal(recoveryUnresolved(r.getSnapshot()),true);assert.equal(posts,1);
});

const admission = (status = 'pending', extra = {}) => ({ status, id: requestId,
  request_hash: 'sha256:' + 'a'.repeat(64), review_hash: 'sha256:' + 'b'.repeat(64),
  kind: 'payment', party_type: 'supplier', reference: 'Synthetic attempt', amount_minor: '12345', ...extra });
async function terminalHarness(options = {}) {
  let status = 'pending'; const calls = [], forgotten = [];
  const recovery = createPaymentRecovery('company-a', {
    recoverPayment: async (company,id) => { calls.push(['read',company,id]); return admission(status); },
    terminatePaymentAttempt: async (company,id,body) => { calls.push(['terminal',company,id,body]); status = 'no_effect'; return {status,id}; },
    postPayment: async () => { calls.push(['post']); throw new Error('Lost response'); },
    ...options.api,
  }, {recoveryRequestId: requestId, forgetRequest: id => forgotten.push(id), ...options.storage});
  await recovery.check(); return {recovery,calls,forgotten};
}
test('selected terminal confirmation binds exact admission, verifies fresh status, and explicitly clears only that locator', async () => {
  const {recovery,calls,forgotten} = await terminalHarness();
  assert.equal(recovery.abandon(), false);
  await recovery.getSnapshot().selectTerminal(owner);
  assert.equal(recovery.getSnapshot().confirming, true);
  recovery.getSnapshot().cancelTerminal();
  assert.equal(await recovery.getSnapshot().confirmTerminal(owner), false);
  assert.equal(calls.filter(c=>c[0]==='terminal').length,0);
  await recovery.getSnapshot().selectTerminal(owner);
  assert.equal(await recovery.getSnapshot().confirmTerminal(viewer),false);
  await recovery.getSnapshot().confirmTerminal(owner);
  assert.equal(recovery.getSnapshot().check,'no_effect');assert.deepEqual(forgotten,[]);
  assert.equal(recovery.abandon(),false);
  assert.equal(calls.at(-1)[0],'read');
  assert.deepEqual(calls.find(c=>c[0]==='terminal'),['terminal','company-a',requestId,{request_hash:admission().request_hash,review_hash:admission().review_hash}]);
  let closedForm=false;
  await recovery.getSnapshot().continueFresh(owner,()=>{closedForm=recovery.getSnapshot()===null;});
  assert.equal(closedForm,true);assert.equal(recovery.getSnapshot(),null);assert.deepEqual(forgotten,[requestId]);
  await assert.rejects(()=>recovery.record(review(),owner),/Close this form/);
  assert.equal(calls.filter(c=>c[0]==='post').length,0);
});
test('terminal continue restores the next locator and rejects missing/mismatched or unauthorized fresh status',async()=>{
  for(const response of [unknown(),admission('no_effect',{id:otherId}),admission('no_effect',{review_hash:'sha256:'+'c'.repeat(64)}),admission('pending')]) {
    let result=admission('no_effect');
    const {recovery,forgotten}=await terminalHarness({api:{recoverPayment:async()=>result}});
    result=response;await recovery.getSnapshot().continueFresh(owner);
    assert.deepEqual(forgotten,[]);assert.equal(recoveryUnresolved(recovery.getSnapshot()),true);
  }
  const {recovery,forgotten}=await terminalHarness({api:{recoverPayment:async()=>admission('no_effect')},storage:{nextRecoveryRequest:()=>otherId}});
  assert.equal(await recovery.getSnapshot().continueFresh(viewer),false);
  let navigated=false;await recovery.getSnapshot().continueFresh(owner,()=>{navigated=true;});
  assert.equal(navigated,false);assert.deepEqual(forgotten,[requestId]);assert.equal(recovery.getSnapshot().body.id,otherId);assert.equal(recovery.getSnapshot().readOnly,true);
});
test('permission denial, recorded precedence and company exit never unlock or repost a terminal attempt',async()=>{
  const denied=await terminalHarness({api:{terminatePaymentAttempt:async()=>{throw Object.assign(Error('Denied'),{code:'CAPABILITY_DENIED'});}}});
  await denied.recovery.getSnapshot().selectTerminal(owner);await denied.recovery.getSnapshot().confirmTerminal(owner);
  assert.equal(denied.recovery.getSnapshot().error.code,'CAPABILITY_DENIED');assert.deepEqual(denied.forgotten,[]);
  const done=await terminalHarness({api:{terminatePaymentAttempt:async()=>outcome()}});
  await done.recovery.getSnapshot().selectTerminal(owner);await done.recovery.getSnapshot().confirmTerminal(owner);
  assert.equal(done.recovery.getSnapshot().phase,'recorded');assert.deepEqual(done.forgotten,[]);
  const wait=deferred();const stale=await terminalHarness({api:{terminatePaymentAttempt:()=>wait.promise}});
  await stale.recovery.getSnapshot().selectTerminal(owner);const pending=stale.recovery.getSnapshot().confirmTerminal(owner);
  stale.recovery.reset();wait.resolve(admission('no_effect'));await pending;
  assert.equal(stale.recovery.getSnapshot(),null);assert.deepEqual(stale.forgotten,[]);
});
test('unbound legacy/absent reads, changed binding and double confirmation stay locked',async()=>{
  for(const response of [unknown(),{status:'pending',id:requestId},admission('pending',{request_hash:'a'.repeat(64)})]) {
    const {recovery,calls}=await terminalHarness({api:{recoverPayment:async()=>response}});
    await recovery.getSnapshot().selectTerminal(owner);
    assert.equal(recovery.getSnapshot().confirming,false);assert.equal(await recovery.getSnapshot().confirmTerminal(owner),false);
    assert.equal(calls.length,0);
  }
  const wait=deferred();const {recovery}=await terminalHarness({api:{terminatePaymentAttempt:()=>wait.promise}});
  await recovery.getSnapshot().selectTerminal(owner);const first=recovery.getSnapshot().confirmTerminal(owner);
  assert.equal(await recovery.getSnapshot().confirmTerminal(owner),false);assert.equal(recoveryBusy(recovery.getSnapshot()),true);
  wait.resolve({status:'no_effect',id:requestId});await first;
  assert.equal(recoveryUnresolved(recovery.getSnapshot()),true);
});

test('lost terminal response remains locked until a bound fresh GET verifies no effect; late continue after exit is ignored',async()=>{
 let result=admission();
 const {recovery,forgotten}=await terminalHarness({api:{recoverPayment:async()=>result,terminatePaymentAttempt:async()=>{result=admission('no_effect');throw Error('Response lost');}}});
 await recovery.getSnapshot().selectTerminal(owner);await recovery.getSnapshot().confirmTerminal(owner);
 assert.deepEqual(forgotten,[]);assert.equal(recovery.getSnapshot().check,'pending');
 await recovery.check();assert.equal(recovery.getSnapshot().check,'no_effect');
 await recovery.getSnapshot().continueFresh(owner);assert.deepEqual(forgotten,[requestId]);
 const wait=deferred();let checks=0;
 const stale=await terminalHarness({api:{recoverPayment:()=>++checks===1?Promise.resolve(admission('no_effect')):wait.promise}});
 let navigated=false;const continuing=stale.recovery.getSnapshot().continueFresh(owner,()=>{navigated=true;});stale.recovery.reset();wait.resolve(admission('no_effect'));await continuing;
 assert.deepEqual(stale.forgotten,[]);assert.equal(stale.recovery.getSnapshot(),null);assert.equal(navigated,false);
});

test('fresh terminal continuation respects read revocation and canonical recorded precedence',async()=>{
 for(const mode of ['denied','recorded']) {
  let reads=0;
  const {recovery,forgotten}=await terminalHarness({api:{recoverPayment:async()=>{
   if(++reads===1)return admission('no_effect');
   if(mode==='recorded')return outcome();throw Object.assign(Error('Access revoked'),{code:'CAPABILITY_DENIED'});
  }}});
  let navigated=false;assert.equal(await recovery.getSnapshot().continueFresh(owner,()=>{navigated=true;}),false);assert.equal(navigated,false);assert.deepEqual(forgotten,[]);
  assert.equal(recovery.getSnapshot().phase,mode==='recorded'?'recorded':'unknown');
 }
});
