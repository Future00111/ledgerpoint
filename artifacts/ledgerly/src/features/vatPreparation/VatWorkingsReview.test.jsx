import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import VatWorkingsReview from './VatWorkingsReview';
import { visibleState } from './model.mjs';
import { reportFixture } from './fixtures.mjs';
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
  const html = render({ data: d });
  assert.ok(html.includes('Net VAT to reclaim'));
  assert.ok(html.includes('£9.00'));
  assert.ok(!html.includes('−£9.00'));
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
