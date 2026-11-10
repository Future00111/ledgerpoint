import test from 'node:test';
import assert from 'node:assert/strict';
import { recordReplacement, checkPendingReplacement, observeReplacementVersion } from './actions.mjs';
import { readPending, replacementInput } from './model.mjs';

const memory = () => { const m = new Map(); return { m, getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
test('aborted committed reply survives reload and read-only history recovery without another write', async () => {
  const s=memory(), body=reviewed(); let writes=0;
  const result=await recordReplacement({client:{appendReplacement:async()=>{writes++;throw Object.assign(Error('reply aborted'),{name:'AbortError'});}},storage:s,companyId:'c1',documentId:'d1',body});
  assert.equal(result.kind,'unknown');
  const pending=readPending(s,'c1','d1'); assert.deepEqual(pending.body,body);
  const recovered=await checkPendingReplacement({client:{replacementHistory:async()=>({replacements:[{id:'r1',request_id:body.request_id}]}),appendReplacement:async()=>assert.fail('no repeat')},storage:s,companyId:'c1',documentId:'d1',pending,canWrite:false});
  assert.equal(recovered.kind,'recorded');assert.equal(writes,1);assert.equal(readPending(s,'c1','d1'),null);
});
test('revoked retry keeps uncertain identity, rejects a new identity, later confirms old commit', async () => {
  const s=memory(), body=reviewed();
  await recordReplacement({client:{appendReplacement:async()=>{throw network();}},storage:s,companyId:'c1',documentId:'d1',body});
  const denied=await checkPendingReplacement({client:{replacementHistory:async()=>({replacements:[]}),appendReplacement:async()=>{throw Object.assign(Error('revoked'),{status:403});}},storage:s,companyId:'c1',documentId:'d1',pending:readPending(s,'c1','d1'),resend:true,canWrite:true});
  assert.equal(denied.kind,'failed');assert.deepEqual(denied.pending.body,body);
  const blocked=await recordReplacement({client:{appendReplacement:async()=>assert.fail('must not send different request')},storage:s,companyId:'c1',documentId:'d1',body:{...body,request_id:'new'}});
  assert.equal(blocked.kind,'failed');assert.deepEqual(readPending(s,'c1','d1').body,body);
  const found=await checkPendingReplacement({client:{replacementHistory:async()=>({replacements:[{id:'old',request_id:body.request_id}]})},storage:s,companyId:'c1',documentId:'d1',pending:readPending(s,'c1','d1'),canWrite:false});
  assert.equal(found.kind,'recorded');
});
test('unavailable or silently failing recovery storage prevents sending a write', async () => {
  for(const storage of [null,{setItem(){throw Error('quota');},getItem(){return null;}},{setItem(){},getItem(){return null;}}]) {
    const r=await recordReplacement({client:{appendReplacement:async()=>assert.fail('must not write')},storage,companyId:'c1',documentId:'d1',body:reviewed()});
    assert.equal(r.kind,'failed');
  }
});
const form = { agreement_id: 'a2', agreement_date: '2026-11-01', payment_deadline: '2026-11-30', discount: '24', evidence_text: 'Signed letter', attested: true };
const reviewed = () => replacementInput({ kind: 'sales_invoice', partyId: 'p', history: { consumed: false, current_replacement_id: 'r1' }, form, requestId: 'req-1' });
const network = () => Object.assign(new TypeError('Failed to fetch'), {});

test('review then record: success clears pending and returns the matching receipt', async () => {
  const s = memory(), calls = [];
  const client = { appendReplacement: async (c, d, b) => { calls.push([c, d, b]); assert.equal(readPending(s, c, d).body.request_id, 'req-1'); return { id: 'r2', request_id: 'req-1' }; } };
  const r = await recordReplacement({ client, storage: s, companyId: 'c1', documentId: 'd1', body: reviewed() });
  assert.equal(r.kind, 'recorded'); assert.equal(r.receipt.id, 'r2');
  assert.equal(calls[0][2].predecessor_id, 'r1'); assert.equal(calls[0][2].attested, true);
  assert.equal(readPending(s, 'c1', 'd1'), null);
});
test('unknown response keeps the request ID recoverable; mismatched reply is never success', async () => {
  for (const client of [{ appendReplacement: async () => { throw network(); } },
    { appendReplacement: async () => { throw Object.assign(Error('x'), { status: 502 }); } },
    { appendReplacement: async () => ({ id: 'r9', request_id: 'other' }) }]) {
    const s = memory();
    const r = await recordReplacement({ client, storage: s, companyId: 'c1', documentId: 'd1', body: reviewed() });
    assert.equal(r.kind, 'unknown'); assert.equal(r.pending.body.request_id, 'req-1');
    assert.equal(readPending(s, 'c1', 'd1').body.request_id, 'req-1');
  }
});
test('definite rejection clears pending; 409 asks for reload', async () => {
  const s = memory();
  const r = await recordReplacement({ client: { appendReplacement: async () => { throw Object.assign(Error('Another replacement was recorded first.'), { status: 409, code: 'CONDITIONAL_REPLACEMENT_STALE' }); } }, storage: s, companyId: 'c1', documentId: 'd1', body: reviewed() });
  assert.equal(r.kind, 'failed'); assert.equal(r.reload, true); assert.equal(readPending(s, 'c1', 'd1'), null);
  const v = await recordReplacement({ client: { appendReplacement: async () => { throw Object.assign(Error('denied'), { status: 403, code: 'CAPABILITY_DENIED' }); } }, storage: s, companyId: 'c1', documentId: 'd1', body: reviewed() });
  assert.equal(v.kind, 'failed'); assert.equal(v.reload, false);
});
test('recover: history confirms; absent does not resend until asked; resend reuses the same body', async () => {
  const s = memory(); const body = reviewed();
  await recordReplacement({ client: { appendReplacement: async () => { throw network(); } }, storage: s, companyId: 'c1', documentId: 'd1', body });
  const pending = readPending(s, 'c1', 'd1');
  let appended = [];
  const client = { replacementHistory: async () => ({ replacements: [] }), appendReplacement: async (c, d, b) => { appended.push(b); return { id: 'r2', request_id: b.request_id }; } };
  const first = await checkPendingReplacement({ client, storage: s, companyId: 'c1', documentId: 'd1', pending, canWrite: true });
  assert.equal(first.kind, 'absent'); assert.equal(appended.length, 0); assert.ok(readPending(s, 'c1', 'd1'));
  const viewer = await checkPendingReplacement({ client, storage: s, companyId: 'c1', documentId: 'd1', pending, resend: true, canWrite: false });
  assert.equal(viewer.kind, 'absent'); assert.equal(appended.length, 0);
  const again = await checkPendingReplacement({ client, storage: s, companyId: 'c1', documentId: 'd1', pending, resend: true, canWrite: true });
  assert.equal(again.kind, 'recorded'); assert.deepEqual(appended, [body]); assert.equal(readPending(s, 'c1', 'd1'), null);
  // Already recorded: confirmed from history, never resubmitted.
  await recordReplacement({ client: { appendReplacement: async () => { throw network(); } }, storage: s, companyId: 'c1', documentId: 'd1', body });
  appended = [];
  const found = await checkPendingReplacement({ client: { replacementHistory: async () => ({ replacements: [{ id: 'r2', position: 2, request_id: 'req-1' }] }), appendReplacement: async () => assert.fail('must not resend') },
    storage: s, companyId: 'c1', documentId: 'd1', pending: readPending(s, 'c1', 'd1'), resend: true, canWrite: true });
  assert.equal(found.kind, 'recorded'); assert.equal(found.receipt.position, 2); assert.equal(readPending(s, 'c1', 'd1'), null);
  // History unavailable keeps the request pending.
  await recordReplacement({ client: { appendReplacement: async () => { throw network(); } }, storage: s, companyId: 'c1', documentId: 'd1', body });
  const down = await checkPendingReplacement({ client: { replacementHistory: async () => { throw Object.assign(Error('unavailable'), { status: 503, code: 'CONDITIONAL_REPLACEMENT_SCHEMA_INCOMPLETE' }); } }, storage: s, companyId: 'c1', documentId: 'd1', pending: readPending(s, 'c1', 'd1') });
  assert.equal(down.kind, 'failed'); assert.ok(readPending(s, 'c1', 'd1'));
});
test('company switch mid-request: stale result, other company untouched, original scope still recoverable', async () => {
  const s = memory(); let current = 'c1'; let release;
  const client = { appendReplacement: () => new Promise((_, reject) => { release = () => reject(network()); }) };
  const run = recordReplacement({ client, storage: s, companyId: 'c1', documentId: 'd1', body: reviewed(), isCurrent: () => current === 'c1' });
  current = 'c2'; release();
  assert.equal((await run).kind, 'stale');
  assert.equal(readPending(s, 'c2', 'd1'), null);
  assert.equal(readPending(s, 'c1', 'd1').body.request_id, 'req-1');
  // A pending request from another company/document is never checked in this scope.
  assert.equal((await checkPendingReplacement({ client: { replacementHistory: async () => assert.fail('no cross-company read') }, storage: s, companyId: 'c2', documentId: 'd1', pending: readPending(s, 'c1', 'd1') })).kind, 'stale');
  // Definite failure after a switch still clears only the originating company's pending.
  const s2 = memory(); s2.setItem('ledgerly.conditional-replacement.pending:c2:d1', JSON.stringify({ company_id: 'c2', document_id: 'd1', body: { request_id: 'other' } }));
  const r = await recordReplacement({ client: { appendReplacement: async () => { throw Object.assign(Error('stale'), { status: 409, code: 'CONDITIONAL_REPLACEMENT_STALE' }); } }, storage: s2, companyId: 'c1', documentId: 'd1', body: reviewed(), isCurrent: () => false });
  assert.equal(r.kind, 'stale'); assert.equal(readPending(s2, 'c1', 'd1'), null); assert.equal(readPending(s2, 'c2', 'd1').body.request_id, 'other');
});
test('observation confirms only a matching observed reply', async () => {
  assert.equal((await observeReplacementVersion({ client: { observeReplacement: async () => ({ replacement_id: 'r2', observation: { state: 'observed' } }) }, companyId: 'c', documentId: 'd', replacementId: 'r2' })).kind, 'observed');
  assert.equal((await observeReplacementVersion({ client: { observeReplacement: async () => ({ replacement_id: 'r3', observation: { state: 'observed' } }) }, companyId: 'c', documentId: 'd', replacementId: 'r2' })).kind, 'unknown');
  assert.equal((await observeReplacementVersion({ client: { observeReplacement: async () => { throw network(); } }, companyId: 'c', documentId: 'd', replacementId: 'r2' })).kind, 'unknown');
  assert.equal((await observeReplacementVersion({ client: { observeReplacement: async () => { throw Object.assign(Error('denied'), { status: 403, code: 'CAPABILITY_DENIED' }); } }, companyId: 'c', documentId: 'd', replacementId: 'r2' })).kind, 'failed');
  assert.equal((await observeReplacementVersion({ client: { observeReplacement: async () => ({ replacement_id: 'r2', observation: { state: 'observed' } }) }, companyId: 'c', documentId: 'd', replacementId: 'r2', isCurrent: () => false })).kind, 'stale');
});
