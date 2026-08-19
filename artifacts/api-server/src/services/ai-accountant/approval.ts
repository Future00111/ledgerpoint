/**
 * AI Accountant — atomic approval of reconciliation matches.
 *
 * Extracted from the original approveReconciliationMatches handler so the
 * /api/functions route and /api/ai/reconciliation/approve share one
 * implementation. All validation and writes happen inside a single DB
 * transaction with row locks; payment deltas are capped at each record's
 * outstanding balance. The AI NEVER calls this — only an authenticated user
 * action reaches it.
 */
import { db } from "@workspace/db";
import {
  bankTransactionsTable,
  salesInvoicesTable,
  purchaseBillsTable,
  aiReconciliationResultsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

export interface ApprovalRecord {
  record_type: "sales_invoice" | "purchase_bill";
  record_id: string;
}

export interface ApprovalResult {
  label: string;
  applied: number;
  updateData: Record<string, unknown>;
}

/**
 * Apply one bank transaction against one or more invoices/bills atomically.
 * Caller MUST have already verified write access on the transaction's company.
 * Throws Error with a user-facing message on any conflict.
 */
export async function applyReconciliationApproval(
  bankTransactionId: string,
  records: ApprovalRecord[],
  approvedBy?: string,
): Promise<ApprovalResult> {
  const result = await db.transaction(async (tx) => {
    // Re-check the transaction is still awaiting reconciliation.
    const [fresh] = await tx
      .select()
      .from(bankTransactionsTable)
      .where(eq(bankTransactionsTable.id, bankTransactionId))
      .for("update");
    if (!fresh || fresh.status !== "review") {
      throw new Error("This transaction has already been reconciled");
    }

    const numbers: string[] = [];
    let appliedPence = 0;
    const txnPence = Math.round((Number(fresh.money_in || 0) + Number(fresh.money_out || 0)) * 100);

    for (const r of records) {
      const table = r.record_type === "sales_invoice" ? salesInvoicesTable : purchaseBillsTable;
      const [rec] = await tx.select().from(table).where(eq(table.id, r.record_id)).for("update");
      if (!rec) throw new Error("A matched record no longer exists");
      if (rec.company_id !== fresh.company_id) throw new Error("Record belongs to a different company");
      if (rec.status === "cancelled" || rec.status === "paid") {
        throw new Error(`${(rec as Record<string, unknown>)["invoice_number"] || (rec as Record<string, unknown>)["bill_number"]} is already settled`);
      }

      const balancePence = Math.round(Number(rec.balance_due ?? rec.total ?? 0) * 100);
      const remainingTxn = txnPence - appliedPence;
      const deltaPence = Math.min(balancePence, Math.max(0, remainingTxn));
      if (deltaPence <= 0) throw new Error("Matched records exceed the bank transaction amount");

      const paidPence = Math.round(Number(rec.amount_paid ?? 0) * 100) + deltaPence;
      const newBalancePence = Math.max(0, Math.round(Number(rec.total ?? 0) * 100) - paidPence);
      await tx
        .update(table)
        .set({
          amount_paid: (paidPence / 100).toFixed(2),
          balance_due: (newBalancePence / 100).toFixed(2),
          status: newBalancePence === 0 ? "paid" : rec.status,
          updated_at: new Date(),
        })
        .where(eq(table.id, r.record_id));

      appliedPence += deltaPence;
      const num = (rec as Record<string, unknown>)["invoice_number"] || (rec as Record<string, unknown>)["bill_number"];
      if (num) numbers.push(String(num));
    }

    const first = records[0]!;
    const label = numbers.length > 2 ? `${numbers.slice(0, 2).join(", ")} +${numbers.length - 2} more` : numbers.join(", ");
    const updateData = {
      status: "matched",
      matched_type: first.record_type,
      matched_record_id: first.record_id,
      matched_record_number: label,
      linked_invoice_id: first.record_type === "sales_invoice" ? first.record_id : null,
      linked_bill_id: first.record_type === "purchase_bill" ? first.record_id : null,
      updated_at: new Date(),
    };
    await tx
      .update(bankTransactionsTable)
      .set(updateData)
      .where(eq(bankTransactionsTable.id, bankTransactionId));

    return { label, applied: appliedPence / 100, updateData };
  });

  // Mark any pending AI analysis for this transaction as approved so the
  // review dashboard reflects reality. This is metadata, not financial state:
  // it runs after the financial transaction commits and is best-effort, so a
  // missing/out-of-date ai_reconciliation_results table (prod schema applied
  // via Replit's publish flow) can never roll back a valid approval.
  try {
    await db
      .update(aiReconciliationResultsTable)
      .set({
        approval_state: "approved",
        approved_by: approvedBy ?? null,
        approved_at: new Date(),
        updated_at: new Date(),
      })
      .where(
        and(
          eq(aiReconciliationResultsTable.bank_transaction_id, bankTransactionId),
          eq(aiReconciliationResultsTable.approval_state, "pending"),
        ),
      );
  } catch (err) {
    console.error("[ai-accountant] failed to mark analysis approved (schema up to date?):", err);
  }

  return result;
}
