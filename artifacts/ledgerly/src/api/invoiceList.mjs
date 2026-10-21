/** Read-only invoice listing for the native Ledgerly invoice workflow. */
export async function listCompanyInvoices(companyId, signal, fetcher = fetch) {
  if (typeof companyId !== "string" || !companyId) throw new Error("Select a company before loading invoices.");
  const params = new URLSearchParams({ company_id: companyId, _order: "-issue_date", _limit: "500" });
  const response = await fetcher(`/api/entities/SalesInvoice?${params}`, {
    credentials: "include",
    signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw Object.assign(new Error(body?.error || "Invoices could not be loaded."), { status: response.status });
  }
  if (!Array.isArray(body) || body.some(invoice => invoice.company_id !== companyId)) {
    throw new Error("Invoice list could not be verified for the selected company.");
  }
  return body;
}
