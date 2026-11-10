import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Offline evidence verification only: never connects to a database or HTTP API.
const dir = path.resolve(process.argv[2] ?? '../job21-evidence/browser');
const read = name => JSON.parse(readFileSync(path.join(dir, name), 'utf8'));
const report = read('final-report.json'), cleanup = read('cleanup.json');
assert.equal(cleanup.syntheticOnly, true);
for (const key of ['apiStopped', 'postgresStopped', 'directoryRemoved']) assert.equal(cleanup[key], true, key);
assert.equal(cleanup.existingDatabasesAccessed, false);
assert.equal(report.general_ledger.length, 14);
assert.deepEqual(report.journal_movements, { debit_minor: '30200', credit_minor: '30200' });
const journals = new Map();
for (const line of report.general_ledger) {
  assert.ok(line.source_id && line.journal_id);
  journals.set(line.journal_id, (journals.get(line.journal_id) ?? 0n) + BigInt(line.debit_minor) - BigInt(line.credit_minor));
}
assert.equal(journals.size, 5);
for (const balance of journals.values()) assert.equal(balance, 0n);
for (const [code, expected] of Object.entries({payables:'0',expense:'10000',input_vat:'2000',bank:'-13400',supplier_prepayment:'1400'})) {
  assert.equal(report.trial_balance.find(row => row.code === code)?.balance_minor, expected, code);
}
assert.equal(report.open_items.length, 1);
const bill = report.open_items[0];
assert.equal(bill.number, 'JOB21-BILL-001');
assert.equal(bill.gross_minor, '14400');
assert.equal(bill.paid_minor, '12000');
assert.equal(bill.credited_minor, '2400');
assert.equal(bill.open_minor, '0');
assert.equal(bill.correction_count, 1);
assert.equal(report.pnl.expense_minor, '10000');
assert.equal(report.vat.net_payable_pence, '-2000');
assert.equal(report.vat.box7_pence, '10000');
console.log('PASS: five balanced native journals, 14 lines, bill settled, £14 prepayment, £134 paid, £100 expense, £20 input VAT; owned resources removed.');
