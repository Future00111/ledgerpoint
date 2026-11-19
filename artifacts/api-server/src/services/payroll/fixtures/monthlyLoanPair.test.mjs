import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { monthlyPlan2PostgraduateTrace } from '../../../../../../tools/payroll-specification/studentLoans.mjs';

const fixtures = JSON.parse(readFileSync(new URL('./plan2-postgraduate-monthly-2026-27.json', import.meta.url)));
const context = {
  taxYear: '2026-27', paymentDate: '2026-10-31', frequency: 'monthly',
  earningsBasis: 'class1_ni_earnings', payMinor: '0',
  plan2Instruction: true, postgraduateInstruction: true,
  protectedEarnings: false, correction: false, offPayroll: false,
};

test('paired reference calculation matches every independently reviewed component and total', () => {
  for (const row of fixtures.cases) {
    const trace = monthlyPlan2PostgraduateTrace({ ...context, payMinor: row.earningsMinor });
    assert.equal(trace.plan2.deductionMinor, row.plan2Minor);
    assert.equal(trace.postgraduate.deductionMinor, row.postgraduateMinor);
    assert.equal(trace.totalDeductionMinor, row.totalMinor);
    assert.equal(trace.qualified, false);
    assert.equal(trace.notForPayroll, true);
  }
});

test('even zero earnings require both instructions and every supported-context field', () => {
  for (const key of Object.keys(context)) {
    const incomplete = { ...context };
    delete incomplete[key];
    assert.throws(() => monthlyPlan2PostgraduateTrace(incomplete));
  }
  for (const change of [
    { plan2Instruction: false }, { postgraduateInstruction: 'true' }, { protectedEarnings: true },
    { correction: true }, { offPayroll: true }, { frequency: 'weekly' }, { taxYear: '2027-28' },
    { paymentDate: '2027-04-06' }, { earningsBasis: 'gross' }, { payMinor: '-1' },
    { plan: 'plan_1' }, { concurrentLoan: false }, { confirmedInstruction: true }, { extra: true },
  ]) assert.throws(() => monthlyPlan2PostgraduateTrace({ ...context, ...change }));
});
