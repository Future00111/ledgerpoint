import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { specificationTrace, syntheticContext } from '../../../../../../tools/payroll-specification/studentLoans.mjs';

const pack = JSON.parse(readFileSync(new URL('./plan2-postgraduate-monthly-2026-27.json', import.meta.url)));
const input = { ...syntheticContext, taxYear: pack.taxYear, frequency: 'monthly' };

test('monthly reference pairs use the same earnings and round each loan independently', () => {
  assert.deepEqual(pack.cases.map(row => row.earningsMinor),
    ['175000', '176666', '176667', '244875', '245986', '245987', '250400']);
  for (const { earningsMinor: payMinor, plan2Minor, postgraduateMinor, totalMinor } of pack.cases) {
    const student = specificationTrace({ ...input, payMinor, plan: 'plan_2' });
    const postgraduate = specificationTrace({ ...input, payMinor, plan: 'postgraduate' });
    assert.equal(student.deductionMinor, plan2Minor, payMinor);
    assert.equal(postgraduate.deductionMinor, postgraduateMinor, payMinor);
    assert.equal((BigInt(student.deductionMinor) + BigInt(postgraduate.deductionMinor)).toString(), totalMinor, payMinor);
  }
});

test('the single-loan specification still rejects a concurrent instruction, including when earnings are below threshold', () => {
  for (const payMinor of ['175000', '250400']) {
    for (const plan of ['plan_2', 'postgraduate']) {
      assert.throws(() => specificationTrace({ ...input, payMinor, plan, concurrentLoan: true }), /SPEC_EXCLUDED_CONTEXT/);
    }
  }
});
