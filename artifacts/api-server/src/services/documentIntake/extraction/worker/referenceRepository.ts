import { randomUUID } from 'node:crypto';
import { cancelJob, completeAttempt, createExtractionJob, failAttempt, startAttempt, supersedeJob,
  type ExtractionJob, type ExtractionRecipe } from '../contract';
import { createEvidence } from '../../evidence';
import { WORKER_MAX_LEASE_MS, WORKER_MAX_SOURCE_BYTES, WorkerBoundaryError, safeClock,
  type AttemptOutcome, type ClaimResult, type EnqueueExtraction, type ExtractionLease,
  type ExtractionWorkerRepository, type JobAddress, type ResolvedSource, type SourceAddress,
  type SourceResolver, type WorkerOutcome } from './types';

const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function deny(): never { throw new WorkerBoundaryError('EXTRACTION_ACCESS_DENIED'); }
interface RecordState {
  job: ExtractionJob; actor_id: string; source_revision: string;
  lease: { id: string; expires: number; controller: AbortController } | null;
}

/**
 * Atomic in-process reference implementation. It deliberately retains B1's
 * branded objects; it is not a durable job store or a JSON rehydration path.
 * One shared instance bounds actual executions across multiple worker objects.
 */
export class InProcessExtractionRepository implements ExtractionWorkerRepository {
  private readonly records = new Map<string, RecordState>();
  private readonly executions = new Set<string>();
  private readonly issuedLeases = new WeakSet<object>();
  private serialTail: Promise<void> = Promise.resolve();
  private readonly maxConcurrent: number;
  private readonly maxJobs: number;
  private readonly authorityTimeoutMs: number;
  private readonly now: () => number;
  private activeResolutions = 0;

  constructor(private readonly resolveSource: SourceResolver, options: {
    maxConcurrent?: number; maxJobs?: number; authorityTimeoutMs?: number; now?: () => number;
  } = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 2;
    this.maxJobs = options.maxJobs ?? 16;
    this.authorityTimeoutMs = options.authorityTimeoutMs ?? 5_000;
    this.now = options.now ?? Date.now;
    if (typeof resolveSource !== 'function' || !Number.isInteger(this.maxConcurrent) || this.maxConcurrent < 1 || this.maxConcurrent > 8 ||
      !Number.isInteger(this.maxJobs) || this.maxJobs < this.maxConcurrent || this.maxJobs > 64 ||
      !Number.isInteger(this.authorityTimeoutMs) || this.authorityTimeoutMs < 1 || this.authorityTimeoutMs > 5_000)
      throw new WorkerBoundaryError('WORKER_CONFIGURATION_INVALID');
  }
  private async serial<T>(run: () => Promise<T> | T): Promise<T> {
    const previous = this.serialTail;
    let release!: () => void;
    this.serialTail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await run(); } finally { release(); }
  }
  private record(address: JobAddress): RecordState | undefined {
    if (!uuid(address?.company_id) || typeof address.job_id !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(address.job_id)) return undefined;
    const record = this.records.get(address.job_id);
    return record?.job.company_id === address.company_id.toLowerCase() ? record : undefined;
  }
  private async source(address: SourceAddress, existing?: RecordState) {
    if (!uuid(address?.company_id) || !uuid(address.source_id) || typeof address.actor_id !== 'string' ||
      !address.actor_id.trim() || address.actor_id.length > 200) deny();
    if (this.activeResolutions >= this.maxConcurrent) deny();
    const controller = new AbortController();
    this.activeResolutions++;
    const resolving = Promise.resolve().then(() => this.resolveSource(address, controller.signal));
    void resolving.then(() => { this.activeResolutions--; }, () => { this.activeResolutions--; });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const source: ResolvedSource = await Promise.race([
        resolving,
        new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new WorkerBoundaryError('EXTRACTION_ACCESS_DENIED')); }, this.authorityTimeoutMs); }),
      ]);
      if (source.company_id?.toLowerCase() !== address.company_id.toLowerCase() || source.source_id?.toLowerCase() !== address.source_id.toLowerCase() ||
        source.can_extract !== true || source.document_id !== null || !uuid(source.revision) ||
        !(source.bytes instanceof Uint8Array) || source.bytes.byteLength > WORKER_MAX_SOURCE_BYTES) deny();
      const bytes = new Uint8Array(source.bytes);
      const evidence = createEvidence({ source_id: source.source_id.toLowerCase(), channel: source.channel,
        media_type: source.media_type, filename: source.filename, bytes });
      if (existing && (source.revision.toLowerCase() !== existing.source_revision || evidence.sha256 !== existing.job.sha256)) deny();
      return { source: Object.freeze({ company_id: address.company_id.toLowerCase(), evidence }), bytes, revision: source.revision.toLowerCase() };
    } catch { return deny(); }
    finally { clearTimeout(timer); }
  }
  private address(record: RecordState): SourceAddress {
    return { company_id: record.job.company_id, source_id: record.job.source_id, actor_id: record.actor_id };
  }
  async enqueue(input: EnqueueExtraction): Promise<ExtractionJob> {
    return this.serial(async () => {
      const verified = await this.source(input);
      const job = createExtractionJob({ ...verified.source, recipe: input.recipe, request_id: input.request_id, max_attempts: input.max_attempts });
      const existing = this.records.get(job.job_id);
      if (existing) {
        if (existing.actor_id !== input.actor_id || existing.source_revision !== verified.revision) deny();
        return existing.job;
      }
      if (this.records.size >= this.maxJobs) throw new WorkerBoundaryError('EXTRACTION_QUEUE_FULL');
      if ([...this.records.values()].some(record => record.job.company_id === job.company_id && record.job.source_id === job.source_id &&
        !['failed', 'cancelled', 'superseded'].includes(record.job.status))) throw new WorkerBoundaryError('EXTRACTION_SOURCE_JOB_EXISTS');
      this.records.set(job.job_id, { job, actor_id: input.actor_id, source_revision: verified.revision, lease: null });
      return job;
    });
  }
  /** Current source access is required even for a repeated read/cancel/supersede. */
  async read(address: JobAddress, actorId: string): Promise<ExtractionJob> {
    return this.serial(async () => {
      const record = this.record(address); if (!record) deny();
      await this.source({ ...this.address(record), actor_id: actorId }, record);
      return record.job;
    });
  }
  async claim(address: JobAddress, nowMs: number, leaseMs: number): Promise<ClaimResult> {
    safeClock(nowMs);
    if (!Number.isInteger(leaseMs) || leaseMs < 1 || leaseMs > WORKER_MAX_LEASE_MS) throw new WorkerBoundaryError('WORKER_LEASE_INVALID');
    return this.serial(async () => {
      const record = this.record(address); if (!record) return { kind: 'access_denied' };
      this.expire(record, nowMs);
      if (!['queued', 'retryable'].includes(record.job.status) || record.job.retry_at_ms !== null && nowMs < record.job.retry_at_ms)
        return { kind: 'not_runnable' };
      if (this.executions.size >= this.maxConcurrent) return { kind: 'busy' };
      let verified: Awaited<ReturnType<InProcessExtractionRepository['source']>>;
      try { verified = await this.source(this.address(record), record); } catch { return { kind: 'access_denied' }; }
      const startedAt = Math.max(nowMs, this.now()); safeClock(startedAt);
      const running = startAttempt(record.job, record.job.revision, startedAt);
      const id = randomUUID(), expires = startedAt + leaseMs, controller = new AbortController();
      record.job = running.job; record.lease = { id, expires, controller };
      this.executions.add(id);
      const lease = Object.freeze({ ...address, company_id: record.job.company_id,
        lease_id: id, expires_at_ms: expires, job: running.job, token: running.token,
        source: verified.source, bytes: verified.bytes, signal: controller.signal });
      this.issuedLeases.add(lease);
      return { kind: 'claimed', lease };
    });
  }
  private expire(record: RecordState, nowMs: number) {
    if (record.lease && nowMs >= record.lease.expires) {
      record.job = failAttempt(record.job, record.job.attempts.at(-1)!.token, { code: 'TIMEOUT' }, nowMs);
      record.lease.controller.abort(); record.lease = null;
      // Actual execution slot remains held until its transport confirms closure.
    }
  }
  private outcome(record: RecordState): WorkerOutcome {
    const last = record.job.attempts.at(-1)?.outcome;
    return { status: record.job.status, ...(last?.kind === 'failed' ? { failure_code: last.code } : {}) };
  }
  async recoverExpired(address: JobAddress, nowMs: number): Promise<WorkerOutcome> {
    safeClock(nowMs);
    return this.serial(() => {
      const record = this.record(address); if (!record) return { status: 'access_denied' };
      this.expire(record, nowMs);
      return this.outcome(record);
    });
  }
  async settle(lease: ExtractionLease, outcome: AttemptOutcome, nowMs: number): Promise<WorkerOutcome> {
    safeClock(nowMs);
    return this.serial(async () => {
      if (!this.issuedLeases.has(lease)) return { status: 'stale' };
      const record = this.record(lease);
      if (!record) return { status: 'stale' };
      this.expire(record, nowMs);
      if (record.lease?.id !== lease.lease_id || record.job.revision !== lease.token.started_revision ||
          record.job.attempts.at(-1)?.token !== lease.token) return record.job.status === 'running' ? { status: 'stale' } : this.outcome(record);
      let accepted = outcome;
      try { await this.source(this.address(record), record); }
      catch { accepted = { failure: { code: 'ACCESS_DENIED' } }; }
      const settledAt = Math.max(nowMs, this.now()); safeClock(settledAt);
      this.expire(record, settledAt);
      if (record.lease?.id !== lease.lease_id) return { status: record.job.status, failure_code: 'TIMEOUT' };
      record.job = 'result' in accepted ? completeAttempt(record.job, lease.token, accepted.result)
        : failAttempt(record.job, lease.token, accepted.failure, settledAt);
      record.lease = null;
      return { status: record.job.status, ...('failure' in accepted ? { failure_code: accepted.failure.code } : {}) };
    });
  }
  async releaseExecution(lease: ExtractionLease): Promise<void> {
    await this.serial(() => { if (this.issuedLeases.has(lease)) this.executions.delete(lease.lease_id); });
  }
  async cancel(address: JobAddress, actorId: string, expectedRevision: number): Promise<ExtractionJob> {
    return this.serial(async () => {
      const record = this.record(address); if (!record) deny();
      await this.source({ ...this.address(record), actor_id: actorId }, record);
      record.job = cancelJob(record.job, expectedRevision);
      record.lease?.controller.abort(); record.lease = null;
      return record.job;
    });
  }
  async supersede(address: JobAddress, actorId: string, expectedRevision: number, input: {
    recipe: ExtractionRecipe; request_id: string; max_attempts?: number;
  }): Promise<ExtractionJob> {
    return this.serial(async () => {
      const record = this.record(address); if (!record) deny();
      const verified = await this.source({ ...this.address(record), actor_id: actorId }, record);
      const replacement = createExtractionJob({ ...verified.source, ...input });
      if (this.records.has(replacement.job_id)) throw new WorkerBoundaryError('EXTRACTION_REQUEST_EXISTS');
      if (this.records.size >= this.maxJobs) throw new WorkerBoundaryError('EXTRACTION_QUEUE_FULL');
      record.job = supersedeJob(record.job, expectedRevision, replacement);
      record.lease?.controller.abort(); record.lease = null;
      this.records.set(replacement.job_id, { job: replacement, actor_id: actorId, source_revision: verified.revision, lease: null });
      return replacement;
    });
  }
}
