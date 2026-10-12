/**
 * AI Accountant — review summary metrics for the dashboard widget.
 * Read-only aggregation over persisted analysis + live transaction state.
 */
import { db } from "@workspace/db";
import {
  bankTransactionsTable,
  salesInvoicesTable,
  aiReconciliationResultsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

export interface ReviewSummary {
  analysed: boolean;
  awaiting_review: number;
  ready_to_approve: number;   // green, pending approval
  needs_review: number;       // amber
  no_match: number;           // red
  missing_amount_total: number; // sum of unexplained remainders
  overdue_invoices: number;
  possible_duplicates: number;
  last_analysed_at: string | null;
}

export async function getReviewSummary(companyId: string): Promise<ReviewSummary> {
  const todayISO = new Date().toISOString().slice(0, 10);

  const [reviewTxns, results, invoices] = await Promise.all([
    db.select().from(bankTransactionsTable).where(
      and(eq(bankTransactionsTable.company_id, companyId), eq(bankTransactionsTable.status, "review")),
    ),
    db.select().from(aiReconciliationResultsTable).where(
      and(
        eq(aiReconciliationResultsTable.company_id, companyId),
        eq(aiReconciliationResultsTable.approval_state, "pending"),
      ),
    ),
    db.select().from(salesInvoicesTable).where(eq(salesInvoicesTable.company_id, companyId)),
  ]);

  // Only count analysis rows whose transaction is still awaiting review.
  const reviewIds = new Set(reviewTxns.map((t) => t.id));
  const live = results.filter((r) => reviewIds.has(r.bank_transaction_id));

  // Duplicate detection: same description + amount + date among review txns.
  const groups: Record<string, number> = {};
  for (const t of reviewTxns) {
    const key = `${(t.description || "").toLowerCase().trim()}|${Number(t.money_in || 0) + Number(t.money_out || 0)}|${t.date}`;
    groups[key] = (groups[key] || 0) + 1;
  }
  const possibleDuplicates = Object.values(groups).filter((n) => n > 1).reduce((s, n) => s + n, 0);

  const overdue = invoices.filter(
    (i) => i.status !== "cancelled" && i.status !== "paid" && Number(i.balance_due || 0) > 0 && i.due_date && i.due_date < todayISO,
  ).length;

  const lastAnalysed = live.reduce<Date | null>((latest, r) => {
    const c = r.created_at ? new Date(r.created_at) : null;
    return c && (!latest || c > latest) ? c : latest;
  }, null);

  return {
    analysed: live.length > 0,
    awaiting_review: reviewTxns.length,
    ready_to_approve: live.filter((r) => r.status === "green").length,
    needs_review: live.filter((r) => r.status === "amber").length,
    no_match: live.filter((r) => r.status === "red").length,
    missing_amount_total: Math.round(live.reduce((s, r) => s + Number(r.remaining || 0), 0) * 100) / 100,
    overdue_invoices: overdue,
    possible_duplicates: possibleDuplicates,
    last_analysed_at: lastAnalysed ? lastAnalysed.toISOString() : null,
  };
}
