import test from'node:test';import assert from'node:assert/strict';import{disposableTarget,verifyTarget}from'./testTarget';
const target=disposableTarget(true);
test('populated restore recovers real queued and cancelled identities and outbox through restricted native service',async()=>{
 const {pool}=await import('@workspace/db');try{
  await verifyTarget(pool,target.database);const {recoverIntakeJob}=await import('./service');
  const rows=(await pool.query("SELECT j.* FROM durable_jobs j JOIN companies c ON c.id=j.company_id WHERE c.name IN ('Synthetic durable restore queued','Synthetic durable restore cancelled') ORDER BY c.name")).rows;
  assert.equal(rows.length,2);const states=new Set<string>();
  for(const row of rows){const found=await recoverIntakeJob(row.company_id,row.actor_id,row.source_id,row.request_id);states.add(found.job.status);assert.equal(found.job.job_id,row.job_id);assert.equal(found.execution_status,'not_connected');assert.equal(found.job.attempts.length,0);
   const count=(await pool.query('SELECT count(*)::int n FROM durable_outbox WHERE company_id=$1 AND job_id=$2',[row.company_id,row.job_id])).rows[0].n;assert.equal(count,found.job.status==='cancelled'?2:1);
  }
  assert.deepEqual([...states].sort(),['cancelled','queued']);
  for(const table of['durable_jobs','durable_job_events','durable_outbox'])for(const sql of[`UPDATE ${table} SET company_id=company_id`,`DELETE FROM ${table}`,`TRUNCATE ${table}`])await assert.rejects(()=>pool.query(sql),(e:any)=>e.code==='42501');
  console.log('DURABLE_QUEUE_RESTORE_ACCEPTANCE',JSON.stringify({states:[...states].sort(),nativeRuntime:true,immutable:true,execution:'not_connected'}));
 }finally{await pool.end();}
});
