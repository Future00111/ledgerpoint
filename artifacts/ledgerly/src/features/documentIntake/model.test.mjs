import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CAPTURE_BYTES, validateCaptureFile, validateBatch, readCaptureFile, capturePath, prepareCapturePath, envelopeKey, reviewMatches, emptyAcknowledgements, buildReviewedDraft, createScopeGate } from './model.mjs';

test('capture accepts bounded PDFs/JPEGs/PNGs, rejects empty/oversize/unsupported and caps queue at ten', () => {
  for (const [name, type] of [['x.pdf', 'application/pdf'], ['x.jpg', 'image/jpeg'], ['x.png', 'image/png'], ['x.JPEG', '']]) assert.equal(validateCaptureFile({ name, type, size: MAX_CAPTURE_BYTES }), null);
  assert.match(validateCaptureFile({ name: 'x.pdf', type: 'text/html', size: 5 }), /PDF/);
  assert.match(validateCaptureFile({ name: 'x.pdf', type: '', size: 0 }), /empty/);
  assert.match(validateCaptureFile({ name: 'x.pdf', type: '', size: MAX_CAPTURE_BYTES + 1 }), /larger/);
  assert.equal(validateBatch(Array(10)), null);
  assert.match(validateBatch(Array(2), 9), /10/);
});

test('bounded FileReader preserves source bytes as base64 and never reads invalid files', async () => {
  let reads = 0; const progress = [];
  class Reader {
    readAsDataURL(file) { reads++; this.onprogress({ lengthComputable: true, loaded: 1, total: 2 }); this.result = 'data:application/pdf;base64,JVBERg=='; this.onload(); }
    abort() { this.onabort?.(); }
  }
  const file = { name: 'bill.pdf', type: 'application/pdf', size: 4 };
  assert.deepEqual(await readCaptureFile(file, { Reader, onProgress: value => progress.push(value) }), { filename: 'bill.pdf', media_type: 'application/pdf', content_base64: 'JVBERg==' });
  assert.deepEqual(progress, [50]);
  await assert.rejects(readCaptureFile({ ...file, size: MAX_CAPTURE_BYTES + 1 }, { Reader }), /larger/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(readCaptureFile(file, { Reader, signal: controller.signal }), error => error.name === 'AbortError');
  assert.equal(reads, 1);
});

test('duplicates open their existing capture or correct native bill/credit without creating another editor', () => {
  assert.equal(capturePath({ id: 's' }), '/documents?capture=s');
  assert.equal(capturePath({ id: 's', document_id: 'b', document_kind: 'purchase_bill' }), '/bills/b');
  assert.equal(capturePath({ id: 's', document_id: 'c', document_kind: 'supplier_credit_note' }), '/supplier-credit-notes/c');
  assert.equal(prepareCapturePath('purchase_bill', 's'), '/bills/new?capture=s');
  assert.equal(prepareCapturePath('supplier_credit_note', 's'), '/supplier-credit-notes/new?capture=s');
  assert.equal(prepareCapturePath('sales_invoice', 's'), null);
});

test('save requires exact reviewed envelope, scope and three explicit acknowledgements', () => {
  const body = { source: { quantity: '0.1', unit_price: '999999999999.99' }, purchase_vat_eligible: false };
  const review = { key: 'company:source', envelopeKey: envelopeKey(body), review_fingerprint: 'v1:opaque', revision: '2' };
  const ack = { source_reviewed: true, supplier_confirmed: true, tax_treatment_confirmed: true };
  assert.ok(reviewMatches(review, 'company:source', body));
  assert.deepEqual(buildReviewedDraft(review, 'company:source', body, ack), { envelope: body, review_fingerprint: 'v1:opaque', ...ack });
  assert.throws(() => buildReviewedDraft(review, 'other-company:source', body, ack), /Details changed/);
  assert.throws(() => buildReviewedDraft(review, 'company:source', { ...body, purchase_vat_eligible: true }, ack), /Details changed/);
  assert.throws(() => buildReviewedDraft(review, 'company:source', body, { ...ack, supplier_confirmed: 'true' }), /Check the source/);
  assert.throws(() => buildReviewedDraft(review, 'company:source', body, emptyAcknowledgements()), /Check the source/);
});

test('company and route changes, newer requests and unmount invalidate stale requests', () => {
  const gate = createScopeGate(); const first = gate.begin('company-a:source-a');
  assert.ok(gate.current(first, 'company-a:source-a'));
  assert.equal(gate.current(first, 'company-b:source-a'), false);
  assert.equal(gate.current(first, 'company-a:source-b'), false);
  const second = gate.begin('company-a:source-a');
  assert.equal(gate.current(first, 'company-a:source-a'), false);
  assert.ok(gate.current(second, 'company-a:source-a'));
  gate.invalidate(); assert.equal(gate.current(second, 'company-a:source-a'), false);
});
