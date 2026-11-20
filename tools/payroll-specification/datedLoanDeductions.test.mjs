import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewDatedLoanDeductions as review} from './datedLoanDeductions.mjs';

const base = {taxYear:'2026-27', frequency:'monthly', plan:'plan_2', employmentId:'synthetic-job',
  payMinor:'400000', earningsBasis:'class1_ni_earnings', activeEmployment:true, employeeStopRequest:false,
  otherInstructions:[], occupationalPensionOnly:false, deceased:false, protectedEarnings:false,
  concurrentLoan:true, correction:false, offPayroll:false};
function notice(type, date, payday) {
  return {id:type, type, plan:type.startsWith('SL') ? base.plan : 'postgraduate', employmentId:base.employmentId,
    receivedDate:date, effectiveDate:date, firstAvailablePayday:payday, availabilityEvidence:'synthetic month-end payroll'};
}

for (const studentFirst of [true,false]) test('dated deductions across monthly paydays, student first = ' + studentFirst, () => {
  const notices = [notice(studentFirst?'SL1':'PGL1','2026-05-04','2026-05-29'),
    notice(studentFirst?'PGL1':'SL1','2026-06-04','2026-06-30'),
    notice(studentFirst?'SL2':'PGL2','2026-07-06','2026-07-31'),
    notice(studentFirst?'PGL2':'SL2','2026-08-04','2026-08-28')];
  // At £4,000 monthly, Plan 2 recovers £139 and the postgraduate loan £135.
  for (const [paymentDate, student, postgraduate, total] of [
    ['2026-04-30','0','0','0'], ['2026-05-29',studentFirst?'13900':'0',studentFirst?'0':'13500',studentFirst?'13900':'13500'],
    ['2026-06-30','13900','13500','27400'], ['2026-07-31',studentFirst?'0':'13900',studentFirst?'13500':'0',studentFirst?'13500':'13900'],
    ['2026-08-28','0','0','0']]) {
    const result = review({...base, paymentDate, notices});
    assert.deepEqual([result.studentMinor,result.postgraduateMinor,result.totalDeductionMinor], [student,postgraduate,total]);
    assert.equal(result.notForPayroll,true);
    assert.equal(result.qualified,false);
  }
});
test('an active instruction below threshold has zero deduction and retains its active status', () => {
  const input = {...base, payMinor:'100000', paymentDate:'2026-05-29', notices:[notice('SL1','2026-05-04','2026-05-29')]};
  const result = review(input);
  assert.equal(result.timing.student.instructionActive,true);
  assert.equal(result.totalDeductionMinor,'0');
  assert.throws(() => review({...input, protectedEarnings:true}), /NOTICE_EXCLUDED_CONTEXT/);
});
