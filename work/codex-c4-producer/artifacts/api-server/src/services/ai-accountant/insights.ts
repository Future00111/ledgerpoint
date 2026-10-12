/**
 * AI Accountant — company-scoped accountant insights.
 *
 * Aggregates company financials deterministically, then asks the central
 * provider-independent aiService to produce short accountant-style
 * observations. The model receives ONLY aggregated figures (no free-form
 * instructions from data) and its output is text-only — it cannot trigger any
 * mutation. Falls back to deterministic insights when AI is unavailable.
 */
import { db } from "@workspace/db";
import {
  salesInvoicesTable,
  purchaseBillsTable,
  bankTransactionsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { aiService } from "../ai/index.js";

export interface AccountantInsight {
  title: string;
  detail: string;
  severity: "info" | "warning" | "positive";
}

export interface InsightsResult {
  insights: AccountantInsight[];
  source: "ai" | "rules";
  provider?: string;
  model?: string;
}

function monthKey(d: string | Date | null): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function generateCompanyInsights(companyId: string): Promise<InsightsResult> {
  const [invoices, bills, txns] = await Promise.all([
    db.select().from(salesInvoicesTable).where(eq(salesInvoicesTable.company_id, companyId)),
    db.select().from(purchaseBillsTable).where(eq(purchaseBillsTable.company_id, companyId)),
    db.select().from(bankTransactionsTable).where(eq(bankTransactionsTable.company_id, companyId)),
  ]);

  const now = new Date();
  const thisMonth = monthKey(now)!;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = monthKey(lastMonthDate)!;
  const todayISO = now.toISOString().slice(0, 10);

  // All money aggregation in integer pence to avoid floating-point drift;
  // convert to pounds only at the serialization boundary.
  const toPence = (v: string | null) => Math.round(Number(v || 0) * 100);
  const sumPence = (arr: number[]) => arr.reduce((s, n) => s + n, 0);
  const pounds = (pence: number) => pence / 100;

  const active = invoices.filter((i) => i.status !== "cancelled");
  const revenueThisMonthP = sumPence(active.filter((i) => monthKey(i.issue_date) === thisMonth).map((i) => toPence(i.total)));
  const revenueLastMonthP = sumPence(active.filter((i) => monthKey(i.issue_date) === lastMonth).map((i) => toPence(i.total)));

  const activeBills = bills.filter((b) => b.status !== "cancelled");
  const spendThisMonthP = sumPence(activeBills.filter((b) => monthKey(b.bill_date) === thisMonth).map((b) => toPence(b.total)));
  const spendLastMonthP = sumPence(activeBills.filter((b) => monthKey(b.bill_date) === lastMonth).map((b) => toPence(b.total)));

  const overdue = active.filter(
    (i) => i.status !== "paid" && toPence(i.balance_due) > 0 && i.due_date && i.due_date < todayISO,
  );
  const overdueTotalP = sumPence(overdue.map((i) => toPence(i.balance_due)));
  const unreconciled = txns.filter((t) => t.status === "review").length;

  const aggregates = {
    revenue_this_month: pounds(revenueThisMonthP),
    revenue_last_month: pounds(revenueLastMonthP),
    supplier_spend_this_month: pounds(spendThisMonthP),
    supplier_spend_last_month: pounds(spendLastMonthP),
    overdue_invoice_count: overdue.length,
    overdue_invoice_total: pounds(overdueTotalP),
    unreconciled_transaction_count: unreconciled,
    outstanding_invoice_total: pounds(sumPence(active.filter((i) => i.status !== "paid").map((i) => toPence(i.balance_due)))),
  };

  // Deterministic fallback insights (also used when AI is unavailable).
  const fallback: AccountantInsight[] = [];
  if (overdue.length > 0) {
    fallback.push({
      title: `${overdue.length} overdue invoice${overdue.length === 1 ? "" : "s"}`,
      detail: `£${aggregates.overdue_invoice_total.toFixed(2)} is past due — consider chasing payment.`,
      severity: "warning",
    });
  }
  if (unreconciled > 0) {
    fallback.push({
      title: `${unreconciled} transaction${unreconciled === 1 ? "" : "s"} to reconcile`,
      detail: "Unreconciled bank activity can hide missing invoices or duplicate payments.",
      severity: "info",
    });
  }
  if (revenueLastMonthP > 0) {
    const change = ((revenueThisMonthP - revenueLastMonthP) / revenueLastMonthP) * 100;
    fallback.push({
      title: `Revenue ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(0)}% vs last month`,
      detail: `Invoiced £${aggregates.revenue_this_month.toFixed(2)} so far this month against £${aggregates.revenue_last_month.toFixed(2)} last month.`,
      severity: change >= 0 ? "positive" : "warning",
    });
  }
  if (fallback.length === 0) {
    fallback.push({ title: "All clear", detail: "No pressing accounting issues detected from current data.", severity: "positive" });
  }

  try {
    const result = await aiService.complete({
      messages: [
        {
          role: "system",
          content:
            "You are a UK accountant reviewing a small company's monthly figures. Produce 3-4 short, specific " +
            "observations a business owner should know. Use British pounds. Respond with STRICT JSON: " +
            '{"insights":[{"title":"...","detail":"...","severity":"info|warning|positive"}]}. No prose outside JSON. ' +
            "Never suggest automated actions — the user reviews and decides everything.",
        },
        { role: "user", content: JSON.stringify(aggregates) },
      ],
      maxTokens: 600,
      temperature: 0.4,
    });
    const jsonText = result.text.replace(/^```(?:json)?/m, "").replace(/```$/m, "").trim();
    const parsed = JSON.parse(jsonText) as { insights?: AccountantInsight[] };
    const insights = (parsed.insights ?? [])
      .filter((i) => typeof i.title === "string" && typeof i.detail === "string")
      .slice(0, 5)
      .map((i) => ({
        title: i.title.slice(0, 120),
        detail: i.detail.slice(0, 400),
        severity: (["info", "warning", "positive"].includes(i.severity) ? i.severity : "info") as AccountantInsight["severity"],
      }));
    if (insights.length === 0) throw new Error("empty");
    return { insights, source: "ai", provider: result.provider, model: result.model };
  } catch {
    return { insights: fallback, source: "rules" };
  }
}
