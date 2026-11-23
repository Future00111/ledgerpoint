// Offline 2026–27 scenario: UK, weekly or monthly PAYE, zero opening balances,
// ordinary cash earnings, supplied NI category, no other deductions or adjustments.
function earningsAbove(gross, threshold) {
  return gross > threshold ? gross - threshold : 0n;
}

function roundedNi(hundredthsOfPenny) {
  // HMRC uses the third decimal place of pounds: 0–5 down, 6–9 up.
  const pennies = hundredthsOfPenny / 100n;
  return hundredthsOfPenny % 100n >= 60n ? pennies + 1n : pennies;
}

export function calculateApril999LDraft(grossMinor, niCategory = 'A') {
  return calculateAprilEmployeeDraft(grossMinor, '999L', niCategory);
}

export function calculateAprilEmployeeDraft(grossMinor, taxCode, niCategory = 'A') {
  const gross = readGross(grossMinor);
  const due = taxForPayday(gross, gross, 0n, taxCode, 1n);
  return payslip(gross, cappedDeduction(due, gross), niCategory);
}

// Consecutive ordinary paydays with the same code and no previous employment.
export function calculateMayEmployeeDraft(aprilGrossMinor, mayGrossMinor, taxCode, niCategory = 'A') {
  return calculateMonthlyEmployeeDraft([aprilGrossMinor, mayGrossMinor], taxCode, niCategory);
}

// Supply one code throughout, or the code in force on each payday. A trailing ' M1' selects month-one treatment.
// Gross and code histories start in April.
export function calculateMonthlyEmployeeDraft(grossHistory, taxCodes, niCategory = 'A') {
  return calculateEmployeeDraft(grossHistory, taxCodes, niCategory, 'monthly');
}

export function calculateWeeklyEmployeeDraft(grossHistory, taxCodes, niCategory = 'A', week52FreePayMinor) {
  return calculateEmployeeDraft(grossHistory, taxCodes, niCategory, 'weekly', week52FreePayMinor);
}

export function calculateFortnightlyEmployeeDraft(grossHistory, taxCodes, niCategory = 'A', week52FreePayMinor) {
  return calculateEmployeeDraft(grossHistory, taxCodes, niCategory, 'fortnightly', week52FreePayMinor);
}

export function calculateFourWeeklyEmployeeDraft(grossHistory, taxCodes, niCategory = 'A', week52FreePayMinor) {
  return calculateEmployeeDraft(grossHistory, taxCodes, niCategory, 'four_weekly', week52FreePayMinor);
}

function calculateEmployeeDraft(grossHistory, taxCodes, niCategory, frequency, week52FreePayMinor) {
  const periods = frequency === 'monthly' ? 12n : 52n;
  const interval = frequency === 'fortnightly' ? 2n : frequency === 'four_weekly' ? 4n : 1n;
  const maxPayments = periods / interval + (frequency === 'monthly' ? 0n : 1n);
  if (!Array.isArray(grossHistory) || grossHistory.length < 1 || grossHistory.length > maxPayments) {
    throw new RangeError('Expected consecutive gross payments within the tax year');
  }
  const hasCodeHistory = Array.isArray(taxCodes);
  if (hasCodeHistory && taxCodes.length !== grossHistory.length) {
    throw new RangeError('Expected one tax code for each gross amount');
  }
  let grossToDate = 0n;
  let taxPaid = 0n;
  for (const [index, amount] of grossHistory.entries()) {
    const gross = readGross(amount);
    if (index > 0 && gross === 0n) throw new RangeError('Expected a payment after the first period');
    grossToDate += gross;
    const taxCode = hasCodeHistory ? taxCodes[index] : taxCodes;
    const previousCode = hasCodeHistory ? taxCodes[index - 1] : taxCode;
    const due = taxForPayday(gross, grossToDate, taxPaid, taxCode, BigInt(index + 1) * interval, periods, previousCode, interval, week52FreePayMinor);
    const deduction = cappedDeduction(due, gross);
    if (index === grossHistory.length - 1) return payslip(gross, deduction, niCategory, niThresholdsByFrequency.get(frequency));
    taxPaid += deduction;
  }
}

function cappedDeduction(due, gross) {
  return due > gross / 2n ? gross / 2n : due;
}

function readGross(grossMinor) {
  if (typeof grossMinor !== 'string' || !/^(?:0|[1-9][0-9]{0,6})$/.test(grossMinor)) {
    throw new RangeError('Expected gross from £0 through £60,000 in pence');
  }
  const gross = BigInt(grossMinor);
  if (gross > 6000000n) {
    throw new RangeError('Expected gross from £0 through £60,000 in pence');
  }
  return gross;
}

function taxForPayday(gross, grossToDate, taxPaid, taxCode, period, periods = 12n, previousCode, interval = 1n, week52FreePayMinor) {
  if (typeof taxCode === 'string' && taxCode.endsWith(periods === 52n ? ' W1' : ' M1')) {
    return cumulativeTax(gross, taxCode.slice(0, -3), interval, periods);
  }
  if (periods === 52n && period > 52n) {
    if (typeof taxCode !== 'string') throw new RangeError('Expected a week 53 tax code');
    const code = taxCode.replace(/^[SC]/, '');
    // Regulation 31(2) retains cumulative treatment for the basic-rate code.
    if (code !== 'BR') {
      // CWG2 §1.13: a cumulative suffix code can still have unused week 52 free pay.
      if (code === '0T' || /^[1-9][0-9]{0,3}L$/.test(code)) {
        if (previousCode.endsWith(' W1')) {
          // CWG2 compares the recorded week 52 total with pay including the extra payday.
          if (typeof week52FreePayMinor !== 'string' || !/^(0|[1-9][0-9]*)$/.test(week52FreePayMinor)) {
            throw new RangeError('Expected recorded week 52 total free pay in pence after W1');
          }
          if (grossToDate <= BigInt(week52FreePayMinor)) return 0n;
        }
        const prior = previousCode.replace(/^[SC]/, '');
        if (/^[1-9][0-9]{0,3}L$/.test(prior) && grossToDate <= freePay(prior, periods) * 52n) return 0n;
      }
      return cumulativeTax(gross, taxCode, interval, periods);
    }
  }
  return cumulativeTax(grossToDate, taxCode, period, periods) - taxPaid;
}

// 2026–27 annual upper limits in taxable pounds and marginal rates in percent.
const scottishBands = [
  [3967n, 19n], [16956n, 20n], [31092n, 21n],
  [62430n, 42n], [125140n, 45n], [null, 48n],
];
const restOfUkBands = [[37700n, 20n], [125140n, 40n], [null, 45n]];

function freePay(taxCode, periods) {
  let periodFreePay = 0n;
  if (taxCode !== '0T') {
    if (typeof taxCode !== 'string' || !/^(?:K[1-9][0-9]{0,3}|[1-9][0-9]{0,3}L)$/.test(taxCode)) {
      throw new RangeError('Unsupported payroll tax code');
    }
    // HMRC v24 §4.3.1: both code families use Table A, with opposite signs.
    const isKCode = taxCode.startsWith('K');
    const number = BigInt(isKCode ? taxCode.slice(1) : taxCode.slice(0, -1));
    const blocks = (number - 1n) / 500n;
    const remainder = number - blocks * 500n;
    const periodRemainder = (remainder * 1000n + 900n + periods - 1n) / periods;
    const adjustment = blocks * (periods === 52n ? 9616n : 41667n) + periodRemainder;
    periodFreePay = isKCode ? -adjustment : adjustment;
  }
  return periodFreePay;
}

function cumulativeTax(grossToDate, suppliedCode, period, periods) {
  if (suppliedCode === 'NT') return 0n;
  const scottish = typeof suppliedCode === 'string' && suppliedCode.startsWith('S');
  const welsh = typeof suppliedCode === 'string' && suppliedCode.startsWith('C');
  const taxCode = scottish || welsh ? suppliedCode.slice(1) : suppliedCode;
  const wholePounds = grossToDate / 100n;
  if (taxCode === 'BR') return wholePounds * 20n;
  if (taxCode === 'D0') return wholePounds * (scottish ? 21n : 40n);
  if (taxCode === 'D1') return wholePounds * (scottish ? 42n : 45n);
  if (scottish && taxCode === 'D2') return wholePounds * 45n;
  if (scottish && taxCode === 'D3') return wholePounds * 48n;
  const periodFreePay = freePay(taxCode, periods);
  const taxablePence = earningsAbove(grossToDate, periodFreePay * period);
  const taxableWholePounds = taxablePence / 100n;
  // HMRC PAYE routines v24: select the rate before truncating taxable pounds.
  let lowerLimit = 0n;
  let annualTaxPence = 0n;
  for (const [upperLimit, rate] of scottish ? scottishBands : restOfUkBands) {
    if (upperLimit === null || taxablePence <= ((upperLimit * period + periods - 1n) / periods) * 100n) {
      // Both period thresholds are truncated separately to £0.0001.
      const threshold = lowerLimit * 10000n * period / periods;
      const taxAtThreshold = annualTaxPence * 100n * period / periods;
      return (taxAtThreshold + (taxableWholePounds * 10000n - threshold) * rate / 100n) / 100n;
    }
    annualTaxPence += (upperLimit - lowerLimit) * rate;
    lowerLimit = upperLimit;
  }
}

// Current payday only. Main employee rates are in basis points; thresholds are in pence.
const niCategories = new Map([
  ['A', [800n, 'standard']], ['B', [185n, 'standard']], ['C', [0n, 'standard']], ['J', [200n, 'standard']],
  ['F', [800n, 'zone']], ['I', [185n, 'zone']], ['S', [0n, 'zone']], ['L', [200n, 'zone']],
  ['N', [800n, 'zone']], ['E', [185n, 'zone']], ['K', [0n, 'zone']], ['D', [200n, 'zone']],
  ['H', [800n, 'upper']], ['M', [800n, 'upper']], ['V', [800n, 'upper']], ['Z', [200n, 'upper']],
]);

const monthlyThresholds = { primary: 104800n, standard: 41700n, zone: 208300n, upper: 418900n };
const weeklyThresholds = { primary: 24200n, standard: 9600n, zone: 48100n, upper: 96700n };

function contributions(gross, niCategory, thresholds) {
  const terms = niCategories.get(niCategory);
  if (!terms) throw new RangeError('Unsupported employee NI category');
  const [mainRate, employerThreshold] = terms;
  const aboveUpperLimit = earningsAbove(gross, thresholds.upper);
  const mainBandEarnings = earningsAbove(gross, thresholds.primary) - aboveUpperLimit;
  const employeeNi = mainRate === 0n ? 0n : roundedNi(mainBandEarnings * mainRate / 100n) + roundedNi(aboveUpperLimit * 2n);
  const employerNi = roundedNi(earningsAbove(gross, thresholds[employerThreshold]) * 15n);
  return { employeeNi, employerNi };
}

export function calculateWeeklyNiDraft(grossMinor, niCategory = 'A') {
  return calculatePeriodNiDraft(grossMinor, 'weekly', niCategory);
}

const niThresholdsByFrequency = new Map([
  ['weekly', weeklyThresholds],
  ['fortnightly', { primary: 48400n, standard: 19300n, zone: 96200n, upper: 193400n }],
  ['four_weekly', { primary: 96700n, standard: 38500n, zone: 192400n, upper: 386700n }],
  ['monthly', monthlyThresholds],
]);

export function calculatePeriodNiDraft(grossMinor, frequency, niCategory = 'A') {
  const thresholds = niThresholdsByFrequency.get(frequency);
  if (!thresholds) throw new RangeError('Unsupported NI earnings period');
  const { employeeNi, employerNi } = contributions(readGross(grossMinor), niCategory, thresholds);
  return { employeeNiMinor: String(employeeNi), employerNiMinor: String(employerNi),
    totalNiMinor: String(employeeNi + employerNi) };
}

function payslip(gross, paye, niCategory, thresholds = monthlyThresholds) {
  const { employeeNi, employerNi } = contributions(gross, niCategory, thresholds);
  return {
    grossMinor: String(gross),
    payeMinor: String(paye),
    employeeNiMinor: String(employeeNi),
    employerNiMinor: String(employerNi),
    netMinor: String(gross - paye - employeeNi),
  };
}
