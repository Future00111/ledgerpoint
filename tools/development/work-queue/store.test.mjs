import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir, hostname } from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { createQueueStore, atomicWriteJSON, readJSON } from './store.mjs';
import { main, resolveRepositoryPaths } from './cli.mjs';

function validateState(state) {
  assert.equal(state.version, 1);
  assert.ok(state.tasks && typeof state.tasks === 'object');
  assert.ok(Array.isArray(state.events));
}
const initialState = () => ({ version: 1, revision: 0, tasks: {}, events: [] });
const fixture = t => {
  const root = mkdtempSync(path.join(tmpdir(), 'ledgerly-queue-store-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'shared');
  return { root, directory, store: createQueueStore({ directory, validateState }) };
};
const changed = state => ({ state: { ...state, revision: state.revision + 1, events: [...state.events, { type: 'test-change' }] }, claim: null });
const code = value => error => error.code === value;
function child(script, args, cwd) {
  return new Promise((resolve, reject) => {
    const process = spawn(globalThis.process.execPath, [script, ...args], { cwd, env: { PATH: globalThis.process.env.PATH }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', errors = '';
    process.stdout.on('data', chunk => { output += chunk; });
    process.stderr.on('data', chunk => { errors += chunk; });
    process.on('error', reject);
    process.on('exit', exit => exit === 0 ? resolve(output) : reject(new Error(`Synthetic child failed (${exit}): ${errors}`)));
  });
}

test('read-only inspection does not create runtime state or locks', t => {
  const { directory, store } = fixture(t);
  assert.equal(store.readOptional(), null); assert.equal(store.lockInfo(), null);
  assert.equal(existsSync(directory), false);
});

test('initialisation restores a checkpoint but never overwrites existing runtime', async t => {
  const { root, store } = fixture(t), checkpoint = path.join(root, 'work-state.json');
  const saved = { ...initialState(), revision: 8, events: [{ type: 'checkpoint' }] };
  atomicWriteJSON(checkpoint, saved);
  const first = await store.initialize({ initialState, checkpointPath: checkpoint });
  assert.equal(first.restored, true); assert.equal(first.state.revision, 8);
  atomicWriteJSON(checkpoint, { ...saved, revision: 99 });
  const second = await store.initialize({ initialState, checkpointPath: checkpoint });
  assert.equal(second.initialized, false); assert.equal(second.state.revision, 8);
  const restarted = createQueueStore({ directory: path.dirname(store.stateFile), validateState });
  assert.deepEqual(restarted.read(), saved);
});

test('state revision CAS and atomic checkpoint export preserve newer work', async t => {
  const { root, store } = fixture(t), checkpoint = path.join(root, 'work-state.json');
  await store.initialize({ initialState });
  await store.exportCheckpoint(checkpoint, { expectedRevision: 0 });
  await store.mutate({ expectedRevision: 0, reduce: changed });
  await assert.rejects(store.mutate({ expectedRevision: 0, reduce: changed }), code('REVISION_CONFLICT'));
  await assert.rejects(store.exportCheckpoint(checkpoint, { expectedRevision: 0 }), code('REVISION_CONFLICT'));
  assert.equal(readJSON(checkpoint).revision, 0);
  await assert.rejects(store.exportCheckpoint(checkpoint, {}), code('REVISION_REQUIRED'));
  await store.exportCheckpoint(checkpoint, { expectedRevision: 1 });
  assert.equal(readJSON(checkpoint).revision, 1);
});

test('revision cannot be skipped or changed without an increment; true no-op is allowed', async t => {
  const { store } = fixture(t);
  await store.initialize({ initialState });
  await assert.rejects(store.mutate({ reduce: state => ({ state: { ...state, revision: 2 } }) }), code('INVALID_TRANSITION'));
  await assert.rejects(store.mutate({ reduce: state => ({ state: { ...state, events: [{}] } }) }), code('INVALID_TRANSITION'));
  const noChange = await store.mutate({ reduce: state => ({ state, claim: null }) });
  assert.equal(noChange.state.revision, 0);
  assert.equal(store.lockInfo(), null);
});

test('corrupt state, wrong schema and broken symlinks fail closed instead of reinitialising', async t => {
  const { root, store } = fixture(t);
  await store.initialize({ initialState });
  writeFileSync(store.stateFile, '{broken');
  await assert.rejects(store.initialize({ initialState }), code('INVALID_STATE'));
  assert.equal(readFileSync(store.stateFile, 'utf8'), '{broken');
  atomicWriteJSON(store.stateFile, { version: 2, revision: 0, tasks: {}, events: [] });
  assert.throws(() => store.read());
  rmSync(store.stateFile); symlinkSync(path.join(root, 'missing'), store.stateFile);
  assert.throws(() => store.readOptional(), code('UNSAFE_PATH'));
  await assert.rejects(store.initialize({ initialState }), code('UNSAFE_PATH'));
});

test('parallel processes share one atomic queue: no double claims or overlapping files', async t => {
  const { root, directory, store } = fixture(t);
  const state = initialState();
  state.tasks = { first: { status: 'queued', files: ['shared.ts'] }, conflicting: { status: 'queued', files: ['shared.ts'] }, independent: { status: 'queued', files: ['other.ts'] } };
  await store.initialize({ initialState: () => state });
  const script = path.join(root, 'claim.mjs');
  writeFileSync(script, `import {createQueueStore} from ${JSON.stringify(new URL('./store.mjs', import.meta.url).href)};
const store=createQueueStore({directory:process.argv[2],validateState:s=>{if(s.version!==1||!s.tasks||!Array.isArray(s.events))throw Error('invalid');}});
for(let attempt=0;attempt<100;attempt++) {
 try {
  const result=await store.mutate({reduce:async state=>{
   await new Promise(resolve=>setTimeout(resolve,8));
   const held=Object.values(state.tasks).filter(t=>t.status==='running').flatMap(t=>t.files);
   const entry=Object.entries(state.tasks).find(([,t])=>t.status==='queued'&&!t.files.some(f=>held.includes(f)));
   if(!entry)return {state,claim:null};
   const [id,task]=entry;task.status='running';task.owner=process.argv[3];state.revision++;state.events.push({type:'claim',id,owner:process.argv[3]});
   return {state,claim:id};
  }});console.log(JSON.stringify({claim:result.claim}));break;
 }catch(error){if(error.code!=='QUEUE_LOCKED'||attempt===99)throw error;await new Promise(resolve=>setTimeout(resolve,8));}
}
`);
  const outputs = await Promise.all(Array.from({ length: 6 }, (_, index) => child(script, [directory, `worker-${index}`], root)));
  const claims = outputs.map(output => JSON.parse(output).claim).filter(Boolean);
  assert.deepEqual(claims.sort(), ['first', 'independent']);
  const final = store.read();
  assert.equal(final.revision, 2); assert.equal(final.events.length, 2);
  assert.equal(final.tasks.conflicting.status, 'queued');
  assert.equal(new Set(final.events.map(event => event.owner)).size, 2);
});

test('a crashed process leaves a lock requiring explicit token-matched dead-owner recovery', async t => {
  const { root, directory, store } = fixture(t);
  await store.initialize({ initialState });
  const script = path.join(root, 'crash.mjs');
  writeFileSync(script, `import {createQueueStore} from ${JSON.stringify(new URL('./store.mjs', import.meta.url).href)};
const store=createQueueStore({directory:process.argv[2],validateState:s=>{}});
await store.mutate({reduce:state=>process.exit(0)});`);
  await child(script, [directory], root);
  const owner = store.lockInfo();
  assert.equal(owner.host, hostname()); assert.ok(owner.pid > 0);
  await assert.rejects(store.mutate({ reduce: changed }), code('QUEUE_LOCKED'));
  await assert.rejects(store.recoverLock({ expectedToken: 'wrong-token', reason: 'Stopped synthetic child' }), code('LOCK_CHANGED'));
  assert.deepEqual(await store.recoverLock({ expectedToken: owner.token, reason: 'Synthetic child exited; no task work started' }), { recovered: true, token: owner.token });
  assert.equal(store.lockInfo(), null);
  assert.equal(existsSync(path.join(directory, `recovered-lock-${owner.token}`, 'recovery.json')), true);
  await store.mutate({ reduce: changed }); assert.equal(store.read().revision, 1);
});

test('live or foreign lock owners are never evicted by age or a recovery request', async t => {
  const { directory, store } = fixture(t);
  await store.initialize({ initialState });
  const lock = path.join(directory, 'lock'); mkdirSync(lock);
  const owner = { version: 1, token: 'test-live-owner-token', pid: process.pid, host: hostname(), createdAt: '2000-01-01T00:00:00Z' };
  atomicWriteJSON(path.join(lock, 'owner.json'), owner);
  await assert.rejects(store.recoverLock({ expectedToken: owner.token, reason: 'Old lock' }), code('LOCK_OWNER_ALIVE'));
  atomicWriteJSON(path.join(lock, 'owner.json'), { ...owner, host: 'another-host' });
  await assert.rejects(store.recoverLock({ expectedToken: owner.token, reason: 'Old lock' }), code('FOREIGN_LOCK'));
  assert.equal(store.lockInfo().token, owner.token);
});

test('separate Git worktrees resolve the same runtime store while retaining their own checkpoint path', t => {
  const { root } = fixture(t), repository = path.join(root, 'repo'), second = path.join(root, 'worktree');
  mkdirSync(repository);
  const git = (...args) => execFileSync('git', args, { cwd: repository, stdio: 'pipe' });
  git('init'); git('-c', 'user.name=Synthetic Queue Test', '-c', 'user.email=queue-test@example.invalid', 'commit', '--allow-empty', '-m', 'Synthetic queue fixture');
  git('worktree', 'add', '--detach', second, 'HEAD');
  const firstPaths = resolveRepositoryPaths(repository), secondPaths = resolveRepositoryPaths(second);
  assert.equal(firstPaths.directory, secondPaths.directory);
  assert.notEqual(firstPaths.checkpoint, secondPaths.checkpoint);
  assert.equal(firstPaths.directory, path.join(repository, '.git', 'ledgerly-work'));
});

function cliFixture(t) {
  const { root } = fixture(t), repository = path.join(root, 'repo');
  mkdirSync(path.join(repository, 'docs/development'), { recursive: true });
  execFileSync('git', ['init'], { cwd: repository, stdio: 'pipe' });
  const task = (id, priority, extra = {}) => ({ id, priority, dependencies: [], acceptance: ['Synthetic acceptance'], files: [`src/${id}.mjs`], kind: 'implementation', approval: 'approved', ...extra });
  atomicWriteJSON(path.join(repository, 'docs/development/work-backlog.json'), { version: 1, tasks: [
    task('first', 1), task('dependent', 2, { dependencies: ['first'] }), task('unrelated', 3), task('external', 0, { kind: 'external' }),
  ] });
  const run = (command, env = {}) => main({ argv: [], input: Readable.from([JSON.stringify(command)]), cwd: repository, env: { LEDGERLY_QUEUE_COORDINATOR: 'coordinator', ...env } });
  return { root, repository, run };
}

test('real CLI and core enforce automatic claims, configured coordinator and reviewed dependency release', async t => {
  const { repository, run } = cliFixture(t);
  const firstStatus = await run({ type: 'status', actor: 'worker-a' });
  assert.equal(firstStatus.initialized, false); assert.equal(firstStatus.next, 'first');
  assert.equal(firstStatus.tasks.find(task => task.id === 'external').eligible, false);
  assert.equal(existsSync(resolveRepositoryPaths(repository).directory), false);
  await assert.rejects(run({ type: 'init', actor: 'worker-a' }), code('COORDINATOR_REQUIRED'));
  await run({ type: 'init', actor: 'coordinator' });
  await assert.rejects(run({ type: 'claim', actor: 'worker-a', taskId: 'unrelated' }), code('INVALID_COMMAND'));
  const { claim } = await run({ type: 'claim', actor: 'worker-a' });
  assert.equal(claim.taskId, 'first'); assert.ok(claim.token.length >= 8);
  assert.equal((await run({ type: 'claim', actor: 'worker-b' })).claim.taskId, 'unrelated');
  const evidence = { commit: 'synthetic-commit', summary: 'Completed synthetic task', tests: [{ command: 'node --test synthetic.test.mjs', passed: true }] };
  await run({ type: 'submit', actor: 'worker-a', taskId: claim.taskId, token: claim.token, evidence });
  assert.equal((await run({ type: 'status', actor: 'worker-c' })).next, null);
  await assert.rejects(run({ type: 'accept', actor: 'worker-a', taskId: 'first', evidence: { ...evidence, reviewer: 'reviewer', reviewed: true } }), code('COORDINATOR_REQUIRED'));
  await run({ type: 'accept', actor: 'coordinator', taskId: 'first', evidence: { ...evidence, reviewer: 'reviewer', reviewed: true } });
  const ready = await run({ type: 'listready', actor: 'worker-a' });
  assert.equal(ready.next, 'dependent'); assert.deepEqual(ready.tasks.map(task => task.id), ['dependent']);
  await run({ type: 'export', actor: 'coordinator', expectedRevision: ready.revision });
  assert.equal(readJSON(resolveRepositoryPaths(repository).checkpoint).revision, ready.revision);
  await assert.rejects(run({ type: 'export', actor: 'coordinator', expectedRevision: ready.revision - 1 }), code('REVISION_CONFLICT'));
});

test('CLI command parsing rejects authority injection, actor mismatch, malformed and oversized JSON', async t => {
  const { repository, run } = cliFixture(t);
  await assert.rejects(run({ type: 'init', actor: 'coordinator', role: 'coordinator' }), code('INVALID_COMMAND'));
  await assert.rejects(run({ type: 'init', actor: 'coordinator' }, { LEDGERLY_QUEUE_ACTOR: 'worker-a' }), code('ACTOR_MISMATCH'));
  await assert.rejects(main({ argv: [], input: Readable.from(['{invalid']), cwd: repository, env: {} }), code('INVALID_COMMAND'));
  await assert.rejects(main({ argv: ['status'], input: Readable.from(['x'.repeat(65537)]), cwd: repository, env: {} }), code('INVALID_COMMAND'));
  await assert.rejects(main({ argv: ['claim'], input: Readable.from(['{"type":"status"}']), cwd: repository, env: {} }), code('INVALID_COMMAND'));
});

test('a changed catalogue cannot reinterpret shared state or file leases and init never resets it', async t => {
  const { repository, run } = cliFixture(t);
  await run({ type: 'init', actor: 'coordinator' });
  await run({ type: 'claim', actor: 'worker-a' });
  const locations = resolveRepositoryPaths(repository);
  const statePath = path.join(locations.directory, 'queue.json');
  const before = readFileSync(statePath, 'utf8');
  const catalog = readJSON(locations.catalog); catalog.tasks[0].files = ['some-other-file.mjs'];
  atomicWriteJSON(locations.catalog, catalog);
  await assert.rejects(run({ type: 'status' }), code('CATALOG_MISMATCH'));
  await assert.rejects(run({ type: 'claim', actor: 'worker-b' }), code('CATALOG_MISMATCH'));
  await assert.rejects(run({ type: 'init', actor: 'coordinator' }), code('CATALOG_MISMATCH'));
  assert.equal(readFileSync(statePath, 'utf8'), before);
});

test('CLI blocker resolution requires current revision and preserves evidence, dependencies and separate acceptance', async t => {
  const { repository, run } = cliFixture(t);
  await run({ type: 'init', actor: 'coordinator' });
  const proof = id => ({ commit: `synthetic-${id}`, summary: 'Matching synthetic acceptance', tests: [{ command: 'synthetic checks', passed: true }] });
  const parent = (await run({ type: 'claim', actor: 'worker-parent' })).claim;
  await run({ type: 'submit', actor: 'worker-parent', taskId: parent.taskId, token: parent.token, evidence: proof('parent') });
  await run({ type: 'accept', actor: 'coordinator', taskId: parent.taskId, evidence: { ...proof('parent'), reviewed: true, reviewer: 'independent' } });
  const child = (await run({ type: 'claim', actor: 'worker-child' })).claim;
  await run({ type: 'submit', actor: 'worker-child', taskId: child.taskId, token: child.token, evidence: proof('partial') });
  await run({ type: 'reject', actor: 'coordinator', taskId: child.taskId, reason: 'Partial evidence; connected prerequisite remains.' });
  await run({ type: 'recover', actor: 'coordinator', taskId: child.taskId, workerStopped: true, checkpoint: 'Saved synthetic partial branch; worker stopped.' });
  const resumed = (await run({ type: 'claim', actor: 'worker-child' })).claim;
  const blockers = [{ type: 'environment', reason: 'Missing connected runtime ownership.' }, { type: 'task', id: 'unrelated', reason: 'Required connected runtime prerequisite.' }];
  await run({ type: 'block', actor: 'worker-child', taskId: resumed.taskId, token: resumed.token, blockers, checkpoint: 'Partial work saved, stopped before ownership transfer.' });
  const inspected = await run({ type: 'status' });
  const command = { type: 'resolve', actor: 'coordinator', taskId: child.taskId, resolvedBlockers: [0], reason: 'Reviewed connected ownership transfer recorded.' };
  const statePath = path.join(resolveRepositoryPaths(repository).directory, 'queue.json');
  const before = readFileSync(statePath, 'utf8');
  for (const expectedRevision of [undefined, -1, '8']) {
    await assert.rejects(run({ ...command, expectedRevision }), code('REVISION_REQUIRED'));
    assert.equal(readFileSync(statePath, 'utf8'), before);
  }
  const prerequisite = (await run({ type: 'claim', actor: 'worker-prerequisite' })).claim;
  assert.equal(prerequisite.taskId, 'unrelated');
  const concurrent = readFileSync(statePath, 'utf8');
  await assert.rejects(run({ ...command, expectedRevision: inspected.revision }), code('REVISION_CONFLICT'));
  assert.equal(readFileSync(statePath, 'utf8'), concurrent);
  const revision = (await run({ type: 'status' })).revision;
  await assert.rejects(run({ ...command, resolvedBlockers: [1], expectedRevision: revision }), code('RESOLUTION_REQUIRED'));
  assert.equal(readFileSync(statePath, 'utf8'), concurrent);
  await run({ ...command, expectedRevision: revision });
  const state = readJSON(statePath);
  assert.deepEqual(state.tasks.dependent.evidence, proof('partial'));
  assert.deepEqual(state.tasks.dependent.discoveredDependencies, ['unrelated']);
  assert.deepEqual(state.tasks.dependent.blockers, [blockers[1]]);
  assert.equal(state.tasks.dependent.status, 'blocked');
  assert.equal(state.tasks.first.status, 'done');
  assert.deepEqual(state.tasks.first, JSON.parse(before).tasks.first);
  assert.deepEqual(state.events.slice(0, JSON.parse(concurrent).events.length), JSON.parse(concurrent).events);
  assert.deepEqual(state.events.at(-1).resolvedBlockers, [blockers[0]]);
  assert.equal((await run({ type: 'claim', actor: 'worker-new' })).claim, null);
  await run({ type: 'submit', actor: 'worker-prerequisite', taskId: prerequisite.taskId, token: prerequisite.token, evidence: proof('prerequisite') });
  await run({ type: 'accept', actor: 'coordinator', taskId: prerequisite.taskId, evidence: { ...proof('prerequisite'), reviewed: true, reviewer: 'independent' } });
  assert.equal((await run({ type: 'status' })).next, 'dependent');
  assert.equal(readJSON(statePath).tasks.dependent.status, 'blocked');
  assert.equal((await run({ type: 'claim', actor: 'worker-new' })).claim.taskId, 'dependent');
  assert.equal(readJSON(statePath).tasks.dependent.status, 'running');
  assert.equal(readJSON(statePath).tasks.first.status, 'done');
});
