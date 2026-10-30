import type { ErrorRequestHandler } from "express";

// Reviewed, fixed business messages only. Never expose provider, database, or arbitrary Error text.
const PUBLIC_BUSINESS_MESSAGES = new Set([
  "A VAT return already exists for this period. Open it to record an adjustment or create an explicit revision.",
  "A credit note is required",
  "A matched record cannot be paid beyond its outstanding balance",
  "A matched record no longer exists",
  "A reminder can only be drafted for an outstanding invoice",
  "A valid code, label, rate, and effective start date are required",
  "AI task is no longer open for a decision",
  "Approved VAT returns are locked.",
  "Approved VAT returns are locked. Create an explicit adjustment or revision instead.",
  "Bank account belongs to a different company",
  "Choose a ledger account or category before reconciling this transaction",
  "Company not found",
  "Could not record reminder approval",
  "Credit note belongs to a different company",
  "Credit note has already been applied",
  "Credit note is not available for matching",
  "Credit-note matches must exactly equal the refund amount",
  "Destination bank account belongs to a different company",
  "Each allocated match must be a positive amount within the bank transaction total",
  "Each bank transaction must contain either money in or money out",
  "Invoice not found",
  "Ledger account belongs to a different company",
  "Ledger account is inactive",
  "Manual adjustments are allowed only for Boxes 1, 2, 4, 6, 7, 8, or 9. Boxes 3 and 5 are calculated automatically.",
  "Matched records exceed the bank transaction amount",
  "Matches must allocate the full bank transaction amount before approval",
  "Money in and money out must be valid non-negative amounts",
  "Money-in transactions can only be matched to sales invoices",
  "Money-out transactions can only be matched to purchase bills",
  "No VAT settings were provided",
  "No pending analysis to reject",
  "Only an approved and locked VAT return can be revised.",
  "Provide a subject up to 180 characters and a message up to 4,000 characters",
  "Provide a valid approved reminder before recording it as sent",
  "Recommendation not found",
  "Record belongs to a different company",
  "Record not found",
  "Reminder tone must be friendly, professional, firm, or final",
  "Resolve or explicitly review high-risk VAT exceptions before approving this return.",
  "Sales credit notes can only be matched to money-out refunds",
  "Supplier credit notes can only be matched to money-in refunds",
  "The VAT return was already locked by another review.",
  "The VAT return was approved and locked while it was being recalculated.",
  "The VAT return was approved and locked while it was being updated.",
  "The matched evidence changed; review the transaction again",
  "This VAT Assistant currently supports invoice-basis VAT only.",
  "This VAT Assistant currently supports the standard VAT scheme only.",
  "This VAT return has already been approved and locked.",
  "This analysis is no longer current; review the transaction again",
  "This analysis is no longer eligible for batch approval",
  "This approved reminder has already been recorded as sent",
  "This reminder must be approved with its current content before it can be marked as sent",
  "This transaction has already been reconciled",
  "Transaction must contain either money in or money out before it can be reconciled",
  "Transaction not found",
  "Transfer amount must exactly match a one-sided bank transaction",
  "VAT Assistant calculations currently support invoice-basis VAT only. Update VAT settings before preparing a return.",
  "VAT Assistant calculations currently support the standard VAT scheme only. Update VAT settings before preparing a return.",
  "VAT adjustment is unavailable or has already been decided",
  "VAT adjustment period must match the selected VAT return",
  "VAT exception not found",
  "VAT period start must be before the period end",
  "VAT rate must be between 0 and 100",
  "VAT return not found",
  "VAT return not found for this company",
  "VAT return period is missing",
  "VAT tax rule could not be created",
]);

export function publicErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && PUBLIC_BUSINESS_MESSAGES.has(error.message) ? error.message : fallback;
}

/** Intentionally excludes messages, stacks, causes, queries, URLs and provider payloads. */
export function safeErrorLog(error: unknown): { error_code: string } {
  return { error_code: error instanceof Error && PUBLIC_BUSINESS_MESSAGES.has(error.message) ? "business_rule" : "unexpected_error" };
}

export const safeRouteErrors: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) { next(error); return; }
  req.log?.error(safeErrorLog(error), "Request failed");
  res.status(500).json({ error: "Unable to complete this request. Please try again." });
};
