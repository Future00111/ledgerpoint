/** Explicit source DTO. Caller-controlled totals/status never reach the draft API. */
export function invoiceSource(form, edit = false) {
  const result = {
    contract: "w03.draft.v1", customer_id: form.customer_id,
    invoice_number: form.invoice_number, issue_date: form.issue_date, due_date: form.due_date,
    payment_terms: form.payment_terms, reference: form.reference, notes: form.notes,
    price_basis: form.price_basis ?? "excluding_vat",
    line_items: form.line_items.map(l => ({
      description: l.description, quantity: l.quantity, unit_price: l.unit_price, tax_code: l.tax_code,
    })),
  };
  if (!edit) result.currency = "GBP";
  return result;
}
export function createInvoiceDraftClient(fetcher = fetch) {
  const context = async (companyId, signal) => {
    const response = await fetcher(
      `/api/companies/${encodeURIComponent(companyId)}/financial-drafts/invoices/context`,
      { credentials: "include", signal },
    );
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const known = json?.error;
      throw Object.assign(new Error(known?.message || "Invoice setup could not be loaded."), {
        status: response.status, code: known?.code, requestId: known?.request_id,
      });
    }
    const data = json?.data;
    if (!data?.company?.id || data.company.id !== companyId ||
        !Array.isArray(data.customers) || !Array.isArray(data.tax_rules)) {
      throw new Error("Invoice setup response could not be verified.");
    }
    return data;
  };
  const request = async (companyId, id, method, source, revision, signal) => {
    const url = `/api/companies/${encodeURIComponent(companyId)}/financial-drafts/invoices${id ? `/${encodeURIComponent(id)}` : ""}`;
    const response = await fetcher(url, {
      method, credentials: "include", signal,
      headers: { ...(source ? { "Content-Type": "application/json" } : {}),
        ...(revision ? { "If-Match": `"${revision}"` } : {}) },
      ...(source ? { body: JSON.stringify(source) } : {}),
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const known = json?.error;
      throw Object.assign(new Error(known?.message || "Draft request failed. Reload before retrying an uncertain save."), {
        status: response.status, code: known?.code, requestId: known?.request_id, issues: known?.issues ?? [],
      });
    }
    if (!json?.data?.id || !json?.data?.revision || json.data.company_id !== companyId) {
      throw new Error("Draft response could not be verified. Reload before trying another save.");
    }
    return json.data;
  };
  return {
    context,
    get: (company, id, signal) => request(company, id, "GET", undefined, undefined, signal),
    save: (company, form, id, revision) => request(company, id, id ? "PATCH" : "POST",
      invoiceSource(form, !!id), revision),
  };
}
export const invoiceDrafts = createInvoiceDraftClient();
export function displayPence(value) {
  const n = BigInt(value);
  return `£${n / 100n}.${(n % 100n).toString().padStart(2, "0")}`;
}
