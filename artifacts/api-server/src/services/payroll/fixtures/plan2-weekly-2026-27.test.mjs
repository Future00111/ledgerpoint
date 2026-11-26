import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const pack = read('./plan2-weekly-2026-27.json');
const reference = read('../contracts/fixtures/hmrc-student-loans-2026-27-v1.0.json');

function checkDeduction(payMinor, expectedMinor) {
  const excess = BigInt(payMinor) - BigInt(pack.weeklyThresholdMinor);
  const pounds = excess > 0n ? excess * BigInt(pack.percentage) / 10000n : 0n;
  assert.equal((pounds * 100n).toString(), expectedMinor, 'weekly pay in pence: ' + payMinor);
}

test('Plan 2 weekly reference arithmetic agrees with the six HMRC software examples', () => {
  assert.equal(pack.weeklyThresholdMinor, '56509');
  assert.equal(pack.percentage, 9);
  const rows = reference.cases.filter(row => row.input.taxYear === '2026-27' &&
    row.input.plan === 'plan_2' && row.input.frequency === 'weekly');
  assert.deepEqual(rows.map(row => row.sourceRow), pack.officialRows);
  for (const row of rows) {
    assert.equal(row.sourceSheet, pack.officialSheet);
    checkDeduction(row.input.payMinor, row.expected.deductionMinor);
  }
});

test('Plan 2 weekly boundary examples preserve whole-pound rounding at one-penny transitions', () => {
  assert.deepEqual(pack.boundaryCases.map(row => row.payMinor),
    ["0", "56508", "56509", "56510", "58731", "58732", "66508", "66509"]);
  for (const row of pack.boundaryCases) checkDeduction(row.payMinor, row.deductionMinor);
});
