import test from 'node:test';
import assert from 'node:assert/strict';
import { csv, decimalMinor, statementRows } from './ledgerCsv.mjs';

test('a statement carries opening invoices and credit through payment, allocation and refund movements', () => {
  const data = {
    party_balances: [{ party_id: 'c', balance_minor: '3000', unapplied_minor: '1000' }],
    party_transactions: [
      { party_id: 'c', balance_effect_minor: '-6000', unapplied_effect_minor: '2000' },
      { party_id: 'c', balance_effect_minor: '-1000', unapplied_effect_minor: '-1000' },
      { party_id: 'other', balance_effect_minor: '99999', unapplied_effect_minor: '0' },
      { party_id: 'c', balance_effect_minor: '0', unapplied_effect_minor: '-500' },
    ],
  };
  const s = statementRows(data, 'c');
  assert.equal(s.opening, '10000');
  assert.equal(s.openingUnapplied, '500');
  assert.equal(s.closing, '3000');
  assert.equal(s.unapplied, '1000');
  assert.equal(s.net, '2000');
  assert.deepEqual(s.rows.map(r => [r.running_balance_minor, r.running_unapplied_minor]), [['4000', '2500'], ['3000', '1500'], ['3000', '1000']]);
  assert.deepEqual(s.rows.map(r => r.net_effect_minor), ['-8000', '0', '500']);
});

test('exact export handles large values, negative pennies, quoted text and spreadsheet formula prefixes', () => {
  assert.equal(decimalMinor('900719925474099301'), '9007199254740993.01');
  assert.equal(decimalMinor('-1'), '-0.01');
  assert.equal(csv([['=HYPERLINK("bad")', 'a,b\n"c"', decimalMinor('-1')]]), '\uFEFF"\'=HYPERLINK(""bad"")","a,b\n""c""","-0.01"');
});

test('customer statement negatives remain numbers while formula-like references stay escaped', () => {
  assert.equal(csv([['Payment', decimalMinor('-12000')], ['Refund', decimalMinor('-1000')], ['Net balance', decimalMinor('-2000')]]),
    '\uFEFF"Payment","-120.00"\r\n"Refund","-10.00"\r\n"Net balance","-20.00"');
  for (const value of ['-1+2', '-120.00+1', '=1+2', '+1+2', '@SUM(A1)', '  =1+2', '\t=1+2', '\r=1+2']) {
    assert.equal(csv([[value]]), `\uFEFF"'${value}"`);
  }
});
