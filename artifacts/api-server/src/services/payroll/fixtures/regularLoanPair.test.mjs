import assert from 'node:assert/strict';
import test from 'node:test';
import { monthlyPlan2PostgraduateTrace, regularPlan2PostgraduateTrace } from '../../../../../../tools/payroll-specification/studentLoans.mjs';

const context = {
  taxYear: '2026-27', paymentDate: '2026-11-19', earningsBasis: 'class1_ni_earnings',
  plan2Instruction: true, postgraduateInstruction: true,
  protectedEarnings: false, correction: false, offPayroll: false,
};

// Amounts in pence. Six examples straddle the first whole pound of Plan 2;
// the other examples compare £700/week equivalent paid at different intervals.
const cases = [
  ['weekly', '57620', '0', '1000', '1000'],
  ['weekly', '57621', '100', '1000', '1100'],
  ['weekly', '70000', '1200', '1700', '2900'],
  ['fortnightly', '114130', '0', '2000', '2000'],
  ['fortnightly', '114131', '100', '2000', '2100'],
  ['fortnightly', '140000', '2400', '3500', '5900'],
  ['four_weekly', '227149', '0', '3900', '3900'],
  ['four_weekly', '227150', '100', '3900', '4000'],
  ['four_weekly', '280000', '4800', '7100', '11900'],
];

test('regular loan pairs calculate separate deductions for the actual pay period', () => {
  for (const [frequency, payMinor, student, postgraduate, total] of cases) {
    const input = { ...context, frequency, payMinor };
    const trace = regularPlan2PostgraduateTrace(input);
    assert.deepEqual([trace.plan2.deductionMinor, trace.postgraduate.deductionMinor, trace.totalDeductionMinor],
      [student, postgraduate, total], frequency + ' ' + payMinor);
    assert.throws(() => monthlyPlan2PostgraduateTrace(input), /SPEC_PERIOD/);
  }
});

test('regular pair preserves monthly results and rejects unsupported contexts', () => {
  const monthly = { ...context, frequency: 'monthly', payMinor: '250400' };
  assert.deepEqual(regularPlan2PostgraduateTrace(monthly), monthlyPlan2PostgraduateTrace(monthly));
  for (const change of [{ frequency: 'annual' }, { frequency: 'irregular' }, { protectedEarnings: true },
    { plan2Instruction: false }, { postgraduateInstruction: false }, { correction: true }]) {
    assert.throws(() => regularPlan2PostgraduateTrace({ ...monthly, ...change }));
  }
});

test('monthly callers retain validation errors before frequency is checked', () => {
  assert.throws(() => monthlyPlan2PostgraduateTrace(null), /SPEC_INPUT_FIELDS/);
  assert.throws(() => monthlyPlan2PostgraduateTrace({}), /SPEC_PAIR_INSTRUCTIONS/);
});
