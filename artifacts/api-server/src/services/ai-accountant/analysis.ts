/**
 * AI Accountant — analysis orchestration + persistence.
 *
 * Runs the deterministic matcher over review transactions, classifies each
 * scenario, attaches categorisation suggestions for unmatched items, and
 * persists everything to ai_reconciliation_results. Persisted analysis is
 * deliberately separate from the bank transaction's final linkage fields so
 * history survives approval and re-runs are safe.
 *
 * AI usage: an optional single explanation call for single-transaction mode.
 * The model only ever produces text — it never decides or performs mutations.
 */
import { db } from "@workspace/db";
import {
  aiDecisionAuditsTable,
  aiReconciliationResultsTable,
  accountLearningsTable,
  bankTransactionsTable,
  chartOfAccountsTable,
  salesInvoicesTable,
  purchaseBillsTable,
  salesCreditNotesTable,
  supplierCreditNotesTable,
} from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { aiService } from "../ai/index.js";
import { logger } from "../../lib/logger.js";
import {
  scoreTransaction,
  buildReconciliation,
  type BankTxn,
  type MatchSuggestion,
  type Reconciliation,
} from "./matcher.js";
import { suggestNominalAccount, type CategorySuggestion } from "./categorise.js";
import { getVATTransactionReview } from "./vat.js";

export interface AnalysisOutput {
  suggestions: Record<string, MatchSuggestion[]>;
  reconciliation: Record<string, Reconciliation>;
  categorisation: Record<string, CategorySuggestion>;
  decisions: Record<string, {
    state: string;
    priority_score: number;
    priority_band: "high" | "medium" | "low";
    duplicate_flag: boolean;
    recurring_flag: boolean;
    transfer_flag: boolean;
    related_transaction_id: string | null;
    vat_review_required: boolean;
    vat_treatment: string;
    signals: string[];
  }>;
  summary: {
    analysed: number;
    ready: number;
    review_required: number;
    no_match: number;
    partial_match: number;
    multi_match: number;
    duplicates: number;
    transfers: number;
    vat_review: number;
    unexplained_receipts: number;
    potential_invoice_value: number;
    attention_required: number;
  };
}

/** Load all matchable records for a company in parallel. */
export async function loadCompanyRecords(companyId: string) {
  const [invoices, bills, salesCNs, supplierCNs, accounts, bankTransactions, accountLearnings] = await Promise.all([
    db.select().from(salesInvoicesTable).where(eq(salesInvoicesTable.company_id, companyId)),
    db.select().from(purchaseBillsTable).where(eq(purchaseBillsTable.company_id, companyId)),
    db.select().from(salesCreditNotesTable).where(eq(salesCreditNotesTable.company_id, companyId)),
    db.select().from(supplierCreditNotesTable).where(eq(supplierCreditNotesTable.company_id, companyId)),
    db.select().from(chartOfAccountsTable).where(eq(chartOfAccountsTable.company_id, companyId)),
    db.select().from(bankTransactionsTable).where(eq(bankTransactionsTable.company_id, companyId)),
    db.select().from(accountLearningsTable).where(eq(accountLearningsTable.company_id, companyId)),
  ]);
  return { invoices, bills, salesCNs, supplierCNs, accounts, bankTransactions, accountLearnings };
}

const pence = (value: unknown) => Math.round(Number(value || 0) * 100);
const normalise = (value: string | null | undefined) =>
  (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function detectPossibleDuplicate(txn: BankTxn, companyTransactions: (typeof bankTransactionsTable.$inferSelect)[]) {
  const amount = pence(Number(txn.money_in || 0) || Number(txn.money_out || 0));
  const directionIsIn = pence(txn.money_in) > 0;
  if (!txn.date || amount <= 0) return false;
  const description = normalise(txn.description);
  if (!description) return false;
  return companyTransactions.some((other) => {
    if (other.id === txn.id || !other.date) return false;
    const otherAmount = pence(directionIsIn ? other.money_in : other.money_out);
    if (otherAmount !== amount) return false;
    const otherDescription = normalise(other.description);
    if (!otherDescription || (otherDescription !== description && !otherDescription.includes(description) && !description.includes(otherDescription))) return false;
    const days = Math.abs(new Date(other.date).getTime() - new Date(txn.date!).getTime()) / 86_400_000;
    return days <= 5;
  });
}

export function detectRecurringTransaction(txn: BankTxn, companyTransactions: (typeof bankTransactionsTable.$inferSelect)[]) {
  const amount = pence(Number(txn.money_in || 0) || Number(txn.money_out || 0));
  const directionIsIn = pence(txn.money_in) > 0;
  const description = normalise(txn.description);
  if (amount <= 0 || !description) return { recurring: false, previousCount: 0, typicalAmount: null as number | null };
  const previous = companyTransactions.filter((other) => {
    if (other.id === txn.id || other.status !== "matched" || !other.date) return false;
    const otherDescription = normalise(other.description);
    if (!otherDescription || (otherDescription !== description && !otherDescription.includes(description) && !description.includes(otherDescription))) return false;
    const otherAmount = pence(directionIsIn ? other.money_in : other.money_out);
    return otherAmount > 0 && Math.abs(otherAmount - amount) <= Math.max(50, Math.round(amount * 0.08));
  });
  if (previous.length < 2) return { recurring: false, previousCount: previous.length, typicalAmount: null as number | null };
  const amounts = previous.map((other) => pence(directionIsIn ? other.money_in : other.money_out)).sort((a, b) => a - b);
  return { recurring: true, previousCount: previous.length, typicalAmount: (amounts[Math.floor(amounts.length / 2)] ?? amount) / 100 };
}

export function detectInternalTransfer(txn: BankTxn, companyTransactions: (typeof bankTransactionsTable.$inferSelect)[]) {
  const amount = pence(Number(txn.money_in || 0) || Number(txn.money_out || 0));
  const directionIsIn = pence(txn.money_in) > 0;
  if (amount <= 0 || !txn.date || !txn.bank_account_id) return null;
  return companyTransactions.find((other) => {
    if (other.id === txn.id || !other.date || !other.bank_account_id || other.bank_account_id === txn.bank_account_id) return false;
    const otherAmount = pence(directionIsIn ? other.money_out : other.money_in);
    if (otherAmount !== amount) return false;
    const days = Math.abs(new Date(other.date).getTime() - new Date(txn.date!).getTime()) / 86_400_000;
    return days <= 3;
  }) ?? null;
}

export function deriveDecision(
  recon: Reconciliation,
  duplicate: boolean,
  vatReviewRequired: boolean,
  flags: { transfer?: boolean } = {},
): { state: string; priority: number; band: "high" | "medium" | "low"; signals: string[] } {
  const signals = [...recon.possible_explanations];
  let state = "REVIEW_REQUIRED";
  let priority = 55;
  if (recon.scenario === "no_match") { state = "NO_MATCH"; priority = 70; }
  if (recon.scenario === "partial") { state = "PARTIAL_MATCH"; priority = 75; }
  if (recon.scenario === "combination") { state = "MULTI_MATCH"; priority = 60; }
  if (recon.scenario === "exact" && recon.confidence >= 90) { state = "READY"; priority = 25; }
  if (flags.transfer) { state = "TRANSFER"; priority = 65; signals.push("An equal and opposite transaction was found in another company bank account."); }
  if (duplicate) { state = "POSSIBLE_DUPLICATE"; priority = 95; signals.push("A nearby transaction has the same direction, amount, and similar description."); }
  if (vatReviewRequired) { state = "VAT_REVIEW"; priority = Math.max(priority, 80); signals.push("The transaction carries an unusual VAT rate and needs tax treatment review."); }
  return { state, priority, band: priority >= 80 ? "high" : priority >= 50 ? "medium" : "low", signals: signals.slice(0, 8) };
}

/**
 * Analyse a set of review transactions (all belonging to one company).
 * Returns the same suggestions/reconciliation shape the frontend already
 * consumes, plus categorisation suggestions, and persists results.
 */
export async function analyseTransactions(
  companyId: string,
  txns: BankTxn[],
  opts: { persist?: boolean; aiExplanation?: boolean } = {},
): Promise<AnalysisOutput> {
  const { persist = true, aiExplanation = false } = opts;
  const suggestions: Record<string, MatchSuggestion[]> = {};
  const reconciliation: Record<string, Reconciliation> = {};
  const categorisation: Record<string, CategorySuggestion> = {};
  const decisions: AnalysisOutput["decisions"] = {};

  const emptySummary: AnalysisOutput["summary"] = {
    analysed: 0, ready: 0, review_required: 0, no_match: 0, partial_match: 0, multi_match: 0,
    duplicates: 0, transfers: 0, vat_review: 0, unexplained_receipts: 0, potential_invoice_value: 0, attention_required: 0,
  };
  if (txns.length === 0) return { suggestions, reconciliation, categorisation, decisions, summary: emptySummary };

  const records = await loadCompanyRecords(companyId);
  const rows: (typeof aiReconciliationResultsTable.$inferInsert)[] = [];
  const analysisRunId = `phase6-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  for (const txn of txns) {
    const scored = scoreTransaction(txn, records);
    const strong = scored.filter((s) => s.confidence >= 50);
    if (strong.length > 0) suggestions[txn.id] = strong;

    const recon = buildReconciliation(txn, scored);
    if (!recon) continue;
    reconciliation[txn.id] = recon;

    // Categorisation only matters when there's nothing to match against.
    let cat: CategorySuggestion | null = null;
    const relatedTransfer = detectInternalTransfer(txn, records.bankTransactions);
    const recurring = detectRecurringTransaction(txn, records.bankTransactions);
    if (recon.scenario === "no_match" && !relatedTransfer) {
      cat = suggestNominalAccount(txn, records.accounts, records.accountLearnings);
      if (cat) categorisation[txn.id] = cat;
    }
    const duplicate = detectPossibleDuplicate(txn, records.bankTransactions);
    const vatReview = relatedTransfer
      ? { treatment: "not_applicable", review_required: false, rate: null, detail: "Likely internal transfer: it is not treated as income, expense, or a VAT return source." }
      : await getVATTransactionReview(companyId, txn, recon.matched_records);
    const vatReviewRequired = vatReview.review_required;
    const decision = deriveDecision(recon, duplicate, vatReviewRequired, { transfer: Boolean(relatedTransfer) });
    if (recurring.recurring) {
      decision.signals.push(`Recurring transaction pattern: ${recurring.previousCount} previous approved transactions, typically £${recurring.typicalAmount?.toFixed(2)}.`);
    }
    decision.signals.push(vatReview.detail);
    decisions[txn.id] = {
      state: decision.state,
      priority_score: decision.priority,
      priority_band: decision.band,
      duplicate_flag: duplicate,
      recurring_flag: recurring.recurring,
      transfer_flag: Boolean(relatedTransfer),
      related_transaction_id: relatedTransfer?.id ?? null,
      vat_review_required: vatReviewRequired,
      vat_treatment: vatReview.treatment,
      signals: decision.signals,
    };

    // Optional AI explanation (single-transaction mode only, text-only output).
    let explanation: string | null = null;
    let aiProvider: string | null = null;
    let aiModel: string | null = null;
    if (aiExplanation && txns.length === 1) {
      try {
        const result = await aiService.complete({
          messages: [
            {
              role: "system",
              content:
                "You are a UK accountant reviewing a bank reconciliation. In 1-2 plain-English sentences, " +
                "explain the analysis result to a business owner. Do not recommend any automatic action; " +
                "the user decides what to approve.",
            },
            {
              role: "user",
              content: JSON.stringify({
                transaction: {
                  description: txn.description,
                  reference: txn.reference,
                  date: txn.date,
                  amount: recon.transaction_amount,
                  direction: Number(txn.money_in || 0) > 0 ? "money_in" : "money_out",
                },
                scenario: recon.scenario,
                status: recon.status,
                matched_total: recon.matched_total,
                remaining: recon.remaining,
                matched_records: recon.matched_records.map((m) => ({
                  number: m.record_number, name: m.record_name, amount: m.record_amount,
                })),
              }),
            },
          ],
          maxTokens: 200,
          temperature: 0.3,
        });
        explanation = result.text.trim();
        aiProvider = result.provider;
        aiModel = result.model;
      } catch {
        explanation = null; // degrade to deterministic recommendation
      }
    }

    rows.push({
      company_id: companyId,
      bank_transaction_id: txn.id,
      status: recon.status,
      scenario: recon.scenario,
      decision_state: decision.state,
      confidence: recon.confidence,
      priority_score: decision.priority,
      priority_band: decision.band,
      duplicate_flag: duplicate,
      recurring_flag: recurring.recurring,
      transfer_flag: Boolean(relatedTransfer),
      related_transaction_id: relatedTransfer?.id ?? null,
      vat_review_required: vatReviewRequired,
      vat_treatment: vatReview.treatment,
      analysis_version: "phase6-v1",
      analysis_run_id: analysisRunId,
      analysis_batch_id: txns.length > 1 ? analysisRunId : null,
      deterministic_signals: decision.signals,
      transaction_amount: recon.transaction_amount.toFixed(2),
      matched_total: recon.matched_total.toFixed(2),
      remaining: recon.remaining.toFixed(2),
      matched_records: recon.matched_records as unknown as Record<string, unknown>[],
      potential_matches: recon.potential_matches as unknown as Record<string, unknown>[],
      possible_explanations: recon.possible_explanations,
      explanation: explanation || recon.possible_explanations[0] || null,
      recommendation: recon.recommendation,
      category_suggestion: cat?.category ?? null,
      category_account_id: cat?.account_id ?? null,
      category_account_code: cat?.account_code ?? null,
      category_account_name: cat?.account_name ?? null,
      category_confidence: cat?.confidence ?? null,
      ai_provider: aiProvider,
      ai_model: aiModel,
      approval_state: "pending",
    });
  }

  if (persist && rows.length > 0) {
    const txnIds = rows.map((r) => r.bank_transaction_id);
    try {
      await db.transaction(async (tx) => {
        // Replace previous PENDING analysis; approved history is preserved.
        await tx
          .delete(aiReconciliationResultsTable)
          .where(
            and(
              eq(aiReconciliationResultsTable.company_id, companyId),
              inArray(aiReconciliationResultsTable.bank_transaction_id, txnIds),
              eq(aiReconciliationResultsTable.approval_state, "pending"),
            ),
          );
        const created = await tx.insert(aiReconciliationResultsTable).values(rows).returning();
        await tx.insert(aiDecisionAuditsTable).values(created.map((result) => ({
          company_id: companyId,
          bank_transaction_id: result.bank_transaction_id,
          analysis_id: result.id,
          event_type: "analysed",
          decision_source: "deterministic",
          confidence: result.confidence,
          previous_state: "UNANALYSED",
          new_state: result.decision_state,
          evidence: {
            scenario: result.scenario,
            signals: result.deterministic_signals,
            potential_matches: result.potential_matches,
            duplicate_flag: result.duplicate_flag,
            recurring_flag: result.recurring_flag,
            transfer_flag: result.transfer_flag,
            related_transaction_id: result.related_transaction_id,
            vat_review_required: result.vat_review_required,
            analysis_run_id: analysisRunId,
          },
          provider: result.ai_provider,
          model: result.ai_model,
        })));
      });
    } catch (err) {
      // Persistence is an enhancement on top of the live analysis. If it
      // fails (e.g. the ai_reconciliation_results table has not yet been
      // applied to this environment via Replit's publish flow), the caller
      // still gets full suggestions/reconciliation — log loudly, don't 500.
      logger.error({ err, company_id: companyId }, "AI reconciliation analysis could not be persisted");
    }
  }

  const summary = Object.entries(decisions).reduce((current, [transactionId, decision]) => {
    const recon = reconciliation[transactionId];
    const txn = txns.find((candidate) => candidate.id === transactionId);
    current.analysed += 1;
    if (decision.state === "READY") current.ready += 1;
    else current.review_required += 1;
    if (decision.state === "NO_MATCH") current.no_match += 1;
    if (decision.state === "PARTIAL_MATCH") current.partial_match += 1;
    if (decision.state === "MULTI_MATCH") current.multi_match += 1;
    if (decision.duplicate_flag) current.duplicates += 1;
    if (decision.transfer_flag) current.transfers += 1;
    if (decision.vat_review_required) current.vat_review += 1;
    if (txn && pence(txn.money_in) > 0) {
      current.unexplained_receipts += Math.max(0, recon?.remaining ?? 0);
      current.potential_invoice_value += recon?.matched_total ?? 0;
    }
    return current;
  }, { ...emptySummary });
  summary.attention_required = summary.analysed - summary.ready;
  return { suggestions, reconciliation, categorisation, decisions, summary };
}
