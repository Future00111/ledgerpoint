// Offline 2026–27 scenario: England, cumulative 999L or 1257L, zero opening balances,
// ordinary monthly cash earnings, category A, no other deductions or adjustments.
function earningsAbove(gross, threshold) {
  return gross > threshold ? gross - threshold : 0n;
}

function roundedNi(hundredthsOfPenny) {
  // HMRC uses the third decimal place of pounds: 0–5 down, 6–9 up.
  const pennies = hundredthsOfPenny / 100n;
  return hundredthsOfPenny % 100n >= 60n ? pennies + 1n : pennies;
}

export function calculateApril999LDraft(grossMinor) {
  return calculateAprilEmployeeDraft(grossMinor, '999L');
}

export function calculateAprilEmployeeDraft(grossMinor, taxCode) {
  const gross = readGross(grossMinor);
  return payslip(gross, cumulativeTax(gross, taxCode, 1n));
}

// Consecutive ordinary paydays with the same code and no previous employment.
export function calculateMayEmployeeDraft(aprilGrossMinor, mayGrossMinor, taxCode) {
  return calculateMonthlyEmployeeDraft([aprilGrossMinor, mayGrossMinor], taxCode);
}

// Gross history starts in tax month one and ends at the payday being calculated.
export function calculateMonthlyEmployeeDraft(grossHistory, taxCode) {
  if (!Array.isArray(grossHistory) || grossHistory.length < 1 || grossHistory.length > 12) {
    throw new RangeError('Expected one to twelve consecutive monthly gross amounts');
  }
  let grossToDate = 0n;
  let taxPaid = 0n;
  for (const [index, amount] of grossHistory.entries()) {
    const gross = readGross(amount);
    if (index > 0 && gross === 0n) throw new RangeError('Expected a payment after April');
    grossToDate += gross;
    const due = cumulativeTax(grossToDate, taxCode, BigInt(index + 1)) - taxPaid;
    const deduction = due > gross / 2n ? gross / 2n : due;
    if (index === grossHistory.length - 1) return payslip(gross, deduction);
    taxPaid += deduction;
  }
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

function cumulativeTax(grossToDate, taxCode, month) {
  if (taxCode !== '999L' && taxCode !== '1257L') {
    throw new RangeError('Expected cumulative England tax code 999L or 1257L');
  }
  // HMRC Table A: blocks of 500 plus the month-one value for code 499 or 257.
  const monthOneFreePay = taxCode === '999L' ? 41667n + 41659n : 2n * 41667n + 21492n;
  const taxablePence = earningsAbove(grossToDate, monthOneFreePay * month);
  const taxableWholePounds = taxablePence / 100n;
  // HMRC PAYE routines v24: select the rate before truncating taxable pounds.
  const basicLimit = 37700n;
  const higherLimit = 125140n;
  const periodBandCeiling = limit => ((limit * month + 11n) / 12n) * 100n;
  if (taxablePence <= periodBandCeiling(basicLimit)) return taxableWholePounds * 20n;
  const basicBandTax = basicLimit * 20n / 100n;
  const higherBandTax = basicBandTax + (higherLimit - basicLimit) * 40n / 100n;
  const additionalRate = taxablePence > periodBandCeiling(higherLimit);
  const limit = additionalRate ? higherLimit : basicLimit;
  const annualTaxAtLimit = additionalRate ? higherBandTax : basicBandTax;
  const rate = additionalRate ? 45n : 40n;
  // Threshold and threshold tax are truncated separately to £0.0001.
  const band = limit * 10000n * month / 12n;
  const bandTax = annualTaxAtLimit * 10000n * month / 12n;
  return (bandTax + (taxableWholePounds * 10000n - band) * rate / 100n) / 100n;
}

function payslip(gross, paye) {
  const aboveUpperLimit = earningsAbove(gross, 418900n);
  const mainBandEarnings = earningsAbove(gross, 104800n) - aboveUpperLimit;
  const employeeNi = roundedNi(mainBandEarnings * 8n + aboveUpperLimit * 2n);
  const employerNi = roundedNi(earningsAbove(gross, 41700n) * 15n);
  return {
    grossMinor: String(gross),
    payeMinor: String(paye),
    employeeNiMinor: String(employeeNi),
    employerNiMinor: String(employerNi),
    netMinor: String(gross - paye - employeeNi),
  };
}
