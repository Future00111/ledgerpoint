import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { adaptExtractionResult } from './contract';
import { createExtractionWorker, InProcessExtractionRepository, TransportFailure, WORKER_MAX_SOURCE_BYTES,
  type AdapterExecution, type ExtractionTransport, type JobAddress, type ResolvedSource, type SourceAddress } from './worker';
import { syntheticOutput, syntheticSource } from './worker/fixtures';

const recipe = { provider: 'synthetic-fixture', version: 'v1' };
const actor = 'synthetic-owner';
function deferred<T>() { let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const address = (job: { company_id: string; job_id: string }): JobAddress => ({ company_id: job.company_id, job_id: job.job_id });
const input = (source: ResolvedSource, request_id = randomUUID()) => ({ company_id: source.company_id, source_id: source.source_id, actor_id: actor, recipe, request_id });
function harness(options: { maxConcurrent?: number; maxJobs?: number; authorityTimeoutMs?: number } = {}) {
  const sources = new Map<string, ResolvedSource>(); const clock = { value: 1_000 };
  const resolve = async (requested: SourceAddress) => {
    const row = sources.get(requested.source_id);
    if (!row || row.company_id !== requested.company_id || requested.actor_id !== actor) throw Error('secret database details');
    return row;
  };
  const repository = new InProcessExtractionRepository(resolve, { ...options, now: () => clock.value });
  const add = () => { const source = syntheticSource(); sources.set(source.source_id, source); return source; };
  return { repository, clock, sources, add, resolve };
}
function transport(output: unknown, closed = Promise.resolve(), startHook?: () => void): ExtractionTransport {
  return { recipe, async start() {
    startHook?.();
    return { closed, output: (async function* () { const bytes = Buffer.from(JSON.stringify(output));
      yield bytes.subarray(0, 23); yield bytes.subarray(23); })() };
  } };
}
const worker = (h: ReturnType<typeof harness>, transports: ExtractionTransport[], extra = {}) => createExtractionWorker({
  repository: h.repository, transports, now: () => h.clock.value, leaseMs: 10_000, ...extra,
});

test('worker verifies source and adapts bounded cited output into review only, with immutable originals', async () => {
  const h = harness(), source = h.add(), before = Buffer.from(source.bytes), job = await h.repository.enqueue(input(source));
  const events: string[] = [];
  const w = worker(h, [transport(syntheticOutput(source))], { diagnostic: (code: string) => events.push(code) });
  assert.equal((await w.run(address(job))).status, 'review_required');
  const saved = await h.repository.read(address(job), actor);
  assert.equal(saved.result?.review.has_errors, false); assert.equal(saved.result?.review.can_post, false);
  assert.equal(saved.result?.review.requires_review, true); assert.ok(Object.isFrozen(saved.result));
  assert.deepEqual(source.bytes, before); assert.equal(source.document_id, null);
  assert.deepEqual(events, ['ATTEMPT_STARTED', 'ATTEMPT_SETTLED']);
  assert.equal((await w.run(address(job))).status, 'not_runnable');
});

test('enqueue is actor-bound/idempotent, prevents competing source requests, and requires current authority', async () => {
  const h = harness(), source = h.add(), data = input(source), job = await h.repository.enqueue(data);
  assert.equal(await h.repository.enqueue(data), job);
  await assert.rejects(h.repository.enqueue(input(source)), { code: 'EXTRACTION_SOURCE_JOB_EXISTS' });
  await assert.rejects(h.repository.enqueue({ ...data, actor_id: 'different-user' }), { code: 'EXTRACTION_ACCESS_DENIED' });
  await assert.rejects(h.repository.read({ ...address(job), company_id: randomUUID() }, actor), { code: 'EXTRACTION_ACCESS_DENIED' });
  assert.equal((await worker(h, []).run({ ...address(job), company_id: randomUUID() })).status, 'access_denied');
  h.sources.set(source.source_id, { ...source, can_extract: false });
  await assert.rejects(h.repository.enqueue(data), { code: 'EXTRACTION_ACCESS_DENIED' });
  assert.equal((await worker(h, []).run(address(job))).status, 'access_denied');
});

test('source size, media, tenant, hash, revision and linked-document changes fail before dispatch', async () => {
  for (const changes of [
    { bytes: Buffer.alloc(WORKER_MAX_SOURCE_BYTES + 1) }, { bytes: Buffer.from('malformed') },
    { bytes: Buffer.from('%PDF-changed bytes') }, { revision: randomUUID() }, { document_id: randomUUID() },
  ]) {
    const h = harness(), source = h.add(), job = await h.repository.enqueue(input(source)); let calls = 0;
    h.sources.set(source.source_id, { ...source, ...changes });
    assert.equal((await worker(h, [transport(syntheticOutput(source), undefined, () => calls++)]).run(address(job))).status, 'access_denied');
    assert.equal(calls, 0);
  }
  const source = syntheticSource();
  const wrongTenant = new InProcessExtractionRepository(async () => ({ ...source, company_id: randomUUID() }));
  await assert.rejects(wrongTenant.enqueue(input(source)), { code: 'EXTRACTION_ACCESS_DENIED' });
});

test('two workers race one job but dispatch exactly once', async () => {
  const h = harness(), source = h.add(), job = await h.repository.enqueue(input(source)); let calls = 0;
  const outputGate = deferred<void>(), started = deferred<void>();
  const adapter: ExtractionTransport = { recipe, async start() { calls++; started.resolve();
    return { closed: outputGate.promise, output: (async function* () { await outputGate.promise; yield Buffer.from(JSON.stringify(syntheticOutput(source))); })() }; } };
  const first = worker(h, [adapter]).run(address(job)); await started.promise;
  assert.equal((await worker(h, [adapter]).run(address(job))).status, 'not_runnable');
  outputGate.resolve(); assert.equal((await first).status, 'review_required'); assert.equal(calls, 1);
});

test('shared repository limits concurrent executions across multiple workers and different sources', async () => {
  const h = harness({ maxConcurrent: 1 }), source = h.add(), secondSource = h.add();
  const firstJob = await h.repository.enqueue(input(source)), secondJob = await h.repository.enqueue(input(secondSource));
  const gate = deferred<void>(), started = deferred<void>(); let calls = 0;
  const adapter: ExtractionTransport = { recipe, async start(request) { calls++; started.resolve();
    return { closed: gate.promise, output: (async function* () { await gate.promise;
      yield Buffer.from(JSON.stringify(syntheticOutput(h.sources.get(request.source.evidence.source_id)!))); })() }; } };
  const first = worker(h, [adapter]).run(address(firstJob)); await started.promise;
  assert.equal((await worker(h, [adapter]).run(address(secondJob))).status, 'busy'); assert.equal(calls, 1);
  gate.resolve(); assert.equal((await first).status, 'review_required'); await flush();
  assert.equal((await worker(h, [adapter]).run(address(secondJob))).status, 'review_required'); assert.equal(calls, 2);
});

test('timeout fences an uncooperative adapter and retains actual capacity until transport closure', async () => {
  const h = harness({ maxConcurrent: 1 }), source = h.add(), secondSource = h.add();
  const job = await h.repository.enqueue(input(source)), second = await h.repository.enqueue(input(secondSource));
  const outputGate = deferred<void>(), closed = deferred<void>(); let calls = 0;
  const adapter: ExtractionTransport = { recipe, async start() { calls++;
    return { closed: closed.promise, output: (async function* () { await outputGate.promise;
      yield Buffer.from(JSON.stringify(syntheticOutput(source))); })() }; } };
  const timed = await worker(h, [adapter], { leaseMs: 15 }).run(address(job));
  assert.deepEqual(timed, { status: 'retryable', failure_code: 'TIMEOUT' });
  assert.equal((await h.repository.read(address(job), actor)).attempts[0]?.outcome?.kind, 'failed');
  h.clock.value += 2_000;
  assert.equal((await worker(h, [adapter]).run(address(job))).status, 'busy');
  assert.equal((await worker(h, [adapter]).run(address(second))).status, 'busy'); assert.equal(calls, 1);
  outputGate.resolve(); await flush();
  assert.equal((await worker(h, [adapter]).run(address(second))).status, 'busy');
  closed.resolve(); await flush(); await flush();
  assert.equal((await h.repository.read(address(job), actor)).result, null);
  assert.equal((await worker(h, [transport(syntheticOutput(source))]).run(address(job))).status, 'review_required');
  assert.equal((await h.repository.read(address(job), actor)).attempts.length, 2);
});

test('cancel and supersede signal abort and late output cannot replace current state', async () => {
  for (const operation of ['cancel', 'supersede'] as const) {
    const h = harness({ maxConcurrent: 1 }), source = h.add(), job = await h.repository.enqueue(input(source));
    const gate = deferred<void>(), started = deferred<void>(); let signal: AbortSignal | undefined;
    const adapter: ExtractionTransport = { recipe, async start(_request, providedSignal) { signal = providedSignal; started.resolve();
      return { closed: gate.promise, output: (async function* () { await gate.promise; yield Buffer.from(JSON.stringify(syntheticOutput(source))); })() }; } };
    const running = worker(h, [adapter]).run(address(job)); await started.promise;
    const current = await h.repository.read(address(job), actor);
    let replacement;
    if (operation === 'cancel') await h.repository.cancel(address(job), actor, current.revision);
    else replacement = await h.repository.supersede(address(job), actor, current.revision, { recipe, request_id: randomUUID() });
    assert.equal((await running).status, operation === 'cancel' ? 'cancelled' : 'superseded');
    assert.equal(signal?.aborted, true);
    gate.resolve(); await flush(); await flush();
    assert.equal((await h.repository.read(address(job), actor)).result, null);
    if (replacement) assert.equal((await worker(h, [transport(syntheticOutput(source))]).run(address(replacement))).status, 'review_required');
  }
});

test('expired abandoned leases are recoverable but cannot release execution slots or accept stale completion', async () => {
  const h = harness({ maxConcurrent: 1 }), source = h.add(), job = await h.repository.enqueue(input(source));
  const claim = await h.repository.claim(address(job), h.clock.value, 100); assert.equal(claim.kind, 'claimed');
  if (claim.kind !== 'claimed') return;
  const result = adaptExtractionResult(claim.lease.source, syntheticOutput(source));
  h.clock.value += 100;
  assert.equal((await h.repository.recoverExpired(address(job), h.clock.value)).status, 'retryable');
  h.clock.value += 1_000;
  assert.equal((await h.repository.claim(address(job), h.clock.value, 100)).kind, 'busy');
  await h.repository.releaseExecution({ ...claim.lease }); // Forged copy cannot free the actual slot.
  assert.equal((await h.repository.claim(address(job), h.clock.value, 100)).kind, 'busy');
  await h.repository.releaseExecution(claim.lease); // Test host confirms the abandoned execution was stopped.
  const second = await h.repository.claim(address(job), h.clock.value, 100); assert.equal(second.kind, 'claimed');
  assert.equal((await h.repository.settle(claim.lease, { result }, h.clock.value)).status, 'stale');
  if (second.kind === 'claimed') { await h.repository.cancel(address(job), actor, second.lease.job.revision); await h.repository.releaseExecution(second.lease); }
});

test('revoked access, changed evidence or converted source at outcome time cannot retain an extraction result', async () => {
  for (const changes of [{ can_extract: false }, { bytes: Buffer.from('%PDF-modified') }, { document_id: randomUUID() }]) {
    const h = harness(), source = h.add(), job = await h.repository.enqueue(input(source));
    const gate = deferred<void>(), started = deferred<void>();
    const adapter: ExtractionTransport = { recipe, async start() { started.resolve();
      return { closed: gate.promise, output: (async function* () { await gate.promise; yield Buffer.from(JSON.stringify(syntheticOutput(source))); })() }; } };
    const running = worker(h, [adapter]).run(address(job)); await started.promise;
    h.sources.set(source.source_id, { ...source, ...changes }); gate.resolve();
    assert.deepEqual(await running, { status: 'failed', failure_code: 'ACCESS_DENIED' });
    h.sources.set(source.source_id, source);
    assert.equal((await h.repository.read(address(job), actor)).result, null);
  }
});

test('lease expiry during the final authority check rejects a previously timely result', async () => {
  const source = syntheticSource(); let clock = 1_000, calls = 0;
  const repository = new InProcessExtractionRepository(async () => { if (++calls === 3) clock += 200; return source; }, { now: () => clock });
  const job = await repository.enqueue(input(source));
  const w = createExtractionWorker({ repository, transports: [transport(syntheticOutput(source))], leaseMs: 100, now: () => clock });
  assert.deepEqual(await w.run(address(job)), { status: 'retryable', failure_code: 'TIMEOUT' });
  assert.equal((await repository.read(address(job), actor)).result, null);
});

test('transient failures use bounded retry deadlines/budgets; raw failures never leak diagnostics', async () => {
  const h = harness(), source = h.add(), job = await h.repository.enqueue({ ...input(source), max_attempts: 2 });
  let calls = 0; const diagnostics: string[] = [];
  const adapter: ExtractionTransport = { recipe, async start() { calls++; throw new Error('secret provider token and private document text'); } };
  const w = worker(h, [adapter], { diagnostic: (code: string) => diagnostics.push(code) });
  assert.deepEqual(await w.run(address(job)), { status: 'retryable', failure_code: 'PROVIDER_UNAVAILABLE' });
  assert.equal((await w.run(address(job))).status, 'not_runnable');
  h.clock.value += 1_000;
  assert.deepEqual(await w.run(address(job)), { status: 'failed', failure_code: 'PROVIDER_UNAVAILABLE' });
  assert.equal((await w.run(address(job))).status, 'not_runnable'); assert.equal(calls, 2);
  assert.equal(JSON.stringify(await h.repository.read(address(job), actor)).includes('secret'), false);
  assert.equal(JSON.stringify(diagnostics).includes('secret'), false);
  assert.throws(() => new TransportFailure('RATE_LIMITED', 999), { code: 'WORKER_FAILURE_INVALID' });
});

test('permanent unsupported/encrypted failures do not retry and missing adapters fail closed', async () => {
  for (const code of ['UNSUPPORTED_DOCUMENT', 'ENCRYPTED_DOCUMENT', 'ACCESS_DENIED'] as const) {
    const h = harness(), source = h.add(), job = await h.repository.enqueue(input(source));
    const adapter: ExtractionTransport = { recipe, async start() { throw new TransportFailure(code); } };
    assert.deepEqual(await worker(h, [adapter]).run(address(job)), { status: 'failed', failure_code: code });
  }
  const h = harness(), source = h.add(), job = await h.repository.enqueue(input(source));
  assert.deepEqual(await worker(h, []).run(address(job)), { status: 'failed', failure_code: 'ACCESS_DENIED' });
});

test('output rejects oversized bytes, excessive chunks/pages, duplicate keys, deep JSON and invalid UTF-8', async () => {
  const invalids = [Buffer.from('{"pages":[],"pages":[],"candidate":{}}'), Buffer.from('['.repeat(13) + ']'.repeat(13)),
    Buffer.from([0xff]), Buffer.from('not JSON'), Buffer.alloc(65, 32)];
  for (const bytes of invalids) {
    const h = harness(), source = h.add(), job = await h.repository.enqueue(input(source));
    const adapter: ExtractionTransport = { recipe, async start() { return { closed: Promise.resolve(), output: (async function* () { yield bytes; })() }; } };
    assert.deepEqual(await worker(h, [adapter], { maxOutputBytes: 64 }).run(address(job)), { status: 'failed', failure_code: 'INVALID_RESPONSE' });
  }
  for (const mode of ['chunks', 'pages']) {
    const h = harness(), source = h.add(), job = await h.repository.enqueue(input(source));
    const adapter: ExtractionTransport = { recipe, async start() { return { closed: Promise.resolve(), output: (async function* () {
      if (mode === 'chunks') for (let i = 0; i < 4_097; i++) yield Buffer.from(' ');
      else yield Buffer.from(JSON.stringify({ pages: [{ page: 1, text: 'one' }, { page: 2, text: 'two' }], candidate: null }));
    })() }; } };
    assert.equal((await worker(h, [adapter], { maxPages: 1 }).run(address(job))).failure_code, 'INVALID_RESPONSE');
  }
});

test('transport byte mutation cannot rewrite source evidence and malformed candidate stays an explicit review issue', async () => {
  const h = harness(), source = h.add(), before = Buffer.from(source.bytes), job = await h.repository.enqueue(input(source));
  const adapter: ExtractionTransport = { recipe, async start(request) { request.bytes.fill(0);
    return { closed: Promise.resolve(), output: (async function* () { yield Buffer.from(JSON.stringify({ pages: [{ page: 1, text: 'Synthetic' }], candidate: null })); })() }; } };
  assert.equal((await worker(h, [adapter]).run(address(job))).status, 'review_required');
  const saved = await h.repository.read(address(job), actor);
  assert.equal(saved.result?.review.has_errors, true); assert.equal(saved.result?.review.can_post, false);
  assert.deepEqual(source.bytes, before);
});

test('unconfirmed transport closure retains capacity even when its output has completed', async () => {
  const h = harness({ maxConcurrent: 1 }), source = h.add(), secondSource = h.add();
  const job = await h.repository.enqueue(input(source)), second = await h.repository.enqueue(input(secondSource));
  const diagnostics: string[] = [];
  const w = worker(h, [transport(syntheticOutput(source), Promise.reject(new Error('private shutdown details')))], { diagnostic: (code: string) => diagnostics.push(code) });
  assert.equal((await w.run(address(job))).status, 'review_required'); await flush();
  assert.equal((await w.run(address(second))).status, 'busy');
  assert.ok(diagnostics.includes('TRANSPORT_CLOSE_UNCONFIRMED')); assert.equal(diagnostics.join(' ').includes('private'), false);
});

test('a hung authority adapter is bounded and cannot accumulate unlimited orphan resolutions', async () => {
  const source = syntheticSource(), gate = deferred<ResolvedSource>(); let calls = 0;
  const repository = new InProcessExtractionRepository(async () => { calls++; return gate.promise; }, { maxConcurrent: 1, authorityTimeoutMs: 10 });
  await assert.rejects(repository.enqueue(input(source)), { code: 'EXTRACTION_ACCESS_DENIED' });
  await assert.rejects(repository.enqueue(input(source)), { code: 'EXTRACTION_ACCESS_DENIED' });
  assert.equal(calls, 1); gate.resolve(source); await flush();
});

test('queue and settings limits fail explicitly; external repository errors return only bounded status', async () => {
  const h = harness({ maxConcurrent: 1, maxJobs: 1 }), source = h.add(); await h.repository.enqueue(input(source));
  await assert.rejects(h.repository.enqueue(input(h.add())), { code: 'EXTRACTION_QUEUE_FULL' });
  assert.throws(() => new InProcessExtractionRepository(h.resolve, { maxConcurrent: 9 }), { code: 'WORKER_CONFIGURATION_INVALID' });
  assert.throws(() => worker(h, [], { maxPages: 201 }), { code: 'WORKER_CONFIGURATION_INVALID' });
  const broken = createExtractionWorker({ repository: { async claim() { throw Error('private database password'); }, async settle() { throw Error('never'); }, async releaseExecution() {} } });
  assert.deepEqual(await broken.run({ company_id: source.company_id, job_id: 'sha256:' + 'a'.repeat(64) }), { status: 'repository_failed' });
});
