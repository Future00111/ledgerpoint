import type { AdaptedExtractionResult, AttemptToken, ExtractionFailure, ExtractionJob, ExtractionRecipe, ExtractionSource } from '../contract';
import type { CaptureChannel, CaptureMediaType } from '../../evidence';

export const WORKER_MAX_SOURCE_BYTES = 5 * 1024 * 1024;
export const WORKER_MAX_LEASE_MS = 60_000;
export interface JobAddress { readonly company_id: string; readonly job_id: string }
export interface SourceAddress { readonly company_id: string; readonly source_id: string; readonly actor_id: string }
/** Trusted application adapter must check current membership/capability and load only this tenant's source. */
export interface ResolvedSource {
  readonly company_id: string; readonly source_id: string; readonly revision: string;
  readonly can_extract: boolean; readonly document_id: string | null;
  readonly channel: CaptureChannel; readonly media_type: CaptureMediaType;
  readonly filename: string; readonly bytes: Uint8Array;
}
export type SourceResolver = (address: SourceAddress, signal: AbortSignal) => Promise<ResolvedSource>;
export interface EnqueueExtraction extends SourceAddress {
  readonly recipe: ExtractionRecipe; readonly request_id: string; readonly max_attempts?: number;
}
export interface ExtractionLease extends JobAddress {
  readonly lease_id: string; readonly expires_at_ms: number;
  readonly job: ExtractionJob; readonly token: AttemptToken;
  readonly source: ExtractionSource; readonly bytes: Uint8Array; readonly signal: AbortSignal;
}
export type ClaimResult = { readonly kind: 'claimed'; readonly lease: ExtractionLease }
  | { readonly kind: 'busy' | 'not_runnable' | 'access_denied' };
export type WorkerOutcome = { readonly status: 'busy' | 'not_runnable' | 'access_denied' | 'stale' | 'repository_failed' | ExtractionJob['status']; readonly failure_code?: ExtractionFailure['code'] };
export type AttemptOutcome = { readonly result: AdaptedExtractionResult } | { readonly failure: ExtractionFailure };

/**
 * Internal worker interface, never an HTTP authority. Implementations must make
 * claim/state/outcome checks atomic against latest state, not caller snapshots.
 * Execution capacity is separate from expiring leases; release requires actual
 * transport closure, never merely a logical timeout. Durable implementations
 * additionally require validated rehydration, transactions, outbox and audit.
 */
export interface ExtractionWorkerRepository {
  claim(address: JobAddress, nowMs: number, leaseMs: number): Promise<ClaimResult>;
  settle(lease: ExtractionLease, outcome: AttemptOutcome, nowMs: number): Promise<WorkerOutcome>;
  releaseExecution(lease: ExtractionLease): Promise<void>;
}
export interface AdapterRequest {
  readonly source: ExtractionSource; readonly bytes: Uint8Array;
  readonly recipe: ExtractionRecipe; readonly attempt: AttemptToken;
}
/** Configured trusted host; it may not resolve `closed` until its actual work is stopped. */
export interface AdapterExecution {
  readonly output: AsyncIterable<Uint8Array>;
  readonly closed: Promise<void>;
}
export interface ExtractionTransport {
  readonly recipe: ExtractionRecipe;
  /** A rejected start must leave no background work. No command or URL is taken from document data. */
  start(request: AdapterRequest, signal: AbortSignal): Promise<AdapterExecution>;
}
export class WorkerBoundaryError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'WorkerBoundaryError'; }
}
export function safeClock(now: number) {
  if (!Number.isSafeInteger(now) || now < 0 || now > Number.MAX_SAFE_INTEGER - 300_000) throw new WorkerBoundaryError('WORKER_CLOCK_INVALID');
}
export const recipeKey = (recipe: ExtractionRecipe) => JSON.stringify([recipe.provider, recipe.version]);
