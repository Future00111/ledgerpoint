import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { decodeUpload, verifyStoredEvidence, attachmentDisposition, matchesAcceptedIntent,
  nativeReviewFingerprint, uploadSourceInTransaction, MAX_UPLOAD_BYTES } from './service';
import { reviewDraft } from './draft';
import { saveDocumentInTransaction } from '../accountingDocuments/documents';
import type { Queryable } from '../accountingDocuments/core';

const company = '11111111-1111-4111-8111-111111111111';
const otherCompany = '22222222-2222-4222-8222-222222222222';
const actor = 'synthetic-capture-owner';
const pdf = Buffer.from('%PDF-1.7\nSynthetic supplier invoice.');
const upload = (bytes = pdf) => ({ filename: 'invoice.pdf', media_type: 'application/pdf', content_base64: bytes.toString('base64') });
const stored = () => ({ id: randomUUID(), company_id: company, revision: randomUUID(),
  sha256: createHash('sha256').update(pdf).digest('hex'), media_type: 'application/pdf',
  filename: 'invoice.pdf', byte_length: pdf.length, content: pdf, channel: 'upload' });
const envelope = () => ({ kind: 'purchase_bill', purchase_vat_eligible: true, posting_account_id: null,
  source: { contract: 'w03.draft.v1', currency: 'GBP', customer_id: otherCompany, invoice_number: 'CAPTURE-1',
    issue_date: '2026-10-30', due_date: '2026-11-29', payment_terms: 30, reference: '', notes: '',
    price_basis: 'excluding_vat', line_items: [{ description: 'Radiator', quantity: '1', unit_price: '100.00', tax_code: 'VAT20' }] } });

// Unit fixture tests routing/authority of SQL requests, not database atomicity or constraints.
// Those are separately exercised against disposable PostgreSQL by the integration suite.
function store(role = 'owner', active = true) {
  const sources: any[] = [], audits: any[] = [], calls: { sql: string; values: unknown[] }[] = [];
  const q = { query: async (sql: string, values: any[] = []) => {
    calls.push({ sql, values });
    const result = (rows: any[]) => ({ rows, rowCount: rows.length });
    if (sql.includes('FROM companies')) return result([{ id: values[0] }]);
    if (sql.includes('FROM company_users')) return result([{ role, is_active: active }]);
    if (sql.startsWith('INSERT INTO document_intake_sources')) {
      sources.push({ id: values[0], company_id: values[1], revision: values[2], sha256: values[3],
        media_type: values[4], filename: values[5], byte_length: values[6], content: values[7],
        channel: 'upload', created_by: values[8], created_at: new Date('2026-10-30T00:00:00Z'),
        document_id: null, review_fingerprint: null, document_kind: null });
      return result([]);
    }
    if (sql.startsWith('INSERT INTO document_intake_audit')) { audits.push(values); return result([]); }
    if (sql.includes('FROM document_intake_sources')) {
      const found = sources.filter(row => row.company_id === values[0] &&
        (sql.includes('s.sha256=$2') ? row.sha256 === values[1] : row.id === values[1]));
      return result(found.map(({ content: _content, company_id: _company, ...row }) => row));
    }
    throw new Error(`Unexpected unit fixture query: ${sql}`);
  } } as unknown as Queryable;
  return { q, sources, audits, calls };
}

test('native upload derives identity and SHA from bytes and rejects client identity fields', () => {
  const first = decodeUpload(upload());
  const second = decodeUpload({ ...upload(), filename: 'renamed.pdf' });
  assert.notEqual(first.evidence.source_id, second.evidence.source_id);
  assert.equal(first.evidence.sha256, second.evidence.sha256);
  assert.equal(first.evidence.sha256, createHash('sha256').update(pdf).digest('hex'));
  assert.deepEqual(first.bytes, pdf);
  for (const field of ['id', 'company_id', 'sha256', 'document_id', 'total', 'channel', 'content_url']) {
    assert.throws(() => decodeUpload({ ...upload(), [field]: 'untrusted' }), { code: 'FIELD_INVALID' });
  }
});

test('strict base64 rejects ignored whitespace, extra padding, URL alphabet and noncanonical trailing bits', () => {
  for (const value of [upload().content_base64 + '\n', '%PDF-', 'JVBERi0===', 'JVBERi0_', 'JVBERi1=']) {
    assert.throws(() => decodeUpload({ ...upload(), content_base64: value }), { code: 'SOURCE_ENCODING_INVALID' }, value);
  }
  assert.equal(decodeUpload({ ...upload(), content_base64: 'JVBERi0=' }).bytes.toString(), '%PDF-');
});

test('upload caps the encoded allocation and decoded bytes at 5 MiB, accepting the exact limit', () => {
  const bytes = Buffer.alloc(MAX_UPLOAD_BYTES, 32); pdf.copy(bytes);
  assert.equal(decodeUpload(upload(bytes)).bytes.length, MAX_UPLOAD_BYTES);
  const tooLarge = Buffer.concat([bytes, Buffer.from('x')]);
  assert.throws(() => decodeUpload(upload(tooLarge)), { code: 'SOURCE_SIZE_INVALID' });
  assert.throws(() => decodeUpload({ ...upload(), content_base64: 'A'.repeat(Math.ceil(MAX_UPLOAD_BYTES / 3) * 4 + 4) }), { code: 'SOURCE_SIZE_INVALID' });
  for (const content_base64 of ['', null, 123]) assert.throws(() => decodeUpload({ ...upload(), content_base64 }), { code: 'SOURCE_SIZE_INVALID' });
});

test('native upload rejects media mismatches, unsafe filenames and prototype-bearing payloads', () => {
  assert.throws(() => decodeUpload({ ...upload(), media_type: 'image/jpeg' }), { code: 'SOURCE_MEDIA_INVALID' });
  assert.throws(() => decodeUpload(upload(Buffer.from('<html>'))), { code: 'SOURCE_MEDIA_INVALID' });
  for (const filename of ['../invoice.pdf', 'invoice\n.pdf', 'x\\y.pdf', '', ' ', 'x'.repeat(256)]) {
    assert.throws(() => decodeUpload({ ...upload(), filename }), { code: 'FILENAME_INVALID' });
  }
  assert.throws(() => decodeUpload(Object.assign(Object.create({ injected: true }), upload())), { code: 'FIELD_INVALID' });
  let read = false;
  assert.throws(() => decodeUpload({ ...upload(), get content_base64() { read = true; return ''; } }), { code: 'FIELD_INVALID' });
  assert.equal(read, false);
});

test('verified storage reconstruction rejects tampered hash, bytes, length, format and channel', () => {
  assert.equal(verifyStoredEvidence(stored()).sha256, createHash('sha256').update(pdf).digest('hex'));
  for (const patch of [{ sha256: 'a'.repeat(64) }, { byte_length: 1 }, { content: Buffer.from('%PDF-different') },
    { content: null }, { content: Array.from(pdf) }, { media_type: 'image/png' }, { channel: 'email' },
    { filename: '../invoice.pdf' }]) {
    assert.throws(() => verifyStoredEvidence({ ...stored(), ...patch }), { code: 'SOURCE_EVIDENCE_MISMATCH' });
  }
});

test('download disposition safely encodes quotes, unicode and header delimiters as attachment', () => {
  const value = attachmentDisposition('invoice "£20" (supplier).pdf', 'application/pdf');
  assert.equal(value, 'attachment; filename="source.pdf"; filename*=UTF-8\'\'invoice%20%22%C2%A320%22%20%28supplier%29.pdf');
  assert.equal(/[\r\n]/.test(attachmentDisposition('x\r\ny.png', 'image/png')), false);
  assert.ok(attachmentDisposition('x\uD800.jpg', 'image/jpeg').includes('filename="source.jpg"'));
});

test('review freshness changes with calculation, mapping, source revision and entered intent', () => {
  const evidence = verifyStoredEvidence(stored()), review = reviewDraft(envelope(), evidence);
  const revision = randomUUID();
  const native = { source: review.envelope.source, money: { net_pence: '10000', vat_pence: '2000', gross_pence: '12000' },
    tax_context: { revision: 'rule-1' }, posting_accounts: { expense: 'account-1' }, mapping_revision: 'mapping-1',
    posting_account_id: null, purchase_vat_eligible: true };
  const accepted = nativeReviewFingerprint(review.review_fingerprint, revision, native);
  assert.match(accepted, /^v1:[0-9a-f]{64}:[0-9a-f]{64}$/);
  assert.equal(nativeReviewFingerprint(review.review_fingerprint, revision, { ...native }), accepted);
  for (const patch of [{ money: { gross_pence: '12001' } }, { tax_context: { revision: 'rule-2' } },
    { posting_accounts: { expense: 'account-2' } }, { mapping_revision: 'mapping-2' }, { purchase_vat_eligible: false }]) {
    assert.notEqual(nativeReviewFingerprint(review.review_fingerprint, revision, { ...native, ...patch }), accepted);
  }
  assert.notEqual(nativeReviewFingerprint(review.review_fingerprint, randomUUID(), native), accepted);
  const changed = envelope(); changed.source.line_items[0]!.quantity = '2';
  const intent = reviewDraft(changed, evidence).review_fingerprint;
  assert.equal(matchesAcceptedIntent(accepted, accepted, intent), false);
  assert.equal(matchesAcceptedIntent(accepted, accepted, review.review_fingerprint), true);
  assert.equal(matchesAcceptedIntent(accepted, accepted.replace(/.$/, accepted.endsWith('0') ? '1' : '0'), review.review_fingerprint), false);
  assert.equal(matchesAcceptedIntent(null, accepted, review.review_fingerprint), false);
});

test('replay intent remains source-bound and rejects caller totals', () => {
  const first = verifyStoredEvidence(stored()), second = verifyStoredEvidence(stored());
  assert.notEqual(reviewDraft(envelope(), first).review_fingerprint, reviewDraft(envelope(), second).review_fingerprint);
  assert.throws(() => reviewDraft({ ...envelope(), money: { total: '1' } }, first), { code: 'DRAFT_ENVELOPE_INVALID' });
  assert.throws(() => reviewDraft({ ...envelope(), source: { ...envelope().source, gross_total: '1' } }, first));
});

test('upload deduplicates within a company with one source and one audit while retaining original metadata', async () => {
  const fixture = store();
  const first = await uploadSourceInTransaction(fixture.q, company, actor, upload());
  const duplicate = await uploadSourceInTransaction(fixture.q, company, actor, { ...upload(), filename: 'new-name.pdf' });
  assert.equal(first.duplicate, false); assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.source, first.source);
  assert.equal(duplicate.source.filename, 'invoice.pdf');
  assert.equal(fixture.sources.length, 1); assert.equal(fixture.audits.length, 1);
  assert.equal('content' in first.source, false);
  assert.ok(fixture.calls.filter(call => call.sql.includes('FROM companies')).every(call => call.sql.endsWith('FOR UPDATE')));
});

test('same bytes in another company create independent evidence without revealing the first source', async () => {
  const fixture = store();
  const first = await uploadSourceInTransaction(fixture.q, company, actor, upload());
  const other = await uploadSourceInTransaction(fixture.q, otherCompany, actor, upload());
  assert.notEqual(first.source.id, other.source.id); assert.equal(other.duplicate, false);
  assert.equal(fixture.sources.length, 2); assert.equal(fixture.audits.length, 2);
  assert.ok(fixture.calls.filter(call => call.sql.includes('FROM document_intake_sources')).every(call => call.sql.includes('s.company_id=$1')));
});

test('current membership and write role are required even when the content is a duplicate', async () => {
  for (const role of ['viewer', 'bookkeeper', 'unknown']) {
    const fixture = store(role);
    await assert.rejects(uploadSourceInTransaction(fixture.q, company, actor, upload()), { code: 'CAPABILITY_DENIED', status: 403 });
    assert.equal(fixture.calls.some(call => call.sql.includes('document_intake_sources')), false);
  }
  const inactive = store('owner', false);
  await assert.rejects(uploadSourceInTransaction(inactive.q, company, actor, upload()), { code: 'RESOURCE_NOT_FOUND', status: 404 });
});

test('the in-transaction native save helper retains its own active membership and draft-write gate', async () => {
  const readonly = store('viewer');
  await assert.rejects(saveDocumentInTransaction(readonly.q, company, actor, envelope()), { code: 'CAPABILITY_DENIED', status: 403 });
  assert.equal(readonly.calls.length, 2);
  const inactive = store('owner', false);
  await assert.rejects(saveDocumentInTransaction(inactive.q, company, actor, envelope()), { code: 'RESOURCE_NOT_FOUND', status: 404 });
  assert.equal(inactive.calls.some(call => call.sql.startsWith('INSERT')), false);
});
