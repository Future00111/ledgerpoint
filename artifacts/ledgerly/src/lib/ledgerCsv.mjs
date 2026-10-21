// Plain signed decimals are safe numeric cells, including negative payments and
// credits. Only formula-like text needs the apostrophe; never convert money to
// Number, which would lose precision before the file is written.
const cell = value => {
  const text = String(value ?? '');
  const decimal = /^-?\d+(?:\.\d+)?$/.test(text);
  const safe = !decimal && (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};
export const csv = rows => '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n');
export const decimalMinor = value => { let n = BigInt(value ?? '0'); const sign = n < 0n ? '-' : ''; if (n < 0n) n = -n; return `${sign}${n / 100n}.${(n % 100n).toString().padStart(2, '0')}`; };
export function downloadCsv(name, rows) {
  const url = URL.createObjectURL(new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
}
export function statementRows(data, partyId) {
  const party = data.party_balances.find(p => p.party_id === partyId);
  const transactions = data.party_transactions.filter(t => t.party_id === partyId);
  const closing = BigInt(party?.balance_minor || '0'), unapplied = BigInt(party?.unapplied_minor || '0');
  const opening = closing - transactions.reduce((n, t) => n + BigInt(t.balance_effect_minor), 0n);
  const openingUnapplied = unapplied - transactions.reduce((n, t) => n + BigInt(t.unapplied_effect_minor || '0'), 0n);
  let outstanding = opening, credit = openingUnapplied;
  return { party, opening: opening.toString(), openingUnapplied: openingUnapplied.toString(),
    closing: closing.toString(), unapplied: unapplied.toString(), net: (closing - unapplied).toString(),
    rows: transactions.map(t => { outstanding += BigInt(t.balance_effect_minor); credit += BigInt(t.unapplied_effect_minor || '0');
      return { ...t, running_balance_minor: outstanding.toString(), running_unapplied_minor: credit.toString(), net_effect_minor: (BigInt(t.balance_effect_minor) - BigInt(t.unapplied_effect_minor || '0')).toString() }; }) };
}

export function reportRows(d, tab, partyId) {
  const money = decimalMinor;
  if (tab === 'tb') return [['Code', 'Account', 'Type', 'Debit GBP', 'Credit GBP', 'Balance GBP'], ...d.trial_balance.map(r => [r.code, r.name, r.account_type, money(r.debit_minor), money(r.credit_minor), money(r.balance_minor)])];
  if (tab === 'gl') return [['Date', 'Code', 'Account', 'Document', 'Source', 'Journal', 'Debit GBP', 'Credit GBP'], ...d.general_ledger.map(r => [r.posting_date, r.account_code, r.account_name, r.source_number, r.source_type, r.journal_id, money(r.debit_minor), money(r.credit_minor)])];
  if (tab === 'pnl' || tab === 'bs') return [['Section', 'Group', 'Code', 'Account', 'Amount GBP'], ...(tab === 'pnl' ? d.pnl.sections : d.balance_sheet.sections).flatMap(s => s.groups.flatMap(g => g.accounts.map(a => [s.label, g.name, a.code, a.name, money(a.amount_minor)]))), ...(tab === 'pnl' ? [['Profit', '', '', '', money(d.pnl.profit_minor)]] : [['Cumulative unclosed earnings', '', '', '', money(d.balance_sheet.current_earnings_minor)]])];
  if (tab === 'vat') return [['Box', 'Amount GBP'], ...[1, 4, 5, 6, 7].map(n => [String(n), money(d.vat[`box${n}_pence`])])];
  if (tab === 'ageing') return [['Party', 'Type', 'Current GBP', '1-30 GBP', '31-60 GBP', '61-90 GBP', '90+ GBP'], ...d.ageing.map(r => [r.party_name, r.party_type, ...['current_minor', 'days_1_30_minor', 'days_31_60_minor', 'days_61_90_minor', 'days_90_plus_minor'].map(k => money(r[k]))])];
  return [['Party', 'Type', 'Outstanding GBP', 'Unapplied GBP', 'Net GBP'], ...d.party_balances.filter(r => !partyId || r.party_id === partyId).map(r => [r.party_name, r.party_type, money(r.balance_minor), money(r.unapplied_minor), money(r.net_balance_minor)])];
}
