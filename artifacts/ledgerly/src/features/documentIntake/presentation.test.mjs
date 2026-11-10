import test from 'node:test';
import assert from 'node:assert/strict';
import { captureReturnPath, savedCapturePath, sourceOpenPath, filterSources, documentProgress } from './presentation.mjs';

const sourceId = '6bba1f6e-0b9b-4ca8-a13b-aeb5abebbcac';
test('source returns accept only source identifiers and construct an internal inbox URL', () => {
  assert.equal(captureReturnPath(sourceId), `/documents?capture=${sourceId}`);
  for (const invalid of [null, '', '../bills', '/documents', 'https://example.test/', '//example.test/', `javascript:${sourceId}`, `${sourceId}&other=1`]) assert.equal(captureReturnPath(invalid), null);
});
test('saved and duplicate captures preserve the native bill/credit route plus a safe source return', () => {
  assert.equal(savedCapturePath('purchase_bill', 'bill/id', sourceId), `/bills/bill%2Fid?capture=${sourceId}`);
  assert.equal(savedCapturePath('supplier_credit_note', 'credit', sourceId), `/supplier-credit-notes/credit?capture=${sourceId}`);
  assert.equal(savedCapturePath('purchase_bill', 'bill', '//external'), '/bills/bill');
  assert.equal(sourceOpenPath({ id: sourceId, document_kind: 'purchase_bill', document_id: 'bill' }), `/bills/bill?capture=${sourceId}`);
  assert.equal(sourceOpenPath({ id: sourceId }), `/documents?capture=${sourceId}`);
});
test('inbox filters only the supplied recent-source metadata and preserve original source identity', () => {
  const pending = { id: 'pending', filename: 'SUPPLIER-May.pdf', document_id: null };
  const linked = { id: 'linked', filename: 'Supplier-CREDIT.png', document_id: 'credit' };
  const sources = [pending, linked];
  assert.deepEqual(filterSources(sources, ' supplier ', 'all'), sources);
  assert.deepEqual(filterSources(sources, '', 'prepare'), [pending]);
  assert.equal(filterSources(sources, 'credit', 'linked')[0], linked);
  assert.deepEqual(filterSources(sources, 'absent', 'all'), []);
  assert.deepEqual(sources, [pending, linked]);
});
test('capture progress requires source review before save and does not imply posting', () => {
  const entering = documentProgress(true, false, false);
  assert.deepEqual(entering.map(step => step.label), ['Enter details', 'Review source & totals', 'Save linked draft']);
  assert.equal(entering.filter(step => step.current).length, 1);
  assert.equal(documentProgress(true, true, false).find(step => step.current).label, 'Save linked draft');
  assert.equal(documentProgress(false, false, true).find(step => step.current).label, 'Review & post');
});
