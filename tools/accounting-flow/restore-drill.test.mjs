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
