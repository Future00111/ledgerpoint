import test from 'node:test';
import assert from 'node:assert/strict';
import { protectedSingleLoanTrace } from '../../../../../../tools/payroll-specification/protectedMonthlyLoanPair.mjs';
import { loadPinnedEvidence, syntheticContext } from '../../../../../../tools/payroll-specification/studentLoans.mjs';

const context = { ...syntheticContext, protectedEarnings: true, protectedLevelMinor: '85000' };
test('protected single-loan reference preserves all 130 official ordinary deductions when headroom is sufficient', () => {
  const rows = loadPinnedEvidence().cases;
  assert.equal(rows.length, 130);
  for (const { input, expected } of rows) {
    const trace = protectedSingleLoanTrace({ ...context, ...input, netAttachableAfterOrderMinor: '999999' });
    assert.equal(trace.plan, input.plan);
    assert.equal(trace.ordinaryDeductionMinor, expected.deductionMinor);
    assert.equal(trace.deductionMinor, expected.deductionMinor);
    assert.equal(trace.qualified, false);
    assert.equal(trace.notForPayroll, true);
  }
});

test('monthly restriction caps each single loan independently at the available whole pounds', () => {
  for (const [plan, due] of [['plan_1','6800'],['plan_2','4900'],['plan_4','1600'],['plan_5','8200'],['postgraduate','7500']]) {
    const input = { ...context, frequency: 'monthly', plan, taxYear: '2026-27', payMinor: '300000' };
    for (const [net, available] of [['84999','0'],['85099','0'],['85100','100'],['90399','5300'],['90400','5400']]) {
      const trace = protectedSingleLoanTrace({ ...input, netAttachableAfterOrderMinor: net });
      assert.equal(trace.availableForLoansMinor, available);
      assert.equal(trace.ordinaryDeductionMinor, due);
      assert.equal(trace.deductionMinor, BigInt(due) < BigInt(available) ? due : available);
    }
  }
});

test('protected single-loan inputs must be complete even when the deduction would be zero', () => {
  const input = { ...context, frequency: 'weekly', plan: 'postgraduate', taxYear: '2026-27', payMinor: '0', netAttachableAfterOrderMinor: '0' };
  for (const key of Object.keys(input)) {
    const incomplete = { ...input };
    delete incomplete[key];
    assert.throws(() => protectedSingleLoanTrace(incomplete));
  }
  for (const change of [{ concurrentLoan: true }, { confirmedInstruction: false }, { correction: true },
    { frequency: 'annual' }, { plan: 'unknown' }, { netAttachableAfterOrderMinor: '-1' }, { protectedLevelMinor: '1.99' }]) {
    assert.throws(() => protectedSingleLoanTrace({ ...input, ...change }));
  }
});
