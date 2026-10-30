#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createQueueStore, QueueStoreError, readJSON } from './store.mjs';

const COMMANDS = new Set(['status', 'listready', 'init', 'export', 'recover-lock', 'claim', 'renew', 'checkpoint', 'block', 'submit', 'accept', 'reject', 'reopen', 'reprioritize', 'recover', 'approve']);
const COORDINATOR_COMMANDS = new Set(['init', 'export', 'recover-lock', 'accept', 'reject', 'reopen', 'reprioritize', 'recover', 'approve']);
const COMMAND_FIELDS = {
  status: ['capabilities'], listready: ['capabilities'], init: [], export: ['expectedRevision'], 'recover-lock': ['expectedToken', 'reason'],
  claim: ['leaseMs', 'capabilities', 'expectedRevision'], renew: ['taskId', 'token', 'leaseMs', 'workStarted', 'expectedRevision'],
  checkpoint: ['taskId', 'token', 'checkpoint', 'expectedRevision'], block: ['taskId', 'token', 'blockers', 'checkpoint', 'expectedRevision'],
  submit: ['taskId', 'token', 'evidence', 'expectedRevision'], accept: ['taskId', 'evidence', 'expectedRevision'],
  reject: ['taskId', 'reason', 'expectedRevision'], reopen: ['taskId', 'reason', 'expectedRevision'],
  reprioritize: ['taskId', 'priority', 'expectedRevision'], recover: ['taskId', 'workerStopped', 'checkpoint', 'expectedRevision'],
  approve: ['taskId', 'approvalEvidence', 'expectedRevision'],
};
const fail = (code, message) => { throw new QueueStoreError(code, message); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function resolveRepositoryPaths(cwd = process.cwd()) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const root = git('rev-parse', '--show-toplevel');
  const common = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  return { root, directory: path.join(common, 'ledgerly-work'),
    catalog: path.join(root, 'docs/development/work-backlog.json'), checkpoint: path.join(root, 'docs/development/work-state.json') };
}

async function readCommand(argv, input) {
  if (argv.length > 1 || argv[0] && !COMMANDS.has(argv[0])) fail('INVALID_COMMAND', 'Use one supported command name and an optional JSON object on stdin.');
  let body = '', size = 0;
  if (!input.isTTY) {
    for await (const chunk of input) {
      size += Buffer.byteLength(chunk);
      if (size > 65536) fail('INVALID_COMMAND', 'Command JSON must be no larger than 64 KiB.');
      body += chunk;
    }
  }
  let command;
  try { command = body.trim() ? JSON.parse(body) : {}; }
  catch { fail('INVALID_COMMAND', 'Command stdin must contain valid JSON.'); }
  if (!plain(command)) fail('INVALID_COMMAND', 'Command stdin must contain an object.');
  if (argv[0] && command.type && command.type !== argv[0]) fail('INVALID_COMMAND', 'Command name and JSON type disagree.');
  command.type ??= argv[0];
  if (!COMMANDS.has(command.type)) fail('INVALID_COMMAND', 'A supported command type is required.');
  if (Object.hasOwn(command, 'coordinator') || Object.hasOwn(command, 'role')) fail('INVALID_COMMAND', 'Authority comes from host configuration, not the command.');
  if (Object.keys(command).some(key => !['type', 'actor', ...COMMAND_FIELDS[command.type]].includes(key))) fail('INVALID_COMMAND', 'Command contains an unsupported field.');
  if (command.actor !== undefined && (typeof command.actor !== 'string' || !command.actor.trim() || command.actor.length > 128 || /[\r\n\0]/.test(command.actor))) fail('INVALID_COMMAND', 'Actor must be a short non-empty identifier.');
  if (!['status', 'listready'].includes(command.type) && !command.actor) fail('INVALID_COMMAND', 'A command actor is required.');
  return command;
}

function configuredCoordinator(directory, env) {
  const config = path.join(directory, 'config.json');
  const value = env.LEDGERLY_QUEUE_COORDINATOR || (existsSync(config) ? readJSON(config).coordinator : null);
  if (value != null && (typeof value !== 'string' || !value.trim() || value.length > 128 || /[\r\n\0]/.test(value))) fail('INVALID_CONFIG', 'Configured coordinator identity is invalid.');
  return value;
}

export async function main({ argv = process.argv.slice(2), input = process.stdin, env = process.env, cwd = process.cwd() } = {}) {
  if (argv.length === 1 && ['help', '--help'].includes(argv[0])) return { ok: true,
    usage: 'node tools/development/work-queue/cli.mjs <command> < command.json',
    commands: [...COMMANDS], coordinatorConfiguration: 'LEDGERLY_QUEUE_COORDINATOR or git-common-dir/ledgerly-work/config.json',
    claim: 'Supply actor and optional leaseMs/capabilities. No taskId: the queue selects the highest-priority eligible task.',
    export: 'Coordinator only; expectedRevision from status is required.',
    recovery: 'No TTL lock stealing. Inspect status lock metadata; explicit recover-lock requires expectedToken and reason and a dead same-host owner.',
    catalogueChanges: 'Runtime is pinned to the catalogue digest. To change it: stop all workers, resolve held leases, export a checkpoint, independently review catalogue/state migration preserving completed work and events, archive the old runtime, then initialise the reviewed checkpoint. Never delete runtime to bypass a mismatch.',
    execution: 'This CLI records and coordinates work. It does not launch agents, execute tasks, merge, deploy or call financial services.' };
  const command = await readCommand(argv, input);
  const locations = resolveRepositoryPaths(cwd);
  const core = await import('./core.mjs');
  const catalog = core.validateCatalog(readJSON(locations.catalog));
  const canonical = value => Array.isArray(value) ? value.map(canonical) : plain(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  const digest = createHash('sha256').update(JSON.stringify(canonical(catalog))).digest('hex');
  const validateState = state => {
    core.validateState(catalog, state);
    if (state.catalogDigest !== digest) fail('CATALOG_MISMATCH', 'The runtime/checkpoint catalogue differs from this worktree. Stop and reconcile through the coordinator; do not reset state or reinterpret file leases.');
    return state;
  };
  const stampSeed = state => ({ ...state, catalogDigest: state.catalogDigest ?? digest });
  const store = createQueueStore({ directory: locations.directory, validateState });
  const coordinator = configuredCoordinator(locations.directory, env);
  const now = Date.now();
  if (['status', 'listready'].includes(command.type)) {
    const runtime = store.readOptional();
    const state = runtime || validateState(stampSeed(existsSync(locations.checkpoint) ? readJSON(locations.checkpoint) : core.initialState(catalog)));
    const worker = command.actor || '__status__';
    const options = { worker, now, capabilities: command.capabilities };
    const rows = catalog.tasks.map(task => {
      const record = state.tasks[task.id];
      const explanation = core.explainTask(catalog, state, task, options);
      return { id: task.id, title: task.title, kind: task.kind, priority: record.priority, status: record.status,
        owner: record.owner || null, leaseUntil: record.leaseUntil || null, files: task.files,
        eligible: explanation.eligible, blockers: explanation.blockers };
    }).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
    return { ok: true, initialized: Boolean(runtime), source: runtime ? 'runtime' : existsSync(locations.checkpoint) ? 'checkpoint' : 'catalog',
      revision: state.revision, eventCount: state.events.length, lock: store.lockInfo(),
      next: core.selectNext(catalog, state, options)?.id || null,
      tasks: command.type === 'listready' ? rows.filter(task => task.eligible) : rows };
  }
  if (!coordinator) fail('CONFIG_REQUIRED', 'Configure the coordinator identity before mutating the queue.');
  if (env.LEDGERLY_QUEUE_ACTOR && command.actor !== env.LEDGERLY_QUEUE_ACTOR) fail('ACTOR_MISMATCH', 'Command actor does not match the configured caller.');
  if (COORDINATOR_COMMANDS.has(command.type) && command.actor !== coordinator) fail('COORDINATOR_REQUIRED', 'This queue operation requires the configured coordinator.');
  if (command.type === 'init') {
    const result = await store.initialize({ initialState: () => core.initialState(catalog), checkpointPath: locations.checkpoint, prepareState: stampSeed });
    return { ok: true, initialized: result.initialized, restored: result.restored, revision: result.state.revision };
  }
  if (command.type === 'export') return { ok: true, ...await store.exportCheckpoint(locations.checkpoint, { expectedRevision: command.expectedRevision }) };
  if (command.type === 'recover-lock') return { ok: true, ...await store.recoverLock({ expectedToken: command.expectedToken, reason: command.reason }) };
  const expectedRevision = command.expectedRevision;
  delete command.expectedRevision;
  if (command.type === 'claim') {
    if (Object.hasOwn(command, 'taskId') || Object.hasOwn(command, 'token')) fail('INVALID_COMMAND', 'Claim selects the next task automatically and creates a fresh token.');
    command.token = randomUUID(); command.leaseMs ??= 15 * 60 * 1000;
  }
  const result = await store.mutate({ expectedRevision, reduce: state => core.transition(catalog, state, command, { now, coordinator }) });
  return { ok: true, revision: result.state.revision, claim: result.claim || null,
    task: command.taskId ? { id: command.taskId, ...result.state.tasks[command.taskId] } : result.claim ? catalog.tasks.find(task => task.id === result.claim.taskId) : null };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(result => process.stdout.write(JSON.stringify(result) + '\n')).catch(error => {
    // No commands, environment, file contents, stacks or subprocess stderr are echoed.
    const code = typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(error.code) ? error.code : 'QUEUE_ERROR';
    const message = error instanceof QueueStoreError ? error.message : 'The queue operation failed validation or could not be completed. Inspect local state without discarding it.';
    process.stdout.write(JSON.stringify({ ok: false, error: { code, message } }) + '\n');
    process.exitCode = 1;
  });
}
