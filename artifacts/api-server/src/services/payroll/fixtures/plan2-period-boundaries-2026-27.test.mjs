import test from 'node:test';
import assert from 'node:assert/strict';
import { specificationTrace, syntheticContext } from '../../../../../../tools/payroll-specification/studentLoans.mjs';

// Regular 2026–27 payments. Thresholds are £29,385 / periods per year,
// truncated to pence. Pay inputs below are fixed witnesses, independent of the trace.
// Each pair straddles the £2 or £9 deduction boundary by exactly one penny.
const periods = [
  { frequency: 'fortnightly', threshold: '113019', twoPounds: ['115241', '115242'], ninePounds: ['123018', '123019'] },
  { frequency: 'four_weekly', threshold: '226038', twoPounds: ['228260', '228261'], ninePounds: ['236037', '236038'] },
  { frequency: 'monthly', threshold: '244875', twoPounds: ['247097', '247098'], ninePounds: ['254874', '254875'] },
];

for (const { frequency, threshold, twoPounds, ninePounds } of periods) {
  test(`Plan 2 regular ${frequency} uses its own threshold at higher whole-pound boundaries`, () => {
    const checks = [[twoPounds[0], '100'], [twoPounds[1], '200'], [ninePounds[0], '800'], [ninePounds[1], '900']];
    for (const [payMinor, expected] of checks) {
      const trace = specificationTrace({ ...syntheticContext, taxYear: '2026-27', plan: 'plan_2', frequency, payMinor });
      assert.equal(trace.thresholdMinor, threshold);
      assert.equal(trace.deductionMinor, expected, `pay in pence: ${payMinor}`);
      assert.equal(trace.notForPayroll, true);
    }
  });
}
