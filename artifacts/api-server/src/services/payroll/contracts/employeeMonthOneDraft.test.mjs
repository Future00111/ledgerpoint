import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculateApril999LDraft } from './employeeMonthOneDraft.mjs';

test('April draft reproduces every reviewed payslip amount from gross alone', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/employee-month-one-2026-27.json', import.meta.url)));
  const { grossMinor, payeMinor, employeeNiMinor, employerNiMinor, netMinor } = fixture;
  assert.deepEqual(calculateApril999LDraft(grossMinor), {
    grossMinor, payeMinor, employeeNiMinor, employerNiMinor, netMinor,
  });
});

test('draft calculates a second gross at the employee NI threshold', () => {
  assert.deepEqual(calculateApril999LDraft('104800'), {
    grossMinor: '104800', payeMinor: '4280', employeeNiMinor: '0',
    employerNiMinor: '9465', netMinor: '100520',
  });
});

test('draft rejects gross outside its supported range and precision', () => {
  for (const gross of ['104799', '390001', '250000.1', 250000, '0250000']) {
    assert.throws(() => calculateApril999LDraft(gross), RangeError);
  }
});

test('NI matches the six in-range category A monthly rows in the HMRC workbook', () => {
  const pack = JSON.parse(readFileSync(new URL('./fixtures/hmrc-ni-2026-27-v1.0.json', import.meta.url)));
  const rows = pack.cases.filter(({ input }) => input.category === 'A' && input.frequency === 'monthly'
    && BigInt(input.grossPayMinor) >= 104800n && BigInt(input.grossPayMinor) <= 390000n);
  assert.equal(rows.length, 6);
  for (const { input, expected, id } of rows) {
    const result = calculateApril999LDraft(input.grossPayMinor);
    assert.equal(result.employeeNiMinor, expected.employeeNiMinor, id);
    assert.equal(result.employerNiMinor, expected.employerNiMinor, id);
  }
});

test('one penny crosses the taxable pound boundary after month-one free pay', () => {
  assert.deepEqual(calculateApril999LDraft('250025'), {
    grossMinor: '250025', payeMinor: '33320', employeeNiMinor: '11618',
    employerNiMinor: '31249', netMinor: '205087',
  });
  assert.deepEqual(calculateApril999LDraft('250026'), {
    grossMinor: '250026', payeMinor: '33340', employeeNiMinor: '11618',
    employerNiMinor: '31249', netMinor: '205068',
  });
});
