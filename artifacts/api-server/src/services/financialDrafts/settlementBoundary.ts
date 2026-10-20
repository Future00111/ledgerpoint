/** Shared by single and batch reconciliation. Draft saving never grants settlement. */
export function assertInvoiceSettlementReady(recordType: string, status: unknown) {
  if (recordType === "sales_invoice" && status === "draft") {
    throw new Error("Draft invoices cannot be settled; approved invoice lifecycle authority is required");
  }
}
