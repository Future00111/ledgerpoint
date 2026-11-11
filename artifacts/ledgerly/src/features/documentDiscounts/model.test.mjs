import test from 'node:test';
import assert from 'node:assert/strict';
import { canEditDrafts, canPostDocuments, canApplyDiscount, discountCreditPath, documentActionLabel,
  agreementPence, agreementTerms, matchesAgreementReceipt, discountAdjustment, balanceAfterSavedCredit, isCurrentDocumentRequest } from './model.mjs';

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

test('balance preview uses canonical reconciled settlement and saved credit within remaining credit capacity', () => {
  const partial = { gross_minor: '12000', credited_minor: '0', paid_minor: '5000', open_minor: '7000' };
  assert.equal(balanceAfterSavedCredit(partial, { gross_pence: '1200' }), '5800');
  assert.equal(balanceAfterSavedCredit(partial, { gross_pence: '8000' }), null);
  assert.equal(balanceAfterSavedCredit(partial, { gross_pence: '12000' }), null);
  assert.equal(balanceAfterSavedCredit(partial, { gross_pence: '12001' }), null);
  assert.equal(balanceAfterSavedCredit({ ...partial, credited_minor: '1000', open_minor: '6000' }, { gross_pence: '11001' }), null);
  assert.equal(balanceAfterSavedCredit(partial, { gross_pence: '1200' }, true), null);
  for (const value of [undefined, null, '', '01', '-1', '1.2', 0, '1e2', '1000000000000', 'garbage']) {
    assert.equal(balanceAfterSavedCredit(partial, { gross_pence: value }), null);
    for (const field of Object.keys(partial)) assert.equal(balanceAfterSavedCredit({ ...partial, [field]: value }, { gross_pence: '1200' }), null);
  }
  for (const item of [null, {}, { open_minor: '7000' }, { ...partial, paid_minor: '5001' }])
    assert.equal(balanceAfterSavedCredit(item, { gross_pence: '1200' }), null);
});

test('old company, document, or load generation cannot apply mutation result to a new view', () => {
  const started = { scope: 'company-a:bill-1', generation: 1 };
  assert.equal(isCurrentDocumentRequest(started, { ...started }), true);
  assert.equal(isCurrentDocumentRequest(started, { scope: 'company-b:bill-1', generation: 1 }), false);
  assert.equal(isCurrentDocumentRequest(started, { scope: 'company-a:bill-2', generation: 1 }), false);
  assert.equal(isCurrentDocumentRequest(started, { ...started, generation: 2 }), false);
});


test('discount entry requires an unpaid balance for both original document kinds', () => {
  const capabilities = { edit_drafts: true };
  for (const kind of ['sales_invoice', 'purchase_bill']) {
    for (const [credited, paid, open, expected] of [
      ['0', '0', '12000', true], ['0', '5000', '7000', true],
      ['0', '12000', '0', false], ['1200', '10800', '0', false],
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


test('original agreement money uses exact decimal minor units without rounding', () => {
  for (const [input, expected] of [['12.30','1230'],['0.01','1'],['9999999999.99','999999999999'],['1','100'],['1.2','120']]) assert.equal(agreementPence(input),expected);
  for (const input of ['', '0','0.00','01','1.001','1e2','-1',' 1','10000000000',1,null]) assert.equal(agreementPence(input),null);
});
test('captured original evidence matches exact company, both party types, all terms and evidence', () => {
  for (const party_type of ['customer','supplier']) {
    const entry={agreement_id:'agreement',agreement_date:'2026-11-01',payment_deadline:'2026-11-10',amount:'12.00'};
    const terms=agreementTerms(entry,party_type,'PARTY');
    const receipt={id:'11111111-1111-4111-8111-111111111111',company_id:'company',attested:true,party_type,party_id:'party',currency:'GBP',terms,evidence_text:'Agreed'};
    assert.equal(matchesAgreementReceipt(receipt,'company',terms,'Agreed'),true);
    assert.equal(matchesAgreementReceipt(receipt,'other',terms,'Agreed'),false);
    assert.equal(matchesAgreementReceipt(receipt,'company',terms,'Changed'),false);
    for (const key of Object.keys(terms)) assert.equal(matchesAgreementReceipt({...receipt,terms:{...terms,[key]:'changed'}},'company',terms,'Agreed'),false,key);
    for (const [key,value] of [['party_id','other'],['party_type','other'],['attested',false],['id',null],['currency','USD']]) assert.equal(matchesAgreementReceipt({...receipt,[key]:value},'company',terms),false,key);
    assert.equal(agreementTerms({...entry,payment_deadline:'2026-10-30'},party_type,'party'),null);
  }
});
