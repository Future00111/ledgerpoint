import test from 'node:test';
import assert from 'node:assert/strict';
import { documentReportLink, postedAccountMovement, filterLedger, pnlTransactions } from './reportTrace.mjs';

test('posted contribution uses saved account and actual journal including credit reversals', () => {
  const doc = { posting_accounts: { revenue: 'custom-sales', expense: 'cost' } };
  const lines = [{ account_id: 'custom-sales', debit_minor: '0', credit_minor: '5000' }, { account_id: 'old-sales', debit_minor: '0', credit_minor: '9000' }];
  assert.equal(postedAccountMovement(doc, lines, 'revenue', true).amount, '5000');
  assert.equal(postedAccountMovement(doc, [{ account_id: 'custom-sales', debit_minor: '833', credit_minor: '0' }], 'revenue', true).amount, '-833');
  assert.equal(postedAccountMovement(doc, [{ account_id: 'cost', debit_minor: '10500', credit_minor: '0' }], 'expense').amount, '10500');
  assert.equal(postedAccountMovement(doc, lines, 'input_vat').amount, '0');
});
test('P&L category drilldown groups split lines, includes credits and excludes VAT and drafts', () => {
  const line = { journal_id: 'j1', source_type: 'sales_invoice', source_id: 'd1', source_number: 'INV-1', posting_date: '2026-10-21', account_type: 'income', account_id: 'sales', account_code: '4000', account_name: 'Sales', debit_minor: '0', credit_minor: '3000', report_group: 'Consulting' };
  const data = { posted_documents: [{ id: 'd1', party_name: 'Example customer' }], general_ledger: [
    line, { ...line, credit_minor: '2000' },
    { ...line, account_id: 'vat', account_type: 'liability', credit_minor: '1000' },
    { ...line, journal_id: 'j2', source_id: 'credit', source_type: 'sales_credit_note', debit_minor: '833', credit_minor: '0' },
    { ...line, journal_id: 'j3', source_id: 'bill', source_type: 'purchase_bill', account_type: 'expense', account_id: 'cost', debit_minor: '3000', credit_minor: '0', report_group: 'Office' },
  ] };
  const rows = pnlTransactions(data, { categoryId: 'income', groupName: 'Consulting' });
  assert.equal(rows.length, 2);
  assert.equal(rows.find(r => r.id === 'd1').amount_minor, '5000');
  assert.equal(rows.find(r => r.id === 'd1').party, 'Example customer');
  assert.equal(rows.reduce((n, r) => n + BigInt(r.amount_minor), 0n), 4167n);
  assert.equal(pnlTransactions(data, { accountId: 'cost' })[0].amount_minor, '3000');
  assert.deepEqual(pnlTransactions(data, { categoryId: 'cost_of_sales' }), []);
});
test('report navigation includes historic and future posting dates; filters intersect', () => {
  const doc = { id: 'invoice-1', source: { issue_date: '2025-10-21' } };
  assert.match(documentReportLink(doc, 'pnl', undefined, '2026-10-21'), /from=2025-01-01&to=2026-10-21&document_id=invoice-1/);
  assert.match(documentReportLink(doc, 'gl', '2027-02-02', '2026-10-21'), /from=2027-01-01&to=2027-02-02/);
  const lines = [{ account_id:'a', source_id:'d' }, { account_id:'b', source_id:'d' }, { account_id:'a', source_id:'e' }];
  assert.deepEqual(filterLedger(lines, 'a', 'd'), [lines[0]]);
  assert.equal(filterLedger(lines, null, null).length, 3);
});
