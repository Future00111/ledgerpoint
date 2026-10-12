/**
 * /api/functions/:name — server-side business logic functions.
 *
 * Security model (applied to EVERY mutating handler):
 *  1. Load the target record from the database first.
 *  2. Derive company_id from the RECORD, never from a caller-supplied parameter.
 *  3. Verify the requesting user is a member of that company.
 *  4. Reject read_only members on any write operation.
 *
 * AI-powered functions (askAI, generateInsights, createRecordFromDocument)
 * return a clear "not yet available" 503 so callers surface honest UI feedback.
 * suggestTransactionMatches is implemented with a rule-based matcher (no AI).
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import {
  findActiveMembership,
  requireCompanyScope,
} from "../middlewares/companyScope";
import { aiService, AIProviderError } from "../services/ai/index.js";
import {
  companyUsersTable,
  companiesTable,
  salesInvoicesTable,
  purchaseBillsTable,
  salesCreditNotesTable,
  supplierCreditNotesTable,
  bankTransactionsTable,
  bankAccountsTable,
  chartOfAccountsTable,
  customersTable,
  suppliersTable,
  documentsTable,
  aiReconciliationResultsTable,
  vatReturnsTable,
  journalEntriesTable,
  emailCaptureLogsTable,
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

const router = Router();
router.use(requireAuth);

// ─── helpers ─────────────────────────────────────────────────────────────────

const WRITE_BLOCKED_ROLES = new Set(["read_only"]);

async function getMembership(
  userId: string,
  companyId: string,
): Promise<{ company_id: string; role: string | null; is_active: boolean | null } | null> {
  return findActiveMembership(userId, companyId);
}

/**
 * Assert read+write access: caller must be a member of companyId and must not
 * have the read_only role.  Returns 403 and ends the response on failure.
 */
async function assertWriteAccess(
  userId: string,
  companyId: string,
  res: Response,
): Promise<boolean> {
  const scope = await requireCompanyScope(res, {
    userId,
    requestedCompanyId: companyId,
  });
  if (!scope) {
    return false;
  }
  if (WRITE_BLOCKED_ROLES.has(scope.role ?? "")) {
    res.status(403).json({ error: "Your role does not permit this operation" });
    return false;
  }
  return true;
}

// ─── AI functions not yet fully implemented (honest 503) ─────────────────────
const UNIMPLEMENTED_AI_FUNCTIONS = new Set([
  "generateInsights",
  "createRecordFromDocument",
]);

// ─── POST /api/functions/:name ────────────────────────────────────────────────
router.post("/:name", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const funcName = req.params["name"] as string;
  const args = req.body as Record<string, unknown>;

  if (UNIMPLEMENTED_AI_FUNCTIONS.has(funcName)) {
    res.status(503).json({
      error: `${funcName} requires additional implementation and is not yet available. This feature is coming soon.`,
      notYetAvailable: true,
    });
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

        // Verify membership when a company is supplied.
        if (company_id) {
          const m = await getMembership(userId, company_id);
          if (!m) {
            res.status(403).json({ error: "Access denied" });
            return;
          }
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

      // ── updatePaymentStatus ──────────────────────────────────────────────
      case "updatePaymentStatus": {
        const { entity_type, record_id, amount_paid_delta } = args as {
          entity_type: string;
          record_id: string;
          amount_paid_delta: number;
        };
        const table =
          entity_type === "sales_invoice" ? salesInvoicesTable :
          entity_type === "purchase_bill" ? purchaseBillsTable : null;

        if (!table) {
          res.status(400).json({ error: `Unknown entity_type: ${entity_type}` });
          return;
        }

        // Step 1: load the record to get its ACTUAL company_id
        const rows = await db.select().from(table).where(eq(table["id"], record_id)).limit(1);
        if (!rows[0]) { res.status(404).json({ error: "Record not found" }); return; }
        const companyId = (rows[0] as Record<string, unknown>)["company_id"] as string;

        // Step 2: verify membership AND write role on the record's actual company
        if (!(await assertWriteAccess(userId, companyId, res))) return;

        // Keep payment totals, the remaining balance, and the document status
        // in sync. Numeric columns arrive from Postgres as strings, so operate
        // in integer pence to avoid floating-point drift. The row lock prevents
        // concurrent payments from both reading the same prior balance.
        const updated = await db.transaction(async (tx) => {
          const [current] = await tx
            .select()
            .from(table)
            .where(eq(table["id"], record_id))
            .for("update");
          if (!current) throw new Error("Record not found");

          const totalPence = Math.max(0, Math.round(Number(current.total ?? 0) * 100));
          const paidPence = Math.max(0, Math.round(Number(current.amount_paid ?? 0) * 100));
          const deltaPence = Math.round((Number(amount_paid_delta) || 0) * 100);
          const nextPaidPence = Math.max(0, Math.min(totalPence, paidPence + deltaPence));
          const balancePence = totalPence - nextPaidPence;

          const currentStatus = String(current.status ?? "");
          const status =
            balancePence === 0 && totalPence > 0
              ? "paid"
              : nextPaidPence > 0
                ? "part_paid"
                : currentStatus === "paid" || currentStatus === "part_paid"
                  ? (entity_type === "purchase_bill" ? "awaiting_payment" : "sent")
                  : currentStatus;

          const rows = await tx
            .update(table)
            .set({
              amount_paid: (nextPaidPence / 100).toFixed(2),
              balance_due: (balancePence / 100).toFixed(2),
              status,
              updated_at: new Date(),
            })
            .where(eq(table["id"], record_id))
            .returning();
          return rows[0];
        });

        res.json({ success: true, record: updated });
        break;
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
        if (!(await assertWriteAccess(userId, txn.company_id, res))) return;

        try {
          // Shared atomic approval implementation (services/ai-accountant).
          const result = await applyReconciliationApproval(
            bank_transaction_id,
            records as ApprovalRecord[],
            userId,
          );
          res.json({ success: true, ...result });
        } catch (e) {
          res.status(409).json({ error: e instanceof Error ? e.message : "Reconciliation failed" });
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
        if (!(await assertWriteAccess(userId, txn.company_id, res))) return;

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
          res.status(409).json({ error: e instanceof Error ? e.message : "Reconciliation failed" });
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
        if (!(await assertWriteAccess(userId, source.company_id, res))) return;

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
          res.status(409).json({ error: e instanceof Error ? e.message : "Transfer could not be recorded" });
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
        if (!companyId || !Array.isArray(entries) || entries.length === 0) {
          res.status(400).json({ error: "A company and at least one bank transaction are required" });
          return;
        }
        if (!(await assertWriteAccess(userId, companyId, res))) return;

        try {
          const created = await db.transaction(async (tx) => {
            const rows = [];
            for (const entry of entries) {
              const moneyIn = entry.money_in == null || entry.money_in === "" ? 0 : Number(entry.money_in);
              const moneyOut = entry.money_out == null || entry.money_out === "" ? 0 : Number(entry.money_out);
              if (!Number.isFinite(moneyIn) || !Number.isFinite(moneyOut) || moneyIn < 0 || moneyOut < 0) {
                throw new Error("Money in and money out must be valid non-negative amounts");
              }
              const inPence = Math.round(moneyIn * 100);
              const outPence = Math.round(moneyOut * 100);
              if ((inPence <= 0 && outPence <= 0) || (inPence > 0 && outPence > 0)) {
                throw new Error("Each bank transaction must contain either money in or money out");
              }
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
            req.log.warn({ err: analysisError, company_id: companyId }, "Imported transactions were not analysed");
          }
          res.status(201).json(isBatch
            ? { success: true, data: created, analysis_summary: analysisSummary, analysis_status: analysisSummary ? "complete" : "disabled" }
            : { success: true, data: created[0], analysis_summary: analysisSummary, analysis_status: analysisSummary ? "complete" : "disabled" });
        } catch (e) {
          res.status(400).json({ error: e instanceof Error ? e.message : "Bank transaction could not be recorded" });
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
        if (!(await assertWriteAccess(userId, existing.company_id, res))) return;
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

      // ── postSalesInvoice ─────────────────────────────────────────────────
      case "postSalesInvoice": {
        const { invoice_id } = args as { invoice_id: string };
        if (!invoice_id) { res.status(400).json({ error: "invoice_id is required" }); return; }

        // Step 1: load the invoice to get its ACTUAL company_id (never trust client-supplied one)
        const [invoice] = await db
          .select({ company_id: salesInvoicesTable.company_id })
          .from(salesInvoicesTable)
          .where(eq(salesInvoicesTable.id, invoice_id))
          .limit(1);
        if (!invoice) { res.status(404).json({ error: "Invoice not found" }); return; }

        // Step 2: verify write access for the invoice's actual company
        if (!(await assertWriteAccess(userId, invoice.company_id, res))) return;

        await db
          .update(salesInvoicesTable)
          .set({ status: "posted", updated_at: new Date() })
          .where(eq(salesInvoicesTable.id, invoice_id));

        res.json({ success: true });
        break;
      }

      // ── postPurchaseBill ─────────────────────────────────────────────────
      case "postPurchaseBill": {
        const { bill_id } = args as { bill_id: string };
        if (!bill_id) { res.status(400).json({ error: "bill_id is required" }); return; }

        // Step 1: load the bill to get its ACTUAL company_id
        const [bill] = await db
          .select({ company_id: purchaseBillsTable.company_id })
          .from(purchaseBillsTable)
          .where(eq(purchaseBillsTable.id, bill_id))
          .limit(1);
        if (!bill) { res.status(404).json({ error: "Bill not found" }); return; }

        // Step 2: verify write access for the bill's actual company
        if (!(await assertWriteAccess(userId, bill.company_id, res))) return;

        await db
          .update(purchaseBillsTable)
          .set({ status: "posted", updated_at: new Date() })
          .where(eq(purchaseBillsTable.id, bill_id));

        res.json({ success: true });
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
          persistAnalysis = !WRITE_BLOCKED_ROLES.has(scope.role ?? "");
          txnsToScore = [txn];
        } else if (argCompanyId) {
          // Bulk mode: verify membership then fetch all review-status transactions.
          const scope = await requireCompanyScope(res, {
            userId,
            requestedCompanyId: argCompanyId,
          });
          if (!scope) return;
          persistAnalysis = !WRITE_BLOCKED_ROLES.has(scope.role ?? "");
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

      // ── generateSalesInvoiceJournals / generatePurchaseBillJournals ──────
      case "generateSalesInvoiceJournals":
      case "generatePurchaseBillJournals": {
        // Full double-entry journal generation is part of Task 2 (AI integration).
        res.json({ success: true, message: "Journal generation will be available with the AI accounting integration." });
        break;
      }

      // ── createDefaultAccounts ────────────────────────────────────────────
      case "createDefaultAccounts": {
        const { company_id } = args as { company_id: string };
        if (!company_id) { res.status(400).json({ error: "company_id is required" }); return; }

        // Verify write access for the requested company
        if (!(await assertWriteAccess(userId, company_id, res))) return;

        // Standard UK chart of accounts
        const defaults = [
          { code: "1000", name: "Cash in Hand",            account_type: "asset",     account_subtype: "current_asset"      },
          { code: "1100", name: "Bank Accounts",            account_type: "asset",     account_subtype: "current_asset"      },
          { code: "1200", name: "Accounts Receivable",      account_type: "asset",     account_subtype: "current_asset"      },
          { code: "1300", name: "Stock/Inventory",          account_type: "asset",     account_subtype: "current_asset"      },
          { code: "1400", name: "Prepayments",              account_type: "asset",     account_subtype: "current_asset"      },
          { code: "1500", name: "Fixed Assets",             account_type: "asset",     account_subtype: "fixed_asset"        },
          { code: "1600", name: "Accumulated Depreciation", account_type: "asset",     account_subtype: "fixed_asset"        },
          { code: "2000", name: "Accounts Payable",         account_type: "liability", account_subtype: "current_liability"  },
          { code: "2100", name: "VAT Liability",            account_type: "liability", account_subtype: "current_liability"  },
          { code: "2200", name: "PAYE/NI Payable",          account_type: "liability", account_subtype: "current_liability"  },
          { code: "2300", name: "Corporation Tax",          account_type: "liability", account_subtype: "current_liability"  },
          { code: "2400", name: "Director Loan",            account_type: "liability", account_subtype: "current_liability"  },
          { code: "2500", name: "Long-term Loans",          account_type: "liability", account_subtype: "long_term_liability" },
          { code: "3000", name: "Share Capital",            account_type: "equity",    account_subtype: "equity"             },
          { code: "3100", name: "Retained Earnings",        account_type: "equity",    account_subtype: "equity"             },
          { code: "4000", name: "Sales Revenue",            account_type: "revenue",   account_subtype: "revenue"            },
          { code: "4100", name: "Other Income",             account_type: "revenue",   account_subtype: "revenue"            },
          { code: "5000", name: "Cost of Goods Sold",       account_type: "expense",   account_subtype: "cost_of_sales"      },
          { code: "6000", name: "Wages & Salaries",         account_type: "expense",   account_subtype: "operating"          },
          { code: "6100", name: "Rent & Rates",             account_type: "expense",   account_subtype: "operating"          },
          { code: "6200", name: "Utilities",                account_type: "expense",   account_subtype: "operating"          },
          { code: "6300", name: "Telephone & Internet",     account_type: "expense",   account_subtype: "operating"          },
          { code: "6400", name: "Marketing & Advertising",  account_type: "expense",   account_subtype: "operating"          },
          { code: "6500", name: "Professional Fees",        account_type: "expense",   account_subtype: "operating"          },
          { code: "6600", name: "Travel & Subsistence",     account_type: "expense",   account_subtype: "operating"          },
          { code: "6700", name: "Office Supplies",          account_type: "expense",   account_subtype: "operating"          },
          { code: "6800", name: "Bank Charges",             account_type: "expense",   account_subtype: "operating"          },
          { code: "6900", name: "Depreciation",             account_type: "expense",   account_subtype: "operating"          },
          { code: "7000", name: "Miscellaneous",            account_type: "expense",   account_subtype: "operating"          },
        ];

        const records = defaults.map((d) => ({ ...d, company_id, is_active: true }));

        // Idempotent: skip rows that already exist for this company+code (unique constraint enforced in DB)
        const created = await db
          .insert(chartOfAccountsTable)
          .values(records)
          .onConflictDoNothing()
          .returning();

        res.json({ success: true, created: created.length });
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

      // ── generateDemoData (development only) ──────────────────────────────
      // The original Base44 generator is not available in this workspace.
      // Keep the development control useful by generating real, reviewable
      // bank data through the same validated schema used by manual entry.
      case "generateDemoData": {
        const { company_id, months, random } = args as {
          company_id?: string;
          months?: number;
          random?: boolean;
        };
        if (process.env.NODE_ENV === "production") {
          res.status(403).json({ error: "Demo data generation is unavailable in production" });
          return;
        }
        if (!company_id || !(await assertWriteAccess(userId, company_id, res))) return;

        const monthCount = random ? 1 : Math.max(1, Math.min(12, Math.round(Number(months) || 1)));
        const transactionCount = random ? 12 : monthCount * 8;
        const created = await db.transaction(async (tx) => {
          let [account] = await tx.select().from(bankAccountsTable)
            .where(eq(bankAccountsTable.company_id, company_id)).limit(1);
          if (!account) {
            [account] = await tx.insert(bankAccountsTable).values({
              company_id,
              account_name: "Development Current Account",
              bank_name: "Ledgerly Demo Bank",
              currency: "GBP",
              account_type: "current",
              status: "active",
              connection_type: "manual",
              opening_balance: "0.00",
              current_balance: "0.00",
            }).returning();
          }

          const rows = [];
          let customerCount = 0;
          let supplierCount = 0;
          let invoiceCount = 0;
          let billCount = 0;
          for (let i = 0; i < transactionCount; i += 1) {
            const isIncome = i % 3 === 0;
            const amount = (25 + ((i * 17) % 175) + (i % 4) * 0.5).toFixed(2);
            const date = new Date(Date.now() - (i * 3 + 1) * 86400000).toISOString().slice(0, 10);
            const reference = `DEV-${Date.now()}-${i + 1}`;
            let description = `${random ? "Random" : "Generated"} development transaction ${i + 1}`;

            if (isIncome) {
              const customerName = `Development Customer ${i + 1}`;
              const [customer] = await tx.insert(customersTable).values({
                company_id,
                name: customerName,
                customer_reference: `DEV-CUST-${i + 1}`,
                payment_terms: 30,
                status: "active",
              }).returning();
              customerCount += 1;
              const invoiceNumber = `DEV-INV-${Date.now()}-${i + 1}`;
              await tx.insert(salesInvoicesTable).values({
                company_id,
                customer_id: customer.id,
                customer_name: customerName,
                invoice_number: invoiceNumber,
                issue_date: date,
                due_date: date,
                payment_terms: 30,
                reference,
                line_items: [{ description: "Development service", quantity: 1, unit_price: amount, amount }],
                subtotal: amount,
                vat_total: "0.00",
                total: amount,
                amount_paid: "0.00",
                balance_due: amount,
                status: "posted",
              });
              invoiceCount += 1;
              description = `Payment from ${customerName} ${invoiceNumber}`;
            } else {
              const supplierName = `Development Supplier ${i + 1}`;
              const [supplier] = await tx.insert(suppliersTable).values({
                company_id,
                name: supplierName,
                supplier_reference: `DEV-SUP-${i + 1}`,
                payment_terms: 30,
                status: "active",
              }).returning();
              supplierCount += 1;
              const billNumber = `DEV-BILL-${Date.now()}-${i + 1}`;
              await tx.insert(purchaseBillsTable).values({
                company_id,
                supplier_id: supplier.id,
                supplier_name: supplierName,
                bill_number: billNumber,
                bill_date: date,
                due_date: date,
                payment_terms: 30,
                reference,
                line_items: [{ description: "Development expense", quantity: 1, unit_price: amount, amount }],
                subtotal: amount,
                vat_total: "0.00",
                total: amount,
                amount_paid: "0.00",
                balance_due: amount,
                status: "posted",
                category: "other",
              });
              billCount += 1;
              description = `Payment to ${supplierName} ${billNumber}`;
            }
            const [row] = await tx.insert(bankTransactionsTable).values({
              company_id,
              bank_account_id: account.id,
              date,
              description,
              reference,
              amount,
              money_in: isIncome ? amount : "0.00",
              money_out: isIncome ? "0.00" : amount,
              balance: "0.00",
              transaction_type: isIncome ? "income" : "expense",
              status: "review",
              matched_type: null,
              matched_record_id: null,
              matched_record_number: null,
              linked_invoice_id: null,
              linked_bill_id: null,
              linked_credit_note_id: null,
              category: isIncome ? "sales" : "other",
              vat_rate: "0.00",
            }).returning();
            rows.push(row);
          }
          return {
            rows,
            counts: {
              customers: customerCount,
              suppliers: supplierCount,
              sales_invoices: invoiceCount,
              purchase_bills: billCount,
            },
          };
        });
        res.json({
          success: true,
          counts: {
            bank_accounts: 1,
            bank_transactions: created.rows.length,
            ...created.counts,
          },
        });
        break;
      }

      // ── resetDemoData (development only) ─────────────────────────────────
      // Deliberately separate from normal entity deletion: this is the
      // development workspace's explicit "start fresh" control. Production
      // never exposes it, and the active company is derived from a verified
      // membership before any deletion can occur.
      case "resetDemoData": {
        const { company_id, target } = args as { company_id?: string; target?: string };
        const allowedTargets = new Set(["transactions", "customers", "suppliers", "documents", "everything"]);
        if (process.env.NODE_ENV === "production") {
          res.status(403).json({ error: "Development data reset is unavailable in production" });
          return;
        }
        if (!company_id || !target || !allowedTargets.has(target)) {
          res.status(400).json({ error: "A company and valid reset target are required" });
          return;
        }
        if (!(await assertWriteAccess(userId, company_id, res))) return;

        const deleted = await db.transaction(async (tx) => {
          const counts: Record<string, number> = {};
          const remove = async (name: string, table: any) => {
            const rows = await tx.delete(table).where(eq(table.company_id, company_id)).returning({ id: table.id });
            counts[name] = rows.length;
          };

          if (target === "transactions" || target === "everything") await remove("transactions", bankTransactionsTable);
          if (target === "documents" || target === "everything") {
            await remove("documents", documentsTable);
            await remove("email_capture_logs", emailCaptureLogsTable);
          }
          if (target === "everything") {
            await remove("journal_entries", journalEntriesTable);
            await remove("vat_returns", vatReturnsTable);
            await remove("sales_credit_notes", salesCreditNotesTable);
            await remove("supplier_credit_notes", supplierCreditNotesTable);
            await remove("sales_invoices", salesInvoicesTable);
            await remove("purchase_bills", purchaseBillsTable);
            await remove("bank_accounts", bankAccountsTable);
            await remove("chart_of_accounts", chartOfAccountsTable);
          }
          if (target === "customers" || target === "everything") await remove("customers", customersTable);
          if (target === "suppliers" || target === "everything") await remove("suppliers", suppliersTable);
          return counts;
        });
        res.json({ success: true, deleted });
        break;
      }

      // ── safe stubs ───────────────────────────────────────────────────────
      case "mockScanEmails":
        res.json({ success: true, message: "Email scanning is not yet configured for this environment." });
        break;

      case "getAccountantClientList":
        res.json({ data: [] });
        break;

      case "manageDemoCompany":
        res.json({ success: true, message: `${funcName} is only available in the Base44 demo environment.` });
        break;

      default:
        res.status(404).json({ error: `Unknown function: ${funcName}` });
    }
  } catch (err: unknown) {
    req.log.error({ err, funcName }, "function invocation error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
