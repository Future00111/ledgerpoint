// Offline April 2026 scenario: England, cumulative 999L, zero opening balances,
// ordinary monthly cash earnings, category A, no other deductions or adjustments.
// Whole-pound gross in this range keeps PAYE in the basic band and NI in one band.
export function calculateApril999LDraft(grossMinor) {
  if (typeof grossMinor !== 'string' || !/^[1-9][0-9]{5}$/.test(grossMinor)) {
    throw new RangeError('Expected whole-pound gross from £1,048 through £3,900 in pence');
  }
  const gross = BigInt(grossMinor);
  if (gross < 104800n || gross > 390000n || gross % 100n !== 0n) {
    throw new RangeError('Expected whole-pound gross from £1,048 through £3,900 in pence');
  }
  // HMRC Table A, month one: one block of 500 (£416.67) plus code 499 (£416.59).
  const monthOneFreePay = 41667n + 41659n;
  const taxableWholePounds = (gross - monthOneFreePay) / 100n;
  const paye = taxableWholePounds * 20n;
  const employeeNi = (gross - 104800n) * 8n / 100n;
  const employerNi = (gross - 41700n) * 15n / 100n;
  return {
    grossMinor,
    payeMinor: String(paye),
    employeeNiMinor: String(employeeNi),
    employerNiMinor: String(employerNi),
    netMinor: String(gross - paye - employeeNi),
  };
}
