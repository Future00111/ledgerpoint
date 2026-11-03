// Executed only by the fresh Unix-socket accounting-flow runner; never ambient DB.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { realpathSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import pg from 'pg';
import { amendmentSchema, amendmentHistory } from '../../../artifacts/api-server/src/services/accountingDocuments/amendments.ts';
import { fingerprintDatabase, assertSameFingerprint } from '../../accounting-flow/database-fingerprint.mjs';

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

for (const includeAmendments of [false, true]) {
  test(`real PostgreSQL: late installer failure rolls back all migrations and permits clean retry, amendments=${includeAmendments}`, async () => {
    const database = `ledgerly_migration_rollback_${includeAmendments ? 'amended' : 'original'}_test`;
    await admin.query(`CREATE DATABASE ${database}`);
    const candidate = new pg.Client({ host: socket, port: 55441, user: 'w03_bootstrap',
      database, password: '', ssl: false, options: '-c timezone=UTC' });
    try {
      await candidate.connect();
      const { installSchema, exportSchema } = await import(
        pathToFileURL(path.join(process.cwd(), 'tools/accounting-flow/schema.mjs')).href);
      const sql = exportSchema();
      const objects = async () => (await candidate.query(`SELECT count(*)::int n FROM (
        SELECT oid FROM pg_class WHERE relnamespace='public'::regnamespace
        UNION ALL SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace
        UNION ALL SELECT oid FROM pg_type WHERE typnamespace='public'::regnamespace
      ) objects`)).rows[0].n;
      assert.equal(await objects(), 0);
      let injected = false;
      // Fail with a real PostgreSQL error after the table migrations and before
      // canonical security installation. No installer bypass or ambient DB is used.
      const failingAdmin = { query: async (statement, values) => {
        if (!injected && statement.startsWith('ALTER TABLE public.accounting_posting_effects OWNER')) {
          injected = true;
          const { rows: [installed] } = await candidate.query(`SELECT
            to_regclass('public.accounting_document_sources') sources,
            to_regclass('public.accounting_paid_credit_operations') paid_credits,
            to_regclass('public.w03_invoice_drafts') drafts`);
          assert.ok(installed.sources); assert.ok(installed.paid_credits); assert.ok(installed.drafts);
          return candidate.query('SELECT 1 / 0');
        }
        return candidate.query(statement, values);
      } };
      await assert.rejects(() => installSchema(failingAdmin, sql, { includeAmendments }),
        error => error.code === '22012');
      assert.equal(injected, true, 'failure must occur after the real migrations ran');
      assert.equal(await objects(), 0, 'ROLLBACK must remove all partial schema objects');
      await installSchema(candidate, sql, { includeAmendments });
      assert.ok(await objects() > 0);
      const { rows: [installed] } = await candidate.query(`SELECT
        to_regclass('public.accounting_document_sources') sources,
        to_regclass('public.accounting_document_amendments') amendments,
        to_regclass('public.accounting_document_amendment_heads') heads`);
      assert.ok(installed.sources);
      assert.equal(Boolean(installed.amendments), includeAmendments);
      assert.equal(Boolean(installed.heads), includeAmendments);
      const before = await fingerprintDatabase(candidate);
      await assert.rejects(() => installSchema(candidate, sql, { includeAmendments }),
        /restricted to a newly created empty disposable database/);
      assertSameFingerprint(before, await fingerprintDatabase(candidate));
    } finally {
      await candidate.end();
      await admin.query(`DROP DATABASE ${database}`);
    }
  });
}

for (const includeAmendments of [false, true]) {
  for (const winnerCommits of [false, true]) {
    test(`real PostgreSQL: installer serializes and rechecks after competing migration, amendments=${includeAmendments}, commit=${winnerCommits}`, async () => {
      const database = `ledgerly_migration_race_${includeAmendments ? 'amended' : 'original'}_${winnerCommits ? 'commit' : 'rollback'}_test`;
      await admin.query(`CREATE DATABASE ${database}`);
      const connection = () => new pg.Client({ host: socket, port: 55441, user: 'w03_bootstrap',
        database, password: '', ssl: false, options: '-c timezone=UTC' });
      const winner = connection(), contender = connection();
      let installation;
      try {
        await winner.connect(); await contender.connect();
        const { installSchema, exportSchema } = await import(
          pathToFileURL(path.join(process.cwd(), 'tools/accounting-flow/schema.mjs')).href);
        const sql = exportSchema();
        await winner.query('BEGIN');
        await winner.query('SELECT pg_advisory_xact_lock(17428, 3003)');
        let announceLock;
        const requestedLock = new Promise(resolve => { announceLock = resolve; });
        const contenderAdmin = { query: (statement, values) => {
          const result = contender.query(statement, values);
          if (statement === 'SELECT pg_advisory_xact_lock(17428, 3003)') announceLock();
          return result;
        } };
        // Attach rejection handling immediately; the losing installation must be
        // a clean empty-schema refusal, never a partial migration or DDL error.
        installation = installSchema(contenderAdmin, sql, { includeAmendments })
          .then(() => ({ ok: true }), error => ({ ok: false, error }));
        await Promise.race([requestedLock, installation.then(result => {
          throw result.error ?? Error("Installer completed without requesting the migration lock");
        })]);
        const pid = contender.processID;
        const deadline = Date.now() + 5000;
        let waiting = false;
        do {
          waiting = (await winner.query(`SELECT EXISTS(SELECT 1 FROM pg_locks
            WHERE pid=$1 AND locktype='advisory' AND NOT granted) waiting`, [pid])).rows[0].waiting;
          if (!waiting) await new Promise(resolve => setTimeout(resolve, 10));
        } while (!waiting && Date.now() < deadline);
        assert.equal(waiting, true, 'contender must wait on the transaction migration lock');
        await winner.query('CREATE TABLE public.competing_migration_evidence(value text NOT NULL)');
        await winner.query("INSERT INTO public.competing_migration_evidence VALUES ('retained synthetic evidence')");
        await winner.query(winnerCommits ? 'COMMIT' : 'ROLLBACK');
        const result = await installation;
        if (winnerCommits) {
          assert.equal(result.ok, false);
          assert.match(result.error.message, /restricted to a newly created empty disposable database/);
          assert.deepEqual((await contender.query('SELECT * FROM public.competing_migration_evidence')).rows,
            [{ value: 'retained synthetic evidence' }]);
          assert.equal((await contender.query("SELECT to_regclass('public.accounting_document_sources') sources")).rows[0].sources, null);
        } else {
          assert.equal(result.ok, true, result.error?.message);
          const { rows: [installed] } = await contender.query(`SELECT
            to_regclass('public.accounting_document_sources') sources,
            to_regclass('public.accounting_document_amendments') amendments,
            to_regclass('public.competing_migration_evidence') competing`);
          assert.ok(installed.sources);
          assert.equal(Boolean(installed.amendments), includeAmendments);
          assert.equal(installed.competing, null);
        }
        // Success and refusal both release the transaction lock; no stale lease.
        const acquired = (await winner.query('SELECT pg_try_advisory_lock(17428, 3003) acquired')).rows[0].acquired;
        assert.equal(acquired, true);
        await winner.query('SELECT pg_advisory_unlock(17428, 3003)');
      } finally {
        await winner.query('ROLLBACK').catch(() => {});
        if (installation) await installation;
        await contender.end(); await winner.end();
        await admin.query(`DROP DATABASE ${database}`);
      }
    });
  }
}

async function historyAPI() {
  const api = await import(pathToFileURL(path.join(process.cwd(), 'tools/development/migrations/registry.mjs')).href);
  return { ...api, inputs: api.loadMigrationInputs(process.cwd()) };
}
test('real PostgreSQL: applied migration history is readable but never mutable by runtime', async () => {
  const { checkInstalledMigrationHistory, inputs } = await historyAPI();
  await unchangedAfterRollback(async () => {
    await restricted();
    assert.equal(await checkInstalledMigrationHistory(admin, inputs, { includeAmendments: true }), true);
  });
  for (const sql of [
    "INSERT INTO schema_migrations(id,sha256,contract_version,dependencies) VALUES('unexpected',repeat('0',64),1,'[]')",
    "UPDATE schema_migrations SET contract_version=2", 'DELETE FROM schema_migrations', 'TRUNCATE schema_migrations',
  ]) await unchangedAfterRollback(async () => {
    await restricted(); await assert.rejects(() => admin.query(sql), error => error.code === '42501');
  });
});
for (const [name, sql] of [
  ['checksum', "UPDATE schema_migrations SET sha256=repeat('0',64) WHERE id='accounting-documents'"],
  ['newer version', "UPDATE schema_migrations SET contract_version=2 WHERE id='accounting-documents'"],
  ['dependency', "UPDATE schema_migrations SET dependencies='[\"unknown\"]' WHERE id='accounting-documents'"],
  ['missing entry', "DELETE FROM schema_migrations WHERE id='accounting-documents'"],
  ['unknown entry', "INSERT INTO schema_migrations(id,sha256,contract_version,dependencies) VALUES('unknown',repeat('0',64),1,'[]')"],
]) test(`real PostgreSQL: ${name} history corruption fails compatibility without automatic repair`, async () => {
  const { checkInstalledMigrationHistory, inputs } = await historyAPI();
  await unchangedAfterRollback(async () => {
    await admin.query('ALTER TABLE schema_migrations DISABLE TRIGGER ledgerly_migration_history_immutable');
    await admin.query(sql);
    await restricted();
    await assert.rejects(() => checkInstalledMigrationHistory(admin, inputs, { includeAmendments: true }),
      { code: 'MIGRATION_HISTORY_INCOMPATIBLE' });
  });
});
test('real PostgreSQL: absent migration history fails closed with no automatic creation', async () => {
  const { checkInstalledMigrationHistory, inputs } = await historyAPI();
  await unchangedAfterRollback(async () => {
    await admin.query('ALTER TABLE schema_migrations RENAME TO held_migration_history');
    await restricted();
    await assert.rejects(() => checkInstalledMigrationHistory(admin, inputs, { includeAmendments: true }),
      { code: 'MIGRATION_HISTORY_UNAVAILABLE' });
  });
});
test('real PostgreSQL: interrupted migration-history recording leaves no DDL or version rows', async () => {
  const { recordInstalledMigrationHistory, inputs } = await historyAPI();
  const database = 'ledgerly_history_failure_test';
  await admin.query(`CREATE DATABASE ${database}`);
  const candidate = new pg.Client({ host: socket, port: 55441, user: 'w03_bootstrap',
    database, password: '', ssl: false, options: '-c timezone=UTC' });
  try {
    await candidate.connect();
    await candidate.query('BEGIN');
    let inserts = 0;
    const interrupted = { query: async (sql, params) => {
      if (sql.startsWith('INSERT INTO public.schema_migrations') && ++inserts === 2)
        throw Object.assign(new Error('Synthetic interruption'), { code: 'SYNTHETIC_INTERRUPTION' });
      return candidate.query(sql, params);
    } };
    await assert.rejects(() => recordInstalledMigrationHistory(interrupted, inputs, { includeAmendments: true }),
      { code: 'SYNTHETIC_INTERRUPTION' });
    await candidate.query('ROLLBACK');
    assert.equal((await candidate.query("SELECT to_regclass('public.schema_migrations') present")).rows[0].present, null);
    assert.equal((await candidate.query("SELECT count(*)::int n FROM pg_proc WHERE pronamespace='public'::regnamespace")).rows[0].n, 0);
    await candidate.query('BEGIN');
    await recordInstalledMigrationHistory(candidate, inputs, { includeAmendments: true });
    await candidate.query('COMMIT');
    assert.equal((await candidate.query('SELECT count(*)::int n FROM schema_migrations')).rows[0].n, 9);
  } finally { await candidate.end(); await admin.query(`DROP DATABASE ${database}`); }
});
