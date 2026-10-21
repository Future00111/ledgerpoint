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
export function postingAccounts(accounts, kind) {
  const allowed = kind === 'sales_invoice' ? ['income', 'revenue']
    : kind === 'purchase_bill' ? ['expense', 'cost_of_sales'] : [];
  return accounts.filter(a => a.is_active !== false && allowed.includes(a.account_type));
}
export function columnTotals(rows) {
  return rows.reduce((t, r) => ({
    debit_minor: (BigInt(t.debit_minor) + BigInt(r.debit_minor)).toString(),
    credit_minor: (BigInt(t.credit_minor) + BigInt(r.credit_minor)).toString(),
  }), { debit_minor: '0', credit_minor: '0' });
}
