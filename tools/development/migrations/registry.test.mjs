import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadMigrationInputs, validateMigrationInputs, migrationOrder } from './registry.mjs';
import { installSchema } from '../../accounting-flow/schema.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const registry = () => JSON.parse(readFileSync(path.join(root, 'lib/db/migration-registry.json'), 'utf8'));
const read = relative => readFileSync(path.join(root, relative));
test('versioned replacement migration retains existing consumption engine and requires a committed cluster origin',()=>{
 const sql=loadMigrationInputs(root)['conditional-discount-replacement-observations'];
 assert.match(sql,/pg_xact_status\(replacement.source_xid\) IS DISTINCT FROM 'committed'/);
 assert.match(sql,/replacement.cluster_id IS DISTINCT FROM \(pg_control_system\(\)\).system_identifier/);
 assert.match(sql,/Consumption migration source mismatch/);
 assert.match(sql,/Superseded agreement cannot redeem/);
 assert.match(sql,/parent.created_at>o.observed_at/);
 assert.doesNotMatch(sql,/jsonb::text/);
});
test('replacement history migration is pinned, append-only and separate from original binding and payment qualification',()=>{
  const inputs=loadMigrationInputs(root);
  const sql=inputs['conditional-discount-replacements'];
  assert.match(sql,/Consumed agreement cannot be replaced/);
  assert.match(sql,/Replacement predecessor changed/);
  assert.match(sql,/FOR UPDATE/);
  assert.match(sql,/UNIQUE INDEX conditional_replacement_one_successor/);
  assert.match(sql,/REVOKE ALL ON public.conditional_discount_replacements FROM PUBLIC,ledgerly_api/);
  assert.match(sql,/ENABLE ALWAYS TRIGGER conditional_replacement_immutable/);
  assert.doesNotMatch(sql,/UPDATE public\.conditional_discount_original_bindings|INSERT INTO public\.accounting_payment_events/);
});
test('explicit original binding keeps ordinary posting gates and a database-owned original xid prerequisite',()=>{
  const posting=read('artifacts/api-server/src/services/accountingDocuments/posting.ts').toString();
  assert.equal((posting.match(/fail\(422,'CONDITIONAL_POSTING_NOT_AVAILABLE'\)/g)??[]).length,2);
  assert.match(posting,/conditionalOriginalTransactions=new WeakMap/);
  assert.match(posting,/held\.company===company && held\.actor===actor && held\.id===id && held\.expected===expected/);
  assert.match(posting,/if\(conditionalOriginal\) await bindConditionalOriginal\(q,company,actor,id\)/);
  assert.doesNotMatch(posting,/observeConditionalOriginal/);
  const sql=read('lib/db/migrations/conditional-discount-agreements.review.sql').toString();
  assert.match(sql,/origin\.source_xid<>pg_current_xact_id\(\)/);
  assert.match(sql,/pg_xact_status\(origin\.source_xid\) IS DISTINCT FROM 'committed'/);
  assert.match(sql,/p\.source_evidence_hash=j\.source_evidence_hash/);
  assert.match(sql,/p\.source_revision=j\.source_revision/);
  assert.match(sql,/NEW\.canonical_payload::jsonb IS DISTINCT FROM NEW\.binding/);
  assert.match(sql,/sha256\(convert_to\(NEW\.canonical_payload,'UTF8'\)\)/);
  assert.match(sql,/j\.source_evidence_hash=NEW\.binding_hash/);
  assert.match(sql,/j\.source_evidence_hash=origin\.binding_hash/);
  assert.match(sql,/ENABLE ALWAYS TRIGGER conditional_discount_journal_origin/);
  assert.doesNotMatch(sql,/GRANT INSERT ON public\.conditional_discount_(?:journal_origins|original_bindings|original_observations)/);
});
test('all registered review migrations are pinned and returned as the exact verified bytes', () => {
  const inputs = loadMigrationInputs(root);
  assert.deepEqual(Object.keys(inputs), [...migrationOrder, 'canonical-security-overlay']);
  assert.equal(inputs['canonical-security-overlay'], read(registry().securityOverlay.path).toString('utf8'));
  for (const item of registry().migrations) assert.equal(inputs[item.id], read(item.path).toString('utf8'));
  assert.ok(Object.isFrozen(inputs));
});
for (const [name, mutate] of [
  ['unknown version', r => { r.version = 3; }],
  ['legacy unpinned version', r => { r.version = 1; }],
  ['missing overlay', r => { delete r.securityOverlay; }],
  ['overlay traversal', r => { r.securityOverlay.path = '../private.sql'; }],
  ['wrong overlay identity', r => { r.securityOverlay.id = 'other'; }],
  ['unsupported overlay contract', r => { r.securityOverlay.contractVersion = 2; }],
  ['malformed overlay checksum', r => { r.securityOverlay.sha256 = 'not-a-checksum'; }],
  ['production authority', r => { r.authority = 'production'; }],
  ['missing migration', r => { r.migrations.pop(); }],
  ['unknown migration', r => { r.migrations.push({...r.migrations[0], id:'unknown'}); }],
  ['duplicate identity', r => { r.migrations[1] = r.migrations[0]; }],
  ['wrong order', r => { [r.migrations[0],r.migrations[1]]=[r.migrations[1],r.migrations[0]]; }],
  ['missing dependency', r => { r.migrations[1].dependencies=[]; }],
  ['unsupported contract', r => { r.migrations[0].contractVersion=2; }],
  ['traversal path', r => { r.migrations[0].path='../private.sql'; }],
]) test(`${name} fails closed`, () => {
  const r = registry(); mutate(r);
  assert.throws(() => validateMigrationInputs(r, read), {code:'MIGRATION_REGISTRY_INCOMPATIBLE'});
});
test('changed SQL bytes fail checksum validation without leaking SQL', () => {
  assert.throws(() => validateMigrationInputs(registry(), () => Buffer.from('private altered SQL')),
    error => error.code==='MIGRATION_CHECKSUM_MISMATCH' && !error.message.includes('private'));
});
test('missing SQL fails with bounded diagnostic', () => {
  assert.throws(() => validateMigrationInputs(registry(), () => {throw Error('private path');}),
    {code:'MIGRATION_SOURCE_UNAVAILABLE'});
});
for (const includeAmendments of [false,true]) test(`nonempty database is rejected before BEGIN, amendments=${includeAmendments}`, async () => {
  const calls=[];
  const admin={query:async sql=>{calls.push(sql); return {rows:[{n:1}]};}};
  await assert.rejects(()=>installSchema(admin, '', {includeAmendments}), /newly created empty disposable database/);
  assert.equal(calls.length,1); assert.match(calls[0], /SELECT count/);
});

for (const [name, replace, expected] of [
  ['altered overlay', () => Buffer.from('private altered security SQL'), 'MIGRATION_CHECKSUM_MISMATCH'],
  ['missing overlay', () => { throw Error('private path'); }, 'MIGRATION_SOURCE_UNAVAILABLE'],
]) test(`${name} fails with bounded diagnostic`, () => {
  const r = registry();
  assert.throws(() => validateMigrationInputs(r, relative => relative === r.securityOverlay.path ? replace() : read(relative)),
    error => error.code === expected && !error.message.includes('private'));
});

// Exercise the real installer with copied source inputs, without adding a bypass or
// injectable loader to its production signature. Corrupt overlay must stop all SQL.
for (const includeAmendments of [false, true]) test(`tampered overlay stops installer before any database query, amendments=${includeAmendments}`, async () => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'lp-migration-inputs-'));
  try {
    const files = ['tools/accounting-flow/schema.mjs', 'tools/development/migrations/registry.mjs',
      'lib/db/migration-registry.json', ...registry().migrations.map(item => item.path), registry().securityOverlay.path];
    for (const relative of files) {
      const target = path.join(fixture, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      copyFileSync(path.join(root, relative), target);
    }
    writeFileSync(path.join(fixture, registry().securityOverlay.path), 'private altered SQL');
    const { installSchema: fixtureInstall } = await import(pathToFileURL(path.join(fixture, 'tools/accounting-flow/schema.mjs')));
    const calls = [];
    await assert.rejects(() => fixtureInstall({ query: async sql => { calls.push(sql); } }, '', { includeAmendments }),
      { code: 'MIGRATION_CHECKSUM_MISMATCH' });
    assert.deepEqual(calls, []);
  } finally { rmSync(fixture, { recursive: true, force: true }); }
});

for (const includeAmendments of [false, true]) test(`schema created after preflight is refused under migration lock, amendments=${includeAmendments}`, async () => {
  const calls = []; let checks = 0;
  const admin = { query: async sql => {
    calls.push(sql);
    if (sql.includes('SELECT count(*)::int n')) return { rows: [{ n: checks++ === 0 ? 0 : 1 }] };
    return { rows: [] };
  } };
  await assert.rejects(() => installSchema(admin, 'CREATE TABLE "canonical_journal_lines" (\n);', { includeAmendments }),
    /restricted to a newly created empty disposable database/);
  assert.equal(checks, 2);
  assert.deepEqual(calls.slice(1, 3), ['BEGIN', 'SELECT pg_advisory_xact_lock(17428, 3003)']);
  assert.match(calls[3], /SELECT count/);
  assert.equal(calls[4], 'ROLLBACK');
  assert.equal(calls.length, 5, 'no role, table or other DDL is allowed after losing the race');
});

import { expectedMigrationHistory, validateInstalledMigrationHistory } from './registry.mjs';
for (const includeAmendments of [false, true]) test(`installed history matches exact selected input versions, amendments=${includeAmendments}`, () => {
  const expected = expectedMigrationHistory(loadMigrationInputs(root), { includeAmendments });
  assert.equal(expected.some(row => row.id === 'accounting-document-amendments'), includeAmendments);
  assert.equal(validateInstalledMigrationHistory([...expected].reverse(), expected), true);
  for (const mutate of [
    rows => rows.pop(), rows => rows.push({ ...rows[0], id: 'unknown-newer' }),
    rows => rows[0].sha256 = '0'.repeat(64), rows => rows[0].contract_version++,
    rows => rows[0].dependencies = ['unknown'], rows => rows[1] = rows[0],
  ]) {
    const altered = structuredClone(expected); mutate(altered);
    assert.throws(() => validateInstalledMigrationHistory(altered, expected), { code: 'MIGRATION_HISTORY_INCOMPATIBLE' });
  }
});
