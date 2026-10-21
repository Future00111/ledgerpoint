/** Navigation and amounts derived from actual posted lines, never current defaults. */
export function documentReportLink(doc, tab, postingDate, today = new Date().toISOString().slice(0, 10)) {
  const date = postingDate || doc.effective_adjustment_date || doc.source.issue_date;
  return `/reports?${new URLSearchParams({ tab, from: `${date.slice(0, 4)}-01-01`, to: today > date ? today : date, document_id: doc.id })}`;
}
export function postedAccountMovement(doc, lines, role, creditPositive = false) {
  const id = doc.posting_accounts?.[role];
  const matching = id ? lines.filter(line => line.account_id === id) : [];
  const amount = matching.reduce((sum, line) => sum + BigInt(line.debit_minor) - BigInt(line.credit_minor), 0n);
  return { amount: (creditPositive ? -amount : amount).toString(), account: matching[0] };
}
export function filterLedger(lines, accountId, documentId) {
  return lines.filter(line => (!accountId || line.account_id === accountId) && (!documentId || line.source_id === documentId));
}

const category = type => ({ revenue: 'income', expenses: 'expense' }[String(type).toLowerCase()] || String(type).toLowerCase());
/** One row per journal/document; split lines must not duplicate an invoice. */
export function pnlTransactions(data, { accountId, categoryId, groupName } = {}) {
  const documents = new Map((data.posted_documents ?? []).map(d => [d.id, d]));
  const grouped = new Map();
  const groupLabels = { income: 'Revenue', cost_of_sales: 'Cost of sales', expense: 'Operating expenses' };
  for (const l of data.general_ledger ?? []) {
    const cat = category(l.account_type);
    if (!['income', 'cost_of_sales', 'expense'].includes(cat) || (accountId && l.account_id !== accountId) || (categoryId && cat !== categoryId) || (groupName != null && (l.report_group ?? groupLabels[cat]) !== groupName)) continue;
    const d = documents.get(l.source_id);
    const key = `${l.journal_id}:${l.source_type}:${l.source_id}`;
    const row = grouped.get(key) ?? { date: l.posting_date, id: l.source_id, kind: l.source_type, journal_id: l.journal_id, number: l.source_number || d?.number || 'Journal', party: d?.party_name || '—', description: l.description || '', accounts: [], amount_minor: '0' };
    const movement = (BigInt(l.credit_minor) - BigInt(l.debit_minor)) * (cat === 'income' ? 1n : -1n);
    row.amount_minor = (BigInt(row.amount_minor) + movement).toString();
    const account = `${l.account_code} · ${l.account_name}`;
    if (!row.accounts.includes(account)) row.accounts.push(account);
    grouped.set(key, row);
  }
  return [...grouped.values()].sort((a, b) => b.date.localeCompare(a.date) || a.number.localeCompare(b.number));
}
