import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculateMonthlyEmployeeDraft, calculateRegularEmployeeLoanPayslipDraft } from './employeeMonthOneDraft.mjs';

const monthly = { grossHistory: ['400000'], taxCodes: 'BR', frequency: 'monthly' };
const base = calculateMonthlyEmployeeDraft(monthly.grossHistory, monthly.taxCodes);
for (const [plan, student] of [['plan_1', 15800], ['plan_2', 13900], ['plan_4', 10600], ['plan_5', 17200], [null, 0]]) {
  for (const postgraduate of [false, true]) {
    test('monthly payslip with student plan ' + plan + ' and postgraduate ' + postgraduate, () => {
      const postgrad = postgraduate ? 13500 : 0;
      assert.deepEqual(calculateRegularEmployeeLoanPayslipDraft({ ...monthly, studentPlan: plan, postgraduate }), {
        ...base, studentLoanMinor: String(student), postgraduateLoanMinor: String(postgrad),
        netMinor: String(Number(base.netMinor) - student - postgrad),
      });
    });
  }
}

test('employee payslips reproduce all 130 pinned HMRC deductions across the four regular frequencies', () => {
  const workbook = JSON.parse(readFileSync(new URL('./fixtures/hmrc-student-loans-2026-27-v1.0.json', import.meta.url)));
  assert.equal(workbook.cases.length, 130);
  for (const { input, expected, id } of workbook.cases) {
    const postgraduate = input.plan === 'postgraduate';
    const result = calculateRegularEmployeeLoanPayslipDraft({ grossHistory: [input.payMinor], taxCodes: 'NT',
      frequency: input.frequency, studentPlan: postgraduate ? null : input.plan, postgraduate });
    assert.equal(postgraduate ? result.postgraduateLoanMinor : result.studentLoanMinor, expected.deductionMinor, id);
    assert.equal(BigInt(result.netMinor), BigInt(input.payMinor) - BigInt(result.employeeNiMinor) - BigInt(expected.deductionMinor), id);
  }
});

test('loan deductions use current pay and require an explicit plan and postgraduate status', () => {
  const input = { ...monthly, studentPlan: 'plan_2', postgraduate: true };
  const slip = calculateRegularEmployeeLoanPayslipDraft({ ...input, grossHistory: ['400000', '100000'] });
  assert.equal(slip.studentLoanMinor, '0');
  assert.equal(slip.postgraduateLoanMinor, '0');
  for (const invalid of [{ studentPlan: undefined }, { studentPlan: ['plan_1', 'plan_2'] },
    { postgraduate: undefined }, { postgraduate: 'false' }, { frequency: 'annual' }, { protectedEarnings: true }, { correction: true }]) {
    assert.throws(() => calculateRegularEmployeeLoanPayslipDraft({ ...input, ...invalid }), RangeError);
  }
});
