import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CAPTURE_BYTES } from '../../api/documentIntake.mjs';
import { canPreviewSource, sourcePreviewScope, validatePreviewBlob, createSourcePreview, MAX_PREVIEW_HEADER_BYTES } from './sourcePreview.mjs';

const bytes = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7xkAAAAASUVORK5CYII=', 'base64'));
const png = () => new Blob([bytes], { type: 'image/png' });
const jpegHeader = (width = 1200, height = 800, marker = 192) => Uint8Array.from([
  255, 216, 255, 224, 0, 4, 0, 0,
  255, marker, 0, 11, 8, height >> 8, height & 255, width >> 8, width & 255, 1, 1, 17, 0,
  255, 218, 0, 8, 1, 1, 0, 0, 63, 0, 0, 255, 217,
]);
const validate = (data, type = 'image/png') => validatePreviewBlob(new Blob([data], { type }), { media_type: type, byte_length: data.length });
const pngSize = (width, height) => { const data = bytes.slice(); const view = new DataView(data.buffer); view.setUint32(16, width); view.setUint32(20, height); return data; };
const source = { id: 'source-a', media_type: 'image/png', byte_length: bytes.length, revision: '1' };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function harness(load = async () => png(), props = {}) {
  const published = [], created = [], revoked = [], calls = [];
  const viewer = createSourcePreview({ companyId: 'company-a', source, load: (...args) => { calls.push(args); return load(...args); },
    publish: state => published.push(state), urls: { createObjectURL(blob) { created.push(blob); return `blob:preview-${created.length}`; }, revokeObjectURL(url) { revoked.push(url); } }, ...props });
  return { viewer, published, created, revoked, calls };
}

test('only PNG/JPEG previews pass type, exact size and binary signature validation', async () => {
  assert.equal(await validatePreviewBlob(png(), source) instanceof Blob, true);
  const jpeg = new Blob([jpegHeader()], { type: 'image/jpeg' });
  assert.equal(await validatePreviewBlob(jpeg, { media_type: 'image/jpeg', byte_length: jpeg.size }), jpeg);
  for (const type of ['application/pdf', 'text/html', 'image/svg+xml', 'image/gif', 'image/png;charset=utf-8']) {
    assert.equal(canPreviewSource({ media_type: type }), false);
    await assert.rejects(validatePreviewBlob(new Blob([bytes], { type }), { ...source, media_type: type }));
  }
  for (const length of [0, -1, null, '9', MAX_CAPTURE_BYTES + 1, bytes.length - 1]) await assert.rejects(validatePreviewBlob(png(), { ...source, byte_length: length }));
  await assert.rejects(validatePreviewBlob(new Blob([bytes], { type: 'text/html' }), source));
  await assert.rejects(validatePreviewBlob(new Blob(['<script>'], { type: 'image/png' }), { ...source, byte_length: 8 }));
  await assert.rejects(validatePreviewBlob(new Blob([Uint8Array.of(255, 216)], { type: 'image/jpeg' }), { media_type: 'image/jpeg', byte_length: 2 }));
});

test('PNG IHDR dimensions are bounded before decoding, including product and individual-side limits', async () => {
  await validate(pngSize(4000, 5000));
  await validate(pngSize(10000, 2000));
  for (const [width, height] of [[0, 1], [1, 0], [10001, 1], [1, 10001], [5000, 5000], [0xffffffff, 0xffffffff]]) {
    await assert.rejects(validate(pngSize(width, height)), /header|limited/);
  }
  for (const patch of [[8, 1], [12, 88], [24, 3], [26, 1], [27, 1], [28, 2]]) {
    const changed = bytes.slice(); changed[patch[0]] = patch[1]; await assert.rejects(validate(changed), /header/);
  }
  for (const length of [7, 20, 32, 37, 45]) await assert.rejects(validate(bytes.slice(0, length)), /header/);
});

test('PNG animated, repeated or invalid header chunks remain download-only', async () => {
  for (const chunk of ['acTL', 'fcTL', 'fdAT', 'IHDR', 'IEND', 'ABCD']) {
    const data = bytes.slice(); data.set(Buffer.from(chunk), 37); await assert.rejects(validate(data), /header/);
  }
  const truncated = bytes.slice(); new DataView(truncated.buffer).setUint32(33, 0xffffffff);
  await assert.rejects(validate(truncated), /header/);
});

test('JPEG baseline and progressive frames accept bounded dimensions; oversized and zero sizes fail', async () => {
  for (const marker of [192, 194]) {
    await validate(jpegHeader(1200, 800, marker), 'image/jpeg');
    await validate(jpegHeader(10000, 2000, marker), 'image/jpeg');
  }
  for (const [width, height] of [[0, 1], [1, 0], [10001, 1], [1, 10001], [5000, 5000], [65535, 65535]]) {
    await assert.rejects(validate(jpegHeader(width, height), 'image/jpeg'), /header|limited/);
  }
});

test('JPEG segment bounds reject truncated, invalid, duplicate and unknown frames without decoding', async () => {
  const data = jpegHeader();
  for (let length = 0; length < data.length - 3; length++) await assert.rejects(validate(data.slice(0, length), 'image/jpeg'));
  for (const [at, value] of [[4, 255], [5, 1], [9, 195], [11, 2], [12, 12], [17, 0], [17, 4], [19, 0], [20, 4], [26, 2], [27, 255]]) {
    const changed = data.slice(); changed[at] = value; await assert.rejects(validate(changed, 'image/jpeg'), /header/);
  }
  const duplicate = Uint8Array.from([...data.slice(0, 21), ...data.slice(8)]);
  await assert.rejects(validate(duplicate, 'image/jpeg'), /header/);
  const noFrame = Uint8Array.from([255, 216, ...data.slice(21)]);
  await assert.rejects(validate(noFrame, 'image/jpeg'), /header/);
});

test('header reading and segment scanning are explicitly bounded; oversize previews allocate no URL', async () => {
  const manySegments = Uint8Array.from([255, 216, ...Array.from({ length: 257 }, () => [255, 254, 0, 2]).flat(), ...jpegHeader().slice(2)]);
  await assert.rejects(validate(manySegments, 'image/jpeg'), /header/);
  const largeMetadata = Uint8Array.from([255, 216, ...Array.from({ length: 5 }, () => [255, 254, 255, 255, ...new Uint8Array(65533)]).flat(), ...jpegHeader().slice(2)]);
  await assert.rejects(validate(largeMetadata, 'image/jpeg'), /header/);
  const blob = png(); let requestedEnd = null; const slice = blob.slice.bind(blob);
  blob.slice = (start, end) => { requestedEnd = end; return slice(start, end); };
  await validatePreviewBlob(blob, source); assert.equal(requestedEnd, MAX_PREVIEW_HEADER_BYTES);
  const oversized = pngSize(10000, 10000);
  const h = harness(async () => new Blob([oversized], { type: 'image/png' }));
  await h.viewer.open(); assert.equal(h.created.length, 0); assert.equal(h.published.at(-1).status, 'error');
  assert.match(h.published.at(-1).error, /20 megapixels/);
});

test('an explicit open uses the authenticated content boundary and releases the URL on close', async () => {
  const h = harness();
  assert.equal(h.calls.length, 0);
  await h.viewer.open();
  assert.deepEqual(h.calls[0].slice(0, 2), ['company-a', 'source-a']);
  assert.equal(h.calls[0][2] instanceof AbortSignal, true);
  assert.deepEqual(h.published.map(s => s.status), ['loading', 'ready']);
  h.viewer.close();
  assert.equal(h.calls[0][2].aborted, true);
  assert.deepEqual(h.revoked, ['blob:preview-1']);
  assert.deepEqual(h.published.at(-1), { status: 'closed', url: null, error: null });
  h.viewer.dispose();
  assert.equal(h.revoked.length, 1);
});

test('close and source/company disposal fence late reads even if the loader ignores AbortSignal', async () => {
  for (const action of ['close', 'dispose']) {
    const pending = deferred(); const h = harness(() => pending.promise);
    const opened = h.viewer.open();
    h.viewer[action]();
    const before = h.published.length;
    pending.resolve(png()); await opened;
    assert.equal(h.calls[0][2].aborted, true);
    assert.equal(h.created.length, 0);
    assert.equal(h.published.length, before);
  }
});

test('late reads from a previous preview never replace the latest attempt', async () => {
  const pending = deferred(); let count = 0;
  const h = harness(() => ++count === 1 ? pending.promise : png());
  const first = h.viewer.open(); await h.viewer.open();
  pending.resolve(png()); await first;
  assert.equal(h.created.length, 1);
  assert.equal(h.published.at(-1).url, 'blob:preview-1');
  await h.viewer.open();
  assert.deepEqual(h.revoked, ['blob:preview-1']);
  h.viewer.dispose();
  assert.deepEqual(h.revoked, ['blob:preview-1', 'blob:preview-2']);
});

test('closing while signature bytes are read prevents URL creation', async () => {
  const pending = deferred(); const blob = png();
  blob.slice = () => ({ arrayBuffer: () => pending.promise });
  const h = harness(async () => blob);
  const opened = h.viewer.open();
  await new Promise(resolve => setImmediate(resolve));
  h.viewer.close(); pending.resolve(bytes.buffer); await opened;
  assert.equal(h.created.length, 0);
  assert.equal(h.published.at(-1).status, 'closed');
});

test('denied reads and corrupt files never allocate URLs or expose raw failure details; retry can recover', async () => {
  let denied = true;
  const h = harness(async () => { if (denied) throw new Error('private provider token / foreign-company.pdf'); return png(); });
  await h.viewer.open();
  assert.equal(h.created.length, 0);
  assert.equal(h.published.at(-1).status, 'error');
  assert.doesNotMatch(h.published.at(-1).error, /token|foreign-company/);
  denied = false; await h.viewer.open();
  assert.equal(h.published.at(-1).status, 'ready');
  const invalid = harness(async () => new Blob(['not an image'], { type: 'image/png' }));
  await invalid.viewer.open();
  assert.equal(invalid.created.length, 0);
  assert.equal(invalid.published.at(-1).status, 'error');
});

test('image decode failures release their own URL but stale image events cannot fail a newer preview', async () => {
  const h = harness();
  await h.viewer.open(); await h.viewer.open();
  h.viewer.imageFailed('blob:preview-1');
  assert.equal(h.published.at(-1).status, 'ready');
  h.viewer.imageFailed('blob:preview-2');
  assert.equal(h.published.at(-1).status, 'error');
  assert.deepEqual(h.revoked, ['blob:preview-1', 'blob:preview-2']);
  await h.viewer.open();
  assert.equal(h.published.at(-1).status, 'ready');
});

test('missing identity and unsupported sources never request content; disposed viewers cannot reopen', async () => {
  for (const props of [{ companyId: null }, { source: { ...source, id: '' } }, { source: { ...source, media_type: 'application/pdf' } }]) {
    const h = harness(undefined, props); await h.viewer.open(); assert.equal(h.calls.length, 0);
  }
  const h = harness(); h.viewer.dispose(); await h.viewer.open(); assert.equal(h.calls.length, 0);
});

test('viewer identity changes for company, source and immutable metadata, but not filename', () => {
  const key = sourcePreviewScope('company-a', source);
  assert.notEqual(sourcePreviewScope('company-b', source), key);
  for (const change of [{ id: 'source-b' }, { revision: '2' }, { media_type: 'image/jpeg' }, { byte_length: 10 }]) assert.notEqual(sourcePreviewScope('company-a', { ...source, ...change }), key);
  assert.equal(sourcePreviewScope('company-a', { ...source, filename: 'renamed.png' }), key);
});
