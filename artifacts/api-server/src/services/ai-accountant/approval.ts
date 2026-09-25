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
  accountLearningsTable,
  accountSuggestionLogsTable,
  aiDecisionAuditsTable,
  bankTransactionsTable,
  salesInvoicesTable,
  purchaseBillsTable,
  salesCreditNotesTable,
  supplierCreditNotesTable,
  chartOfAccountsTable,
  aiReconciliationResultsTable,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";

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

export interface ApprovalGuard {
  /** Bind the accounting write to the exact persisted analysis selected by the caller. */
  expectedAnalysisId?: string;
  /** Batch approvals must re-check this threshold while holding the analysis lock. */
  minimumConfidence?: number;
  /** Batch approvals require the analysis to remain a clean READY decision. */
  requireReady?: boolean;
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
  guard?: ApprovalGuard,
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

    if (guard?.expectedAnalysisId) {
      const [analysis] = await tx
        .select()
        .from(aiReconciliationResultsTable)
        .where(and(
          eq(aiReconciliationResultsTable.id, guard.expectedAnalysisId),
          eq(aiReconciliationResultsTable.company_id, fresh.company_id),
          eq(aiReconciliationResultsTable.bank_transaction_id, bankTransactionId),
          eq(aiReconciliationResultsTable.approval_state, "pending"),
        ))
        .for("update");
      if (!analysis) throw new Error("This analysis is no longer current; review the transaction again");
      if (guard.requireReady && (
        analysis.decision_state !== "READY" ||
        (analysis.confidence ?? 0) < (guard.minimumConfidence ?? 0) ||
        analysis.duplicate_flag ||
        analysis.vat_review_required ||
        analysis.transfer_flag
      )) {
        throw new Error("This analysis is no longer eligible for batch approval");
      }
      const analysisMatches = Array.isArray(analysis.matched_records) ? analysis.matched_records : [];
      const sameSingleMatch = analysisMatches.length === records.length && records.every((record) =>
        analysisMatches.some((match) =>
          match && typeof match === "object" &&
          (match as Record<string, unknown>).record_type === record.record_type &&
          (match as Record<string, unknown>).record_id === record.record_id,
        ),
      );
      if (!sameSingleMatch) throw new Error("The matched evidence changed; review the transaction again");
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

    const [analysis] = await tx
      .select()
      .from(aiReconciliationResultsTable)
      .where(and(
        eq(aiReconciliationResultsTable.bank_transaction_id, bankTransactionId),
        eq(aiReconciliationResultsTable.approval_state, "pending"),
      ))
      .orderBy(desc(aiReconciliationResultsTable.created_at))
      .limit(1);

    await tx
      .update(aiReconciliationResultsTable)
      .set({
        approval_state: "approved",
        decision_state: "RECONCILED",
        final_accounting_action: "reconciled",
        approved_by: approvedBy ?? null,
        approved_at: new Date(),
        updated_at: new Date(),
      })
      .where(and(
        eq(aiReconciliationResultsTable.bank_transaction_id, bankTransactionId),
        eq(aiReconciliationResultsTable.approval_state, "pending"),
      ));

    await tx.insert(aiDecisionAuditsTable).values({
      company_id: fresh.company_id,
      bank_transaction_id: bankTransactionId,
      analysis_id: analysis?.id ?? null,
      event_type: "reconciled",
      decision_source: "user",
      confidence: analysis?.confidence ?? null,
      previous_state: analysis?.decision_state ?? "REVIEW_REQUIRED",
      new_state: "RECONCILED",
      user_decision: "approved",
      final_accounting_action: "reconciled",
      user_id: approvedBy ?? null,
      evidence: {
        allocations: records.map((record) => ({
          record_type: record.record_type,
          record_id: record.record_id,
          amount: record.amount ?? null,
        })),
        transaction_amount: (txnPence / 100).toFixed(2),
      },
    });

    return { label, applied: appliedPence / 100, updateData };
  });

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
  approvedBy?: string,
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
    let learnedAccount: {
      id: string; code: string | null; name: string; suggestionSource: string | null; confidence: number | null;
      suggestedAccountId: string | null; suggestedAccountName: string | null;
    } | null = null;
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
      const [analysis] = await tx.select({
        category_account_id: aiReconciliationResultsTable.category_account_id,
        category_confidence: aiReconciliationResultsTable.category_confidence,
        category_suggestion: aiReconciliationResultsTable.category_suggestion,
      }).from(aiReconciliationResultsTable).where(and(
        eq(aiReconciliationResultsTable.bank_transaction_id, bankTransactionId),
        eq(aiReconciliationResultsTable.approval_state, "pending"),
      )).orderBy(desc(aiReconciliationResultsTable.created_at)).limit(1);
      learnedAccount = {
        id: target.id,
        code: target.code,
        name: target.name,
        suggestionSource: analysis?.category_account_id === target.id ? "analysis" : "user",
        confidence: analysis?.category_account_id === target.id ? analysis.category_confidence : null,
        suggestedAccountId: analysis?.category_account_id ?? null,
        suggestedAccountName: analysis?.category_suggestion ?? null,
      };
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

    const [analysis] = await tx
      .select()
      .from(aiReconciliationResultsTable)
      .where(and(
        eq(aiReconciliationResultsTable.bank_transaction_id, bankTransactionId),
        eq(aiReconciliationResultsTable.approval_state, "pending"),
      ))
      .orderBy(desc(aiReconciliationResultsTable.created_at))
      .limit(1);
    await tx.update(aiReconciliationResultsTable).set({
      approval_state: "approved",
      decision_state: "RECONCILED",
      final_accounting_action: input.record_type === "ledger_account" ? "categorised" : "reconciled",
      approved_by: approvedBy ?? null,
      approved_at: new Date(),
      updated_at: new Date(),
    }).where(and(
      eq(aiReconciliationResultsTable.bank_transaction_id, bankTransactionId),
      eq(aiReconciliationResultsTable.approval_state, "pending"),
    ));
    await tx.insert(aiDecisionAuditsTable).values({
      company_id: fresh.company_id,
      bank_transaction_id: bankTransactionId,
      analysis_id: analysis?.id ?? null,
      event_type: input.record_type === "ledger_account" ? "categorised" : "reconciled",
      decision_source: "user",
      confidence: analysis?.confidence ?? null,
      previous_state: analysis?.decision_state ?? "REVIEW_REQUIRED",
      new_state: "RECONCILED",
      user_decision: "approved",
      final_accounting_action: input.record_type === "ledger_account" ? "categorised" : "reconciled",
      user_id: approvedBy ?? null,
      evidence: {
        record_type: input.record_type,
        record_id: input.record_id ?? null,
        category,
        vat_rate: vatRate,
      },
    });
    if (learnedAccount) {
      const partyName = fresh.description?.trim() || null;
      const [previousLearning] = partyName
        ? await tx.select().from(accountLearningsTable).where(and(
          eq(accountLearningsTable.company_id, fresh.company_id),
          eq(accountLearningsTable.party_name, partyName),
          eq(accountLearningsTable.account_id, learnedAccount.id),
        )).limit(1)
        : [];
      if (previousLearning) {
        await tx.update(accountLearningsTable).set({
          occurrence_count: (previousLearning.occurrence_count ?? 1) + 1,
          confidence: String(learnedAccount.confidence ?? previousLearning.confidence ?? 85),
          last_used_date: fresh.date ?? new Date().toISOString().slice(0, 10),
          updated_at: new Date(),
        }).where(eq(accountLearningsTable.id, previousLearning.id));
      } else {
        await tx.insert(accountLearningsTable).values({
          company_id: fresh.company_id,
          source_type: "bank_transaction",
          source_record_id: fresh.id,
          party_type: "bank_description",
          party_name: partyName,
          account_id: learnedAccount.id,
          account_code: learnedAccount.code,
          account_name: learnedAccount.name,
          confidence: String(learnedAccount.confidence ?? 85),
          occurrence_count: 1,
          last_used_date: fresh.date ?? new Date().toISOString().slice(0, 10),
        });
      }
      await tx.insert(accountSuggestionLogsTable).values({
        company_id: fresh.company_id,
        source_type: "bank_transaction",
        source_record_id: fresh.id,
        party_type: "bank_description",
        party_name: partyName,
        suggested_account_id: learnedAccount.suggestedAccountId,
        suggested_account_name: learnedAccount.suggestedAccountName,
        final_account_id: learnedAccount.id,
        final_account_name: learnedAccount.name,
        confidence: String(learnedAccount.confidence ?? 0),
        accepted: learnedAccount.suggestedAccountId === learnedAccount.id,
        reason: learnedAccount.suggestedAccountId === learnedAccount.id
          ? "User approved the suggested company account."
          : "User selected a different company account during reconciliation.",
        suggestion_source: learnedAccount.suggestionSource,
      });
    }

    return { label: recordNumber, applied: 0, updateData };
  });
}
