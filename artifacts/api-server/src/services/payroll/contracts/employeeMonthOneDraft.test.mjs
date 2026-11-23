import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculateApril999LDraft, calculateAprilEmployeeDraft, calculateMayEmployeeDraft, calculateMonthlyEmployeeDraft } from './employeeMonthOneDraft.mjs';

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
  for (const gross of ['-1', '00', '', '6000001', '250000.1', 250000, '0250000']) {
    assert.throws(() => calculateApril999LDraft(gross), RangeError);
  }
});

test('NI matches all in-range category A monthly rows in the HMRC workbook', () => {
  const pack = JSON.parse(readFileSync(new URL('./fixtures/hmrc-ni-2026-27-v1.0.json', import.meta.url)));
  const rows = pack.cases.filter(({ input }) => input.category === 'A' && input.frequency === 'monthly'
    && BigInt(input.grossPayMinor) >= 0n && BigInt(input.grossPayMinor) <= 6000000n);
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
  for (const code of [undefined, 'S1257L', '1257L M1', 'BR M1']) {
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

test('twelve ordinary payments reconcile to year-end tax using the annual bands', () => {
  for (const [code, expectedTax] of [['1257L', 1142800n], ['999L', 1246000n]]) {
    const history = [];
    let total = 0n;
    for (let month = 1; month <= 12; month++) {
      history.push('500000');
      const result = calculateMonthlyEmployeeDraft(history, code);
      total += BigInt(result.payeMinor);
      assert.equal(result.employeeNiMinor, '26750');
      assert.equal(result.employerNiMinor, '68745');
      assert.equal(BigInt(result.netMinor) + BigInt(result.payeMinor), 473250n);
    }
    assert.equal(total, expectedTax);
  }
});

test('history must start in April and fit one tax year of regular paydays', () => {
  for (const history of [[], null, Array(13).fill('10000'), ['10', '0', '10'], Array(3)]) {
    assert.throws(() => calculateMonthlyEmployeeDraft(history, '1257L'), RangeError);
  }
});

test('replays every consecutive 1257L payment before the HMRC example changes code', () => {
  const pack = JSON.parse(readFileSync(new URL('./fixtures/hmrc-paye-2026-27-v1.1.json', import.meta.url)));
  const rows = pack.cases.filter(row => row.sequenceId === 'rest_of_uk/Gen_cumul-mthly' && row.input.taxCode === '1257L');
  assert.equal(rows.length, 8);
  const history = [];
  let taxPaid = 0n;
  for (const [index, row] of rows.entries()) {
    assert.equal(row.input.period, index + 1);
    history.push(row.input.grossPayMinor);
    const result = calculateMonthlyEmployeeDraft(history, row.input.taxCode);
    assert.equal(result.payeMinor, row.expected.taxDueMinor, row.id);
    taxPaid += BigInt(result.payeMinor);
    assert.equal(String(taxPaid), row.expected.taxDueToDateMinor, row.id);
  }
});

test('April 1257L selects the additional rate a penny above its period threshold', () => {
  assert.equal(calculateAprilEmployeeDraft('1147726', '1257L').payeMinor, '354326');
  assert.equal(calculateAprilEmployeeDraft('1147727', '1257L').payeMinor, '354330');
  assert.equal(calculateAprilEmployeeDraft('6000000', '1257L').grossMinor, '6000000');
});

test('December BR uses the earlier payslips to reproduce the HMRC cumulative refund', () => {
  const pack = JSON.parse(readFileSync(new URL('./fixtures/hmrc-paye-2026-27-v1.1.json', import.meta.url)));
  const rows = pack.cases.filter(row => row.sequenceId === 'rest_of_uk/Gen_cumul-mthly' && row.input.period <= 9);
  const december = rows.at(-1);
  assert.equal(december.input.taxCode, 'BR');
  const result = calculateMonthlyEmployeeDraft(rows.map(row => row.input.grossPayMinor), rows.map(row => row.input.taxCode));
  assert.equal(result.payeMinor, december.expected.taxDueMinor);
  assert.equal(BigInt(rows.at(-2).expected.taxDueToDateMinor) + BigInt(result.payeMinor),
    BigInt(december.expected.taxDueToDateMinor));
});

test('code histories require one supported cumulative code for each payday', () => {
  for (const codes of [[], ['BR'], ['BR', 'NT M1'], ['BR M1', 'BR'], Array(2)]) {
    assert.throws(() => calculateMonthlyEmployeeDraft(['100', '100'], codes), RangeError);
  }
  assert.equal(calculateMonthlyEmployeeDraft(['199', '199'], 'BR').payeMinor, '40');
});

test('BR catch-up carries forward the tax actually withheld after a capped payday', () => {
  assert.equal(calculateMonthlyEmployeeDraft(['100000', '10000'], ['1257L', 'BR']).payeMinor, '5000');
  assert.equal(calculateMonthlyEmployeeDraft(['100000', '10000', '100000'], ['1257L', 'BR', 'BR']).payeMinor, '37000');
});

test('January cumulative NT refunds the remaining PAYE and still charges category A NI', () => {
  const pack = JSON.parse(readFileSync(new URL('./fixtures/hmrc-paye-2026-27-v1.1.json', import.meta.url)));
  const rows = pack.cases.filter(row => row.sequenceId === 'rest_of_uk/Gen_cumul-mthly');
  const gross = rows.map(row => row.input.grossPayMinor);
  const codes = rows.map(row => row.input.taxCode);
  const january = rows.at(-1);
  assert.equal(january.input.period, 10);
  assert.equal(january.input.taxCode, 'NT');
  assert.equal(january.input.week1Month1, null);
  const result = calculateMonthlyEmployeeDraft(gross, codes);
  assert.deepEqual(result, { grossMinor: '1124505', payeMinor: january.expected.taxDueMinor,
    employeeNiMinor: '39240', employerNiMinor: '162421', netMinor: '4928725' });
  assert.equal(BigInt(rows.at(-2).expected.taxDueToDateMinor) + BigInt(result.payeMinor),
    BigInt(january.expected.taxDueToDateMinor));
  assert.equal(calculateMonthlyEmployeeDraft([...gross, '100000'], [...codes, 'NT']).payeMinor, '0');
});

test('cumulative 0T applies all three England bands without free pay', () => {
  for (const [gross, paye] of [
    ['99', '0'], ['100', '20'], ['314200', '62840'], ['314201', '62846'],
    ['1042900', '354326'], ['1042901', '354330'],
  ]) {
    assert.equal(calculateAprilEmployeeDraft(gross, '0T').payeMinor, paye);
  }
  // £4,000 cumulative taxable earnings at 20%, less £190.20 already deducted in April.
  assert.equal(calculateMonthlyEmployeeDraft(['200000', '200000'], ['1257L', '0T']).payeMinor, '60980');
  assert.throws(() => calculateAprilEmployeeDraft('100000', '0T M1'), RangeError);
});
