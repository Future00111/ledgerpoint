import test from 'node:test';
import assert from 'node:assert/strict';
import { dueFromTerms, changeDateField, submittedDates, postingAccounts, columnTotals, plannedAccounts, issueFor } from './accountingEditor.mjs';
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
test('sales and purchase selectors use server eligible_roles strictly; credits inherit originals', () => {
  const roleRows = [{ id: 'a', eligible_roles: ['revenue'] }, { id: 'b', eligible_roles: ['expense'] }, { id: 'c', eligible_roles: [], eligibility_reason: 'Inactive' }, { id: 'd' }];
  assert.deepEqual(postingAccounts(roleRows, 'sales_invoice').map(a => a.id), ['a']);
  assert.deepEqual(postingAccounts(roleRows, 'purchase_bill').map(a => a.id), ['b']);
  assert.deepEqual(postingAccounts(roleRows, 'sales_credit_note'), []);
});
test('ledger movement and closing-balance footers sum their own columns with integer precision', () => {
  assert.deepEqual(columnTotals([{ debit_minor: '21600', credit_minor: '21600' }]), { debit_minor: '21600', credit_minor: '21600' });
  assert.deepEqual(columnTotals([{ debit_minor: '14400', credit_minor: '0' }, { debit_minor: '0', credit_minor: '14400' }]), { debit_minor: '14400', credit_minor: '14400' });
  assert.equal(columnTotals([{ debit_minor: '9007199254740993', credit_minor: '0' }, { debit_minor: '1', credit_minor: '0' }]).debit_minor, '9007199254740994');
});

test('planned accounts: non-recoverable purchase has no input VAT line; explicit sales account wins', () => {
  const mappings = { receivables: 'r', payables: 'p', revenue: 'rev', expense: 'exp', output_vat: 'o', input_vat: 'i' };
  const bill = plannedAccounts('purchase_bill', { mappings, purchase_vat_eligible: false, vatRegistered: true });
  assert.deepEqual(bill.map(r => r.id), ['p', 'exp']);
  const inv = plannedAccounts('sales_invoice', { mappings, posting_account_id: 'x', vatRegistered: true });
  assert.deepEqual(inv.map(r => r.id), ['r', 'x', 'o']);
  const credit = plannedAccounts('sales_credit_note', { mappings, posting_account_id: 'x', vatRegistered: true });
  assert.equal(credit[1].id, 'rev');
});
test('issueFor finds path issue', () => {
  assert.equal(issueFor({ issues: [{ path: '/posting_account_id', message: 'm' }] }, '/posting_account_id').message, 'm');
  assert.equal(issueFor(null, '/x'), null);
});

test('saved draft account list filters the six-role snapshot like the unsaved preview', () => {
  const six = { receivables: 'r', payables: 'p', revenue: 'rev', expense: 'exp', output_vat: 'o', input_vat: 'i' };
  assert.equal(Object.keys(six).length, 6);
  const sales = plannedAccounts('sales_invoice', { mappings: six, vatRegistered: true });
  assert.deepEqual(sales.map(r => r.id), ['r', 'rev', 'o']);
  const credit = plannedAccounts('supplier_credit_note', { mappings: six, purchase_vat_eligible: true, vatRegistered: true });
  assert.deepEqual(credit.map(r => r.id), ['p', 'exp', 'i']);
  const nonRec = plannedAccounts('purchase_bill', { mappings: six, purchase_vat_eligible: false, vatRegistered: true });
  assert.deepEqual(nonRec.map(r => r.id), ['p', 'exp']);
  assert.match(nonRec[1].label, /non-recoverable/);
  const nonVat = plannedAccounts('sales_invoice', { mappings: six, vatRegistered: false });
  assert.deepEqual(nonVat.map(r => r.id), ['r', 'rev']);
  assert.deepEqual(plannedAccounts('sales_invoice', { mappings: six, vatRegistered: true, vatMinor: '0' }).map(r => r.id), ['r', 'rev']);
  assert.deepEqual(plannedAccounts('purchase_bill', { mappings: six, vatRegistered: true, purchase_vat_eligible: true, vatMinor: '0' }).map(r => r.id), ['p', 'exp']);
});
