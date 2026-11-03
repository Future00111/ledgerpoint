// Restore the populated disposable accounting fixture into a NEW cluster.
// No caller-selected target, database URL, credential or external destination.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { transformFile } from './archive.mjs';

const roleSQL = `SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls
  FROM pg_roles WHERE rolname IN ('ledgerly_api','ledgerly_canonical_owner') ORDER BY rolname`;
const membershipSQL = `SELECT parent.rolname role_name,member.rolname member_name,m.admin_option
  FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member
  WHERE parent.rolname IN ('ledgerly_api','ledgerly_canonical_owner') OR member.rolname IN ('ledgerly_api','ledgerly_canonical_owner')
  ORDER BY role_name,member_name`;
export function assertApplicationArchive({ directory, archive }) {
  if (typeof directory !== 'string' || !/^\/tmp\/ledgerly-accounting-flow-tests-[a-zA-Z0-9]{6}$/.test(directory) ||
      archive !== path.join(directory, 'synthetic-accounting.dump')) throw new Error('Only the populated disposable accounting archive is allowed.');
}
export function assertApplicationRoles(roles, memberships) {
  const expected = ['ledgerly_api', 'ledgerly_canonical_owner'].map((rolname, i) => ({
    rolname, rolsuper: false, rolinherit: true, rolcreaterole: false, rolcreatedb: false,
    rolcanlogin: i === 0, rolreplication: false, rolbypassrls: false,
  }));
  if (JSON.stringify(roles) !== JSON.stringify(expected) || memberships.length !== 0)
    throw new Error('Application recovery requires the exact restricted role contract.');
}
export async function recoverApplicationArchive({ Client, directory, archive, source, before, fingerprintDatabase, assertSameFingerprint }) {
  assertApplicationArchive({ directory, archive });
  if (realpathSync(directory) !== directory || realpathSync(archive) !== archive) throw new Error('Recovery source must not use symlinks.');
  assertApplicationRoles((await source.query(roleSQL)).rows, (await source.query(membershipSQL)).rows);
  const receiptPath = new URL('../../../generated-artifacts/application-recovery.json', import.meta.url);
  mkdirSync(new URL('../../../generated-artifacts/', import.meta.url), { recursive: true });
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: new URL('../../../', import.meta.url), encoding: 'utf8' }).trim();
  const base = mkdtempSync('/tmp/ledgerpoint-application-recovery-');
  const socket = path.join(base, 'socket'), data = path.join(base, 'data'), port = 55443;
  const env = { PATH: process.env.PATH, HOME: base, LANG: 'C', LC_ALL: 'C' };
  const run = (command, args) => execFileSync(command, args, { env, stdio: 'pipe', timeout: 60000 });
  const clients = [], started = performance.now();
  let startupAttempted = false, stopped = true, removed = false, verified = false, failure;
  try {
    mkdirSync(socket, { mode: 0o700 });
    const keyFile = path.join(base, 'key'), encrypted = path.join(base, 'application.enc'), recovered = path.join(base, 'authenticated.dump');
    writeFileSync(keyFile, randomBytes(32), { flag: 'wx', mode: 0o600 });
    transformFile({ mode: 'encrypt', input: archive, output: encrypted, keyFile, syntheticOnly: true });
    transformFile({ mode: 'decrypt', input: encrypted, output: recovered, keyFile, syntheticOnly: true });
    if (!readFileSync(archive).equals(readFileSync(recovered))) throw new Error('Authenticated application archive bytes differ.');
    run('initdb', ['-D', data, '-U', 'w03_bootstrap', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
    startupAttempted = true; stopped = false;
    run('pg_ctl', ['-D', data, '-l', path.join(base, 'postgres.log'), '-o', `-h '' -k ${socket} -p ${port} -F`, '-w', 'start']);
    const connect = async user => {
      const client = new Client({ host: socket, port, user, database: 'postgres', password: () => '', ssl: false, options: '-c timezone=UTC' });
      clients.push(client); await client.connect(); return client;
    };
    const restored = await connect('w03_bootstrap');
    const { rows: [identity] } = await restored.query("SELECT current_setting('data_directory') directory, inet_server_addr() address, current_database() database, current_user actor");
    if (identity.directory !== data || identity.address !== null || identity.database !== 'postgres' || identity.actor !== 'w03_bootstrap')
      throw new Error('New application recovery cluster identity mismatch.');
    await restored.query(`CREATE ROLE ledgerly_api LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
      CREATE ROLE ledgerly_canonical_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
    // Restore only authenticated bytes; never use the original plaintext dump here.
    run('pg_restore', ['-h', socket, '-p', String(port), '-U', 'w03_bootstrap', '-d', 'postgres', '--exit-on-error', recovered]);
    assertSameFingerprint(before, await fingerprintDatabase(restored));
    assertSameFingerprint(before, await fingerprintDatabase(source));
    assertApplicationRoles((await restored.query(roleSQL)).rows, (await restored.query(membershipSQL)).rows);
    const runtime = await connect('ledgerly_api');
    await runtime.query('SELECT id FROM accounting_document_sources LIMIT 1');
    await runtime.query('SELECT id FROM document_intake_sources LIMIT 1');
    await runtime.query('BEGIN');
    let denied = false;
    try { await runtime.query('UPDATE document_intake_sources SET content=content WHERE false'); }
    catch (error) { if (error.code !== '42501') throw error; denied = true; }
    finally { await runtime.query('ROLLBACK'); }
    if (!denied) throw new Error('Recovered runtime can mutate original source content.');
    verified = true;
  } catch (error) { failure = error; }
  finally {
    await Promise.allSettled(clients.map(client => client.end()));
    if (startupAttempted) {
      try { run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']); stopped = true; }
      catch { stopped = false; }
    }
    if (stopped) { rmSync(base, { recursive: true, force: true }); removed = true; }
    writeFileSync(receiptPath, JSON.stringify({ sourceCommit, syntheticOnly: true, verified,
      separateCluster: true, encryptedArchiveUsed: verified, applicationFingerprintMatched: verified,
      sourceUnchanged: verified, runtimeRestricted: verified, runtimeMutationDenied: verified,
      postgresStopped: stopped, directoryRemoved: removed, elapsedMilliseconds: Math.round(performance.now() - started),
      ambientDatabaseCredentialsUsed: false, productionContact: false,
      fixtureScope: 'Populated accounting regression schema, source attachments and audit; not production/offsite recovery qualification' }, null, 2) + '\n');
  }
  if (failure) throw failure;
  if (!verified || !stopped || !removed) throw new Error('Application recovery or isolated cleanup failed; inspect application-recovery.json.');
  return JSON.parse(readFileSync(receiptPath, 'utf8'));
}
