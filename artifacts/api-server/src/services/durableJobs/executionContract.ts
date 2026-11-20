import { isDeepStrictEqual } from 'node:util';
import { adaptExtractionResult, cancelJob, completeAttempt, failAttempt, startAttempt, type ExtractionJob, type ExtractionSource } from '../documentIntake/extraction/contract';
import { IntakeError, plainRecord } from '../documentIntake/evidence';

export const executionContract = 'document-intake.durable-execution.v1';
export const MAX_EXECUTION_EVENTS = 32;
export interface Reservation { id: string; attemptId: string; expires: number; closed: boolean }
export interface ExecutionState { job: ExtractionJob; sequence: number; reservations: Reservation[] }
export interface ExecutionEvent { sequence: number; kind: string; actor_id: string; payload: unknown; job_snapshot: unknown }
const exact=(x:unknown,keys:string[]):x is Record<string,any>=>plainRecord(x)&&Object.keys(x).sort().join('|')===[...keys].sort().join('|');
function invalid():never{throw new IntakeError('DURABLE_EXECUTION_EVIDENCE_MISMATCH');}
const clock=(x:unknown):x is number=>Number.isSafeInteger(x)&&Number(x)>=0&&Number(x)<Number.MAX_SAFE_INTEGER-300000;
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x);

/** Replay commands through the original branded validators; database JSON never becomes authority by casting. */
export function applyExecutionEvent(prior:ExecutionState,kind:string,payload:unknown,source:ExtractionSource):ExecutionState {
 if(prior.sequence>=MAX_EXECUTION_EVENTS)invalid();
 let job=prior.job;const reservations=prior.reservations.map(x=>({...x}));
 const current=reservations.at(-1);
 if(kind==='start'){
  if(!exact(payload,['lease_id','started_at_ms','expires_at_ms'])||!uuid(payload.lease_id)||!clock(payload.started_at_ms)||!clock(payload.expires_at_ms)||
   payload.expires_at_ms<=payload.started_at_ms||payload.expires_at_ms-payload.started_at_ms>60000||reservations.some(x=>!x.closed||x.id===payload.lease_id))invalid();
  const started=startAttempt(job,job.revision,payload.started_at_ms);job=started.job;
  reservations.push({id:payload.lease_id,attemptId:started.token.attempt_id,expires:payload.expires_at_ms,closed:false});
 }else if(kind==='release'){
  if(!exact(payload,['lease_id'])||!current||current.id!==payload.lease_id||current.closed)invalid();
  current.closed=true;
 }else if(kind==='cancel'){
  if(!exact(payload,['expected_revision'])||payload.expected_revision!==job.revision||job.status==='cancelled')invalid();
  job=cancelJob(job,payload.expected_revision);
 }else if(kind==='failure'||kind==='result'){
  const keys=kind==='failure'?['lease_id','settled_at_ms','failure']:['lease_id','settled_at_ms','output'];
  if(!exact(payload,keys)||!current||payload.lease_id!==current.id||!clock(payload.settled_at_ms)||job.status!=='running')invalid();
  const token=job.attempts.at(-1)?.token;
  if(!token||token.attempt_id!==current.attemptId||payload.settled_at_ms<token.started_at_ms)invalid();
  if(kind==='result'){
   if(payload.settled_at_ms>=current.expires)invalid();
   job=completeAttempt(job,token,adaptExtractionResult(source,payload.output));
  }else{
   if(!exact(payload.failure,payload.failure?.retry_after_ms===undefined?['code']:['code','retry_after_ms']))invalid();
   if(payload.settled_at_ms>=current.expires&&payload.failure.code!=='TIMEOUT')invalid();
   job=failAttempt(job,token,{code:payload.failure.code,...(payload.failure.retry_after_ms===undefined?{}:{retry_after_ms:payload.failure.retry_after_ms})},payload.settled_at_ms);
  }
 }else invalid();
 return{job,sequence:prior.sequence+1,reservations};
}

export function reconstructExecution(base:ExtractionJob,events:unknown,outbox:unknown,source:ExtractionSource):ExecutionState {
 if(!Array.isArray(events)||!Array.isArray(outbox)||events.length>MAX_EXECUTION_EVENTS||events.length!==outbox.length||
  (events.length>0&&base.status!=='queued'))invalid();
 let state:ExecutionState={job:base,sequence:0,reservations:[]};
 for(let index=0;index<events.length;index++){
  const e=events[index],o=outbox[index];
  if(!exact(e,['sequence','kind','actor_id','payload','job_snapshot'])||e.sequence!==index+1||typeof e.actor_id!=='string'||!e.actor_id.trim()||e.actor_id.length>200||
   !isDeepStrictEqual(o,{sequence:index+1,topic:executionContract}))invalid();
  state=applyExecutionEvent(state,e.kind,e.payload,source);
  if(!isDeepStrictEqual(e.job_snapshot,state.job))invalid();
 }
 return state;
}
