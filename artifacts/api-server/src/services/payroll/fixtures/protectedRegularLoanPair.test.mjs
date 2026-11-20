import test from 'node:test';
import assert from 'node:assert/strict';
import { protectedMonthlyLoanPairTrace, protectedRegularLoanPairTrace } from '../../../../../../tools/payroll-specification/protectedMonthlyLoanPair.mjs';

const context = {
  taxYear: '2026-27', paymentDate: '2026-11-19', earningsBasis: 'class1_ni_earnings',
  plan2Instruction: true, postgraduateInstruction: true, protectedEarnings: true,
  correction: false, offPayroll: false, protectedLevelMinor: '50000',
};

// Each row gives post-order net pay, then the expected postgraduate and Plan 2 deductions, in pence.
const examples = [
  ['weekly', '70000', [['49999','0','0'], ['51699','1600','0'], ['51800','1700','100'], ['53500','1700','1200']]],
  ['fortnightly', '140000', [['50099','0','0'], ['53499','3400','0'], ['53600','3500','100'], ['56500','3500','2400']]],
  ['four_weekly', '280000', [['50000','0','0'], ['57099','7000','0'], ['57200','7100','100'], ['62500','7100','4800']]],
];

for (const [frequency, payMinor, rows] of examples) {
  test('protected paired deductions use the ' + frequency + ' period and priority order', () => {
    for (const [netAttachableAfterOrderMinor, postgraduate, plan2] of rows) {
      const input = { ...context, frequency, payMinor, netAttachableAfterOrderMinor };
      const result = protectedRegularLoanPairTrace(input);
      assert.equal(result.postgraduateDeductionMinor, postgraduate);
      assert.equal(result.plan2DeductionMinor, plan2);
      assert.equal(result.totalDeductionMinor, (BigInt(postgraduate) + BigInt(plan2)).toString());
      assert.equal(result.notForPayroll, true);
      assert.equal(result.qualified, false);
      assert.throws(() => protectedMonthlyLoanPairTrace(input), /SPEC_PERIOD/);
    }
  });
}

test('regular protected entry preserves monthly results and checks inputs even below the floor', () => {
  const input = { ...context, frequency: 'monthly', payMinor: '250400', netAttachableAfterOrderMinor: '54600' };
  assert.deepEqual(protectedRegularLoanPairTrace(input), protectedMonthlyLoanPairTrace(input));
  for (const change of [{ frequency: 'irregular' }, { protectedLevelMinor: '-1' }, { protectedEarnings: false },
    { correction: true }, { postgraduateInstruction: false }]) {
    assert.throws(() => protectedRegularLoanPairTrace({ ...input, netAttachableAfterOrderMinor: '0', ...change }));
  }
});
