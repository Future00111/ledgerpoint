import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog, initialState, selectNext, transition, explainTask, validateState } from './core.mjs';

const NOW = 100000;
const task = (id, priority = 1, extra = {}) => ({ id, priority, dependencies: [], acceptance: ['Focused behavior and regression pass.'], files: [`src/${id}.mjs`], kind: 'implementation', approval: 'approved', ...extra });
const catalog = tasks => ({ version: 1, tasks });
const evidence = (commit = 'commit-a', extra = {}) => ({ commit, summary: 'Implemented reviewed acceptance examples.', tests: [{ command: 'node --test focused.test.mjs', passed: true }], ...extra });
const approval = id => ({ authority: 'owner', approvedBy: 'owner-person', reference: 'owner-message-2026-10-30', scope: id });
function harness(tasks) {
  const c = catalog(tasks); let state = initialState(c), token = 0;
  return { c, get state() { return state; },
    run(command, now = NOW, coordinator = 'coordinator') { const result = transition(c, state, command, { now, coordinator }); state = result.state; return result; },
    claim(actor, options = {}, now = NOW) { return this.run({ type: 'claim', actor, token: `lease-token-${++token}`, leaseMs: 60000, ...options }, now).claim; },
    submit(actor, claim) { this.run({ type: 'submit', actor, taskId: claim.taskId, token: claim.token, evidence: evidence() }); },
    accept(id) { this.run({ type: 'accept', actor: 'coordinator', taskId: id, evidence: evidence('commit-a', { reviewer: 'reviewer', reviewed: true }) }); },
  };
}

test('catalogue rejects cycles, unknown rules/authority, unsafe paths and missing acceptance', () => {
  assert.equal(validateCatalog(catalog([task('a')] )).version, 1);
  for (const c of [catalog([task('a'), task('a')]), catalog([task('a', 1, { dependencies: ['missing'] })]),
    catalog([task('a', 1, { dependencies: ['b'] }), task('b', 1, { dependencies: ['a'] })]),
    ...['../outside', '/absolute', 'src/*.js', 'src//a', 'src/../a'].map(file => catalog([task('a', 1, { files: [file] })])),
    catalog([task(1)]), catalog([task('a', 1, { approval: 'maybe' })]), catalog([task('a', 1, { kind: 'unknown' })]), catalog([task('a', 1, { acceptance: [] })])]) {
    assert.throws(() => validateCatalog(c), { code: 'INVALID_CATALOG' });
  }
});

test('state version 2 fails closed for old/new unsupported states without silently migrating', () => {
  const c = catalog([task('a')]), state = initialState(c);
  assert.equal(c.version, 1); assert.equal(state.version, 2);
  for (const version of [undefined, 1, 3, '2']) {
    const incompatible = { ...state, version }, before = structuredClone(incompatible);
    assert.throws(() => validateState(c, incompatible), { code: 'INVALID_STATE' });
    assert.throws(() => selectNext(c, incompatible, { worker: 'worker', now: NOW }), { code: 'INVALID_STATE' });
    assert.throws(() => transition(c, incompatible, { type: 'claim', actor: 'worker', token: 'unique-token', leaseMs: 1000 }, { now: NOW }), { code: 'INVALID_STATE' });
    assert.deepEqual(incompatible, before);
  }
});

test('automatic selection follows priority and dependencies, not fixed team/category assignments', () => {
  const h = harness([task('payroll', 4), task('bank', 3), task('tax', 1, { dependencies: ['rules'] }), task('rules', 2, { kind: 'contract' })]);
  assert.equal(h.claim('general-worker').taskId, 'rules');
  assert.equal(h.claim('second-worker').taskId, 'bank');
  assert.equal(h.claim('third-worker').taskId, 'payroll');
  assert.equal(h.claim('fourth-worker'), null);
  const blocked = explainTask(h.c, h.state, h.c.tasks[2], { worker: 'fourth-worker', now: NOW });
  assert.ok(blocked.blockers.some(item => item.id === 'rules'));
});

test('exact/prefix leases block overlap through review while unrelated files run simultaneously', () => {
  const h = harness([task('folder', 1, { files: ['src/accounting/'] }), task('child', 2, { files: ['src/accounting/money.mjs'] }), task('sibling', 3, { files: ['src/accounting-extra/file.mjs'] })]);
  const first = h.claim('worker-a');
  assert.equal(first.taskId, 'folder'); assert.equal(h.claim('worker-b').taskId, 'sibling');
  h.submit('worker-a', first);
  assert.equal(h.claim('worker-c'), null);
  h.accept('folder'); assert.equal(h.claim('worker-c').taskId, 'child');
});

test('one running task per worker; review permits another independent task', () => {
  const h = harness([task('a'), task('b', 2)]), first = h.claim('worker');
  assert.equal(h.claim('worker'), null);
  h.submit('worker', first); assert.equal(h.claim('worker').taskId, 'b');
});

test('block releases ownership with checkpoint and task blockers automatically clear after acceptance', () => {
  const h = harness([task('a'), task('prerequisite', 2), task('other', 3)]), first = h.claim('worker');
  h.run({ type: 'checkpoint', actor: 'worker', taskId: 'a', token: first.token, checkpoint: 'worktree/a at commit partial-a' });
  const block = { type: 'block', actor: 'worker', taskId: 'a', token: first.token, blockers: [{ type: 'task', id: 'prerequisite', reason: 'Needs shared interface.' }] };
  assert.throws(() => h.run(block), { code: 'CHECKPOINT_REQUIRED' });
  h.run({ ...block, checkpoint: 'worktree/a at commit ready-to-resume' });
  assert.equal(h.state.tasks.a.owner, undefined);
  const prerequisite = h.claim('worker'); assert.equal(prerequisite.taskId, 'prerequisite');
  h.submit('worker', prerequisite); h.accept('prerequisite');
  assert.equal(h.claim('another-worker').taskId, 'a');
});

test('decision/environment blockers need explicit coordinator resolution and never self-unlock', () => {
  const h = harness([task('a')]), first = h.claim('worker');
  h.run({ type: 'block', actor: 'worker', taskId: 'a', token: first.token, blockers: [{ type: 'decision', reason: 'Rounding rule unresolved.' }] });
  assert.equal(h.claim('another-worker'), null);
  assert.throws(() => h.run({ type: 'reopen', actor: 'worker', taskId: 'a', reason: 'I decided.' }), { code: 'COORDINATOR_REQUIRED' });
  h.run({ type: 'reopen', actor: 'coordinator', taskId: 'a', reason: 'Approved rule recorded in decision-42.' });
  assert.equal(h.claim('another-worker').taskId, 'a');
});

test('expired running/review leases are quarantined and cannot be silently stolen', () => {
  for (const review of [false, true]) {
    const h = harness([task('a', 1, { files: ['src/shared/'] }), task('b', 2, { files: ['src/shared/b.mjs'] })]);
    const first = h.claim('worker-a', { leaseMs: 1000 });
    if (review) h.submit('worker-a', first);
    assert.equal(h.claim('worker-b', {}, NOW + 1000), null);
    assert.equal(h.state.tasks.a.status, 'quarantined');
    assert.equal(h.state.tasks.a.owner, 'worker-a');
    assert.throws(() => h.run({ type: 'recover', actor: 'coordinator', taskId: 'a', checkpoint: 'worktree/a saved' }, NOW + 1000), { code: 'RECOVERY_REQUIRED' });
    h.run({ type: 'recover', actor: 'coordinator', taskId: 'a', workerStopped: true, checkpoint: 'worker terminated; worktree/a saved' }, NOW + 1000);
    assert.equal(h.claim('worker-b', {}, NOW + 1000).taskId, 'a');
    assert.throws(() => h.run({ type: 'renew', actor: 'worker-a', taskId: 'a', token: first.token, leaseMs: 1000 }, NOW + 1000), { code: 'LEASE_REQUIRED' });
  }
});

test('workers cannot accept their own work; acceptance needs independent matching-commit passing evidence', () => {
  const h = harness([task('a')]), first = h.claim('worker');
  assert.throws(() => h.run({ type: 'submit', actor: 'worker', taskId: 'a', token: first.token, evidence: evidence('bad', { tests: [] }) }), { code: 'EVIDENCE_REQUIRED' });
  h.submit('worker', first);
  assert.throws(() => h.run({ type: 'accept', actor: 'worker', taskId: 'a', evidence: evidence() }), { code: 'COORDINATOR_REQUIRED' });
  for (const proof of [evidence(), evidence('different', { reviewer: 'reviewer', reviewed: true }), evidence('commit-a', { reviewer: 'worker', reviewed: true }), evidence('commit-a', { reviewer: 'reviewer', reviewed: true, tests: [{ command: 'tests', passed: false }] })]) {
    assert.throws(() => h.run({ type: 'accept', actor: 'coordinator', taskId: 'a', evidence: proof }), { code: 'EVIDENCE_REQUIRED' });
  }
  h.accept('a'); assert.equal(h.state.tasks.a.status, 'done'); assert.equal(h.state.tasks.a.owner, undefined);
});

test('reopening a dependency invalidates accepted descendants and quarantines active descendants transitively', () => {
  const h = harness([task('a', 1, { status: 'done' }), task('b', 2, { dependencies: ['a'], status: 'done' }), task('c', 3, { dependencies: ['b'] }), task('independent', 4)]);
  const active = h.claim('worker-c'); assert.equal(active.taskId, 'c');
  h.run({ type: 'reopen', actor: 'coordinator', taskId: 'a', reason: 'Review found historical calculation error.' });
  assert.equal(h.state.tasks.b.status, 'blocked'); assert.equal(h.state.tasks.c.status, 'quarantined');
  assert.equal(h.state.tasks.c.token, active.token);
  assert.equal(h.claim('worker-c'), null);
  const rework = h.claim('worker-a'); assert.equal(rework.taskId, 'a');
  h.submit('worker-a', rework); h.accept('a');
  assert.equal(h.claim('worker-b').taskId, 'b');
  assert.equal(h.state.tasks.c.status, 'quarantined');
});

test('reject retains lease until stopped-worker recovery; approve requires actual scoped owner record', () => {
  const h = harness([task('a'), task('external', 2, { kind: 'external' }), task('decision', 3, { approval: 'owner_required' })]);
  const first = h.claim('worker'); h.submit('worker', first);
  h.run({ type: 'reject', actor: 'coordinator', taskId: 'a', reason: 'Regression failed.' });
  assert.equal(h.state.tasks.a.status, 'quarantined'); assert.equal(h.claim('new-worker'), null);
  for (const invalid of [true, 'approved', { authority: 'coordinator', scope: 'external', approvedBy: 'coordinator', reference: 'self' }, approval('different')]) {
    assert.throws(() => h.run({ type: 'approve', actor: 'coordinator', taskId: 'external', approvalEvidence: invalid }), { code: 'APPROVAL_REQUIRED' });
  }
  h.run({ type: 'approve', actor: 'coordinator', taskId: 'external', approvalEvidence: approval('external') });
  assert.equal(h.claim('new-worker').taskId, 'external');
});

test('coordinator priority overrides, worker capabilities and unresolved rules control eligible selection', () => {
  const h = harness([task('a'), task('verify', 9, { kind: 'verification' }), task('unknown', 0, { rulesKnown: false })]);
  h.run({ type: 'reprioritize', actor: 'coordinator', taskId: 'verify', priority: 0 });
  assert.equal(h.claim('review-worker', { capabilities: ['verification'] }).taskId, 'verify');
  assert.equal(h.claim('code-worker', { capabilities: ['implementation'] }).taskId, 'a');
  assert.equal(h.claim('third-worker'), null);
});

test('transitions are immutable, revisioned, auditable and reject stale tokens', () => {
  const c = catalog([task('a')]), original = initialState(c), before = structuredClone(original);
  const command = { type: 'claim', actor: 'worker', token: 'token-unique-1', leaseMs: 1000 };
  const result = transition(c, original, command, { now: NOW });
  assert.deepEqual(original, before); assert.equal(result.state.revision, 1); assert.equal(result.state.events[0].type, 'claim');
  assert.equal(validateState(c, result.state), result.state);
  assert.throws(() => transition(c, result.state, { type: 'checkpoint', actor: 'worker', taskId: 'a', token: 'wrong-token', checkpoint: 'checkpoint' }, { now: NOW }), { code: 'LEASE_REQUIRED' });
  assert.throws(() => transition(c, result.state, command, { now: NOW }), { code: 'INVALID_TOKEN' });
  assert.equal(transition(c, result.state, { ...command, actor: 'other', token: 'token-unique-2' }, { now: NOW }).state.revision, 1);
});

test('renewal is scoped and bounded, while invalid task blocker names cannot reference object properties', () => {
  const h = harness([task('a')]), first = h.claim('worker', { leaseMs: 1000 });
  h.run({ type: 'renew', actor: 'worker', taskId: 'a', token: first.token, leaseMs: 2000, workStarted: true }, NOW + 500);
  assert.equal(h.state.tasks.a.leaseUntil, NOW + 2500);
  assert.throws(() => h.run({ type: 'block', actor: 'worker', taskId: 'a', token: first.token, blockers: [{ type: 'task', id: '__proto__', reason: 'Invalid target.' }], checkpoint: 'saved' }), { code: 'INVALID_BLOCKERS' });
  assert.throws(() => h.claim('other', {}, Number.MAX_SAFE_INTEGER), { code: 'INVALID_LEASE' });
});

test('discovered dependencies survive resumption, review and acceptance then invalidate work when reopened', () => {
  for (const phase of ['running', 'review', 'done']) {
    const h = harness([task('a'), task('b', 2)]), first = h.claim('worker-a');
    h.run({ type: 'block', actor: 'worker-a', taskId: 'a', token: first.token, blockers: [{ type: 'task', id: 'b', reason: 'Discovered shared interface dependency.' }] });
    const prerequisite = h.claim('worker-b'); h.submit('worker-b', prerequisite); h.accept('b');
    const resumed = h.claim('worker-a');
    assert.deepEqual(h.state.tasks.a.discoveredDependencies, ['b']);
    if (phase !== 'running') h.submit('worker-a', resumed);
    if (phase === 'done') h.accept('a');
    h.run({ type: 'reopen', actor: 'coordinator', taskId: 'b', reason: 'Shared interface was incorrect.' });
    assert.equal(h.state.tasks.a.status, phase === 'done' ? 'blocked' : 'quarantined');
    assert.ok(explainTask(h.c, h.state, h.c.tasks[0], { worker: 'other-worker', now: NOW }).blockers.some(item => item.id === 'b'));
    assert.throws(() => h.accept('a'), { code: 'REVIEW_REQUIRED' });
    if (phase !== 'done') {
      h.run({ type: 'recover', actor: 'coordinator', taskId: 'a', workerStopped: true, checkpoint: 'Saved affected work before rework.' });
      assert.equal(h.claim('other-worker').taskId, 'b');
      assert.equal(h.claim('third-worker'), null);
    }
  }
});

test('dynamically discovered cycles are rejected atomically across static and discovered dependencies', () => {
  for (const staticEdge of [false, true]) {
    const h = harness([task('a'), task('b', 2, { dependencies: staticEdge ? ['a'] : [] })]), first = h.claim('worker-a');
    const blockA = { type: 'block', actor: 'worker-a', taskId: 'a', token: first.token, blockers: [{ type: 'task', id: 'b', reason: 'Needs B.' }] };
    if (staticEdge) {
      assert.throws(() => h.run(blockA), { code: 'DEPENDENCY_CYCLE' });
      assert.equal(h.state.tasks.a.status, 'running');
    } else {
      h.run(blockA); const second = h.claim('worker-b'), before = structuredClone(h.state);
      assert.throws(() => h.run({ type: 'block', actor: 'worker-b', taskId: 'b', token: second.token, blockers: [{ type: 'task', id: 'a', reason: 'Needs A.' }] }), { code: 'DEPENDENCY_CYCLE' });
      assert.deepEqual(h.state, before);
    }
  }
});

test('reopening a prerequisite preserves downstream environment, decision and other task blockers', () => {
  const h = harness([task('parent', 0, { status: 'done' }), task('child', 1, { dependencies: ['parent'] }), task('other', 2)]);
  const child = h.claim('worker-child');
  const blockers = [{ type: 'environment', reason: 'Disposable database unavailable.' }, { type: 'decision', reason: 'Rounding interpretation not approved.' }, { type: 'task', id: 'other', reason: 'Another discovered prerequisite.' }];
  h.run({ type: 'block', actor: 'worker-child', taskId: 'child', token: child.token, blockers });
  h.run({ type: 'reopen', actor: 'coordinator', taskId: 'parent', reason: 'Parent needs rework.' });
  for (const blocker of blockers) assert.ok(h.state.tasks.child.blockers.some(item => item.type === blocker.type && item.reason === blocker.reason));
  const parent = h.claim('worker-parent'); h.submit('worker-parent', parent); h.accept('parent');
  const other = h.claim('worker-other'); h.submit('worker-other', other); h.accept('other');
  assert.equal(h.claim('worker-new'), null);
  assert.deepEqual(explainTask(h.c, h.state, h.c.tasks[1], { worker: 'worker-new', now: NOW }).blockers.map(item => item.type).sort(), ['decision', 'environment']);
  h.run({ type: 'reopen', actor: 'coordinator', taskId: 'child', reason: 'Database restored; approved rounding recorded in decision-42.' });
  assert.equal(h.claim('worker-new').taskId, 'child');
});

test('stopped-worker recovery clears quarantine causes but preserves independent blockers', () => {
  const h = harness([task('a')]), first = h.claim('worker-a');
  const state = structuredClone(h.state);
  state.tasks.a.status = 'quarantined';
  state.tasks.a.blockers = [{ type: 'environment', source: 'lease', reason: 'Lease expired.' }, { type: 'environment', reason: 'Database unavailable.' }, { type: 'decision', reason: 'Needs owner interpretation.' }];
  const recovered = transition(h.c, state, { type: 'recover', actor: 'coordinator', taskId: first.taskId, workerStopped: true, checkpoint: 'Stopped worker with saved checkpoint.' }, { now: NOW, coordinator: 'coordinator' }).state;
  assert.equal(recovered.tasks.a.status, 'blocked');
  assert.equal(recovered.tasks.a.blockers.length, 2);
  assert.equal(selectNext(h.c, recovered, { worker: 'new-worker', now: NOW }), null);
  assert.equal(recovered.tasks.a.owner, undefined);
});

test('worker blockers cannot impersonate scheduler-owned quarantine causes', () => {
  const h = harness([task('a')]), first = h.claim('worker-a');
  h.run({ type: 'block', actor: 'worker-a', taskId: 'a', token: first.token, blockers: [{ type: 'environment', source: 'lease', reason: 'Real missing environment.' }] });
  assert.deepEqual(h.state.tasks.a.blockers, [{ type: 'environment', reason: 'Real missing environment.' }]);
});

test('explicit blocker resolution preserves evidence and dependencies without reopening descendants', () => {
  const h = harness([task('a'), task('dep', 2), task('child', 3, { dependencies: ['a'] })]);
  const a = h.claim('worker');
  h.run({type:'block',actor:'worker',taskId:'a',token:a.token,blockers:[{type:'environment',reason:'Missing runtime ownership'},{type:'task',id:'dep',reason:'Needs prerequisite'}]});
  h.state.tasks.a.evidence = evidence('partial');
  const before = structuredClone(h.state);
  const cmd = {type:'resolve',actor:'coordinator',taskId:'a',resolvedBlockers:[0],reason:'Reviewed ownership transfer recorded'};
  assert.throws(()=>h.run({...cmd,actor:'worker'}),{code:'COORDINATOR_REQUIRED'});
  for (const resolvedBlockers of [[1],[0,0],[-1],[2],[]]) assert.throws(()=>h.run({...cmd,resolvedBlockers}),{code:'RESOLUTION_REQUIRED'});
  h.run(cmd);
  assert.deepEqual(h.state.tasks.a.evidence,before.tasks.a.evidence);
  assert.deepEqual(h.state.tasks.child,before.tasks.child);
  assert.deepEqual(h.state.tasks.a.discoveredDependencies,['dep']);
  assert.equal(h.state.tasks.a.status,'blocked');
  const dep=h.claim('worker'); assert.equal(dep.taskId,'dep'); h.submit('worker',dep);h.accept('dep');
  assert.equal(h.claim('worker').taskId,'a');
  assert.equal(h.state.tasks.child.status,'pending');
  assert.throws(()=>h.run(cmd),{code:'RESOLUTION_REQUIRED'});
});
