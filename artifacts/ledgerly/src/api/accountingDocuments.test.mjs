import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSource, buildEnvelope, copyOriginalLines, penceToDisplay, createAccountingClient, docPath } from './accountingDocuments.mjs';

const form = { customer_id: 'p', invoice_number: 'C1', issue_date: '2025-01-10', due_date: '2025-01-10', payment_terms: '0', reference: '', notes: '', price_basis: 'including_vat', line_items: [{ description: 'a', quantity: '0.2', unit_price: '120', tax_code: 'S20' }] };

test('credit envelope forces offset_outstanding and keeps strings', () => {
  const b = buildEnvelope('sales_credit_note', form, { original_line_refs: [1], original_id: 'o', reason: 'r', effective_adjustment_date: '2025-01-10', purchase_vat_eligible: true });
  assert.equal(b.adjustment_method, 'offset_outstanding');
  assert.equal(b.purchase_vat_eligible, false);
  assert.equal(b.source.line_items[0].quantity, '0.2');
  assert.equal(b.source.price_basis, 'including_vat');
});
test('purchase eligibility only true when explicitly true', () => {
  assert.equal(buildEnvelope('purchase_bill', form, {}).purchase_vat_eligible, false);
  assert.equal(buildEnvelope('purchase_bill', form, { purchase_vat_eligible: true }).purchase_vat_eligible, true);
});
test('copy preserves order', () => {
  const l = copyOriginalLines({ source: { line_items: [{ description: 'x' }, { description: 'y' }] } });
  assert.deepEqual(l.map(x => x.description), ['x', 'y']);
});
test('pence display', () => { assert.equal(penceToDisplay('-12000'), '−£120.00'); assert.equal(penceToDisplay('123456'), '£1,234.56'); });
test('doc paths', () => { assert.equal(docPath('purchase_bill', 'a'), '/bills/a'); });
test('discount inputs stay decimal strings and clearing sends explicit null for PATCH semantics', () => {
  const discounted = buildSource({ ...form, discount: { type: 'percentage', value: '12.3456' } });
  assert.deepEqual(discounted.discount, { type: 'percentage', value: '12.3456' });
  assert.equal(discounted.discount_adjustment, null);
  const cleared = buildSource({ ...form, discount: null });
  assert.equal(cleared.discount, null);
  assert.equal(cleared.discount_adjustment, null);
});
test('discount adjustment preserves original revision and full source lines in native credit envelope', () => {
  const adjustment = { type: 'amount', value: '10.00', original_revision: 'original-revision' };
  const body = buildEnvelope('supplier_credit_note', { ...form, discount_adjustment: adjustment }, { original_id: 'original', original_line_refs: [2], reason: 'Agreed discount', effective_adjustment_date: '2025-01-10' });
  assert.deepEqual(body.source.discount_adjustment, adjustment);
  assert.equal(body.source.discount, null);
  assert.deepEqual(body.original_line_refs, [2]);
  assert.equal(body.source.line_items[0].unit_price, '120');
  assert.equal(body.source.line_items[0].quantity, '0.2');
  assert.equal(body.adjustment_method, 'offset_outstanding');
});
test('post sends quoted If-Match and surfaces error code', async () => {
  let seen;
  const c = createAccountingClient(async (url, init) => { seen = init; return { ok: false, status: 409, json: async () => ({ error: { code: 'REVISION_CONFLICT', message: 'stale' } }) }; });
  await assert.rejects(c.post('co', 'd', 3), e => e.code === 'REVISION_CONFLICT');
  assert.equal(seen.headers['If-Match'], '"3"');
});

test('ordinary invoice/bill always sends posting_account_id; default clears to null', () => {
  assert.equal(buildEnvelope('sales_invoice', form, { posting_account_id: 'acc-4000' }).posting_account_id, 'acc-4000');
  const cleared = buildEnvelope('sales_invoice', form, { posting_account_id: '' });
  assert.ok(Object.hasOwn(cleared, 'posting_account_id'));
  assert.equal(cleared.posting_account_id, null);
  assert.equal(buildEnvelope('purchase_bill', form, {}).posting_account_id, null);
  assert.ok(!Object.hasOwn(buildEnvelope('sales_credit_note', form, { original_id: 'o' }), 'posting_account_id'));
});
test('error issues are preserved for field-level display', async () => {
  const issues = [{ path: '/posting_account_id', code: 'ACCOUNT_NOT_ELIGIBLE', message: 'Choose a sales account.' }];
  const c = createAccountingClient(async () => ({ ok: false, status: 422, json: async () => ({ error: { code: 'VALIDATION', message: 'Invalid', issues } }) }));
  await assert.rejects(c.update('co', 'd', {}, 1), e => e.code === 'VALIDATION' && e.issues.length === 1 && e.issues[0].path === '/posting_account_id');
});

test('updateAccount PATCHes with quoted sha256 revision; no delete method exists', async () => {
  let seen;
  const c = createAccountingClient(async (url, init) => { seen = { url, init }; return { ok: true, status: 200, json: async () => ({ data: { id: 'a' } }) }; });
  await c.updateAccount('co', 'a', { name: 'Consulting' }, 'sha256:ab');
  assert.equal(seen.init.method, 'PATCH');
  assert.equal(seen.init.headers['If-Match'], '"sha256:ab"');
  assert.ok(seen.url.endsWith('/accounting-accounts/a'));
  assert.equal(c.deleteAccount, undefined);
});


test('original payment identity recovery is a scoped read and sends no frozen financial payload', async () => {
  let seen;
  const client=createAccountingClient(async (url,init)=>{seen={url,init};return {ok:true,json:async()=>({data:{status:'unknown',id:'request/id'}})};});
  const signal=new AbortController().signal;
  const result=await client.recoverPayment('company/id','request/id',signal);
  assert.equal(seen.url,'/api/companies/company%2Fid/accounting-payments/operations/request%2Fid');
  assert.equal(seen.init.method,'GET');assert.equal(seen.init.body,undefined);assert.equal(seen.init.signal,signal);
  assert.deepEqual(result,{status:'unknown',id:'request/id'});
});
test('conditional draft receipt is preserved and explicit clear survives native envelope',()=>{
 const terms={version:1,evidence_receipt_id:'receipt',discount_gross_pence:'1200'};
 assert.deepEqual(buildSource({...form,conditional_discount:terms}).conditional_discount,terms);
 assert.equal(buildSource({...form,conditional_discount:null}).conditional_discount,null);
});
test('conditional evidence capture/read use company scoped native endpoints',async()=>{
 const calls=[],client=createAccountingClient(async(url,options)=>{calls.push([url,options]);return {ok:true,json:async()=>({data:{id:'receipt'}})};});
 await client.captureConditionalEvidence('company',{attested:true,evidence_text:'Actual agreement'});
 await client.getConditionalEvidence('company','receipt');
 assert.equal(calls[0][0],'/api/companies/company/conditional-discount-evidence');
 assert.equal(calls[0][1].method,'POST');
 assert.equal(calls[1][0],'/api/companies/company/conditional-discount-evidence/receipt');
});
test('conditional credit review is scoped, revision-bound and exposes no commit method',async()=>{
 const calls=[],preview={readonly:true,posting_available:false};
 const client=createAccountingClient(async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>({data:preview})};});
 const body={request_id:'request',reason:'Eligibility review'};
 assert.equal(await client.reviewConditionalCredit('company/id','credit/id',body,'saved-revision'),preview);
 assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/companies/company%2Fid/accounting-documents/credit%2Fid/conditional-credit/review');
 assert.equal(calls[0].init.method,'POST');assert.equal(calls[0].init.headers['If-Match'],'"saved-revision"');assert.deepEqual(JSON.parse(calls[0].init.body),body);
 assert.equal(client.commitConditionalCredit,undefined);
});

test('explicit conditional original and current discount methods use scoped native routes',async()=>{
 const calls=[],client=createAccountingClient(async(url,options)=>{calls.push({url,...options});return {ok:true,json:async()=>({data:{}})};});
 await client.postConditionalOriginal('co','doc','r');await client.observeConditionalOriginal('co','doc');
 await client.reviewConditionalDiscount('co','credit',{request_id:'request'},'r');await client.commitConditionalDiscount('co','credit',{request_id:'request'},'r');await client.recoverConditionalDiscount('co','request');
 assert.deepEqual(calls.map(c=>c.url),['/api/companies/co/accounting-documents/doc/conditional-original','/api/companies/co/accounting-documents/doc/conditional-original/observe','/api/companies/co/accounting-documents/credit/conditional-discount/review','/api/companies/co/accounting-documents/credit/conditional-discount','/api/companies/co/accounting-conditional-discounts/operations/request']);
});
