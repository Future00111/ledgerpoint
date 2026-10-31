// Pure scheduling policy. The caller authenticates actors, supplies the trusted
// coordinator identity and persists returned states atomically. No task is executed here.
const KINDS = new Set(['implementation', 'contract', 'verification', 'external']);
const STATUSES = new Set(['pending', 'running', 'review', 'blocked', 'done', 'quarantined']);
const HELD = new Set(['running', 'review', 'quarantined']);
const COORDINATOR = new Set(['accept', 'reject', 'reopen', 'reprioritize', 'recover', 'approve', 'resolve']);
const text = value => typeof value === 'string' && value.trim().length > 0;
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const requireValue = (condition, code, message) => { if (!condition) fail(code, message); };
const priorityValid = value => Number.isSafeInteger(value) && value >= 0;
const timestamp = now => requireValue(Number.isSafeInteger(now) && now >= 0, 'INVALID_TIME', 'now must be epoch milliseconds.');
const checkpointValid = value => text(value);

export function validateCatalog(catalog) {
  requireValue(catalog?.version === 1 && Array.isArray(catalog.tasks) && catalog.tasks.length <= 1000, 'INVALID_CATALOG', 'Expected version 1 catalogue with at most 1000 tasks.');
  const ids = new Set();
  for (const task of catalog.tasks) {
    requireValue(task && typeof task.id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(task.id) && !ids.has(task.id), 'INVALID_CATALOG', 'Task IDs must be unique and safe.');
    ids.add(task.id);
    requireValue(priorityValid(task.priority) && KINDS.has(task.kind) && ['approved', 'owner_required'].includes(task.approval), 'INVALID_CATALOG', `Unknown priority, kind or authority for ${task.id}.`);
    requireValue(Array.isArray(task.dependencies) && new Set(task.dependencies).size === task.dependencies.length && task.dependencies.every(text), 'INVALID_CATALOG', `Invalid dependencies for ${task.id}.`);
    requireValue(Array.isArray(task.acceptance) && task.acceptance.length > 0 && task.acceptance.every(text), 'INVALID_CATALOG', `Acceptance criteria required for ${task.id}.`);
    requireValue(Array.isArray(task.files) && new Set(task.files).size === task.files.length && task.files.every(file => text(file) && file === file.trim() && !file.startsWith('/') && !/[\\*?\[\]{}\0]/.test(file) && !file.split('/').some((part, i, parts) => part === '.' || part === '..' || (!part && i !== parts.length - 1))), 'INVALID_CATALOG', `Use exact relative files or trailing-slash directories for ${task.id}.`);
    requireValue(task.status === undefined || task.status === 'done', 'INVALID_CATALOG', `Unknown seed status for ${task.id}.`);
  }
  const byId = new Map(catalog.tasks.map(task => [task.id, task]));
  const complete = new Set(), visiting = new Set();
  const visit = id => {
    requireValue(byId.has(id), 'INVALID_CATALOG', `Unknown dependency ${id}.`);
    requireValue(!visiting.has(id), 'INVALID_CATALOG', `Cyclic dependency at ${id}.`);
    if (complete.has(id)) return;
    visiting.add(id); byId.get(id).dependencies.forEach(visit); visiting.delete(id); complete.add(id);
  };
  catalog.tasks.forEach(task => visit(task.id));
  return catalog;
}

export function initialState(catalog) {
  validateCatalog(catalog);
  // Version 2 makes old workers fail closed: version 1 did not retain discovered dependencies.
  return { version: 2, revision: 0, tasks: Object.fromEntries(catalog.tasks.map(task => [task.id, { status: task.status === 'done' ? 'done' : 'pending', priority: task.priority }])), events: [] };
}

export function validateState(catalog, state) {
  validateCatalog(catalog);
  requireValue(state?.version === 2 && Number.isSafeInteger(state.revision) && state.revision >= 0 && state.tasks && Array.isArray(state.events), 'INVALID_STATE', 'Expected queue state version 2; older states need explicit reviewed migration.');
  requireValue(Object.keys(state.tasks).length === catalog.tasks.length && catalog.tasks.every(task => Object.hasOwn(state.tasks, task.id) && STATUSES.has(state.tasks[task.id]?.status)), 'INVALID_STATE', 'State must contain exactly the catalogue tasks.');
  for (const task of catalog.tasks) {
    const entry = state.tasks[task.id];
    requireValue(priorityValid(entry.priority ?? task.priority), 'INVALID_STATE', 'Invalid priority override.');
    if (HELD.has(entry.status)) requireValue(text(entry.owner) && text(entry.token) && Number.isSafeInteger(entry.leaseUntil) && entry.leaseUntil >= 0, 'INVALID_STATE', `Missing held lease for ${task.id}.`);
    requireValue(entry.blockers === undefined || Array.isArray(entry.blockers) && entry.blockers.every(blocker => ['task', 'decision', 'environment'].includes(blocker?.type) && text(blocker.reason) && (blocker.type !== 'task' || text(blocker.id) && Object.hasOwn(state.tasks, blocker.id))), 'INVALID_STATE', `Invalid blockers for ${task.id}.`);
    requireValue(entry.discoveredDependencies === undefined || Array.isArray(entry.discoveredDependencies) && new Set(entry.discoveredDependencies).size === entry.discoveredDependencies.length && entry.discoveredDependencies.every(id => text(id) && id !== task.id && Object.hasOwn(state.tasks, id)), 'INVALID_STATE', `Invalid discovered dependencies for ${task.id}.`);
  }
  validateDependencyGraph(catalog, state, 'INVALID_STATE');
  return state;
}

function dependencies(task, state) {
  const entry = state.tasks[task.id];
  return [...new Set([...task.dependencies, ...(entry.discoveredDependencies ?? []), ...(entry.blockers ?? []).filter(item => item.type === 'task').map(item => item.id)])];
}
function validateDependencyGraph(catalog, state, code) {
  const tasks = new Map(catalog.tasks.map(task => [task.id, task])), visiting = new Set(), complete = new Set();
  const visit = id => {
    requireValue(!visiting.has(id), code, `Discovered dependencies create a cycle at ${id}.`);
    if (complete.has(id)) return;
    visiting.add(id); dependencies(tasks.get(id), state).forEach(visit); visiting.delete(id); complete.add(id);
  };
  catalog.tasks.forEach(task => visit(task.id));
}
function appendBlockers(entry, additions) {
  entry.blockers = [...new Map([...(entry.blockers ?? []), ...additions].map(item => [JSON.stringify(item), item])).values()];
}
function overlap(a, b) {
  if (a === b) return true;
  return (a.endsWith('/') && (b.startsWith(a) || b === a.slice(0, -1))) || (b.endsWith('/') && (a.startsWith(b) || a === b.slice(0, -1)));
}
function event(state, now, actor, type, taskId, detail = {}) {
  state.events.push({ at: now, actor, type, ...(taskId ? { taskId } : {}), ...detail });
}
function reconcile(catalog, state, now) {
  for (const task of catalog.tasks) {
    const entry = state.tasks[task.id];
    if (['running', 'review'].includes(entry.status) && entry.leaseUntil <= now) {
      entry.status = 'quarantined';
      appendBlockers(entry, [{ type: 'environment', source: 'lease', reason: 'Worker lease expired; confirm it stopped and recover explicitly.' }]);
      event(state, now, 'scheduler', 'lease_expired', task.id);
    }
    const unmet = dependencies(task, state).filter(id => state.tasks[id].status !== 'done');
    if (unmet.length && HELD.has(entry.status) && entry.status !== 'quarantined') {
      entry.status = 'quarantined';
      appendBlockers(entry, unmet.map(id => ({ type: 'task', id, source: 'dependency', reason: 'An active dependency is no longer accepted.' })));
      event(state, now, 'scheduler', 'dependency_quarantine', task.id);
    }
  }
}
function approved(task, entry) { return task.approval === 'approved' && task.kind !== 'external' || approvalValid(entry.approvalEvidence, task.id); }
function approvalValid(evidence, id) { return evidence?.authority === 'owner' && evidence.scope === id && text(evidence.approvedBy) && text(evidence.reference); }
function ready(catalog, state, task, capabilities) {
  const entry = state.tasks[task.id];
  if (!['pending', 'blocked'].includes(entry.status) || !approved(task, entry) || task.rulesKnown === false) return false;
  if (capabilities && !capabilities.includes(task.kind)) return false;
  if (!dependencies(task, state).every(id => state.tasks[id].status === 'done')) return false;
  if ((entry.blockers ?? []).some(blocker => blocker.type !== 'task' || !blocker.id || state.tasks[blocker.id]?.status !== 'done')) return false;
  return !catalog.tasks.some(other => other.id !== task.id && HELD.has(state.tasks[other.id].status) && task.files.some(file => other.files.some(held => overlap(file, held))));
}

export function explainTask(catalog, state, task, { worker, now, capabilities } = {}) {
  validateCatalog(catalog); validateState(catalog, state); timestamp(now);
  requireValue(capabilities === undefined || Array.isArray(capabilities) && capabilities.every(kind => KINDS.has(kind)), 'INVALID_CAPABILITIES', 'Capabilities must be known task kinds.');
  const known = catalog.tasks.find(item => item.id === task?.id);
  requireValue(known, 'UNKNOWN_TASK', 'A catalogue task is required.');
  const current = structuredClone(state); reconcile(catalog, current, now);
  const entry = current.tasks[known.id], blockers = [];
  if (!['pending', 'blocked'].includes(entry.status)) blockers.push({ type: 'environment', reason: `Task is ${entry.status}; its current transition must be resolved first.` });
  if (worker && Object.values(current.tasks).some(item => item.owner === worker && ['running', 'quarantined'].includes(item.status))) blockers.push({ type: 'environment', reason: 'Worker already has running or quarantined work.' });
  if (!approved(known, entry)) blockers.push({ type: 'decision', reason: 'Recorded owner authority is required before this task can be claimed.' });
  if (known.rulesKnown === false) blockers.push({ type: 'decision', reason: 'Task rules remain unresolved in the catalogue.' });
  if (capabilities && !capabilities.includes(known.kind)) blockers.push({ type: 'environment', reason: `Worker does not advertise ${known.kind} capability.` });
  for (const id of dependencies(known, current)) if (current.tasks[id].status !== 'done') blockers.push({ type: 'task', id, reason: 'Prerequisite has not been accepted.' });
  for (const blocker of entry.blockers ?? []) if (blocker.type !== 'task' || current.tasks[blocker.id]?.status !== 'done') blockers.push(structuredClone(blocker));
  for (const other of catalog.tasks) if (other.id !== known.id && HELD.has(current.tasks[other.id].status) && known.files.some(file => other.files.some(held => overlap(file, held)))) blockers.push({ type: 'task', id: other.id, reason: 'Files are still leased by active, review or quarantined work.' });
  return { eligible: blockers.length === 0, blockers };
}

export function selectNext(catalog, state, { worker, now, capabilities } = {}) {
  validateCatalog(catalog); validateState(catalog, state); timestamp(now);
  requireValue(text(worker), 'INVALID_WORKER', 'A worker identity is required.');
  requireValue(capabilities === undefined || Array.isArray(capabilities) && capabilities.every(kind => KINDS.has(kind)), 'INVALID_CAPABILITIES', 'Capabilities must be known task kinds.');
  const current = structuredClone(state); reconcile(catalog, current, now);
  if (Object.values(current.tasks).some(entry => entry.owner === worker && ['running', 'quarantined'].includes(entry.status))) return null;
  return catalog.tasks.filter(task => ready(catalog, current, task, capabilities))
    .sort((a, b) => (current.tasks[a.id].priority ?? a.priority) - (current.tasks[b.id].priority ?? b.priority) || a.id.localeCompare(b.id))[0] ?? null;
}

function evidenceValid(evidence, review = false) {
  return evidence && text(evidence.commit) && text(evidence.summary) && Array.isArray(evidence.tests) && evidence.tests.length > 0 &&
    evidence.tests.every(test => text(test?.command) && test.passed === true) && (!review || evidence.reviewed === true && text(evidence.reviewer));
}
function clearLease(entry) { for (const key of ['owner', 'token', 'leaseUntil', 'workStarted']) delete entry[key]; }
function leaseDuration(value, now) { requireValue(Number.isSafeInteger(value) && value >= 1000 && value <= 24 * 60 * 60 * 1000 && Number.isSafeInteger(now + value), 'INVALID_LEASE', 'Lease must be between one second and 24 hours with a safe expiry.'); }
function descendants(catalog, state, id) {
  const found = new Set([id]);
  let changed = true;
  while (changed) { changed = false; for (const task of catalog.tasks) if (!found.has(task.id) && dependencies(task, state).some(dep => found.has(dep))) { found.add(task.id); changed = true; } }
  found.delete(id); return found;
}

export function transition(catalog, state, command, { now, coordinator } = {}) {
  validateCatalog(catalog); validateState(catalog, state); timestamp(now);
  requireValue(command && text(command.actor), 'INVALID_ACTOR', 'Command actor required.');
  const next = structuredClone(state), before = next.events.length;
  reconcile(catalog, next, now);
  const actor = command.actor, type = command.type;
  if (COORDINATOR.has(type)) requireValue(text(coordinator) && actor === coordinator, 'COORDINATOR_REQUIRED', 'This transition requires the configured coordinator.');
  let claim = null, resolvedBlockers;
  if (type === 'claim') {
    leaseDuration(command.leaseMs, now);
    requireValue(text(command.token) && command.token.length >= 8 && !next.events.some(item => item.token === command.token) && !Object.values(next.tasks).some(entry => entry.token === command.token), 'INVALID_TOKEN', 'A new unique lease token of at least eight characters is required.');
    const task = selectNext(catalog, next, { worker: actor, now, capabilities: command.capabilities });
    if (task) {
      const entry = next.tasks[task.id];
      entry.discoveredDependencies = dependencies(task, next).filter(id => !task.dependencies.includes(id));
      Object.assign(entry, { status: 'running', owner: actor, token: command.token, leaseUntil: now + command.leaseMs, workStarted: false });
      delete entry.blockers;
      claim = { taskId: task.id, token: command.token, leaseUntil: entry.leaseUntil, files: [...task.files] };
      event(next, now, actor, type, task.id, { token: command.token });
    }
  } else {
    const task = catalog.tasks.find(item => item.id === command.taskId), entry = next.tasks[command.taskId];
    requireValue(task && entry, 'UNKNOWN_TASK', 'A catalogue task is required.');
    if (['renew', 'checkpoint', 'block', 'submit'].includes(type)) requireValue(entry.status === 'running' && entry.owner === actor && entry.token === command.token && entry.leaseUntil > now, 'LEASE_REQUIRED', 'An active matching worker lease is required.');
    switch (type) {
      case 'renew':
        leaseDuration(command.leaseMs, now); entry.leaseUntil = now + command.leaseMs;
        if (command.workStarted === true) entry.workStarted = true;
        break;
      case 'checkpoint':
        requireValue(checkpointValid(command.checkpoint), 'CHECKPOINT_REQUIRED', 'Record a concrete worktree/commit checkpoint.');
        entry.checkpoint = command.checkpoint; entry.workStarted = true;
        break;
      case 'block':
        requireValue(Array.isArray(command.blockers) && command.blockers.length > 0 && command.blockers.every(blocker => ['task', 'decision', 'environment'].includes(blocker?.type) && text(blocker.reason) && (blocker.type !== 'task' || text(blocker.id) && blocker.id !== task.id && Object.hasOwn(next.tasks, blocker.id))), 'INVALID_BLOCKERS', 'Blockers need a type, reason and valid task reference when applicable.');
        requireValue(!entry.workStarted || checkpointValid(command.checkpoint), 'CHECKPOINT_REQUIRED', 'Checkpoint started work before releasing its lease.');
        if (command.checkpoint !== undefined) { requireValue(checkpointValid(command.checkpoint), 'CHECKPOINT_REQUIRED', 'Invalid checkpoint.'); entry.checkpoint = command.checkpoint; }
        entry.status = 'blocked'; entry.blockers = command.blockers.map(({ type, id, reason }) => ({ type, ...(id ? { id } : {}), reason }));
        entry.discoveredDependencies = dependencies(task, next).filter(id => !task.dependencies.includes(id));
        validateDependencyGraph(catalog, next, 'DEPENDENCY_CYCLE'); clearLease(entry);
        break;
      case 'submit':
        requireValue(evidenceValid(command.evidence), 'EVIDENCE_REQUIRED', 'Submit commit, summary and passing test commands.');
        entry.status = 'review'; entry.evidence = structuredClone(command.evidence); entry.workStarted = true;
        break;
      case 'accept':
        requireValue(entry.status === 'review' && dependencies(task, next).every(id => next.tasks[id].status === 'done'), 'REVIEW_REQUIRED', 'Only dependency-current reviewed work can be accepted.');
        requireValue(evidenceValid(command.evidence, true) && command.evidence.reviewer !== entry.owner && command.evidence.commit === entry.evidence?.commit, 'EVIDENCE_REQUIRED', 'Acceptance requires independent review and passing evidence for the submitted commit.');
        entry.status = 'done'; entry.evidence = structuredClone(command.evidence); clearLease(entry); delete entry.blockers;
        break;
      case 'reject':
        requireValue(entry.status === 'review' && text(command.reason), 'REVIEW_REQUIRED', 'Reject a review with a concrete reason.');
        entry.status = 'quarantined'; appendBlockers(entry, [{ type: 'decision', source: 'review', reason: command.reason }]);
        break;
      case 'reopen':
        requireValue(['done', 'blocked', 'pending'].includes(entry.status) && text(command.reason), 'RECOVERY_REQUIRED', 'Active/review/quarantined work requires rejection or recovery, not reopening.');
        entry.discoveredDependencies = dependencies(task, next).filter(id => !task.dependencies.includes(id));
        entry.status = 'pending'; delete entry.blockers; delete entry.evidence; clearLease(entry);
        for (const id of descendants(catalog, next, task.id)) {
          const child = next.tasks[id];
          appendBlockers(child, [{ type: 'task', id: task.id, source: 'dependency', reason: `Dependency reopened: ${command.reason}` }]);
          if (HELD.has(child.status)) child.status = 'quarantined';
          else { child.status = 'blocked'; clearLease(child); }
        }
        break;
      case 'resolve':
        requireValue(entry.status === 'blocked' && text(command.reason), 'RESOLUTION_REQUIRED', 'Resolve only stopped blocked work with a reviewed concrete reason.');
        requireValue(Array.isArray(command.resolvedBlockers) && command.resolvedBlockers.length > 0 && new Set(command.resolvedBlockers).size === command.resolvedBlockers.length && command.resolvedBlockers.every(index => Number.isSafeInteger(index) && index >= 0 && index < (entry.blockers ?? []).length && entry.blockers[index].type !== 'task'), 'RESOLUTION_REQUIRED', 'Select existing environment/decision blocker indices; real dependencies cannot be removed.');
        resolvedBlockers = command.resolvedBlockers.map(index => structuredClone(entry.blockers[index]));
        entry.blockers = entry.blockers.filter((_, index) => !command.resolvedBlockers.includes(index));
        entry.status = entry.blockers.length ? 'blocked' : 'pending';
        break;
      case 'reprioritize':
        requireValue(priorityValid(command.priority), 'INVALID_PRIORITY', 'Priority must be a non-negative integer.'); entry.priority = command.priority;
        break;
      case 'recover':
        requireValue(entry.status === 'quarantined' && command.workerStopped === true && checkpointValid(command.checkpoint), 'RECOVERY_REQUIRED', 'Confirm the old worker stopped and record its checkpoint before recovery.');
        entry.blockers = (entry.blockers ?? []).filter(blocker => !['lease', 'review'].includes(blocker.source));
        entry.status = entry.blockers.length ? 'blocked' : 'pending'; entry.checkpoint = command.checkpoint; clearLease(entry);
        break;
      case 'approve':
        requireValue(approvalValid(command.approvalEvidence, task.id), 'APPROVAL_REQUIRED', 'Record owner authority, approving person, source reference and exact task scope.');
        entry.approvalEvidence = structuredClone(command.approvalEvidence);
        break;
      default: fail('UNKNOWN_COMMAND', 'Unknown queue transition.');
    }
    event(next, now, actor, type, task.id, {
      ...(command.reason ? { reason: command.reason } : {}),
      ...(resolvedBlockers ? { resolvedBlockers } : {}),
      ...(command.evidence ? { evidence: structuredClone(command.evidence) } : {}),
      ...(command.approvalEvidence ? { approvalEvidence: structuredClone(command.approvalEvidence) } : {}),
      ...(command.checkpoint ? { checkpoint: command.checkpoint } : {}),
      ...(command.blockers ? { blockers: structuredClone(command.blockers) } : {}),
    });
  }
  reconcile(catalog, next, now);
  if (next.events.length !== before) next.revision++;
  return { state: next, claim };
}
