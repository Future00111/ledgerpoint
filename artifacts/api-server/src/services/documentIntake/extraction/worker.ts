import { checkDraftJson } from '../../financialDrafts/contract';
import { adaptExtractionResult, MAX_PROVIDER_RESULT_BYTES, type ExtractionFailure } from './contract';
import { WORKER_MAX_LEASE_MS, WorkerBoundaryError, recipeKey, safeClock,
  type AdapterExecution, type AttemptOutcome, type ExtractionTransport, type ExtractionWorkerRepository,
  type JobAddress, type WorkerOutcome } from './worker/types';

export { InProcessExtractionRepository } from './worker/referenceRepository';
export * from './worker/types';

/** Only configured adapter code may throw this bounded failure; arbitrary errors are redacted. */
export class TransportFailure extends Error {
  readonly failure: ExtractionFailure;
  constructor(code: ExtractionFailure['code'], retryAfterMs?: number) {
    super('EXTRACTION_TRANSPORT_FAILURE');
    const transient = ['TIMEOUT', 'RATE_LIMITED', 'PROVIDER_UNAVAILABLE'].includes(code);
    if (!transient && !['UNSUPPORTED_DOCUMENT', 'ENCRYPTED_DOCUMENT', 'INVALID_RESPONSE', 'ACCESS_DENIED'].includes(code) ||
        retryAfterMs !== undefined && (!transient || !Number.isInteger(retryAfterMs) || retryAfterMs < 1_000 || retryAfterMs > 300_000))
      throw new WorkerBoundaryError('WORKER_FAILURE_INVALID');
    this.failure = Object.freeze({ code, ...(retryAfterMs === undefined ? {} : { retry_after_ms: retryAfterMs }) });
  }
}
type Diagnostic = 'ATTEMPT_STARTED' | 'ATTEMPT_SETTLED' | 'ATTEMPT_FENCED' | 'ADAPTER_NOT_CONFIGURED' | 'TRANSPORT_CLOSE_UNCONFIRMED' | 'REPOSITORY_FAILED';

/** Size/depth bound BEFORE JSON parsing; duplicate-key checking reuses the financial JSON boundary. */
function parseOutput(bytes: Uint8Array): unknown {
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  let depth = 0, quoted = false, escaped = false;
  for (const char of raw) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '[' || char === '{') { if (++depth > 12) throw new WorkerBoundaryError('WORKER_OUTPUT_INVALID'); }
    else if (char === ']' || char === '}') depth--;
  }
  checkDraftJson(raw);
  return JSON.parse(raw);
}

/**
 * Runs trusted transports only. This is not an OS sandbox or a parser host.
 * Upstream transports must enforce their own allocation/process/network limits.
 * Logical deadlines fence results; actual capacity remains held until closure.
 */
export function createExtractionWorker(options: {
  repository: ExtractionWorkerRepository; transports?: readonly ExtractionTransport[];
  leaseMs?: number; maxOutputBytes?: number; maxPages?: number; now?: () => number;
  diagnostic?: (code: Diagnostic) => void;
}) {
  const leaseMs = options.leaseMs ?? 30_000, maxOutputBytes = options.maxOutputBytes ?? MAX_PROVIDER_RESULT_BYTES;
  const maxPages = options.maxPages ?? 200, now = options.now ?? Date.now;
  if (!Number.isInteger(leaseMs) || leaseMs < 1 || leaseMs > WORKER_MAX_LEASE_MS ||
      !Number.isInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > MAX_PROVIDER_RESULT_BYTES ||
      !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 200) throw new WorkerBoundaryError('WORKER_CONFIGURATION_INVALID');
  const transports = new Map<string, ExtractionTransport>();
  for (const transport of options.transports ?? []) {
    if (!transport?.recipe || typeof transport.start !== 'function') throw new WorkerBoundaryError('WORKER_CONFIGURATION_INVALID');
    const key = recipeKey(transport.recipe);
    if (transports.has(key)) throw new WorkerBoundaryError('WORKER_DUPLICATE_ADAPTER');
    transports.set(key, transport);
  }
  const diagnostic = (code: Diagnostic) => { try { options.diagnostic?.(code); } catch { /* Diagnostics never change job outcomes. */ } };
  return {
    async run(address: JobAddress): Promise<WorkerOutcome> {
      const currentTime = now(); safeClock(currentTime);
      let claim;
      try { claim = await options.repository.claim(address, currentTime, leaseMs); }
      catch { diagnostic('REPOSITORY_FAILED'); return { status: 'repository_failed' }; }
      if (claim.kind !== 'claimed') return { status: claim.kind };
      const { lease } = claim;
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let abortListener: (() => void) | undefined;
      let physicallyClosed: Promise<boolean> = Promise.resolve(true);
      let timeoutOccurred = false;
      const boundary = new Promise<AttemptOutcome>(resolve => {
        abortListener = () => { controller.abort(); resolve({ failure: { code: 'ACCESS_DENIED' } }); };
        lease.signal.addEventListener('abort', abortListener, { once: true });
        timeout = setTimeout(() => {
          timeoutOccurred = true; controller.abort(); resolve({ failure: { code: 'TIMEOUT' } });
        }, Math.max(0, lease.expires_at_ms - now()));
        if (lease.signal.aborted) abortListener();
      });
      diagnostic('ATTEMPT_STARTED');
      const work: Promise<AttemptOutcome> = Promise.resolve().then(async () => {
        if (controller.signal.aborted) return { failure: { code: 'ACCESS_DENIED' } };
        const transport = transports.get(recipeKey(lease.job.recipe));
        if (!transport) { diagnostic('ADAPTER_NOT_CONFIGURED'); return { failure: { code: 'ACCESS_DENIED' } }; }
        let execution: AdapterExecution;
        try {
          execution = await transport.start({ source: lease.source, bytes: new Uint8Array(lease.bytes),
            recipe: lease.job.recipe, attempt: lease.token }, controller.signal);
        } catch (error) {
          return { failure: error instanceof TransportFailure ? error.failure : { code: 'PROVIDER_UNAVAILABLE' } };
        }
        // Rejected/unconfirmed closure retains the slot, even after a logical failure.
        if (!execution || !(execution.closed instanceof Promise) || !execution.output ||
            typeof execution.output[Symbol.asyncIterator] !== 'function') {
          physicallyClosed = Promise.resolve(false);
          controller.abort();
          return { failure: { code: 'INVALID_RESPONSE' } };
        }
        physicallyClosed = execution.closed.then(() => true, () => false);
        try {
          const chunks: Uint8Array[] = []; let total = 0, count = 0;
          for await (const chunk of execution.output) {
            if (controller.signal.aborted) throw new WorkerBoundaryError('WORKER_ABORTED');
            if (!(chunk instanceof Uint8Array) || ++count > 4_096 || chunk.byteLength === 0 ||
                (total += chunk.byteLength) > maxOutputBytes) throw new WorkerBoundaryError('WORKER_OUTPUT_INVALID');
            chunks.push(new Uint8Array(chunk));
          }
          if (controller.signal.aborted) throw new WorkerBoundaryError('WORKER_ABORTED');
          const payload = parseOutput(Buffer.concat(chunks, total));
          const result = adaptExtractionResult(lease.source, payload);
          if (result.transcript.pages.length > maxPages) throw new WorkerBoundaryError('WORKER_OUTPUT_INVALID');
          return { result };
        } catch (error) {
          controller.abort();
          return { failure: error instanceof TransportFailure ? error.failure : { code: 'INVALID_RESPONSE' } };
        }
      });
      // Do not await physical closure in the user-facing logical outcome. An
      // adapter that ignores abort keeps this shared execution slot occupied.
      void work.then(async () => {
        if (await physicallyClosed) await options.repository.releaseExecution(lease);
        else diagnostic('TRANSPORT_CLOSE_UNCONFIRMED');
      }).catch(() => diagnostic('REPOSITORY_FAILED'));
      try {
        const outcome = await Promise.race([work, boundary]);
        const settledAt = Math.max(now(), timeoutOccurred ? lease.expires_at_ms : lease.token.started_at_ms);
        const result = await options.repository.settle(lease, outcome, settledAt);
        diagnostic(['cancelled', 'superseded', 'stale'].includes(result.status) ? 'ATTEMPT_FENCED' : 'ATTEMPT_SETTLED');
        return result;
      } catch {
        diagnostic('REPOSITORY_FAILED'); return { status: 'repository_failed' };
      } finally {
        clearTimeout(timeout);
        if (abortListener) lease.signal.removeEventListener('abort', abortListener);
      }
    },
  };
}
