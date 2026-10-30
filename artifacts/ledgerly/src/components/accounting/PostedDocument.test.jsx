import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import PostedDocument from './PostedDocument';

const source = {
  invoice_number: 'SYNTHETIC-144', issue_date: '2026-10-30', due_date: '2026-11-29',
  payment_terms: 30, price_basis: 'excluding_vat', reference: 'TEST DATA', notes: '',
  line_items: [
    { description: 'Caliper', quantity: '2', unit_price: '50', tax_code: 'STANDARD_20' },
    { description: 'Surcharge', quantity: '1', unit_price: '20', tax_code: 'STANDARD_20' },
  ],
};
const doc = {
  id: 'synthetic-bill', revision: '1', status: 'posted', party_name: 'Synthetic party', party_id: 'synthetic-party',
  journal_id: 'synthetic-journal', original_id: 'synthetic-original', source,
  money: { net_pence: '12000', vat_pence: '2400', gross_pence: '14400', lines: [{ net_pence: '10000' }, { net_pence: '2000' }] },
};
function render(kind) {
  return renderToStaticMarkup(<MemoryRouter><PostedDocument kind={kind} doc={{ ...doc, kind }}
    company={{ id: 'synthetic-company', name: 'Synthetic test company' }} journal={{ status: 'loading', data: null }}
    settlement={{ loading: false, to: '2026-10-30' }} openItem={{ gross_minor: '14400', paid_minor: '0', credited_minor: '3000', open_minor: '11400', history: [] }}
  /></MemoryRouter>);
}

test('posted supplier invoice shows tracking at the heading and original lines while access loads, retaining accounting amounts', () => {
  const html = render('purchase_bill');
  assert.match(html.match(/<header\b[\s\S]*?<\/header>/)?.[0] ?? '', /Checking credit status/);
  assert.match(html, /<th>Supplier credit<\/th>/);
  for (const value of ['row-line-0', 'row-line-1', 'Caliper', 'Surcharge', '£144.00', '£114.00', '£24.00']) assert.ok(html.includes(value), value);
  assert.match(html, /Awaiting supplier credits/);
  assert.match(html, /Create credit note/);
});

test('sales invoices and posted credit notes retain their original actions without supplier-return selectors', () => {
  for (const kind of ['sales_invoice', 'sales_credit_note', 'supplier_credit_note']) {
    const html = render(kind);
    assert.ok(!html.includes('Select lines awaiting credit'), kind);
    assert.ok(!html.includes('<th>Supplier credit</th>'), kind);
    assert.ok(!html.includes('Awaiting supplier credits'), kind);
    assert.match(html, /£144.00/);
    assert.ok(html.includes(kind === 'sales_invoice' ? 'Record payment' : 'View original document'), kind);
  }
});
