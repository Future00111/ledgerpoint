import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculateFortnightlyEmployeeDraft, calculateFourWeeklyEmployeeDraft, calculatePeriodNiDraft, calculateWeeklyEmployeeDraft, calculateWeeklyNiDraft, calculateApril999LDraft, calculateAprilEmployeeDraft, calculateMayEmployeeDraft, calculateMonthlyEmployeeDraft } from './employeeMonthOneDraft.mjs';

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
  for (const code of [undefined, 'SS1257L', '1257L W1', 'BR M1 M1']) {
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
  for (const codes of [[], ['BR'], ['BR', 'NT W1'], ['BR m1', 'BR'], Array(2)]) {
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
  assert.throws(() => calculateAprilEmployeeDraft('100000', '0T W1'), RangeError);
});

test('month-one PAYE matches all eight England 45L monthly HMRC examples even after earlier pay', () => {
  const pack = JSON.parse(readFileSync(new URL('./fixtures/hmrc-paye-2026-27-v1.1.json', import.meta.url)));
  const rows = pack.cases.filter(({ input }) => input.region === 'rest_of_uk' && input.taxCode === '45L'
    && input.frequency === 'monthly' && input.week1Month1 === 'WM1');
  assert.equal(rows.length, 8);
  for (const { id, input, expected } of rows) {
    assert.equal(calculateAprilEmployeeDraft(input.grossPayMinor, '45L M1').payeMinor, expected.taxDueMinor, id);
    assert.equal(calculateMayEmployeeDraft('500000', input.grossPayMinor, ['1257L', '45L M1']).payeMinor, expected.taxDueMinor, id);
  }
});

test('NT M1 skips a refund on that payday and cumulative NT later refunds the actual tax paid', () => {
  const gross = ['200000', '200000', '200000'];
  const codes = ['BR', 'NT M1', 'NT'];
  assert.equal(calculateMonthlyEmployeeDraft(gross.slice(0, 2), codes.slice(0, 2)).payeMinor, '0');
  assert.equal(calculateMonthlyEmployeeDraft(gross, codes).payeMinor, '-40000');
  assert.equal(calculateMonthlyEmployeeDraft(gross, ['BR', 'BR M1', 'NT']).payeMinor, '-80000');
});

test('D0 and D1 M1 reproduce both England monthly HMRC flat-rate examples', () => {
  const pack = JSON.parse(readFileSync(new URL('./fixtures/hmrc-paye-2026-27-v1.1.json', import.meta.url)));
  const rows = pack.cases.filter(({ input }) => input.region === 'rest_of_uk' && input.frequency === 'monthly'
    && input.week1Month1 === 'WM1' && ['D0', 'D1'].includes(input.taxCode));
  assert.deepEqual(rows.map(row => row.input.taxCode).sort(), ['D0', 'D1']);
  for (const { input, expected } of rows) {
    const result = calculateMayEmployeeDraft('200000', input.grossPayMinor, ['1257L', input.taxCode + ' M1']);
    assert.equal(result.payeMinor, expected.taxDueMinor);
  }
});

test('cumulative D codes carry fractional pounds and use actual prior deductions after a switch', () => {
  assert.equal(calculateMayEmployeeDraft('9999', '9999', 'D0').payeMinor, '4000');
  assert.equal(calculateMayEmployeeDraft('9999', '9999', 'D1').payeMinor, '4500');
  const gross = ['100000', '100000', '100000'];
  assert.equal(calculateMonthlyEmployeeDraft(gross.slice(0, 2), ['BR', 'D1']).payeMinor, '50000');
  assert.equal(calculateMonthlyEmployeeDraft(gross, ['BR', 'D1', 'D0']).payeMinor, '50000');
  assert.throws(() => calculateAprilEmployeeDraft('9999', 'SD4'), RangeError);
});

test('England K codes reproduce the six monthly HMRC K examples', () => {
  const pack = JSON.parse(readFileSync(new URL('./fixtures/hmrc-paye-2026-27-v1.1.json', import.meta.url)));
  const rows = pack.cases.filter(({ input }) => input.region === 'rest_of_uk' && input.frequency === 'monthly'
    && input.taxCode.startsWith('K'));
  assert.equal(rows.length, 6);
  const history = [];
  for (const { input, expected, id } of rows) {
    if (input.period === 1) history.length = 0;
    history.push(input.grossPayMinor);
    const code = input.week1Month1 === 'WM1' ? input.taxCode + ' M1' : input.taxCode;
    assert.equal(calculateMonthlyEmployeeDraft(history, code).payeMinor, expected.taxDueMinor, id);
  }
});

test('K-code adjustment affects only PAYE and caps April tax at half the actual pay', () => {
  for (const code of ['K585', 'K585 M1']) {
    const result = calculateAprilEmployeeDraft('101', code);
    assert.equal(result.payeMinor, '50');
    assert.equal(result.netMinor, '51');
    assert.equal(result.employeeNiMinor, '0');
    assert.equal(result.employerNiMinor, '0');
    assert.deepEqual(result, calculateMonthlyEmployeeDraft(['101'], code));
  }
  for (const code of ['K0', 'K01', 'SSK585', 'CCK585', 'K10000']) {
    assert.throws(() => calculateAprilEmployeeDraft('101', code), RangeError);
  }
});

for (const [region, count] of [['rest_of_uk', 33], ['wales', 21], ['scotland', 33]]) {
  test('every monthly workbook row matches period and year-to-date PAYE for ' + region, () => {
    const pack = JSON.parse(readFileSync(new URL('./fixtures/hmrc-paye-2026-27-v1.1.json', import.meta.url)));
    const rows = pack.cases.filter(({ input }) => input.region === region && input.frequency === 'monthly');
    assert.equal(rows.length, count);
    const histories = new Map();
    for (const row of rows) {
      const { input, expected } = row;
      const prior = input.period === 1 ? { gross: [], codes: [], paid: 0n } : histories.get(row.previousExampleId);
      assert.ok(prior, row.id);
      const gross = [...prior.gross, input.grossPayMinor];
      const codes = [...prior.codes, input.week1Month1 === 'WM1' ? input.taxCode + ' M1' : input.taxCode];
      assert.equal(gross.length, input.period, row.id);
      const { payeMinor } = calculateMonthlyEmployeeDraft(gross, codes);
      const paid = prior.paid + BigInt(payeMinor);
      assert.equal(payeMinor, expected.taxDueMinor, row.id);
      assert.equal(String(paid), expected.taxDueToDateMinor, row.id);
      histories.set(row.id, { gross, codes, paid });
    }
  });
}

test('Welsh K and zero-allowance codes use the supplied prefix; NT is unprefixed', () => {
  for (const code of ['K585', '0T']) {
    assert.deepEqual(calculateAprilEmployeeDraft('95000', 'C' + code), calculateAprilEmployeeDraft('95000', code));
  }
  for (const code of ['CNT', 'CCBR', 'C', 'CS1257L']) {
    assert.throws(() => calculateAprilEmployeeDraft('95000', code), RangeError);
  }
});

test('all 224 monthly NI workbook examples reconcile employee, employer and total contributions', () => {
  const pack = JSON.parse(readFileSync(new URL('./fixtures/hmrc-ni-2026-27-v1.0.json', import.meta.url)));
  const rows = pack.cases.filter(({ input }) => input.frequency === 'monthly');
  assert.equal(rows.length, 224);
  for (const { id, input, expected } of rows) {
    const result = calculateMonthlyEmployeeDraft([input.grossPayMinor], 'NT', input.category);
    assert.equal(result.employeeNiMinor, expected.employeeNiMinor, id);
    assert.equal(result.employerNiMinor, expected.employerNiMinor, id);
    assert.equal(BigInt(result.employeeNiMinor) + BigInt(result.employerNiMinor), BigInt(expected.totalNiMinor), id);
    assert.equal(BigInt(result.netMinor), BigInt(input.grossPayMinor) - BigInt(expected.employeeNiMinor), id);
  }
  assert.throws(() => calculateAprilEmployeeDraft('250000', 'NT', 'X'), RangeError);
});

test('weekly NI matches all 224 HMRC rows across sixteen categories', () => {
  const pack = JSON.parse(readFileSync(new URL('./fixtures/hmrc-ni-2026-27-v1.0.json', import.meta.url)));
  const rows = pack.cases.filter(({ input }) => input.frequency === 'weekly');
  assert.equal(rows.length, 224);
  assert.equal(new Set(rows.map(row => row.input.category)).size, 16);
  for (const { id, input, expected } of rows) {
    assert.deepEqual(calculateWeeklyNiDraft(input.grossPayMinor, input.category), expected, id);
  }
  assert.throws(() => calculateWeeklyNiDraft('9999', 'X'), RangeError);
});

test('weekly payslips reconcile every HMRC weekly PAYE case with weekly category A contributions', () => {
  const pack = JSON.parse(readFileSync(new URL('./fixtures/hmrc-paye-2026-27-v1.1.json', import.meta.url)));
  const rows = pack.cases.filter(row => row.input.frequency === 'weekly');
  assert.equal(rows.length, 81);
  const histories = new Map();
  for (const { id, previousExampleId, input, expected } of rows) {
    const prior = input.period === 1 ? { gross: [], codes: [], paid: 0n } : histories.get(previousExampleId);
    assert.ok(prior, id);
    const gross = [...prior.gross, input.grossPayMinor];
    const codes = [...prior.codes, input.taxCode + (input.week1Month1 === 'WM1' ? ' W1' : '')];
    assert.equal(gross.length, input.period, id);
    const result = calculateWeeklyEmployeeDraft(gross, codes);
    const ni = calculateWeeklyNiDraft(input.grossPayMinor);
    const paid = prior.paid + BigInt(result.payeMinor);
    assert.equal(result.payeMinor, expected.taxDueMinor, id);
    assert.equal(String(paid), expected.taxDueToDateMinor, id);
    assert.equal(result.employeeNiMinor, ni.employeeNiMinor, id);
    assert.equal(result.employerNiMinor, ni.employerNiMinor, id);
    assert.equal(BigInt(result.netMinor), BigInt(input.grossPayMinor) - BigInt(expected.taxDueMinor) - BigInt(ni.employeeNiMinor), id);
    histories.set(id, { gross, codes, paid });
  }
  assert.throws(() => calculateWeeklyEmployeeDraft(Array(54).fill('100'), 'BR'), RangeError);
  assert.throws(() => calculateWeeklyEmployeeDraft(['100'], '1257L M1'), RangeError);
});

test('extra weekly payday applies week-one tables only after the week-52 allowance is used', () => {
  const lowPay = Array(52).fill('10000');
  assert.equal(calculateWeeklyEmployeeDraft([...lowPay, '50000'], '1257L').payeMinor, '0');
  assert.equal(calculateWeeklyEmployeeDraft([...lowPay, '50000'], '1257L W1').payeMinor, '5160');
  assert.equal(calculateWeeklyEmployeeDraft([...lowPay, '50000'], [...Array(52).fill('0T'), '1257L']).payeMinor, '5160');
  assert.throws(() => calculateWeeklyEmployeeDraft([...lowPay, '50000'], [...Array(52).fill('1257L W1'), '1257L']), RangeError);
  for (const code of ['0T', 'C0T', 'S0T']) {
    assert.equal(calculateWeeklyEmployeeDraft([...lowPay, '50000'], [...Array(52).fill('1257L'), code]).payeMinor, '0');
  }
  const ordinary = calculateWeeklyEmployeeDraft([...Array(52).fill('50000'), '50000'], '1257L');
  assert.deepEqual(ordinary, { grossMinor: '50000', payeMinor: '5160', employeeNiMinor: '2064',
    employerNiMinor: '6060', netMinor: '42776' });
  assert.equal(calculateWeeklyEmployeeDraft([...lowPay, '101'], 'K585').payeMinor, '50');
});

test('week 53 preserves the cumulative BR exception and applies week-one treatment to other flat-rate codes', () => {
  const gross = [...Array(52).fill('101'), '199'];
  assert.equal(calculateWeeklyEmployeeDraft(gross, 'BR').payeMinor, '40');
  assert.equal(calculateWeeklyEmployeeDraft(gross, 'BR W1').payeMinor, '20');
  assert.equal(calculateWeeklyEmployeeDraft(gross, 'D0').payeMinor, '40');
  assert.equal(calculateWeeklyEmployeeDraft(gross, [...Array(52).fill('D0'), 'NT']).payeMinor, '0');
});

test('fortnightly and four-weekly NI matches the eligible HMRC examples', () => {
  const pack = JSON.parse(readFileSync(new URL('./fixtures/hmrc-ni-2026-27-v1.0.json', import.meta.url)));
  for (const frequency of ['fortnightly', 'four_weekly']) {
    const rows = pack.cases.filter(row => row.input.frequency === frequency && row.sourceIssues.length === 0);
    assert.equal(rows.length, 222);
    assert.equal(new Set(rows.map(row => row.input.category)).size, 16);
    for (const { id, input, expected } of rows) {
      assert.deepEqual(calculatePeriodNiDraft(input.grossPayMinor, frequency, input.category), expected, id);
    }
  }
  assert.throws(() => calculatePeriodNiDraft('10000', 'biweekly'), RangeError);
});

test('two- and four-week payslips use their PAYE weeks and NI earnings periods', () => {
  for (const [calculate, grossMinor, payeMinor, employeeNiMinor, employerNiMinor, netMinor] of [
    [calculateFortnightlyEmployeeDraft, '100000', '10320', '4128', '12105', '85552'],
    [calculateFourWeeklyEmployeeDraft, '200000', '20640', '8264', '24225', '171096'],
  ]) {
    assert.deepEqual(calculate([grossMinor], '1257L'), { grossMinor, payeMinor, employeeNiMinor, employerNiMinor, netMinor });
    assert.equal(calculate(['100', grossMinor], '1257L W1').payeMinor, payeMinor);
    assert.equal(calculate(['100', grossMinor], '1257L').payeMinor,
      calculate === calculateFortnightlyEmployeeDraft ? '660' : '1300');
  }
});

test('extra fortnightly and four-weekly paydays apply the extra-period rules', () => {
  for (const [calculate, normal, gross, extraTax, basicRateTax] of [
    [calculateFortnightlyEmployeeDraft, 26, '100000', '10320', '20000'],
    [calculateFourWeeklyEmployeeDraft, 13, '200000', '20640', '40000'],
  ]) {
    const payments = Array(normal + 1).fill(gross);
    assert.equal(calculate(payments, '1257L').payeMinor, extraTax);
    assert.equal(calculate(payments, 'BR').payeMinor, basicRateTax);
    assert.equal(calculate([...Array(normal).fill('100'), '200000'], '1257L').payeMinor, '0');
    assert.throws(() => calculate([...payments, '100'], '1257L'), RangeError);
  }
});
