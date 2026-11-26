import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewPairedLoanNoticeTiming as review} from './plan1NoticeFixtures.mjs';

const pack = JSON.parse(readFileSync(new URL('./fixtures/plan1-notice-start-stop-2026-27.json', import.meta.url)));
const base = {...pack.cases[0].input, concurrentLoan:true};
function notice(type, plan, day) {
  const previousDay = new Date(Date.parse(day) - 86400000).toISOString().slice(0,10);
  return {type, id:type, plan, employmentId:base.employmentId, effectiveDate:previousDay,
    receivedDate:previousDay, firstAvailablePayday:day, availabilityEvidence:'synthetic payroll calendar'};
}
for (const plan of ['plan_1','plan_2','plan_4','plan_5']) {
  for (const first of ['student','postgraduate']) test(plan + ' independent starts and stops, first ' + first, () => {
    const studentFirst = first === 'student';
    const days = ['2026-05-01','2026-05-29','2026-06-26','2026-07-24'];
    const notices = [notice('SL2',plan,days[studentFirst ? 2 : 3]), notice('PGL1','postgraduate',days[studentFirst ? 1 : 0]),
      notice('SL1',plan,days[studentFirst ? 0 : 1]), notice('PGL2','postgraduate',days[studentFirst ? 3 : 2])];
    for (const [index,paymentDate] of days.entries()) {
      const result = review({...base,plan,frequency:'four_weekly',paymentDate,notices});
      assert.deepEqual([result.student.instructionActive,result.postgraduate.instructionActive],
        [[studentFirst,!studentFirst],[true,true],[!studentFirst,studentFirst],[false,false]][index]);
      assert.equal(result.qualified,false);
      assert.equal(result.notForPayroll,true);
    }
  });
}
test('paired notices reject ambiguous or misdirected instructions', () => {
  const start = notice('SL1',base.plan,'2026-05-01');
  const pg = notice('PGL1','postgraduate','2026-05-01');
  for (const notices of [[start,{...pg,id:start.id}], [start,{...pg,type:'SL2'}], [{...start,plan:'unknown'}],
    [{...pg,employmentId:'other'}], [notice('PGL2','postgraduate','2026-05-29'),start]]) {
    assert.throws(() => review({...base,notices}), /NOTICE_/);
  }
  assert.throws(() => review({...base,notices:undefined}), /NOTICE_/);
  const simultaneous = review({...base,paymentDate:'2026-05-01',notices:[start,pg]});
  assert.ok(simultaneous.student.instructionActive && simultaneous.postgraduate.instructionActive);
  const empty = review({...base,notices:[]});
  assert.equal(empty.student.reason,'NO_START_INSTRUCTION');
  assert.equal(empty.postgraduate.reason,'NO_START_INSTRUCTION');
});
