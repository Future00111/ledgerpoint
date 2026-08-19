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
  aiReconciliationResultsTable,
  salesInvoicesTable,
  purchaseBillsTable,
  salesCreditNotesTable,
  supplierCreditNotesTable,
} from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { aiService } from "../ai/index.js";
import {
  scoreTransaction,
  buildReconciliation,
  type BankTxn,
  type MatchSuggestion,
  type Reconciliation,
} from "./matcher.js";
import { categoriseByRules, type CategorySuggestion } from "./categorise.js";

export interface AnalysisOutput {
  suggestions: Record<string, MatchSuggestion[]>;
  reconciliation: Record<string, Reconciliation>;
  categorisation: Record<string, CategorySuggestion>;
}

/** Load all matchable records for a company in parallel. */
export async function loadCompanyRecords(companyId: string) {
  const [invoices, bills, salesCNs, supplierCNs] = await Promise.all([
    db.select().from(salesInvoicesTable).where(eq(salesInvoicesTable.company_id, companyId)),
    db.select().from(purchaseBillsTable).where(eq(purchaseBillsTable.company_id, companyId)),
    db.select().from(salesCreditNotesTable).where(eq(salesCreditNotesTable.company_id, companyId)),
    db.select().from(supplierCreditNotesTable).where(eq(supplierCreditNotesTable.company_id, companyId)),
  ]);
  return { invoices, bills, salesCNs, supplierCNs };
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

  if (txns.length === 0) return { suggestions, reconciliation, categorisation };

  const records = await loadCompanyRecords(companyId);
  const rows: (typeof aiReconciliationResultsTable.$inferInsert)[] = [];

  for (const txn of txns) {
    const scored = scoreTransaction(txn, records);
    const strong = scored.filter((s) => s.confidence >= 50);
    if (strong.length > 0) suggestions[txn.id] = strong;

    const recon = buildReconciliation(txn, scored);
    if (!recon) continue;
    reconciliation[txn.id] = recon;

    // Categorisation only matters when there's nothing to match against.
    let cat: CategorySuggestion | null = null;
    if (recon.scenario === "no_match") {
      cat = categoriseByRules(txn);
      if (cat) categorisation[txn.id] = cat;
    }

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
      confidence: recon.confidence,
      transaction_amount: recon.transaction_amount.toFixed(2),
      matched_total: recon.matched_total.toFixed(2),
      remaining: recon.remaining.toFixed(2),
      matched_records: recon.matched_records as unknown as Record<string, unknown>[],
      potential_matches: recon.potential_matches as unknown as Record<string, unknown>[],
      possible_explanations: recon.possible_explanations,
      explanation,
      recommendation: recon.recommendation,
      category_suggestion: cat?.category ?? null,
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
        await tx.insert(aiReconciliationResultsTable).values(rows);
      });
    } catch (err) {
      // Persistence is an enhancement on top of the live analysis. If it
      // fails (e.g. the ai_reconciliation_results table has not yet been
      // applied to this environment via Replit's publish flow), the caller
      // still gets full suggestions/reconciliation — log loudly, don't 500.
      console.error("[ai-accountant] failed to persist analysis (schema up to date?):", err);
    }
  }

  return { suggestions, reconciliation, categorisation };
}
