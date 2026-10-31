// Synthetic backup rehearsal only. This wrapper never opens a database or network.
// AES-GCM authenticates the entire archive before any restored output is created.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { constants, openSync, closeSync, fstatSync, readSync, writeFileSync, fsyncSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const HEADER = Buffer.from('LedgerPoint synthetic backup v1\n', 'utf8');
const MAX_BYTES = 64 * 1024 * 1024;
const OVERHEAD = HEADER.length + 12 + 16;
function keyBytes(key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('A separate 32-byte backup key is required.');
}
export function seal(plaintext, key) {
  keyBytes(key);
  if (!Buffer.isBuffer(plaintext) || plaintext.length > MAX_BYTES) throw new Error('Synthetic archive exceeds supported size.');
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(HEADER);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([HEADER, nonce, cipher.getAuthTag(), ciphertext]);
}
export function unseal(envelope, key) {
  keyBytes(key);
  if (!Buffer.isBuffer(envelope) || envelope.length < OVERHEAD || envelope.length > MAX_BYTES + OVERHEAD ||
      !envelope.subarray(0, HEADER.length).equals(HEADER)) throw new Error('Invalid synthetic archive envelope.');
  const nonceStart = HEADER.length, tagStart = nonceStart + 12, dataStart = tagStart + 16;
  const decipher = createDecipheriv('aes-256-gcm', key, envelope.subarray(nonceStart, tagStart));
  decipher.setAAD(HEADER); decipher.setAuthTag(envelope.subarray(tagStart, dataStart));
  try { return Buffer.concat([decipher.update(envelope.subarray(dataStart)), decipher.final()]); }
  catch { throw new Error('Archive authentication failed; no restored output was created.'); }
}
function readRegular(path, limit) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const info = fstatSync(fd);
    if (!info.isFile() || info.size > limit) throw new Error('Expected a bounded regular file, without symlinks.');
    const bytes = Buffer.alloc(info.size + 1);
    let length = 0, count;
    while (length < bytes.length && (count = readSync(fd, bytes, length, bytes.length - length, null)) > 0) length += count;
    if (length !== info.size) throw new Error('Source changed size while reading.');
    return bytes.subarray(0, length);
  } finally { closeSync(fd); }
}
export function transformFile({ mode, input, output, keyFile, syntheticOnly }) {
  if (syntheticOnly !== true || !['encrypt', 'decrypt'].includes(mode)) throw new Error('Only explicit synthetic encrypt/decrypt rehearsals are supported.');
  const paths = [input, output, keyFile].map(path => resolve(path));
  if (new Set(paths).size !== 3) throw new Error('Input, output and key paths must be distinct.');
  const key = readRegular(keyFile, 32);
  let bytes;
  try { bytes = mode === 'encrypt' ? seal(readRegular(input, MAX_BYTES), key) : unseal(readRegular(input, MAX_BYTES + OVERHEAD), key); }
  finally { key.fill(0); }
  // wx refuses existing files and symlinks. Only remove an output we created if
  // writing fails; input, key and pre-existing destinations are never replaced.
  const fd = openSync(output, 'wx', 0o600);
  try { writeFileSync(fd, bytes); fsyncSync(fd); }
  catch (error) { closeSync(fd); unlinkSync(output); throw error; }
  closeSync(fd);
  return { syntheticOnly: true, mode, bytes: bytes.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, input, output, keyFile, flag, ...extra] = process.argv.slice(2);
  if (!mode || !input || !output || !keyFile || flag !== '--synthetic-only' || extra.length) {
    process.stderr.write('Usage: node archive.mjs encrypt|decrypt input output key-file --synthetic-only\n');
    process.exitCode = 1;
  } else {
    try { process.stdout.write(JSON.stringify(transformFile({ mode, input, output, keyFile, syntheticOnly: true })) + '\n'); }
    catch { process.stderr.write('Synthetic archive operation failed; verify paths, key and authenticated archive.\n'); process.exitCode = 1; }
  }
}
