// Offline April 2026 scenario: England, cumulative 999L, zero opening balances,
// ordinary monthly cash earnings, category A, no other deductions or adjustments.
// Gross in this range keeps PAYE in the basic band and NI in one band.
function roundedNi(hundredthsOfPenny) {
  // HMRC uses the third decimal place of pounds: 0–5 down, 6–9 up.
  const pennies = hundredthsOfPenny / 100n;
  return hundredthsOfPenny % 100n >= 60n ? pennies + 1n : pennies;
}

export function calculateApril999LDraft(grossMinor) {
  if (typeof grossMinor !== 'string' || !/^[1-9][0-9]{5}$/.test(grossMinor)) {
    throw new RangeError('Expected gross from £1,048 through £3,900 in pence');
  }
  const gross = BigInt(grossMinor);
  if (gross < 104800n || gross > 390000n) {
    throw new RangeError('Expected gross from £1,048 through £3,900 in pence');
  }
  // HMRC Table A, month one: one block of 500 (£416.67) plus code 499 (£416.59).
  const monthOneFreePay = 41667n + 41659n;
  const taxableWholePounds = (gross - monthOneFreePay) / 100n;
  const paye = taxableWholePounds * 20n;
  const employeeNi = roundedNi((gross - 104800n) * 8n);
  const employerNi = roundedNi((gross - 41700n) * 15n);
  return {
    grossMinor,
    payeMinor: String(paye),
    employeeNiMinor: String(employeeNi),
    employerNiMinor: String(employerNi),
    netMinor: String(gross - paye - employeeNi),
  };
}
