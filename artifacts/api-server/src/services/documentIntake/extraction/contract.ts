import { createHash } from 'node:crypto';
import { reviewCandidate } from '../candidate';
import { createTranscript, freeze, IntakeError, plainRecord, requireEvidence,
  type EvidenceDescriptor, type ExtractionProvider, type SourceTranscript, type TranscriptPage } from '../evidence';

export const MAX_ATTEMPTS = 5;
export const MAX_PROVIDER_RESULT_BYTES = 2 * 1024 * 1024;
export const MIN_RETRY_DELAY_MS = 1_000;
export const MAX_RETRY_DELAY_MS = 300_000;
export type ExtractionProviderOutput = Awaited<ReturnType<ExtractionProvider['extract']>>;
export interface ExtractionRecipe { readonly provider: string; readonly version: string }
/** Evidence must already be byte/hash verified. This does not establish company ownership. */
export interface ExtractionSource { readonly company_id: string; readonly evidence: EvidenceDescriptor }
export interface AdaptedExtractionResult {
  readonly company_id: string;
  readonly source_id: string;
  readonly sha256: string;
  readonly result_fingerprint: string;
  readonly transcript: SourceTranscript;
  readonly review: ReturnType<typeof reviewCandidate>;
}
export interface AttemptToken {
  readonly contract: 'document-intake.attempt.v1';
  readonly job_id: string;
  readonly company_id: string;
  readonly source_id: string;
  readonly sha256: string;
  readonly recipe_fingerprint: string;
  readonly attempt_id: string;
  readonly ordinal: number;
  readonly started_revision: number;
  readonly started_at_ms: number;
}
export type FailureCode = 'TIMEOUT' | 'RATE_LIMITED' | 'PROVIDER_UNAVAILABLE' |
  'UNSUPPORTED_DOCUMENT' | 'ENCRYPTED_DOCUMENT' | 'INVALID_RESPONSE' | 'ACCESS_DENIED';
export interface ExtractionFailure { readonly code: FailureCode; readonly retry_after_ms?: number }
type Outcome =
  | { readonly kind: 'review_required'; readonly fingerprint: string }
  | { readonly kind: 'failed'; readonly fingerprint: string; readonly code: FailureCode; readonly transient: boolean; readonly retry_after_ms: number | null }
  | { readonly kind: 'cancelled' | 'superseded' };
export interface ExtractionAttempt { readonly token: AttemptToken; readonly outcome: Outcome | null }
export type ExtractionStatus = 'queued' | 'running' | 'retryable' | 'review_required' | 'failed' | 'cancelled' | 'superseded';
export interface ExtractionJob {
  readonly contract: 'document-intake.extraction-job.v1';
  readonly job_id: string;
  readonly company_id: string;
  readonly source_id: string;
  readonly sha256: string;
  readonly recipe: ExtractionRecipe;
  readonly recipe_fingerprint: string;
  readonly request_id: string;
  readonly max_attempts: number;
  readonly revision: number;
  readonly status: ExtractionStatus;
  readonly attempts: readonly ExtractionAttempt[];
  readonly retry_at_ms: number | null;
  readonly result: AdaptedExtractionResult | null;
  readonly replacement_job_id: string | null;
}

// These pure objects are verified in-process, like evidence/transcripts. JSON
// round trips need a future persistence validator, not a cast to these types.
const jobs = new WeakSet<object>();
const results = new WeakSet<object>();
const uuid = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function fail(code: string): never { throw new IntakeError(code); }
const digest = (value: unknown) => `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
function record(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!plainRecord(value) || Object.keys(value).some(key => !keys.includes(key))) fail('EXTRACTION_INPUT_INVALID');
}
function requireSource(source: ExtractionSource) {
  record(source, ['company_id', 'evidence']);
  if (!uuid(source.company_id)) fail('EXTRACTION_COMPANY_INVALID');
  requireEvidence(source.evidence);
}
function checkedJob(job: ExtractionJob) {
  if (!job || !jobs.has(job)) fail('EXTRACTION_JOB_UNVERIFIED');
}
function snapshot(value: ExtractionJob): ExtractionJob {
  const result = freeze(value);
  jobs.add(result);
  return result;
}
function revision(job: ExtractionJob, expected: number) {
  checkedJob(job);
  if (!Number.isSafeInteger(expected) || expected !== job.revision) fail('EXTRACTION_REVISION_CONFLICT');
}
function clock(now: number) {
  if (!Number.isSafeInteger(now) || now < 0 || now > Number.MAX_SAFE_INTEGER - MAX_RETRY_DELAY_MS) fail('EXTRACTION_CLOCK_INVALID');
}

/** Bound and copy JSON before adapting it; accessors, cycles and non-JSON values never execute. */
function boundedJson(input: unknown): unknown {
  let nodes = 0, bytes = 0;
  const seen = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    if (++nodes > 30_000 || depth > 12) fail('EXTRACTION_RESULT_TOO_LARGE');
    if (typeof value === 'string') {
      bytes += Buffer.byteLength(value, 'utf8');
      if (bytes > MAX_PROVIDER_RESULT_BYTES) fail('EXTRACTION_RESULT_TOO_LARGE');
      return value;
    }
    if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value;
    if (typeof value !== 'object' || !value || seen.has(value)) fail('EXTRACTION_RESULT_INVALID');
    seen.add(value);
    try {
      if (Array.isArray(value)) {
        if (value.length > 1_000 || Object.keys(value).length !== value.length) fail('EXTRACTION_RESULT_INVALID');
        return Array.from({ length: value.length }, (_, i) => {
          const d = Object.getOwnPropertyDescriptor(value, String(i));
          if (!d || d.get || d.set) fail('EXTRACTION_RESULT_INVALID');
          return copy(d.value, depth + 1);
        });
      }
      if (!plainRecord(value)) fail('EXTRACTION_RESULT_INVALID');
      const keys = Object.keys(value).sort();
      if (keys.length > 1_000) fail('EXTRACTION_RESULT_INVALID');
      return Object.fromEntries(keys.map(key => {
        bytes += Buffer.byteLength(key, 'utf8');
        if (bytes > MAX_PROVIDER_RESULT_BYTES) fail('EXTRACTION_RESULT_TOO_LARGE');
        return [key, copy(value[key], depth + 1)];
      }));
    } finally { seen.delete(value); }
  };
  const copied = copy(input, 0);
  if (Buffer.byteLength(JSON.stringify(copied), 'utf8') > MAX_PROVIDER_RESULT_BYTES) fail('EXTRACTION_RESULT_TOO_LARGE');
  return copied;
}

/** Pure adapter. It checks evidence consistency, never OCR truth, authority or supplier/tax selection. */
export function adaptExtractionResult(source: ExtractionSource, output: unknown): AdaptedExtractionResult {
  requireSource(source);
  const payload = boundedJson(output);
  record(payload, ['pages', 'candidate']);
  if (!Object.hasOwn(payload, 'pages') || !Object.hasOwn(payload, 'candidate')) fail('EXTRACTION_RESULT_INVALID');
  const transcript = createTranscript(source.evidence, payload.pages as readonly TranscriptPage[]);
  const review = reviewCandidate(payload.candidate, source.evidence, transcript);
  const company_id = source.company_id.toLowerCase(), source_id = source.evidence.source_id.toLowerCase();
  const result = freeze({ company_id, source_id, sha256: source.evidence.sha256,
    result_fingerprint: digest({ contract: 'document-intake.extraction-result.v1', company_id,
      source_id, sha256: source.evidence.sha256, payload }), transcript, review });
  results.add(result);
  return result;
}

/** Identity is deterministic for one company/source/hash/recipe/request/policy. This does not authenticate ownership. */
export function createExtractionJob(input: ExtractionSource & {
  recipe: ExtractionRecipe; request_id: string; max_attempts?: number;
}): ExtractionJob {
  record(input, ['company_id', 'evidence', 'recipe', 'request_id', 'max_attempts']);
  requireSource({ company_id: input.company_id, evidence: input.evidence });
  if (!uuid(input.request_id)) fail('EXTRACTION_REQUEST_INVALID');
  record(input.recipe, ['provider', 'version']);
  for (const value of [input.recipe.provider, input.recipe.version]) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value)) fail('EXTRACTION_RECIPE_INVALID');
  }
  const recipe = { provider: input.recipe.provider, version: input.recipe.version };
  const max_attempts = input.max_attempts === undefined ? 3 : input.max_attempts;
  if (!Number.isInteger(max_attempts) || max_attempts < 1 || max_attempts > MAX_ATTEMPTS) fail('EXTRACTION_RETRY_LIMIT_INVALID');
  const identity = { contract: 'document-intake.extraction-job.v1' as const, company_id: input.company_id.toLowerCase(),
    source_id: input.evidence.source_id.toLowerCase(), sha256: input.evidence.sha256,
    recipe, request_id: input.request_id.toLowerCase(), max_attempts };
  return snapshot({ ...identity, job_id: digest(identity), recipe_fingerprint: digest(recipe), revision: 0,
    status: 'queued', attempts: [], retry_at_ms: null, result: null, replacement_job_id: null });
}

/** Caller must atomically compare-and-swap the returned revision before dispatching one future provider request. */
export function startAttempt(job: ExtractionJob, expectedRevision: number, nowMs: number) {
  revision(job, expectedRevision); clock(nowMs);
  if (!['queued', 'retryable'].includes(job.status) || job.attempts.length >= job.max_attempts) fail('EXTRACTION_NOT_RUNNABLE');
  if (job.retry_at_ms !== null && nowMs < job.retry_at_ms) fail('EXTRACTION_RETRY_NOT_DUE');
  const ordinal = job.attempts.length + 1;
  const token: AttemptToken = freeze({ contract: 'document-intake.attempt.v1', job_id: job.job_id,
    company_id: job.company_id, source_id: job.source_id, sha256: job.sha256, recipe_fingerprint: job.recipe_fingerprint,
    attempt_id: digest({ job_id: job.job_id, ordinal }), ordinal, started_revision: job.revision + 1, started_at_ms: nowMs });
  return { job: snapshot({ ...job, revision: job.revision + 1, status: 'running', retry_at_ms: null,
    attempts: [...job.attempts, { token, outcome: null }] }), token };
}

function attempt(job: ExtractionJob, token: AttemptToken) {
  checkedJob(job);
  record(token, ['contract', 'job_id', 'company_id', 'source_id', 'sha256', 'recipe_fingerprint', 'attempt_id', 'ordinal', 'started_revision', 'started_at_ms']);
  if (job.status === 'cancelled' || job.status === 'superseded') fail('EXTRACTION_TERMINAL');
  const existing = job.attempts.find(item => item.token.attempt_id === token.attempt_id);
  if (!existing || Object.keys(existing.token).some(key => existing.token[key as keyof AttemptToken] !== token[key])) fail('EXTRACTION_ATTEMPT_MISMATCH');
  return existing;
}
function finish(job: ExtractionJob, token: AttemptToken, outcome: Outcome, next: Partial<ExtractionJob>): ExtractionJob {
  const current = attempt(job, token);
  if (current.outcome) {
    if (digest(current.outcome) !== digest(outcome)) fail('EXTRACTION_OUTCOME_CONFLICT');
    return job; // Duplicate delivery cannot replace an accepted outcome or trigger a new attempt.
  }
  if (job.status !== 'running' || job.attempts.at(-1) !== current || job.revision !== token.started_revision) fail('EXTRACTION_ATTEMPT_STALE');
  return snapshot({ ...job, ...next, revision: job.revision + 1,
    attempts: job.attempts.map(item => item === current ? { token: item.token, outcome } : item) });
}

export function completeAttempt(job: ExtractionJob, token: AttemptToken, result: AdaptedExtractionResult): ExtractionJob {
  attempt(job, token);
  if (!result || !results.has(result)) fail('EXTRACTION_RESULT_UNVERIFIED');
  if (result.company_id !== job.company_id || result.source_id !== job.source_id || result.sha256 !== job.sha256) fail('EXTRACTION_RESULT_SOURCE_MISMATCH');
  return finish(job, token, { kind: 'review_required', fingerprint: result.result_fingerprint },
    { status: 'review_required', result, retry_at_ms: null });
}

export function failAttempt(job: ExtractionJob, token: AttemptToken, failure: ExtractionFailure, nowMs: number): ExtractionJob {
  attempt(job, token); clock(nowMs);
  if (nowMs < token.started_at_ms) fail('EXTRACTION_CLOCK_INVALID');
  record(failure, ['code', 'retry_after_ms']);
  const transient = ['TIMEOUT', 'RATE_LIMITED', 'PROVIDER_UNAVAILABLE'].includes(failure.code);
  if (!transient && !['UNSUPPORTED_DOCUMENT', 'ENCRYPTED_DOCUMENT', 'INVALID_RESPONSE', 'ACCESS_DENIED'].includes(failure.code)) fail('EXTRACTION_FAILURE_INVALID');
  if (failure.retry_after_ms !== undefined && typeof failure.retry_after_ms !== 'number') fail('EXTRACTION_RETRY_DELAY_INVALID');
  const delay = failure.retry_after_ms ?? (transient ? MIN_RETRY_DELAY_MS : null);
  if (transient ? !Number.isInteger(delay) || delay! < MIN_RETRY_DELAY_MS || delay! > MAX_RETRY_DELAY_MS : delay !== null) fail('EXTRACTION_RETRY_DELAY_INVALID');
  const outcome = { kind: 'failed' as const, fingerprint: digest({ code: failure.code, retry_after_ms: delay }),
    code: failure.code, transient, retry_after_ms: delay };
  const retry = transient && job.attempts.length < job.max_attempts;
  return finish(job, token, outcome, { status: retry ? 'retryable' : 'failed', retry_at_ms: retry ? nowMs + delay! : null, result: null });
}

function terminate(job: ExtractionJob, expectedRevision: number, status: 'cancelled' | 'superseded', replacement: string | null) {
  revision(job, expectedRevision);
  if (job.status === status && job.replacement_job_id === replacement) return job;
  if (job.status === 'cancelled' || job.status === 'superseded') fail('EXTRACTION_TERMINAL');
  return snapshot({ ...job, revision: job.revision + 1, status, retry_at_ms: null, result: null, replacement_job_id: replacement,
    attempts: job.attempts.map(item => item.outcome ? item : { token: item.token, outcome: { kind: status } }) });
}

export function cancelJob(job: ExtractionJob, expectedRevision: number): ExtractionJob {
  return terminate(job, expectedRevision, 'cancelled', null);
}

export function supersedeJob(job: ExtractionJob, expectedRevision: number, replacement: ExtractionJob): ExtractionJob {
  checkedJob(job); checkedJob(replacement);
  if (job.job_id === replacement.job_id || job.company_id !== replacement.company_id || job.source_id !== replacement.source_id ||
    job.sha256 !== replacement.sha256 || ['failed', 'cancelled', 'superseded'].includes(replacement.status)) fail('EXTRACTION_REPLACEMENT_INVALID');
  return terminate(job, expectedRevision, 'superseded', replacement.job_id);
}
