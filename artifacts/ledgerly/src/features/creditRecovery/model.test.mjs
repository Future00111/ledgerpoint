import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClaimRequest, canCancelClaim, canConfirmCandidate, claimStatus, createRequestBook, createRequestGate, filterClaims,
  hasReceivedCredit, isOpenClaim, isOverdue, remainingTotal } from './model.mjs';

const claim = { id: 'c1', status: 'partial', cancelled: false, party_name: 'Synthetic supplier', bill_number: 'B-001',
  description: 'Caliper surcharge', return_reference: 'R123', part_reference: 'PART-2', job_reference: 'JOB-8',
  expected_by: '2026-10-29', remaining: { gross_pence: '1000' }, receipts: [{ id: 'r1', active: true }] };

test('partial receipt stays open with the remaining server amount, cancelled and received amounts are excluded', () => {
  const claims = [claim, { ...claim, id: 'c2', status: 'received', remaining: { gross_pence: '0' } },
    { ...claim, id: 'c3', cancelled: true, remaining: { gross_pence: '50000' } }];
  assert.equal(remainingTotal(claims), '1000');
  assert.equal(filterClaims(claims, 'open').length, 1);
  assert.equal(claimStatus(claim).label, 'Partially received');
  assert.equal(claimStatus(claims[2]).label, 'Cancelled');
});

test('totals retain precision beyond Number.MAX_SAFE_INTEGER', () => {
  assert.equal(remainingTotal([{ ...claim, remaining: { gross_pence: '9007199254740993' } }, claim]), '9007199254741993');
});

test('overdue applies only to open claims with a past expected date', () => {
  assert.equal(isOverdue(claim, '2026-10-30'), true);
  assert.equal(isOverdue(claim, '2026-10-29'), false);
  assert.equal(isOverdue({ ...claim, expected_by: null }, '2026-10-30'), false);
  assert.equal(isOverdue({ ...claim, status: 'received' }, '2026-10-30'), false);
  assert.equal(isOverdue({ ...claim, cancelled: true }, '2026-10-30'), false);
  assert.equal(isOpenClaim({ ...claim, status: 'needs_review' }), true);
});

test('search finds invoice, return note, part and vehicle/job independently', () => {
  for (const query of ['b-001', ' r123 ', 'part-2', 'job-8', 'SUPPLIER', 'caliper']) {
    assert.equal(filterClaims([claim], 'all', query).length, 1);
  }
  assert.equal(filterClaims([claim], 'received', 'r123').length, 0);
  assert.equal(filterClaims([claim], 'open', 'different').length, 0);
});

test('active receipts prevent cancelling tracking; inactive history does not count as received', () => {
  assert.equal(hasReceivedCredit(claim), true);
  assert.equal(hasReceivedCredit({ ...claim, receipts: [{ active: false }] }), false);
  assert.equal(hasReceivedCredit({ ...claim, receipts: [] }), false);
});

test('confirmation controls require server capability and a posted, confirmable credit on an active claim', () => {
  const candidate = { status: 'posted', can_confirm: true };
  assert.equal(canConfirmCandidate(claim, candidate, true), true);
  assert.equal(canConfirmCandidate(claim, candidate, false), false);
  assert.equal(canConfirmCandidate(claim, { ...candidate, status: 'draft' }, true), false);
  assert.equal(canConfirmCandidate(claim, { ...candidate, can_confirm: false }, true), false);
  assert.equal(canConfirmCandidate({ ...claim, cancelled: true }, candidate, true), false);
});

test('cancel control is unavailable to a viewer, cancelled claim, or claim with any receipt history', () => {
  const unreceived = { ...claim, receipts: [] };
  assert.equal(canCancelClaim(unreceived, true), true);
  assert.equal(canCancelClaim(unreceived, false), false);
  assert.equal(canCancelClaim({ ...unreceived, cancelled: true }, true), false);
  assert.equal(canCancelClaim(claim, true), false);
  assert.equal(canCancelClaim({ ...claim, receipts: [{ active: false }] }, true), false);
});

test('selected line indices and decimal strings remain exact; no browser calculated money is submitted', () => {
  const body = buildClaimRequest({ id: 'bill', revision: 12 }, [
    { original_line_ref: 4, quantity: '0.000001', part_reference: ' PART-4 ', job_reference: ' JOB-8 ' },
    { original_line_ref: 1, quantity: '2.50', part_reference: '', job_reference: '' },
  ], { reason: ' Warranty ', return_reference: ' RN-123 ', returned_on: '', expected_by: '2026-11-05' });
  assert.deepEqual(body, { bill_id: 'bill', bill_revision: 12, reason: 'Warranty', return_reference: 'RN-123', returned_on: null,
    expected_by: '2026-11-05', lines: [{ original_line_ref: 4, quantity: '0.000001', part_reference: 'PART-4', job_reference: 'JOB-8' },
      { original_line_ref: 1, quantity: '2.50', part_reference: '', job_reference: '' }] });
  assert.equal(Object.hasOwn(body, 'expected'), false);
});

test('uncertain retry reuses its id; changed details or revision get a new id; success clears it', () => {
  let counter = 0;
  const book = createRequestBook(() => `request-${++counter}`);
  const payload = { credit_id: 'credit', credit_line_ref: 1 };
  const first = book.forRequest('receive', payload, 2);
  assert.equal(book.forRequest('receive', { ...payload }, 2).request_id, first.request_id);
  assert.notEqual(book.forRequest('receive', payload, 3).request_id, first.request_id);
  const changed = book.forRequest('receive', { ...payload, credit_line_ref: 2 }, 3);
  assert.notEqual(changed.request_id, first.request_id);
  assert.equal(book.forRequest('cancel', {}, 3).request_id, 'request-4');
  book.complete('receive');
  assert.notEqual(book.forRequest('receive', { ...payload, credit_line_ref: 2 }, 3).request_id, changed.request_id);
});

test('old company/refresh responses cannot replace a newer view and unmount invalidates pending results', () => {
  const gate = createRequestGate();
  const oldCompany = gate.begin();
  const newCompany = gate.begin();
  assert.equal(gate.isCurrent(oldCompany), false);
  assert.equal(gate.isCurrent(newCompany), true);
  const refresh = gate.begin();
  assert.equal(gate.isCurrent(newCompany), false);
  assert.equal(gate.isCurrent(refresh), true);
  gate.invalidate();
  assert.equal(gate.isCurrent(refresh), false);
});
