/**
 * /api/ai — AI Accountant Phase 1 endpoints.
 *
 * Security model:
 *  - Every route requires authentication.
 *  - company_id is derived from the record itself where possible; membership
 *    is verified on every operation, and write role is required for approvals.
 *  - AI output is analysis/text only; the ONLY mutation path is the explicit
 *    approve endpoint, which shares the atomic approval implementation.
 */
import { Router, type Request, type Response, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import {
  findActiveMembership,
  requireCompanyScope,
  type CompanyScope,
} from "../middlewares/companyScope";
import {
  bankTransactionsTable,
  chartOfAccountsTable,
  aiDecisionAuditsTable,
  aiReconciliationResultsTable,
  aiRecommendationsTable,
  bankAutomationSettingsTable,
} from "@workspace/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import {
  analyseTransactions,
  applyReconciliationApproval,
  suggestNominalAccount,
  categoriseWithAI,
  generateCompanyInsights,
  getReviewSummary,
  syncDetections,
  decideRecommendation,
  listRecommendations,
  listDecisions,
  listActivity,
  getWorkspaceSummary,
  explainTransaction,
  AI_TASK_STATUSES,
  decideAITask,
  getAITask,
  getAITaskWorkspaceSummary,
  listAITasks,
  markAITaskReviewing,
  runAITaskAnalysis,
  syncAITasks,
  getCollectionsOverview,
  generateReminderDraft,
  approveReminderForEmail,
  recordReminderSent,
  addVATTaxRule,
  approveVATAdjustment,
  approveVATReturn,
  createVATAdjustment,
  createVATReturn,
  createVATRevision,
  explainVATOverview,
  getVATOverview,
  getVATReturnDetail,
  listVATExceptions,
  markVATReturnReady,
  recalculateVATReturn,
  resolveVATException,
  syncVATExceptions,
  updateVATSettings,
  type ReminderTone,
  type AITaskStatus,
  type ApprovalRecord,
  type Decision,
} from "../services/ai-accountant/index.js";

const router: IRouter = Router();
router.use(requireAuth);

const WRITE_BLOCKED_ROLES = new Set(["read_only"]);

async function getMembership(userId: string, companyId: string) {
  return findActiveMembership(userId, companyId);
}

async function assertMember(userId: string, companyId: string, res: Response): Promise<boolean> {
  return Boolean(await requireCompanyScope(res, {
    userId,
    requestedCompanyId: companyId,
  }));
}

async function assertWriteAccess(userId: string, companyId: string, res: Response): Promise<boolean> {
  return Boolean(await requireWriteScope(userId, res, {
    requestedCompanyId: companyId,
  }));
}

async function requireWriteScope(
  userId: string,
  res: Response,
  context: {
    requestedCompanyId?: unknown;
    resourceCompanyId?: unknown;
  },
): Promise<CompanyScope | null> {
  const scope = await requireCompanyScope(res, {
    userId,
    ...context,
  });
  if (!scope) return null;
  if (WRITE_BLOCKED_ROLES.has(scope.role ?? "")) {
    res.status(403).json({ error: "Your role does not permit this operation" });
    return null;
  }
  return scope;
}

// ── POST /api/ai/reconciliation/analyse ──────────────────────────────────────
// Analyse one transaction (bank_transaction_id) or all review transactions
// for a company (company_id). Persists results; returns them for the UI.
router.post("/reconciliation/analyse", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id, bank_transaction_id } = req.body as { company_id?: string; bank_transaction_id?: string };

  try {
    let txns: (typeof bankTransactionsTable.$inferSelect)[];
    let companyId: string;

    if (bank_transaction_id) {
      const [txn] = await db
        .select().from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.id, bank_transaction_id)).limit(1);
      if (!txn) { res.status(404).json({ error: "Transaction not found" }); return; }
      const scope = await requireWriteScope(userId, res, {
        requestedCompanyId: company_id,
        resourceCompanyId: txn.company_id,
      });
      if (!scope) return;
      companyId = scope.companyId;
      txns = [txn];
    } else if (company_id) {
      const scope = await requireWriteScope(userId, res, {
        requestedCompanyId: company_id,
      });
      if (!scope) return;
      companyId = scope.companyId;
      txns = await db
        .select().from(bankTransactionsTable)
        .where(and(eq(bankTransactionsTable.company_id, scope.companyId), eq(bankTransactionsTable.status, "review")));
    } else {
      res.status(400).json({ error: "company_id or bank_transaction_id is required" });
      return;
    }

    const output = await analyseTransactions(companyId, txns, {
      persist: true,
      aiExplanation: Boolean(bank_transaction_id),
    });
    res.json({ analysed: txns.length, ...output });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Analysis failed" });
  }
});

// ── GET /api/ai/reconciliation/results?company_id= ───────────────────────────
// Latest persisted pending analysis for a company.
router.get("/reconciliation/results", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.query["company_id"] as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, companyId, res))) return;

  const rows = await db
    .select().from(aiReconciliationResultsTable)
    .where(
      and(
        eq(aiReconciliationResultsTable.company_id, companyId),
        eq(aiReconciliationResultsTable.approval_state, "pending"),
      ),
    );
  res.json({ results: rows });
});

// ── Phase 5 transaction-analysis workspace ───────────────────────────────────
// These views intentionally expose the persisted deterministic evidence rather
// than another transient AI result. Every record is loaded first to derive its
// company; callers cannot read another company's review queue by guessing IDs.
router.get("/accountant/transactions/:id/analysis", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const rawId = req.params["id"];
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) { res.status(400).json({ error: "Transaction id is required" }); return; }
  const [txn] = await db.select().from(bankTransactionsTable).where(eq(bankTransactionsTable.id, id)).limit(1);
  if (!txn) { res.status(404).json({ error: "Transaction not found" }); return; }
  if (!(await assertMember(userId, txn.company_id, res))) return;
  const [analysis] = await db.select().from(aiReconciliationResultsTable)
    .where(and(
      eq(aiReconciliationResultsTable.company_id, txn.company_id),
      eq(aiReconciliationResultsTable.bank_transaction_id, txn.id),
    ))
    .orderBy(desc(aiReconciliationResultsTable.created_at))
    .limit(1);
  res.json({ transaction: txn, analysis: analysis ?? null });
});

router.get("/accountant/transactions/:id/candidates", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const rawId = req.params["id"];
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) { res.status(400).json({ error: "Transaction id is required" }); return; }
  const [txn] = await db.select().from(bankTransactionsTable).where(eq(bankTransactionsTable.id, id)).limit(1);
  if (!txn) { res.status(404).json({ error: "Transaction not found" }); return; }
  if (!(await assertMember(userId, txn.company_id, res))) return;
  const [analysis] = await db.select({
    id: aiReconciliationResultsTable.id,
    decision_state: aiReconciliationResultsTable.decision_state,
    confidence: aiReconciliationResultsTable.confidence,
    scenario: aiReconciliationResultsTable.scenario,
    matched_records: aiReconciliationResultsTable.matched_records,
    potential_matches: aiReconciliationResultsTable.potential_matches,
    deterministic_signals: aiReconciliationResultsTable.deterministic_signals,
  }).from(aiReconciliationResultsTable).where(and(
    eq(aiReconciliationResultsTable.company_id, txn.company_id),
    eq(aiReconciliationResultsTable.bank_transaction_id, txn.id),
  )).orderBy(desc(aiReconciliationResultsTable.created_at)).limit(1);
  res.json({ analysis_id: analysis?.id ?? null, state: analysis?.decision_state ?? "UNANALYSED", candidates: analysis?.potential_matches ?? [], selected_candidates: analysis?.matched_records ?? [], signals: analysis?.deterministic_signals ?? [] });
});

router.post("/accountant/transactions/:id/reanalyse", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const rawId = req.params["id"];
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) { res.status(400).json({ error: "Transaction id is required" }); return; }
  const [txn] = await db.select().from(bankTransactionsTable).where(eq(bankTransactionsTable.id, id)).limit(1);
  if (!txn) { res.status(404).json({ error: "Transaction not found" }); return; }
  if (!(await assertWriteAccess(userId, txn.company_id, res))) return;
  if (txn.status !== "review" && txn.status !== "unmatched") {
    res.status(409).json({ error: "Only unreconciled transactions can be re-analysed" }); return;
  }
  const output = await analyseTransactions(txn.company_id, [txn], { persist: true, aiExplanation: true });
  res.json({ success: true, ...output });
});

router.post("/accountant/transactions/:id/reject-analysis", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const rawId = req.params["id"];
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) { res.status(400).json({ error: "Transaction id is required" }); return; }
  const [txn] = await db.select().from(bankTransactionsTable).where(eq(bankTransactionsTable.id, id)).limit(1);
  if (!txn) { res.status(404).json({ error: "Transaction not found" }); return; }
  if (!(await assertWriteAccess(userId, txn.company_id, res))) return;
  const result = await db.transaction(async (tx) => {
    const [analysis] = await tx.select().from(aiReconciliationResultsTable)
      .where(and(
        eq(aiReconciliationResultsTable.company_id, txn.company_id),
        eq(aiReconciliationResultsTable.bank_transaction_id, id),
        eq(aiReconciliationResultsTable.approval_state, "pending"),
      ))
      .orderBy(desc(aiReconciliationResultsTable.created_at)).limit(1);
    if (!analysis) throw new Error("No pending analysis to reject");
    const [updated] = await tx.update(aiReconciliationResultsTable).set({
      approval_state: "dismissed",
      previous_decision: analysis.decision_state,
      decision_state: "REJECTED",
      approved_by: userId,
      approved_at: new Date(),
      updated_at: new Date(),
    }).where(eq(aiReconciliationResultsTable.id, analysis.id)).returning();
    await tx.insert(aiDecisionAuditsTable).values({
      company_id: txn.company_id,
      bank_transaction_id: id,
      analysis_id: analysis.id,
      event_type: "rejected",
      decision_source: "user",
      confidence: analysis.confidence,
      previous_state: analysis.decision_state,
      new_state: "REJECTED",
      user_decision: "rejected",
      user_id: userId,
      evidence: { reason: "User rejected the proposed analysis; no accounting records were changed." },
    });
    return updated;
  }).catch((error) => {
    res.status(409).json({ error: error instanceof Error ? error.message : "Could not reject analysis" });
    return null;
  });
  if (result) res.json({ success: true, analysis: result });
});

router.get("/accountant/audit", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.query["company_id"] as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, companyId, res))) return;
  const limit = Math.min(200, Math.max(1, Number(req.query["limit"] || 100)));
  const events = await db.select().from(aiDecisionAuditsTable)
    .where(eq(aiDecisionAuditsTable.company_id, companyId))
    .orderBy(desc(aiDecisionAuditsTable.created_at))
    .limit(limit);
  res.json({ events });
});

router.get("/accountant/transaction-review", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.query["company_id"] as string | undefined;
  const requestedState = req.query["state"] as string | undefined;
  const requestedPriority = req.query["priority"] as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, companyId, res))) return;
  const results = await db.select().from(aiReconciliationResultsTable).where(and(
    eq(aiReconciliationResultsTable.company_id, companyId),
    eq(aiReconciliationResultsTable.approval_state, "pending"),
  )).orderBy(desc(aiReconciliationResultsTable.priority_score), desc(aiReconciliationResultsTable.created_at));
  const filtered = results.filter((result) =>
    (!requestedState || result.decision_state === requestedState) &&
    (!requestedPriority || result.priority_band === requestedPriority),
  );
  const txnIds = filtered.map((result) => result.bank_transaction_id);
  const transactions = txnIds.length
    ? await db.select().from(bankTransactionsTable).where(and(
      eq(bankTransactionsTable.company_id, companyId),
      inArray(bankTransactionsTable.id, txnIds),
    ))
    : [];
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const allSummary = results.reduce((summary, result) => {
    summary.total += 1;
    if (result.decision_state === "READY") summary.ready += 1;
    else summary.review += 1;
    if (result.duplicate_flag) summary.duplicates += 1;
    if (result.vat_review_required) summary.vat_review += 1;
    if (result.priority_band === "high") summary.high_priority += 1;
    return summary;
  }, { total: 0, ready: 0, review: 0, duplicates: 0, vat_review: 0, high_priority: 0 });
  res.json({
    summary: allSummary,
    items: filtered.map((analysis) => ({
      analysis,
      transaction: transactionById.get(analysis.bank_transaction_id) ?? null,
    })).filter((item) => item.transaction),
  });
});

// ── POST /api/ai/reconciliation/approve ──────────────────────────────────────
// Explicit user approval of matched records — the ONLY mutation in this API.
router.post("/reconciliation/approve", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { bank_transaction_id, records } = req.body as {
    bank_transaction_id?: string;
    records?: ApprovalRecord[];
  };
  if (!bank_transaction_id || !Array.isArray(records) || records.length === 0) {
    res.status(400).json({ error: "bank_transaction_id and records are required" });
    return;
  }
  if (records.some((r) => r.record_type !== "sales_invoice" && r.record_type !== "purchase_bill")) {
    res.status(400).json({ error: "Only sales invoices and purchase bills can be bulk-reconciled" });
    return;
  }

  const [txn] = await db
    .select().from(bankTransactionsTable)
    .where(eq(bankTransactionsTable.id, bank_transaction_id)).limit(1);
  if (!txn) { res.status(404).json({ error: "Transaction not found" }); return; }
  if (!(await assertWriteAccess(userId, txn.company_id, res))) return;

  try {
    const result = await applyReconciliationApproval(bank_transaction_id, records, userId);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(409).json({ error: e instanceof Error ? e.message : "Reconciliation failed" });
  }
});

// ── POST /api/ai/reconciliation/approve-batch ─────────────────────────────────
// Batch approval is intentionally constrained to persisted, deterministic READY
// payment matches. The browser may select rows, but the server re-derives every
// eligible record and skips all exceptions.
router.post("/reconciliation/approve-batch", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id, bank_transaction_ids } = req.body as {
    company_id?: string;
    bank_transaction_ids?: string[];
  };
  if (!company_id || !Array.isArray(bank_transaction_ids) || bank_transaction_ids.length === 0) {
    res.status(400).json({ error: "company_id and at least one transaction are required" });
    return;
  }
  if (bank_transaction_ids.length > 100) {
    res.status(400).json({ error: "Approve no more than 100 transactions at once" });
    return;
  }
  if (!(await assertWriteAccess(userId, company_id, res))) return;
  const [settings] = await db.select().from(bankAutomationSettingsTable)
    .where(eq(bankAutomationSettingsTable.company_id, company_id)).limit(1);
  if (settings?.batch_approval_enabled === false) {
    res.status(409).json({ error: "Batch approval is disabled for this company" });
    return;
  }
  const threshold = settings?.high_confidence_threshold ?? 95;
  const requestedIds = [...new Set(bank_transaction_ids)];
  const pending = await db.select().from(aiReconciliationResultsTable).where(and(
    eq(aiReconciliationResultsTable.company_id, company_id),
    eq(aiReconciliationResultsTable.approval_state, "pending"),
    inArray(aiReconciliationResultsTable.bank_transaction_id, requestedIds),
  )).orderBy(desc(aiReconciliationResultsTable.created_at));
  const latest = new Map<string, typeof pending[number]>();
  for (const analysis of pending) {
    if (!latest.has(analysis.bank_transaction_id)) latest.set(analysis.bank_transaction_id, analysis);
  }
  const approved: Array<{ bank_transaction_id: string; label: string }> = [];
  const skipped: Array<{ bank_transaction_id: string; reason: string }> = [];
  for (const id of requestedIds) {
    const analysis = latest.get(id);
    const matches = Array.isArray(analysis?.matched_records) ? analysis.matched_records : [];
    const records = matches
      .filter((match): match is Record<string, unknown> =>
        Boolean(match) && typeof match === "object" &&
        (match as Record<string, unknown>).record_type !== undefined &&
        (match as Record<string, unknown>).record_id !== undefined,
      )
      .map((match) => ({
        record_type: match.record_type,
        record_id: match.record_id,
      }))
      .filter((match): match is { record_type: "sales_invoice" | "purchase_bill"; record_id: string } =>
        (match.record_type === "sales_invoice" || match.record_type === "purchase_bill") && typeof match.record_id === "string",
      );
    if (!analysis || analysis.decision_state !== "READY" || (analysis.confidence ?? 0) < threshold ||
      analysis.duplicate_flag || analysis.vat_review_required || analysis.transfer_flag || records.length !== 1) {
      skipped.push({ bank_transaction_id: id, reason: "Only current, high-confidence READY invoice or bill matches can be batch-approved" });
      continue;
    }
    try {
      const result = await applyReconciliationApproval(id, records, userId, {
        expectedAnalysisId: analysis.id,
        minimumConfidence: threshold,
        requireReady: true,
      });
      approved.push({ bank_transaction_id: id, label: result.label });
    } catch (error) {
      skipped.push({ bank_transaction_id: id, reason: error instanceof Error ? error.message : "Approval could not be completed" });
    }
  }
  res.json({ success: true, approved, skipped, threshold });
});

// ── Bank automation settings ──────────────────────────────────────────────────
router.get("/accountant/bank-automation-settings", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.query["company_id"] as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, companyId, res))) return;
  const [settings] = await db.select().from(bankAutomationSettingsTable)
    .where(eq(bankAutomationSettingsTable.company_id, companyId)).limit(1);
  res.json({ settings: settings ?? {
    company_id: companyId,
    automatic_analysis_enabled: true,
    automatic_reconciliation_enabled: false,
    high_confidence_threshold: 95,
    batch_approval_enabled: true,
  } });
});

router.put("/accountant/bank-automation-settings", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id, automatic_analysis_enabled, automatic_reconciliation_enabled, high_confidence_threshold, batch_approval_enabled } = req.body as {
    company_id?: string;
    automatic_analysis_enabled?: boolean;
    automatic_reconciliation_enabled?: boolean;
    high_confidence_threshold?: number;
    batch_approval_enabled?: boolean;
  };
  if (!company_id) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertWriteAccess(userId, company_id, res))) return;
  const [existing] = await db.select().from(bankAutomationSettingsTable)
    .where(eq(bankAutomationSettingsTable.company_id, company_id)).limit(1);
  const threshold = high_confidence_threshold == null
    ? (existing?.high_confidence_threshold ?? 95)
    : Number(high_confidence_threshold);
  if (!Number.isInteger(threshold) || threshold < 50 || threshold > 100) {
    res.status(400).json({ error: "High-confidence threshold must be an integer between 50 and 100" }); return;
  }
  // A setting can record an organisation's preference, but Phase 6 never uses
  // it to bypass explicit approval. It stays a future-safe opt-in configuration.
  const [settings] = await db.insert(bankAutomationSettingsTable).values({
    company_id,
    automatic_analysis_enabled: automatic_analysis_enabled ?? existing?.automatic_analysis_enabled ?? true,
    automatic_reconciliation_enabled: automatic_reconciliation_enabled ?? existing?.automatic_reconciliation_enabled ?? false,
    high_confidence_threshold: threshold,
    batch_approval_enabled: batch_approval_enabled ?? existing?.batch_approval_enabled ?? true,
  }).onConflictDoUpdate({
    target: bankAutomationSettingsTable.company_id,
    set: {
      automatic_analysis_enabled: automatic_analysis_enabled ?? existing?.automatic_analysis_enabled ?? true,
      automatic_reconciliation_enabled: automatic_reconciliation_enabled ?? existing?.automatic_reconciliation_enabled ?? false,
      high_confidence_threshold: threshold,
      batch_approval_enabled: batch_approval_enabled ?? existing?.batch_approval_enabled ?? true,
      updated_at: new Date(),
    },
  }).returning();
  res.json({ settings });
});

// ── GET /api/ai/review-summary?company_id= ───────────────────────────────────
router.get("/review-summary", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.query["company_id"] as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, companyId, res))) return;
  res.json(await getReviewSummary(companyId));
});

// ── POST /api/ai/categorise ──────────────────────────────────────────────────
// Review-only category suggestions for unmatched review transactions.
router.post("/categorise", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id, bank_transaction_ids } = req.body as {
    company_id?: string;
    bank_transaction_ids?: string[];
  };
  if (!company_id) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertWriteAccess(userId, company_id, res))) return;

  const conditions = [
    eq(bankTransactionsTable.company_id, company_id),
    eq(bankTransactionsTable.status, "review"),
  ];
  if (Array.isArray(bank_transaction_ids) && bank_transaction_ids.length > 0) {
    conditions.push(inArray(bankTransactionsTable.id, bank_transaction_ids));
  }
  const txns = await db.select().from(bankTransactionsTable).where(and(...conditions));

  const suggestions: Record<string, {
    category: string; confidence: number; source: string; account_id?: string; account_code?: string | null; account_name?: string;
  }> = {};
  const unresolved: typeof txns = [];
  const accounts = await db.select({
    id: chartOfAccountsTable.id,
    name: chartOfAccountsTable.name,
    code: chartOfAccountsTable.code,
    account_type: chartOfAccountsTable.account_type,
  }).from(chartOfAccountsTable).where(and(
    eq(chartOfAccountsTable.company_id, company_id),
    eq(chartOfAccountsTable.is_active, true),
  ));
  for (const t of txns) {
    const byRule = suggestNominalAccount(t, accounts);
    if (byRule) suggestions[t.id] = byRule;
    else unresolved.push(t);
  }

  // AI pass only for what the rules couldn't classify.
  if (unresolved.length > 0) {
    const aiResults = await categoriseWithAI(unresolved, accounts.map((a) => a.name ?? "").filter(Boolean));
    for (const [txnId, suggestion] of Object.entries(aiResults)) {
      const account = accounts.find((candidate) => candidate.name === suggestion.category);
      if (account) suggestions[txnId] = {
        ...suggestion,
        account_id: account.id,
        account_code: account.code,
        account_name: account.name,
      };
    }
  }

  res.json({ suggestions });
});

// ── POST /api/ai/insights ────────────────────────────────────────────────────
router.post("/insights", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id } = req.body as { company_id?: string };
  if (!company_id) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, company_id, res))) return;

  try {
    res.json(await generateCompanyInsights(company_id));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Insights generation failed" });
  }
});

// ═══ Phase 2 — Proactive AI Accountant workspace ═════════════════════════════
// All routes below are analysis/read + explicit review decisions only.
// The AI never posts transactions, creates documents or changes records here.

// ── POST /api/ai/accountant/refresh ──────────────────────────────────────────
// Run all proactive detectors and sync findings into recommendations.
router.post("/accountant/refresh", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id } = req.body as { company_id?: string };
  if (!company_id) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertWriteAccess(userId, company_id, res))) return;
  try {
    res.json(await syncDetections(company_id, userId));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Detection run failed" });
  }
});

// ── GET /api/ai/accountant/summary?company_id= ───────────────────────────────
router.get("/accountant/summary", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.query["company_id"] as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, companyId, res))) return;
  res.json(await getWorkspaceSummary(companyId));
});

// ── GET /api/ai/accountant/recommendations?company_id=&status=open,snoozed ───
router.get("/accountant/recommendations", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.query["company_id"] as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, companyId, res))) return;
  const statusParam = req.query["status"] as string | undefined;
  const statuses = statusParam ? statusParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  res.json({ recommendations: await listRecommendations(companyId, statuses) });
});

// ── POST /api/ai/accountant/recommendations/:id/decision ─────────────────────
// Explicit user decision: approve | dismiss | snooze | reopen. Requires write role.
router.post("/accountant/recommendations/:id/decision", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const id = req.params["id"] as string;
  const { decision, note, snoozed_until } = req.body as { decision?: string; note?: string; snoozed_until?: string };
  const valid: Decision[] = ["approved", "dismissed", "snoozed", "reopened"];
  if (!decision || !valid.includes(decision as Decision)) {
    res.status(400).json({ error: `decision must be one of: ${valid.join(", ")}` });
    return;
  }

  const [row] = await db
    .select().from(aiRecommendationsTable)
    .where(eq(aiRecommendationsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Recommendation not found" }); return; }
  if (!(await assertWriteAccess(userId, row.company_id, res))) return;

  try {
    const updated = await decideRecommendation(id, decision as Decision, userId, note, snoozed_until);
    res.json({ success: true, recommendation: updated });
  } catch (e) {
    res.status(409).json({ error: e instanceof Error ? e.message : "Decision failed" });
  }
});

// ── GET /api/ai/accountant/decisions?company_id= ─────────────────────────────
router.get("/accountant/decisions", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.query["company_id"] as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, companyId, res))) return;
  res.json({ decisions: await listDecisions(companyId) });
});

// ── GET /api/ai/accountant/activity?company_id= ──────────────────────────────
router.get("/accountant/activity", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.query["company_id"] as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, companyId, res))) return;
  res.json({ activity: await listActivity(companyId) });
});

// ── GET /api/ai/accountant/explain?bank_transaction_id= ──────────────────────
router.get("/accountant/explain", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const txnId = req.query["bank_transaction_id"] as string | undefined;
  if (!txnId) { res.status(400).json({ error: "bank_transaction_id is required" }); return; }

  const [txn] = await db
    .select().from(bankTransactionsTable)
    .where(eq(bankTransactionsTable.id, txnId)).limit(1);
  if (!txn) { res.status(404).json({ error: "Transaction not found" }); return; }
  if (!(await assertMember(userId, txn.company_id, res))) return;

  try {
    res.json(await explainTransaction(txnId));
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Explanation failed" });
  }
});

// ═══ Phase 4 — Continuous AI Accountant task engine ══════════════════════════
// Task decisions update the review queue only. They never post or alter books.

// ── POST /api/ai/accountant/tasks/refresh ─────────────────────────────────────
router.post("/accountant/tasks/refresh", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id } = req.body as { company_id?: string };
  if (!company_id) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertWriteAccess(userId, company_id, res))) return;
  try {
    res.json(await runAITaskAnalysis(company_id, userId));
  } catch (e) {
    req.log.error({ err: e }, "AI task refresh failed");
    res.status(500).json({ error: "Task analysis failed" });
  }
});

// ── GET /api/ai/accountant/tasks/summary?company_id= ──────────────────────────
router.get("/accountant/tasks/summary", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.query["company_id"] as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, companyId, res))) return;
  res.json(await getAITaskWorkspaceSummary(companyId));
});

// ── GET /api/ai/accountant/tasks?company_id=&status=open,reviewing ────────────
router.get("/accountant/tasks", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.query["company_id"] as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, companyId, res))) return;
  const rawStatuses = (req.query["status"] as string | undefined)
    ?.split(",")
    .map((status) => status.trim())
    .filter(Boolean);
  if (rawStatuses?.some((status) => !AI_TASK_STATUSES.includes(status as AITaskStatus))) {
    res.status(400).json({ error: `status must be one of: ${AI_TASK_STATUSES.join(", ")}` });
    return;
  }
  res.json({ tasks: await listAITasks(companyId, rawStatuses as AITaskStatus[] | undefined) });
});

// ── GET /api/ai/accountant/tasks/:id ──────────────────────────────────────────
router.get("/accountant/tasks/:id", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const rawId = req.params["id"];
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) { res.status(400).json({ error: "task id is required" }); return; }
  const task = await getAITask(id);
  if (!task) { res.status(404).json({ error: "AI task not found" }); return; }
  if (!(await assertMember(userId, task.company_id, res))) return;
  res.json({ task });
});

// ── POST /api/ai/accountant/tasks/:id/review ──────────────────────────────────
router.post("/accountant/tasks/:id/review", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const rawId = req.params["id"];
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) { res.status(400).json({ error: "task id is required" }); return; }
  const task = await getAITask(id);
  if (!task) { res.status(404).json({ error: "AI task not found" }); return; }
  if (!(await assertWriteAccess(userId, task.company_id, res))) return;
  res.json({ task: await markAITaskReviewing(id, userId) });
});

// ── POST /api/ai/accountant/tasks/:id/decision ────────────────────────────────
router.post("/accountant/tasks/:id/decision", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const rawId = req.params["id"];
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const { decision } = req.body as { decision?: string };
  if (!id) { res.status(400).json({ error: "task id is required" }); return; }
  if (decision !== "approved" && decision !== "dismissed") {
    res.status(400).json({ error: "decision must be one of: approved, dismissed" });
    return;
  }
  const task = await getAITask(id);
  if (!task) { res.status(404).json({ error: "AI task not found" }); return; }
  if (!(await assertWriteAccess(userId, task.company_id, res))) return;
  try {
    res.json({ success: true, task: await decideAITask(id, decision, userId) });
  } catch (e) {
    req.log.warn({ err: e, task_id: id }, "AI task decision failed");
    res.status(409).json({ error: e instanceof Error ? e.message : "Task decision failed" });
  }
});

// ═══ Phase 4C — Customer collections and approval-first reminders ════════════
// Collection facts are deterministic. Draft creation and every audit event are
// explicit user actions; none of these routes sends email or mutates invoices.

router.get("/accountant/collections/overview", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.query["company_id"] as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, companyId, res))) return;
  try {
    res.json(await getCollectionsOverview(companyId));
  } catch (error) {
    req.log.error({ err: error, company_id: companyId }, "Collections overview failed");
    res.status(500).json({ error: "Could not load collections overview" });
  }
});

router.post("/accountant/collections/refresh", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id: companyId } = req.body as { company_id?: string };
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertWriteAccess(userId, companyId, res))) return;
  try {
    // This refreshes review tasks only. It never posts payments or changes
    // customer or invoice balances.
    res.json(await syncAITasks(companyId, userId));
  } catch (error) {
    req.log.error({ err: error, company_id: companyId }, "Collections refresh failed");
    res.status(500).json({ error: "Could not refresh collection tasks" });
  }
});

router.post("/accountant/collections/reminders/draft", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id: companyId, invoice_id: invoiceId, tone } = req.body as {
    company_id?: string; invoice_id?: string; tone?: ReminderTone;
  };
  if (!companyId || !invoiceId || !tone) { res.status(400).json({ error: "company_id, invoice_id, and tone are required" }); return; }
  // The draft is persisted to auditable history, so this follows the same
  // company write boundary as task analysis and task decisions.
  if (!(await assertWriteAccess(userId, companyId, res))) return;
  try {
    res.json({ draft: await generateReminderDraft(companyId, invoiceId, tone, userId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate reminder draft";
    res.status(message.includes("not found") ? 404 : 400).json({ error: message });
  }
});

router.post("/accountant/collections/reminders/approve", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id: companyId, invoice_id: invoiceId, tone, subject, body } = req.body as {
    company_id?: string; invoice_id?: string; tone?: ReminderTone; subject?: string; body?: string;
  };
  if (!companyId || !invoiceId || !tone || typeof subject !== "string" || typeof body !== "string") {
    res.status(400).json({ error: "company_id, invoice_id, tone, subject, and body are required" }); return;
  }
  if (!(await assertWriteAccess(userId, companyId, res))) return;
  try {
    res.json({ handoff: await approveReminderForEmail(companyId, invoiceId, tone, subject, body, userId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not approve reminder";
    res.status(message.includes("not found") ? 404 : 400).json({ error: message });
  }
});

router.post("/accountant/collections/reminders/sent", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id: companyId, invoice_id: invoiceId, tone, subject, body, approval_id: approvalId } = req.body as {
    company_id?: string; invoice_id?: string; tone?: ReminderTone; subject?: string; body?: string; approval_id?: string;
  };
  if (!companyId || !invoiceId || !tone || typeof subject !== "string" || typeof body !== "string" || !approvalId) {
    res.status(400).json({ error: "company_id, invoice_id, tone, subject, body, and approval_id are required" }); return;
  }
  if (!(await assertWriteAccess(userId, companyId, res))) return;
  try {
    await recordReminderSent(companyId, invoiceId, tone, subject, body, approvalId, userId);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not record sent reminder";
    res.status(message.includes("not found") ? 404 : 400).json({ error: message });
  }
});

// ═══ Phase 4D — VAT Assistant ════════════════════════════════════════════════
// VAT figures are generated server-side from source documents in integer pence.
// These routes never change source accounting records and never submit to HMRC.

router.get("/accountant/vat/overview", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.query["company_id"] as string | undefined;
  const start = req.query["period_start"] as string | undefined;
  const end = req.query["period_end"] as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, companyId, res))) return;
  try {
    res.json(await getVATOverview(companyId, start, end));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not calculate VAT overview" });
  }
});

router.post("/accountant/vat/review/refresh", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id: companyId, period_start: start, period_end: end } = req.body as { company_id?: string; period_start?: string; period_end?: string };
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertWriteAccess(userId, companyId, res))) return;
  try {
    res.json(await syncVATExceptions(companyId, userId, start, end));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not refresh VAT review" });
  }
});

router.get("/accountant/vat/exceptions", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.query["company_id"] as string | undefined;
  const start = req.query["period_start"] as string | undefined;
  const end = req.query["period_end"] as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, companyId, res))) return;
  res.json({ exceptions: await listVATExceptions(companyId, start, end) });
});

router.post("/accountant/vat/exceptions/:id/resolve", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.body?.company_id as string | undefined;
  const note = req.body?.note as string | undefined;
  if (!companyId || !note?.trim()) { res.status(400).json({ error: "company_id and a review note are required" }); return; }
  if (!(await assertWriteAccess(userId, companyId, res))) return;
  try {
    res.json({ exception: await resolveVATException(companyId, String(req.params["id"]), userId, note.trim()) });
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "VAT exception not found" });
  }
});

router.post("/accountant/vat/explain", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id: companyId, period_start: start, period_end: end, question } = req.body as { company_id?: string; period_start?: string; period_end?: string; question?: string };
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, companyId, res))) return;
  try {
    const overview = await getVATOverview(companyId, start, end);
    res.json(explainVATOverview(overview, typeof question === "string" ? question.slice(0, 500) : undefined));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not explain VAT position" });
  }
});

router.put("/accountant/vat/settings", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id: companyId, ...settings } = req.body as Record<string, unknown> & { company_id?: string };
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertWriteAccess(userId, companyId, res))) return;
  try {
    res.json({ company: await updateVATSettings(companyId, settings, userId) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not save VAT settings" });
  }
});

router.post("/accountant/vat/tax-rules", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id: companyId, ...rule } = req.body as Record<string, unknown> & { company_id?: string };
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertWriteAccess(userId, companyId, res))) return;
  try {
    res.json({ rule: await addVATTaxRule(companyId, rule, userId) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not create VAT tax rule" });
  }
});

router.post("/accountant/vat/returns", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id: companyId, period_start: start, period_end: end } = req.body as { company_id?: string; period_start?: string; period_end?: string };
  if (!companyId || !start || !end) { res.status(400).json({ error: "company_id, period_start, and period_end are required" }); return; }
  if (!(await assertWriteAccess(userId, companyId, res))) return;
  try {
    res.status(201).json(await createVATReturn(companyId, start, end, userId));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Could not create VAT return" });
  }
});

router.get("/accountant/vat/returns/:id", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.query["company_id"] as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertMember(userId, companyId, res))) return;
  try {
    res.json(await getVATReturnDetail(companyId, String(req.params["id"])));
  } catch (error) {
    res.status(404).json({ error: error instanceof Error ? error.message : "VAT return not found" });
  }
});

router.post("/accountant/vat/returns/:id/recalculate", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.body?.company_id as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertWriteAccess(userId, companyId, res))) return;
  try {
    res.json(await recalculateVATReturn(companyId, String(req.params["id"]), userId));
  } catch (error) {
    res.status(409).json({ error: error instanceof Error ? error.message : "Could not recalculate VAT return" });
  }
});

router.post("/accountant/vat/returns/:id/ready", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.body?.company_id as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertWriteAccess(userId, companyId, res))) return;
  try { res.json({ vat_return: await markVATReturnReady(companyId, String(req.params["id"]), userId) }); }
  catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : "Could not mark VAT return ready" }); }
});

router.post("/accountant/vat/returns/:id/approve", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.body?.company_id as string | undefined;
  const note = req.body?.note as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertWriteAccess(userId, companyId, res))) return;
  try { res.json({ vat_return: await approveVATReturn(companyId, String(req.params["id"]), userId, note) }); }
  catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : "Could not approve VAT return" }); }
});

router.post("/accountant/vat/returns/:id/revision", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.body?.company_id as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertWriteAccess(userId, companyId, res))) return;
  try { res.status(201).json(await createVATRevision(companyId, String(req.params["id"]), userId)); }
  catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : "Could not create VAT return revision" }); }
});

router.post("/accountant/vat/adjustments", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const { company_id: companyId, vat_return_id: vatReturnId = null, period_start, period_end, box_number, amount, reason } = req.body as {
    company_id?: string; vat_return_id?: string | null; period_start?: string; period_end?: string; box_number?: number; amount?: number; reason?: string;
  };
  if (!companyId || !period_start || !period_end || box_number == null || amount == null || !reason) { res.status(400).json({ error: "company_id, period, box_number, amount, and reason are required" }); return; }
  if (!(await assertWriteAccess(userId, companyId, res))) return;
  try { res.status(201).json({ adjustment: await createVATAdjustment(companyId, vatReturnId, { period_start, period_end, box_number, amount, reason }, userId) }); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Could not create VAT adjustment" }); }
});

router.post("/accountant/vat/adjustments/:id/approve", async (req: Request, res: Response): Promise<void> => {
  const { userId } = req as AuthenticatedRequest;
  const companyId = req.body?.company_id as string | undefined;
  if (!companyId) { res.status(400).json({ error: "company_id is required" }); return; }
  if (!(await assertWriteAccess(userId, companyId, res))) return;
  try { res.json({ adjustment: await approveVATAdjustment(companyId, String(req.params["id"]), userId) }); }
  catch (error) { res.status(409).json({ error: error instanceof Error ? error.message : "Could not approve VAT adjustment" }); }
});

export default router;
