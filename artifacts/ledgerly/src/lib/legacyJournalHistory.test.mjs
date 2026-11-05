import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyMinor, legacyEntryTotals, displayedLegacyTotals, legacyLineAccounts } from './legacyJournalHistory.mjs';

test('historical decimal strings convert to minor units exactly; invalid totals stay unavailable', () => {
  assert.equal(legacyMinor('0.10'), '10');
  assert.equal(legacyMinor('9999999999.99'), '999999999999');
  for (const value of [undefined, null, '', 0, 0.1, 'NaN', 'Infinity', '1e2', '1.001', '-1.00', '10000000000.00', ' 1.00']) {
    assert.equal(legacyMinor(value), null, String(value));
  }
  assert.equal(legacyEntryTotals({ total_debit: '1.00' }), null);
});

test('displayed header totals sum exact pennies without inferring missing values or offsetting per-entry imbalances', () => {
  const totals = displayedLegacyTotals([{ total_debit: '0.10', total_credit: '0.00' }, { total_debit: '0.20', total_credit: '0.30' }]);
  assert.deepEqual(totals, { debit: '30', credit: '30', difference: '0', unbalancedEntries: 2 });
  assert.deepEqual(displayedLegacyTotals([{ total_debit: '100.10', total_credit: '100.00' }]), {
    debit: '10010', credit: '10000', difference: '10', unbalancedEntries: 1,
  });
  assert.equal(displayedLegacyTotals([{ total_debit: '1.00', total_credit: null }]), null);
  assert.equal(displayedLegacyTotals([{ debit: '1.00', credit: '1.00' }]), null, 'Line-style fields cannot substitute for header totals');
  const many = Array.from({ length: 500 }, () => ({ total_debit: '9999999999.99', total_credit: '9999999999.99' }));
  assert.equal(displayedLegacyTotals(many).debit, '499999999999500');
});

test('account search uses stored line metadata and tolerates malformed legacy JSON', () => {
  assert.equal(legacyLineAccounts({ lines: [{ account_code: '5000', account_name: 'Repairs' }, null, { account_name: 7 }] }), '5000 Repairs  ');
  assert.equal(legacyLineAccounts({ account_name: 'Invented header account' }), '');
  assert.equal(legacyLineAccounts({ lines: {} }), '');
});
