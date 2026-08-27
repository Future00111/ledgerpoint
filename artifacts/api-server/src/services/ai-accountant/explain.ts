/**
 * AI Accountant Phase 2 — "Explain this" for bank transactions.
 *
 * Builds a transparent breakdown of what the AI concluded about a
 * transaction and WHY: the data points considered, matching factors,
 * and confidence reasoning. Deterministic; uses the persisted analysis
 * when present and falls back to running the matcher live.
 */
import { db } from "@workspace/db";
import {
  bankTransactionsTable,
  aiReconciliationResultsTable,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { loadCompanyRecords } from "./analysis.js";
import { scoreTransaction, buildReconciliation } from "./matcher.js";
import { categoriseByRules } from "./categorise.js";

export interface ExplainFactor {
  label: string;
  value: string;
  weight: "strong" | "moderate" | "weak";
}

export interface Explanation {
  transaction: {
    id: string;
    date: string | null;
    description: string | null;
    reference: string | null;
    money_in: number;
    money_out: number;
    status: string | null;
  };
  verdict: {
    status: string;
    scenario: string | null;
    confidence: number;
    summary: string;
    recommendation: string | null;
  };
  factors: ExplainFactor[];
  matched_records: Record<string, unknown>[];
  data_points_considered: string[];
  source: "persisted" | "live";
}

export async function explainTransaction(bankTransactionId: string): Promise<Explanation | null> {
  const [txn] = await db
    .select().from(bankTransactionsTable)
    .where(eq(bankTransactionsTable.id, bankTransactionId)).limit(1);
  if (!txn) return null;

  // Prefer the persisted analysis (what the user actually saw).
  const [persisted] = await db
    .select().from(aiReconciliationResultsTable)
    .where(
      and(
        eq(aiReconciliationResultsTable.company_id, txn.company_id),
        eq(aiReconciliationResultsTable.bank_transaction_id, txn.id),
      ),
    )
    .orderBy(desc(aiReconciliationResultsTable.created_at))
    .limit(1);

  let status: string, scenario: string | null, confidence: number;
  let summary: string, recommendation: string | null;
  let matchedRecords: Record<string, unknown>[] = [];
  let source: "persisted" | "live";

  if (persisted) {
    status = persisted.status ?? "red";
    scenario = persisted.scenario;
    confidence = persisted.confidence ?? 0;
    summary = persisted.explanation ?? "No explanation was stored for this analysis.";
    recommendation = persisted.recommendation;
    matchedRecords = persisted.matched_records ?? [];
    source = "persisted";
  } else {
    const records = await loadCompanyRecords(txn.company_id);
    const suggestions = scoreTransaction(txn, records);
    const recon = buildReconciliation(txn, suggestions);
    status = recon?.status ?? "red";
    scenario = recon?.scenario ?? "no_match";
    confidence = recon?.confidence ?? 0;
    summary = recon?.possible_explanations?.[0] ?? "No invoices or bills were found that plausibly match this transaction.";
    recommendation = recon?.recommendation ?? null;
    matchedRecords = (recon?.matched_records ?? []) as unknown as Record<string, unknown>[];
    source = "live";
  }

  // Deterministic matching factors from the transaction itself.
  const factors: ExplainFactor[] = [];
  const amount = Number(txn.money_in || 0) || Number(txn.money_out || 0);
  factors.push({
    label: "Amount",
    value: `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })} ${Number(txn.money_in || 0) > 0 ? "received" : "paid out"}`,
    weight: "strong",
  });
  if (txn.reference) {
    factors.push({ label: "Bank reference", value: `"${txn.reference}" — compared against invoice and bill numbers`, weight: "strong" });
  }
  if (txn.description) {
    factors.push({ label: "Description", value: `"${txn.description}" — compared against customer and supplier names`, weight: "moderate" });
  }
  if (txn.date) {
    factors.push({ label: "Date", value: `${txn.date} — proximity to invoice/bill dates and due dates`, weight: "moderate" });
  }
  if (matchedRecords.length > 1) {
    factors.push({ label: "Combination", value: `${matchedRecords.length} documents together explain the amount`, weight: "moderate" });
  }
  const category = categoriseByRules(txn);
  if (category) {
    factors.push({ label: "Category pattern", value: `Description matches the "${category.category}" rule (${category.confidence}% confidence)`, weight: "weak" });
  }

  return {
    transaction: {
      id: txn.id,
      date: txn.date,
      description: txn.description,
      reference: txn.reference,
      money_in: Number(txn.money_in || 0),
      money_out: Number(txn.money_out || 0),
      status: txn.status,
    },
    verdict: { status, scenario, confidence, summary, recommendation },
    factors,
    matched_records: matchedRecords,
    data_points_considered: [
      "Open sales invoices and their balances",
      "Open purchase bills and their balances",
      "Customer and supplier names",
      "Invoice / bill numbers vs the bank reference",
      "Transaction date vs document dates",
      "Historic categorisation rules",
    ],
    source,
  };
}
