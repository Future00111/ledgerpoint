/** Native accounting documents client. All responses {data}, failures {error:{code,message}}. */
export const KINDS = {
  sales_invoice: { path: '/invoices', label: 'Sales invoice', plural: 'Sales invoices', party: 'customer', section: 'Sales', number: 'Invoice number', credit: false },
  sales_credit_note: { path: '/sales-credit-notes', label: 'Sales credit note', plural: 'Sales credit notes', party: 'customer', section: 'Sales', number: 'Credit note number', credit: true, original: 'sales_invoice' },
  purchase_bill: { path: '/bills', label: 'Purchase bill', plural: 'Purchase bills', party: 'supplier', section: 'Purchases', number: 'Bill number', credit: false },
  supplier_credit_note: { path: '/supplier-credit-notes', label: 'Supplier credit note', plural: 'Supplier credit notes', party: 'supplier', section: 'Purchases', number: 'Credit note number', credit: true, original: 'purchase_bill' },
};
export const SOURCE_TYPE_KIND = { ...Object.fromEntries(Object.keys(KINDS).map(k => [k, k])) };

export function docPath(kind, id) {
  const k = KINDS[kind];
  return k && id ? `${k.path}/${encodeURIComponent(id)}` : null;
}

export function buildSource(form) {
  return {
    contract: 'w03.draft.v1', currency: 'GBP', customer_id: form.customer_id,
    invoice_number: form.invoice_number, issue_date: form.issue_date, due_date: form.due_date,
    payment_terms: Number(form.payment_terms) || 0, reference: form.reference ?? '', notes: form.notes ?? '',
    price_basis: form.price_basis ?? 'excluding_vat',
    line_items: form.line_items.map(l => ({
      description: String(l.description), quantity: String(l.quantity), unit_price: String(l.unit_price), tax_code: String(l.tax_code),
    })),
  };
}

export function buildEnvelope(kind, form, extra) {
  const body = { kind, source: buildSource(form), purchase_vat_eligible: kind === 'purchase_bill' || kind === 'supplier_credit_note' ? extra.purchase_vat_eligible === true : false };
  if (extra.posting_account_id) body.posting_account_id = extra.posting_account_id;
  if (KINDS[kind]?.credit) {
    body.original_id = extra.original_id;
    body.reason = extra.reason;
    body.original_line_refs = (extra.original_line_refs ?? []).map(Number);
    body.adjustment_method = 'offset_outstanding';
    body.effective_adjustment_date = extra.effective_adjustment_date;
  }
  return body;
}

/** Copy all original lines in order; quantity left editable (defaults to original). */
export function copyOriginalLines(original) {
  return (original?.source?.line_items ?? []).map(l => ({ ...l }));
}

export function penceToDisplay(value) {
  if (value === null || value === undefined || value === '') return '—';
  let n = BigInt(value);
  const neg = n < 0n; if (neg) n = -n;
  const pounds = (n / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '−' : ''}£${pounds}.${(n % 100n).toString().padStart(2, '0')}`;
}

export function createAccountingClient(fetcher = (...a) => fetch(...a)) {
  const call = async (url, { method = 'GET', body, revision, signal } = {}) => {
    const res = await fetcher(url, {
      method, credentials: 'include', signal,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(revision != null ? { 'If-Match': `"${revision}"` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const e = json?.error;
      throw Object.assign(new Error(e?.message || `Request failed (${res.status}).`), { status: res.status, code: e?.code });
    }
    return json?.data;
  };
  const base = c => `/api/companies/${encodeURIComponent(c)}`;
  const docs = c => `${base(c)}/accounting-documents`;
  return {
    list: (c, kind, signal) => call(`${docs(c)}?kind=${encodeURIComponent(kind)}`, { signal }),
    context: (c, kind, signal) => call(`${docs(c)}/context?kind=${encodeURIComponent(kind)}`, { signal }),
    get: (c, id, signal) => call(`${docs(c)}/${encodeURIComponent(id)}`, { signal }),
    create: (c, body) => call(docs(c), { method: 'POST', body }),
    update: (c, id, body, revision) => call(`${docs(c)}/${encodeURIComponent(id)}`, { method: 'PATCH', body, revision }),
    post: (c, id, revision) => call(`${docs(c)}/${encodeURIComponent(id)}/post`, { method: 'POST', body: {}, revision }),
    journal: (c, id, signal) => call(`${base(c)}/accounting-journals/${encodeURIComponent(id)}`, { signal }),
    reports: (c, from, to, signal) => call(`${base(c)}/accounting-reports?from=${from}&to=${to}`, { signal }),
    configuration: (c, signal) => call(`${base(c)}/accounting-configuration`, { signal }),
    saveConfiguration: (c, revision, mappings) => call(`${base(c)}/accounting-configuration`, { method: 'PUT', body: { revision, business_accounting_basis: 'accrual', mappings } }),
    createPeriod: (c, body) => call(`${base(c)}/accounting-periods`, { method: 'POST', body }),
    bootstrapDemo: () => call('/api/dev/accounting-flow/bootstrap', { method: 'POST', body: {} }),
  };
}
export const accounting = createAccountingClient();
