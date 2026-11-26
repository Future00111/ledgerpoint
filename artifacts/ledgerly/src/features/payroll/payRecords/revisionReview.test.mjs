import test from 'node:test';
import assert from 'node:assert/strict';
import {approvalAvailability,validatedReview,netPayEffects,formatDraftPence} from './revisionReview.mjs';

const id = '13b008c3-f6fa-4973-a356-b6e4af7adbde';
const money = {gross:'101',net:'99',deductions:{paye:'1'},adjustments:{rounding:'-1'}};
const draft = {run_id:id,revision_id:id,revision_number:1,period_start:'2026-10-01',period_end:'2026-10-31',
  payday:'2026-10-30',currency:'GBP',rules_version:'synthetic',prepared_by:'synthetic-preparer',prepared_at:'2026-10-30T10:00:00.000Z',is_current_revision:true,current_revision_id:id,
  review_breakdown:{lines:[{line_id:id,...money}],totals:{line_count:1,...money}}};
test('review accepts the requested draft and rejects mismatched IDs, private fields and malformed amounts',()=>{
  assert.equal(validatedReview(draft,id),draft);
  assert.throws(()=>validatedReview(draft,'13b008c3-f6fa-4973-a356-b6e4af7adbdf'));
  for (const change of [{employee_id:id},{gross:101},{net:'1.00'},{deductions:{taxpayer_id:'1'}}]) {
    const altered=structuredClone(draft);
    Object.assign(altered.review_breakdown.lines[0],change);
    assert.throws(()=>validatedReview(altered,id));
  }
});
test('signed pence render exactly above the safe integer limit and below one pound',()=>{
  assert.equal(formatDraftPence('9007199254740989'),'£90,071,992,547,409.89');
  assert.equal(formatDraftPence('-1'),'-£0.01');
});

test('review rejects duplicate lines and inconsistent line or revision totals',()=>{
  for (const mutate of [
    data => { data.lines.push(data.lines[0]); data.totals.line_count++; },
    data => { data.lines[0].net = '98'; },
    data => { data.totals.gross = '100'; },
    data => { data.totals.deductions.paye = '2'; },
  ]) {
    const altered=structuredClone(draft);
    mutate(altered.review_breakdown);
    assert.throws(()=>validatedReview(altered,id));
  }
});

test('review accepts priority orders and rejects a negative order even when the displayed net reconciles', () => {
  const row = structuredClone(draft);
  for (const target of [row.review_breakdown.lines[0],row.review_breakdown.totals]) {
    target.deductions.priority_order = '50';
    target.net = '49';
  }
  assert.equal(validatedReview(row,id),row);
  for (const target of [row.review_breakdown.lines[0],row.review_breakdown.totals]) {
    target.deductions.priority_order = '-50';
    target.net = '149';
  }
  assert.throws(() => validatedReview(row,id));
});

test('revision history validates first, middle and current links before displaying them', () => {
  const prior = '13b008c3-f6fa-4973-a356-b6e4af7adbd1';
  const next = '13b008c3-f6fa-4973-a356-b6e4af7adbd2';
  const middle = {...draft,revision_number:2,is_current_revision:false,current_revision_id:next,
    previous_revision_id:prior,next_revision_id:next};
  assert.equal(validatedReview(middle,id,true),middle);
  for (const change of [{previous_revision_id:null},{previous_revision_id:next},{next_revision_id:null},
    {next_revision_id:id},{next_revision_id:'invalid'},{revision_number:1}]) {
    assert.throws(()=>validatedReview({...middle,...change},id,true));
  }
  const only = {...draft,previous_revision_id:null,next_revision_id:null};
  assert.equal(validatedReview(only,id,true),only);
});

test('review requires a preparer and an exact UTC preparation time',()=>{
  for (const fields of [{prepared_by:' '},{prepared_at:null},{prepared_at:'2026-02-30T10:00:00.000Z'}]) {
    assert.throws(()=>validatedReview({...draft,...fields},id));
  }
});

test('approval availability distinguishes superseded, empty and unqualified drafts',()=>{
  assert.equal(approvalAvailability({...draft,is_current_revision:false}),'Approval unavailable for superseded revisions.');
  assert.equal(approvalAvailability({...draft,review_breakdown:{lines:[]}}),'Approval requires at least one employee line.');
  assert.equal(approvalAvailability(draft),'Approval unavailable until the payroll calculations are qualified.');
});


test('net effects include refunds, removed deductions and signed adjustments at penny precision', () => {
  const before = {deductions:{paye:'9007199254740993',student_loan:'100'},adjustments:{rounding:'-1'}};
  const after = {deductions:{paye:'-1',employee_ni:'50'},adjustments:{rounding:'-1',correction:'-2'}};
  assert.deepEqual(netPayEffects(before, after), [
    {label:'PAYE',pence:9007199254740994n}, {label:'Employee NI',pence:-50n},
    {label:'Student loan',pence:100n}, {label:'Correction',pence:-2n},
  ]);
  assert.deepEqual(netPayEffects(after, after), []);
});
