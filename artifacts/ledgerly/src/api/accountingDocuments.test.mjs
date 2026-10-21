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
