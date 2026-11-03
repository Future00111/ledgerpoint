import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { initialState, validateState, migrateV2State, transition } from './core.mjs';
const digest = value => createHash('sha256').update(value).digest('hex');
const catalog = {version:1,tasks:[{id:'a',priority:1,dependencies:[],acceptance:['Complete parent acceptance.'],files:['a.ts'],kind:'implementation',approval:'approved'}]};
const source = {ref:'refs/heads/archive',sha:'a'.repeat(40),path:'queue.json'};
const raw = 'local-command-token';
const run = (state,command) => transition(catalog,state,command,{now:1000,coordinator:'coordinator'});
const claim = () => run(initialState(catalog),{type:'claim',actor:'worker',token:raw,leaseMs:5000});
const legacy = () => ({...initialState(catalog),version:2,revision:7,events:[{at:1,actor:'old-worker',type:'claim',taskId:'a',token:'retired-local-token'},{at:2,actor:'old-worker',type:'block',taskId:'a',checkpoint:'Stopped work preserved.'}]});
test('v3 claim result alone contains raw token; persisted state and all owned transitions contain only verifiers',()=>{
 const result=claim();assert.equal(result.claim.token,raw);assert.equal(result.state.tasks.a.tokenSha256,digest(raw));assert.equal(result.state.events[0].tokenSha256,digest(raw));assert.equal(JSON.stringify(result.state).includes(raw),false);
 const commands=[{type:'renew',leaseMs:5000},{type:'checkpoint',checkpoint:'Saved commit.'},{type:'block',blockers:[{type:'environment',reason:'Stopped for missing prerequisite.'}]},{type:'submit',evidence:{commit:'source',summary:'Partial awaiting independent review.',tests:[{command:'focused',passed:true}]}}];
 for(const command of commands){
  for(const token of ['wrong-local-token',digest(raw)]) assert.throws(()=>run(result.state,{...command,actor:'worker',taskId:'a',token}),{code:'LEASE_REQUIRED'});
  const next=run(result.state,{...command,actor:'worker',taskId:'a',token:raw}).state;
  assert.equal(JSON.stringify(next).includes(raw),false);validateState(catalog,next);
 }
});
test('explicit stopped v2 migration preserves task and event meaning, order, revision, source provenance and input',()=>{
 const old=legacy(),before=structuredClone(old);old.tasks.a.evidence={commit:'partial',summary:'Original evidence'};before.tasks.a.evidence=structuredClone(old.tasks.a.evidence);
 const next=migrateV2State(catalog,old,{source});assert.deepEqual(old,before);assert.equal(next.version,3);assert.equal(next.revision,old.revision);assert.deepEqual(next.tasks,old.tasks);assert.equal(next.events.length,old.events.length);
 assert.deepEqual(next.events,[{...old.events[0],token:undefined,tokenSha256:digest(old.events[0].token)},old.events[1]].map(x=>Object.fromEntries(Object.entries(x).filter(([,v])=>v!==undefined))));
 assert.equal(next.workerTokenMigration.sourceStateSha256,digest(JSON.stringify(old)));assert.deepEqual(next.workerTokenMigration.source,source);assert.equal(JSON.stringify(next).includes('retired-local-token'),false);
 assert.throws(()=>run(next,{type:'claim',actor:'worker',token:'retired-local-token',leaseMs:5000}),{code:'INVALID_TOKEN'});
});
test('migration rejects held, mixed, malformed, unknown and missing-provenance input without mutating it',()=>{
 const held=legacy();held.tasks.a={status:'running',priority:1,owner:'old',token:'old-active-token',leaseUntil:5000};assert.throws(()=>migrateV2State(catalog,held,{source}),{code:'STOPPED_STATE_REQUIRED'});
 for(const mutate of [s=>s.version=1,s=>s.events[0].tokenSha256=digest('x'),s=>s.events[0].token='',s=>s.events[1].token='unrecognized',s=>s.tasks.a.token='orphaned',s=>s.extra={token:'hidden'}]){
  const value=legacy();mutate(value);const before=structuredClone(value);assert.throws(()=>migrateV2State(catalog,value,{source}));assert.deepEqual(value,before);
 }
 for(const ref of ['refs/heads/../archive','refs/heads//archive','refs/heads/a.lock','refs/heads/a.']) assert.throws(()=>migrateV2State(catalog,legacy(),{source:{...source,ref}}),{code:'MIGRATION_SOURCE_REQUIRED'});
 assert.throws(()=>migrateV2State(catalog,legacy()),{code:'MIGRATION_SOURCE_REQUIRED'});assert.throws(()=>migrateV2State(catalog,legacy(),{source:{...source,path:'../queue'}}),{code:'MIGRATION_SOURCE_REQUIRED'});
});
test('v3 refuses plaintext, mixed, malformed and misplaced verifiers including nested evidence',()=>{
 for(const mutate of [s=>s.tasks.a.token=raw,s=>s.tasks.a.tokenSha256='bad',s=>s.events[0].token=raw,s=>s.events[0].tokenSha256='',s=>s.events.push({type:'checkpoint',tokenSha256:digest(raw)}),s=>s.tasks.a.evidence={token:raw},s=>s.extra={tokenSha256:digest(raw)}]){
  const state=claim().state;mutate(state);assert.throws(()=>validateState(catalog,state),{code:'INVALID_STATE'});
 }
});
