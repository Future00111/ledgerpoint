import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID}from'node:crypto';
import {createEvidence}from'../documentIntake/evidence';import{createExtractionJob,cancelJob,startAttempt}from'../documentIntake/extraction/contract';
import{reconstructQueuedJob,storageContract}from'./contract';
const company=randomUUID(),revision=randomUUID(),evidence=createEvidence({source_id:randomUUID(),channel:'upload',media_type:'application/pdf',filename:'synthetic.pdf',bytes:Buffer.from('%PDF-1.7\nSynthetic durable job')});
const queued=()=>createExtractionJob({company_id:company,evidence,request_id:randomUUID(),recipe:{provider:'unconfigured',version:'1'}});
const record=(job=queued())=>({storage_contract:storageContract,actor_id:'synthetic',source_revision:revision,job:JSON.parse(JSON.stringify(job)),events:[{revision:0,status:'queued',actor_id:'synthetic'}],outbox:[{revision:0,status:'queued',topic:'document-intake.lifecycle.v1'}]});
test('JSON persisted queued and cancelled records reconstruct branded native contracts without casting',()=>{
 const input=record(),restored=reconstructQueuedJob(input,evidence,company,revision);assert.deepEqual(restored,input.job);
 assert.equal(startAttempt(restored,0,1).job.status,'running');
 input.job=cancelJob(restored,0);input.events.push({revision:1,status:'cancelled',actor_id:'manager'});input.outbox.push({revision:1,status:'cancelled',topic:'document-intake.lifecycle.v1'});
 assert.deepEqual(reconstructQueuedJob(JSON.parse(JSON.stringify(input)),evidence,company,revision),input.job);
});
test('strict persistence rejects partial, future, in-flight and mismatched identity/history/outbox records',()=>{
 const changes:((r:any)=>void)[]=[(r:any)=>r.storage_contract='future',r=>r.source_revision=randomUUID(),r=>r.job.job_id='sha256:'+'0'.repeat(64),
 r=>r.job.company_id=randomUUID(),r=>r.job.source_id=randomUUID(),r=>r.job.sha256='0'.repeat(64),r=>r.job.recipe_fingerprint='sha256:'+'0'.repeat(64),
 r=>r.job.max_attempts=6,r=>r.job.status='running',r=>r.job.revision=1,r=>r.job.attempts=[{}],r=>r.job.result={},
 r=>r.events=[],r=>r.outbox=[],r=>r.events[0].actor_id='wrong',r=>r.outbox[0].topic='other',r=>r.events.push({revision:1,status:'cancelled',actor_id:'x'}),
 r=>r.extra=true,r=>r.job.extra=true,r=>r.events[0].extra=true,r=>r.job.retry_at_ms=1];
 for(const change of changes){const r=record();change(r);assert.throws(()=>reconstructQueuedJob(r,evidence,company,revision));}
});
