// Read the authoritative work-coordinator.json from stdin before dispatch.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { transitionCoordinator } from './coordinator.mjs';

export function coordinatorStatus(state, now = Date.now()) {
  // Validate with the same transition code as a real acquisition, on a copy.
  try {
    const probe = transitionCoordinator(state, {
      type: 'acquire', runId: randomUUID(), token: randomUUID(), leaseMs: 1000,
    }, { now });
    if (probe.status === 'leased') return { next: 'acquire', revision: state.revision };
  } catch (error) {
    if (!['COORDINATOR_OWNED', 'COORDINATOR_QUARANTINED'].includes(error.code)) throw error;
  }
  const expired = now >= state.lease.expiresAt;
  return {
    next: state.status === 'quarantined' || expired ? 'verify-stop-evidence-before-recovery' : 'existing-owner',
    revision: state.revision,
    leaseExpiresAt: new Date(state.lease.expiresAt).toISOString(),
    workersRecordedStopped: state.workersStopped === true,
    checkpointCodeHead: state.checkpoint?.codeHead ?? null,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(coordinatorStatus(JSON.parse(readFileSync(0, 'utf8'))), null, 2));
  } catch {
    console.error('Unable to verify coordinator checkpoint.');
    process.exitCode = 1;
  }
}
