import test from 'node:test';
import assert from 'node:assert/strict';
import { protectedMonthlyLoanPairTrace } from '../../../../../../tools/payroll-specification/protectedMonthlyLoanPair.mjs';

const context = {
  taxYear: '2026-27', paymentDate: '2026-10-31', frequency: 'monthly',
  earningsBasis: 'class1_ni_earnings', payMinor: '250400',
  plan2Instruction: true, postgraduateInstruction: true,
  protectedEarnings: true, correction: false, offPayroll: false, protectedLevelMinor: '85000',
};

test('priority order protects the floor and allocates whole pounds to postgraduate first', () => {
  // At £2,504 Class 1 earnings the ordinary deductions are £45 postgraduate and £4 Plan 2.
  // Columns: net attachable after order, available, postgraduate, Plan 2, total (pence).
  for (const [net, available, postgraduate, plan2, total] of [
    ['84999','0','0','0','0'], ['85000','0','0','0','0'], ['85099','0','0','0','0'],
    ['85100','100','100','0','100'], ['89499','4400','4400','0','4400'],
    ['89500','4500','4500','0','4500'], ['89599','4500','4500','0','4500'],
    ['89600','4600','4500','100','4600'], ['89899','4800','4500','300','4800'],
    ['89900','4900','4500','400','4900'], ['99000','14000','4500','400','4900'],
  ]) {
    assert.deepEqual(protectedMonthlyLoanPairTrace({ ...context, netAttachableAfterOrderMinor: net }), {
      qualified: false, notForPayroll: true, availableForLoansMinor: available,
      postgraduateDeductionMinor: postgraduate, plan2DeductionMinor: plan2, totalDeductionMinor: total,
    }, net);
  }
});

test('zero headroom still requires valid attachment amounts, instructions and payroll context', () => {
  const input = { ...context, netAttachableAfterOrderMinor: '0' };
  for (const bad of [null, [], Object.create(input)]) {
    assert.throws(() => protectedMonthlyLoanPairTrace(bad), /SPEC_ATTACHMENT_CONTEXT/);
  }
  for (const field of ['netAttachableAfterOrderMinor','protectedLevelMinor']) {
    for (const value of [undefined, 0, '-1', '01', '0.00', '10000000000000000']) {
      assert.throws(() => protectedMonthlyLoanPairTrace({ ...input, [field]: value }), /SPEC_ATTACHMENT_AMOUNT/);
    }
  }
  for (const change of [{ protectedEarnings: false }, { postgraduateInstruction: false },
    { frequency: 'weekly' }, { correction: true }, { unexpected: true }]) {
    assert.throws(() => protectedMonthlyLoanPairTrace({ ...input, ...change }));
  }
});
