import { isDeepStrictEqual } from 'node:util';
import { createExtractionJob, cancelJob, type ExtractionJob } from '../documentIntake/extraction/contract';
import { type EvidenceDescriptor, plainRecord, IntakeError } from '../documentIntake/evidence';
export const storageContract = 'document-intake.durable-queue.v1';
function invalid(): never { throw new IntakeError('DURABLE_JOB_EVIDENCE_MISMATCH'); }
const exact = (v: unknown, keys: string[]): v is Record<string, any> => plainRecord(v) &&
 Object.keys(v).sort().join('|') === [...keys].sort().join('|');
export interface QueueRecord {
 storage_contract: string; actor_id: string; source_revision: string; job: unknown;
 events: unknown; outbox: unknown;
}
/** Only queued/cancelled, zero-attempt history is supported. Fresh evidence and current access are caller obligations. */
export function reconstructQueuedJob(input: unknown, evidence: EvidenceDescriptor, company: string, revision: string): ExtractionJob {
 if (!exact(input, ['storage_contract','actor_id','source_revision','job','events','outbox']) || input.storage_contract !== storageContract ||
 typeof input.actor_id !== 'string' || !input.actor_id.trim() || input.actor_id.length > 200 || input.source_revision !== revision ||
 !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(revision)) invalid();
 const stored = input.job;
 if (!exact(stored, ['contract','job_id','company_id','source_id','sha256','recipe','recipe_fingerprint','request_id','max_attempts','revision','status','attempts','retry_at_ms','result','replacement_job_id'])) invalid();
 let job = createExtractionJob({company_id:company,evidence,recipe:stored.recipe,request_id:stored.request_id,max_attempts:stored.max_attempts});
 if (!Array.isArray(input.events) || !Array.isArray(input.outbox) || input.events.length < 1 || input.events.length > 2 || input.outbox.length !== input.events.length) invalid();
 for (let index=0; index<input.events.length; index++) {
  const event=input.events[index], outbox=input.outbox[index], status=index===0?'queued':'cancelled';
  if (!exact(event,['revision','status','actor_id']) || event.revision!==index || event.status!==status ||
   typeof event.actor_id!=='string' || !event.actor_id.trim() || event.actor_id.length>200 || (index===0 && event.actor_id!==input.actor_id) ||
   !isDeepStrictEqual(outbox,{revision:index,status,topic:'document-intake.lifecycle.v1'})) invalid();
 }
 if (input.events.length===2) job=cancelJob(job,0);
 if (!isDeepStrictEqual(stored,job)) invalid();
 return job;
}
