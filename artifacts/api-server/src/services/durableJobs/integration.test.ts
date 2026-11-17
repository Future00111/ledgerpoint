import test,{before,after}from'node:test';import assert from'node:assert/strict';import{randomUUID}from'node:crypto';import{fork}from'node:child_process';import path from'node:path';import pg from'pg';
import{disposableTarget,verifyTarget}from'./testTarget';
const target=disposableTarget();
let pool:typeof import('@workspace/db')['pool'],service:typeof import('./service'),intake:typeof import('../documentIntake/service');
const admin=new pg.Pool({host:target.socket,port:55441,user:'w03_bootstrap',database:target.database,password:()=>'',ssl:false,options:'-c timezone=UTC'});
let financialBefore:string;
const actor='synthetic-durable-owner',reader='synthetic-durable-reader',second='synthetic-durable-other-manager';
before(async()=>{({pool}=await import('@workspace/db'));await verifyTarget(pool,target.database);await verifyTarget(admin,target.database,'w03_bootstrap');service=await import('./service');intake=await import('../documentIntake/service');financialBefore=JSON.stringify((await pool.query('SELECT (SELECT count(*) FROM canonical_journal_entries) journals,(SELECT count(*) FROM accounting_posting_effects) effects')).rows);});
after(async()=>{try{assert.equal(JSON.stringify((await pool.query('SELECT (SELECT count(*) FROM canonical_journal_entries) journals,(SELECT count(*) FROM accounting_posting_effects) effects')).rows),financialBefore);}finally{await pool?.end();await admin.end();}});
async function fixture(label='ordinary'){
 const company=randomUUID();await admin.query("INSERT INTO companies(id,name,country,base_currency,status) VALUES($1,$2,'GB','GBP','active')",[company,'Synthetic durable '+label]);
 for(const [user,role]of[[actor,'owner'],[reader,'read_only'],[second,'owner']])await admin.query('INSERT INTO company_users(id,company_id,user_id,role,is_active) VALUES($1,$2,$3,$4,true)',[randomUUID(),company,user,role]);
 const source=(await intake.uploadIntakeSource(company,actor,{filename:'synthetic.pdf',media_type:'application/pdf',content_base64:Buffer.from('%PDF-1.7\nSynthetic durable '+randomUUID()).toString('base64')})).source;
 return {company,source,body:{request_id:randomUUID(),source_revision:source.revision,recipe:{provider:'unconfigured',version:'1'},max_attempts:3}};
}
const counts=async(company:string)=>(await admin.query(`SELECT (SELECT count(*)::int FROM durable_jobs WHERE company_id=$1) jobs,(SELECT count(*)::int FROM durable_job_events WHERE company_id=$1) events,(SELECT count(*)::int FROM durable_outbox WHERE company_id=$1) outbox`,[company])).rows[0];
const code=(expected:string)=>(error:any)=>error.code===expected;
test('native atomic enqueue concurrent replay, identity conflicts, current scope and explicit cancellation',async()=>{
 const f=await fixture(),other=await fixture();
 const [first,replay]=await Promise.all([service.enqueueIntakeJob(f.company,actor,f.source.id,f.body),service.enqueueIntakeJob(f.company,actor,f.source.id,f.body)]);
 assert.equal(first.job.job_id,replay.job.job_id);assert.equal(first.execution_status,'not_connected');assert.deepEqual(first.provider_status,{ocr:'not_connected',email:'not_connected'});
 assert.deepEqual(await counts(f.company),{jobs:1,events:1,outbox:1});
 const upper=await service.enqueueIntakeJob(f.company.toUpperCase(),actor,f.source.id.toUpperCase(),{...f.body,request_id:f.body.request_id.toUpperCase(),source_revision:f.body.source_revision.toUpperCase()});assert.equal(upper.job.job_id,first.job.job_id);
 assert.equal((await service.recoverIntakeJob(f.company,reader,f.source.id,f.body.request_id)).job.job_id,first.job.job_id);
 for(const patch of[{recipe:{provider:'different',version:'1'}},{max_attempts:2}])await assert.rejects(()=>service.enqueueIntakeJob(f.company,actor,f.source.id,{...f.body,...patch}),code('DURABLE_JOB_REQUEST_CONFLICT'));
 const different=(await intake.uploadIntakeSource(f.company,actor,{filename:'different.pdf',media_type:'application/pdf',content_base64:Buffer.from('%PDF-1.7 different source').toString('base64')})).source;
 await assert.rejects(()=>service.enqueueIntakeJob(f.company,actor,different.id,{...f.body,source_revision:different.revision}),code('DURABLE_JOB_REQUEST_CONFLICT'));
 await assert.rejects(()=>service.enqueueIntakeJob(f.company,second,f.source.id,f.body),code('DURABLE_JOB_REQUEST_CONFLICT'));
 await assert.rejects(()=>service.enqueueIntakeJob(f.company,reader,f.source.id,f.body),code('CAPABILITY_DENIED'));
 await assert.rejects(()=>service.cancelIntakeJob(f.company,reader,f.source.id,f.body.request_id,{expected_revision:0}),code('CAPABILITY_DENIED'));
 await assert.rejects(()=>service.recoverIntakeJob(other.company,actor,f.source.id,f.body.request_id),code('RESOURCE_NOT_FOUND'));
 await assert.rejects(()=>service.enqueueIntakeJob(f.company,actor,f.source.id,{...f.body,request_id:randomUUID()}),code('EXTRACTION_SOURCE_JOB_EXISTS'));
 await admin.query('UPDATE company_users SET is_active=false WHERE company_id=$1 AND user_id=$2',[f.company,actor]);
 await assert.rejects(()=>service.recoverIntakeJob(f.company,actor,f.source.id,f.body.request_id),code('RESOURCE_NOT_FOUND'));
 await assert.rejects(()=>service.cancelIntakeJob(f.company,actor,f.source.id,f.body.request_id,{expected_revision:0}),code('RESOURCE_NOT_FOUND'));
 await admin.query('UPDATE company_users SET is_active=true WHERE company_id=$1 AND user_id=$2',[f.company,actor]);
 const cancelled=await service.cancelIntakeJob(f.company,second,f.source.id,f.body.request_id,{expected_revision:0});assert.equal(cancelled.job.status,'cancelled');
 assert.equal((await service.cancelIntakeJob(f.company,actor,f.source.id,f.body.request_id,{expected_revision:0})).duplicate,true);
 assert.equal((await service.enqueueIntakeJob(f.company,actor,f.source.id,f.body)).job.status,'cancelled');
 assert.deepEqual(await counts(f.company),{jobs:1,events:2,outbox:2});
 assert.equal((await service.enqueueIntakeJob(f.company,actor,f.source.id,{...f.body,request_id:randomUUID()})).job.status,'queued');
});
test('identity, event and outbox failures roll back every queue write; cancellation is atomic',async()=>{
 for(const boundary of['identity','event','outbox']){
  const f=await fixture();await assert.rejects(()=>service.enqueueIntakeJob(f.company,actor,f.source.id,f.body,async point=>{if(point===boundary)throw Error('Synthetic rollback');}));
  assert.deepEqual(await counts(f.company),{jobs:0,events:0,outbox:0});assert.equal((await intake.getIntakeContent(f.company,actor,f.source.id)).source.id,f.source.id);
 }
 for(const boundary of['event','outbox']){
  const f=await fixture();await service.enqueueIntakeJob(f.company,actor,f.source.id,f.body);
  await assert.rejects(()=>service.cancelIntakeJob(f.company,actor,f.source.id,f.body.request_id,{expected_revision:0},async point=>{if(point===boundary)throw Error('Synthetic cancel rollback');}));
  assert.equal((await service.recoverIntakeJob(f.company,actor,f.source.id,f.body.request_id)).job.status,'queued');assert.deepEqual(await counts(f.company),{jobs:1,events:1,outbox:1});
 }
});
test('actual producer death after commit and fresh process recover identical queued identity',async()=>{
 const f=await fixture('restore queued');
 const worker=path.resolve('generated-artifacts/durable-job-restart.cjs');
 const run=async(mode:'commit'|'recover')=>{
  const child=fork(worker,[],{env:process.env,stdio:['ignore','inherit','inherit','ipc']});
  const result=await new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Durable child timeout'));},15000);
   child.on('error',reject);child.on('message',(message:any)=>{if(message.ready)child.send({mode,company:f.company,actor,source:f.source.id,body:f.body});else{clearTimeout(timer);resolve(message);}});
   child.once('exit',code=>{if(code)reject(Error('Durable child failed'));});});
  assert.equal(result.ok,true,JSON.stringify(result));
  if(mode==='commit'){const died=new Promise(resolve=>child.once('exit',(_code,signal)=>resolve(signal)));child.kill('SIGKILL');assert.equal(await died,'SIGKILL');}
  else await new Promise<void>(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',()=>resolve());});
  return result.data;
 };
 const committed=await run('commit'),recovered=await run('recover');assert.deepEqual(recovered.job,committed.job);assert.deepEqual(await counts(f.company),{jobs:1,events:1,outbox:1});
 const c=await fixture('restore cancelled');await service.enqueueIntakeJob(c.company,actor,c.source.id,c.body);await service.cancelIntakeJob(c.company,actor,c.source.id,c.body.request_id,{expected_revision:0});
 console.log('DURABLE_QUEUE_RESTART_ACCEPTANCE',JSON.stringify({actualProcessKilled:true,freshProcessRecovery:true,job:committed.job.job_id,execution:'not_connected'}));
});
test('missing/partial/altered queue schema fails before writes while original intake remains readable',async()=>{
 const f=await fixture();const original=await counts(f.company);
 const cases:[string,string][]=[
  ['ALTER TABLE durable_outbox RENAME TO durable_outbox_missing','ALTER TABLE durable_outbox_missing RENAME TO durable_outbox'],
  ['ALTER TABLE durable_jobs RENAME COLUMN source_revision TO bad_revision','ALTER TABLE durable_jobs RENAME COLUMN bad_revision TO source_revision'],
  ['ALTER TABLE durable_job_events DISABLE TRIGGER durable_job_events_immutable','ALTER TABLE durable_job_events ENABLE ALWAYS TRIGGER durable_job_events_immutable'],
  ['GRANT SELECT ON durable_outbox TO PUBLIC','REVOKE SELECT ON durable_outbox FROM PUBLIC'],
  ['GRANT SELECT(job_id) ON durable_outbox TO PUBLIC','REVOKE SELECT(job_id) ON durable_outbox FROM PUBLIC'],
  ['GRANT UPDATE ON durable_outbox TO ledgerly_api','REVOKE UPDATE ON durable_outbox FROM ledgerly_api'],
  ['ALTER TABLE durable_outbox OWNER TO w03_bootstrap','ALTER TABLE durable_outbox OWNER TO ledgerly_canonical_owner'],
  ["ALTER TABLE durable_jobs DROP CONSTRAINT durable_jobs_max_attempts_check; ALTER TABLE durable_jobs ADD CONSTRAINT durable_jobs_max_attempts_check CHECK((max_attempts BETWEEN 1 AND 5) OR true)",
   'ALTER TABLE durable_jobs DROP CONSTRAINT durable_jobs_max_attempts_check; ALTER TABLE durable_jobs ADD CONSTRAINT durable_jobs_max_attempts_check CHECK(max_attempts BETWEEN 1 AND 5)'],
  ["ALTER TABLE durable_jobs DROP CONSTRAINT durable_jobs_source_sha256_check; ALTER TABLE durable_jobs ADD CONSTRAINT durable_jobs_source_sha256_check CHECK(source_sha256 ~ '^[a -f0-9]{64}$')",
   "ALTER TABLE durable_jobs DROP CONSTRAINT durable_jobs_source_sha256_check; ALTER TABLE durable_jobs ADD CONSTRAINT durable_jobs_source_sha256_check CHECK(source_sha256 ~ '^[a-f0-9]{64}$')"],
  ["DROP TRIGGER durable_jobs_immutable ON durable_jobs; CREATE TRIGGER durable_jobs_immutable BEFORE UPDATE OR DELETE ON durable_jobs FOR EACH ROW WHEN(false) EXECUTE FUNCTION durable_job_history_immutable(); ALTER TABLE durable_jobs ENABLE ALWAYS TRIGGER durable_jobs_immutable",
   'DROP TRIGGER durable_jobs_immutable ON durable_jobs; CREATE TRIGGER durable_jobs_immutable BEFORE UPDATE OR DELETE ON durable_jobs FOR EACH ROW EXECUTE FUNCTION durable_job_history_immutable(); ALTER TABLE durable_jobs ENABLE ALWAYS TRIGGER durable_jobs_immutable'],
 ];
 for(const [change,undo]of cases){await admin.query(change);try{
  await assert.rejects(()=>service.enqueueIntakeJob(f.company,actor,f.source.id,f.body),code('DURABLE_JOB_SCHEMA_UNAVAILABLE'));
  assert.equal((await intake.getIntakeContent(f.company,actor,f.source.id)).source.id,f.source.id);
 }finally{await admin.query(undo);}assert.deepEqual(await counts(f.company),original);}
 assert.equal((await service.enqueueIntakeJob(f.company,actor,f.source.id,f.body)).job.status,'queued');
});
test('corrupt, changed and converted sources deny recovery/cancel/replay without erasing history',async()=>{
 const f=await fixture();await service.enqueueIntakeJob(f.company,actor,f.source.id,f.body);const original=await counts(f.company);
 const stored=(await admin.query('SELECT * FROM document_intake_sources WHERE company_id=$1 AND id=$2',[f.company,f.source.id])).rows[0];
 const mutate=async(sql:string,values:any[],fn:()=>Promise<void>)=>{await admin.query('ALTER TABLE document_intake_sources DISABLE TRIGGER document_intake_source_guard');try{await admin.query(sql,values);await fn();}finally{
  await admin.query('UPDATE document_intake_sources SET revision=$3,content=$4,document_id=NULL,review_fingerprint=NULL WHERE company_id=$1 AND id=$2',[f.company,f.source.id,stored.revision,stored.content]);
  await admin.query('ALTER TABLE document_intake_sources ENABLE TRIGGER document_intake_source_guard');}};
 const denied=async(expected:string)=>{
  await assert.rejects(()=>service.recoverIntakeJob(f.company,actor,f.source.id,f.body.request_id),code(expected));
  await assert.rejects(()=>service.cancelIntakeJob(f.company,actor,f.source.id,f.body.request_id,{expected_revision:0}),code(expected));
 };
 const corrupt=Buffer.from(stored.content);corrupt[0]=0;
 await mutate('UPDATE document_intake_sources SET content=$3 WHERE company_id=$1 AND id=$2',[f.company,f.source.id,corrupt],()=>denied('SOURCE_EVIDENCE_MISMATCH'));
 await mutate('UPDATE document_intake_sources SET revision=$3 WHERE company_id=$1 AND id=$2',[f.company,f.source.id,randomUUID()],async()=>{await denied('DURABLE_JOB_EVIDENCE_MISMATCH');await assert.rejects(()=>service.enqueueIntakeJob(f.company,actor,f.source.id,f.body),code('REVISION_CONFLICT'));});
 // A synthetic draft identity represents already-converted source eligibility; no posting engine is invoked.
 const document=randomUUID();await admin.query(`INSERT INTO accounting_document_sources(id,company_id,kind,number,revision,status,source,party_id,purchase_vat_eligible,money,tax_context,posting_accounts,mapping_revision)
 VALUES($1,$2,'purchase_bill','DURABLE-CONVERTED',$3,'draft','{}',$4,false,'{}','{}','{}',$5)`,[document,f.company,randomUUID(),randomUUID(),randomUUID()]);
 await mutate('UPDATE document_intake_sources SET document_id=$3,review_fingerprint=$4,revision=$5 WHERE company_id=$1 AND id=$2',[f.company,f.source.id,document,'v1:'+'0'.repeat(64)+':'+'1'.repeat(64),randomUUID()],()=>denied('SOURCE_ALREADY_LINKED'));
 assert.deepEqual(await counts(f.company),original);assert.equal((await service.recoverIntakeJob(f.company,actor,f.source.id,f.body.request_id)).job.status,'queued');
});
test('malformed terminal history does not free a source for a new enqueue',async()=>{
 const f=await fixture();const queued=await service.enqueueIntakeJob(f.company,actor,f.source.id,f.body);
 await admin.query("INSERT INTO durable_job_events(company_id,job_id,revision,status,actor_id) VALUES($1,$2,1,'cancelled',$3)",[f.company,queued.job.job_id,actor]);
 const baseline=await counts(f.company);
 await assert.rejects(()=>service.enqueueIntakeJob(f.company,actor,f.source.id,{...f.body,request_id:randomUUID()}),code('DURABLE_JOB_EVIDENCE_MISMATCH'));
 assert.deepEqual(await counts(f.company),baseline);
 // Complete the intentionally partial fixture so the populated restore contains valid histories.
 await admin.query("INSERT INTO durable_outbox(company_id,job_id,revision,status,topic) VALUES($1,$2,1,'cancelled','document-intake.lifecycle.v1')",[f.company,queued.job.job_id]);
});
test('runtime and owner SQL cannot rewrite durable history; tenant FKs reject foreign source identities',async()=>{
 const f=await fixture(),other=await fixture();const queued=await service.enqueueIntakeJob(f.company,actor,f.source.id,f.body);
 for(const table of['durable_jobs','durable_job_events','durable_outbox'])for(const sql of[`UPDATE ${table} SET company_id=company_id`,`DELETE FROM ${table}`,`TRUNCATE ${table}`]){
  await assert.rejects(()=>pool.query(sql),code('42501'));if(!sql.startsWith('TRUNCATE'))await assert.rejects(()=>admin.query(sql),code('P0001'));
 }
 await assert.rejects(()=>admin.query('TRUNCATE durable_outbox,durable_job_events,durable_jobs'),code('P0001'));
 await assert.rejects(()=>admin.query(`INSERT INTO durable_jobs(company_id,job_id,request_id,source_id,source_revision,source_sha256,actor_id,contract,storage_version,recipe_provider,recipe_version,recipe_fingerprint,max_attempts)
 SELECT $1,job_id,$2,source_id,source_revision,source_sha256,actor_id,contract,storage_version,recipe_provider,recipe_version,recipe_fingerprint,max_attempts FROM durable_jobs WHERE company_id=$3 AND job_id=$4`,[other.company,randomUUID(),f.company,queued.job.job_id]),code('23503'));
});
test('native HTTP queue endpoints preserve auth, scoped recovery, safe errors and disconnected provider status',async()=>{
 const express=(await import('express')).default,{createDocumentIntakeRouter}=await import('../../routes/documentIntake');
 const app=express();app.use(express.json());app.use('/companies/:companyId/intake',createDocumentIntakeRouter((req,res,next)=>{const user=req.get('x-synthetic-actor');if(!user){res.sendStatus(401);return;}(req as any).userId=user;next();}));
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 try{const f=await fixture(),url=`http://127.0.0.1:${(server.address() as any).port}/companies/${f.company}/intake/${f.source.id}/extraction-jobs`;
  const call=(path='',method='GET',body?:unknown,user:string|null=actor)=>fetch(url+path,{method,headers:{...(user?{'x-synthetic-actor':user}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await call('','POST',f.body,null)).status,401);
  const first=await call('','POST',f.body);assert.equal(first.status,201);const data=(await first.json() as any).data;assert.equal(data.execution_status,'not_connected');
  assert.equal((await call('/'+f.body.request_id,'GET',undefined,reader)).status,200);
  const denied=await call('/'+f.body.request_id+'/cancel','POST',{expected_revision:0},reader);assert.equal(denied.status,403);assert.equal((await denied.json() as any).error.code,'CAPABILITY_DENIED');
  const cancel=await call('/'+f.body.request_id+'/cancel','POST',{expected_revision:0});assert.equal(cancel.status,200);assert.equal((await cancel.json() as any).data.job.status,'cancelled');
  const malformed=await call('','POST',{...f.body,recipe:{provider:'https://untrusted.invalid',version:'1'}});assert.equal(malformed.status,422);const text=await malformed.text();assert.equal(/SELECT|INSERT|untrusted\.invalid/.test(text),false);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
