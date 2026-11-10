/** Statement amounts are evidence: reject fractional pennies, never round them. */
export function bankImportPence(value: unknown): number {
  if (value == null || value === '') return 0;
  if (typeof value !== 'string' && typeof value !== 'number') throw Error('Bank amounts must be decimal numbers with at most two decimal places');
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw Error('Bank amounts must be non-negative decimal numbers with at most two decimal places');
  const [whole, fraction = ''] = text.split('.');
  const pence = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  // bank_transactions money columns are numeric(12,2).
  if (pence > 999999999999n) throw Error('Bank amount exceeds the supported range');
  return Number(pence);
}

export function bankImportSides(entry: Record<string, unknown>) {
  const inPence = bankImportPence(entry.money_in), outPence = bankImportPence(entry.money_out);
  if ((inPence === 0) === (outPence === 0)) throw Error('Each bank transaction must contain either money in or money out');
  return {inPence, outPence};
}
