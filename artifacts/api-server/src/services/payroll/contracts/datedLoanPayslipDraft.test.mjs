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
