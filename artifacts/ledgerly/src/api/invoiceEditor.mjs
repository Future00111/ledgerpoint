export function invoiceDueDate(issueDate, terms) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate) || !Number.isInteger(terms) || terms < 0 || terms > 365) return null;
  const date = new Date(`${issueDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== issueDate) return null;
  date.setUTCDate(date.getUTCDate() + terms);
  return date.toISOString().slice(0, 10);
}

export function newInvoiceDates(today = new Date().toISOString().slice(0, 10)) {
  return { issue_date: today, due_date: invoiceDueDate(today, 30), payment_terms: 30 };
}

export function changeInvoiceFields(form, key, value, automaticDueDate = false) {
  const next = { ...form, [key]: value };
  if (automaticDueDate && ['issue_date', 'payment_terms'].includes(key)) {
    next.due_date = invoiceDueDate(next.issue_date, next.payment_terms) ?? form.due_date;
  }
  return next;
}
