// Disposable, synthetic two-cluster recovery only; accepts no connection parameters.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { transformFile } from './archive.mjs';
const require = createRequire(new URL('../../../artifacts/api-server/package.json', import.meta.url));
const { Client } = require('pg');
const root = new URL('../../../', import.meta.url).pathname;
if (process.argv.length !== 2) throw new Error('Synthetic rehearsal takes no arguments or connection parameters.');
const directory = mkdtempSync('/tmp/ledgerpoint-encrypted-recovery-');
const env = { PATH: process.env.PATH, HOME: directory, LANG: 'C', LC_ALL: 'C' };
const started = performance.now(), clusters = [], clients = [];
const receiptPath = new URL('../../../generated-artifacts/encrypted-recovery.json', import.meta.url);
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
mkdirSync(new URL('../../../generated-artifacts/', import.meta.url), { recursive: true });
rmSync(receiptPath, { force: true });
let verified = false, postgresStopped = true, directoryRemoved = false, failure;
const run = (command, args) => execFileSync(command, args, { env, stdio: 'pipe', timeout: 60000 });
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
let sourceFingerprint, restoredFingerprint;
async function cluster(name) {
  const base = `${directory}/${name}`, socket = `${base}/socket`, data = `${base}/data`;
  mkdirSync(socket, { recursive: true, mode: 0o700 });
  run('initdb', ['-D', data, '-U', 'lp_bootstrap', '-A', 'trust', '--no-locale', '--encoding=UTF8']);
  // Track before starting: startup errors still trigger stop/cleanup.
  const result = { base, socket, data }; clusters.push(result);
  run('pg_ctl', ['-D', data, '-l', `${base}/postgres.log`, '-o', `-h '' -k ${socket} -p 55442 -F`, '-w', 'start']);
  const client = new Client({ host: socket, port: 55442, user: 'lp_bootstrap', database: 'postgres', password: () => '', ssl: false });
  clients.push(client); await client.connect();
  const { rows: [identity] } = await client.query("SELECT current_setting('data_directory') directory, inet_server_addr() address, current_user actor");
  if (identity.directory !== data || identity.address !== null || identity.actor !== 'lp_bootstrap') throw new Error('Disposable cluster identity mismatch.');
  return { ...result, client };
}
async function fingerprint(client) {
  const rows = [];
  for (const table of ['original_attachments', 'durable_jobs', 'audit_evidence']) {
    const result = await client.query(`SELECT to_jsonb(t)::text value FROM ${table} t ORDER BY to_jsonb(t)::text`);
    rows.push({ table, rows: result.rows });
  }
  const roles = await client.query("SELECT rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls FROM pg_roles WHERE rolname='lp_synthetic_reader'");
  const grants = await client.query("SELECT table_name,grantee,privilege_type,is_grantable FROM information_schema.table_privileges WHERE table_schema='public' ORDER BY 1,2,3,4");
  return digest({ rows, roles: roles.rows, grants: grants.rows });
}
try {
  const source = await cluster('source');
  await source.client.query(`CREATE ROLE lp_synthetic_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
    CREATE TABLE original_attachments(id text PRIMARY KEY, content bytea NOT NULL);
    CREATE TABLE durable_jobs(id text PRIMARY KEY, source_id text REFERENCES original_attachments(id), state text NOT NULL);
    CREATE TABLE audit_evidence(id text PRIMARY KEY, source_id text REFERENCES original_attachments(id), payload jsonb NOT NULL);
    GRANT SELECT ON original_attachments,durable_jobs,audit_evidence TO lp_synthetic_reader;`);
  await source.client.query('INSERT INTO original_attachments VALUES($1,$2)', ['source-1', Buffer.from([0,255,1,10,13])]);
  await source.client.query("INSERT INTO durable_jobs VALUES('job-1','source-1','pending'); INSERT INTO audit_evidence VALUES('audit-1','source-1','{\"actor\":\"synthetic\",\"action\":\"capture\"}');");
  sourceFingerprint = await fingerprint(source.client);
  const dump = `${directory}/source.dump`, encrypted = `${directory}/source.enc`, restored = `${directory}/restored.dump`, keyFile = `${directory}/key`;
  writeFileSync(keyFile, randomBytes(32), { mode: 0o600, flag: 'wx' });
  run('pg_dump', ['-h', source.socket, '-p', '55442', '-U', 'lp_bootstrap', '-d', 'postgres', '-Fc', '-f', dump]);
  transformFile({ mode: 'encrypt', input: dump, output: encrypted, keyFile, syntheticOnly: true });
  // Recovery must use authenticated recovered bytes, never the plaintext dump.
  transformFile({ mode: 'decrypt', input: encrypted, output: restored, keyFile, syntheticOnly: true });
  if (!readFileSync(dump).equals(readFileSync(restored))) throw new Error('Archive bytes differ.');
  const target = await cluster('restored');
  // Exact synthetic role contract; never replay arbitrary cluster SQL or credentials.
  await target.client.query('CREATE ROLE lp_synthetic_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS');
  run('pg_restore', ['-h', target.socket, '-p', '55442', '-U', 'lp_bootstrap', '-d', 'postgres', '--exit-on-error', restored]);
  restoredFingerprint = await fingerprint(target.client);
  if (sourceFingerprint !== restoredFingerprint || sourceFingerprint !== await fingerprint(source.client)) throw new Error('Recovery fingerprint mismatch.');
  await target.client.query('SET ROLE lp_synthetic_reader');
  await target.client.query('SELECT content FROM original_attachments');
  let denied = false;
  try { await target.client.query('DELETE FROM audit_evidence'); } catch (error) { if (error.code !== '42501') throw error; denied = true; }
  finally { await target.client.query('RESET ROLE'); }
  if (!denied) throw new Error('Restored reader can mutate audit evidence.');
  verified = true;
} catch (error) { failure = error; }
finally {
  await Promise.allSettled(clients.map(client => client.end()));
  for (const cluster of clusters.reverse()) {
    try { run('pg_ctl', ['-D', cluster.data, '-m', 'immediate', '-w', 'stop']); }
    catch { postgresStopped = false; }
  }
  if (postgresStopped) { rmSync(directory, { recursive: true, force: true }); directoryRemoved = true; }
  writeFileSync(receiptPath, JSON.stringify({ sourceCommit, syntheticOnly: true, verified, sourceFingerprint, restoredFingerprint,
    elapsedMilliseconds: Math.round(performance.now() - started), postgresStopped, directoryRemoved,
    separateClusters: true, encryptedArchiveUsed: verified, runtimeMutationDenied: verified,
    fixtureScope: 'Representative synthetic role, binary attachment, pending job and audit tables; not the application schema or production recovery qualification',
    ambientDatabaseCredentialsUsed: false, productionContact: false }, null, 2) + '\n');
}
if (failure || !verified || !postgresStopped || !directoryRemoved) {
  process.stderr.write('Synthetic encrypted recovery failed; inspect isolated receipt and disposable runner prerequisites.\n');
  process.exitCode = 1;
} else console.log('Synthetic encrypted recovery verified across fresh clusters; cleanup complete.');
