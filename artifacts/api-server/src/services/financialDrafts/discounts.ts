import { decimal, fail, MAX_PENCE, parseDiscount, type DraftLine } from './contract';

export type Discount = { type: 'percentage' | 'amount'; value: string };
export type DiscountAdjustment = Discount & { original_revision: string };
export type DiscountSummary = Discount & {
  price_basis: 'excluding_vat' | 'including_vat';
  base_pence: string; amount_pence: string; after_pence: string;
  lines: { before_pence: string; discount_pence: string; after_pence: string }[];
};
export const halfUp = (numerator: bigint, denominator: bigint) => {
  if (numerator < 0n || denominator <= 0n) fail(422, 'DISCOUNT_INVALID');
  return (2n * numerator + denominator) / (2n * denominator);
};

/** No floating point or percentage rounding before the final penny. */
export function discountAmount(base: bigint, discount: Discount): bigint {
  if (base < 0n || base > MAX_PENCE) fail(422, 'MONEY_LIMIT');
  parseDiscount(discount);
  const [whole, fraction = ''] = discount.value.split('.');
  const amount = discount.type === 'percentage' ? halfUp(base * decimal(discount.value, false), 1000000n)
    : BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (amount === 0n) fail(422, 'DISCOUNT_ROUNDS_TO_ZERO');
  if (amount > base) fail(422, 'DISCOUNT_EXCEEDS_TOTAL');
  return amount;
}

/** Hamilton/largest-remainder allocation; equal fractions use original line order. */
export function allocateDiscount(weights: bigint[], amount: bigint): bigint[] {
  if (weights.some(w => w < 0n) || amount < 0n) fail(422, 'DISCOUNT_INVALID');
  const total = weights.reduce((n, w) => n + w, 0n);
  if (amount > total) fail(422, 'DISCOUNT_EXCEEDS_TOTAL');
  if (total === 0n) return weights.map(() => 0n);
  const result = weights.map(w => w * amount / total);
  const order = weights.map((w, i) => ({ i, remainder: w * amount % total }))
    .sort((a, b) => a.remainder === b.remainder ? a.i - b.i : a.remainder > b.remainder ? -1 : 1);
  let remaining = amount - result.reduce((n, w) => n + w, 0n);
  for (const { i } of order) {
    if (remaining === 0n) break;
    result[i] = result[i]! + 1n; remaining--;
  }
  return result;
}

export function discountedAmounts(before: bigint[], discount: Discount | undefined, basis: 'excluding_vat' | 'including_vat') {
  if (!discount) return { amounts: before };
  const total = before.reduce((n, w) => n + w, 0n);
  const amount = discountAmount(total, discount);
  const allocation = allocateDiscount(before, amount);
  const amounts = before.map((n, i) => n - allocation[i]!);
  const summary: DiscountSummary = { ...discount, price_basis: basis, base_pence: total.toString(),
    amount_pence: amount.toString(), after_pence: (total - amount).toString(),
    lines: before.map((n, i) => ({ before_pence: n.toString(), discount_pence: allocation[i]!.toString(), after_pence: amounts[i]!.toString() })) };
  return { amounts, summary };
}

/** A later credit uses immutable original gross and cannot invent VAT pennies. */
export function creditFromGross(gross: bigint, original: { net_pence: string; vat_pence: string; gross_pence: string }, rate: bigint) {
  const originalGross = BigInt(original.gross_pence), originalNet = BigInt(original.net_pence), originalVat = BigInt(original.vat_pence);
  if (gross < 0n || gross > originalGross || originalGross !== originalNet + originalVat || rate < 0n) fail(422, 'DISCOUNT_INVALID');
  if (gross === originalGross) return { net: originalNet, vat: originalVat };
  const calculated = halfUp(gross * rate, 10000n + rate);
  const minimum = gross > originalNet ? gross - originalNet : 0n;
  const maximum = gross < originalVat ? gross : originalVat;
  const vat = calculated < minimum ? minimum : calculated > maximum ? maximum : calculated;
  return { net: gross - vat, vat };
}

/** Return credits on discounted invoices use stored pennies, never undiscounted prices. */
export function proratedDiscountedCredit(line: DraftLine, originalLine: DraftLine,
  original: { net_pence: string; vat_pence: string }) {
  const numerator = decimal(line.quantity, true) * decimal(line.unit_price, false);
  const denominator = decimal(originalLine.quantity, true) * decimal(originalLine.unit_price, false);
  if (numerator > denominator) fail(422, 'CREDIT_ORIGINAL_MISMATCH');
  if (denominator === 0n) return { net: 0n, vat: 0n };
  return { net: halfUp(BigInt(original.net_pence) * numerator, denominator),
    vat: halfUp(BigInt(original.vat_pence) * numerator, denominator) };
}
