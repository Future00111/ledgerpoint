import test from 'node:test';
import assert from 'node:assert/strict';
import { canEditDrafts, canPostDocuments, canApplyDiscount, discountCreditPath, documentActionLabel,
  discountAdjustment, balanceAfterSavedCredit, isCurrentDocumentRequest } from './model.mjs';

test('editing and posting require independently explicit capabilities', () => {
  for (const capability of [undefined, null, {}, { edit_drafts: 'true', post_documents: 1 }]) {
    assert.equal(canEditDrafts(capability), false);
    assert.equal(canPostDocuments(capability), false);
  }
  assert.equal(canEditDrafts({ edit_drafts: true }), true);
  assert.equal(canPostDocuments({ edit_drafts: true }), false);
  assert.equal(documentActionLabel('draft', { edit_drafts: true }), 'Edit draft');
  assert.equal(documentActionLabel('draft', {}), 'View');
  assert.equal(documentActionLabel('posted', { edit_drafts: true }), 'View');
});

test('late discount uses existing credit workflow for original invoices and bills, including partially paid', () => {
  assert.equal(discountCreditPath('sales_invoice', 'a/b'), '/sales-credit-notes/new?original=a%2Fb&discount=1');
  assert.equal(discountCreditPath('purchase_bill', 'bill'), '/supplier-credit-notes/new?original=bill&discount=1');
  assert.equal(discountCreditPath('supplier_credit_note', 'credit'), null);
  const partial = { gross_minor: '12000', credited_minor: '0', paid_minor: '5000', open_minor: '7000' };
  assert.equal(canApplyDiscount('purchase_bill', partial, { edit_drafts: true }), true);
  assert.equal(canApplyDiscount('purchase_bill', { ...partial, open_minor: '0' }, { edit_drafts: true }), false);
  assert.equal(canApplyDiscount('purchase_bill', partial, {}), false);
  assert.equal(canApplyDiscount('sales_credit_note', partial, { edit_drafts: true }), false);
});

test('adjustment preparation captures source revision while preserving entered decimal values', () => {
  assert.deepEqual(discountAdjustment({ revision: 'rev2' }, { type: 'amount', value: '10.001' }), { type: 'amount', value: '10.001', original_revision: 'rev2' });
  assert.deepEqual(discountAdjustment({ revision: 'rev3' }), { type: 'percentage', value: '', original_revision: 'rev3' });
});

test('balance preview subtracts only saved pence and never computes a percentage or uses stale totals', () => {
  assert.equal(balanceAfterSavedCredit({ open_minor: '7000' }, { gross_pence: '1200' }), '5800');
  assert.equal(balanceAfterSavedCredit({ open_minor: '9007199254740993' }, { gross_pence: '10' }), '9007199254740983');
  assert.equal(balanceAfterSavedCredit({ open_minor: '1000' }, { gross_pence: '1200' }), '-200');
  assert.equal(balanceAfterSavedCredit({ open_minor: '7000' }, { gross_pence: '1200' }, true), null);
  assert.equal(balanceAfterSavedCredit(null, { gross_pence: '1200' }), null);
});

test('old company, document, or load generation cannot apply mutation result to a new view', () => {
  const started = { scope: 'company-a:bill-1', generation: 1 };
  assert.equal(isCurrentDocumentRequest(started, { ...started }), true);
  assert.equal(isCurrentDocumentRequest(started, { scope: 'company-b:bill-1', generation: 1 }), false);
  assert.equal(isCurrentDocumentRequest(started, { scope: 'company-a:bill-2', generation: 1 }), false);
  assert.equal(isCurrentDocumentRequest(started, { ...started, generation: 2 }), false);
});


test('paid-discount entry uses remaining original credit capacity, independently of remaining cash due', () => {
  const capabilities = { edit_drafts: true };
  for (const kind of ['sales_invoice', 'purchase_bill']) {
    for (const [credited, paid, open, expected] of [
      ['0', '0', '12000', true], ['0', '5000', '7000', true],
      ['0', '12000', '0', true], ['1200', '10800', '0', true],
      ['12000', '0', '0', false],
    ]) assert.equal(canApplyDiscount(kind, { gross_minor: '12000', credited_minor: credited, paid_minor: paid, open_minor: open }, capabilities), expected);
  }
});

test('discount entry rejects missing, malformed or inconsistent settlement without throwing', () => {
  const valid = { gross_minor: '12000', credited_minor: '0', paid_minor: '12000', open_minor: '0' };
  for (const field of Object.keys(valid)) {
    for (const value of [undefined, null, '', '01', '-1', '1.2', 0, '1e2', '1000000000000', 'garbage']) {
      assert.equal(canApplyDiscount('sales_invoice', { ...valid, [field]: value }, { edit_drafts: true }), false, `${field}:${value}`);
    }
  }
  for (const item of [null, {}, { ...valid, gross_minor: '0' }, { ...valid, paid_minor: '1' }, { ...valid, credited_minor: '12001' }])
    assert.equal(canApplyDiscount('purchase_bill', item, { edit_drafts: true }), false);
  for (const capabilities of [undefined, null, {}, { edit_drafts: 'true' }, { post_documents: true }])
    assert.equal(canApplyDiscount('sales_invoice', valid, capabilities), false);
  for (const kind of ['supplier_credit_note', 'sales_credit_note', 'unknown'])
    assert.equal(canApplyDiscount(kind, valid, { edit_drafts: true }), false);
});
