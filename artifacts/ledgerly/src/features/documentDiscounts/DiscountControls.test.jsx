import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { DiscountEditor, DraftWriteActions, SavedDiscountSummary, DiscountBalanceReview } from './DiscountControls';
import DocumentLineFields from './DocumentLineFields';
const render = element => renderToStaticMarkup(element);
const noop = () => {};

test('draft save actions distinguish new and edited drafts and fail closed for readers', () => {
  assert.equal(render(<DraftWriteActions capabilities={{}} />), '');
  const editor = render(<DraftWriteActions capabilities={{ edit_drafts: true }} doc={{ id: 'd' }} editId="d" onReview={noop} />);
  assert.ok(editor.includes('Save changes'));
  assert.ok(!editor.includes('Review &amp; post'));
  assert.ok(editor.includes('owner or accountant'));
  assert.ok(render(<DraftWriteActions capabilities={{ edit_drafts: true }} />).includes('Save draft'));
  const dirty = render(<DraftWriteActions capabilities={{ edit_drafts: true, post_documents: true }} doc={{ id: 'd' }} editId="d" dirty onReview={noop} />);
  assert.match(dirty, /<button[^>]*disabled=""[^>]*data-testid="button-post"/);
});

test('ordinary discount amount labels follow price basis; adjustment amount always includes VAT', () => {
  for (const [priceBasis, label] of [['excluding_vat', 'before VAT'], ['including_vat', 'including VAT']]) {
    const html = render(<DiscountEditor value={{ type: 'amount', value: '10.00' }} priceBasis={priceBasis} onChange={noop} />);
    assert.ok(html.includes(`Discount amount (${label})`));
    assert.ok(html.includes('>None</option>'));
  }
  const adjustment = render(<DiscountEditor value={{ type: 'amount', value: '10' }} priceBasis="excluding_vat" adjustment onChange={noop} />);
  assert.ok(adjustment.includes('Discount amount (including VAT)'));
  assert.ok(adjustment.includes('not the remaining balance'));
  assert.ok(!adjustment.includes('>None</option>'));
});

test('zero-total draft can be saved but cannot be reviewed for posting', () => {
  const html = render(<DraftWriteActions capabilities={{ edit_drafts: true, post_documents: true }} doc={{ money: { gross_pence: '0' } }} editId="d" onReview={noop} />);
  assert.match(html, /<button[^>]*disabled=""[^>]*data-testid="button-post"/);
  assert.ok(!html.match(/<button[^>]*disabled=""[^>]*data-testid="button-save"/));
  assert.ok(html.includes('This draft totals £0.00. Zero-value documents cannot be posted yet.'));
});

test('saved discount summary displays authoritative amounts without deriving VAT from user percentage', () => {
  const html = render(<dl><SavedDiscountSummary money={{ discount: { type: 'percentage', value: '12.3456', price_basis: 'excluding_vat', base_pence: '10000', amount_pence: '1235', after_pence: '8765' } }} /></dl>);
  for (const text of ['£100.00', '£12.35', '£87.65', '12.3456%', 'before VAT']) assert.ok(html.includes(text), text);
  const adjustment = render(<dl><SavedDiscountSummary money={{ discount_adjustment: { type: 'amount', value: '10', price_basis: 'including_vat', base_pence: '12000', amount_pence: '1000', after_pence: '11000' } }} /></dl>);
  for (const text of ['Original total including VAT', 'Discount credit', '£10.00', '£110.00']) assert.ok(adjustment.includes(text), text);
});

test('late discount original line fields are locked, while normal credit quantities and prices remain editable', () => {
  const props = { line: { description: 'Synthetic part', quantity: '2', unit_price: '50', tax_code: 'S20' }, index: 0, credit: true,
    priceBasis: 'excluding_vat', taxRules: [{ code: 'S20', rate: '20', label: 'Standard' }], canRemove: true, onChange: noop, onRemove: noop };
  const locked = render(<DocumentLineFields {...props} discountMode />);
  assert.match(locked, /id="q0"[^>]*readOnly=""/);
  assert.match(locked, /id="p0"[^>]*readOnly=""/);
  assert.ok(locked.includes('Original unit price'));
  assert.ok(!locked.includes('Exclude from credit'));
  const normal = render(<DocumentLineFields {...props} />);
  assert.ok(!normal.match(/id="q0"[^>]*readOnly=""/));
  assert.ok(!normal.match(/id="p0"[^>]*readOnly=""/));
  assert.ok(normal.includes('Exclude from credit'));
  const fromDiscounted = render(<DocumentLineFields {...props} originalDiscount priceBasis="including_vat" />);
  assert.ok(fromDiscounted.includes('Credit per unit before original discount'));
  assert.ok(fromDiscounted.includes('original discount is applied'));
  assert.ok(!fromDiscounted.includes('For a £10 total credit'));
});

test('discount review separates original total, payments, current remaining and saved discount', () => {
  const props = { original: { money: { gross_pence: '12000' } }, item: { gross_minor: '12000', credited_minor: '0', paid_minor: '5000', open_minor: '7000' }, money: { gross_pence: '1200' } };
  const saved = render(<DiscountBalanceReview {...props} />);
  for (const text of ['£120.00', '£50.00', '£70.00', '£12.00', '£58.00', 'Balance if posted']) assert.ok(saved.includes(text), text);
  const unsaved = render(<DiscountBalanceReview {...props} dirty />);
  assert.ok(!unsaved.includes('£12.00'));
  assert.ok(!unsaved.includes('£58.00'));
  assert.ok(unsaved.includes('Save the draft'));
});
