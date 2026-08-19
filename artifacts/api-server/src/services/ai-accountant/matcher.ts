/**
 * AI Accountant — deterministic matching engine.
 *
 * Extracted from the original suggestTransactionMatches implementation so the
 * /api/functions handler and the /api/ai endpoints share one matcher. All
 * money arithmetic is done in integer pence. This module performs NO writes
 * and NO AI calls — it is a pure scoring/classification engine.
 */
import type {
  bankTransactionsTable,
  salesInvoicesTable,
  purchaseBillsTable,
  salesCreditNotesTable,
  supplierCreditNotesTable,
} from "@workspace/db/schema";

export type BankTxn = typeof bankTransactionsTable.$inferSelect;

export interface CompanyRecords {
  invoices: (typeof salesInvoicesTable.$inferSelect)[];
  bills: (typeof purchaseBillsTable.$inferSelect)[];
  salesCNs: (typeof salesCreditNotesTable.$inferSelect)[];
  supplierCNs: (typeof supplierCreditNotesTable.$inferSelect)[];
}

export interface MatchSuggestion {
  record_type: string;
  record_id: string;
  record_number: string | null;
  record_name: string | null;
  record_amount: number;
  record_date: string | null;
  confidence: number;
  reasons: string[];
}

export type ReconScenario = "exact" | "combination" | "overpayment" | "partial" | "no_match";

export interface Reconciliation {
  transaction_amount: number;
  matched_records: MatchSuggestion[];
  matched_total: number;
  remaining: number;
  potential_matches: MatchSuggestion[];
  confidence: number;
  status: "green" | "amber" | "red";
  scenario: ReconScenario;
  possible_explanations: string[];
  recommendation: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const toPence = (n: number) => Math.round(n * 100);
const gbp = (n: number) =>
  `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Score all candidate records against one bank transaction. */
export function scoreTransaction(txn: BankTxn, records: CompanyRecords): MatchSuggestion[] {
  const txnAmount = Number(txn.money_in || 0) + Number(txn.money_out || 0);
  const txnDate = txn.date ? new Date(txn.date) : null;
  const txnDesc = (txn.description || "").toLowerCase();
  const txnRef = (txn.reference || "").toLowerCase();

  const suggestions: MatchSuggestion[] = [];

  const scoreMatch = (
    recordId: string,
    recordType: string,
    recordNumber: string | null,
    recordDate: string | null,
    recordAmount: number,
    recordName: string | null,
  ) => {
    const reasons: string[] = [];
    let confidence = 0;

    // 1. Exact amount match
    if (Math.abs(txnAmount - recordAmount) < 0.01) {
      reasons.push("Exact amount match");
      confidence += 40;
    } else if (Math.abs(txnAmount - recordAmount) / Math.max(txnAmount, 0.01) < 0.05) {
      reasons.push("Amount within 5%");
      confidence += 15;
    }

    // 2. Party name found in description or reference
    if (recordName && recordName.length > 2) {
      const nameLower = recordName.toLowerCase();
      if (txnDesc.includes(nameLower) || txnRef.includes(nameLower)) {
        reasons.push("Name found in description");
        confidence += 25;
      }
    }

    // 3. Record number found in description or reference
    if (recordNumber) {
      const numLower = recordNumber.toLowerCase();
      if (txnDesc.includes(numLower) || txnRef.includes(numLower)) {
        reasons.push("Reference number found in description");
        confidence += 25;
      }
    }

    // 4. Date within 14 days
    if (recordDate && txnDate) {
      const rDate = new Date(recordDate);
      const dayDiff = Math.abs(txnDate.getTime() - rDate.getTime()) / DAY_MS;
      if (dayDiff <= 14) {
        reasons.push(`Date within ${Math.round(dayDiff)} day${Math.round(dayDiff) === 1 ? "" : "s"}`);
        confidence += 10;
      }
    }

    if (reasons.length > 0) {
      suggestions.push({
        record_type: recordType,
        record_id: recordId,
        record_number: recordNumber,
        record_name: recordName,
        record_amount: recordAmount,
        record_date: recordDate,
        confidence: Math.min(confidence, 100),
        reasons,
      });
    }
  };

  // Sales invoices → money in
  if (Number(txn.money_in || 0) > 0) {
    for (const inv of records.invoices) {
      if (inv.status === "cancelled" || inv.status === "paid") continue;
      scoreMatch(
        inv.id, "sales_invoice", inv.invoice_number, inv.issue_date,
        Number(inv.balance_due || inv.total || 0), inv.customer_name,
      );
    }
    // Supplier credit notes → money in (refunds from suppliers)
    for (const cn of records.supplierCNs) {
      if (cn.status === "cancelled" || cn.is_applied) continue;
      scoreMatch(
        cn.id, "supplier_credit_note", cn.credit_note_number, cn.credit_note_date,
        Number(cn.total || 0), cn.supplier_name,
      );
    }
  }

  // Purchase bills → money out
  if (Number(txn.money_out || 0) > 0) {
    for (const bill of records.bills) {
      if (bill.status === "cancelled" || bill.status === "paid") continue;
      scoreMatch(
        bill.id, "purchase_bill", bill.bill_number, bill.bill_date,
        Number(bill.balance_due || bill.total || 0), bill.supplier_name,
      );
    }
    // Sales credit notes → money out (refunds to customers)
    for (const cn of records.salesCNs) {
      if (cn.status === "cancelled" || cn.is_applied) continue;
      scoreMatch(
        cn.id, "sales_credit_note", cn.credit_note_number, cn.credit_note_date,
        Number(cn.total || 0), cn.customer_name,
      );
    }
  }

  suggestions.sort((a, b) => b.confidence - a.confidence);
  return suggestions;
}

/**
 * Build the reconciliation summary for one transaction from its scored
 * suggestions: exact one-to-many combination search, greedy partial fill,
 * traffic-light status, scenario classification, and deterministic
 * accountant-style explanations. Returns null when the transaction has no
 * monetary amount.
 */
export function buildReconciliation(txn: BankTxn, suggestions: MatchSuggestion[]): Reconciliation | null {
  const txnAmount = Number(txn.money_in || 0) + Number(txn.money_out || 0);
  if (txnAmount <= 0) return null;

  const isMoneyIn = Number(txn.money_in || 0) > 0;
  const comboType = isMoneyIn ? "sales_invoice" : "purchase_bill";
  const txnPence = toPence(txnAmount);

  const candidates = suggestions
    .filter((s) => s.record_type === comboType)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 20)
    .map((s) => ({ ...s, pence: toPence(s.record_amount) }));

  type Cand = (typeof candidates)[number];
  const MAX_COMBO = 5;
  const findCombo = (startIdx: number, remaining: number, picked: Cand[]): Cand[] | null => {
    if (remaining === 0 && picked.length > 0) return picked;
    if (remaining < 0 || picked.length >= MAX_COMBO) return null;
    for (let i = startIdx; i < candidates.length; i++) {
      const c = candidates[i]!;
      if (c.pence > remaining) continue;
      const found = findCombo(i + 1, remaining - c.pence, [...picked, c]);
      if (found) return found;
    }
    return null;
  };
  const combo = findCombo(0, txnPence, []);

  let matched: Cand[] = [];
  let potential: Cand[] = [];
  let status: "green" | "amber" | "red";
  let overallConfidence = 0;

  if (combo) {
    matched = combo;
    const avgSignal = combo.reduce((s, c) => s + c.confidence, 0) / combo.length;
    overallConfidence = Math.min(100, Math.round(
      70 + Math.min(avgSignal, 100) * 0.3 - (combo.length - 1) * 5,
    ));
    status = "green";
    potential = candidates.filter(
      (s) => s.confidence >= 50 && !combo.some((m) => m.record_id === s.record_id),
    );
  } else {
    // Partial: greedily take high-confidence records that fit within the bank
    // amount, then surface the rest as potential matches.
    let runningPence = 0;
    for (const c of candidates) {
      if (c.confidence >= 70 && c.pence <= txnPence - runningPence) {
        matched.push(c);
        runningPence += c.pence;
      }
    }
    potential = candidates.filter(
      (s) => s.confidence >= 50 && !matched.some((m) => m.record_id === s.record_id),
    );
    overallConfidence = matched.length
      ? Math.round(matched.reduce((s, c) => s + c.confidence, 0) / matched.length)
      : (potential[0] ? Math.round(potential[0].confidence) : 0);
    status = matched.length > 0 || potential.length > 0 ? "amber" : "red";
  }

  const matchedPence = matched.reduce((s, c) => s + c.pence, 0);
  const remainingPence = Math.max(0, txnPence - matchedPence);
  const remaining = remainingPence / 100;

  // ── scenario classification ────────────────────────────────────────────────
  let scenario: ReconScenario;
  if (combo) {
    scenario = combo.length === 1 ? "exact" : "combination";
  } else if (matched.length === 1 && remainingPence > 0 && remainingPence <= txnPence * 0.25) {
    // One strong match covering most of the money → likely overpayment.
    scenario = "overpayment";
  } else if (matched.length > 0) {
    scenario = "partial";
  } else {
    scenario = "no_match";
  }

  // ── deterministic accountant explanations (approval-only: suggestions, never actions) ──
  const party = matched[0]?.record_name || potential[0]?.record_name || null;
  const partyLabel = party ? ` from ${party}` : "";
  let possible_explanations: string[] = [];
  let recommendation: string;

  switch (scenario) {
    case "exact":
      possible_explanations = [];
      recommendation = `Payment matches ${matched[0]!.record_number} exactly — review and approve the match.`;
      break;
    case "combination":
      possible_explanations = [];
      recommendation = `The bank amount equals ${matched.length} outstanding ${isMoneyIn ? "invoices" : "bills"} combined — review and approve all ${matched.length} together.`;
      break;
    case "overpayment":
      possible_explanations = isMoneyIn
        ? [
            `Possible overpayment of ${gbp(remaining)}${partyLabel} — a credit may be owed back`,
            "Deposit or advance payment on a future invoice",
            "Rounding or bank fee difference on the payment",
          ]
        : [
            `Possible overpayment of ${gbp(remaining)} to the supplier — a credit note may be due`,
            "Prepayment or deposit on a future bill",
            "Bank charge included in the payment",
          ];
      recommendation = `Match ${matched[0]!.record_number} and investigate the remaining ${gbp(remaining)} before approving — it may need a credit or a new ${isMoneyIn ? "invoice" : "bill"}.`;
      break;
    case "partial":
      possible_explanations = isMoneyIn
        ? [
            `An invoice may be missing for the remaining ${gbp(remaining)}`,
            "Deposit or advance payment received ahead of invoicing",
            "Part payment covering several invoices",
          ]
        : [
            `A bill may be missing for the remaining ${gbp(remaining)}`,
            "Prepayment made ahead of receiving the bill",
            "Combined payment covering several bills",
          ];
      recommendation = `${gbp(matchedPence / 100)} is accounted for; identify the remaining ${gbp(remaining)} before approving.`;
      break;
    default:
      possible_explanations = isMoneyIn
        ? [
            "No matching invoice found — one may need to be raised",
            "Could be other income (interest, refund, or grant)",
            "May be a transfer between your own accounts",
          ]
        : [
            "No matching bill found — one may need to be recorded",
            "Could be a direct expense to categorise",
            "May be a transfer between your own accounts",
          ];
      recommendation = isMoneyIn
        ? "Investigate this receipt — create the missing invoice or categorise it as other income."
        : "Investigate this payment — record the missing bill or categorise the expense.";
  }

  const strip = (c: Cand): MatchSuggestion => {
    const { pence: _p, ...rest } = c;
    return rest;
  };

  return {
    transaction_amount: txnPence / 100,
    matched_records: matched.map(strip),
    matched_total: matchedPence / 100,
    remaining,
    potential_matches: potential.slice(0, 5).map(strip),
    confidence: overallConfidence,
    status,
    scenario,
    possible_explanations,
    recommendation,
  };
}
