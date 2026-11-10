import test from 'node:test';
import assert from 'node:assert/strict';
import { proveRecoveryControl } from './recovery-controls.mjs';

function fixture({ fingerprintFails = false, rollbackFails = false } = {}) {
  const queries = [];
  let value = 'original', snapshot;
  const client = { query: async sql => {
    queries.push(sql);
    if (sql === 'BEGIN') snapshot = value;
    if (sql === 'CORRUPT') value = 'corrupt';
    if (sql === 'ROLLBACK' && !rollbackFails) value = snapshot;
    if (sql === 'SELECT fingerprint') {
      if (fingerprintFails && value === 'corrupt') throw new Error('inspection failed');
      return value;
    }
    return { rows: [] };
  } };
  const fingerprint = async connection => {
    await connection.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    try {
      const result = await connection.query('SELECT fingerprint');
      await connection.query('COMMIT');
      return result;
    } catch (error) { await connection.query('ROLLBACK'); throw error; }
  };
  return { client, queries, fingerprint, value: () => value };
}
test('negative control detects changed fingerprint, never commits mutation and verifies rollback', async () => {
  const f = fixture();
  await proveRecoveryControl(f.client, 'original', 'CORRUPT', f.fingerprint);
  assert.equal(f.value(), 'original');
  assert.deepEqual(f.queries.slice(0, 7), ['BEGIN','CORRUPT','SAVEPOINT recovery_fingerprint','SELECT fingerprint','RELEASE SAVEPOINT recovery_fingerprint','ROLLBACK','BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY']);
  assert.equal(f.queries.filter(q => q === 'SELECT fingerprint').length, 2);
});
test('unchanged fingerprints fail the control and still roll back', async () => {
  const f = fixture();
  await assert.rejects(proveRecoveryControl(f.client, 'original', 'CORRUPT', async () => 'original'), /escaped fingerprint/);
  assert.equal(f.value(), 'original');
  assert.equal(f.queries.at(-1), 'ROLLBACK');
});
test('failed fingerprint inspection rolls back both savepoint and outer mutation', async () => {
  const f = fixture({ fingerprintFails: true });
  await assert.rejects(proveRecoveryControl(f.client, 'original', 'CORRUPT', f.fingerprint), /inspection failed/);
  assert.deepEqual(f.queries.slice(-3), ['ROLLBACK TO SAVEPOINT recovery_fingerprint','RELEASE SAVEPOINT recovery_fingerprint','ROLLBACK']);
  assert.equal(f.value(), 'original');
});
test('restored fixture must match after rollback before the control can pass', async () => {
  const f = fixture({ rollbackFails: true });
  await assert.rejects(proveRecoveryControl(f.client, 'original', 'CORRUPT', f.fingerprint), /did not preserve/);
});
