import test from 'node:test';
import assert from 'node:assert/strict';
import { csv } from '../../lib/ledgerCsv.mjs';
import { dateError, reportPeriod, periodPreset, reportPeriodLabel, reportTab, requestRead, visibleRead, validateReport, validateJournal, ledgerRows, ledgerAccountPath, reportExport, statementPath, vatPath } from './model.mjs';

const ledger = [
  { id: 'one', posting_date: '2026-10-21', account_id: 'sales', account_code: '4000', account_name: 'Revenue', source_type: 'sales_invoice', source_id: 'invoice', source_number: 'INV-1', journal_id: 'journal-one', debit_minor: '0', credit_minor: '9007199254740993' },
  { id: 'two', posting_date: '2026-10-22', account_id: 'sales', account_code: '4000', account_name: 'Revenue', source_type: 'sales_credit_note', source_id: 'credit', source_number: '=CREDIT()', journal_id: 'journal-two', debit_minor: '12345', credit_minor: '0' },
  { id: 'three', posting_date: '2026-10-22', account_id: 'vat', account_code: '2200', account_name: 'VAT payable', source_type: 'sales_credit_note', source_id: 'credit', source_number: '=CREDIT()', journal_id: 'journal-two', debit_minor: '2469', credit_minor: '0' },
];
const fixture = () => ({ from: '2026-10-01', to: '2026-10-31', general_ledger: ledger,
  trial_balance: [], party_balances: [], party_transactions: [], ageing: [], pnl: {}, balance_sheet: {},
  vat: { applicable: true, box1_pence: '0', box4_pence: '100', box5_pence: '100', box6_pence: '0', box7_pence: '500', repayment: true } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('dates retain all-history drilldown and reject empty, impossible and reversed periods', () => {
  assert.equal(dateError('0001-01-01', '9999-12-31'), '');
  assert.equal(dateError('2024-02-29', '2024-02-29'), '');
  for (const dates of [['0000-01-01', '2026-01-01'], ['2026-02-29', '2026-03-01'], ['', '2026-01-01'], ['2026-10-31', '2026-10-01'], ['2026-01-01', '10000-01-01']]) assert.ok(dateError(...dates));
  const link = new URL(ledgerAccountPath('account', '2026-01-01', '2026-10-31', true), 'https://ledger.invalid');
  assert.equal(link.searchParams.get('from'), '0001-01-01');
});

test('closing reports use As-at independently of movement ranges, including previous years', () => {
  const params = new URLSearchParams('from=2026-10-01&to=2025-12-31');
  for (const tab of ['tb', 'bs', 'ageing']) {
    assert.deepEqual(reportPeriod(params, tab), { from: '0001-01-01', to: '2025-12-31' });
    assert.equal(reportPeriodLabel(tab, '0001-01-01', '2025-12-31'), 'As at 31 Dec 2025');
  }
  assert.deepEqual(reportPeriod(params, 'pnl'), { from: '2026-10-01', to: '2025-12-31' });
  assert.equal(reportPeriod(new URLSearchParams('from=&to='), 'gl').from, '');
  assert.deepEqual(periodPreset('last-month', new Date('2026-01-15T01:00:00Z')), { from: '2025-12-01', to: '2025-12-31' });
  assert.deepEqual(periodPreset('quarter', new Date('2026-10-30T01:00:00Z')), { from: '2026-10-01', to: '2026-10-30' });
  assert.equal(reportTab('unknown', 'gl'), 'gl');
});

test('company/date/refresh changes and return to a previous scope immediately remove export authority', () => {
  const key = Symbol('company A'), old = { key, data: fixture(), loading: false, error: null };
  assert.equal(visibleRead(old, key), old);
  for (const next of [Symbol('company B'), Symbol('date changed'), Symbol('refresh'), Symbol('company A')]) {
    const state = visibleRead(old, next);
    assert.equal(state.data, null); assert.equal(state.loading, true);
    assert.deepEqual(reportExport(state.data, 'gl', { companyName: 'New company', from: '2026-10-01', to: '2026-10-31' }), []);
  }
  assert.deepEqual(visibleRead(old, key, false), { key, data: null, loading: false, error: null });
});

test('cancelled successes and errors cannot publish after scope changes even if abort is ignored', async () => {
  const old = deferred(), fresh = deferred(), states = [];
  const first = requestRead({ key: 'old', load: () => old.promise, publish: s => states.push(s) });
  await Promise.resolve(); first.cancel();
  const second = requestRead({ key: 'new', load: () => fresh.promise, publish: s => states.push(s) });
  fresh.resolve('fresh'); await second.done; old.resolve('old'); await first.done;
  assert.deepEqual(states.map(s => [s.key, s.data]), [['new', 'fresh']]);
  const late = deferred(), rejected = requestRead({ key: 'rejected', load: () => late.promise, publish: s => states.push(s) });
  await Promise.resolve(); rejected.cancel(); late.reject(new Error('late')); await rejected.done;
  assert.equal(states.length, 1);
});

test('wrong-period and wrong-company journal responses fail closed; retries recover', async () => {
  const d = fixture(), states = [];
  assert.equal(validateReport(d, d.from, d.to), d);
  assert.throws(() => validateReport(d, '2026-09-01', d.to), /could not be verified/);
  assert.throws(() => validateJournal({ entry: { id: 'j', company_id: 'b' }, lines: [] }, 'a', 'j'), /this company/);
  assert.throws(() => validateJournal({ entry: { id: 'wrong', company_id: 'a' }, lines: [] }, 'a', 'j'), /this company/);
  await requestRead({ key: 'first', load: async () => ({ ...d, from: 'wrong' }), validate: v => validateReport(v, d.from, d.to), publish: s => states.push(s) }).done;
  assert.equal(states[0].data, null); assert.ok(states[0].error); assert.equal(states[0].loading, false);
  await requestRead({ key: 'retry', load: async () => d, validate: v => validateReport(v, d.from, d.to), publish: s => states.push(s) }).done;
  assert.equal(states[1].data, d); assert.equal(states[1].error, null);
});

test('ledger search intersects existing filters and CSV matches exact displayed source amounts', () => {
  const d = fixture(), filters = { accountId: 'sales', documentId: 'credit', search: ' CREDIT ' };
  assert.deepEqual(ledgerRows(ledger, filters).map(r => r.id), ['two']);
  const options = { companyName: '=unsafe company', from: d.from, to: d.to, ...filters };
  const output = csv(reportExport(d, 'gl', options));
  for (const text of ['"Included ledger lines","1"', '"123.45","0.00"', '"\'=CREDIT()"', '"\'=unsafe company"']) assert.ok(output.includes(text));
  assert.ok(!output.includes('INV-1')); assert.ok(!output.includes('2200'));
  const all = csv(reportExport(d, 'gl', { ...options, accountId: null, documentId: null, search: '' }));
  assert.ok(all.includes('"90071992547409.93"'));
  assert.deepEqual(reportExport(d, 'gl', { ...options, from: '2026-09-01' }), []);
});

test('VAT exports retain repayment scope; non-VAT cannot export a zero-valued return', () => {
  const d = fixture(), options = { companyName: 'Synthetic', from: d.from, to: d.to };
  const output = csv(reportExport(d, 'vat', options));
  assert.ok(output.includes('Repayment')); assert.ok(output.includes('not a complete VAT return'));
  d.vat.applicable = false; assert.deepEqual(reportExport(d, 'vat', options), []);
  assert.equal(statementPath('a&other=b'), '/statements?party_id=a%26other%3Db');
  assert.equal(statementPath('a', '0001-01-01', '2025-12-31'), '/statements?party_id=a&from=0001-01-01&to=2025-12-31');
  const url = new URL(vatPath('2026-07-01', '2026-09-30'), 'https://ledger.invalid');
  assert.equal(url.searchParams.get('from'), '2026-07-01'); assert.equal(url.searchParams.get('to'), '2026-09-30');
});

test('account-balance CSV discloses closing basis and does not imply transaction-history export', () => {
  const d = fixture();
  d.party_balances = [{ party_id: 'customer', party_name: 'Synthetic', party_type: 'customer', balance_minor: '500', unapplied_minor: '100', net_balance_minor: '400' }];
  const output = csv(reportExport(d, 'parties', { companyName: 'Synthetic', from: d.from, to: d.to, partyId: 'customer' }));
  assert.ok(output.includes('"As at","2026-10-31"')); assert.ok(output.includes('Account balances only.'));
  assert.ok(output.includes('"5.00","1.00","4.00"')); assert.ok(!output.includes('"From","2026-10-01"'));
});
