import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEnvelope, copyOriginalLines, penceToDisplay, createAccountingClient, docPath } from './accountingDocuments.mjs';

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
