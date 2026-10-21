import test from 'node:test';
import assert from 'node:assert/strict';
import { dueFromTerms, changeDateField, submittedDates, postingAccounts, columnTotals } from './accountingEditor.mjs';
const form = { issue_date: '2026-10-21', payment_terms: '30', due_date: '2026-11-20' };
test('new draft dates follow issue date plus terms across months and leap years', () => {
  assert.equal(dueFromTerms(form.issue_date, form.payment_terms), '2026-11-20');
  assert.equal(dueFromTerms('2024-02-28', '2'), '2024-03-01');
  assert.equal(changeDateField(form, 'payment_terms', '0', false).due_date, '2026-10-21');
  assert.equal(changeDateField(form, 'issue_date', '2026-10-22', false).due_date, '2026-11-21');
  assert.equal(dueFromTerms('2026-02-31', '30'), null);
});
test('manual and reopened saved due dates are not recalculated by issue/terms edits', () => {
  assert.equal(changeDateField(form, 'payment_terms', '60', true).due_date, '2026-11-20');
  assert.equal(changeDateField(form, 'issue_date', '2026-11-01', true).due_date, '2026-11-20');
});
test('save captures the displayed date even if a native input event has not updated React state', () => {
  const stale = { ...form, due_date: '2026-10-21' };
  assert.equal(submittedDates(stale, { due_date: '2026-11-20' }, false).due_date, '2026-11-20');
  assert.equal(submittedDates(form, { payment_terms: '60' }, false).due_date, '2026-12-20');
  assert.equal(submittedDates(form, { payment_terms: '60' }, true).due_date, '2026-11-20');
});
test('credit dates remain explicit and are never derived from payment terms', () => {
  assert.equal(changeDateField(form, 'issue_date', '2026-10-22', false, true).due_date, '2026-11-20');
  assert.equal(submittedDates(form, { payment_terms: '60' }, false, true).due_date, '2026-11-20');
});
test('sales and purchase overrides exclude control, wrong-type and inactive accounts; credits inherit originals', () => {
  const accounts = ['asset', 'liability', 'income', 'revenue', 'expense', 'cost_of_sales'].map(account_type => ({ account_type }));
  accounts.push({ account_type: 'income', is_active: false });
  assert.deepEqual(postingAccounts(accounts, 'sales_invoice').map(a => a.account_type), ['income', 'revenue']);
  assert.deepEqual(postingAccounts(accounts, 'purchase_bill').map(a => a.account_type), ['expense', 'cost_of_sales']);
  assert.deepEqual(postingAccounts(accounts, 'sales_credit_note'), []);
});
test('ledger movement and closing-balance footers sum their own columns with integer precision', () => {
  assert.deepEqual(columnTotals([{ debit_minor: '21600', credit_minor: '21600' }]), { debit_minor: '21600', credit_minor: '21600' });
  assert.deepEqual(columnTotals([{ debit_minor: '14400', credit_minor: '0' }, { debit_minor: '0', credit_minor: '14400' }]), { debit_minor: '14400', credit_minor: '14400' });
  assert.equal(columnTotals([{ debit_minor: '9007199254740993', credit_minor: '0' }, { debit_minor: '1', credit_minor: '0' }]).debit_minor, '9007199254740994');
});
