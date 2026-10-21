import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import InvoiceDocument from './InvoiceDocument';

const invoice = { invoice_number: 'SYNTHETIC-TEST', status: 'draft', issue_date: '2026-10-21',
  due_date: '2026-11-20', payment_terms: 30, line_items: [], subtotal: '2.14',
  vat_total: '0.42', total: '2.56', amount_paid: '0.00', balance_due: '2.56' };

test('draft document shows invoice date and totals, not issued or receivable/payment labels', () => {
  const html = renderToStaticMarkup(<InvoiceDocument invoice={invoice} />);
  assert.match(html, /Invoice date/);
  assert.match(html, /20 Nov 2026/);
  assert.match(html, /2\.56/);
  for (const label of ['Issued', 'Amount Paid', 'Balance Due']) assert.equal(html.includes(label), false);
});

test('inclusive document labels entered prices and percentage VAT without changing net fields', () => {
  const line = {description:'Inclusive fixture',quantity:'1',unit_price:'100.0000',entered_unit_price:'120',
    price_basis:'including_vat',vat_rate:'20.00',amount:'100.00',vat_amount:'20.00',line_total:'120.00'};
  const html = renderToStaticMarkup(<InvoiceDocument invoice={{...invoice,line_items:[line],subtotal:'100.00',vat_total:'20.00',total:'120.00'}} />);
  assert.match(html,/Prices including VAT/);
  assert.match(html,/Unit price \(incl\. VAT\)/);
  assert.match(html,/20%/);
  assert.match(html,/£120\.00/);
  const stale = renderToStaticMarkup(<InvoiceDocument invoice={{...invoice,preview:true,previewTotalsAvailable:false,
    price_basis:'including_vat',line_items:[line]}} />);
  assert.equal(stale.includes('£2.56'),false);
  assert.match(stale,/Save draft to calculate totals/);
  for (const treatment of ['zero','exempt','no_vat']) {
    const zero = renderToStaticMarkup(<InvoiceDocument invoice={{...invoice,line_items:[{...line,vat_rate:'0.00',tax_treatment:treatment}]}} />);
    assert.match(zero,/0%/);
    assert.ok(zero.includes({zero:'Zero rated',exempt:'Exempt',no_vat:'No VAT'}[treatment]));
  }
});
test('issued document retains payment labels and zero-day terms are preserved', () => {
  const html = renderToStaticMarkup(<InvoiceDocument invoice={{ ...invoice, status: 'sent', payment_terms: 0 }} />);
  for (const label of ['Issued', 'Amount Paid', 'Balance Due']) assert.ok(html.includes(label));
  assert.match(html, /Terms 0 days/);
});
