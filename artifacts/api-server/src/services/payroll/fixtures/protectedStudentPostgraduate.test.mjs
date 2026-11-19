import test from 'node:test';
import assert from 'node:assert/strict';
import { protectedRegularStudentPostgraduateTrace, protectedRegularLoanPairTrace } from '../../../../../../tools/payroll-specification/protectedMonthlyLoanPair.mjs';

const base = {
  taxYear: '2026-27', paymentDate: '2026-11-19', earningsBasis: 'class1_ni_earnings',
  postgraduateInstruction: true, correction: false, offPayroll: false,
  protectedEarnings: true, protectedLevelMinor: '50000',
};

// £3,000 monthly. The ordinary postgraduate amount is £75.
// At £605.99 post-order net pay, £105 is available, leaving at most £30 for the student loan.
test('protected monthly pairs allocate the available amount to the selected student plan after postgraduate', () => {
  for (const [plan, ordinary, capped] of [
    ['plan_1', '6800', '3000'], ['plan_2', '4900', '3000'],
    ['plan_4', '1600', '1600'], ['plan_5', '8200', '3000'],
  ]) {
    for (const [net, pg, student] of [
      ['49999', '0', '0'], ['57499', '7400', '0'], ['60599', '7500', capped], ['80000', '7500', ordinary],
    ]) {
      const result = protectedRegularStudentPostgraduateTrace({ ...base, payMinor: '300000',
        frequency: 'monthly', confirmedStudentPlan: plan, netAttachableAfterOrderMinor: net });
      assert.equal(result.studentPlan, plan);
      assert.equal(result.studentDeductionMinor, student);
      assert.equal(result.postgraduateDeductionMinor, pg);
      assert.equal(result.totalDeductionMinor, (BigInt(pg) + BigInt(student)).toString());
      assert.equal(result.notForPayroll, true);
      assert.equal(result.qualified, false);
    }
  }
});

test('protected Plan 2 pairs retain identical amounts across all regular periods', () => {
  for (const frequency of ['weekly','fortnightly','four_weekly','monthly']) {
    const period = { ...base, frequency, payMinor: '300000', netAttachableAfterOrderMinor: '60599' };
    const legacy = protectedRegularLoanPairTrace({ ...period, plan2Instruction: true });
    const result = protectedRegularStudentPostgraduateTrace({ ...period, confirmedStudentPlan: 'plan_2' });
    assert.equal(result.studentDeductionMinor, legacy.plan2DeductionMinor);
    assert.equal(result.postgraduateDeductionMinor, legacy.postgraduateDeductionMinor);
    assert.equal(result.availableForLoansMinor, legacy.availableForLoansMinor);
    assert.equal(result.totalDeductionMinor, legacy.totalDeductionMinor);
  }
});

test('zero headroom still requires one valid student plan and the attachment facts', () => {
  const context = { ...base, frequency: 'weekly', payMinor: '0', netAttachableAfterOrderMinor: '0', confirmedStudentPlan: 'plan_1' };
  for (const change of [{ confirmedStudentPlan: ['plan_1','plan_5'] }, { confirmedStudentPlan: 'postgraduate' },
    { postgraduateInstruction: false }, { protectedLevelMinor: '-1' }, { protectedEarnings: false }, { frequency: 'annual' }]) {
    assert.throws(() => protectedRegularStudentPostgraduateTrace({ ...context, ...change }));
  }
});
