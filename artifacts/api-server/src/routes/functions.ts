import { canWriteCompanyData } from "../security/roles";
import { bankImportSides } from "../services/bankImportMoney";
import { publicErrorMessage, safeErrorLog, safeRouteErrors } from "../security/publicErrors";
/**
 * /api/functions/:name — server-side business logic functions.
 *
 * Security model (applied to EVERY mutating handler):
 *  1. Load the target record from the database first.
 *  2. Derive company_id from the RECORD, never from a caller-supplied parameter.
 *  3. Verify the requesting user is a member of that company.
 *  4. Reject read_only members on any write operation.
 *
 * askAI uses the native AI service. Unavailable integrations fail explicitly.
 * suggestTransactionMatches uses the shared reconciliation analysis service.
 */
import { Router, type Request, type Response, type RequestHandler } from "express";
import { db } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { retiredChartBootstrapBoundary } from "./legacyChartBootstrapPolicy";
import {
  requireCompanyScope,
} from "../middlewares/companyScope";
import { aiService, AIProviderError } from "../services/ai/index.js";
import {
  companyUsersTable,
  companiesTable,
  bankTransactionsTable,
  bankAccountsTable,
  aiReconciliationResultsTable,
  bankAutomationSettingsTable,
} from "@workspace/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import {
  analyseTransactions,
  applyReconciliationApproval,
  applyNonPaymentReconciliationMatch,
  type ApprovalRecord,
  type NonPaymentMatchInput,
} from "../services/ai-accountant/index.js";

export function createFunctionsRouter(authenticate: RequestHandler = requireAuth) {
const router = Router();
router.use(authenticate);

// ─── helpers ─────────────────────────────────────────────────────────────────



/**
 * Assert read+write access: caller must be a member of companyId and must not
 * have the read_only role. Explicit caller context must agree with the resource;
 * an omitted context still uses the resource company. Failure ends the response.
 */
async function assertWriteAccess(
  userId: string,
  companyId: string,
  res: Response,
  requestedCompanyId?: unknown,
): Promise<boolean> {
  const scope = await requireCompanyScope(res, {
    userId,
    requestedCompanyId,
    resourceCompanyId: companyId,
  });
  if (!scope) {
    return false;
  }
  if (!canWriteCompanyData(scope.role)) {
    res.status(403).json({ error: "Your role does not permit this operation" });
    return false;
  }
  return true;
}

// ─── Unavailable integration functions (honest 503) ─────────────────────
const UNAVAILABLE_FUNCTIONS = new Set([
  "generateInsights",
  "createRecordFromDocument",
  "mockScanEmails",
  "getAccountantClientList",
]);

// ─── POST /api/functions/:name ────────────────────────────────────────────────
router.post("/:name", retiredChartBootstrapBoundary, async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const funcName = req.params["name"] as string;
  const args = req.body as Record<string, unknown>;
  if (["postPurchaseBill","generateSalesInvoiceJournals","generatePurchaseBillJournals",
    "postSalesInvoice","postSalesCreditNote","postSupplierCreditNote","applySalesCreditNote","applySupplierCreditNote","updatePaymentStatus"].includes(funcName)) {
    res.status(403).json({error:"Use the protected native accounting document review/post workflow. Legacy financial effects are disabled."});
    return;
  }
  if (["generateDemoData", "resetDemoData", "manageDemoCompany"].includes(funcName)) {
    res.status(410).json({ code: "LEGACY_DEMO_RETIRED", error: "Legacy demo management has been retired. Use the native accounting screens for sample records." });
    return;
  }

  if (UNAVAILABLE_FUNCTIONS.has(funcName)) {
    res.status(503).json({
      error: `${funcName} requires additional implementation and is not yet available.`,
      notYetAvailable: true,
    });
    return;
  }

  if (!args || typeof args !== "object" || Array.isArray(args)) {
    res.status(400).json({ error: "A function arguments object is required" });
    return;
  }

  try {
    switch (funcName) {
      // ── testAI ───────────────────────────────────────────────────────────
      // Sends a minimal prompt through the central AI service and confirms
      // the active provider is reachable.  Safe to call without company context.
      case "testAI": {
        const result = await aiService.complete({
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant for Ledgerly, a UK accounting application.",
            },
            {
              role: "user",
              content:
                (args["prompt"] as string | undefined) ??
                "Reply with a single sentence confirming the AI integration is working.",
            },
          ],
          maxTokens: 128,
          temperature: 0,
        });
        res.json({
          ok: true,
          provider: result.provider,
          model: result.model,
          reply: result.text,
        });
        return;
      }

      // ── askAI ────────────────────────────────────────────────────────────
      // General-purpose AI chat for accounting questions within a company.
      case "askAI": {
        const { company_id, messages, prompt } = args as {
          company_id?: string;
          messages?: Array<{ role: string; content: string }>;
          prompt?: string;
        };

        // Omitted context permits general chat. Explicit malformed context must
        // never downgrade a company request into an unscoped provider call.
        if (company_id !== undefined) {
          const scope = await requireCompanyScope(res, { userId, requestedCompanyId: company_id });
          if (!scope) return;
        }

        // Accept either a pre-built messages array or a single prompt string.
        const chatMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          {
            role: "system",
            content:
              "You are Ledgerly AI, a helpful assistant specialising in UK accounting, VAT, payroll, and bookkeeping. " +
              "Provide clear, accurate, and concise answers. Do not provide legal or regulated financial advice.",
          },
        ];
        if (company_id) {
          // Give Ask Ledgerly a compact, company-scoped view of the review
          // queue. It is factual context only: the model cannot approve,
          // categorise, or alter a transaction.
          const analyses = await db.select({
            decision_state: aiReconciliationResultsTable.decision_state,
            priority_band: aiReconciliationResultsTable.priority_band,
            duplicate_flag: aiReconciliationResultsTable.duplicate_flag,
            vat_review_required: aiReconciliationResultsTable.vat_review_required,
            confidence: aiReconciliationResultsTable.confidence,
            remaining: aiReconciliationResultsTable.remaining,
          }).from(aiReconciliationResultsTable).where(and(
            eq(aiReconciliationResultsTable.company_id, company_id),
            eq(aiReconciliationResultsTable.approval_state, "pending"),
          )).limit(100);
          const byState = analyses.reduce<Record<string, number>>((counts, analysis) => {
            const state = analysis.decision_state ?? "REVIEW_REQUIRED";
            counts[state] = (counts[state] ?? 0) + 1;
            return counts;
          }, {});
          chatMessages.push({
            role: "system",
            content: `Company transaction-review context (deterministic, current): ${JSON.stringify({
              total_pending: analyses.length,
              by_state: byState,
              possible_duplicates: analyses.filter((analysis) => analysis.duplicate_flag).length,
              vat_reviews: analyses.filter((analysis) => analysis.vat_review_required).length,
              high_priority: analyses.filter((analysis) => analysis.priority_band === "high").length,
            })}. Explain these facts clearly and state that a user must review and explicitly approve any accounting change.`,
          });
        }

        if (messages && messages.length > 0) {
          for (const m of messages) {
            if (m.role === "user" || m.role === "assistant" || m.role === "system") {
              chatMessages.push({ role: m.role, content: m.content });
            }
          }
        } else if (prompt) {
          chatMessages.push({ role: "user", content: prompt });
        } else {
          res.status(400).json({ error: "Provide either a 'prompt' string or a 'messages' array." });
          return;
        }

        const result = await aiService.complete({
          messages: chatMessages,
          maxTokens: 1024,
          temperature: 0.7,
        });

        res.json({
          reply: result.text,
          provider: result.provider,
          model: result.model,
        });
        return;
      }

      // ── approveReconciliationMatches ─────────────────────────────────────
      // Atomically reconcile one bank transaction against one or more sales
      // invoices / purchase bills. All validation and writes happen inside a
      // single DB transaction: the bank transaction must still be in review,
      // every record must belong to the same company, and each payment delta
      // is capped at the record's current outstanding balance.
      case "approveReconciliationMatches": {
        const { bank_transaction_id, records } = args as {
          bank_transaction_id?: string;
          records?: { record_type: string; record_id: string }[];
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
          .select()
          .from(bankTransactionsTable)
          .where(eq(bankTransactionsTable.id, bank_transaction_id))
          .limit(1);
        if (!txn) { res.status(404).json({ error: "Transaction not found" }); return; }
        if (!(await assertWriteAccess(userId, txn.company_id, res, args["company_id"]))) return;

        try {
          // Shared atomic approval implementation (services/ai-accountant).
          const result = await applyReconciliationApproval(
            bank_transaction_id,
            records as ApprovalRecord[],
            userId,
          );
          res.json({ success: true, ...result });
        } catch (e) {
          res.status(409).json({ error: publicErrorMessage(e, "Reconciliation failed") });
        }
        break;
      }

      // ── approveNonPaymentReconciliationMatch ─────────────────────────────
      // Credit-note and ledger/categorisation matches still need the same row
      // lock, company validation, and all-link clearing as payment matches.
      case "approveNonPaymentReconciliationMatch": {
        const { bank_transaction_id, record_type, record_id, record_number, category, vat_rate, notes } = args as {
          bank_transaction_id?: string;
          record_type?: NonPaymentMatchInput["record_type"];
          record_id?: string;
          record_number?: string;
          category?: string;
          vat_rate?: number | null;
          notes?: string | null;
        };
        if (!bank_transaction_id || !record_type || !["sales_credit_note", "supplier_credit_note", "ledger_account"].includes(record_type)) {
          res.status(400).json({ error: "A bank transaction and valid non-payment match type are required" });
          return;
        }

        const [txn] = await db.select().from(bankTransactionsTable)
          .where(eq(bankTransactionsTable.id, bank_transaction_id)).limit(1);
        if (!txn) { res.status(404).json({ error: "Transaction not found" }); return; }
        if (!(await assertWriteAccess(userId, txn.company_id, res, args["company_id"]))) return;

        try {
          const result = await applyNonPaymentReconciliationMatch(bank_transaction_id, {
            record_type,
            record_id,
            record_number,
            category,
            vat_rate,
            notes,
          }, userId);
          res.json({ success: true, ...result });
        } catch (e) {
          res.status(409).json({ error: publicErrorMessage(e, "Reconciliation failed") });
        }
        break;
      }

      // ── recordBankTransfer ────────────────────────────────────────────────
      case "recordBankTransfer": {
        const { bank_transaction_id, to_account_id, amount, description } = args as {
          bank_transaction_id?: string;
          to_account_id?: string;
          amount?: number;
          description?: string;
        };
        if (!bank_transaction_id || !to_account_id || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
          res.status(400).json({ error: "Bank transaction, destination account, and positive amount are required" });
          return;
        }
        const [source] = await db.select().from(bankTransactionsTable)
          .where(eq(bankTransactionsTable.id, bank_transaction_id)).limit(1);
        if (!source) { res.status(404).json({ error: "Transaction not found" }); return; }
        if (!(await assertWriteAccess(userId, source.company_id, res, args["company_id"]))) return;

        try {
          const result = await db.transaction(async (tx) => {
            const [fresh] = await tx.select().from(bankTransactionsTable)
              .where(eq(bankTransactionsTable.id, bank_transaction_id)).for("update");
            if (!fresh || (fresh.status !== "review" && fresh.status !== "unmatched")) {
              throw new Error("This transaction has already been reconciled");
            }
            const [destination] = await tx.select().from(bankAccountsTable)
              .where(eq(bankAccountsTable.id, to_account_id)).for("update");
            if (!destination || destination.company_id !== fresh.company_id) {
              throw new Error("Destination bank account belongs to a different company");
            }
            const inPence = Math.round(Number(fresh.money_in || 0) * 100);
            const outPence = Math.round(Number(fresh.money_out || 0) * 100);
            const sourcePence = inPence || outPence;
            const transferPence = Math.round(Number(amount) * 100);
            if ((inPence <= 0 && outPence <= 0) || (inPence > 0 && outPence > 0) || transferPence !== sourcePence) {
              throw new Error("Transfer amount must exactly match a one-sided bank transaction");
            }
            const label = `Transfer ${inPence > 0 ? "to" : "from"} ${destination.account_name}`;
            const [created] = await tx.insert(bankTransactionsTable).values({
              company_id: fresh.company_id,
              bank_account_id: destination.id,
              date: fresh.date,
              description: description || label,
              reference: "Transfer",
              amount: (transferPence / 100).toFixed(2),
              money_in: inPence > 0 ? "0.00" : (transferPence / 100).toFixed(2),
              money_out: inPence > 0 ? (transferPence / 100).toFixed(2) : "0.00",
              transaction_type: "transfer",
              status: "matched",
              matched_type: "ledger_account",
              matched_record_number: label,
              linked_invoice_id: null,
              linked_bill_id: null,
              linked_credit_note_id: null,
            }).returning();
            const updateData = {
              status: "matched",
              matched_type: "ledger_account",
              matched_record_id: null,
              matched_record_number: label,
              reference: description || fresh.reference,
              linked_invoice_id: null,
              linked_bill_id: null,
              linked_credit_note_id: null,
              updated_at: new Date(),
            };
            await tx.update(bankTransactionsTable).set(updateData)
              .where(eq(bankTransactionsTable.id, bank_transaction_id));
            return { updateData, created };
          });
          res.json({ success: true, ...result });
        } catch (e) {
          res.status(409).json({ error: publicErrorMessage(e, "Transfer could not be recorded") });
        }
        break;
      }

      // ── recordBankTransaction(s) ──────────────────────────────────────────
      // Initial bank entry/import is deliberately separate from generic CRUD:
      // it only creates a new, one-sided transaction awaiting review and can
      // never inject reconciliation state or document links.
      case "recordBankTransaction":
      case "recordBankTransactions": {
        const isBatch = funcName === "recordBankTransactions";
        const entries = isBatch
          ? (args as { transactions?: Array<Record<string, unknown>> }).transactions
          : [args as Record<string, unknown>];
        const companyId = (args as { company_id?: string }).company_id;
        if (typeof companyId !== "string" || !companyId.trim() || !Array.isArray(entries) || entries.length === 0) {
          res.status(400).json({ error: "A company and at least one bank transaction are required" });
          return;
        }
        // Imported rows may retain the workspace where they were prepared.
        // Never silently relabel those rows with a later selected company;
        // validate the entire batch before membership reads or any inserts.
        if (entries.some(entry => !entry || typeof entry !== "object" || Array.isArray(entry) ||
          (entry.company_id !== undefined && entry.company_id !== companyId))) {
          res.status(400).json({ error: "Each bank transaction must be an object in the selected company" });
          return;
        }
        if (!(await assertWriteAccess(userId, companyId, res))) return;

        // Validate every amount before entering the batch transaction. Direct
        // callers must obey the same penny precision as the statement importer.
        try { entries.forEach(bankImportSides); }
        catch (error) {
          res.status(400).json({ error: publicErrorMessage(error, "Invalid bank amount") });
          return;
        }
        try {
          const created = await db.transaction(async (tx) => {
            const rows = [];
            for (const entry of entries) {
              const { inPence, outPence } = bankImportSides(entry);
              const vatRate = entry.vat_rate == null || entry.vat_rate === ""
                ? null
                : Number(entry.vat_rate);
              if (vatRate != null && (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100)) {
                throw new Error("VAT rate must be between 0 and 100");
              }
              const bankAccountId = typeof entry.bank_account_id === "string" && entry.bank_account_id
                ? entry.bank_account_id
                : null;
              if (bankAccountId) {
                const [account] = await tx.select().from(bankAccountsTable)
                  .where(eq(bankAccountsTable.id, bankAccountId)).for("update");
                if (!account || account.company_id !== companyId) {
                  throw new Error("Bank account belongs to a different company");
                }
              }
              const totalPence = inPence || outPence;
              const [row] = await tx.insert(bankTransactionsTable).values({
                company_id: companyId,
                bank_account_id: bankAccountId,
                date: typeof entry.date === "string" ? entry.date : null,
                description: typeof entry.description === "string" ? entry.description.trim() : null,
                reference: typeof entry.reference === "string" ? entry.reference.trim() : null,
                amount: (totalPence / 100).toFixed(2),
                money_in: inPence > 0 ? (inPence / 100).toFixed(2) : "0.00",
                money_out: outPence > 0 ? (outPence / 100).toFixed(2) : "0.00",
                balance: entry.balance == null || entry.balance === "" ? null : String(entry.balance),
                transaction_type: typeof entry.transaction_type === "string"
                  ? entry.transaction_type
                  : typeof entry.type === "string" ? entry.type : null,
                status: "review",
                matched_type: null,
                matched_record_id: null,
                matched_record_number: null,
                linked_invoice_id: null,
                linked_bill_id: null,
                linked_credit_note_id: null,
                category: typeof entry.category === "string" ? entry.category : null,
                vat_rate: vatRate == null ? null : vatRate.toFixed(2),
                notes: typeof entry.notes === "string" ? entry.notes : null,
              }).returning();
              rows.push(row);
            }
            return rows;
          });
          const [automationSettings] = await db.select().from(bankAutomationSettingsTable)
            .where(eq(bankAutomationSettingsTable.company_id, companyId)).limit(1);
          let analysisSummary: unknown = null;
          // Imports must enter the same deterministic review queue as manually
          // entered bank items. Analysis only writes review metadata and never
          // links, posts, or changes the newly-created transactions.
          try {
            if (automationSettings?.automatic_analysis_enabled !== false) {
              const analysis = await analyseTransactions(companyId, created, { persist: true });
              analysisSummary = analysis.summary;
            }
          } catch (analysisError) {
            // The import itself is valid bookkeeping data. Preserve it when
            // optional analysis is temporarily unavailable, and surface the
            // failure in server logs rather than silently losing the receipt.
            req.log.warn({ ...safeErrorLog(analysisError), company_id: companyId }, "Imported transactions were not analysed");
          }
          res.status(201).json(isBatch
            ? { success: true, data: created, analysis_summary: analysisSummary, analysis_status: analysisSummary ? "complete" : "disabled" }
            : { success: true, data: created[0], analysis_summary: analysisSummary, analysis_status: analysisSummary ? "complete" : "disabled" });
        } catch (e) {
          res.status(400).json({ error: publicErrorMessage(e, "Bank transaction could not be recorded") });
        }
        break;
      }

      // ── updateBankTransactionClassification ───────────────────────────────
      // A controlled correction path for descriptive/classification fields.
      // It locks the bank row and validates VAT, but never changes money,
      // links, reconciliation state, or bank-account ownership.
      case "updateBankTransactionClassification": {
        const { bank_transaction_id, date, description, reference, transaction_type, category, vat_rate, notes } = args as {
          bank_transaction_id?: string; date?: string; description?: string; reference?: string;
          transaction_type?: string; category?: string; vat_rate?: number | string | null; notes?: string | null;
        };
        if (!bank_transaction_id) { res.status(400).json({ error: "bank_transaction_id is required" }); return; }
        const [existing] = await db.select().from(bankTransactionsTable)
          .where(eq(bankTransactionsTable.id, bank_transaction_id)).limit(1);
        if (!existing) { res.status(404).json({ error: "Transaction not found" }); return; }
        if (!(await assertWriteAccess(userId, existing.company_id, res, args["company_id"]))) return;
        const parsedVat = vat_rate == null || vat_rate === "" ? null : Number(vat_rate);
        if (parsedVat != null && (!Number.isFinite(parsedVat) || parsedVat < 0 || parsedVat > 100)) {
          res.status(400).json({ error: "VAT rate must be between 0 and 100" }); return;
        }
        const [updated] = await db.transaction(async (tx) => {
          const [fresh] = await tx.select().from(bankTransactionsTable)
            .where(eq(bankTransactionsTable.id, bank_transaction_id)).for("update");
          if (!fresh) throw new Error("Transaction not found");
          return tx.update(bankTransactionsTable).set({
            date: date ?? fresh.date,
            description: description ?? fresh.description,
            reference: reference ?? fresh.reference,
            transaction_type: transaction_type ?? fresh.transaction_type,
            category: category ?? fresh.category,
            vat_rate: parsedVat == null ? null : parsedVat.toFixed(2),
            notes: notes ?? fresh.notes,
            updated_at: new Date(),
          }).where(eq(bankTransactionsTable.id, bank_transaction_id)).returning();
        });
        res.json({ success: true, data: updated });
        break;
      }

      // ── suggestTransactionMatches ────────────────────────────────────────
      case "suggestTransactionMatches": {
        const { company_id: argCompanyId, bank_transaction_id } = args as {
          company_id?: string;
          bank_transaction_id?: string;
        };

        // Determine company scope and fetch transactions to score.
        let txnsToScore: (typeof bankTransactionsTable.$inferSelect)[];
        // Read-only members may inspect deterministic suggestions but must
        // never create, replace, or audit persisted analysis. Writers use the
        // same endpoint with persistence enabled.
        let persistAnalysis = false;

        if (bank_transaction_id) {
          // Single-transaction mode: load the specific transaction and derive company from it.
          const [txn] = await db
            .select()
            .from(bankTransactionsTable)
            .where(eq(bankTransactionsTable.id, bank_transaction_id))
            .limit(1);
          if (!txn) { res.status(404).json({ error: "Transaction not found" }); return; }
          // Resolve both caller and resource contexts through the shared guard.
          // A contradictory company_id must never be silently ignored.
          const scope = await requireCompanyScope(res, {
            userId,
            requestedCompanyId: argCompanyId,
            resourceCompanyId: txn.company_id,
          });
          if (!scope) return;
          persistAnalysis = canWriteCompanyData(scope.role);
          txnsToScore = [txn];
        } else if (argCompanyId) {
          // Bulk mode: verify membership then fetch all review-status transactions.
          const scope = await requireCompanyScope(res, {
            userId,
            requestedCompanyId: argCompanyId,
          });
          if (!scope) return;
          persistAnalysis = canWriteCompanyData(scope.role);
          txnsToScore = await db
            .select()
            .from(bankTransactionsTable)
            .where(
              and(
                eq(bankTransactionsTable.company_id, scope.companyId),
                eq(bankTransactionsTable.status, "review"),
              ),
            );
        } else {
          res.status(400).json({ error: "company_id or bank_transaction_id is required" });
          return;
        }

        if (txnsToScore.length === 0) { res.json({ suggestions: {} }); return; }

        const companyId = txnsToScore[0].company_id;

        // Shared AI Accountant analysis: deterministic matcher + scenario
        // classification + categorisation suggestions, persisted to
        // ai_reconciliation_results (kept separate from final linkage fields).
        const output = await analyseTransactions(companyId, txnsToScore, {
          persist: persistAnalysis,
          // A text explanation is optional and unavailable for a read-only
          // page load; read-only access remains entirely side-effect free.
          aiExplanation: persistAnalysis && Boolean(bank_transaction_id),
        });
        res.json(output);
        break;
      }

      // ── getUserCompanies ─────────────────────────────────────────────────
      case "getUserCompanies": {
        const memberships = await db
          .select({ company_id: companyUsersTable.company_id, role: companyUsersTable.role })
          .from(companyUsersTable)
          .where(and(
            eq(companyUsersTable.user_id, userId),
            eq(companyUsersTable.is_active, true),
          ));
        if (memberships.length === 0) { res.json({ data: [] }); return; }
        const companies = await db
          .select()
          .from(companiesTable)
          .where(inArray(companiesTable.id, memberships.map((m) => m.company_id)));
        res.json({ data: companies });
        break;
      }

      default:
        res.status(404).json({ error: `Unknown function: ${funcName}` });
    }
  } catch (err: unknown) {
    req.log.error({ ...safeErrorLog(err), funcName }, "function invocation error");
    res.status(500).json({ error: publicErrorMessage(err, "Internal error") });
  }
});

router.use(safeRouteErrors);

return router;
}

export default createFunctionsRouter();
