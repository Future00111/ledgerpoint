import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculateApril999LDraft, calculateAprilEmployeeDraft, calculateMayEmployeeDraft } from './employeeMonthOneDraft.mjs';

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
  for (const gross of ['-1', '00', '', '1000001', '250000.1', 250000, '0250000']) {
    assert.throws(() => calculateApril999LDraft(gross), RangeError);
  }
});

test('NI matches all in-range category A monthly rows in the HMRC workbook', () => {
  const pack = JSON.parse(readFileSync(new URL('./fixtures/hmrc-ni-2026-27-v1.0.json', import.meta.url)));
  const rows = pack.cases.filter(({ input }) => input.category === 'A' && input.frequency === 'monthly'
    && BigInt(input.grossPayMinor) >= 0n && BigInt(input.grossPayMinor) <= 1000000n);
  assert.equal(rows.length, 14);
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

test('zero pay and the first taxable pound with zero opening balances', () => {
  assert.deepEqual(calculateApril999LDraft('0'), {
    grossMinor: '0', payeMinor: '0', employeeNiMinor: '0', employerNiMinor: '0', netMinor: '0',
  });
  for (const [gross, paye, net] of [['83425', '0', '83425'], ['83426', '20', '83406']]) {
    const result = calculateApril999LDraft(gross);
    assert.equal(result.payeMinor, paye);
    assert.equal(result.employeeNiMinor, '0');
    assert.equal(result.netMinor, net);
  }
});

test('higher-rate PAYE selects the band before rounding taxable pay to pounds', () => {
  for (const [gross, paye] of [['397526', '62840'], ['397527', '62846'], ['397626', '62886']]) {
    assert.equal(calculateApril999LDraft(gross).payeMinor, paye);
  }
});

test('above the NI upper limit the employee pays 2% on the excess', () => {
  assert.deepEqual(calculateApril999LDraft('500000'), {
    grossMinor: '500000', payeMinor: '103806', employeeNiMinor: '26750',
    employerNiMinor: '68745', netMinor: '369444',
  });
  assert.equal(calculateApril999LDraft('1000000').grossMinor, '1000000');
});

test('1257L April payslip matches the pinned cumulative PAYE example', () => {
  const pack = JSON.parse(readFileSync(new URL('./fixtures/hmrc-paye-2026-27-v1.1.json', import.meta.url)));
  const row = pack.cases.find(item => item.id === 'hmrc-paye-2026-27-rest_of_uk-Gen_cumul-mthly-row-6');
  assert.equal(row.input.taxCode, '1257L');
  const result = calculateAprilEmployeeDraft(row.input.grossPayMinor, row.input.taxCode);
  assert.deepEqual(result, {
    grossMinor: '115625', payeMinor: row.expected.taxDueMinor, employeeNiMinor: '866',
    employerNiMinor: '11089', netMinor: '112619',
  });
});

test('1257L first taxable pound and explicit code selection', () => {
  assert.equal(calculateAprilEmployeeDraft('104925', '1257L').payeMinor, '0');
  assert.equal(calculateAprilEmployeeDraft('104926', '1257L').payeMinor, '20');
  for (const code of [undefined, 'S1257L', '1257L M1', 'BR']) {
    assert.throws(() => calculateAprilEmployeeDraft('115625', code), RangeError);
  }
});

test('May rolls forward the linked HMRC April example and calculates NI on May earnings', () => {
  const pack = JSON.parse(readFileSync(new URL('./fixtures/hmrc-paye-2026-27-v1.1.json', import.meta.url)));
  const may = pack.cases.find(item => item.id === 'hmrc-paye-2026-27-rest_of_uk-Gen_cumul-mthly-row-7');
  const april = pack.cases.find(item => item.id === may.previousExampleId);
  const result = calculateMayEmployeeDraft(april.input.grossPayMinor, may.input.grossPayMinor, may.input.taxCode);
  assert.deepEqual(result, { grossMinor: '115626', payeMinor: may.expected.taxDueMinor,
    employeeNiMinor: '866', employerNiMinor: '11089', netMinor: '112600' });
  assert.equal(BigInt(april.expected.taxDueMinor) + BigInt(result.payeMinor), BigInt(may.expected.taxDueToDateMinor));
});

test('lower May earnings refund April PAYE without refunding April NI', () => {
  assert.deepEqual(calculateMayEmployeeDraft('115625', '10000', '1257L'), {
    grossMinor: '10000', payeMinor: '-2140', employeeNiMinor: '0', employerNiMinor: '0', netMinor: '12140',
  });
  assert.throws(() => calculateMayEmployeeDraft('115625', '0', '1257L'), RangeError);
});

test('May uses the cumulative two-month higher-rate threshold', () => {
  assert.equal(calculateMayEmployeeDraft('250000', '545052', '999L').payeMinor, '92360');
  assert.equal(calculateMayEmployeeDraft('250000', '545053', '999L').payeMinor, '92373');
});
