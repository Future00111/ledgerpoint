import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { applicationRuntimeTarget } from './runtime-target.mjs';

test('native acceptance binds each phase to its fixed disposable socket, database and restricted role', () => {
  const source = '/tmp/ledgerly-accounting-flow-tests-Ab1234/socket';
  const restored = '/tmp/ledgerpoint-application-recovery-Ab1234/socket';
  assert.equal(applicationRuntimeTarget('prepare', source).port, 55441);
  const target = applicationRuntimeTarget('verify', restored);
  assert.equal(target.port, 55443);
  assert.equal(target.database, 'postgres');
  assert.equal(new URL(target.url).username, 'ledgerly_api');
  for (const [phase, socket] of [
    ['verify', source], ['prepare', restored], ['unknown', restored], ['verify', 'localhost'],
    ['verify', '/tmp/production/socket'], ['verify', restored.replace('/socket', '/../socket')],
  ]) assert.throws(() => applicationRuntimeTarget(phase, socket), /Fresh disposable/);
});

test('actual native acceptance bundle rejects inherited database URLs before loading the runtime', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const api = path.join(root, 'artifacts/api-server');
  const { buildSync } = createRequire(path.join(api, 'package.json'))('esbuild');
  const directory = mkdtempSync('/tmp/ledgerpoint-application-recovery-');
  try {
    const socket = path.join(directory, 'socket'), outfile = path.join(directory, 'acceptance.cjs');
    mkdirSync(socket);
    const result = buildSync({ absWorkingDir: root, entryPoints: [path.join(root, 'tools/operations/backup-restore/runtime-acceptance.ts')],
      outfile, bundle: true, platform: 'node', format: 'cjs', external: ['pg', '@clerk/express'], metafile: true, logLevel: 'silent' });
    assert.equal(result.warnings.length, 0);
    for (const input of Object.keys(result.metafile.inputs)) {
      const resolved = path.resolve(root, input);
      if (!resolved.includes(`${path.sep}node_modules${path.sep}`))
        assert.ok(resolved.startsWith(root), `Native source resolved outside the current worktree: ${input}`);
    }
    assert.ok(Object.keys(result.metafile.inputs).includes('lib/db/src/index.ts'));
    for (const service of ['payments.ts', 'conditionalDiscount.ts', 'canonicalPosting.ts'])
      assert.ok(Object.keys(result.metafile.inputs).some(name => name.endsWith('/' + service)), `Missing native ${service}`);
    const run = spawnSync(process.execPath, [outfile, 'verify'], { encoding: 'utf8', cwd: root, timeout: 5000,
      env: { PATH: process.env.PATH, NODE_ENV: 'test', NODE_PATH: path.join(api, 'node_modules'),
        APPLICATION_RECOVERY_SOCKET: socket, DATABASE_URL: 'postgresql://unused@127.0.0.1:1/no_database' } });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /AssertionError/);
    assert.doesNotMatch(run.stderr, /ECONNREFUSED|ENOTFOUND|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
