/**
 * Deterministic customer collections calculations.
 *
 * This module is deliberately database- and AI-provider-free so the same
 * evidence can be used by the collections workspace, AI task engine, and
 * regression scenarios. A risk band is a prioritisation aid, never a credit
 * decision or a prediction that a customer will not pay.
 */

export interface CollectionInvoiceInput {
  id: string;
  customer_id?: string | null;
  customer_name?: string | null;
  invoice_number?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  total?: unknown;
  amount_paid?: unknown;
  balance_due?: unknown;
  status?: string | null;
}

export interface CollectionCustomerInput {
  id: string;
  name: string;
  email?: string | null;
  payment_terms?: number | null;
}

export interface CollectionPaymentInput {
  id: string;
  linked_invoice_id?: string | null;
  date?: string | null;
  money_in?: unknown;
  status?: string | null;
}

export type CollectionRisk = "low" | "medium" | "high";
export type CollectionPriority = "low" | "medium" | "high" | "critical";

export interface CollectionInvoiceAssessment {
  invoice_id: string;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string;
  issue_date: string | null;
  due_date: string | null;
  invoice_amount: number;
  amount_paid: number;
  balance_due: number;
  days_overdue: number;
  payment_history: {
    linked_payment_count: number;
    linked_payment_total: number;
    most_recent_payment_date: string | null;
  };
  previous_overdue_invoices: number;
  average_payment_delay_days: number | null;
  customer_outstanding: number;
  customer_overdue: number;
  customer_overdue_invoice_count: number;
  risk_score: number;
  risk_label: CollectionRisk;
  priority: CollectionPriority;
  priority_score: number;
  explanation: string;
  recommended_action: string;
}

export interface CollectionCustomerAssessment {
  customer_id: string | null;
  customer_name: string;
  customer_email: string | null;
  total_outstanding: number;
  total_overdue: number;
  outstanding_invoice_count: number;
  overdue_invoice_count: number;
  oldest_days_overdue: number;
  average_payment_delay_days: number | null;
  previous_overdue_invoices: number;
  recent_payment_date: string | null;
  risk_score: number;
  risk_label: CollectionRisk;
  priority: CollectionPriority;
  priority_score: number;
  assessment: string;
  recommended_action: string;
  invoice_ids: string[];
}

export interface CollectionsAnalysis {
  summary: {
    total_outstanding: number;
    total_overdue: number;
    overdue_invoice_count: number;
    overdue_customer_count: number;
    high_priority_customer_count: number;
    high_priority_invoice_count: number;
    average_payment_delay_days: number | null;
  };
  customers: CollectionCustomerAssessment[];
  overdue_invoices: CollectionInvoiceAssessment[];
  insights: { title: string; detail: string; severity: "info" | "warning" }[];
}

const toPence = (value: unknown) => Math.round(Number(value || 0) * 100);
const fromPence = (value: number) => Math.round(value) / 100;
const safeDate = (value?: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00Z`) : null;
const daysBetween = (later?: string | null, earlier?: string | null) => {
  const left = safeDate(later);
  const right = safeDate(earlier);
  if (!left || !right || Number.isNaN(left.getTime()) || Number.isNaN(right.getTime())) return null;
  return Math.floor((left.getTime() - right.getTime()) / 86_400_000);
};

const isOpenInvoice = (invoice: CollectionInvoiceInput) =>
  !["cancelled", "paid", "draft"].includes(invoice.status ?? "") && toPence(invoice.balance_due) > 0;

function priorityFor({
  daysOverdue,
  balancePence,
  riskScore,
  customerOverdueInvoices,
}: {
  daysOverdue: number;
  balancePence: number;
  riskScore: number;
  customerOverdueInvoices: number;
}): { score: number; priority: CollectionPriority } {
  const score =
    Math.min(48, daysOverdue * 0.8) +
    Math.min(22, Math.log10(Math.max(1, balancePence / 100)) * 5) +
    Math.min(22, riskScore * 0.28) +
    Math.min(8, Math.max(0, customerOverdueInvoices - 1) * 3);
  if (score >= 65 || daysOverdue >= 75 || balancePence >= 2_000_000) return { score: Math.round(score), priority: "critical" };
  if (score >= 45 || daysOverdue >= 30 || balancePence >= 1_000_000) return { score: Math.round(score), priority: "high" };
  if (score >= 22 || daysOverdue >= 14) return { score: Math.round(score), priority: "medium" };
  return { score: Math.round(score), priority: "low" };
}

function riskFor({
  oldestDaysOverdue,
  overduePence,
  historicalDelay,
  previousOverdue,
  overdueCount,
  hasRecentPayment,
}: {
  oldestDaysOverdue: number;
  overduePence: number;
  historicalDelay: number | null;
  previousOverdue: number;
  overdueCount: number;
  hasRecentPayment: boolean;
}): { score: number; label: CollectionRisk } {
  let score = 0;
  score += Math.min(38, oldestDaysOverdue * 0.75);
  score += Math.min(18, Math.log10(Math.max(1, overduePence / 100)) * 4);
  score += Math.min(20, Math.max(0, historicalDelay ?? 0) * 1.25);
  score += Math.min(14, previousOverdue * 3);
  score += Math.min(8, Math.max(0, overdueCount - 1) * 3);
  if (!hasRecentPayment && overdueCount > 0) score += 4;
  const rounded = Math.min(100, Math.round(score));
  return { score: rounded, label: rounded >= 60 ? "high" : rounded >= 28 ? "medium" : "low" };
}

function readableRisk(label: CollectionRisk) {
  return label === "high" ? "High" : label === "medium" ? "Medium" : "Low";
}

function customerKey(invoice: CollectionInvoiceInput) {
  return invoice.customer_id || `name:${(invoice.customer_name || "Unknown customer").trim().toLowerCase()}`;
}

/**
 * Analyse live invoice and reconciled-payment data for a single company.
 * Values are kept in pence internally and converted only in returned evidence.
 */
export function analyseCollections(
  invoices: CollectionInvoiceInput[],
  customers: CollectionCustomerInput[],
  payments: CollectionPaymentInput[],
  todayISO = new Date().toISOString().slice(0, 10),
): CollectionsAnalysis {
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const paymentsByInvoice = new Map<string, CollectionPaymentInput[]>();
  for (const payment of payments) {
    if (!payment.linked_invoice_id || toPence(payment.money_in) <= 0) continue;
    const list = paymentsByInvoice.get(payment.linked_invoice_id) ?? [];
    list.push(payment);
    paymentsByInvoice.set(payment.linked_invoice_id, list);
  }

  const invoiceGroups = new Map<string, CollectionInvoiceInput[]>();
  for (const invoice of invoices.filter((item) => item.status !== "cancelled")) {
    const key = customerKey(invoice);
    const group = invoiceGroups.get(key) ?? [];
    group.push(invoice);
    invoiceGroups.set(key, group);
  }

  const customerMetrics = new Map<string, CollectionCustomerAssessment>();
  for (const [key, group] of invoiceGroups) {
    const customer = group[0]?.customer_id ? customerById.get(group[0].customer_id) : undefined;
    const open = group.filter(isOpenInvoice);
    const overdue = open.filter((invoice) => (daysBetween(todayISO, invoice.due_date) ?? 0) > 0);
    const paymentDelays: number[] = [];
    let recentPaymentDate: string | null = null;
    let previousOverdue = 0;

    for (const invoice of group) {
      const linkedPayments = paymentsByInvoice.get(invoice.id) ?? [];
      const latestPayment = linkedPayments
        .filter((payment) => payment.date)
        .sort((left, right) => (left.date! < right.date! ? 1 : -1))[0];
      if (latestPayment?.date && (!recentPaymentDate || latestPayment.date > recentPaymentDate)) recentPaymentDate = latestPayment.date;
      if (invoice.status === "paid" && latestPayment?.date && invoice.due_date) {
        const delay = daysBetween(latestPayment.date, invoice.due_date);
        if (delay != null) {
          paymentDelays.push(delay);
          if (delay > 0) previousOverdue += 1;
        }
      }
    }
    previousOverdue += overdue.length;

    const outstandingPence = open.reduce((sum, invoice) => sum + toPence(invoice.balance_due), 0);
    const overduePence = overdue.reduce((sum, invoice) => sum + toPence(invoice.balance_due), 0);
    const oldestDaysOverdue = overdue.reduce(
      (maximum, invoice) => Math.max(maximum, daysBetween(todayISO, invoice.due_date) ?? 0),
      0,
    );
    const averagePaymentDelay = paymentDelays.length
      ? Math.round(paymentDelays.reduce((sum, delay) => sum + delay, 0) / paymentDelays.length)
      : null;
    const risk = riskFor({
      oldestDaysOverdue,
      overduePence,
      historicalDelay: averagePaymentDelay,
      previousOverdue,
      overdueCount: overdue.length,
      hasRecentPayment: Boolean(recentPaymentDate),
    });
    const priority = priorityFor({
      daysOverdue: oldestDaysOverdue,
      balancePence: overduePence,
      riskScore: risk.score,
      customerOverdueInvoices: overdue.length,
    });
    const customerName = customer?.name || group[0]?.customer_name || "Unknown customer";
    const assessment = overdue.length === 0
      ? "No overdue invoices currently require collection activity."
      : `${readableRisk(risk.label)} payment risk based on ${oldestDaysOverdue} days overdue, ${overdue.length} overdue invoice${overdue.length === 1 ? "" : "s"}, and recorded payment history. This is a collection priority, not a credit decision.`;
    customerMetrics.set(key, {
      customer_id: group[0]?.customer_id ?? null,
      customer_name: customerName,
      customer_email: customer?.email ?? null,
      total_outstanding: fromPence(outstandingPence),
      total_overdue: fromPence(overduePence),
      outstanding_invoice_count: open.length,
      overdue_invoice_count: overdue.length,
      oldest_days_overdue: oldestDaysOverdue,
      average_payment_delay_days: averagePaymentDelay,
      previous_overdue_invoices: previousOverdue,
      recent_payment_date: recentPaymentDate,
      risk_score: risk.score,
      risk_label: risk.label,
      priority: priority.priority,
      priority_score: priority.score,
      assessment,
      recommended_action: overdue.length === 0
        ? "No collection action is recommended."
        : priority.priority === "critical" || priority.priority === "high"
          ? "Prepare a payment reminder for review and consider contacting the customer."
          : "Prepare a polite payment reminder for review.",
      invoice_ids: overdue.map((invoice) => invoice.id),
    });
  }

  const overdueInvoices = invoices
    .filter(isOpenInvoice)
    .map((invoice) => {
      const daysOverdue = Math.max(0, daysBetween(todayISO, invoice.due_date) ?? 0);
      if (daysOverdue <= 0) return null;
      const customer = customerMetrics.get(customerKey(invoice));
      if (!customer) return null;
      const linkedPayments = paymentsByInvoice.get(invoice.id) ?? [];
      const linkedPaymentTotal = linkedPayments.reduce((sum, payment) => sum + toPence(payment.money_in), 0);
      const recentPayment = linkedPayments
        .filter((payment) => payment.date)
        .sort((left, right) => (left.date! < right.date! ? 1 : -1))[0];
      const priority = priorityFor({
        daysOverdue,
        balancePence: toPence(invoice.balance_due),
        riskScore: customer.risk_score,
        customerOverdueInvoices: customer.overdue_invoice_count,
      });
      const explanation = `${invoice.invoice_number || "This invoice"} is ${daysOverdue} days overdue with £${fromPence(toPence(invoice.balance_due)).toFixed(2)} outstanding. ${customer.customer_name} has ${customer.overdue_invoice_count} overdue invoice${customer.overdue_invoice_count === 1 ? "" : "s"} and a ${readableRisk(customer.risk_label).toLowerCase()} collection-risk assessment based on recorded payment history.`;
      return {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number || "Unnumbered invoice",
        customer_id: invoice.customer_id ?? null,
        customer_name: customer.customer_name,
        issue_date: invoice.issue_date ?? null,
        due_date: invoice.due_date ?? null,
        invoice_amount: fromPence(toPence(invoice.total)),
        amount_paid: fromPence(toPence(invoice.amount_paid)),
        balance_due: fromPence(toPence(invoice.balance_due)),
        days_overdue: daysOverdue,
        payment_history: {
          linked_payment_count: linkedPayments.length,
          linked_payment_total: fromPence(linkedPaymentTotal),
          most_recent_payment_date: recentPayment?.date ?? null,
        },
        previous_overdue_invoices: customer.previous_overdue_invoices,
        average_payment_delay_days: customer.average_payment_delay_days,
        customer_outstanding: customer.total_outstanding,
        customer_overdue: customer.total_overdue,
        customer_overdue_invoice_count: customer.overdue_invoice_count,
        risk_score: customer.risk_score,
        risk_label: customer.risk_label,
        priority: priority.priority,
        priority_score: priority.score,
        explanation,
        recommended_action: priority.priority === "critical" || priority.priority === "high"
          ? "Draft a payment reminder for review today; consider a direct follow-up after reviewing the account history."
          : "Draft a professional payment reminder for review.",
      } satisfies CollectionInvoiceAssessment;
    })
    .filter((assessment): assessment is CollectionInvoiceAssessment => Boolean(assessment))
    .sort((left, right) => right.priority_score - left.priority_score || right.days_overdue - left.days_overdue);

  const customerAssessments = Array.from(customerMetrics.values())
    .filter((customer) => customer.total_outstanding > 0)
    .sort((left, right) => right.priority_score - left.priority_score || right.total_overdue - left.total_overdue);
  const totalOutstandingPence = customerAssessments.reduce((sum, customer) => sum + toPence(customer.total_outstanding), 0);
  const totalOverduePence = overdueInvoices.reduce((sum, invoice) => sum + toPence(invoice.balance_due), 0);
  const historicalDelays = customerAssessments
    .map((customer) => customer.average_payment_delay_days)
    .filter((delay): delay is number => delay != null);
  const topDebtor = customerAssessments.find((customer) => customer.total_overdue > 0);
  const overThirty = customerAssessments.filter((customer) => customer.oldest_days_overdue > 30);
  const insights: CollectionsAnalysis["insights"] = [];
  if (topDebtor && totalOverduePence > 0) {
    const share = Math.round((toPence(topDebtor.total_overdue) / totalOverduePence) * 100);
    insights.push({
      title: `${topDebtor.customer_name} accounts for ${share}% of overdue debt`,
      detail: `£${topDebtor.total_overdue.toFixed(2)} is overdue across ${topDebtor.overdue_invoice_count} invoice${topDebtor.overdue_invoice_count === 1 ? "" : "s"}.`,
      severity: "warning",
    });
  }
  if (overThirty.length > 0) {
    insights.push({
      title: `${overThirty.length} customer${overThirty.length === 1 ? "" : "s"} have invoices over 30 days overdue`,
      detail: "Review the ranked collection priorities and prepare follow-ups for the oldest outstanding balances.",
      severity: "warning",
    });
  }
  if (historicalDelays.length > 0) {
    const average = Math.round(historicalDelays.reduce((sum, value) => sum + value, 0) / historicalDelays.length);
    insights.push({
      title: `Average recorded payment delay: ${average} days`,
      detail: "This is calculated from reconciled invoice payments with an available payment date and is shown as context, not a prediction.",
      severity: "info",
    });
  }
  if (insights.length === 0) {
    insights.push({ title: "No overdue customer debt", detail: "There are no outstanding invoices past their due date in the current records.", severity: "info" });
  }

  return {
    summary: {
      total_outstanding: fromPence(totalOutstandingPence),
      total_overdue: fromPence(totalOverduePence),
      overdue_invoice_count: overdueInvoices.length,
      overdue_customer_count: customerAssessments.filter((customer) => customer.overdue_invoice_count > 0).length,
      high_priority_customer_count: customerAssessments.filter((customer) => ["high", "critical"].includes(customer.priority)).length,
      high_priority_invoice_count: overdueInvoices.filter((invoice) => ["high", "critical"].includes(invoice.priority)).length,
      average_payment_delay_days: historicalDelays.length
        ? Math.round(historicalDelays.reduce((sum, value) => sum + value, 0) / historicalDelays.length)
        : null,
    },
    customers: customerAssessments,
    overdue_invoices: overdueInvoices,
    insights,
  };
}