import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync, statSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { seal, unseal, transformFile } from './archive.mjs';
const fixture = Buffer.from(JSON.stringify({ roles: [{ name: 'synthetic_api', superuser: false }],
  audit: [{ id: 'original-event', actor: 'synthetic-user' }], jobs: [{ id: 'original-job', state: 'pending' }],
  attachments: [{ id: 'original-source', content: Buffer.from([0, 255, 1, 10, 13]).toString('base64') }] }));
const hash = value => createHash('sha256').update(value).digest('hex');
test('fresh nonces, exact role/job/audit/attachment bytes and authenticated envelope', () => {
  const key = randomBytes(32), a = seal(fixture, key), b = seal(fixture, key);
  assert.notDeepEqual(a, b); assert.equal(hash(unseal(a, key)), hash(fixture));
  assert.equal(a.includes(Buffer.from('original-event')), false);
  for (const position of [0, 35, 48, a.length - 1]) {
    const tampered = Buffer.from(a); tampered[position] ^= 1;
    assert.throws(() => unseal(tampered, key));
  }
  assert.throws(() => unseal(a.subarray(0, -1), key));
  assert.throws(() => unseal(a, randomBytes(32)));
  assert.throws(() => seal(fixture, Buffer.alloc(31)));
});
test('file rehearsal restores a fresh output only and never overwrites evidence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ledgerpoint-encrypted-synthetic-'));
  const input = join(dir, 'synthetic.dump'), keyFile = join(dir, 'key'), encrypted = join(dir, 'encrypted'), restored = join(dir, 'restored.dump');
  try {
    writeFileSync(input, fixture); writeFileSync(keyFile, randomBytes(32), { mode: 0o600 });
    transformFile({ mode: 'encrypt', input, output: encrypted, keyFile, syntheticOnly: true });
    transformFile({ mode: 'decrypt', input: encrypted, output: restored, keyFile, syntheticOnly: true });
    assert.equal(hash(readFileSync(restored)), hash(fixture)); assert.equal(hash(readFileSync(input)), hash(fixture));
    assert.equal(statSync(restored).mode & 0o777, 0o600);
    assert.throws(() => transformFile({ mode: 'decrypt', input: encrypted, output: restored, keyFile, syntheticOnly: true }));
    const bad = Buffer.from(readFileSync(encrypted)); bad[bad.length - 1] ^= 1; writeFileSync(encrypted, bad);
    const failed = join(dir, 'failed');
    assert.throws(() => transformFile({ mode: 'decrypt', input: encrypted, output: failed, keyFile, syntheticOnly: true }));
    assert.equal(existsSync(failed), false);
    const link = join(dir, 'link'); symlinkSync(input, link);
    assert.throws(() => transformFile({ mode: 'encrypt', input, output: link, keyFile, syntheticOnly: true }));
    assert.throws(() => transformFile({ mode: 'encrypt', input: link, output: failed, keyFile, syntheticOnly: true }));
    assert.throws(() => transformFile({ mode: 'encrypt', input, output: failed, keyFile, syntheticOnly: false }));
    assert.equal(hash(readFileSync(input)), hash(fixture));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});


test('CLI performs explicit synthetic round trip without logging archive or key contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ledgerpoint-encrypted-cli-'));
  const input = join(dir, 'fixture'), encrypted = join(dir, 'sealed'), output = join(dir, 'restored'), keyFile = join(dir, 'key');
  const cli = fileURLToPath(new URL('./archive.mjs', import.meta.url));
  try {
    writeFileSync(input, fixture); writeFileSync(keyFile, randomBytes(32));
    for (const args of [['encrypt', input, encrypted], ['decrypt', encrypted, output]]) {
      const result = JSON.parse(execFileSync(process.execPath, [cli, ...args, keyFile, '--synthetic-only'], { encoding: 'utf8' }));
      assert.equal(result.syntheticOnly, true);
      assert.deepEqual(Object.keys(result).sort(), ['bytes', 'mode', 'syntheticOnly']);
    }
    assert.equal(hash(readFileSync(output)), hash(fixture));
    const denied = spawnSync(process.execPath, [cli, 'decrypt', encrypted, input, keyFile, '--synthetic-only'], { encoding: 'utf8' });
    assert.equal(denied.status, 1); assert.equal(denied.stdout, '');
    assert.equal(denied.stderr.includes('original-event'), false);
    assert.equal(hash(readFileSync(input)), hash(fixture));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});


test('FIFO keys and inputs are rejected without waiting for a writer', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ledgerpoint-encrypted-fifo-'));
  const input = join(dir, 'input'), keyFile = join(dir, 'key'), fifo = join(dir, 'pipe'), output = join(dir, 'output');
  const cli = fileURLToPath(new URL('./archive.mjs', import.meta.url));
  try {
    writeFileSync(input, fixture); writeFileSync(keyFile, randomBytes(32));
    execFileSync('mkfifo', [fifo], { timeout: 2000 });
    for (const [source, key] of [[input, fifo], [fifo, keyFile]]) {
      const result = spawnSync(process.execPath, [cli, 'encrypt', source, output, key, '--synthetic-only'], { encoding: 'utf8', timeout: 2000 });
      assert.equal(result.error, undefined, 'Non-regular files must reject before the timeout');
      assert.equal(result.signal, null);
      assert.equal(result.status, 1);
      assert.equal(existsSync(output), false);
      assert.equal(hash(readFileSync(input)), hash(fixture));
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
