import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewRegularSingleLoanNoticeTiming as review, reviewPlan1NoticeTiming} from './plan1NoticeFixtures.mjs';

const base = {
  taxYear: '2026-27', payMinor: '300000', employmentId: 'synthetic-job',
  earningsBasis: 'class1_ni_earnings', activeEmployment: true, employeeStopRequest: false,
  otherInstructions: [], offPayroll: false, occupationalPensionOnly: false, deceased: false,
  protectedEarnings: false, concurrentLoan: false, correction: false,
};

function instructions(plan) {
  const common = { plan, employmentId: base.employmentId, availabilityEvidence: 'synthetic payroll cutoff' };
  return [
    { ...common, id: 'start', type: plan === 'postgraduate' ? 'PGL1' : 'SL1',
      effectiveDate: '2026-06-15', receivedDate: '2026-06-14', firstAvailablePayday: '2026-06-30' },
    { ...common, id: 'stop', type: plan === 'postgraduate' ? 'PGL2' : 'SL2',
      effectiveDate: '2026-08-31', receivedDate: '2026-09-01', firstAvailablePayday: '2026-09-30' },
  ];
}

for (const plan of ['plan_1','plan_2','plan_4','plan_5','postgraduate']) {
  test(plan + ' starts and stops on the supplied first available payday', () => {
    const context = { ...base, plan, frequency: 'monthly', notices: instructions(plan) };
    for (const [paymentDate, active, reason] of [
      ['2026-06-15',false,'BEFORE_FIRST_AVAILABLE_START'], ['2026-06-30',true,'START_APPLIES'],
      ['2026-08-31',true,'START_APPLIES'], ['2026-09-30',false,'STOP_APPLIES'],
    ]) assert.deepEqual(review({ ...context, paymentDate }), {qualified:false, notForPayroll:true, instructionActive:active, reason});
    assert.equal(review({ ...context, paymentDate:'2026-07-31', employeeStopRequest:true }).instructionActive, true);
  });
}

test('regular notice review rejects mixed notice families, ambiguous instructions and invalid availability', () => {
  for (const plan of ['postgraduate','plan_2']) {
    const context = { ...base, plan, frequency:'weekly', paymentDate:'2026-11-19', notices:instructions(plan) };
    for (const [index, wrong] of [[0, plan === 'postgraduate' ? 'SL1' : 'PGL1'], [1, plan === 'postgraduate' ? 'SL2' : 'PGL2']]) {
      const notices = structuredClone(context.notices);
      notices[index].type = wrong;
      assert.throws(() => review({ ...context, notices }), /NOTICE_INVALID_INSTRUCTION/);
    }
    for (const change of [{ frequency:'annual' }, { plan:'unknown' }, { concurrentLoan:true },
      { notices:[context.notices[1]] }, { notices:[{...context.notices[0],firstAvailablePayday:'2026-06-15'}] }]) {
      assert.throws(() => review({ ...context, ...change }), /NOTICE_/);
    }
    for (const frequency of ['weekly','fortnightly','four_weekly','monthly']) {
      assert.equal(review({ ...context, frequency, notices:[] }).reason, 'NO_START_INSTRUCTION');
    }
    assert.throws(() => reviewPlan1NoticeTiming(context), /NOTICE_UNSUPPORTED_CASE/);
  }
});
