import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import path from 'node:path';
import { mkdirSync, lstatSync, existsSync, openSync, readFileSync, writeFileSync, fsyncSync, closeSync, renameSync, rmSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

const MAX_JSON_BYTES = 16 * 1024 * 1024;
export class QueueStoreError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new QueueStoreError(code, message); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function present(file) { try { lstatSync(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }

function noSymlink(file) {
  try { if (lstatSync(file).isSymbolicLink()) fail('UNSAFE_PATH', 'Queue files must not be symbolic links.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
function syncDirectory(directory) {
  const fd = openSync(directory, 'r');
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function ensureDirectory(directory) {
  const existed = present(directory);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  noSymlink(directory);
  if (!lstatSync(directory).isDirectory()) fail('UNSAFE_PATH', 'The queue directory must be a directory.');
  if (!existed) syncDirectory(path.dirname(directory));
}
export function readJSON(file) {
  noSymlink(file);
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.size > MAX_JSON_BYTES) fail('INVALID_STATE', 'Queue JSON is missing, oversized or not a regular file.');
  let value;
  try { value = JSON.parse(readFileSync(file, 'utf8')); }
  catch { fail('INVALID_STATE', 'Queue JSON is corrupt; preserve it and investigate before recovery.'); }
  if (!plain(value)) fail('INVALID_STATE', 'Queue JSON must contain an object.');
  return value;
}
export function atomicWriteJSON(file, value) {
  const directory = path.dirname(file);
  ensureDirectory(directory); noSymlink(file);
  const bytes = JSON.stringify(value, null, 2) + '\n';
  if (Buffer.byteLength(bytes) > MAX_JSON_BYTES) fail('INVALID_STATE', 'Queue JSON exceeds the supported size.');
  const temporary = path.join(directory, `.${path.basename(file)}.${randomUUID()}.tmp`);
  let fd;
  try {
    fd = openSync(temporary, 'wx', 0o600);
    writeFileSync(fd, bytes, 'utf8'); fsyncSync(fd); closeSync(fd); fd = undefined;
    renameSync(temporary, file); syncDirectory(directory);
  } finally {
    if (fd !== undefined) closeSync(fd);
    rmSync(temporary, { force: true });
  }
}

function ownerRecord() { return { version: 1, token: randomUUID(), pid: process.pid, host: hostname(), createdAt: new Date().toISOString() }; }
function validOwner(owner) {
  return plain(owner) && owner.version === 1 && typeof owner.token === 'string' && owner.token.length >= 8 &&
    Number.isSafeInteger(owner.pid) && owner.pid > 0 && typeof owner.host === 'string' && owner.host && typeof owner.createdAt === 'string';
}
function acquireLock(directory) {
  try { mkdirSync(directory, { mode: 0o700 }); }
  catch (error) {
    if (error.code === 'EEXIST') fail('QUEUE_LOCKED', 'The queue is locked. Inspect the lock; do not retry by deleting it or stealing it by age.');
    throw error;
  }
  const owner = ownerRecord();
  try { atomicWriteJSON(path.join(directory, 'owner.json'), owner); syncDirectory(path.dirname(directory)); }
  catch (error) { rmSync(directory, { recursive: true, force: true }); throw error; }
  return owner;
}
function releaseLock(directory, owner) {
  let current;
  try { current = readJSON(path.join(directory, 'owner.json')); }
  catch { fail('LOCK_CHANGED', 'Queue lock ownership cannot be verified; it was left intact.'); }
  if (current.token !== owner.token || current.pid !== owner.pid || current.host !== owner.host) fail('LOCK_CHANGED', 'Queue lock ownership changed; it was left intact.');
  rmSync(directory, { recursive: true }); syncDirectory(path.dirname(directory));
}

export function createQueueStore({ directory, validateState }) {
  if (typeof validateState !== 'function') throw new TypeError('A state validator is required.');
  const stateFile = path.join(directory, 'queue.json');
  const lockDirectory = path.join(directory, 'lock');
  const recoveryDirectory = path.join(directory, 'recovery-lock');
  function validate(state) {
    if (!plain(state) || !Number.isSafeInteger(state.revision) || state.revision < 0) fail('INVALID_STATE', 'Queue state revision is invalid.');
    validateState(state);
    return state;
  }
  function read() { noSymlink(directory); return validate(readJSON(stateFile)); }
  function readOptional() {
    noSymlink(directory);
    if (!present(stateFile)) return null;
    return read();
  }
  async function locked(action) {
    ensureDirectory(directory);
    if (existsSync(recoveryDirectory)) fail('QUEUE_LOCKED', 'Explicit queue-lock recovery is in progress or needs investigation.');
    const owner = acquireLock(lockDirectory);
    try {
      if (existsSync(recoveryDirectory)) fail('QUEUE_LOCKED', 'Queue-lock recovery started; no state was changed.');
      return await action();
    } finally { releaseLock(lockDirectory, owner); }
  }
  function checkRevision(state, expectedRevision) {
    if (expectedRevision !== undefined && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || state.revision !== expectedRevision)) fail('REVISION_CONFLICT', 'Queue revision changed. Read status and reconsider the command.');
  }
  return {
    stateFile,
    read,
    readOptional,
    lockInfo() {
      if (!existsSync(lockDirectory)) return null;
      const owner = readJSON(path.join(lockDirectory, 'owner.json'));
      if (!validOwner(owner)) fail('INVALID_LOCK', 'Queue lock metadata is corrupt; preserve it for manual investigation.');
      return owner;
    },
    async initialize({ initialState, checkpointPath, prepareState = state => state }) {
      return locked(() => {
        const current = readOptional();
        if (current) return { state: current, initialized: false, restored: false };
        const restored = Boolean(checkpointPath && present(checkpointPath));
        const state = validate(prepareState(restored ? readJSON(checkpointPath) : initialState()));
        atomicWriteJSON(stateFile, state);
        return { state, initialized: true, restored };
      });
    },
    async mutate({ expectedRevision, reduce }) {
      if (typeof reduce !== 'function') throw new TypeError('A state reducer is required.');
      return locked(async () => {
        const before = read(); checkRevision(before, expectedRevision);
        const result = await reduce(structuredClone(before));
        if (!plain(result) || !plain(result.state)) fail('INVALID_TRANSITION', 'The transition did not return queue state.');
        validate(result.state);
        if (result.state.revision === before.revision) {
          if (!isDeepStrictEqual(result.state, before)) fail('INVALID_TRANSITION', 'A changed state must advance the revision.');
        } else {
          if (result.state.revision !== before.revision + 1) fail('INVALID_TRANSITION', 'A transition must advance the revision exactly once.');
          atomicWriteJSON(stateFile, result.state);
        }
        return result;
      });
    },
    async exportCheckpoint(checkpointPath, { expectedRevision }) {
      if (!Number.isSafeInteger(expectedRevision)) fail('REVISION_REQUIRED', 'Export requires the revision from a fresh status read.');
      return locked(() => {
        const state = read(); checkRevision(state, expectedRevision);
        atomicWriteJSON(checkpointPath, state);
        return { revision: state.revision, exported: true };
      });
    },
    async recoverLock({ expectedToken, reason }) {
      if (typeof expectedToken !== 'string' || expectedToken.length < 8 || typeof reason !== 'string' || !reason.trim()) fail('INVALID_RECOVERY', 'Explicit recovery requires the observed lock token and a reason.');
      ensureDirectory(directory);
      const recoveryOwner = acquireLock(recoveryDirectory);
      try {
        const owner = readJSON(path.join(lockDirectory, 'owner.json'));
        if (!validOwner(owner) || owner.token !== expectedToken) fail('LOCK_CHANGED', 'The lock no longer matches the inspected owner.');
        if (owner.host !== hostname()) fail('FOREIGN_LOCK', 'The lock belongs to another host. Verify that worker separately; automatic recovery is refused.');
        let alive = true;
        try { process.kill(owner.pid, 0); }
        catch (error) { if (error.code === 'ESRCH') alive = false; else throw error; }
        if (alive) fail('LOCK_OWNER_ALIVE', 'The lock owner is still alive; stop and inspect that worker before recovery.');
        const destination = path.join(directory, `recovered-lock-${owner.token}`);
        if (existsSync(destination)) fail('INVALID_RECOVERY', 'Recovery evidence for this lock already exists.');
        renameSync(lockDirectory, destination); syncDirectory(directory);
        atomicWriteJSON(path.join(destination, 'recovery.json'), { version: 1, recoveredAt: new Date().toISOString(), reason, priorOwner: owner });
        return { recovered: true, token: owner.token };
      } finally { releaseLock(recoveryDirectory, recoveryOwner); }
    },
  };
}
