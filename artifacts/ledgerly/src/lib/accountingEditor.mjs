/** Date defaults and presentation helpers; authoritative money remains on the server. */
export function dueFromTerms(issue, terms) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issue) || !/^\d+$/.test(String(terms))) return null;
  const days = Number(terms), date = new Date(`${issue}T00:00:00Z`);
  if (!Number.isInteger(days) || days > 365 || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== issue) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function changeDateField(form, field, value, manualDue, credit = false) {
  const next = { ...form, [field]: value };
  if (!credit && !manualDue && (field === 'issue_date' || field === 'payment_terms'))
    next.due_date = dueFromTerms(next.issue_date, next.payment_terms) ?? next.due_date;
  return next;
}
export function submittedDates(form, values, manualDue, credit = false) {
  const next = { ...form, ...values };
  // Native date pickers/autofill may update the DOM before React's change event.
  const explicit = manualDue || next.due_date !== form.due_date;
  if (!credit && !explicit) next.due_date = dueFromTerms(next.issue_date, next.payment_terms) ?? next.due_date;
  return next;
}
export const ROLE_LABELS = {
  receivables: 'Trade debtors', payables: 'Trade creditors', revenue: 'Sales', expense: 'Purchases',
  output_vat: 'Output VAT', input_vat: 'Input VAT',
};
/** Strict server eligibility: only accounts whose eligible_roles include the role. */
export function roleAccounts(accounts, role) {
  return (accounts ?? []).filter(a => Array.isArray(a.eligible_roles) && a.eligible_roles.includes(role));
}
export function tradeRole(kind) {
  return kind === 'sales_invoice' ? 'revenue' : kind === 'purchase_bill' ? 'expense' : null;
}
export function postingAccounts(accounts, kind) {
  const role = tradeRole(kind);
  return role ? roleAccounts(accounts, role) : [];
}
export function mappedId(mappings, role) {
  const m = mappings?.[role];
  return m && typeof m === 'object' ? (m.account_id ?? m.id ?? '') : (m ?? '');
}
export function accountLabel(accounts, id) {
  const a = (accounts ?? []).find(x => x.id === id);
  return a ? `${a.code} · ${a.name}` : id ? 'Account not in chart' : 'Not mapped';
}
/** Field-level issue from {error:{issues:[{path,code,message}]}}. */
export function issueFor(error, path) {
  return (error?.issues ?? []).find(i => i.path === path) ?? null;
}
/**
 * Unsaved preview of which accounts a document will use. Credits mirror their original's kind.
 * Non-recoverable purchases put VAT into the expense line and have no input VAT line.
 */
export function plannedAccounts(kind, { mappings, posting_account_id, purchase_vat_eligible, vatRegistered, vatMinor }) {
  const base = kind === 'sales_credit_note' ? 'sales_invoice' : kind === 'supplier_credit_note' ? 'purchase_bill' : kind;
  const sales = base === 'sales_invoice';
  const hasVat = vatRegistered && (vatMinor == null || BigInt(vatMinor) !== 0n);
  const netRole = sales ? 'revenue' : 'expense';
  const net = (base === kind && posting_account_id) ? posting_account_id : mappedId(mappings, netRole);
  const rows = [
    { key: 'party', label: sales ? 'Customer balance' : 'Supplier balance', id: mappedId(mappings, sales ? 'receivables' : 'payables') },
    { key: 'net', label: sales ? 'Sales (net)' : (!purchase_vat_eligible && hasVat ? 'Purchases (net plus non-recoverable VAT)' : 'Purchases (net)'), id: net },
  ];
  if (hasVat && (sales || purchase_vat_eligible)) rows.push({ key: 'vat', label: sales ? 'Output VAT' : 'Input VAT (recoverable)', id: mappedId(mappings, sales ? 'output_vat' : 'input_vat') });
  return rows;
}
export function columnTotals(rows) {
  return rows.reduce((t, r) => ({
    debit_minor: (BigInt(t.debit_minor) + BigInt(r.debit_minor)).toString(),
    credit_minor: (BigInt(t.credit_minor) + BigInt(r.credit_minor)).toString(),
  }), { debit_minor: '0', credit_minor: '0' });
}
