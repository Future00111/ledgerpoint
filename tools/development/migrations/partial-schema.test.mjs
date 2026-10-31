// Executed only by the fresh Unix-socket accounting-flow runner; never ambient DB.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { realpathSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { amendmentSchema, amendmentHistory } from '../../../artifacts/api-server/src/services/accountingDocuments/amendments.ts';
import { fingerprintDatabase, assertSameFingerprint } from '../../accounting-flow/restore-drill.mjs';

const socket = process.env.ACCOUNTING_FLOW_TEST_SOCKET ?? '';
if (!/^\/tmp\/ledgerly-accounting-flow-tests-[A-Za-z0-9]{6}\/socket$/.test(socket))
  throw Error('Fresh disposable accounting socket required');
const directory = path.dirname(socket);
if (realpathSync(socket) !== socket || realpathSync(directory) !== directory)
  throw Error('Disposable target must not use symlinks');
const admin = new pg.Client({ host: socket, port: 55441, user: 'w03_bootstrap',
  database: 'ledgerly_accounting_flow_test', password: '', ssl: false, options: '-c timezone=UTC' });
let connected = false;
before(async () => {
  await admin.connect(); connected = true;
  const { rows: [identity] } = await admin.query(`SELECT current_database() database,
    current_user actor, inet_server_addr() address, current_setting('data_directory') directory`);
  assert.deepEqual(identity, { database: 'ledgerly_accounting_flow_test', actor: 'w03_bootstrap',
    address: null, directory: path.join(directory, 'data') });
});
after(async () => { if (connected) await admin.end(); });

async function restricted() {
  await admin.query('SET LOCAL ROLE ledgerly_api');
  const { rows: [flags] } = await admin.query(`SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,
    pg_has_role(current_user,'ledgerly_canonical_owner','MEMBER') owner_member
    FROM pg_roles WHERE rolname=current_user`);
  assert.ok(flags); assert.ok(Object.values(flags).every(value => value === false));
}
async function unchangedAfterRollback(action) {
  const before = await fingerprintDatabase(admin);
  try { await admin.query('BEGIN'); await action(); }
  finally { await admin.query('ROLLBACK'); }
  assertSameFingerprint(before, await fingerprintDatabase(admin));
}
const original = { id: 'a0000000-0000-4000-8000-000000000001', revision: 'original',
  status: 'posted', source: { issue_date: '2026-10-01' } };

for (const missing of ['accounting_document_amendments', 'accounting_document_amendment_heads']) {
  test(`real PostgreSQL: missing ${missing} fails closed without repair or evidence changes`, async () => {
    await unchangedAfterRollback(async () => {
      await admin.query(`ALTER TABLE ${missing} RENAME TO partial_schema_held_table`);
      await restricted();
      for (const read of [() => amendmentSchema(admin), () => amendmentHistory(admin, original.id, original)])
        await assert.rejects(read, error => error.code === 'CORRECTION_SCHEMA_INCOMPLETE' && error.status === 503);
      assert.equal((await admin.query('SELECT to_regclass($1) present', ['public.' + missing])).rows[0].present, null);
      await assert.rejects(() => admin.query(`CREATE TABLE ${missing}(id uuid)`), error => error.code === '42501');
    });
  });
}

test('real PostgreSQL: absent amendment pair preserves original projection and does not create tables', async () => {
  await unchangedAfterRollback(async () => {
    await admin.query('ALTER TABLE accounting_document_amendment_heads RENAME TO partial_schema_held_heads');
    await admin.query('ALTER TABLE accounting_document_amendments RENAME TO partial_schema_held_amendments');
    await restricted();
    assert.equal(await amendmentSchema(admin), false);
    const result = await amendmentHistory(admin, original.id, original);
    assert.equal(result.available, false); assert.equal(result.current, original);
    assert.deepEqual(result.rows, []);
    const { rows: [tables] } = await admin.query(`SELECT to_regclass('public.accounting_document_amendments') amendments,
      to_regclass('public.accounting_document_amendment_heads') heads`);
    assert.deepEqual(tables, { amendments: null, heads: null });
  });
});

test('real PostgreSQL: missing amendment lookup column aborts projection with no repair or writes', async () => {
  await unchangedAfterRollback(async () => {
    await admin.query('ALTER TABLE accounting_document_amendment_heads RENAME COLUMN company_id TO partial_schema_company');
    await restricted();
    // The existing service fails at the SQL read; it does not yet provide a typed
    // whole-schema compatibility error. P03-03 must add that wider startup gate.
    await assert.rejects(() => amendmentHistory(admin, original.id, original), error => error.code === '42703');
  });
});

test('real PostgreSQL: failed transactional DDL rolls back prior rename and all original evidence', async () => {
  await unchangedAfterRollback(async () => {
    await admin.query('ALTER TABLE accounting_document_amendments RENAME TO partial_schema_held_amendments');
    await assert.rejects(() => admin.query('ALTER TABLE public.partial_schema_table_does_not_exist ADD COLUMN id uuid'),
      error => error.code === '42P01');
  });
});

test('real PostgreSQL: complete amendment schema remains readable under restricted runtime role', async () => {
  await unchangedAfterRollback(async () => {
    await restricted();
    assert.equal(await amendmentSchema(admin), true);
    const result = await amendmentHistory(admin, original.id, original);
    assert.equal(result.available, true); assert.equal(result.current, original);
    assert.deepEqual(result.rows, []);
  });
});

test('real PostgreSQL: repeated overlay installation refuses the nonempty disposable schema without changes', async () => {
  // Dynamic source import preserves schema.mjs's repository-root calculation
  // when this test itself is bundled into generated-artifacts by the runner.
  const moduleUrl = pathToFileURL(path.join(process.cwd(), 'tools/accounting-flow/schema.mjs')).href;
  const { installSchema } = await import(moduleUrl);
  const sql = readFileSync(path.join(process.cwd(), 'lib/db/migrations/accounting-document-amendments.review.sql'), 'utf8');
  const before = await fingerprintDatabase(admin);
  for (const includeAmendments of [false, true]) {
    await assert.rejects(() => installSchema(admin, sql, { includeAmendments }),
      /restricted to a newly created empty disposable database/);
    assertSameFingerprint(before, await fingerprintDatabase(admin));
  }
});

test('real PostgreSQL: object-only public schemas cannot bypass the empty-database gate', async () => {
  const database = 'ledgerly_migration_empty_gate_test';
  await admin.query(`CREATE DATABASE ${database}`);
  const candidate = new pg.Client({ host: socket, port: 55441, user: 'w03_bootstrap',
    database, password: '', ssl: false, options: '-c timezone=UTC' });
  try {
    await candidate.connect();
    const { installSchema } = await import(pathToFileURL(path.join(process.cwd(), 'tools/accounting-flow/schema.mjs')).href);
    for (const ddl of [
      'CREATE VIEW public.only_view AS SELECT 1 value',
      'CREATE SEQUENCE public.only_sequence',
      'CREATE FUNCTION public.only_function() RETURNS integer LANGUAGE SQL AS $$ SELECT 1 $$',
      "CREATE TYPE public.only_type AS ENUM ('synthetic')",
    ]) {
      await candidate.query('BEGIN');
      try {
        await candidate.query(ddl);
        await assert.rejects(() => installSchema(candidate, ''), /restricted to a newly created empty disposable database/);
      } finally { await candidate.query('ROLLBACK'); }
    }
    // All objects rolled back; an empty schema proceeds to input validation, not DDL.
    await assert.rejects(() => installSchema(candidate, ''), /Full canonical export missing/);
  } finally {
    await candidate.end();
    await admin.query(`DROP DATABASE ${database}`);
  }
});
