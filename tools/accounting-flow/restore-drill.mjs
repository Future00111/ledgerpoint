// A restore rehearsal ONLY inside the freshly created accounting-test cluster.
// No database URL, credentials, external backup destination or existing target.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { recoverApplicationArchive } from '../operations/backup-restore/application-recovery.mjs';
import { fingerprintDatabase, assertSameFingerprint } from './database-fingerprint.mjs';
export { fingerprintDatabase, assertSameFingerprint } from './database-fingerprint.mjs';

const SOURCE = 'ledgerly_accounting_flow_test';
const RESTORED = 'ledgerly_accounting_flow_restore_test';
const digest = values => createHash('sha256').update(JSON.stringify(values)).digest('hex');
const quote = name => `"${name.replaceAll('"', '""')}"`;

export function assertRestoreTarget({ directory, socket, port, sourceDatabase = SOURCE, restoreDatabase = RESTORED }) {
  if (typeof directory !== 'string' || !/^\/tmp\/ledgerly-accounting-flow-tests-[a-zA-Z0-9]{6}$/.test(directory) ||
      socket !== path.join(directory, 'socket') || port !== 55441 || sourceDatabase !== SOURCE || restoreDatabase !== RESTORED)
    throw new Error('Restore drill requires the fresh, isolated accounting-test target.');
  return { directory, socket, port, sourceDatabase, restoreDatabase };
}

async function identity(client, target, database, user) {
  const { rows: [row] } = await client.query(`SELECT current_database() database, current_user actor,
    inet_server_addr() address, current_setting('data_directory') directory`);
  if (row.database !== database || row.actor !== user || row.address !== null ||
      row.directory !== path.join(target.directory, 'data')) throw new Error('Disposable PostgreSQL identity mismatch.');
}

export async function runRestoreDrill({ Client, directory, socket, port }) {
  const target = assertRestoreTarget({ directory, socket, port });
  if (realpathSync(directory) !== directory || realpathSync(socket) !== socket) throw new Error('Restore target must not use symlinks.');
  const env = { PATH: process.env.PATH, HOME: directory, LANG: 'C', LC_ALL: 'C' };
  const connection = (database, user = 'w03_bootstrap') => new Client({ host: socket, port, user, database,
    password: () => '', ssl: false, options: '-c timezone=UTC', application_name: 'isolated_restore_drill' });
  const source = connection(SOURCE), restored = connection(RESTORED), runtime = connection(RESTORED, 'ledgerly_api');
  try {
    await source.connect(); await identity(source, target, SOURCE, 'w03_bootstrap');
    const exists = await source.query('SELECT 1 FROM pg_database WHERE datname=$1', [RESTORED]);
    if (exists.rowCount) throw new Error('Restore target already exists; refusing to replace it.');
    const before = await fingerprintDatabase(source);
    for (const name of ['accounting_document_sources', 'canonical_journal_entries', 'canonical_journal_lines',
      'accounting_audit_events', 'document_intake_sources', 'document_intake_audit']) {
      if (!before.tables.some(table => table.table === name && table.rows > 0)) throw new Error('Restore drill needs populated synthetic accounting and capture evidence.');
    }
    const hasAmendments = before.tables.some(table => table.table === 'accounting_document_amendments');
    if (hasAmendments) for (const name of ['accounting_document_amendments', 'accounting_document_amendment_heads']) {
      if (!before.tables.some(table => table.table === name && table.rows > 0)) throw new Error('Restore drill needs populated synthetic correction evidence.');
    }
    const archive = path.join(directory, 'synthetic-accounting.dump');
    execFileSync('pg_dump', ['-h', socket, '-p', String(port), '-U', 'w03_bootstrap', '-d', SOURCE, '-Fc', '-f', archive], { env, stdio: 'pipe', timeout: 60000 });
    await source.query(`CREATE DATABASE ${quote(RESTORED)}`);
    execFileSync('pg_restore', ['-h', socket, '-p', String(port), '-U', 'w03_bootstrap', '-d', RESTORED, '--exit-on-error', archive], { env, stdio: 'pipe', timeout: 60000 });
    await restored.connect(); await identity(restored, target, RESTORED, 'w03_bootstrap');
    const after = await fingerprintDatabase(restored);
    assertSameFingerprint(before, after);
    // The drill must also leave the original test database unchanged.
    assertSameFingerprint(before, await fingerprintDatabase(source));
    const role = await restored.query(`SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,
      pg_has_role('ledgerly_api','ledgerly_canonical_owner','MEMBER') owner_member FROM pg_roles WHERE rolname='ledgerly_api'`);
    if (role.rowCount !== 1 || Object.values(role.rows[0]).some(Boolean)) throw new Error('Restored runtime role is privileged.');
    const guards = await restored.query(`SELECT count(*)::int n FROM pg_trigger WHERE tgenabled='A' AND tgname IN
      ('ledgerly_canonical_journal_entries_guard','ledgerly_canonical_journal_lines_guard',
       'ledgerly_canonical_journal_relations_guard','ledgerly_accounting_audit_events_guard','ledgerly_accounting_posting_effects_guard')`);
    if (guards.rows[0].n !== 5) throw new Error('Canonical guards are missing after restore.');
    if (hasAmendments) {
      const amendmentGuards = await restored.query(`SELECT count(*)::int n FROM pg_trigger WHERE tgenabled='A' AND tgname IN
        ('accounting_amendment_immutable','accounting_amendment_no_truncate','accounting_amendment_head_guard','accounting_amendment_head_no_truncate')`);
      if (amendmentGuards.rows[0].n !== 4) throw new Error('Correction guards are missing after restore.');
    }
    await runtime.connect();
    const access = await runtime.query(`SELECT current_user actor,
      has_table_privilege(current_user,'accounting_document_audit','UPDATE') audit_update,
      has_table_privilege(current_user,'document_intake_sources','DELETE') source_delete,
      has_column_privilege(current_user,'document_intake_sources','content','UPDATE') content_update`);
    if (access.rows[0].actor !== 'ledgerly_api' || access.rows[0].audit_update || access.rows[0].source_delete || access.rows[0].content_update)
      throw new Error('Restored evidence permissions are unsafe.');
    await runtime.query('SELECT id FROM accounting_document_sources LIMIT 1');
    await runtime.query('SELECT id FROM document_intake_sources LIMIT 1');
    await runtime.query('BEGIN');
    let denied=false;
    try {await runtime.query('UPDATE document_intake_sources SET content=content WHERE false');}
    catch(error) {if(error.code!=='42501') throw error;denied=true;}
    finally {await runtime.query('ROLLBACK');}
    if(!denied) throw new Error('Restored runtime unexpectedly permits source content changes.');
    const encryptedApplicationRecovery = await recoverApplicationArchive({ Client, directory, archive, source, before, fingerprintDatabase, assertSameFingerprint });
    return { encryptedApplicationRecovery, syntheticOnly: true, sourceUnchanged: true, restoredTables: before.tables.length,
      restoredRows: before.tables.reduce((sum, table) => sum + table.rows, 0),
      sourceFingerprint: digest(before), restoredFingerprint: digest(after), runtimeRestricted: true,
      controlsPreserved: true, runtimeMutationDenied: true, ambientDatabaseCredentialsUsed: false, productionContact: false };
  } finally {
    await Promise.allSettled([source.end(), restored.end(), runtime.end()]);
  }
}
