import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentIntakeClient, MAX_CAPTURE_BYTES } from './documentIntake.mjs';
const response = data => ({ ok: true, status: 200, json: async () => ({ data }) });

test('list/detail scope and content URLs encode company/source/document identifiers and include credentials', async () => {
  const seen = [];
  const client = createDocumentIntakeClient(async (url, options) => { seen.push({ url, options }); return response({ sources: [] }); });
  await client.list('company/a', 'document?b');
  await client.get('company/a', 'source/c');
  assert.equal(seen[0].url, '/api/companies/company%2Fa/document-intake?document_id=document%3Fb');
  assert.equal(seen[1].url, '/api/companies/company%2Fa/document-intake/source%2Fc');
  for (const item of seen) assert.equal(item.options.credentials, 'include');
});

test('upload retry retains exact payload and returns duplicate source metadata', async () => {
  const seen = [];
  const client = createDocumentIntakeClient(async (_, options) => { seen.push(options.body); return response({ source: { id: 'source', document_id: 'draft', document_kind: 'purchase_bill' }, duplicate: true }); });
  const body = { filename: 'invoice.pdf', media_type: 'application/pdf', content_base64: 'JVBERg==' };
  await client.upload('co', body);
  const duplicate = await client.upload('co', body);
  assert.equal(seen[0], seen[1]);
  assert.deepEqual(JSON.parse(seen[1]), body);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.source.document_id, 'draft');
});

test('review and draft preserve native decimal strings, opaque fingerprint, confirmations and quoted capture revision', async () => {
  const seen = [];
  const client = createDocumentIntakeClient(async (url, options) => { seen.push({ url, options }); return response({}); });
  const envelope = { kind: 'purchase_bill', source: { line_items: [{ quantity: '0.012345', unit_price: '90071992547409.91' }] } };
  const signal = new AbortController().signal;
  await client.review('co', 'source', envelope, signal);
  const body = { envelope, review_fingerprint: 'v1:opaque', source_reviewed: true, supplier_confirmed: true, tax_treatment_confirmed: true };
  await client.draft('co', 'source', body, 'rev:2', signal);
  assert.deepEqual(JSON.parse(seen[0].options.body), { envelope });
  assert.deepEqual(JSON.parse(seen[1].options.body), body);
  assert.equal(seen[1].options.headers['If-Match'], '"rev:2"');
  assert.equal(seen[1].options.signal, signal);
  assert.ok(seen[1].url.endsWith('/source/draft'));
});

test('source download is authenticated binary, bounded, and failures preserve safe API errors', async () => {
  let seen;
  const client = createDocumentIntakeClient(async (url, options) => { seen = { url, options }; return { ok: true, blob: async () => new Blob(['%PDF-test'], { type: 'application/pdf' }) }; });
  const blob = await client.content('co', 'source');
  assert.equal(await blob.text(), '%PDF-test');
  assert.equal(seen.url, '/api/companies/co/document-intake/source/content');
  assert.equal(seen.options.credentials, 'include');
  const oversized = createDocumentIntakeClient(async () => ({ ok: true, blob: async () => ({ size: MAX_CAPTURE_BYTES + 1 }) }));
  await assert.rejects(oversized.content('co', 'source'), /5 MiB/);
  const denied = createDocumentIntakeClient(async () => ({ ok: false, status: 403, json: async () => ({ error: { code: 'FORBIDDEN', message: 'Access denied.' } }) }));
  await assert.rejects(denied.content('co', 'source'), error => error.code === 'FORBIDDEN' && error.status === 403);
  const stale = createDocumentIntakeClient(async () => ({ ok: false, status: 409, json: async () => ({ error: { code: 'REVIEW_STALE', message: 'Review again.' } }) }));
  await assert.rejects(stale.draft('co', 'source', {}, 2), error => error.code === 'REVIEW_STALE');
});

test('malformed success cannot authorize writes', async () => {
  const client = createDocumentIntakeClient(async () => ({ ok: true, json: async () => ({ can_manage: true }) }));
  await assert.rejects(client.list('co'), /could not be verified/);
});
