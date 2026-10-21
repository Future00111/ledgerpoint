import test from 'node:test';
import assert from 'node:assert/strict';
import { newInvoiceDates, changeInvoiceFields, invoiceDueDate } from './invoiceEditor.mjs';

test('new draft defaults use 30 calendar days, including month and leap boundaries', () => {
  assert.deepEqual(newInvoiceDates('2026-10-21'), { issue_date: '2026-10-21', due_date: '2026-11-20', payment_terms: 30 });
  assert.equal(invoiceDueDate('2028-02-01', 30), '2028-03-02');
  assert.equal(invoiceDueDate('2026-03-29', 30), '2026-04-28');
});

test('changing price basis retains all entered line text and dates', () => {
  const form = {...newInvoiceDates('2026-10-21'),price_basis:'excluding_vat',
    line_items:[{quantity:'2.5',unit_price:'19.99',tax_code:'DEMO_20'}]};
  const changed = changeInvoiceFields(form,'price_basis','including_vat',true);
  assert.equal(changed.price_basis,'including_vat');
  assert.equal(changed.line_items,form.line_items);
  assert.equal(changed.due_date,form.due_date);
});
test('only an untouched new-draft due date follows terms and invoice date', () => {
  const form = newInvoiceDates('2026-10-21');
  assert.equal(changeInvoiceFields(form, 'payment_terms', 15, true).due_date, '2026-11-05');
  assert.equal(changeInvoiceFields(form, 'issue_date', '2026-10-22', true).due_date, '2026-11-21');
  assert.equal(changeInvoiceFields(form, 'issue_date', '', true).due_date, '2026-11-20');
  // Explicit dates and reopened source are never recomputed.
  const explicit = { ...form, due_date: '2026-11-20' };
  assert.equal(changeInvoiceFields(explicit, 'payment_terms', 0, false).due_date, '2026-11-20');
  assert.equal(changeInvoiceFields(explicit, 'issue_date', '2026-10-25', false).due_date, '2026-11-20');
});
