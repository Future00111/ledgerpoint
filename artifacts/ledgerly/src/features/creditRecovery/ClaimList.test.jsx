import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ClaimList, { ClaimRowView } from './ClaimList';

const money = value => ({ net_pence: value, vat_pence: '0', gross_pence: value });
const fixture = {
  id: 'claim-1', revision: 'revision-1', bill_id: 'bill-1', bill_number: 'SYNTHETIC-B1', party_name: 'Synthetic Parts',
  original_line_ref: 0, description: 'Returned caliper', quantity: '2', received_quantity: '1', reason: 'Warranty',
  return_reference: 'RETURN-123', job_reference: 'SYNTHETIC-JOB', part_reference: 'PART-123',
  expected: money('4000'), received: money('3000'), remaining: money('1000'), status: 'partial', cancelled: false,
  receipts: [{ id: 'receipt-1', credit_id: 'credit-old', number: 'SYNTHETIC-C0', quantity: '1', money: money('3000'), active: true }],
  candidates: [{ credit_id: 'credit-new', credit_revision: 'revision-2', credit_line_ref: 0, number: 'SYNTHETIC-C1', quantity: '1', money: money('1000'), status: 'posted', can_confirm: true }],
};
const render = (claim = fixture, canManage = true) => renderToStaticMarkup(
  <MemoryRouter><ClaimRowView claim={claim} canManage={canManage} expanded detailId="details-claim-1" onChanged={() => {}} showBill /></MemoryRouter>,
);

test('collapsed queue preserves item and money context but requires review before confirmation', () => {
  const html = renderToStaticMarkup(<MemoryRouter><ClaimList claims={[fixture]} companyId="company-1" canManage onChanged={() => {}} showBill /></MemoryRouter>);
  for (const value of ['Synthetic Parts', 'SYNTHETIC-B1', 'Returned caliper', 'PART-123', 'RETURN-123', '£40.00', '£30.00', '£10.00', 'Review match']) assert.ok(html.includes(value), value);
  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(!html.includes('Confirm match'));
  assert.ok(!html.includes('Credit receipt history'));
});

test('review disclosure and confirmation retain the exact selected candidate', () => {
  let opened = 0, received;
  const element = ClaimRowView({ claim: fixture, canManage: true, expanded: true, detailId: 'review-this-item', showBill: true,
    onToggle: () => { opened++; }, onReceive: candidate => { received = candidate; }, date: '2026-10-30' });
  const elements = [];
  const visit = node => { if (!React.isValidElement(node)) return; elements.push(node); React.Children.forEach(node.props.children, visit); };
  visit(element);
  const toggle = elements.find(node => node.props['aria-controls'] === 'review-this-item');
  assert.equal(toggle.props['aria-expanded'], true);
  toggle.props.onClick();
  assert.equal(opened, 1);
  const confirm = elements.find(node => React.Children.toArray(node.props.children).includes('Confirm match'));
  confirm.props.onClick();
  assert.equal(received, fixture.candidates[0]);
  const html = renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
  assert.ok(html.includes('id="review-this-item"'));
  assert.ok(html.includes('Credit receipt history'));
});

test('busy review locks disclosure and confirmation while missing amounts stay unavailable', () => {
  const element = ClaimRowView({ claim: { ...fixture, remaining: undefined }, canManage: true, expanded: true, busy: true, detailId: 'busy-review' });
  const elements = [];
  const visit = node => { if (!React.isValidElement(node)) return; elements.push(node); React.Children.forEach(node.props.children, visit); };
  visit(element);
  assert.equal(elements.find(node => node.props['aria-controls'] === 'busy-review').props.disabled, true);
  assert.equal(elements.find(node => React.Children.toArray(node.props.children).includes('Working…')).props.disabled, true);
  const html = renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
  const waitingFigure = html.slice(html.indexOf('Still waiting'), html.indexOf('</dd>', html.indexOf('Still waiting')));
  assert.ok(waitingFigure.includes('—'));
  assert.ok(!waitingFigure.includes('£0.00'));
});

test('partial credit shows expected, received and remaining server amounts without settlement claims', () => {
  const html = render();
  for (const text of ['£40.00', '£30.00', '£10.00', 'Partially received', 'RETURN-123', 'SYNTHETIC-JOB', 'Confirm match']) assert.ok(html.includes(text), text);
  assert.ok(html.includes('/bills/bill-1'));
  assert.ok(html.includes('/supplier-credit-notes/credit-new'));
  assert.ok(!html.includes('Fully paid'));
  assert.ok(!html.includes('Cancel tracking'));
});

test('view-only and draft candidate renders cannot expose confirmation controls', () => {
  assert.ok(!render(fixture, false).includes('Confirm match'));
  const draft = { ...fixture, candidates: [{ ...fixture.candidates[0], status: 'draft', can_confirm: true }] };
  const html = render(draft);
  assert.ok(html.includes('review and post the credit first'));
  assert.ok(!html.includes('Confirm match'));
});

test('cancelled and reversed-receipt history remains visible without misleading actions', () => {
  const cancelled = render({ ...fixture, cancelled: true });
  assert.ok(cancelled.includes('Cancelled'));
  assert.ok(!cancelled.includes('Confirm match'));
  const reversed = render({ ...fixture, status: 'needs_review', receipts: [{ ...fixture.receipts[0], active: false }] });
  assert.ok(reversed.includes('No longer active'));
  assert.ok(reversed.includes('Needs review'));
  assert.ok(!reversed.includes('Cancel tracking'));
});

test('row shows age and suggested follow-up without implying a sent reminder or changing amounts', () => {
  const html = renderToStaticMarkup(<MemoryRouter><ClaimRowView claim={{ ...fixture, candidates: [], returned_on: '2026-10-01', expected_by: '2026-10-20' }} canManage={false} showBill date="2026-10-30" /></MemoryRouter>);
  for (const text of ['29 days since return', '10 days past expected date', 'contact the supplier', 'No reminder is sent from this tracker', 'SYNTHETIC-B1', '£10.00']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Send reminder'));
});
