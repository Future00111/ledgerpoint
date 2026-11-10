/** Legacy numeric(12,2) header totals arrive as decimal strings, never JS money. */
export function legacyMinor(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))).toString();
}

export function legacyEntryTotals(entry) {
  const debit = legacyMinor(entry?.total_debit), credit = legacyMinor(entry?.total_credit);
  return debit === null || credit === null ? null : { debit, credit };
}

/** These are only displayed historical header totals, not a canonical ledger check. */
export function displayedLegacyTotals(entries) {
  let debit = 0n, credit = 0n, unbalancedEntries = 0;
  for (const entry of entries) {
    const totals = legacyEntryTotals(entry);
    if (!totals) return null;
    debit += BigInt(totals.debit); credit += BigInt(totals.credit);
    if (totals.debit !== totals.credit) unbalancedEntries++;
  }
  const difference = debit >= credit ? debit - credit : credit - debit;
  return { debit: debit.toString(), credit: credit.toString(), difference: difference.toString(), unbalancedEntries };
}

export function legacyLineAccounts(entry) {
  return Array.isArray(entry?.lines) ? entry.lines.map(line => {
    if (!line || typeof line !== 'object') return '';
    return [line.account_code, line.account_name].filter(value => typeof value === 'string').join(' ');
  }).join(' ') : '';
}
