import test from 'node:test';
import assert from 'node:assert/strict';
import { assertRestoreTarget, assertSameFingerprint } from './restore-drill.mjs';

const target = { directory: '/tmp/ledgerly-accounting-flow-tests-Ab1234', socket: '/tmp/ledgerly-accounting-flow-tests-Ab1234/socket', port: 55441 };
test('restore refuses shared databases, TCP, altered ports, sibling directories and alternate database names', () => {
  for (const changes of [
    { directory: '/tmp/ledgerly-pr27-review' }, { socket: 'localhost' }, { port: 5432 },
    { socket: '/tmp/ledgerly-accounting-flow-tests-Zz9999/socket' },
    { sourceDatabase: 'production' }, { restoreDatabase: 'ledgerly_accounting_flow_test' },
    { directory: '/tmp/ledgerly-accounting-flow-tests-Ab1234/../review' },
  ]) assert.throws(() => assertRestoreTarget({ ...target, ...changes }), /fresh, isolated/);
  assert.equal(assertRestoreTarget(target).restoreDatabase, 'ledgerly_accounting_flow_restore_test');
});
test('restore comparison detects changed amounts, missing source/audit records and changed protections', () => {
  const baseline = { tables: [{ table: 'source', rows: 2, sha256: 'original' }, { table: 'audit', rows: 3, sha256: 'history' }], controls: 'restricted' };
  assert.doesNotThrow(() => assertSameFingerprint(baseline, structuredClone(baseline)));
  for (const changed of [
    { ...baseline, controls: 'unsafe' },
    { ...baseline, tables: baseline.tables.slice(0, 1) },
    { ...baseline, tables: [{ ...baseline.tables[0], sha256: 'different-amount' }, baseline.tables[1]] },
    { ...baseline, tables: [baseline.tables[0], { ...baseline.tables[1], rows: 2 }] },
  ]) assert.throws(() => assertSameFingerprint(baseline, changed), /do not match/);
});

// Exercise the actual partial-schema entry and CommonJS format used by CI.
// Without a disposable socket it must stop at its target guard, before any DB.
test('partial-schema CommonJS bundle has no restore orchestration dependency', async () => {
  const { createRequire } = await import('node:module');
  const { mkdtempSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { fileURLToPath } = await import('node:url');
  const path = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const api = path.join(root, 'artifacts/api-server');
  const { buildSync } = createRequire(path.join(api, 'package.json'))('esbuild');
  const dir = mkdtempSync(path.join(tmpdir(), 'ledgerpoint-import-boundary-'));
  try {
    const outfile = path.join(dir, 'partial-schema.cjs');
    const result = buildSync({ entryPoints: [path.join(root, 'tools/development/migrations/partial-schema.test.mjs')],
      outfile, bundle: true, platform: 'node', format: 'cjs', external: ['pg', '@clerk/express'],
      metafile: true, logLevel: 'silent' });
    assert.equal(result.warnings.length, 0);
    assert.ok(!Object.keys(result.metafile.inputs).some(name => name.includes('backup-restore/') || name.endsWith('/restore-drill.mjs')));
    const run = spawnSync(process.execPath, [outfile], { encoding: 'utf8', cwd: root,
      env: { PATH: process.env.PATH, NODE_PATH: path.join(api, 'node_modules'),
        DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/no_database', ACCOUNTING_FLOW_TEST_SOCKET: '' } });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /Fresh disposable accounting socket required/);
    assert.doesNotMatch(run.stderr, /ERR_INVALID_ARG_TYPE|fileURLToPath/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
