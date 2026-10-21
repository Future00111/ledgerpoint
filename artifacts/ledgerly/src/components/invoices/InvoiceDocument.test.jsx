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

test('issued document retains payment labels and zero-day terms are preserved', () => {
  const html = renderToStaticMarkup(<InvoiceDocument invoice={{ ...invoice, status: 'sent', payment_terms: 0 }} />);
  for (const label of ['Issued', 'Amount Paid', 'Balance Due']) assert.ok(html.includes(label));
  assert.match(html, /Terms 0 days/);
});
