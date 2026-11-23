// Offline April 2026 scenario: England, cumulative 999L, zero opening balances,
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
  if (typeof grossMinor !== 'string' || !/^(?:0|[1-9][0-9]{0,6})$/.test(grossMinor)) {
    throw new RangeError('Expected gross from £0 through £10,000 in pence');
  }
  const gross = BigInt(grossMinor);
  if (gross > 1000000n) {
    throw new RangeError('Expected gross from £0 through £10,000 in pence');
  }
  // HMRC Table A, month one: one block of 500 (£416.67) plus code 499 (£416.59).
  const monthOneFreePay = 41667n + 41659n;
  const taxablePence = earningsAbove(gross, monthOneFreePay);
  const taxableWholePounds = taxablePence / 100n;
  // HMRC PAYE routines v24, definitions 9–11 and England tax formula 3.
  // Test the band before discarding pence. Band and band tax are in £0.0001.
  const monthOneBand = 37700n * 10000n / 12n;
  const monthOneBandTax = 7540n * 10000n / 12n;
  const paye = taxablePence <= 314200n
    ? taxableWholePounds * 20n
    : (monthOneBandTax + (taxableWholePounds * 10000n - monthOneBand) * 40n / 100n) / 100n;
  const aboveUpperLimit = earningsAbove(gross, 418900n);
  const mainBandEarnings = earningsAbove(gross, 104800n) - aboveUpperLimit;
  const employeeNi = roundedNi(mainBandEarnings * 8n + aboveUpperLimit * 2n);
  const employerNi = roundedNi(earningsAbove(gross, 41700n) * 15n);
  return {
    grossMinor,
    payeMinor: String(paye),
    employeeNiMinor: String(employeeNi),
    employerNiMinor: String(employerNi),
    netMinor: String(gross - paye - employeeNi),
  };
}
