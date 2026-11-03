/** Pure hosted-run policy, not a remote lock. Store this state on a dedicated GitHub ref.
 * Caller must read its current SHA, commit next state with that parent, and update_ref
 * with expected_sha and force:false BEFORE launching workers. On CAS failure stop.
 * Before every code publication, re-read state and verify a live matching run/token,
 * and CAS the code ref against its expected SHA. Never treat TTL as proof of shutdown.
 * Use a fresh fencing token per run (not a provider credential). Keep secrets out of
 * queueState/evidence. Retired tokens retain only SHA-256 reuse guards; live tokens
 * still fence every owned transition. Legacy retired tokens migrate on transition.
 * Verify evidence contents and validate the opaque queue schema
 * before calling; this module validates JSON/references, not their remote existence.
 * now is integer Unix milliseconds. Returned quarantine never grants ownership.
 */
import { createHash } from 'node:crypto';

const MAX_TTL = 24 * 60 * 60 * 1000;
const fail = code => { throw Object.assign(new Error(code), { code }); };
const requireValue = (ok, code) => { if (!ok) fail(code); };
const identifier = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const sha = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
const path = value => typeof value === 'string' && value.length <= 512 && /^[A-Za-z0-9_.\/-]+$/.test(value)
  && value.split('/').every(part => part && part !== '.' && part !== '..' && !part.endsWith('.lock'));
const branch = value => path(value) && !value.includes('..') && value.split('/').every(part => !part.startsWith('.') && !part.endsWith('.'));
const ref = value => typeof value === 'string' && value.startsWith('refs/heads/') && branch(value.slice(11));
const time = value => Number.isSafeInteger(value) && value >= 0;
const tokenDigest = token => createHash('sha256').update(token, 'utf8').digest('hex');
function retiredOwner(owner) {
  requireValue(owner && identifier(owner.runId), 'INVALID_STATE');
  const hasToken = Object.hasOwn(owner, 'token');
  const hasDigest = Object.hasOwn(owner, 'tokenSha256');
  requireValue(hasToken !== hasDigest, 'INVALID_STATE');
  if (!hasToken) {
    requireValue(typeof owner.tokenSha256 === 'string' && /^[a-f0-9]{64}$/.test(owner.tokenSha256), 'INVALID_STATE');
    return owner;
  }
  requireValue(identifier(owner.token), 'INVALID_STATE');
  const { token, ...history } = owner;
  return { ...history, tokenSha256: tokenDigest(token) };
}
function json(value) {
  const seen = new Set();
  function inspect(item, depth = 0) {
    requireValue(depth <= 64, 'INVALID_JSON');
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return;
    if (typeof item === 'number') return requireValue(Number.isFinite(item), 'INVALID_JSON');
    requireValue(item && typeof item === 'object' && !seen.has(item), 'INVALID_JSON');
    requireValue(Array.isArray(item) || [Object.prototype, null].includes(Object.getPrototypeOf(item)), 'INVALID_JSON');
    requireValue(Object.getOwnPropertySymbols(item).length === 0, 'INVALID_JSON');
    seen.add(item);
    if (Array.isArray(item)) for (const child of item) inspect(child, depth + 1);
    else for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(item))) {
      requireValue(Object.hasOwn(descriptor, 'value') && descriptor.enumerable, 'INVALID_JSON');
      inspect(descriptor.value, depth + 1);
    }
    seen.delete(item);
  }
  inspect(value);
  const encoded = JSON.stringify(value);
  requireValue(encoded.length <= 1024 * 1024, 'STATE_TOO_LARGE');
  return JSON.parse(encoded);
}
function durable(value) {
  requireValue(value && ref(value.ref) && sha(value.sha) && path(value.path), 'INVALID_DURABLE_REFERENCE');
  return { ref: value.ref, sha: value.sha, path: value.path };
}
function checkpoint(command, runId, now) {
  const c = command.checkpoint;
  requireValue(sha(command.codeHead) && c && ref(c.ref) && sha(c.sha)
    && Array.isArray(c.evidence) && c.evidence.length > 0 && c.evidence.length <= 100, 'INVALID_CHECKPOINT');
  requireValue(command.queueState && typeof command.queueState === 'object' && !Array.isArray(command.queueState), 'INVALID_QUEUE_STATE');
  return { codeHead: command.codeHead, queueState: json(command.queueState),
    checkpoint: { ref: c.ref, sha: c.sha, evidence: c.evidence.map(durable), runId, at: now, codeHead: command.codeHead } };
}
export function initialCoordinatorState({ repository, codeBranch, codeHead, catalogPath, statePath }) {
  requireValue(typeof repository === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(repository)
    && branch(codeBranch) && sha(codeHead) && path(catalogPath) && path(statePath) && catalogPath !== statePath, 'INVALID_CONFIGURATION');
  return { version: 1, revision: 0, repository, codeBranch, codeHead, catalogPath, statePath,
    status: 'idle', lease: null, lastOwner: null, queueState: null, checkpoint: null, updatedAt: null };
}
export function transitionCoordinator(state, command, { now }) {
  const next = json(state);
  initialCoordinatorState(next);
  requireValue(next.version === 1 && Number.isSafeInteger(next.revision) && next.revision >= 0
    && next.revision < Number.MAX_SAFE_INTEGER && ['idle', 'leased', 'quarantined'].includes(next.status), 'INVALID_STATE');
  requireValue(time(now) && (next.updatedAt === null || time(next.updatedAt) && now >= next.updatedAt), 'INVALID_TIME');
  requireValue(command && ['acquire', 'renew', 'checkpoint', 'release', 'recover'].includes(command.type), 'INVALID_COMMAND');
  if (next.status === 'idle') requireValue(next.lease === null, 'INVALID_STATE');
  else requireValue(next.lease && identifier(next.lease.runId) && identifier(next.lease.token)
    && time(next.lease.expiresAt) && time(next.lease.acquiredAt)
    && next.lease.acquiredAt <= next.updatedAt && next.lease.expiresAt > next.lease.acquiredAt, 'INVALID_STATE');
  if (next.checkpoint !== null) {
    requireValue(identifier(next.checkpoint.runId) && time(next.checkpoint.at)
      && next.checkpoint.at <= next.updatedAt && next.checkpoint.codeHead === next.codeHead, 'INVALID_CHECKPOINT');
    checkpoint({ ...next, checkpoint: next.checkpoint }, next.checkpoint.runId, next.checkpoint.at);
  }
  // Migrate only retired legacy identifiers; live owner fencing remains exact.
  if (next.lastOwner !== null) next.lastOwner = retiredOwner(next.lastOwner);
  next.revision++; next.updatedAt = now;
  if (next.lease && now >= next.lease.expiresAt && command.type !== 'recover') {
    next.status = 'quarantined';
    return next; // The requested action was NOT performed. Persist quarantine with CAS.
  }
  if (command.type === 'recover') {
    requireValue(next.lease && (next.status === 'quarantined' || now >= next.lease.expiresAt), 'RECOVERY_NOT_ALLOWED');
    requireValue(command.priorRunId === next.lease.runId && command.workersStopped === true, 'STOP_EVIDENCE_REQUIRED');
    const stoppedEvidence = durable(command.stoppedEvidence);
    Object.assign(next, checkpoint(command, next.lease.runId, now));
    next.lastOwner = retiredOwner(next.lease);
    next.recovery = { priorRunId: command.priorRunId, stoppedEvidence, at: now };
    next.lease = null; next.status = 'idle';
  } else {
    requireValue(next.status !== 'quarantined', 'COORDINATOR_QUARANTINED');
    if (command.type === 'acquire') {
      requireValue(next.status === 'idle', 'COORDINATOR_OWNED');
      requireValue(identifier(command.runId) && identifier(command.token)
        && command.runId !== next.lastOwner?.runId && tokenDigest(command.token) !== next.lastOwner?.tokenSha256, 'INVALID_OWNER');
      requireValue(Number.isSafeInteger(command.leaseMs) && command.leaseMs >= 1000 && command.leaseMs <= MAX_TTL
        && time(now + command.leaseMs), 'INVALID_LEASE');
      next.lease = { runId: command.runId, token: command.token, acquiredAt: now, expiresAt: now + command.leaseMs };
      next.status = 'leased';
    } else {
      requireValue(next.status === 'leased' && command.runId === next.lease.runId && command.token === next.lease.token, 'OWNER_FENCED');
      if (command.type === 'renew') {
        requireValue(Number.isSafeInteger(command.leaseMs) && command.leaseMs >= 1000 && command.leaseMs <= MAX_TTL
          && time(now + command.leaseMs), 'INVALID_LEASE');
        next.lease.expiresAt = Math.max(next.lease.expiresAt, now + command.leaseMs);
      } else if (command.type === 'checkpoint') Object.assign(next, checkpoint(command, command.runId, now));
      else {
        requireValue(command.workersStopped === true && command.worktreesClean === true, 'CLEAN_STOP_REQUIRED');
        requireValue(next.checkpoint?.runId === command.runId && next.checkpoint.codeHead === next.codeHead, 'CHECKPOINT_REQUIRED');
        durable(next.checkpoint.evidence?.[0]);
        next.lastOwner = retiredOwner(next.lease); next.lease = null; next.status = 'idle';
      }
    }
  }
  return json(next);
}
