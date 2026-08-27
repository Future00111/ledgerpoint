/**
 * Phase 4 AI Accountant task engine.
 *
 * This module turns deterministic accounting findings into a durable,
 * review-first task queue. It deliberately never mutates accounting data:
 * approving a task only records the user's review decision.
 */
import { db } from "@workspace/db";
import {
  aiReconciliationResultsTable,
  aiTasksTable,
  bankAccountsTable,
  bankTransactionsTable,
  companiesTable,
  purchaseBillsTable,
  vatReturnsTable,
  workflowActivitiesTable,
  type AITask,
} from "@workspace/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { analyseTransactions } from "./analysis.js";
import { runDetectors, type Detection } from "./detectors.js";
import { buildCustomerFollowUpTasks } from "./collections.js";
import { getVATOverview } from "./vat.js";
import {
  requireCompanyJobContext,
  type CompanyJobContext,
} from "../../middlewares/companyScope.js";

export const AI_TASK_TYPES = [
  "reconciliation",
  "missing_invoice",
  "overdue_invoice",
  "duplicate_transaction",
  "uncategorised_transaction",
  "missing_bill",
  "vat_warning",
  "cash_flow_warning",
  "supplier_review",
  "customer_follow_up",
] as const;
export type AITaskType = (typeof AI_TASK_TYPES)[number];

export const AI_TASK_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export type AITaskPriority = (typeof AI_TASK_PRIORITIES)[number];

export const AI_TASK_STATUSES = ["open", "reviewing", "approved", "dismissed", "completed"] as const;
export type AITaskStatus = (typeof AI_TASK_STATUSES)[number];

interface TaskCandidate {
  dedupe_key: string;
  task_type: AITaskType;
  priority: AITaskPriority;
  title: string;
  description: string;
  amount?: number;
  confidence_score: number;
  source_record_id?: string;
  source_record_type?: string;
  recommendation: string;
  evidence?: Record<string, unknown>;
  route?: string;
}

export interface AITaskSyncResult {
  detected: number;
  created: number;
  updated: number;
  completed: number;
}

export interface AITaskWorkspaceSummary {
  open: number;
  ready_to_approve: number;
  needs_review: number;
  warnings: number;
  insights: number;
  total_amount_at_risk: number;
  bank_receipts_analysed: number;
  matched_to_invoices: number;
  potential_missing_revenue: number;
  matched_invoice_count: number;
  invoice_review_count: number;
  payments_with_no_invoice: number;
  last_run_at: string | null;
}

const pence = (value: unknown) => Math.round(Number(value || 0) * 100);
const pounds = (value: number) => Math.round(value) / 100;
const gbp = (value: number) =>
  `£${pounds(value).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;

const DETECTION_TYPE: Record<string, AITaskType> = {
  missing_invoices: "missing_invoice",
  missing_bills: "missing_bill",
  duplicate_payment: "duplicate_transaction",
  uncategorised_expenses: "uncategorised_transaction",
  vat_anomalies: "vat_warning",
  overdue_invoices: "overdue_invoice",
  overdue_bills: "supplier_review",
  credit_risk: "customer_follow_up",
};

const toPriority = (priority: Detection["priority"]): AITaskPriority =>
  priority === "high" ? "high" : priority === "medium" ? "medium" : "low";

function taskFromDetection(det: Detection): TaskCandidate | null {
  const task_type = DETECTION_TYPE[det.kind];
  if (!task_type) return null;
  return {
    dedupe_key: `detector:${det.dedupe_key}`,
    task_type,
    priority: toPriority(det.priority),
    title: det.title,
    description: det.detail,
    amount: det.amount,
    confidence_score: det.confidence,
    source_record_id: det.related_entity_id ?? det.dedupe_key,
    source_record_type: det.related_entity_type ?? "detector_finding",
    recommendation: det.recommended_action,
    evidence: det.evidence,
    route: det.route,
  };
}

function isReadyToApprove(task: Pick<AITask, "task_type" | "confidence_score" | "status">) {
  return task.status === "open" && task.task_type === "reconciliation" && Number(task.confidence_score) >= 90;
}

function isWarning(task: Pick<AITask, "task_type" | "priority">) {
  return (
    task.priority === "critical" ||
    task.task_type === "vat_warning" ||
    task.task_type === "cash_flow_warning" ||
    task.task_type === "overdue_invoice"
  );
}

function isInsight(task: Pick<AITask, "task_type" | "priority">) {
  return (
    (task.task_type === "customer_follow_up" || task.task_type === "supplier_review") &&
    task.priority !== "high" &&
    task.priority !== "critical"
  );
}

function addCashFlowTask(
  bills: (typeof purchaseBillsTable.$inferSelect)[],
  accounts: (typeof bankAccountsTable.$inferSelect)[],
  todayISO: string,
): TaskCandidate | null {
  const soonISO = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  const dueSoon = bills.filter(
    (bill) =>
      bill.status !== "paid" &&
      bill.status !== "cancelled" &&
      pence(bill.balance_due) > 0 &&
      bill.due_date &&
      bill.due_date >= todayISO &&
      bill.due_date <= soonISO,
  );
  const duePence = dueSoon.reduce((sum, bill) => sum + pence(bill.balance_due), 0);
  const availablePence = accounts
    .filter((account) => account.status !== "closed")
    .reduce((sum, account) => sum + pence(account.current_balance), 0);
  if (duePence <= 0 || duePence <= availablePence) return null;

  const shortfall = duePence - availablePence;
  return {
    dedupe_key: "cash_flow:next_14_days",
    task_type: "cash_flow_warning",
    priority: shortfall >= availablePence ? "critical" : "high",
    title: `${gbp(shortfall)} cash-flow gap for supplier bills due in the next 14 days`,
    description: `${gbp(duePence)} of supplier bills are due soon while the recorded active bank balance is ${gbp(availablePence)}. This can create payment pressure if no cash is received or transferred in time.`,
    amount: pounds(shortfall),
    confidence_score: 92,
    source_record_id: "next_14_days",
    source_record_type: "cash_flow_forecast",
    recommendation: "Review the upcoming payment schedule, expected customer receipts, and available funding before supplier bills fall due.",
    evidence: {
      due_soon_bill_count: dueSoon.length,
      bills_due_soon: pounds(duePence),
      active_bank_balance: pounds(availablePence),
      shortfall: pounds(shortfall),
    },
    route: "/bills",
  };
}

function addVatLiabilityTasks(returns: (typeof vatReturnsTable.$inferSelect)[]): TaskCandidate[] {
  return returns
    .filter((vatReturn) => vatReturn.status !== "submitted" && pence(vatReturn.box5_net_vat_due) > 0)
    .map((vatReturn) => {
      const amount = pence(vatReturn.box5_net_vat_due);
      return {
        dedupe_key: `vat_liability:${vatReturn.id}`,
        task_type: "vat_warning" as const,
        priority: amount >= 100_000 ? "high" as const : "medium" as const,
        title: `${gbp(amount)} VAT liability is awaiting review`,
        description: `The VAT return for ${vatReturn.period_start ?? "the current period"} to ${vatReturn.period_end ?? "the current period"} has a recorded net VAT amount due of ${gbp(amount)} and has not been submitted.`,
        amount: pounds(amount),
        confidence_score: 100,
        source_record_id: vatReturn.id,
        source_record_type: "vat_return",
        recommendation: "Review the VAT return and its supporting transactions before submitting it through the VAT workflow.",
        evidence: {
          period_start: vatReturn.period_start,
          period_end: vatReturn.period_end,
          net_vat_due: pounds(amount),
          return_status: vatReturn.status,
        },
        route: "/vat",
      };
    });
}

function addVatReviewTasks(overview: Awaited<ReturnType<typeof getVATOverview>>): TaskCandidate[] {
  return overview.exceptions.map((exception) => ({
    dedupe_key: `vat_review:${exception.dedupe_key}`,
    task_type: "vat_warning" as const,
    priority: exception.severity === "high" ? "high" as const : exception.severity === "medium" ? "medium" as const : "low" as const,
    title: exception.title,
    description: exception.detail,
    confidence_score: exception.severity === "high" ? 95 : 80,
    source_record_id: exception.source_record_id ?? undefined,
    source_record_type: exception.source_record_type ?? "vat_exception",
    recommendation: "Open the VAT workspace, inspect the supporting evidence, and record a review decision. No VAT treatment is changed automatically.",
    evidence: exception.evidence,
    route: "/vat",
  }));
}

function reconciliationTasks(
  results: (typeof aiReconciliationResultsTable.$inferSelect)[],
): TaskCandidate[] {
  return results.map((result) => {
    const confidence = Number(result.confidence || 0);
    const amount = Math.abs(Number(result.transaction_amount || 0));
    const ready = confidence >= 90 && ["exact", "combination"].includes(result.scenario ?? "");
    return {
      dedupe_key: `reconciliation:${result.bank_transaction_id}`,
      task_type: "reconciliation",
      priority: ready ? "high" : confidence >= 70 ? "medium" : "low",
      title: ready
        ? `High-confidence reconciliation match ready to approve`
        : `Reconciliation needs review`,
      description:
        result.explanation ??
        `A bank transaction of ${gbp(Math.round(amount * 100))} has a ${confidence}% confidence ${result.scenario ?? "possible"} reconciliation result. Review the proposed match before making any change.`,
      amount,
      confidence_score: confidence,
      source_record_id: result.bank_transaction_id,
      source_record_type: "bank_transaction",
      recommendation:
        result.recommendation ??
        "Open Reconciliation to inspect the transaction and confirm the suggested records before approving.",
      evidence: {
        scenario: result.scenario,
        matched_total: result.matched_total,
        remaining: result.remaining,
        matched_records: result.matched_records,
        possible_explanations: result.possible_explanations,
      },
      route: "/reconciliation",
    };
  });
}

function isUnexplainedRevenueResult(
  result: typeof aiReconciliationResultsTable.$inferSelect,
  transaction: typeof bankTransactionsTable.$inferSelect | undefined,
) {
  return Boolean(
    transaction &&
    Number(transaction.money_in || 0) > 0 &&
    Number(result.remaining || 0) > 0 &&
    ["no_match", "partial"].includes(result.scenario ?? ""),
  );
}

/**
 * One task per incoming receipt with revenue still unaccounted for. These are
 * deliberately review tasks only: the task never creates an invoice, posts
 * income, marks a payment reconciled, or manufactures a credit note.
 */
function missingRevenueTasks(
  results: (typeof aiReconciliationResultsTable.$inferSelect)[],
  transactions: (typeof bankTransactionsTable.$inferSelect)[],
): TaskCandidate[] {
  const transactionsById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  return results.flatMap((result) => {
    const transaction = transactionsById.get(result.bank_transaction_id);
    if (!isUnexplainedRevenueResult(result, transaction)) return [];

    const remaining = Number(result.remaining || 0);
    const matchedTotal = Number(result.matched_total || 0);
    const isNoMatch = result.scenario === "no_match";
    const description = transaction?.description || transaction?.reference || "Bank receipt";
    const route = `/reconciliation?transaction_id=${encodeURIComponent(result.bank_transaction_id)}`;
    return [{
      dedupe_key: `missing_invoice:${result.bank_transaction_id}`,
      task_type: "missing_invoice" as const,
      priority: remaining >= 10_000 ? "high" as const : "medium" as const,
      title: isNoMatch
        ? `${gbp(Math.round(remaining * 100))} bank receipt has no matching invoice`
        : `${gbp(Math.round(remaining * 100))} of received revenue is not matched to an invoice`,
      description: isNoMatch
        ? `${description} was received on ${transaction?.date ?? "an unknown date"}, but no existing sales invoice could be matched.`
        : `${gbp(Math.round(matchedTotal * 100))} of ${description} is linked to invoice candidates; ${gbp(Math.round(remaining * 100))} remains unexplained.`,
      amount: remaining,
      confidence_score: Number(result.confidence || 0),
      source_record_id: result.bank_transaction_id,
      source_record_type: "bank_transaction",
      recommendation: "Find an existing invoice, create an invoice if the receipt represents new revenue, or categorise the receipt after checking its supporting evidence. No record has been created automatically.",
      evidence: {
        bank_transaction_id: result.bank_transaction_id,
        receipt_date: transaction?.date ?? null,
        receipt_description: transaction?.description ?? null,
        receipt_reference: transaction?.reference ?? null,
        receipt_amount: Number(result.transaction_amount || transaction?.money_in || 0),
        matched_to_invoices: matchedTotal,
        potential_missing_revenue: remaining,
        scenario: result.scenario,
        matched_records: result.matched_records,
        potential_matches: result.potential_matches,
        possible_explanations: result.possible_explanations,
        safe_actions: {
          find_invoice: route,
          create_invoice: `/invoices/new?bank_transaction_id=${encodeURIComponent(result.bank_transaction_id)}`,
          categorise_receipt: route,
        },
      },
      route,
    }];
  });
}

function uncategorisedTransactionTask(
  transactions: (typeof bankTransactionsTable.$inferSelect)[],
): TaskCandidate | null {
  const uncategorised = transactions.filter(
    (transaction) => transaction.status === "review" && !transaction.category,
  );
  if (uncategorised.length === 0) return null;
  const total = uncategorised.reduce(
    (sum, transaction) => sum + pence(transaction.amount ?? transaction.money_in ?? transaction.money_out),
    0,
  );
  return {
    dedupe_key: "uncategorised:bank_transactions",
    task_type: "uncategorised_transaction",
    priority: "medium",
    title: `${uncategorised.length} bank transaction${uncategorised.length === 1 ? "" : "s"} need a category`,
    description: `${uncategorised.length} transaction${uncategorised.length === 1 ? " is" : "s are"} awaiting review without a category. Categorising them keeps reporting and VAT checks accurate.`,
    amount: pounds(total),
    confidence_score: 95,
    source_record_id: uncategorised[0]?.id,
    source_record_type: "bank_transaction",
    recommendation: "Review the transaction descriptions and choose the correct category before approving the reconciliation.",
    evidence: {
      transaction_count: uncategorised.length,
      total_amount: pounds(total),
      transactions: uncategorised.slice(0, 20).map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount ?? transaction.money_in ?? transaction.money_out,
      })),
    },
    route: "/transactions",
  };
}

async function buildCandidates(companyId: string): Promise<TaskCandidate[]> {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [detections, reconciliationResults, reviewTransactions, bills, accounts, vatReturns, collectionFollowUps, vatOverview] = await Promise.all([
    runDetectors(companyId),
    db
      .select()
      .from(aiReconciliationResultsTable)
      .where(
        and(
          eq(aiReconciliationResultsTable.company_id, companyId),
          eq(aiReconciliationResultsTable.approval_state, "pending"),
        ),
      ),
    db
      .select()
      .from(bankTransactionsTable)
      .where(and(eq(bankTransactionsTable.company_id, companyId), eq(bankTransactionsTable.status, "review"))),
    db.select().from(purchaseBillsTable).where(eq(purchaseBillsTable.company_id, companyId)),
    db.select().from(bankAccountsTable).where(eq(bankAccountsTable.company_id, companyId)),
    db.select().from(vatReturnsTable).where(eq(vatReturnsTable.company_id, companyId)),
    buildCustomerFollowUpTasks(companyId),
    getVATOverview(companyId),
  ]);

  const transactionsById = new Map(reviewTransactions.map((transaction) => [transaction.id, transaction]));
  const unexplainedRevenueIds = new Set(
    reconciliationResults
      .filter((result) => isUnexplainedRevenueResult(result, transactionsById.get(result.bank_transaction_id)))
      .map((result) => result.bank_transaction_id),
  );
  // The old detectors return aggregated missing-invoice and customer-risk
  // findings. Phase 4B and 4C replace those with stable receipt- and
  // invoice-specific review tasks respectively, so no duplicate queue work is
  // created for a single overdue invoice.
  const candidates = detections
    .filter((detection) => !["missing_invoices", "credit_risk"].includes(detection.kind))
    .map(taskFromDetection)
    .filter((task): task is TaskCandidate => Boolean(task));
  candidates.push(...reconciliationTasks(
    reconciliationResults.filter((result) => !unexplainedRevenueIds.has(result.bank_transaction_id)),
  ));
  candidates.push(...missingRevenueTasks(reconciliationResults, reviewTransactions));
  const uncategorised = uncategorisedTransactionTask(reviewTransactions);
  if (uncategorised) candidates.push(uncategorised);
  candidates.push(...addVatLiabilityTasks(vatReturns));
  candidates.push(...addVatReviewTasks(vatOverview));
  const cashFlow = addCashFlowTask(bills, accounts, todayISO);
  if (cashFlow) candidates.push(cashFlow);
  candidates.push(...collectionFollowUps);
  return candidates;
}

async function logTaskActivity(
  companyId: string,
  eventType: string,
  description: string,
  metadata?: Record<string, unknown>,
  userId?: string,
) {
  try {
    await db.insert(workflowActivitiesTable).values({
      company_id: companyId,
      entity_type: "ai_task_engine",
      entity_id: null,
      event_type: eventType,
      description,
      event_date: new Date(),
      user_id: userId ?? null,
      metadata: metadata ?? null,
    });
  } catch {
    // Task activity should never stop analysis from producing a review queue.
  }
}

/** Refresh task candidates for one company without modifying accounting records. */
export async function syncAITasks(companyId: string, userId?: string): Promise<AITaskSyncResult> {
  const candidates = await buildCandidates(companyId);
  const now = new Date();
  let created = 0;
  let updated = 0;
  let completed = 0;

  await db.transaction(async (tx) => {
    const existing = await tx.select().from(aiTasksTable).where(eq(aiTasksTable.company_id, companyId));
    const byKey = new Map(existing.map((task) => [task.dedupe_key, task]));

    for (const candidate of candidates) {
      const row = byKey.get(candidate.dedupe_key);
      // User decisions are durable; a future scan must not silently overturn them.
      if (row && (row.status === "approved" || row.status === "dismissed")) continue;
      const shouldReopen = !row || row.status === "completed";
      await tx
        .insert(aiTasksTable)
        .values({
          company_id: companyId,
          ...candidate,
          amount: candidate.amount != null ? candidate.amount.toFixed(2) : null,
          status: "open",
          resolved_at: null,
        })
        .onConflictDoUpdate({
          target: [aiTasksTable.company_id, aiTasksTable.dedupe_key],
          set: {
            task_type: candidate.task_type,
            priority: candidate.priority,
            title: candidate.title,
            description: candidate.description,
            amount: candidate.amount != null ? candidate.amount.toFixed(2) : null,
            confidence_score: candidate.confidence_score,
            source_record_id: candidate.source_record_id ?? null,
            source_record_type: candidate.source_record_type ?? null,
            recommendation: candidate.recommendation,
            evidence: candidate.evidence ?? null,
            route: candidate.route ?? null,
            ...(shouldReopen ? { status: "open", resolved_at: null, reviewed_by: null, reviewed_at: null } : {}),
            updated_at: now,
          },
        });
      if (row) updated += 1;
      else created += 1;
    }

    const currentKeys = new Set(candidates.map((candidate) => candidate.dedupe_key));
    const stale = existing.filter(
      (task) => (task.status === "open" || task.status === "reviewing") && !currentKeys.has(task.dedupe_key),
    );
    if (stale.length > 0) {
      await tx
        .update(aiTasksTable)
        .set({ status: "completed", resolved_at: now, updated_at: now })
        .where(inArray(aiTasksTable.id, stale.map((task) => task.id)));
      completed = stale.length;
    }
  });

  await logTaskActivity(
    companyId,
    "task_analysis",
    `AI Accountant refreshed ${candidates.length} task${candidates.length === 1 ? "" : "s"} (${created} new, ${completed} completed).`,
    { detected: candidates.length, created, updated, completed },
    userId,
  );
  return { detected: candidates.length, created, updated, completed };
}

/** Analyse review transactions first, then synchronise the durable task queue. */
export async function runAITaskAnalysis(
  companyId: string,
  userId?: string,
): Promise<AITaskSyncResult> {
  const reviewTransactions = await db
    .select()
    .from(bankTransactionsTable)
    .where(and(eq(bankTransactionsTable.company_id, companyId), eq(bankTransactionsTable.status, "review")));
  await analyseTransactions(companyId, reviewTransactions, { persist: true });
  return syncAITasks(companyId, userId);
}

/** Background analysis has no Clerk principal, so it must carry a checked system context. */
export async function runBackgroundAITaskAnalysis(
  context: CompanyJobContext,
): Promise<AITaskSyncResult> {
  return runAITaskAnalysis(requireCompanyJobContext(context));
}

export async function listAITasks(companyId: string, statuses?: AITaskStatus[]) {
  const conditions = [eq(aiTasksTable.company_id, companyId)];
  if (statuses?.length) conditions.push(inArray(aiTasksTable.status, statuses));
  const rows = await db
    .select()
    .from(aiTasksTable)
    .where(and(...conditions))
    .orderBy(desc(aiTasksTable.updated_at));
  const rank: Record<AITaskPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return rows.sort((a, b) => (rank[a.priority as AITaskPriority] ?? 4) - (rank[b.priority as AITaskPriority] ?? 4));
}

export async function getAITask(taskId: string) {
  const [task] = await db.select().from(aiTasksTable).where(eq(aiTasksTable.id, taskId)).limit(1);
  return task ?? null;
}

export async function decideAITask(
  taskId: string,
  decision: Extract<AITaskStatus, "approved" | "dismissed">,
  userId: string,
) {
  const [task] = await db
    .update(aiTasksTable)
    .set({ status: decision, reviewed_by: userId, reviewed_at: new Date(), updated_at: new Date() })
    .where(and(
      eq(aiTasksTable.id, taskId),
      inArray(aiTasksTable.status, ["open", "reviewing"]),
    ))
    .returning();
  if (!task) throw new Error("AI task is no longer open for a decision");

  await logTaskActivity(
    task.company_id,
    `task_${decision}`,
    `AI task "${task.title}" was ${decision}. No accounting records were changed.`,
    { task_id: task.id, task_type: task.task_type, decision },
    userId,
  );
  return task;
}

export async function markAITaskReviewing(taskId: string, userId: string) {
  const [task] = await db
    .update(aiTasksTable)
    .set({ status: "reviewing", reviewed_by: userId, reviewed_at: new Date(), updated_at: new Date() })
    .where(and(eq(aiTasksTable.id, taskId), eq(aiTasksTable.status, "open")))
    .returning();
  return task ?? getAITask(taskId);
}

export async function getAITaskWorkspaceSummary(companyId: string): Promise<AITaskWorkspaceSummary> {
  const [rows, results, transactions] = await Promise.all([
    db.select().from(aiTasksTable).where(eq(aiTasksTable.company_id, companyId)),
    db.select().from(aiReconciliationResultsTable).where(and(
      eq(aiReconciliationResultsTable.company_id, companyId),
      eq(aiReconciliationResultsTable.approval_state, "pending"),
    )),
    db.select().from(bankTransactionsTable).where(eq(bankTransactionsTable.company_id, companyId)),
  ]);
  const open = rows.filter((task) => task.status === "open" || task.status === "reviewing");
  const ready = open.filter(isReadyToApprove);
  const warnings = open.filter(isWarning);
  const insights = open.filter((task) => !isWarning(task) && !isReadyToApprove(task) && isInsight(task));
  const needsReview = open.filter(
    (task) => !isReadyToApprove(task) && !isWarning(task) && !isInsight(task),
  );
  const lastRun = rows.reduce<Date | null>((latest, task) => {
    const date = task.updated_at ? new Date(task.updated_at) : null;
    return date && (!latest || date > latest) ? date : latest;
  }, null);
  const transactionsById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  // Match the task builder's boundary: historic pending analysis must not
  // remain visible as live missing revenue after a user resolves a receipt
  // through a manual/non-payment reconciliation path.
  const receiptResults = results.filter((result) => {
    const transaction = transactionsById.get(result.bank_transaction_id);
    return transaction?.status === "review" && Number(transaction.money_in || 0) > 0;
  });
  const matchedRecords = receiptResults.flatMap((result) => Array.isArray(result.matched_records) ? result.matched_records : []);
  const missingRevenue = receiptResults
    .filter((result) => isUnexplainedRevenueResult(result, transactionsById.get(result.bank_transaction_id)))
    .reduce((sum, result) => sum + pence(result.remaining), 0);

  return {
    open: open.length,
    ready_to_approve: ready.length,
    needs_review: needsReview.length,
    warnings: warnings.length,
    insights: insights.length,
    total_amount_at_risk: pounds(open.reduce((sum, task) => sum + pence(task.amount), 0)),
    bank_receipts_analysed: pounds(receiptResults.reduce((sum, result) => sum + pence(result.transaction_amount), 0)),
    matched_to_invoices: pounds(receiptResults.reduce((sum, result) => sum + pence(result.matched_total), 0)),
    potential_missing_revenue: pounds(missingRevenue),
    matched_invoice_count: matchedRecords.length,
    invoice_review_count: open.filter((task) => task.task_type === "missing_invoice").length,
    payments_with_no_invoice: receiptResults.filter((result) => result.scenario === "no_match").length,
    last_run_at: lastRun?.toISOString() ?? null,
  };
}

/** List only active companies for the background scheduler. */
export async function listActiveCompanyIds() {
  const companies = await db
    .select({ id: companiesTable.id })
    .from(companiesTable)
    .where(eq(companiesTable.status, "active"));
  return companies.map((company) => company.id);
}