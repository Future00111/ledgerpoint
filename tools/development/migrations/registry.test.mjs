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
