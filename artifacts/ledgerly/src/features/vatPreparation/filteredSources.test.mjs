import test from 'node:test';
import assert from 'node:assert/strict';
import { csv } from '../../lib/ledgerCsv.mjs';
import { filteredSourceRows, selectedSourceDocuments, scopeKey, visibleSourceFilter, workingsRows } from './model.mjs';
import { reportFixture, coverageFixture } from './fixtures.mjs';

const context = { companyId: 'company-one', companyName: 'Synthetic company' };
const exportedSources = rows => rows.slice(rows.findIndex(row => row[0] === 'Posting date') + 1);

test('every box/search export selects exactly the visible evidence and retains company/period/filter context', () => {
  const data = reportFixture();
  for (const selected of ['all', '1', '4', '5', '6', '7']) {
    for (const search of ['', 'credit', '  BILL PARTY  ', 'unmatched']) {
      const rows = filteredSourceRows(data, { ...context, selected, search });
      assert.deepEqual(exportedSources(rows).map(row => row[8]), selectedSourceDocuments(data, selected, search).map(doc => doc.journal_id));
      assert.deepEqual(rows.find(row => row[0] === 'Company'), ['Company', 'Synthetic company']);
      assert.deepEqual(rows.find(row => row[0] === 'Company ID'), ['Company ID', 'company-one']);
      assert.deepEqual(rows.find(row => row[0] === 'From'), ['From', '2026-10-01', 'To', '2026-10-31']);
      assert.deepEqual(rows.find(row => row[0] === 'Search'), ['Search', search]);
      assert.ok(rows[0][0].includes('not a complete VAT return'));
      assert.ok(!rows.some(row => row.includes('REF-earlier')));
    }
  }
  assert.deepEqual(selectedSourceDocuments(data, '4').map(doc => doc.id), ['bill', 'supplier-credit', 'ineligible']);
  assert.deepEqual(selectedSourceDocuments(data, '6').map(doc => doc.id), ['invoice', 'sales-credit']);
});

test('filtered evidence retains original and correction journals separately with canonical signs', () => {
  const data = reportFixture();
  data.posted_documents.push({ ...data.posted_documents[0], date: '2026-10-28', journal_id: 'invoice-correction',
    movement_kind: 'financial_correction', net_minor: '-1000', vat_minor: '-200', gross_minor: '-1200' });
  Object.assign(data.vat, { box1_pence: '1300', box5_pence: '700', box6_pence: '6500', net_payable_pence: '700' });
  data.vat_coverage = coverageFixture(data);
  const rows = exportedSources(filteredSourceRows(data, { ...context, selected: '1', search: 'REF-invoice' }));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => row.slice(4)), [
    ['100.00', '20.00', '120.00', 'invoice', 'journal-invoice', 'Original posting'],
    ['-10.00', '-2.00', '-12.00', 'invoice', 'invoice-correction', 'Financial correction'],
  ]);
  const credit = exportedSources(filteredSourceRows(data, { ...context, selected: '4', search: 'supplier-credit' }));
  assert.deepEqual(credit[0].slice(4, 7), ['-10.00', '-2.00', '-12.00']);
});

test('filtered CSV preserves huge money and neutralises formula text in evidence and filter metadata', () => {
  const data = reportFixture();
  const doc = data.posted_documents[0];
  doc.net_minor = '900719925474099312345'; doc.vat_minor = '900719925474099312345';
  doc.gross_minor = '1801439850948198624690'; doc.number = '=SUM(1,2)'; doc.party_name = '@payload';
  Object.assign(data.vat, { box1_pence: '900719925474099311845', box6_pence: '900719925474099309845',
    box5_pence: '900719925474099311245', net_payable_pence: '900719925474099311245' });
  data.vat_coverage = coverageFixture(data);
  const output = csv(filteredSourceRows(data, { companyId: '+company-id', companyName: '-company-name', selected: '1', search: '=SUM' }));
  for (const value of ['"9007199254740993123.45"', '"18014398509481986246.90"', '"\'=SUM(1,2)"',
    '"\'@payload"', '"\'+company-id"', '"\'-company-name"', '"\'=SUM"']) assert.ok(output.includes(value), value);
});

test('unsupported boxes stay unknown and box 5 evidence does not claim a filtered net tax amount', () => {
  const data = reportFixture();
  const rows = filteredSourceRows(data, { ...context, selected: '5' });
  assert.equal(exportedSources(rows).length, 5);
  assert.ok(rows.some(row => row[0] === 'Box 5 boundary' && row[1].includes('must not be summed')));
  assert.ok(rows.some(row => row[0] === 'Return boundary' && row[1].includes('unknown amounts, not assumed zero')));
  for (const selected of ['2', '3', '8', '9', 'unknown']) {
    assert.throws(() => selectedSourceDocuments(data, selected), /supported VAT workings box/);
    assert.throws(() => filteredSourceRows(data, { ...context, selected }), /supported VAT workings box/);
  }
  data.vat_coverage.boxes[1].amount_pence = '0';
  assert.throws(() => filteredSourceRows(data, context), /could not be verified/);
});

test('empty and non-VAT evidence cannot manufacture monetary rows or broaden the full export', () => {
  const data = reportFixture();
  const fullBefore = workingsRows(data, context.companyName);
  const empty = filteredSourceRows(data, { ...context, search: 'nothing matches' });
  assert.deepEqual(exportedSources(empty), []);
  assert.deepEqual(empty.find(row => row[0] === 'Movements selected'), ['Movements selected', '0', 'Of', '5']);
  filteredSourceRows(data, { ...context, selected: '4', search: 'bill' });
  assert.deepEqual(workingsRows(data, context.companyName), fullBefore);
  assert.equal(exportedSources(fullBefore).length, 5);
  data.vat.applicable = false;
  assert.deepEqual(filteredSourceRows(data, context), []);
});

test('unverified company context and invalid snapshots cannot produce source evidence', () => {
  const data = reportFixture();
  for (const incomplete of [{}, { companyId: '' }, { companyId: 'company-one', companyName: '' }]) {
    assert.throws(() => filteredSourceRows(data, incomplete), /company.*could not be verified/);
  }
  data.vat.box1_pence = '0';
  assert.throws(() => filteredSourceRows(data, context), /could not be verified/);
});

test('company, date and refresh changes clear selected box/search before an effect runs', () => {
  const key = scopeKey('company-one', '2026-10-01', '2026-10-31', 0);
  const filter = { key, selected: '4', search: 'old supplier' };
  assert.equal(visibleSourceFilter(filter, key), filter);
  for (const next of [scopeKey('company-two', '2026-10-01', '2026-10-31', 0),
    scopeKey('company-one', '2026-09-01', '2026-09-30', 0), scopeKey('company-one', '2026-10-01', '2026-10-31', 1)]) {
    assert.deepEqual(visibleSourceFilter(filter, next), { key: next, selected: 'all', search: '' });
  }
});
