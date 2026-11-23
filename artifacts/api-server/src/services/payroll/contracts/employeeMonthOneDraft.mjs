// Offline 2026–27 scenario: England, monthly PAYE, zero opening balances,
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
  return payslip(gross, taxForPayday(gross, gross, 0n, taxCode, 1n));
}

// Consecutive ordinary paydays with the same code and no previous employment.
export function calculateMayEmployeeDraft(aprilGrossMinor, mayGrossMinor, taxCode) {
  return calculateMonthlyEmployeeDraft([aprilGrossMinor, mayGrossMinor], taxCode);
}

// Supply one code throughout, or the code in force on each payday. A trailing ' M1' selects month-one treatment.
// Gross and code histories start in April.
export function calculateMonthlyEmployeeDraft(grossHistory, taxCodes) {
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

function taxForPayday(gross, grossToDate, taxPaid, taxCode, month) {
  if (typeof taxCode === 'string' && taxCode.endsWith(' M1')) {
    return cumulativeTax(gross, taxCode.slice(0, -3), 1n);
  }
  return cumulativeTax(grossToDate, taxCode, month) - taxPaid;
}

function cumulativeTax(grossToDate, taxCode, month) {
  if (taxCode === 'NT') return 0n;
  // HMRC PAYE routines v24 §5.4: tax all whole pounds of cumulative pay at basic rate.
  if (taxCode === 'BR') return (grossToDate / 100n) * 20n;
  // HMRC Table A for suffix codes. Cumulative 0T has no free pay.
  let monthOneFreePay;
  switch (taxCode) {
    case '45L': monthOneFreePay = 3825n; break;
    case '999L': monthOneFreePay = 41667n + 41659n; break;
    case '1257L': monthOneFreePay = 2n * 41667n + 21492n; break;
    case '0T': monthOneFreePay = 0n; break;
    default: throw new RangeError('Expected England tax code 45L, 999L, 1257L, 0T, BR or NT');
  }
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
