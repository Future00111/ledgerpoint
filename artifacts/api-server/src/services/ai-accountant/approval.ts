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
  salesCreditNotesTable,
  supplierCreditNotesTable,
  chartOfAccountsTable,
  aiReconciliationResultsTable,
} from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

export interface ApprovalRecord {
  record_type: "sales_invoice" | "purchase_bill";
  record_id: string;
  /** Optional explicit allocation used by the split-reconciliation workflow. */
  amount?: number;
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
    if (!fresh || (fresh.status !== "review" && fresh.status !== "unmatched")) {
      throw new Error("This transaction has already been reconciled");
    }

    const moneyInPence = Math.round(Number(fresh.money_in || 0) * 100);
    const moneyOutPence = Math.round(Number(fresh.money_out || 0) * 100);
    if ((moneyInPence <= 0 && moneyOutPence <= 0) || (moneyInPence > 0 && moneyOutPence > 0)) {
      throw new Error("Transaction must contain either money in or money out before it can be reconciled");
    }
    const expectedRecordType = moneyInPence > 0 ? "sales_invoice" : "purchase_bill";
    if (records.some((r) => r.record_type !== expectedRecordType)) {
      throw new Error(
        expectedRecordType === "sales_invoice"
          ? "Money-in transactions can only be matched to sales invoices"
          : "Money-out transactions can only be matched to purchase bills",
      );
    }

    const numbers: string[] = [];
    let appliedPence = 0;
    const txnPence = moneyInPence || moneyOutPence;

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
      const requestedPence = r.amount == null
        ? remainingTxn
        : Math.round(Number(r.amount) * 100);
      if (requestedPence <= 0 || requestedPence > remainingTxn) {
        throw new Error("Each allocated match must be a positive amount within the bank transaction total");
      }
      if (requestedPence > balancePence) {
        throw new Error("A matched record cannot be paid beyond its outstanding balance");
      }
      const deltaPence = requestedPence;
      if (deltaPence <= 0) throw new Error("Matched records exceed the bank transaction amount");

      const paidPence = Math.round(Number(rec.amount_paid ?? 0) * 100) + deltaPence;
      const newBalancePence = Math.max(0, Math.round(Number(rec.total ?? 0) * 100) - paidPence);
      await tx
        .update(table)
        .set({
          amount_paid: (paidPence / 100).toFixed(2),
          balance_due: (newBalancePence / 100).toFixed(2),
          status: newBalancePence === 0 ? "paid" : paidPence > 0 ? "part_paid" : rec.status,
          updated_at: new Date(),
        })
        .where(eq(table.id, r.record_id));

      appliedPence += deltaPence;
      const num = (rec as Record<string, unknown>)["invoice_number"] || (rec as Record<string, unknown>)["bill_number"];
      if (num) numbers.push(String(num));
    }
    if (appliedPence !== txnPence) {
      throw new Error("Matches must allocate the full bank transaction amount before approval");
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
      linked_credit_note_id: null,
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

export type NonPaymentMatchType = "sales_credit_note" | "supplier_credit_note" | "ledger_account";

export interface NonPaymentMatchInput {
  record_type: NonPaymentMatchType;
  record_id?: string;
  record_number?: string;
  category?: string;
  vat_rate?: number | null;
  notes?: string | null;
}

/**
 * Apply a credit-note, ledger-account, or manual categorisation match. Unlike
 * an invoice/bill payment this has no document balance movement, but it still
 * locks the bank row and validates target tenancy before changing links.
 */
export async function applyNonPaymentReconciliationMatch(
  bankTransactionId: string,
  input: NonPaymentMatchInput,
): Promise<ApprovalResult> {
  return db.transaction(async (tx) => {
    const [fresh] = await tx
      .select()
      .from(bankTransactionsTable)
      .where(eq(bankTransactionsTable.id, bankTransactionId))
      .for("update");
    if (!fresh || (fresh.status !== "review" && fresh.status !== "unmatched")) {
      throw new Error("This transaction has already been reconciled");
    }

    let recordNumber = input.record_number || "";
    const category = input.category?.trim() || null;
    const vatRate = input.vat_rate == null ? null : Number(input.vat_rate);
    if (vatRate != null && (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100)) {
      throw new Error("VAT rate must be between 0 and 100");
    }
    const moneyInPence = Math.round(Number(fresh.money_in || 0) * 100);
    const moneyOutPence = Math.round(Number(fresh.money_out || 0) * 100);
    if ((moneyInPence <= 0 && moneyOutPence <= 0) || (moneyInPence > 0 && moneyOutPence > 0)) {
      throw new Error("Transaction must contain either money in or money out before it can be reconciled");
    }
    const txnPence = moneyInPence || moneyOutPence;
    if (input.record_type === "sales_credit_note") {
      if (!input.record_id) throw new Error("A credit note is required");
      const [target] = await tx.select().from(salesCreditNotesTable)
        .where(eq(salesCreditNotesTable.id, input.record_id)).for("update");
      if (!target || target.company_id !== fresh.company_id) throw new Error("Credit note belongs to a different company");
      if (target.status === "draft" || target.status === "cancelled") throw new Error("Credit note is not available for matching");
      if (target.is_applied) throw new Error("Credit note has already been applied");
      if (moneyOutPence <= 0) throw new Error("Sales credit notes can only be matched to money-out refunds");
      if (Math.round(Number(target.total || 0) * 100) !== txnPence) {
        throw new Error("Credit-note matches must exactly equal the refund amount");
      }
      await tx.update(salesCreditNotesTable).set({ is_applied: true, status: "applied", updated_at: new Date() })
        .where(eq(salesCreditNotesTable.id, target.id));
      recordNumber = target.credit_note_number || recordNumber;
    } else if (input.record_type === "supplier_credit_note") {
      if (!input.record_id) throw new Error("A credit note is required");
      const [target] = await tx.select().from(supplierCreditNotesTable)
        .where(eq(supplierCreditNotesTable.id, input.record_id)).for("update");
      if (!target || target.company_id !== fresh.company_id) throw new Error("Credit note belongs to a different company");
      if (target.status === "draft" || target.status === "cancelled") throw new Error("Credit note is not available for matching");
      if (target.is_applied) throw new Error("Credit note has already been applied");
      if (moneyInPence <= 0) throw new Error("Supplier credit notes can only be matched to money-in refunds");
      if (Math.round(Number(target.total || 0) * 100) !== txnPence) {
        throw new Error("Credit-note matches must exactly equal the refund amount");
      }
      await tx.update(supplierCreditNotesTable).set({ is_applied: true, status: "applied", updated_at: new Date() })
        .where(eq(supplierCreditNotesTable.id, target.id));
      recordNumber = target.credit_note_number || recordNumber;
    } else if (input.record_id) {
      const [target] = await tx.select().from(chartOfAccountsTable)
        .where(eq(chartOfAccountsTable.id, input.record_id)).for("update");
      if (!target || target.company_id !== fresh.company_id) throw new Error("Ledger account belongs to a different company");
      if (target.is_active === false) throw new Error("Ledger account is inactive");
      recordNumber = `${target.code ? `${target.code} ` : ""}${target.name}`;
    } else if (!category) {
      throw new Error("Choose a ledger account or category before reconciling this transaction");
    }

    const updateData = {
      status: "matched",
      matched_type: input.record_type,
      matched_record_id: input.record_id ?? null,
      matched_record_number: recordNumber,
      linked_invoice_id: null,
      linked_bill_id: null,
      linked_credit_note_id:
        input.record_type === "sales_credit_note" || input.record_type === "supplier_credit_note"
          ? input.record_id!
          : null,
      category,
      vat_rate: vatRate == null ? null : vatRate.toFixed(2),
      notes: input.notes ?? fresh.notes,
      updated_at: new Date(),
    };
    await tx.update(bankTransactionsTable)
      .set(updateData)
      .where(eq(bankTransactionsTable.id, bankTransactionId));

    return { label: recordNumber, applied: 0, updateData };
  });
}
