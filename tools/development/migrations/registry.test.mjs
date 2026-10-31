import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadMigrationInputs, validateMigrationInputs, migrationOrder } from './registry.mjs';
import { installSchema } from '../../accounting-flow/schema.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const registry = () => JSON.parse(readFileSync(path.join(root, 'lib/db/migration-registry.json'), 'utf8'));
const read = relative => readFileSync(path.join(root, relative));
test('all registered review migrations are pinned and returned as the exact verified bytes', () => {
  const inputs = loadMigrationInputs(root);
  assert.deepEqual(Object.keys(inputs), migrationOrder);
  for (const item of registry().migrations) assert.equal(inputs[item.id], read(item.path).toString('utf8'));
  assert.ok(Object.isFrozen(inputs));
});
for (const [name, mutate] of [
  ['unknown version', r => { r.version = 2; }],
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
