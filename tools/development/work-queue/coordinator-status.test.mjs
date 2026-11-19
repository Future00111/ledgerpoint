import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCoordinatorState, transitionCoordinator } from './coordinator.mjs';
import { coordinatorStatus } from './coordinator-status.mjs';

test('startup distinguishes idle, live, expired and quarantined without changing ownership', () => {
  const idle = initialCoordinatorState({ repository: 'org/project', codeBranch: 'dev', codeHead: 'a'.repeat(40), catalogPath: 'catalog.json', statePath: 'state.json' });
  const live = transitionCoordinator(idle, { type: 'acquire', runId: 'first', token: 'synthetic', leaseMs: 1000 }, { now: 10 });
  live.workersStopped = true;
  const copy = structuredClone(live);
  assert.equal(coordinatorStatus(idle, 10).next, 'acquire');
  assert.equal(coordinatorStatus(live, 1009).next, 'existing-owner');
  assert.equal(coordinatorStatus(live, 1010).next, 'verify-stop-evidence-before-recovery');
  const held = transitionCoordinator(live, { type: 'acquire' }, { now: 1010 });
  assert.equal(coordinatorStatus(held, 1011).next, 'verify-stop-evidence-before-recovery');
  assert.deepEqual(live, copy);
  assert.throws(() => coordinatorStatus({ ...live, lease: null }, 1011));
});

test('invalid input produces a fixed diagnostic without echoing checkpoint bytes', () => {
  const script = fileURLToPath(new URL('./coordinator-status.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script], { input: 'broken-private-fixture', encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.trim(), 'Unable to verify coordinator checkpoint.');
});
