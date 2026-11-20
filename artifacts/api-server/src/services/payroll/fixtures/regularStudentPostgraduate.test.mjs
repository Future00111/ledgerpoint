import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPinnedEvidence, regularStudentPostgraduateTrace, regularPlan2PostgraduateTrace } from '../../../../../../tools/payroll-specification/studentLoans.mjs';

const context = {
  taxYear: '2026-27', paymentDate: '2026-11-19', earningsBasis: 'class1_ni_earnings',
  postgraduateInstruction: true, protectedEarnings: false, correction: false, offPayroll: false,
};

test('paired student components reproduce 104 pinned examples across the four regular pay periods', () => {
  const rows = loadPinnedEvidence().cases.filter(row => row.input.plan !== 'postgraduate');
  assert.equal(rows.length, 104);
  for (const { input, expected } of rows) {
    const trace = regularStudentPostgraduateTrace({ ...context, frequency: input.frequency,
      payMinor: input.payMinor, confirmedStudentPlan: input.plan });
    assert.equal(trace.studentPlan, input.plan);
    assert.equal(trace.student.deductionMinor, expected.deductionMinor);
  }
});

test('each confirmed student plan combines with the same monthly postgraduate deduction', () => {
  const month = { ...context, frequency: 'monthly', payMinor: '300000' };
  // At £3,000 monthly the postgraduate deduction is £75 in each scenario.
  for (const [plan, student, total] of [
    ['plan_1','6800','14300'], ['plan_2','4900','12400'],
    ['plan_4','1600','9100'], ['plan_5','8200','15700'],
  ]) {
    const trace = regularStudentPostgraduateTrace({ ...month, confirmedStudentPlan: plan });
    assert.deepEqual([trace.student.deductionMinor, trace.postgraduate.deductionMinor,
      trace.totalDeductionMinor, trace.qualified, trace.notForPayroll], [student, '7500', total, false, true]);
    if (plan === 'plan_2') {
      const legacy = regularPlan2PostgraduateTrace({ ...month, plan2Instruction: true });
      assert.deepEqual(trace.student, legacy.plan2);
      assert.deepEqual(trace.postgraduate, legacy.postgraduate);
      assert.equal(trace.totalDeductionMinor, legacy.totalDeductionMinor);
    }
  }
});

test('paired calculation requires one confirmed student plan and rejects unsupported contexts even for zero pay', () => {
  const input = { ...context, frequency: 'weekly', payMinor: '0', confirmedStudentPlan: 'plan_4' };
  for (const change of [{ confirmedStudentPlan: undefined }, { confirmedStudentPlan: ['plan_1','plan_4'] },
    { confirmedStudentPlan: 'postgraduate' }, { confirmedStudentPlan: 'unknown' }, { postgraduateInstruction: false },
    { protectedEarnings: true }, { offPayroll: true }, { correction: true }, { frequency: 'annual' },
    { plan: 'plan_2' }, { plan2Instruction: true }, { concurrentLoan: false }, { confirmedInstruction: true }]) {
    assert.throws(() => regularStudentPostgraduateTrace({ ...input, ...change }));
  }
});
