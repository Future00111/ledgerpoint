import { scope, transact, type Queryable } from '../accountingDocuments/core';
import { fail, uuid } from '../financialDrafts/contract';
import { plainRecord } from '../documentIntake/evidence';
import { verifyStoredEvidence, providerStatus } from '../documentIntake/service';
import { createExtractionJob, cancelJob, type ExtractionJob, type ExtractionRecipe } from '../documentIntake/extraction/contract';
import { reconstructQueuedJob, storageContract } from './contract';
import { requireQueueSchema } from './schema';
export type AfterQueueWrite=(boundary:'identity'|'event'|'outbox',q:Queryable)=>Promise<void>;
const fields=(value:unknown,keys:string[])=>{if(!plainRecord(value)||Object.keys(value).some(k=>!keys.includes(k)))fail(422,'FIELD_INVALID');return value;};
async function source(q:Queryable,company:string,id:string){
 const rows=await q.query('SELECT * FROM document_intake_sources WHERE company_id=$1 AND id=$2 FOR UPDATE',[company,uuid(id)]);
 if(rows.rowCount!==1)fail(404,'RESOURCE_NOT_FOUND');
 const row=rows.rows[0];const evidence=verifyStoredEvidence(row);
 if(row.document_id!==null)fail(409,'SOURCE_ALREADY_LINKED');
 return {row,evidence};
}
async function load(q:Queryable,row:Record<string,any>,evidence:ReturnType<typeof verifyStoredEvidence>,sourceRevision:string){
 const events=(await q.query('SELECT revision,status,actor_id FROM durable_job_events WHERE company_id=$1 AND job_id=$2 ORDER BY revision',[row.company_id,row.job_id])).rows;
 const outbox=(await q.query('SELECT revision,status,topic FROM durable_outbox WHERE company_id=$1 AND job_id=$2 ORDER BY revision',[row.company_id,row.job_id])).rows;
 if(row.storage_version!==1 || row.contract!=='document-intake.extraction-job.v1')fail(409,'DURABLE_JOB_EVIDENCE_MISMATCH');
 const last=events.at(-1);
 return reconstructQueuedJob({storage_contract:storageContract,actor_id:row.actor_id,source_revision:row.source_revision,
  job:{contract:row.contract,job_id:row.job_id,company_id:row.company_id,source_id:row.source_id,sha256:row.source_sha256,
   recipe:{provider:row.recipe_provider,version:row.recipe_version},recipe_fingerprint:row.recipe_fingerprint,
   request_id:row.request_id,max_attempts:row.max_attempts,revision:last?.revision,status:last?.status,
   attempts:[],retry_at_ms:null,result:null,replacement_job_id:null},events,outbox},evidence,row.company_id,sourceRevision);
}
async function append(q:Queryable,job:ExtractionJob,actor:string,hook?:AfterQueueWrite){
 await q.query('INSERT INTO durable_job_events(company_id,job_id,revision,status,actor_id) VALUES($1,$2,$3,$4,$5)',[job.company_id,job.job_id,job.revision,job.status,actor]);
 await hook?.('event',q);
 await q.query("INSERT INTO durable_outbox(company_id,job_id,revision,status,topic) VALUES($1,$2,$3,$4,'document-intake.lifecycle.v1')",[job.company_id,job.job_id,job.revision,job.status]);
 await hook?.('outbox',q);
}
const response=(job:ExtractionJob,source_revision:string,duplicate=false)=>({job,source_revision,duplicate,
 execution_status:'not_connected' as const,provider_status:providerStatus});
export async function enqueueIntakeJob(company:string,actor:string,id:string,input:unknown,hook?:AfterQueueWrite){
 const body=fields(input,['request_id','source_revision','recipe','max_attempts']);
 company=uuid(company).toLowerCase();id=uuid(id).toLowerCase();
 const request=uuid(body.request_id).toLowerCase(),expected=uuid(body.source_revision).toLowerCase();
 return transact(async q=>{
  await scope(q,company,actor,true,true);await requireQueueSchema(q);
  const {row,evidence}=await source(q,company,id);
  if(row.revision!==expected)fail(409,'REVISION_CONFLICT');
  const job=createExtractionJob({company_id:company,evidence,request_id:request,recipe:body.recipe as ExtractionRecipe,max_attempts:body.max_attempts as number|undefined});
  const prior=await q.query('SELECT * FROM durable_jobs WHERE company_id=$1 AND request_id=$2',[company,request]);
  if(prior.rowCount){
   if(prior.rows[0].job_id!==job.job_id || prior.rows[0].actor_id!==actor || prior.rows[0].source_revision!==expected)fail(409,'DURABLE_JOB_REQUEST_CONFLICT');
   return response(await load(q,prior.rows[0],evidence,row.revision),row.revision,true);
  }
  const history=await q.query('SELECT * FROM durable_jobs WHERE company_id=$1 AND source_id=$2 ORDER BY created_at,job_id LIMIT 101',[company,id]);
  if((history.rowCount??0)>100)fail(409,'DURABLE_JOB_HISTORY_LIMIT');
  for(const priorJob of history.rows){
   const verified=await load(q,priorJob,evidence,row.revision);
   if(verified.status!=='cancelled')fail(409,'EXTRACTION_SOURCE_JOB_EXISTS');
  }
  await q.query(`INSERT INTO durable_jobs(company_id,job_id,request_id,source_id,source_revision,source_sha256,actor_id,contract,storage_version,recipe_provider,recipe_version,recipe_fingerprint,max_attempts)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,$9,$10,$11,$12)`,[company,job.job_id,request,id,expected,job.sha256,actor,job.contract,job.recipe.provider,job.recipe.version,job.recipe_fingerprint,job.max_attempts]);
  await hook?.('identity',q);await append(q,job,actor,hook);return response(job,row.revision);
 });
}
async function recover(q:Queryable,company:string,id:string,request:string){
 company=uuid(company).toLowerCase();id=uuid(id).toLowerCase();
 const {row,evidence}=await source(q,company,id);
 const prior=await q.query('SELECT * FROM durable_jobs WHERE company_id=$1 AND request_id=$2 AND source_id=$3',[company,uuid(request),id]);
 if(prior.rowCount!==1)fail(404,'RESOURCE_NOT_FOUND');
 return {job:await load(q,prior.rows[0],evidence,row.revision),revision:row.revision};
}
export const recoverIntakeJob=(company:string,actor:string,id:string,request:string)=>transact(async q=>{
 await scope(q,company,actor,false,true);await requireQueueSchema(q);
 const {job,revision}=await recover(q,company,id,request);return response(job,revision);
});
export const cancelIntakeJob=(company:string,actor:string,id:string,request:string,input:unknown,hook?:AfterQueueWrite)=>transact(async q=>{
 const body=fields(input,['expected_revision']);
 if(!Number.isInteger(body.expected_revision)||Number(body.expected_revision)<0)fail(422,'FIELD_INVALID');
 await scope(q,company,actor,true,true);await requireQueueSchema(q);
 const {job,revision}=await recover(q,company,id,request);
 // Lost cancellation response may replay the original revision, but no future revision is accepted.
 if(job.status==='cancelled' && (body.expected_revision===0||body.expected_revision===1))return response(job,revision,true);
 const cancelled=cancelJob(job,body.expected_revision as number);await append(q,cancelled,actor,hook);return response(cancelled,revision);
});
