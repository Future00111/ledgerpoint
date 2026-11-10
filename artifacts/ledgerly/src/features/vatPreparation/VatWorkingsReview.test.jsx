import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import VatWorkingsReview from './VatWorkingsReview';
import { visibleState } from './model.mjs';
import { reportFixture, coverageFixture } from './fixtures.mjs';
const render = ({ key, ...props }) => renderToStaticMarkup(<MemoryRouter><VatWorkingsReview key={key} {...props} /></MemoryRouter>);

test('workings show five server boxes, signed credits, zero eligible VAT and document/journal routes', () => {
  const html = render({ data: reportFixture() });
  for (const box of [1, 4, 5, 6, 7]) assert.ok(html.includes(`button-vat-box-${box}`));
  for (const box of [2, 3, 8, 9]) assert.ok(!html.includes(`button-vat-box-${box}`));
  for (const route of ['/invoices/invoice', '/bills/bill', '/sales-credit-notes/sales-credit', '/supplier-credit-notes/supplier-credit', '/accounting/journals/journal-supplier-credit']) assert.ok(html.includes(route));
  for (const text of ['−£25.00', '−£5.00', '£0.00', 'Net VAT to pay', '5 shown of 5', 'Export all workings CSV']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('REF-earlier'));
  assert.ok(!html.includes('Submit'));
});

test('repayment direction uses server direction and does not turn box 5 negative', () => {
  const d = reportFixture(); d.vat.repayment = true; d.vat.net_payable_pence = '-900';
  Object.assign(d.posted_documents[2], { net_minor: '13000', vat_minor: '2600', gross_minor: '15600' });
  d.vat.box4_pence = '2400'; d.vat.box7_pence = '13000'; d.vat_coverage = coverageFixture(d);
  const html = render({ data: d });
  assert.ok(html.includes('Net VAT to reclaim'));
  assert.ok(html.includes('£9.00'));
  assert.ok(!html.includes('−£9.00'));
});

test('coverage separates reconciled workings from unsupported boxes, engine scope and filing authority', () => {
  const html = render({ data: reportFixture() });
  for (const box of [1, 2, 3, 4, 5, 6, 7, 8, 9]) assert.ok(html.includes(`vat-coverage-box-${box}`));
  for (const text of ['Workings reconciled · 5 of 9 boxes', 'Filing unavailable', 'Current engine scope', 'not confirmation that every transaction', 'Unknown', 'Not implemented', 'Coverage and reconciliation details']) assert.ok(html.includes(text), text);
  for (const box of [2, 3, 8, 9]) {
    const row = html.match(new RegExp(`<tr[^>]+data-testid="vat-coverage-box-${box}"[^>]*>(.*?)</tr>`))?.[1];
    assert.ok(row?.includes('Unknown')); assert.ok(!row?.includes('£0.00'));
  }
  assert.ok(!html.includes('>Submit')); assert.ok(!html.includes('>Approve'));
});

test('missing coverage is shown as unavailable and old data cannot leave a green reconciliation claim', () => {
  const d = reportFixture(); delete d.vat_coverage;
  const html = render({ data: d });
  assert.ok(html.includes('Coverage check unavailable')); assert.ok(!html.includes('Workings reconciled'));
  assert.ok(html.includes('button-vat-csv'));
  const stale = render({ data: reportFixture(), loading: true });
  assert.ok(!stale.includes('Workings reconciled')); assert.ok(!stale.includes('vat-coverage-box'));
});

test('correction row keeps its document and distinct journal links and is clearly a difference movement', () => {
  const d = reportFixture();
  d.posted_documents.push({ ...d.posted_documents[0], journal_id: 'correction-journal', date: '2026-10-28',
    net_minor: '-1000', vat_minor: '-200', gross_minor: '-1200', movement_kind: 'financial_correction' });
  d.vat.box1_pence = '1300'; d.vat.box5_pence = '700'; d.vat.box6_pence = '6500'; d.vat.net_payable_pence = '700';
  d.vat_coverage = coverageFixture(d);
  const html = render({ data: d });
  for (const text of ['6 posted movements from 5 source documents', 'Correction', '/accounting/journals/correction-journal', '−£2.00']) assert.ok(html.includes(text), text);
  assert.equal((html.match(/href="\/invoices\/invoice"/g) ?? []).length, 2);
});

test('non-VAT view hides boxes, monetary rows and CSV export', () => {
  const d = reportFixture(); d.vat.applicable = false;
  const html = render({ data: d });
  assert.ok(html.includes('Not VAT registered'));
  for (const text of ['button-vat-box', 'button-vat-csv', 'REF-invoice', '£']) assert.ok(!html.includes(text));
});

test('unsupported setup and load errors provide retry without misleading empty VAT figures', () => {
  const html = render({ data: reportFixture(), error: { code: 'VAT_SETUP_UNSUPPORTED' } });
  assert.ok(html.includes('unsupported VAT setup'));
  assert.ok(html.includes('button-retry-vat'));
  assert.ok(html.includes('/accounting/setup'));
  assert.ok(!html.includes('button-vat-box'));
  assert.ok(!html.includes('£'));
});

test('old scope and refresh loading render no stale money or source links', () => {
  const state = { key: 'old', data: reportFixture(), loading: false, error: null };
  for (const props of [visibleState(state, 'new'), { ...state, loading: true }]) {
    const html = render(props);
    assert.ok(html.includes('Loading posted VAT workings'));
    assert.ok(!html.includes('£'));
    assert.ok(!html.includes('/invoices/'));
    assert.ok(!html.includes('button-vat-csv'));
  }
});

test('full workings and filtered evidence exports remain distinct with an explicit evidence-only label', () => {
  const html = render({ data: reportFixture(), companyId: 'company-one', companyName: 'Synthetic company' });
  for (const label of ['Export all workings CSV', 'Export filtered sources CSV', 'only the 5 source movements shown below',
    'company, period and filter details', 'It is not a complete VAT return']) assert.ok(html.includes(label), label);
  const filtered = html.match(/<button[^>]+data-testid="button-vat-filtered-csv"[^>]*>/)?.[0];
  assert.ok(filtered); assert.ok(!filtered.includes('disabled=""'));
});

test('filtered export is disabled without verified company context or source movements', () => {
  const empty = reportFixture(); empty.posted_documents = [];
  for (const field of ['box1_pence', 'box4_pence', 'box5_pence', 'box6_pence', 'box7_pence', 'net_payable_pence']) empty.vat[field] = '0';
  empty.vat_coverage = coverageFixture(empty);
  for (const props of [{ data: empty, companyId: 'company-one', companyName: 'Synthetic company' }, { data: reportFixture() }]) {
    const html = render(props);
    const filtered = html.match(/<button[^>]+data-testid="button-vat-filtered-csv"[^>]*>/)?.[0];
    assert.ok(filtered?.includes('disabled=""'));
  }
  for (const props of [{ data: reportFixture(), loading: true }, { error: new Error('offline') },
    { data: { ...reportFixture(), vat: { applicable: false } } }]) assert.ok(!render(props).includes('button-vat-filtered-csv'));
});
