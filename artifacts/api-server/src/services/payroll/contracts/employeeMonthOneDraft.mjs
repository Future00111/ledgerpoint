// Offline 2026–27 scenario: UK, monthly PAYE, zero opening balances,
// ordinary monthly cash earnings, supplied NI category, no other deductions or adjustments.
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
  if (!Array.isArray(grossHistory) || grossHistory.length < 1 || grossHistory.length > 12) {
    throw new RangeError('Expected one to twelve consecutive monthly gross amounts');
  }
  const hasCodeHistory = Array.isArray(taxCodes);
  if (hasCodeHistory && taxCodes.length !== grossHistory.length) {
    throw new RangeError('Expected one tax code for each gross amount');
  }
  let grossToDate = 0n;
  let taxPaid = 0n;
  for (const [index, amount] of grossHistory.entries()) {
    const gross = readGross(amount);
    if (index > 0 && gross === 0n) throw new RangeError('Expected a payment after April');
    grossToDate += gross;
    const taxCode = hasCodeHistory ? taxCodes[index] : taxCodes;
    const due = taxForPayday(gross, grossToDate, taxPaid, taxCode, BigInt(index + 1));
    const deduction = cappedDeduction(due, gross);
    if (index === grossHistory.length - 1) return payslip(gross, deduction, niCategory);
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

function taxForPayday(gross, grossToDate, taxPaid, taxCode, month) {
  if (typeof taxCode === 'string' && taxCode.endsWith(' M1')) {
    return cumulativeTax(gross, taxCode.slice(0, -3), 1n);
  }
  return cumulativeTax(grossToDate, taxCode, month) - taxPaid;
}

// 2026–27 annual upper limits in taxable pounds and marginal rates in percent.
const scottishBands = [
  [3967n, 19n], [16956n, 20n], [31092n, 21n],
  [62430n, 42n], [125140n, 45n], [null, 48n],
];
const restOfUkBands = [[37700n, 20n], [125140n, 40n], [null, 45n]];

function cumulativeTax(grossToDate, suppliedCode, month) {
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
  let monthOneFreePay = 0n;
  if (taxCode !== '0T') {
    if (typeof taxCode !== 'string' || !/^(?:K[1-9][0-9]{0,3}|[1-9][0-9]{0,3}L)$/.test(taxCode)) {
      throw new RangeError('Unsupported payroll tax code');
    }
    // HMRC v24 §4.3.1: both code families use Table A, with opposite signs.
    const isKCode = taxCode.startsWith('K');
    const number = BigInt(isKCode ? taxCode.slice(1) : taxCode.slice(0, -1));
    const blocks = (number - 1n) / 500n;
    const remainder = number - blocks * 500n;
    const remainderMonthly = (remainder * 1000n + 900n + 11n) / 12n;
    const adjustment = blocks * 41667n + remainderMonthly;
    monthOneFreePay = isKCode ? -adjustment : adjustment;
  }
  const taxablePence = earningsAbove(grossToDate, monthOneFreePay * month);
  const taxableWholePounds = taxablePence / 100n;
  // HMRC PAYE routines v24: select the rate before truncating taxable pounds.
  let lowerLimit = 0n;
  let annualTaxPence = 0n;
  for (const [upperLimit, rate] of scottish ? scottishBands : restOfUkBands) {
    if (upperLimit === null || taxablePence <= ((upperLimit * month + 11n) / 12n) * 100n) {
      // Both period thresholds are truncated separately to £0.0001.
      const threshold = lowerLimit * 10000n * month / 12n;
      const taxAtThreshold = annualTaxPence * 100n * month / 12n;
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
  const employeeNi = mainRate === 0n ? 0n : roundedNi(mainBandEarnings * mainRate / 100n + aboveUpperLimit * 2n);
  const employerNi = roundedNi(earningsAbove(gross, thresholds[employerThreshold]) * 15n);
  return { employeeNi, employerNi };
}

export function calculateWeeklyNiDraft(grossMinor, niCategory = 'A') {
  const { employeeNi, employerNi } = contributions(readGross(grossMinor), niCategory, weeklyThresholds);
  return { employeeNiMinor: String(employeeNi), employerNiMinor: String(employerNi),
    totalNiMinor: String(employeeNi + employerNi) };
}

function payslip(gross, paye, niCategory) {
  const { employeeNi, employerNi } = contributions(gross, niCategory, monthlyThresholds);
  return {
    grossMinor: String(gross),
    payeMinor: String(paye),
    employeeNiMinor: String(employeeNi),
    employerNiMinor: String(employerNi),
    netMinor: String(gross - paye - employeeNi),
  };
}
