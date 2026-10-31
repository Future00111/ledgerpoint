import test from 'node:test';
import assert from 'node:assert/strict';
import { creditQueue, queueSummary, reviewableCandidates, followUpPresentation } from './queuePresentation.mjs';

const candidate = { credit_id: 'credit', credit_line_ref: 1, status: 'posted', can_confirm: true };
const claim = { id: 'one', status: 'partial', cancelled: false, party_name: 'Synthetic Parts', bill_number: 'BILL-123', description: 'Caliper',
  part_reference: 'PART-42', return_reference: 'RETURN-11', job_reference: 'VAN-01', expected_by: '2026-10-29', remaining: { gross_pence: '500' }, candidates: [candidate] };

test('ready-to-review is based on posted confirmable candidates, not drafts or arbitrary flags', () => {
  const cases = [claim, { ...claim, id: 'draft', candidates: [{ ...candidate, status: 'draft' }] },
    { ...claim, id: 'blocked', candidates: [{ ...candidate, can_confirm: false }] }, { ...claim, id: 'cancelled', cancelled: true }];
  assert.deepEqual(creditQueue(cases, 'matches', '', '2026-10-30').map(row => row.id), ['one']);
  assert.equal(reviewableCandidates({ ...claim, candidates: undefined }).length, 0);
});

test('overdue and ready filters retain multi-field search and original source identities', () => {
  const rows = [claim, { ...claim, id: 'tomorrow', expected_by: '2026-10-31', part_reference: 'PART-52' }];
  assert.equal(creditQueue(rows, 'matches', ' part-42 ', '2026-10-30')[0], claim);
  assert.deepEqual(creditQueue(rows, 'overdue', 'RETURN-11', '2026-10-30'), [claim]);
  assert.deepEqual(creditQueue(rows, 'matches', 'missing', '2026-10-30'), []);
});

test('existing lifecycle filters retain cancelled, received and partial claim distinctions', () => {
  const rows = [claim, { ...claim, id: 'received', status: 'received' }, { ...claim, id: 'cancelled', cancelled: true }, { ...claim, id: 'review', status: 'needs_review' }];
  assert.deepEqual(creditQueue(rows, 'open', '', '2026-10-30').map(row => row.id), ['review', 'one']);
  assert.deepEqual(creditQueue(rows, 'received', '', '2026-10-30').map(row => row.id), ['received']);
  assert.deepEqual(creditQueue(rows, 'cancelled', '', '2026-10-30').map(row => row.id), ['cancelled']);
  assert.deepEqual(creditQueue(rows, 'needs_review', '', '2026-10-30').map(row => row.id), ['review']);
  assert.equal(creditQueue(rows, 'all', '', '2026-10-30').length, 4);
});

test('summary aggregates server minor units exactly and never substitutes missing amounts with zero', () => {
  const result = queueSummary([claim, { ...claim, id: 'large', remaining: { gross_pence: '9007199254740993' } }], '2026-10-30');
  assert.deepEqual(result, { remaining: '9007199254741493', waiting: 2, matches: 2, overdue: 2 });
  assert.equal(queueSummary([claim, { ...claim, remaining: undefined }], '2026-10-30').remaining, undefined);
  assert.equal(queueSummary([claim, { ...claim, remaining: { gross_pence: 500 } }], '2026-10-30').remaining, undefined);
  assert.deepEqual(queueSummary([], '2026-10-30'), { remaining: '0', waiting: 0, matches: 0, overdue: 0 });
});


test('follow-up priorities and UTC calendar ages preserve evidence and never infer sending', () => {
  const date = '2026-03-01';
  const base = { ...claim, candidates: [], expected_by: '2026-02-27', returned_on: '2026-02-28' };
  assert.deepEqual(followUpPresentation(base, date), { rank: 2, priority: 'Follow up', next: '2 days past expected date — contact the supplier', ageDays: 1, ageLabel: '1 day since return' });
  assert.equal(followUpPresentation({ ...base, status: 'needs_review' }, date).rank, 0);
  assert.equal(followUpPresentation({ ...base, candidates: [candidate] }, date).rank, 1);
  assert.equal(followUpPresentation({ ...base, expected_by: null }, date).next, 'No expected date recorded — check with the supplier');
  for (const returned_on of ['2026-02-30', '2026-03-02', 'invalid']) assert.equal(followUpPresentation({ ...base, returned_on }, date).ageDays, null);
  assert.equal(followUpPresentation({ ...base, returned_on: null, created_at: '2026-02-28T23:59:59Z' }, date).ageLabel, '1 day since tracking began');
  for (const closed of [{ cancelled: true }, { status: 'received' }]) assert.equal(followUpPresentation({ ...base, ...closed }, date).next, 'No follow-up needed');
  const rows = Object.freeze([Object.freeze({ ...base, id: 'young' }), Object.freeze({ ...base, id: 'old', returned_on: '2026-02-01' }), Object.freeze({ ...base, id: 'review', status: 'needs_review' })]);
  assert.deepEqual(creditQueue(rows, 'open', '', date).map(row => row.id), ['review', 'old', 'young']);
  assert.equal(rows[0].id, 'young');
});
