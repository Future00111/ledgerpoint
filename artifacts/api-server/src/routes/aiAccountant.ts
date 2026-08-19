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
  companyUsersTable,
  bankTransactionsTable,
  chartOfAccountsTable,
  aiReconciliationResultsTable,
} from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  analyseTransactions,
  applyReconciliationApproval,
  categoriseByRules,
  categoriseWithAI,
  generateCompanyInsights,
  getReviewSummary,
  type ApprovalRecord,
} from "../services/ai-accountant/index.js";

const router: IRouter = Router();
router.use(requireAuth);

const WRITE_BLOCKED_ROLES = new Set(["read_only"]);

async function getMembership(userId: string, companyId: string) {
  const [m] = await db
    .select({ company_id: companyUsersTable.company_id, role: companyUsersTable.role })
    .from(companyUsersTable)
    .where(and(eq(companyUsersTable.user_id, userId), eq(companyUsersTable.company_id, companyId)))
    .limit(1);
  return m ?? null;
}

async function assertMember(userId: string, companyId: string, res: Response): Promise<boolean> {
  const m = await getMembership(userId, companyId);
  if (!m) { res.status(403).json({ error: "Access denied" }); return false; }
  return true;
}

async function assertWriteAccess(userId: string, companyId: string, res: Response): Promise<boolean> {
  const m = await getMembership(userId, companyId);
  if (!m) { res.status(403).json({ error: "Access denied" }); return false; }
  if (WRITE_BLOCKED_ROLES.has(m.role ?? "")) {
    res.status(403).json({ error: "Your role does not permit this operation" });
    return false;
  }
  return true;
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
      if (!(await assertMember(userId, txn.company_id, res))) return;
      companyId = txn.company_id;
      txns = [txn];
    } else if (company_id) {
      if (!(await assertMember(userId, company_id, res))) return;
      companyId = company_id;
      txns = await db
        .select().from(bankTransactionsTable)
        .where(and(eq(bankTransactionsTable.company_id, company_id), eq(bankTransactionsTable.status, "review")));
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
  if (!(await assertMember(userId, company_id, res))) return;

  const conditions = [
    eq(bankTransactionsTable.company_id, company_id),
    eq(bankTransactionsTable.status, "review"),
  ];
  if (Array.isArray(bank_transaction_ids) && bank_transaction_ids.length > 0) {
    conditions.push(inArray(bankTransactionsTable.id, bank_transaction_ids));
  }
  const txns = await db.select().from(bankTransactionsTable).where(and(...conditions));

  const suggestions: Record<string, { category: string; confidence: number; source: string }> = {};
  const unresolved: typeof txns = [];
  for (const t of txns) {
    const byRule = categoriseByRules(t);
    if (byRule) suggestions[t.id] = byRule;
    else unresolved.push(t);
  }

  // AI pass only for what the rules couldn't classify.
  if (unresolved.length > 0) {
    const accounts = await db
      .select({ name: chartOfAccountsTable.name })
      .from(chartOfAccountsTable)
      .where(eq(chartOfAccountsTable.company_id, company_id));
    const aiResults = await categoriseWithAI(unresolved, accounts.map((a) => a.name ?? "").filter(Boolean));
    Object.assign(suggestions, aiResults);
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

export default router;
