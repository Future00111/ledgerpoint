import { randomUUID } from 'node:crypto';
import { scope, transact, type Queryable } from '../accountingDocuments/core';
import { fail, uuid } from '../financialDrafts/contract';
import { extractionResultPayload } from '../documentIntake/extraction/contract';
import { safeClock, WORKER_MAX_LEASE_MS, type AttemptOutcome, type ClaimResult, type ExtractionLease, type ExtractionWorkerRepository, type JobAddress, type WorkerOutcome } from '../documentIntake/extraction/worker/types';
import { verifyStoredEvidence } from '../documentIntake/service';
import { durableSource, loadQueuedJob } from './service';
import { requireExecutionSchema } from './executionSchema';
import { appendExecution, loadExecution, outstandingExecutions } from './executionStore';

async function record(q:Queryable,address:JobAddress,access=true){
 const company=uuid(address.company_id).toLowerCase();
 if(typeof address.job_id!=='string'||!/^sha256:[0-9a-f]{64}$/.test(address.job_id))fail(422,'FIELD_INVALID');
 await requireExecutionSchema(q);
 const rows=await q.query('SELECT * FROM durable_jobs WHERE company_id=$1 AND job_id=$2',[company,address.job_id]);
 if(rows.rowCount!==1)fail(404,'RESOURCE_NOT_FOUND');const row=rows.rows[0];
 if(access)await scope(q,company,row.actor_id,true,true);
 else await q.query('SELECT id FROM companies WHERE id=$1 FOR UPDATE',[company]);
 const original=await durableSource(q,company,row.source_id),source={company_id:company,evidence:original.evidence};
 const base=await loadQueuedJob(q,row,original.evidence,original.row.revision);
 return{row,source,original:original.row,state:await loadExecution(q,base,source)};
}
const outcome=(state:Awaited<ReturnType<typeof record>>['state']):WorkerOutcome=>{
 const last=state.job.attempts.at(-1)?.outcome;
 return{status:state.job.status,...(last?.kind==='failed'?{failure_code:last.code}:{})};
};
const denied=(e:any)=>['RESOURCE_NOT_FOUND','CAPABILITY_DENIED','REVISION_CONFLICT','SOURCE_ALREADY_LINKED'].includes(e?.code);

/** Internal, explicitly configured worker repository. No HTTP route constructs or receives lease capabilities. */
export class DurableExtractionRepository implements ExtractionWorkerRepository {
 private readonly issued=new WeakMap<object,{controller:AbortController;actor:string}>();
 constructor(private readonly maxConcurrent=2,private readonly now:()=>number=Date.now){if(!Number.isInteger(maxConcurrent)||maxConcurrent<1||maxConcurrent>8)throw Error('WORKER_CONFIGURATION_INVALID');}
 async claim(address:JobAddress,nowMs:number,leaseMs:number):Promise<ClaimResult>{
  safeClock(nowMs);if(!Number.isInteger(leaseMs)||leaseMs<1||leaseMs>WORKER_MAX_LEASE_MS)throw Error('WORKER_LEASE_INVALID');
  try{return await transact(async q=>{
   const r=await record(q,address);nowMs=Math.max(nowMs,this.now());safeClock(nowMs);let state=r.state;const latest=state.reservations.at(-1);
   if(state.job.status==='running'&&latest&&nowMs>=latest.expires)state=await appendExecution(q,state,r.source,r.row.actor_id,'failure',{lease_id:latest.id,settled_at_ms:nowMs,failure:{code:'TIMEOUT'}});
   if(!['queued','retryable'].includes(state.job.status)||state.job.retry_at_ms!==null&&nowMs<state.job.retry_at_ms)return{kind:'not_runnable'};
   // Logical expiry never releases physical capacity. One global mutex serializes capacity admission.
   await q.query('SELECT pg_advisory_xact_lock(726401,1)');
   const validate=async(row:Record<string,any>)=>{
    const stored=(await q.query('SELECT * FROM document_intake_sources WHERE company_id=$1 AND id=$2',[row.company_id,row.source_id])).rows[0];
    const evidence=verifyStoredEvidence(stored),base=await loadQueuedJob(q,row,evidence,row.source_revision);
    return loadExecution(q,base,{company_id:row.company_id,evidence});
   };
   if(await outstandingExecutions(q,validate)>=this.maxConcurrent||await outstandingExecutions(q,validate,state.job.company_id,state.job.source_id)>0)return{kind:'busy'};
   nowMs=Math.max(nowMs,this.now());safeClock(nowMs);
   const id=randomUUID(),expires=nowMs+leaseMs;
   state=await appendExecution(q,state,r.source,r.row.actor_id,'start',{lease_id:id,started_at_ms:nowMs,expires_at_ms:expires});
   const controller=new AbortController();
   const lease=Object.freeze({company_id:state.job.company_id,job_id:state.job.job_id,lease_id:id,expires_at_ms:expires,job:state.job,
    token:state.job.attempts.at(-1)!.token,source:r.source,bytes:new Uint8Array(r.original.content),signal:controller.signal});
   this.issued.set(lease,{controller,actor:r.row.actor_id});return{kind:'claimed',lease};
  });}catch(error){if(denied(error))return{kind:'access_denied'};throw error;}
 }
 async settle(lease:ExtractionLease,result:AttemptOutcome,nowMs:number):Promise<WorkerOutcome>{
  safeClock(nowMs);if(!this.issued.has(lease))return{status:'stale'};
  try{return await transact(async q=>{
   const r=await record(q,lease),state=r.state,current=state.reservations.at(-1);
   if(!current||current.id!==lease.lease_id||state.job.revision!==lease.token.started_revision||state.job.status!=='running')return state.job.status==='running'?{status:'stale'}:outcome(state);
   nowMs=Math.max(nowMs,this.now());safeClock(nowMs);
   const timedOut=nowMs>=current.expires;
   const kind=timedOut||'failure'in result?'failure':'result';
   const payload={lease_id:current.id,settled_at_ms:nowMs,...(timedOut?{failure:{code:'TIMEOUT'}}:'failure'in result?{failure:result.failure}:{output:extractionResultPayload(result.result)})};
   const next=await appendExecution(q,state,r.source,r.row.actor_id,kind,payload);return outcome(next);
  });}catch(error){if(denied(error)){this.issued.get(lease)!.controller.abort();return{status:'access_denied'};}throw error;}
 }
 /** Only the original worker's branded lease reaches this method after its transport.closed resolves.
  * A newly constructed repository after a crash cannot release an old lease or manufacture closure proof. */
 async releaseExecution(lease:ExtractionLease):Promise<void>{
  const issued=this.issued.get(lease);if(!issued)return;
  await transact(async q=>{
   const r=await record(q,lease,false),current=r.state.reservations.at(-1);
   if(!current||current.id!==lease.lease_id||current.closed)return;
   await appendExecution(q,r.state,r.source,issued.actor,'release',{lease_id:lease.lease_id});
  });
 }
}
