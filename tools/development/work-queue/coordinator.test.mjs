import test from 'node:test';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { initialCoordinatorState, transitionCoordinator as move } from './coordinator.mjs';
const hash = 'a'.repeat(40), changed = 'b'.repeat(40);
const initial = () => initialCoordinatorState({ repository: 'Future00111/ledgerpoint', codeBranch: 'codex/work', codeHead: hash, catalogPath: 'docs/catalog.json', statePath: 'docs/state.json' });
const owner = { runId: 'run-1', token: 'fence-1' };
const acquire = (s = initial()) => move(s, { type: 'acquire', ...owner, leaseMs: 1000 }, { now: 100 });
const reference = { ref: 'refs/heads/codex/checkpoints', sha: changed, path: 'evidence/receipt.json' };
const saved = { codeHead: changed, queueState: { tasks: [{ id: 'a', status: 'done' }] }, checkpoint: { ref: reference.ref, sha: changed, evidence: [reference] } };
const save = s => move(s, { type: 'checkpoint', ...owner, ...saved }, { now: 200 });
const fails = (fn, code) => assert.throws(fn, error => error.code === code);

test('acquisition is exclusive; transitions do not mutate caller state', () => {
  const before = initial(), leased = acquire(before);
  assert.equal(before.revision, 0); assert.equal(before.status, 'idle');
  assert.equal(leased.revision, 1); assert.equal(leased.status, 'leased');
  fails(() => move(leased, { type: 'acquire', ...owner, leaseMs: 1000 }, { now: 101 }), 'COORDINATOR_OWNED');
});
test('wrong token/run cannot renew, save or release; stale renewal is refused', () => {
  const s = acquire();
  for (const type of ['renew', 'checkpoint', 'release']) for (const identity of [{ ...owner, token: 'stale' }, { ...owner, runId: 'wrong' }])
    fails(() => move(s, { type, ...identity, ...saved, leaseMs: 1000 }, { now: 101 }), 'OWNER_FENCED');
  const renewed = move(s, { type: 'renew', ...owner, leaseMs: 2000 }, { now: 200 });
  assert.equal(renewed.lease.expiresAt, 2200);
  fails(() => move(renewed, { type: 'renew', ...owner, leaseMs: 2000 }, { now: 199 }), 'INVALID_TIME');
});
test('clean release needs a current durable checkpoint and preserves it for the next owner', () => {
  const s = acquire();
  const release = { type: 'release', ...owner, workersStopped: true, worktreesClean: true };
  fails(() => move(s, release, { now: 201 }), 'CHECKPOINT_REQUIRED');
  const checkpointed = save(s);
  fails(() => move(checkpointed, { ...release, workersStopped: false }, { now: 201 }), 'CLEAN_STOP_REQUIRED');
  fails(() => move(checkpointed, { ...release, worktreesClean: false }, { now: 201 }), 'CLEAN_STOP_REQUIRED');
  const idle = move(checkpointed, release, { now: 201 });
  const next = move(idle, { type: 'acquire', runId: 'run-2', token: 'fence-2', leaseMs: 1000 }, { now: 202 });
  assert.equal(next.codeHead, changed); assert.deepEqual(next.checkpoint, checkpointed.checkpoint);
  assert.deepEqual(next.queueState, saved.queueState);
  fails(() => move(next, { type: 'renew', ...owner, leaseMs: 1000 }, { now: 203 }), 'OWNER_FENCED');
});
test('expiry quarantines all normal actions without granting new ownership', () => {
  const s = save(acquire());
  for (const type of ['acquire', 'renew', 'checkpoint', 'release']) {
    const q = move(s, { type, runId: 'run-2', token: 'fence-2', leaseMs: 1000 }, { now: 1100 });
    assert.equal(q.status, 'quarantined'); assert.deepEqual(q.lease, s.lease);
    assert.deepEqual(q.checkpoint, s.checkpoint); assert.deepEqual(q.queueState, s.queueState);
  }
});
test('explicit recovery requires stopped prior run evidence and a durable checkpoint', () => {
  const s = save(acquire());
  const recover = { type: 'recover', priorRunId: owner.runId, workersStopped: true, stoppedEvidence: reference, ...saved };
  fails(() => move(s, recover, { now: 300 }), 'RECOVERY_NOT_ALLOWED');
  fails(() => move(s, { ...recover, priorRunId: 'wrong' }, { now: 1100 }), 'STOP_EVIDENCE_REQUIRED');
  fails(() => move(s, { ...recover, workersStopped: false }, { now: 1100 }), 'STOP_EVIDENCE_REQUIRED');
  fails(() => move(s, { ...recover, stoppedEvidence: null }, { now: 1100 }), 'INVALID_DURABLE_REFERENCE');
  fails(() => move(s, { ...recover, checkpoint: null }, { now: 1100 }), 'INVALID_CHECKPOINT');
  const idle = move(s, recover, { now: 1100 });
  assert.equal(idle.status, 'idle'); assert.equal(idle.lease, null); assert.equal(idle.codeHead, changed);
  assert.deepEqual(idle.queueState, saved.queueState);
  fails(() => acquire(idle), 'INVALID_TIME');
  fails(() => move(idle, { type: 'acquire', ...owner, leaseMs: 1000 }, { now: 1101 }), 'INVALID_OWNER');
});
test('invalid time, TTL, arbitrary commands and unsafe checkpoint data fail closed', () => {
  for (const leaseMs of [0, -1, 999, Infinity, 86400001]) fails(() => move(initial(), { type: 'acquire', ...owner, leaseMs }, { now: 1 }), 'INVALID_LEASE');
  for (const now of [NaN, Infinity, -1, 1.5]) fails(() => move(initial(), { type: 'acquire', ...owner, leaseMs: 1000 }, { now }), 'INVALID_TIME');
  fails(() => move(initial(), { type: 'exec', command: 'anything' }, { now: 1 }), 'INVALID_COMMAND');
  for (const queueState of [{ bad: undefined }, { bad: Infinity }, { bad: () => {} }])
    fails(() => move(acquire(), { type: 'checkpoint', ...owner, ...saved, queueState }, { now: 200 }), 'INVALID_JSON');
  fails(() => move(acquire(), { type: 'checkpoint', ...owner, ...saved, checkpoint: { ...saved.checkpoint, ref: 'https://example.test' } }, { now: 200 }), 'INVALID_CHECKPOINT');
});
test('malformed persisted evidence and invalid repository paths cannot acquire ownership', () => {
  const state = initial();
  for (const codeBranch of ['codex/../main', 'codex/.hidden', 'refs/x.lock', '/main'])
    fails(() => initialCoordinatorState({ ...state, codeBranch }), 'INVALID_CONFIGURATION');
  const invalid = save(acquire()); invalid.checkpoint.sha = 'not-a-sha';
  fails(() => move(invalid, { type: 'renew', ...owner, leaseMs: 1000 }, { now: 201 }), 'INVALID_CHECKPOINT');
  const cycle = {}; cycle.self = cycle;
  fails(() => move(acquire(), { type: 'checkpoint', ...owner, ...saved, queueState: cycle }, { now: 200 }), 'INVALID_JSON');
});

const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');
const release = state => move(state, { type: 'release', ...owner, workersStopped: true, worktreesClean: true }, { now: 201 });
function assertRetiredGuard(state, now) {
  assert.equal(state.status, 'idle'); assert.equal(state.lease, null);
  assert.equal(Object.hasOwn(state.lastOwner, 'token'), false);
  assert.equal(state.lastOwner.tokenSha256, sha256(owner.token));
  assert.equal(JSON.stringify(state).includes(owner.token), false);
  fails(() => move(state, { type: 'acquire', runId: 'run-2', token: owner.token, leaseMs: 1000 }, { now }), 'INVALID_OWNER');
  fails(() => move(state, { type: 'acquire', runId: owner.runId, token: 'fresh-token', leaseMs: 1000 }, { now }), 'INVALID_OWNER');
  const fresh = move(state, { type: 'acquire', runId: 'run-2', token: 'fresh-token', leaseMs: 1000 }, { now });
  assert.equal(fresh.lease.tokenSha256, sha256('fresh-token'));
  assert.equal(Object.hasOwn(fresh.lease, 'token'), false);
  fails(() => move(fresh, { type: 'renew', ...owner, leaseMs: 1000 }, { now: now + 1 }), 'OWNER_FENCED');
}
test('release retires plaintext token but still rejects previous token and run reuse', () => {
  const active = save(acquire());
  const idle = release(active);
  assertRetiredGuard(idle, 202);
  assert.equal(active.lease.tokenSha256, sha256(owner.token));
  assert.equal(idle.lastOwner.acquiredAt, active.lease.acquiredAt);
  assert.equal(idle.lastOwner.expiresAt, active.lease.expiresAt);
});
test('expired recovery retires plaintext token and preserves the same reuse guard', () => {
  const idle = move(save(acquire()), { type: 'recover', priorRunId: owner.runId, workersStopped: true,
    stoppedEvidence: reference, ...saved }, { now: 1100 });
  assertRetiredGuard(idle, 1101);
  assert.deepEqual(idle.recovery.stoppedEvidence, reference);
});
test('legacy retired tokens normalize without changing live fences or caller history', () => {
  const legacy = release(save(acquire()));
  legacy.version = 1;
  legacy.lastOwner.token = owner.token; delete legacy.lastOwner.tokenSha256;
  fails(() => move(legacy, { type: 'acquire', runId: 'run-2', token: owner.token, leaseMs: 1000 }, { now: 202 }), 'INVALID_OWNER');
  fails(() => move(legacy, { type: 'acquire', runId: owner.runId, token: 'fresh-token', leaseMs: 1000 }, { now: 202 }), 'INVALID_OWNER');
  const active = move(legacy, { type: 'acquire', runId: 'run-2', token: 'fresh-token', leaseMs: 1000 }, { now: 202 });
  assert.equal(Object.hasOwn(active.lastOwner, 'token'), false);
  assert.equal(active.lastOwner.tokenSha256, sha256(owner.token));
  assert.equal(legacy.lastOwner.token, owner.token);
  assert.equal(active.lease.tokenSha256, sha256('fresh-token'));
  const legacyWhileActive = { ...active, version: 1, lastOwner: legacy.lastOwner };
  const renewed = move(legacyWhileActive, { type: 'renew', runId: 'run-2', token: 'fresh-token', leaseMs: 2000 }, { now: 203 });
  assert.equal(renewed.lease.tokenSha256, active.lease.tokenSha256);
  assert.equal(renewed.lastOwner.tokenSha256, sha256(owner.token));
  assert.equal(Object.hasOwn(renewed.lastOwner, 'token'), false);
  fails(() => move(legacyWhileActive, { type: 'renew', runId: 'run-2', token: owner.token, leaseMs: 2000 }, { now: 203 }), 'OWNER_FENCED');
});
test('malformed or mixed retired token representations fail closed', () => {
  const idle = release(save(acquire()));
  for (const representation of [ {}, { tokenSha256: '' }, { tokenSha256: 'a'.repeat(63) },
    { tokenSha256: 'G'.repeat(64) }, { tokenSha256: 42 }, { token: '' },
    { token: owner.token, tokenSha256: sha256(owner.token) } ]) {
    const { tokenSha256, ...identity } = idle.lastOwner;
    const invalid = { ...idle, lastOwner: { ...identity, ...representation } };
    fails(() => move(invalid, { type: 'acquire', runId: 'run-2', token: 'fresh-token', leaseMs: 1000 }, { now: 202 }), 'INVALID_STATE');
  }
});


test('active version-2 lease stores only a digest; publishing the digest does not grant ownership', () => {
  const active = acquire();
  assert.equal(active.version, 2);
  assert.equal(Object.hasOwn(active.lease, 'token'), false);
  assert.equal(active.lease.tokenSha256, sha256(owner.token));
  assert.equal(JSON.stringify(active).includes(owner.token), false);
  for (const type of ['renew', 'checkpoint', 'release']) {
    fails(() => move(active, { type, ...owner, token: active.lease.tokenSha256,
      ...saved, leaseMs: 1000, workersStopped: true, worktreesClean: true }, { now: 201 }), 'OWNER_FENCED');
  }
});

test('version-1 active ownership migrates only with the existing fence and preserves times/history', () => {
  const active = save(acquire());
  const { tokenSha256, ...identity } = active.lease;
  const legacy = { ...active, version: 1, lease: { ...identity, token: owner.token } };
  fails(() => move(legacy, { type: 'renew', runId: owner.runId, token: 'wrong', leaseMs: 2000 }, { now: 201 }), 'OWNER_FENCED');
  const migrated = move(legacy, { type: 'renew', ...owner, leaseMs: 2000 }, { now: 201 });
  assert.equal(migrated.version, 2);
  assert.equal(migrated.lease.tokenSha256, sha256(owner.token));
  assert.equal(migrated.lease.acquiredAt, identity.acquiredAt);
  assert.deepEqual(migrated.queueState, legacy.queueState);
  assert.deepEqual(migrated.checkpoint, legacy.checkpoint);
  assert.equal(legacy.lease.token, owner.token);
  const expired = move(legacy, { type: 'acquire', runId: 'run-2', token: 'fresh', leaseMs: 1000 }, { now: 1100 });
  assert.equal(expired.status, 'quarantined');
  assert.equal(expired.version, 2);
  assert.equal(Object.hasOwn(expired.lease, 'token'), false);
  assert.equal(expired.lease.tokenSha256, sha256(owner.token));
});

test('malformed, mixed, version-2 plaintext and unknown-version active states fail closed', () => {
  const active = acquire();
  const { tokenSha256, ...identity } = active.lease;
  for (const version of [1, 2]) for (const representation of [{}, { tokenSha256: '' },
    { tokenSha256: 'a'.repeat(63) }, { tokenSha256: 'G'.repeat(64) }, { tokenSha256: 42 },
    { token: '' }, { token: owner.token, tokenSha256 }]) {
    const invalid = { ...active, version, lease: { ...identity, ...representation } };
    fails(() => move(invalid, { type: 'renew', ...owner, leaseMs: 1000 }, { now: 201 }), 'INVALID_STATE');
  }
  for (const invalid of [{ ...active, lease: { ...identity, token: owner.token } }, { ...active, version: 3 }])
    fails(() => move(invalid, { type: 'renew', ...owner, leaseMs: 1000 }, { now: 201 }), 'INVALID_STATE');
});
