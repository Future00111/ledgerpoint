import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import PostedDocument from './PostedDocument';
import { DiscountBalanceReview } from '../../features/documentDiscounts/DiscountControls';

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
function render(kind, overrides = {}) {
  return renderToStaticMarkup(<MemoryRouter><PostedDocument kind={kind} doc={{ ...doc, kind }}
    company={{ id: 'synthetic-company', name: 'Synthetic test company' }} journal={{ status: 'loading', data: null }}
    capabilities={{ edit_drafts: true, post_documents: true }}
    settlement={{ loading: false, to: '2026-10-30' }} openItem={{ gross_minor: '14400', paid_minor: '0', credited_minor: '3000', open_minor: '11400', history: [] }}
    {...overrides}
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

test('apply discount is available on partially settled originals only with verified edit permission', () => {
  for (const kind of ['sales_invoice', 'purchase_bill']) {
    const html = render(kind, { openItem: { gross_minor: '14400', paid_minor: '5000', credited_minor: '0', open_minor: '9400', history: [] }, capabilities: { edit_drafts: true, post_documents: false } });
    assert.ok(html.includes('Apply discount'));
    assert.ok(html.includes('original=synthetic-bill&amp;discount=1'));
    assert.ok(!html.includes('Record payment'));
    const readonly = render(kind, { capabilities: null });
    assert.ok(!readonly.includes('Apply discount'));
    assert.ok(!readonly.includes('Create credit note'));
    assert.ok(!readonly.includes('Record payment'));
    assert.ok(readonly.includes('View journal'));
    assert.ok(render(kind, { openItem: { gross_minor: '14400', paid_minor: '14400', credited_minor: '0', open_minor: '0', history: [] } }).includes('Apply discount'));
  }
});

test('posted discount credit labels original prices and server allocated credit amounts', () => {
  const adjustedDoc = { ...doc, kind: 'sales_credit_note', source: { ...source, discount_adjustment: { type: 'amount', value: '10', original_revision: 'rev' } },
    money: { ...doc.money, net_pence: '833', vat_pence: '167', gross_pence: '1000', discount_adjustment: {
      type: 'amount', value: '10', price_basis: 'including_vat', base_pence: '14400', amount_pence: '1000', after_pence: '13400',
    } } };
  const html = render('sales_credit_note', { doc: adjustedDoc });
  for (const text of ['Original unit price', 'Original qty', 'Credit net', 'allocated discount credit', 'Discount credit', '£10.00', '£134.00']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Apply discount'));
});

test('normal return from discounted original explains inherited pricing without claiming another full discount', () => {
  const html = render('supplier_credit_note', { doc: { ...doc, kind: 'supplier_credit_note', tax_context: { original_discount: { type: 'percentage', value: '10' } } } });
  assert.ok(html.includes('Credit amounts use the original discounted prices.'));
  assert.ok(html.includes('Unit price before original discount'));
  assert.ok(!html.includes('Original total less discount'));
});


test('fully paid originals prepare discount drafts while preserving unavailable and exhausted guards', () => {
  const paid = { gross_minor: '14400', paid_minor: '14400', credited_minor: '0', open_minor: '0', history: [] };
  for (const kind of ['sales_invoice', 'purchase_bill']) {
    const html = render(kind, { openItem: paid, capabilities: { edit_drafts: true } });
    assert.ok(html.includes('Apply discount'));
    assert.ok(html.includes('original=synthetic-bill&amp;discount=1'));
    assert.ok(!html.includes('Record payment'));
    assert.ok(!html.includes('Record refund'));
    const overrides = [
      { openItem: null },
      { openItem: { ...paid, paid_minor: '0', credited_minor: '14400' } },
      { settlement: { loading: true } },
      { settlement: { loading: false, error: new Error('Unavailable') } },
      { error: new Error('Document unavailable') },
      { capabilities: null },
      { capabilities: { edit_drafts: 'true' } },
      ...[{ correction_count: 1 }, { status: 'cancelled' }, { status: 'draft' }, { kind: 'supplier_credit_note' }, { id: '' }]
        .map(patch => ({ doc: { ...doc, kind, ...patch } })),
    ];
    for (const override of overrides) assert.ok(!render(kind, { openItem: paid, ...override }).includes('Apply discount'), JSON.stringify(override));
  }
});


test('malformed settlement renders an unavailable state rather than money, status or write actions', () => {
  const valid = { gross_minor: '14400', paid_minor: '14400', credited_minor: '0', open_minor: '0', history: [] };
  for (const kind of ['sales_invoice', 'purchase_bill']) {
    for (const field of ['gross_minor', 'paid_minor', 'credited_minor', 'open_minor']) {
      for (const value of [undefined, null, '', 'garbage', '-1', '1.5', '01', 0, '1000000000000']) {
        const html = render(kind, { openItem: { ...valid, [field]: value } });
        assert.ok(html.includes('Settlement balance is unavailable'), `${kind}:${field}:${value}`);
        for (const label of ['Apply discount', 'Record payment', 'Create credit note', 'data-testid="settlement-status"'])
          assert.ok(!html.includes(label), label);
      }
    }
    for (const settlement of [{ loading: true }, { loading: false, error: new Error('Unavailable') }]) {
      const html = render(kind, { openItem: valid, settlement });
      assert.ok(!html.includes('data-testid="settlement-status"'));
      assert.ok(!html.includes('Apply discount'));
    }
  }
});


test('discount review hides stale or malformed balances and never suggests excess beyond credit capacity', () => {
  const item = { gross_minor: '14400', credited_minor: '0', paid_minor: '14000', open_minor: '400' };
  const money = { gross_pence: '1000' };
  const renderReview = (props = {}) => renderToStaticMarkup(<DiscountBalanceReview original={doc} item={item} money={money} {...props} />);
  const valid = renderReview();
  for (const value of ['£144.00', '£140.00', '£4.00', '£10.00', '£6.00', 'posting this credit does not move cash']) assert.ok(valid.includes(value), value);
  for (const props of [{ loading: true }, { error: new Error('Unavailable') }, { item: null }, { original: { money: { gross_pence: '14500' } } },
    ...Object.keys(item).flatMap(field => [undefined, null, '', '-1', '01', 'bad', '1.2', 0, '1000000000000'].map(value => ({ item: { ...item, [field]: value } })))]) {
    const html = renderReview(props);
    for (const value of ['£144.00', '£140.00', '£4.00', '£10.00', '£6.00', 'Balance if posted', 'posting this credit does not move cash']) assert.ok(!html.includes(value), JSON.stringify(props) + value);
  }
  for (const props of [{ dirty: true }, ...[undefined, null, '', '-1', 'bad', '1.2', 1000, '14401'].map(value => ({ money: { gross_pence: value } }))]) {
    const html = renderReview(props);
    assert.ok(html.includes('Balance preview unavailable'));
    assert.ok(!html.includes('Balance if posted'));
    assert.ok(!html.includes('posting this credit does not move cash'));
  }
});
