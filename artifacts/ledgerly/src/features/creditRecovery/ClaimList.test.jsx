import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ClaimList from './ClaimList';

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
  <MemoryRouter><ClaimList claims={[claim]} companyId="company-1" canManage={canManage} onChanged={() => {}} showBill /></MemoryRouter>,
);

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
