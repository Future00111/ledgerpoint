/**
 * AI Accountant Phase 2 — proactive issue detectors.
 *
 * Pure detection: each detector reads company data and returns findings
 * (never mutates accounting records). Findings carry a stable `dedupe_key`
 * so repeated runs update existing recommendations instead of duplicating.
 * All detectors are deterministic and work without the AI provider.
 */
import { db } from "@workspace/db";
import {
  bankTransactionsTable,
  salesInvoicesTable,
  purchaseBillsTable,
  aiReconciliationResultsTable,
} from "@workspace/db/schema";
import { eq, and, gte } from "drizzle-orm";

export type Domain = "revenue" | "expense" | "vat" | "debtor" | "creditor" | "cashflow";
export type Priority = "high" | "medium" | "low";

export interface Detection {
  dedupe_key: string;
  domain: Domain;
  kind: string;
  priority: Priority;
  title: string;
  detail: string;
  recommended_action: string;
  confidence: number; // 0-100
  amount?: number;
  evidence?: Record<string, unknown>;
  related_entity_type?: string;
  related_entity_id?: string;
  route?: string;
}

// All money maths in integer pence; convert at the boundary.
const pence = (v: unknown) => Math.round(Number(v || 0) * 100);
const pounds = (p: number) => Math.round(p) / 100;
const gbp = (p: number) =>
  `£${pounds(p).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

// Duplicate-payment scanning is bounded to recent activity so the run
// stays cheap even for multi-year bank feeds.
const DUPLICATE_WINDOW_DAYS = 180;

interface CompanyData {
  invoices: (typeof salesInvoicesTable.$inferSelect)[];
  bills: (typeof purchaseBillsTable.$inferSelect)[];
  reviewTxns: (typeof bankTransactionsTable.$inferSelect)[];
  recentTxns: (typeof bankTransactionsTable.$inferSelect)[];
  aiResults: (typeof aiReconciliationResultsTable.$inferSelect)[];
  todayISO: string;
}

async function loadData(companyId: string): Promise<CompanyData> {
  const todayISO = new Date().toISOString().slice(0, 10);
  const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 86_400_000)
    .toISOString().slice(0, 10);
  const [invoices, bills, reviewTxns, recentTxns, aiResults] = await Promise.all([
    db.select().from(salesInvoicesTable).where(eq(salesInvoicesTable.company_id, companyId)),
    db.select().from(purchaseBillsTable).where(eq(purchaseBillsTable.company_id, companyId)),
    db.select().from(bankTransactionsTable).where(
      and(eq(bankTransactionsTable.company_id, companyId), eq(bankTransactionsTable.status, "review")),
    ),
    db.select().from(bankTransactionsTable).where(
      and(eq(bankTransactionsTable.company_id, companyId), gte(bankTransactionsTable.date, windowStart)),
    ),
    db.select().from(aiReconciliationResultsTable).where(
      and(
        eq(aiReconciliationResultsTable.company_id, companyId),
        eq(aiReconciliationResultsTable.approval_state, "pending"),
      ),
    ),
  ]);
  return { invoices, bills, reviewTxns, recentTxns, aiResults, todayISO };
}

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);

// ── Detectors ────────────────────────────────────────────────────────────────

/** Money-in bank activity with no (or only partial) invoice coverage. */
function detectMissingInvoices(d: CompanyData): Detection[] {
  const review = d.reviewTxns.filter((t) => pence(t.money_in) > 0);
  if (review.length === 0) return [];
  const resultByTxn = new Map(d.aiResults.map((r) => [r.bank_transaction_id, r]));

  let unexplainedPence = 0;
  const items: Record<string, unknown>[] = [];
  for (const t of review) {
    const r = resultByTxn.get(t.id);
    const remaining = r ? pence(r.remaining) : pence(t.money_in);
    const scenario = r?.scenario ?? "unanalysed";
    if (remaining > 0 && scenario !== "overpayment") {
      unexplainedPence += remaining;
      items.push({ transaction_id: t.id, date: t.date, description: t.description, unexplained: pounds(remaining), scenario });
    }
  }
  if (items.length === 0) return [];
  return [{
    dedupe_key: "missing_invoices",
    domain: "revenue",
    kind: "missing_invoices",
    priority: "high",
    title: `${gbp(unexplainedPence)} of money received has no matching invoice`,
    detail: `${items.length} incoming bank transaction${items.length === 1 ? " has" : "s have"} income that cannot be fully matched to a sales invoice. This revenue may be uninvoiced, which affects both your debtor records and VAT position.`,
    recommended_action: "Review each receipt in Reconciliation. Raise an invoice for uninvoiced work, or match to the correct existing invoice before approving.",
    confidence: 90,
    amount: pounds(unexplainedPence),
    evidence: { transactions: items.slice(0, 20), total_transactions: items.length },
    route: "/reconciliation",
  }];
}

/** Money-out bank activity with no matching supplier bill. */
function detectMissingBills(d: CompanyData): Detection[] {
  const review = d.reviewTxns.filter((t) => pence(t.money_out) > 0);
  if (review.length === 0) return [];
  const resultByTxn = new Map(d.aiResults.map((r) => [r.bank_transaction_id, r]));

  let totalPence = 0;
  const items: Record<string, unknown>[] = [];
  for (const t of review) {
    const r = resultByTxn.get(t.id);
    const matched = r && (r.matched_records?.length ?? 0) > 0 && pence(r.remaining) <= 0;
    if (!matched) {
      totalPence += pence(t.money_out);
      items.push({ transaction_id: t.id, date: t.date, description: t.description, amount: pounds(pence(t.money_out)) });
    }
  }
  if (items.length === 0) return [];
  return [{
    dedupe_key: "missing_bills",
    domain: "expense",
    kind: "missing_bills",
    priority: "high",
    title: `${items.length} payment${items.length === 1 ? "" : "s"} (${gbp(totalPence)}) with no matching supplier bill`,
    detail: "Payments have left the bank without a corresponding purchase bill. Without a bill you may lose input VAT reclaim and your expense records will be incomplete.",
    recommended_action: "Enter the missing supplier bills (or attach receipts), then match each payment in Reconciliation.",
    confidence: 85,
    amount: pounds(totalPence),
    evidence: { transactions: items.slice(0, 20), total_transactions: items.length },
    route: "/reconciliation",
  }];
}

/** Possible duplicate outgoing payments: same amount, similar description, within 5 days.
 *  Bounded: recent window only, and pairs are compared within same-amount
 *  groups sorted by date, breaking once the 5-day window is exceeded. */
function detectDuplicatePayments(d: CompanyData): Detection[] {
  const detections: Detection[] = [];
  const norm = (s: string | null) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  // Group by exact amount first — duplicates must share an amount.
  const byAmount = new Map<number, (typeof d.recentTxns)[number][]>();
  for (const t of d.recentTxns) {
    if (pence(t.money_out) <= 0 || !t.date) continue;
    const key = pence(t.money_out);
    const arr = byAmount.get(key) || [];
    arr.push(t);
    byAmount.set(key, arr);
  }

  for (const group of byAmount.values()) {
    if (group.length < 2) continue;
    group.sort((x, y) => (x.date! < y.date! ? -1 : 1));
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]!, b = group[j]!;
        const gap = daysBetween(b.date!, a.date!);
        if (gap > 5) break; // sorted by date — later entries are further away
        const na = norm(a.description), nb = norm(b.description);
        if (!na || !nb) continue;
        if (na !== nb && !na.includes(nb) && !nb.includes(na)) continue;
      const key = `duplicate_payment:${[a.id, b.id].sort().join(":")}`;
      detections.push({
        dedupe_key: key,
        domain: "expense",
        kind: "duplicate_payment",
        priority: "high",
        title: `Possible duplicate payment of ${gbp(pence(a.money_out))} to "${a.description}"`,
        detail: `Two payments of ${gbp(pence(a.money_out))} with matching descriptions were made ${gap === 0 ? "on the same day" : `${gap} day${gap === 1 ? "" : "s"} apart`} (${a.date} and ${b.date}). One may be a duplicate.`,
        recommended_action: "Check with the supplier whether both payments were due. If one is a duplicate, request a refund or credit note.",
        confidence: gap <= 1 ? 80 : 65,
        amount: pounds(pence(a.money_out)),
        evidence: { transactions: [a, b].map((t) => ({ id: t.id, date: t.date, description: t.description, amount: pounds(pence(t.money_out)) })) },
        related_entity_type: "bank_transaction",
        related_entity_id: a.id,
        route: "/transactions",
      });
      }
    }
  }
  return detections.slice(0, 10);
}

/** Reconciled/paid expense activity with no category. */
function detectUncategorisedExpenses(d: CompanyData): Detection[] {
  const uncategorisedBills = d.bills.filter(
    (b) => b.status !== "draft" && b.status !== "cancelled" && !b.category,
  );
  if (uncategorisedBills.length === 0) return [];
  const total = uncategorisedBills.reduce((s, b) => s + pence(b.total), 0);
  return [{
    dedupe_key: "uncategorised_expenses",
    domain: "expense",
    kind: "uncategorised_expenses",
    priority: "medium",
    title: `${uncategorisedBills.length} bill${uncategorisedBills.length === 1 ? "" : "s"} (${gbp(total)}) with no expense category`,
    detail: "Uncategorised bills distort your profit & loss reporting and make VAT review harder.",
    recommended_action: "Assign a category to each bill. The Smart Suggestions engine can propose categories based on past behaviour.",
    confidence: 95,
    amount: pounds(total),
    evidence: { bills: uncategorisedBills.slice(0, 20).map((b) => ({ id: b.id, supplier: b.supplier_name, number: b.bill_number, total: b.total })) },
    route: "/bills",
  }];
}

/** VAT anomalies: zero VAT on standard documents, or unusual effective rates. */
function detectVatAnomalies(d: CompanyData): Detection[] {
  const UK_RATES = [0, 0.05, 0.2];
  const isNormalRate = (rate: number) => UK_RATES.some((r) => Math.abs(rate - r) < 0.005);
  const anomalies: Record<string, unknown>[] = [];

  const check = (docs: { id: string; label: string; number: string | null; subtotal: unknown; vat_total: unknown }[]) => {
    for (const doc of docs) {
      const sub = pence(doc.subtotal);
      if (sub <= 0) continue;
      const rate = pence(doc.vat_total) / sub;
      if (!isNormalRate(rate)) {
        anomalies.push({ type: doc.label, id: doc.id, number: doc.number, effective_rate: `${(rate * 100).toFixed(1)}%` });
      }
    }
  };
  check(d.invoices.filter((i) => i.status !== "draft" && i.status !== "cancelled")
    .map((i) => ({ id: i.id, label: "sales_invoice", number: i.invoice_number, subtotal: i.subtotal, vat_total: i.vat_total })));
  check(d.bills.filter((b) => b.status !== "draft" && b.status !== "cancelled")
    .map((b) => ({ id: b.id, label: "purchase_bill", number: b.bill_number, subtotal: b.subtotal, vat_total: b.vat_total })));

  if (anomalies.length === 0) return [];
  return [{
    dedupe_key: "vat_anomalies",
    domain: "vat",
    kind: "vat_anomalies",
    priority: "medium",
    title: `${anomalies.length} document${anomalies.length === 1 ? "" : "s"} with an unusual VAT rate`,
    detail: "These invoices or bills have an effective VAT rate that is not 0%, 5% or 20%. This is sometimes correct (mixed-rate line items) but often indicates a data-entry error that would flow into your VAT return.",
    recommended_action: "Open each document and confirm the VAT treatment of every line item before the next VAT return.",
    confidence: 70,
    evidence: { documents: anomalies.slice(0, 20), total: anomalies.length },
    route: "/vat",
  }];
}

/** Overdue sales invoices (debtors). */
function detectOverdueInvoices(d: CompanyData): Detection[] {
  const overdue = d.invoices.filter(
    (i) => i.status !== "cancelled" && i.status !== "paid" && pence(i.balance_due) > 0 && i.due_date && i.due_date < d.todayISO,
  );
  if (overdue.length === 0) return [];
  const total = overdue.reduce((s, i) => s + pence(i.balance_due), 0);
  const worst = overdue.reduce((m, i) => Math.max(m, daysBetween(d.todayISO, i.due_date!)), 0);
  return [{
    dedupe_key: "overdue_invoices",
    domain: "debtor",
    kind: "overdue_invoices",
    priority: "high",
    title: `${gbp(total)} owed to you is overdue across ${overdue.length} invoice${overdue.length === 1 ? "" : "s"}`,
    detail: `The oldest debt is ${worst} days past due. Late collections directly hurt cash flow, and older debts are progressively harder to recover.`,
    recommended_action: "Send payment reminders starting with the oldest invoices. Consider the Collections workflow for persistent late payers.",
    confidence: 100,
    amount: pounds(total),
    evidence: {
      invoices: overdue.slice(0, 20).map((i) => ({
        id: i.id, number: i.invoice_number, customer: i.customer_name,
        balance_due: i.balance_due, due_date: i.due_date, days_overdue: daysBetween(d.todayISO, i.due_date!),
      })),
      total_invoices: overdue.length,
    },
    route: "/collections",
  }];
}

/** Overdue purchase bills (creditors). */
function detectOverdueBills(d: CompanyData): Detection[] {
  const overdue = d.bills.filter(
    (b) => b.status !== "cancelled" && b.status !== "paid" && pence(b.balance_due) > 0 && b.due_date && b.due_date < d.todayISO,
  );
  if (overdue.length === 0) return [];
  const total = overdue.reduce((s, b) => s + pence(b.balance_due), 0);
  return [{
    dedupe_key: "overdue_bills",
    domain: "creditor",
    kind: "overdue_bills",
    priority: "medium",
    title: `${overdue.length} supplier bill${overdue.length === 1 ? "" : "s"} (${gbp(total)}) past the due date`,
    detail: "Unpaid overdue bills risk late-payment charges and strained supplier relationships.",
    recommended_action: "Schedule payment for overdue bills, or contact suppliers to agree revised terms.",
    confidence: 100,
    amount: pounds(total),
    evidence: {
      bills: overdue.slice(0, 20).map((b) => ({ id: b.id, number: b.bill_number, supplier: b.supplier_name, balance_due: b.balance_due, due_date: b.due_date })),
    },
    route: "/bills",
  }];
}

/** Customers who habitually pay late relative to their agreed terms. */
function detectPaymentBehaviour(d: CompanyData): Detection[] {
  const byCustomer = new Map<string, { name: string; overdue: number; totalPence: number; worstDays: number }>();
  for (const i of d.invoices) {
    if (i.status === "cancelled" || i.status === "paid") continue;
    if (pence(i.balance_due) <= 0 || !i.due_date || i.due_date >= d.todayISO) continue;
    const days = daysBetween(d.todayISO, i.due_date);
    if (days < 14) continue; // materially late only
    const key = i.customer_id || i.customer_name || "unknown";
    const e = byCustomer.get(key) || { name: i.customer_name || "Unknown customer", overdue: 0, totalPence: 0, worstDays: 0 };
    e.overdue += 1;
    e.totalPence += pence(i.balance_due);
    e.worstDays = Math.max(e.worstDays, days);
    byCustomer.set(key, e);
  }
  const detections: Detection[] = [];
  for (const [key, e] of byCustomer) {
    if (e.overdue < 2 && e.worstDays < 30) continue;
    detections.push({
      dedupe_key: `credit_risk:${key}`,
      domain: "debtor",
      kind: "credit_risk",
      priority: e.worstDays >= 60 ? "high" : "medium",
      title: `${e.name} owes ${gbp(e.totalPence)} — up to ${e.worstDays} days late`,
      detail: `${e.name} has ${e.overdue} invoice${e.overdue === 1 ? "" : "s"} more than two weeks overdue. Repeated late payment suggests their credit terms need reviewing.`,
      recommended_action: "Chase the outstanding balance, and consider tightening credit terms (e.g. shorter terms or upfront deposits) for future work.",
      confidence: 85,
      amount: pounds(e.totalPence),
      evidence: { customer: e.name, overdue_invoices: e.overdue, worst_days_late: e.worstDays },
      related_entity_type: "customer",
      related_entity_id: key,
      route: "/collections",
    });
  }
  return detections.slice(0, 10);
}

// ── Entry point ──────────────────────────────────────────────────────────────

export async function runDetectors(companyId: string): Promise<Detection[]> {
  const data = await loadData(companyId);
  return [
    ...detectMissingInvoices(data),
    ...detectMissingBills(data),
    ...detectDuplicatePayments(data),
    ...detectUncategorisedExpenses(data),
    ...detectVatAnomalies(data),
    ...detectOverdueInvoices(data),
    ...detectOverdueBills(data),
    ...detectPaymentBehaviour(data),
  ];
}
