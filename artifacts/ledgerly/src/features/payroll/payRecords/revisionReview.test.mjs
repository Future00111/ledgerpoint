import test from 'node:test';
import assert from 'node:assert/strict';
import {validatedReview,formatDraftPence} from './revisionReview.mjs';

const id = '13b008c3-f6fa-4973-a356-b6e4af7adbde';
const money = {gross:'101',net:'99',deductions:{paye:'1'},adjustments:{rounding:'-1'}};
const draft = {run_id:id,revision_id:id,revision_number:1,period_start:'2026-10-01',period_end:'2026-10-31',
  payday:'2026-10-30',currency:'GBP',rules_version:'synthetic',is_current_revision:true,current_revision_id:id,
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
