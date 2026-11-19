import type { Queryable } from '../accountingDocuments/core';
import type { ExtractionJob, ExtractionSource } from '../documentIntake/extraction/contract';
import { applyExecutionEvent, reconstructExecution, executionContract, type ExecutionState } from './executionContract';
import { requireExecutionSchema } from './executionSchema';

export async function loadExecution(q:Queryable,base:ExtractionJob,source:ExtractionSource):Promise<ExecutionState>{
 // Missing extension must never turn a previously running job back into a queued one.
 await requireExecutionSchema(q);
 const events=(await q.query('SELECT sequence,kind,actor_id,payload,job_snapshot FROM durable_job_execution_events WHERE company_id=$1 AND job_id=$2 ORDER BY sequence',[base.company_id,base.job_id])).rows;
 const outbox=(await q.query('SELECT sequence,topic FROM durable_job_execution_outbox WHERE company_id=$1 AND job_id=$2 ORDER BY sequence',[base.company_id,base.job_id])).rows;
 return reconstructExecution(base,events,outbox,source);
}
export async function appendExecution(q:Queryable,prior:ExecutionState,source:ExtractionSource,actor:string,kind:string,payload:unknown){
 const next=applyExecutionEvent(prior,kind,payload,source);
 await q.query('INSERT INTO durable_job_execution_events(company_id,job_id,sequence,kind,actor_id,payload,job_snapshot) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)',[next.job.company_id,next.job.job_id,next.sequence,kind,actor,JSON.stringify(payload),JSON.stringify(next.job)]);
 await q.query('INSERT INTO durable_job_execution_outbox(company_id,job_id,sequence,topic) VALUES($1,$2,$3,$4)',[next.job.company_id,next.job.job_id,next.sequence,executionContract]);
 return next;
}

/** Validate closure histories before counting capacity; damaged proof conservatively retains every start. */
export async function outstandingExecutions(q:Queryable,validate:(row:Record<string,any>)=>Promise<ExecutionState>,company?:string,source?:string){
 const rows=(await q.query(`SELECT j.* FROM durable_jobs j WHERE ($1::uuid IS NULL OR (j.company_id=$1 AND j.source_id=$2))
  AND EXISTS(SELECT 1 FROM durable_job_execution_events e WHERE e.company_id=j.company_id AND e.job_id=j.job_id AND e.kind='start')
  ORDER BY j.company_id,j.job_id LIMIT 1001`,[company??null,source??null])).rows;
 if(rows.length>1000)throw Error('DURABLE_EXECUTION_CAPACITY_HISTORY_LIMIT');
 let count=0;
 for(const row of rows){
  try{const state=await validate(row);count+=state.reservations.filter(r=>!r.closed).length;}
  catch{const starts=await q.query("SELECT count(*)::integer count FROM durable_job_execution_events WHERE company_id=$1 AND job_id=$2 AND kind='start'",[row.company_id,row.job_id]);count+=Math.max(1,starts.rows[0].count);}
 }
 return count;
}
