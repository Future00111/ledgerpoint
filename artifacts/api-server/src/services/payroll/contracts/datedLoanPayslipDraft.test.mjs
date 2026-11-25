import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDatedLoanPayslipDraft } from './datedLoanPayslipDraft.mjs';
import { calculateMonthlyEmployeeDraft } from './employeeMonthOneDraft.mjs';

const context = { taxYear: '2026-27', frequency: 'monthly', employmentId: 'synthetic-job', payMinor: '400000',
  earningsBasis: 'class1_ni_earnings', activeEmployment: true, employeeStopRequest: false, otherInstructions: [],
  occupationalPensionOnly: false, deceased: false, protectedEarnings: false, concurrentLoan: false, correction: false, offPayroll: false };
const notice = (plan, type, date, payday) => ({ plan, type, employmentId: context.employmentId, id: type,
  receivedDate: date, effectiveDate: date, firstAvailablePayday: payday, availabilityEvidence: 'Synthetic payroll cutoff' });

for (const [plan, deduction] of [['plan_1', 15800], ['plan_2', 13900], ['plan_4', 10600], ['plan_5', 17200], ['postgraduate', 13500]]) {
  const prefix = plan === 'postgraduate' ? 'PGL' : 'SL';
  const start = notice(plan, prefix + '1', '2026-05-14', '2026-05-29');
  const stop = notice(plan, prefix + '2', '2026-07-14', '2026-07-31');
  function check(paymentDate, months, notices, active, reason) {
    const grossHistory = Array(months).fill(context.payMinor);
    const base = calculateMonthlyEmployeeDraft(grossHistory, '1257L');
    const { payslip, timing } = calculateDatedLoanPayslipDraft({ grossHistory, taxCodes: '1257L',
      noticeContext: { ...context, plan, paymentDate, notices, employeeStopRequest: true } });
    const due = active ? deduction : 0;
    assert.deepEqual(timing, { qualified: false, notForPayroll: true, instructionActive: active, reason });
    assert.deepEqual(payslip, { ...base, studentLoanMinor: String(plan === 'postgraduate' ? 0 : due),
      postgraduateLoanMinor: String(plan === 'postgraduate' ? due : 0), netMinor: String(BigInt(base.netMinor) - BigInt(due)) });
  }
  test(plan + ' start notice activates the deduction on its first available payday', () => {
    check('2026-04-30', 1, [start], false, 'BEFORE_FIRST_AVAILABLE_START');
    check('2026-05-29', 2, [start], true, 'START_APPLIES');
    check('2026-06-30', 3, [start], true, 'START_APPLIES');
  });
  test(plan + ' stop notice restores take-home pay from its first available payday', () => {
    check('2026-06-30', 3, [start, stop], true, 'START_APPLIES');
    check('2026-07-31', 4, [start, stop], false, 'STOP_APPLIES');
    check('2026-08-31', 5, [start, stop], false, 'STOP_APPLIES');
  });
}

test('notice review is tied to the same payday period and earnings across all four frequencies', () => {
  for (const [frequency, date] of [['weekly','2026-04-13'], ['fortnightly','2026-04-20'],
    ['four_weekly','2026-05-04'], ['monthly','2026-05-06']]) {
    const noticeContext = { ...context, frequency, plan: 'plan_1', notices: [], paymentDate: date };
    const input = { grossHistory: ['100000', context.payMinor], taxCodes: 'BR', noticeContext };
    assert.equal(calculateDatedLoanPayslipDraft(input).payslip.studentLoanMinor, '0');
    assert.throws(() => calculateDatedLoanPayslipDraft({ ...input, grossHistory: [context.payMinor] }), RangeError);
    assert.throws(() => calculateDatedLoanPayslipDraft({ ...input, grossHistory: ['100000', '400001'] }), RangeError);
  }
});

const paydays = ['2026-04-30', '2026-05-29', '2026-06-30', '2026-07-31', '2026-08-28'];
function pairedNotice(plan, type, month) {
  return notice(type.startsWith('SL') ? plan : 'postgraduate', type,
    paydays[month].slice(0, 8) + '10', paydays[month]);
}

function checkPair(plan, notices, amounts) {
  for (const [month, [student, postgraduate]] of amounts.entries()) {
    const grossHistory = Array(month + 1).fill(context.payMinor);
    const base = calculateMonthlyEmployeeDraft(grossHistory, '1257L');
    const { payslip, timing } = calculateDatedLoanPayslipDraft({ grossHistory, taxCodes: '1257L',
      noticeContext: { ...context, concurrentLoan: true, plan, notices, paymentDate: paydays[month] } });
    assert.equal(timing.student.instructionActive, student > 0);
    assert.equal(timing.postgraduate.instructionActive, postgraduate > 0);
    assert.deepEqual(payslip, { ...base, studentLoanMinor: String(student), postgraduateLoanMinor: String(postgraduate),
      netMinor: String(BigInt(base.netMinor) - BigInt(student + postgraduate)) });
  }
}

for (const [plan, amount] of [['plan_1', 15800], ['plan_2', 13900], ['plan_4', 10600], ['plan_5', 17200]]) {
  test(plan + ' starts and stops before the postgraduate loan', () => {
    const notices = ['SL1','PGL1','SL2','PGL2'].map((type, i) => pairedNotice(plan, type, i + 1));
    checkPair(plan, notices, [[0,0],[amount,0],[amount,13500],[0,13500],[0,0]]);
  });
  test(plan + ' starts and stops after the postgraduate loan', () => {
    const notices = ['PGL1','SL1','PGL2','SL2'].map((type, i) => pairedNotice(plan, type, i + 1));
    checkPair(plan, notices, [[0,0],[0,13500],[amount,13500],[amount,0],[0,0]]);
  });
}

test('both instructions start on the same payday', () => {
  checkPair('plan_2', [pairedNotice('plan_2','PGL1',1), pairedNotice('plan_2','SL1',1)],
    [[0,0],[13900,13500],[13900,13500]]);
});
test('both instructions stop on the same payday after separate starts', () => {
  const notices = [pairedNotice('plan_2','SL1',0), pairedNotice('plan_2','PGL1',1),
    pairedNotice('plan_2','SL2',2), pairedNotice('plan_2','PGL2',2)];
  checkPair('plan_2', notices, [[13900,0],[13900,13500],[0,0],[0,0]]);
});
