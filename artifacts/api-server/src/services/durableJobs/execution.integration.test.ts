import test,{before,after}from'node:test';import assert from'node:assert/strict';import{randomUUID}from'node:crypto';import{fork}from'node:child_process';import path from'node:path';import pg from'pg';
import{disposableTarget,verifyTarget}from'./testTarget';
const target=disposableTarget(),actor='synthetic-execution-owner';
const admin=new pg.Pool({host:target.socket,port:55441,user:'w03_bootstrap',database:target.database,password:()=>'',ssl:false,options:'-c timezone=UTC'});
let pool:typeof import('@workspace/db')['pool'],service:typeof import('./service'),intake:typeof import('../documentIntake/service'),Repository:typeof import('./executionRepository')['DurableExtractionRepository'];
let financialBefore:string|undefined;
const financialCounts=async()=>JSON.stringify((await pool.query('SELECT (SELECT count(*) FROM canonical_journal_entries) journals,(SELECT count(*) FROM accounting_posting_effects) effects')).rows);
before(async()=>{({pool}=await import('@workspace/db'));await verifyTarget(pool,target.database);await verifyTarget(admin,target.database,'w03_bootstrap');service=await import('./service');intake=await import('../documentIntake/service');({DurableExtractionRepository:Repository}=await import('./executionRepository'));financialBefore=await financialCounts();});
after(async()=>{try{if(financialBefore!==undefined)assert.equal(await financialCounts(),financialBefore);}finally{await Promise.all([pool?.end(),admin.end()]);}});
async function fixture(label='ordinary'){
 const company=randomUUID();await admin.query("INSERT INTO companies(id,name,country,base_currency,status) VALUES($1,$2,'GB','GBP','active')",[company,'Synthetic execution '+label]);
 await admin.query("INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,'owner',true)",[randomUUID(),company,actor]);
 const source=(await intake.uploadIntakeSource(company,actor,{filename:'synthetic.pdf',media_type:'application/pdf',content_base64:Buffer.from('%PDF-1.7 synthetic execution '+randomUUID()).toString('base64')})).source;
 const body={request_id:randomUUID(),source_revision:source.revision,recipe:{provider:'synthetic',version:'1'},max_attempts:2};
 const queued=await service.enqueueIntakeJob(company,actor,source.id,body);
 return{company,source,body,job:queued.job,address:{company_id:company,job_id:queued.job.job_id}};
}
const recover=(f:Awaited<ReturnType<typeof fixture>>)=>service.recoverIntakeJob(f.company,actor,f.source.id,f.body.request_id);
const resultFor=async(lease:any)=>{const {adaptExtractionResult}=await import('../documentIntake/extraction/contract');return adaptExtractionResult(lease.source,{pages:[{page:1,text:'Synthetic document evidence'}],candidate:null});};
test('native concurrent admission, exact result replay and actual transport closure retain one review-required result',async()=>{
 const f=await fixture('restore result'),repo=new Repository(8),{createExtractionWorker}=await import('../documentIntake/extraction/worker');
 let close!:()=>void,releaseDone!:()=>void;const closed=new Promise<void>(resolve=>{close=resolve;}),released=new Promise<void>(resolve=>{releaseDone=resolve;});
 const worker=createExtractionWorker({repository:{claim:repo.claim.bind(repo),settle:repo.settle.bind(repo),releaseExecution:async lease=>{await repo.releaseExecution(lease);releaseDone();}},transports:[{recipe:f.body.recipe,async start(){return{closed,output:(async function*(){yield Buffer.from(JSON.stringify({pages:[{page:1,text:'Synthetic document evidence'}],candidate:null}));})()};}}]});
 const outcomes=await Promise.all([worker.run(f.address),worker.run(f.address)]);assert.equal(outcomes.filter(x=>x.status==='review_required').length,1);assert.ok(outcomes.some(x=>['not_runnable','busy'].includes(x.status)));
 assert.equal((await recover(f)).job.result?.review.can_post,false);
 assert.equal((await pool.query("SELECT count(*)::int n FROM durable_job_execution_events WHERE company_id=$1 AND kind='release'",[f.company])).rows[0].n,0);
 close();await released;const rebuilt=await recover(f);assert.equal(rebuilt.job.status,'review_required');assert.equal(rebuilt.job.attempts.length,1);
 const before=JSON.stringify(rebuilt.job);assert.equal(JSON.stringify((await recover(f)).job),before);
 assert.equal((await pool.query('SELECT count(*)::int n FROM durable_job_execution_outbox WHERE company_id=$1',[f.company])).rows[0].n,3);
});
test('bounded retry uses trusted post-lock time and cancellation fences late results',async()=>{
 let now=1000;const repo=new Repository(8,()=>now),f=await fixture();const first=await repo.claim(f.address,now,1000);assert.equal(first.kind,'claimed');if(first.kind!=='claimed')throw Error('claim');
 now=2000;assert.equal((await repo.settle(first.lease,{result:await resultFor(first.lease)},1000)).status,'retryable');
 assert.equal((await repo.claim(f.address,3000,1000)).kind,'busy');await repo.releaseExecution(first.lease);
 const second=await repo.claim(f.address,3000,1000);if(second.kind!=='claimed')throw Error('retry');
 assert.equal((await repo.settle(first.lease,{result:await resultFor(first.lease)},3000)).status,'stale');
 await service.cancelIntakeJob(f.company,actor,f.source.id,f.body.request_id,{expected_revision:second.lease.job.revision});
 assert.equal((await repo.settle(second.lease,{result:await resultFor(second.lease)},3001)).status,'cancelled');await repo.releaseExecution(second.lease);
 const limit=await fixture('restore failed');let clock=1000;const bounded=new Repository(8,()=>clock);
 for(let n=0;n<2;n++){const c=await bounded.claim(limit.address,clock,1000);if(c.kind!=='claimed')throw Error('bounded claim');clock+=1000;await bounded.settle(c.lease,{failure:{code:'TIMEOUT'}},clock);await bounded.releaseExecution(c.lease);clock+=1000;}
 assert.equal((await recover(limit)).job.status,'failed');assert.equal((await bounded.claim(limit.address,clock,1000)).kind,'not_runnable');
});
test('current access/source authority is rechecked and forged lease objects cannot settle or release',async()=>{
 const f=await fixture(),repo=new Repository(8);const c=await repo.claim(f.address,Date.now(),60000);if(c.kind!=='claimed')throw Error('claim');
 assert.equal((await new Repository(8).settle(c.lease,{result:await resultFor(c.lease)},Date.now())).status,'stale');
 await new Repository(8).releaseExecution(c.lease);
 assert.equal((await pool.query("SELECT count(*)::int n FROM durable_job_execution_events WHERE company_id=$1 AND kind='release'",[f.company])).rows[0].n,0);
 await admin.query('UPDATE company_users SET is_active=false WHERE company_id=$1',[f.company]);assert.equal((await repo.settle(c.lease,{result:await resultFor(c.lease)},Date.now())).status,'access_denied');
 await assert.rejects(()=>recover(f));await repo.releaseExecution(c.lease);await admin.query('UPDATE company_users SET is_active=true WHERE company_id=$1',[f.company]);
 assert.equal((await recover(f)).job.status,'running');
 await service.cancelIntakeJob(f.company,actor,f.source.id,f.body.request_id,{expected_revision:c.lease.job.revision});
 const changed=await fixture(),c2=await repo.claim(changed.address,Date.now(),60000);if(c2.kind!=='claimed')throw Error('claim2');
 const revision=randomUUID(),result=await resultFor(c2.lease);
 await admin.query('ALTER TABLE document_intake_sources DISABLE TRIGGER document_intake_source_guard');
 try{
  await admin.query('UPDATE document_intake_sources SET revision=$2 WHERE company_id=$1',[changed.company,revision]);
  await assert.rejects(()=>repo.settle(c2.lease,{result},Date.now()));
 }finally{
  try{await admin.query('UPDATE document_intake_sources SET revision=$2 WHERE company_id=$1',[changed.company,changed.source.revision]);}
  finally{await admin.query('ALTER TABLE document_intake_sources ENABLE TRIGGER document_intake_source_guard');}
 }
 await repo.releaseExecution(c2.lease);
 await service.cancelIntakeJob(changed.company,actor,changed.source.id,changed.body.request_id,{expected_revision:c2.lease.job.revision});
});
test('corrupt release proof cannot free another job capacity; missing extension fails closed',async()=>{
 const f=await fixture(),repo=new Repository(8),c=await repo.claim(f.address,Date.now(),60000);if(c.kind!=='claimed')throw Error('claim');
 await admin.query("INSERT INTO durable_job_execution_events(company_id,job_id,sequence,kind,actor_id,payload,job_snapshot) VALUES($1,$2,2,'release',$3,$4::jsonb,$5::jsonb)",[f.company,f.job.job_id,actor,JSON.stringify({lease_id:c.lease.lease_id}),JSON.stringify(c.lease.job)]);
 await assert.rejects(()=>recover(f));const other=await fixture();assert.equal((await new Repository(1).claim(other.address,Date.now(),60000)).kind,'busy');
 // Complete the deliberately interrupted test journal with its matching outbox proof.
 await admin.query("INSERT INTO durable_job_execution_outbox(company_id,job_id,sequence,topic) VALUES($1,$2,2,'document-intake.durable-execution.v1')",[f.company,f.job.job_id]);
 await service.cancelIntakeJob(f.company,actor,f.source.id,f.body.request_id,{expected_revision:1});
 await admin.query('ALTER TABLE durable_job_execution_outbox RENAME TO durable_job_execution_outbox_missing');
 try{await assert.rejects(()=>recover(other));await assert.rejects(()=>repo.claim(other.address,Date.now(),1000));}finally{await admin.query('ALTER TABLE durable_job_execution_outbox_missing RENAME TO durable_job_execution_outbox');}
 for(const table of['durable_job_execution_events','durable_job_execution_outbox'])for(const sql of[`UPDATE ${table} SET company_id=company_id`,`DELETE FROM ${table}`,`TRUNCATE ${table}`])await assert.rejects(()=>pool.query(sql),(e:any)=>e.code==='42501');
});
test('actual claimant process death reconstructs running work and retains unknown physical capacity after timeout',async()=>{
 const f=await fixture('restore unknown'),worker=path.resolve('generated-artifacts/durable-job-restart.cjs');
 const child=fork(worker,[],{env:process.env,stdio:['ignore','inherit','inherit','ipc']});
 const data=await new Promise<any>((resolve,reject)=>{const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Claim child timeout'));},15000);child.on('error',reject);child.on('message',(m:any)=>{if(m.ready)child.send({mode:'claim',company:f.company,actor,source:f.source.id,body:f.body,job_id:f.job.job_id});else{clearTimeout(timeout);resolve(m);}});});
 assert.equal(data.ok,true);assert.equal(data.data.kind,'claimed');const died=new Promise(resolve=>child.once('exit',(_code,signal)=>resolve(signal)));child.kill('SIGKILL');assert.equal(await died,'SIGKILL');
 const fresh=fork(worker,[],{env:process.env,stdio:['ignore','inherit','inherit','ipc']});
 const recovered=await new Promise<any>((resolve,reject)=>{const timeout=setTimeout(()=>{fresh.kill('SIGKILL');reject(Error('Recovery child timeout'));},15000);fresh.on('error',reject);fresh.on('message',(m:any)=>{if(m.ready)fresh.send({mode:'recover',company:f.company,actor,source:f.source.id,body:f.body});else{clearTimeout(timeout);resolve(m);}});});
 assert.equal(recovered.ok,true);assert.equal(recovered.data.job.status,'running');await new Promise<void>(resolve=>{if(fresh.exitCode!==null)resolve();else fresh.once('exit',()=>resolve());});
 assert.equal((await recover(f)).job.status,'running');const now=data.data.expires_at_ms+1,repo=new Repository(8,()=>now);
 assert.equal((await repo.claim(f.address,now,1000)).kind,'not_runnable');assert.equal((await repo.claim(f.address,now+1000,1000)).kind,'busy');assert.equal((await recover(f)).job.status,'retryable');
 console.log('DURABLE_EXECUTION_RESTART_ACCEPTANCE',JSON.stringify({actualProcessKilled:true,freshProcessRecovery:true,unknownPhysicalCapacityHeld:true}));
});
