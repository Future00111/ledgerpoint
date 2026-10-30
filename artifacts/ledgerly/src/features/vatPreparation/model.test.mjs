import test from 'node:test';
import assert from 'node:assert/strict';
import { csv } from '../../lib/ledgerCsv.mjs';
import { initialPeriod, periodFromParams, periodError, scopeKey, visibleState, validateSnapshot, requestWorkings, sourceDocuments, workingsRows } from './model.mjs';
import { reportFixture } from './fixtures.mjs';

test('VAT links retain their exact dates and invalid explicit dates require correction', () => {
  assert.deepEqual(periodFromParams(new URLSearchParams('from=2026-07-01&to=2026-09-30')), { from: '2026-07-01', to: '2026-09-30' });
  const invalid = periodFromParams(new URLSearchParams('from=&to=2026-02-30'));
  assert.equal(invalid.from, ''); assert.ok(periodError(invalid.from, invalid.to));
});

test('period input rejects impossible, unbounded, missing and reversed dates without rollover', () => {
  assert.deepEqual(initialPeriod(new Date('2026-10-30T23:59:00Z')), { from: '2026-10-01', to: '2026-10-30' });
  for (const [from, to] of [['2026-02-30', '2026-03-01'], ['', '2026-03-01'], ['2026-10-31', '2026-10-01'], ['1899-01-01', '2026-10-01'], ['2026-01-01', '10000-01-01'], ['2026-1-1', '2026-10-01']]) assert.ok(periodError(from, to));
  assert.equal(periodError('2024-02-29', '2024-02-29'), '');
  assert.equal(periodError('1900-01-01', '9999-12-31'), '');
});

test('source review keeps canonical signs, period scope and eligible VAT without inferring tax from gross', () => {
  const data = reportFixture();
  assert.equal(validateSnapshot(data, data.from, data.to), data);
  assert.deepEqual(sourceDocuments(data, 'sales').map(d => d.id), ['invoice', 'sales-credit']);
  assert.deepEqual(sourceDocuments(data, 'purchases').map(d => d.id), ['bill', 'supplier-credit', 'ineligible']);
  assert.equal(sourceDocuments(data, 'all', ' SUPPLIER-CREDIT PARTY ')[0].vat_minor, '-200');
  const rows = workingsRows(data, 'Synthetic company');
  assert.deepEqual(rows.find(r => r[1] === 'REF-sales-credit').slice(4, 7), ['-25.00', '-5.00', '-30.00']);
  assert.deepEqual(rows.find(r => r[1] === 'REF-ineligible').slice(4, 7), ['10.00', '0.00', '12.00']);
  assert.ok(!rows.some(r => r.includes('REF-earlier')));
});

test('incomplete, mismatched or unreconciled server evidence cannot appear as verified workings', () => {
  const normal = reportFixture();
  assert.throws(() => validateSnapshot(normal, '2026-09-01', normal.to), /could not be verified/);
  for (const edit of [
    d => { delete d.posted_documents[0].vat_minor; },
    d => { d.posted_documents[0].vat_minor = 2000; },
    d => { d.posted_documents[0].vat_box = '4'; },
    d => { d.posted_documents[1].vat_minor = '500'; },
    d => { d.vat.box1_pence = '9999'; },
    d => { d.vat.box5_pence = 'NaN'; },
    d => { d.vat.applicable = 'false'; },
  ]) { const d = reportFixture(); edit(d); assert.throws(() => validateSnapshot(d, d.from, d.to), /could not be verified/); }
});

test('CSV preserves integer-string precision and neutralises formula-like source text', () => {
  const d = reportFixture();
  d.posted_documents[0].net_minor = '900719925474099312345';
  d.posted_documents[0].vat_minor = '900719925474099312345';
  d.vat.box1_pence = '900719925474099311845';
  d.posted_documents[0].number = '=HYPERLINK("https://invalid.example")';
  d.posted_documents[0].party_name = '\t+SUM(1,2)';
  d.posted_documents[1].party_name = '@SUM(1,2)';
  const output = csv(workingsRows(validateSnapshot(d, d.from, d.to), '-unsafe company'));
  assert.ok(output.includes('"9007199254740993123.45"'));
  assert.ok(output.includes('"9007199254740993118.45"'));
  assert.ok(output.includes('"\'=HYPERLINK(""https://invalid.example"")"'));
  assert.ok(output.includes('"\'\t+SUM(1,2)"'));
  assert.ok(output.includes('"\'@SUM(1,2)"'));
  assert.ok(output.includes('"\'-unsafe company"'));
  assert.ok(output.includes('"-25.00","-5.00","-30.00"'));
  assert.ok(output.includes('not a filed return'));
});

test('company, date, removal and refresh scope changes hide both old data and old errors immediately', () => {
  const data = reportFixture();
  const key = scopeKey('company-a', data.from, data.to);
  const state = { key, data, loading: false, error: new Error('old error') };
  assert.equal(visibleState(state, key), state);
  for (const next of [scopeKey('company-b', data.from, data.to), scopeKey(null, data.from, data.to), scopeKey('company-a', '2026-09-01', data.to), scopeKey('company-a', data.from, '2026-10-30'), scopeKey('company-a', data.from, data.to, 1)]) {
    assert.deepEqual(visibleState(state, next), { key: next, data: null, loading: true, error: null });
  }
});

test('cancelled success and error cannot replace a newer result even when transport ignores abort', async () => {
  const data = reportFixture(); const states = []; const deferred = [];
  const load = (company, from, to, signal) => new Promise((resolve, reject) => deferred.push({ resolve, reject, signal }));
  const start = key => requestWorkings({ companyId: key, from: data.from, to: data.to, key, load, publish: state => states.push(state) });
  const old = start('old'); await Promise.resolve(); old.cancel();
  const next = start('next'); await Promise.resolve();
  deferred[1].resolve(data); await next.done;
  deferred[0].resolve(data); await old.done;
  assert.equal(deferred[0].signal.aborted, true);
  assert.deepEqual(states.map(s => s.key), ['next']);
  const rejected = start('rejected'); await Promise.resolve(); rejected.cancel();
  deferred[2].reject(new Error('stale failure')); await rejected.done;
  assert.deepEqual(states.map(s => s.key), ['next']);
});

test('load errors fail closed and a fresh retry can recover', async () => {
  const data = reportFixture(); const states = [];
  const props = { companyId: 'company', from: data.from, to: data.to, publish: state => states.push(state) };
  await requestWorkings({ ...props, key: 'one', load: async () => { throw new Error('offline'); } }).done;
  assert.equal(states[0].data, null); assert.equal(states[0].loading, false); assert.equal(states[0].error.message, 'offline');
  await requestWorkings({ ...props, key: 'two', load: async () => data }).done;
  assert.equal(states[1].data, data); assert.equal(states[1].error, null);
});

test('non-VAT companies have no source rows or export even if response contains financial figures', () => {
  const d = reportFixture(); d.vat.applicable = false;
  assert.equal(validateSnapshot(d, d.from, d.to), d);
  assert.deepEqual(sourceDocuments(d), []);
  assert.deepEqual(workingsRows(d, 'Non VAT'), []);
});
