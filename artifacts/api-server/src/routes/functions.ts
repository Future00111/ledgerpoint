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
  companyUsersTable,
  companiesTable,
  salesInvoicesTable,
  purchaseBillsTable,
  salesCreditNotesTable,
  supplierCreditNotesTable,
  bankTransactionsTable,
  chartOfAccountsTable,
} from "@workspace/db/schema";
import { eq, inArray, and, sql } from "drizzle-orm";

const router = Router();
router.use(requireAuth);

// ─── helpers ─────────────────────────────────────────────────────────────────

const WRITE_BLOCKED_ROLES = new Set(["read_only"]);

/**
 * Fetch the caller's membership row for a specific company.
 * Returns the row (with role), or null if not a member.
 */
async function getMembership(
  userId: string,
  companyId: string,
): Promise<{ company_id: string; role: string | null } | null> {
  const [m] = await db
    .select({ company_id: companyUsersTable.company_id, role: companyUsersTable.role })
    .from(companyUsersTable)
    .where(
      and(
        eq(companyUsersTable.user_id, userId),
        eq(companyUsersTable.company_id, companyId),
      ),
    )
    .limit(1);
  return m ?? null;
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
  const m = await getMembership(userId, companyId);
  if (!m) {
    res.status(403).json({ error: "Access denied" });
    return false;
  }
  if (WRITE_BLOCKED_ROLES.has(m.role ?? "")) {
    res.status(403).json({ error: "Your role does not permit this operation" });
    return false;
  }
  return true;
}

// ─── AI functions (not yet available) ────────────────────────────────────────
const AI_FUNCTIONS = new Set([
  "askAI",
  "generateInsights",
  "createRecordFromDocument",
]);

// ─── POST /api/functions/:name ────────────────────────────────────────────────
router.post("/:name", async (req: Request, res: Response) => {
  const { userId } = req as AuthenticatedRequest;
  const funcName = req.params["name"] as string;
  const args = req.body as Record<string, unknown>;

  if (AI_FUNCTIONS.has(funcName)) {
    res.status(503).json({
      error: `${funcName} requires AI integration which is not yet available. This feature is coming soon.`,
      notYetAvailable: true,
    });
    return;
  }

  try {
    switch (funcName) {
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

        const delta = Number(amount_paid_delta) || 0;
        const updated = await db
          .update(table)
          .set({
            amount_paid: sql`COALESCE(${table["amount_paid"]}, 0) + ${delta}`,
            updated_at: new Date(),
          })
          .where(eq(table["id"], record_id))
          .returning();

        res.json({ success: true, record: updated[0] });
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
          const result = await db.transaction(async (tx) => {
            // Re-check the transaction is still awaiting reconciliation.
            const [fresh] = await tx
              .select()
              .from(bankTransactionsTable)
              .where(eq(bankTransactionsTable.id, bank_transaction_id))
              .for("update");
            if (!fresh || fresh.status !== "review") {
              throw new Error("This transaction has already been reconciled");
            }

            const numbers: string[] = [];
            let appliedPence = 0;
            const txnPence = Math.round((Number(fresh.money_in || 0) + Number(fresh.money_out || 0)) * 100);

            for (const r of records) {
              const table = r.record_type === "sales_invoice" ? salesInvoicesTable : purchaseBillsTable;
              const [rec] = await tx.select().from(table).where(eq(table.id, r.record_id)).for("update");
              if (!rec) throw new Error("A matched record no longer exists");
              if (rec.company_id !== fresh.company_id) throw new Error("Record belongs to a different company");
              if (rec.status === "cancelled" || rec.status === "paid") {
                throw new Error(`${(rec as Record<string, unknown>)["invoice_number"] || (rec as Record<string, unknown>)["bill_number"]} is already settled`);
              }

              const balancePence = Math.round(Number(rec.balance_due ?? rec.total ?? 0) * 100);
              const remainingTxn = txnPence - appliedPence;
              const deltaPence = Math.min(balancePence, Math.max(0, remainingTxn));
              if (deltaPence <= 0) throw new Error("Matched records exceed the bank transaction amount");

              const paidPence = Math.round(Number(rec.amount_paid ?? 0) * 100) + deltaPence;
              const newBalancePence = Math.max(0, Math.round(Number(rec.total ?? 0) * 100) - paidPence);
              await tx
                .update(table)
                .set({
                  amount_paid: (paidPence / 100).toFixed(2),
                  balance_due: (newBalancePence / 100).toFixed(2),
                  status: newBalancePence === 0 ? "paid" : rec.status,
                  updated_at: new Date(),
                })
                .where(eq(table.id, r.record_id));

              appliedPence += deltaPence;
              const num = (rec as Record<string, unknown>)["invoice_number"] || (rec as Record<string, unknown>)["bill_number"];
              if (num) numbers.push(String(num));
            }

            const first = records[0]!;
            const label = numbers.length > 2 ? `${numbers.slice(0, 2).join(", ")} +${numbers.length - 2} more` : numbers.join(", ");
            const updateData = {
              status: "matched",
              matched_type: first.record_type,
              matched_record_id: first.record_id,
              matched_record_number: label,
              linked_invoice_id: first.record_type === "sales_invoice" ? first.record_id : null,
              linked_bill_id: first.record_type === "purchase_bill" ? first.record_id : null,
              updated_at: new Date(),
            };
            await tx
              .update(bankTransactionsTable)
              .set(updateData)
              .where(eq(bankTransactionsTable.id, bank_transaction_id));

            return { label, applied: appliedPence / 100, updateData };
          });

          res.json({ success: true, ...result });
        } catch (e) {
          res.status(409).json({ error: e instanceof Error ? e.message : "Reconciliation failed" });
        }
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

        if (bank_transaction_id) {
          // Single-transaction mode: load the specific transaction and derive company from it.
          const [txn] = await db
            .select()
            .from(bankTransactionsTable)
            .where(eq(bankTransactionsTable.id, bank_transaction_id))
            .limit(1);
          if (!txn) { res.status(404).json({ error: "Transaction not found" }); return; }
          // Verify the caller is a member of the transaction's actual company.
          const m = await getMembership(userId, txn.company_id);
          if (!m) { res.status(403).json({ error: "Access denied" }); return; }
          txnsToScore = [txn];
        } else if (argCompanyId) {
          // Bulk mode: verify membership then fetch all review-status transactions.
          const m = await getMembership(userId, argCompanyId);
          if (!m) { res.status(403).json({ error: "Access denied" }); return; }
          txnsToScore = await db
            .select()
            .from(bankTransactionsTable)
            .where(
              and(
                eq(bankTransactionsTable.company_id, argCompanyId),
                eq(bankTransactionsTable.status, "review"),
              ),
            );
        } else {
          res.status(400).json({ error: "company_id or bank_transaction_id is required" });
          return;
        }

        if (txnsToScore.length === 0) { res.json({ suggestions: {} }); return; }

        const companyId = txnsToScore[0].company_id;

        // Load all unreconciled records for the company in parallel.
        const [invoices, bills, salesCNs, supplierCNs] = await Promise.all([
          db.select().from(salesInvoicesTable).where(eq(salesInvoicesTable.company_id, companyId)),
          db.select().from(purchaseBillsTable).where(eq(purchaseBillsTable.company_id, companyId)),
          db.select().from(salesCreditNotesTable).where(eq(salesCreditNotesTable.company_id, companyId)),
          db.select().from(supplierCreditNotesTable).where(eq(supplierCreditNotesTable.company_id, companyId)),
        ]);

        const DAY_MS = 24 * 60 * 60 * 1000;
        const allSuggestions: Record<string, object[]> = {};
        const allReconciliations: Record<string, object> = {};

        for (const txn of txnsToScore) {
          const txnAmount = Number(txn.money_in || 0) + Number(txn.money_out || 0);
          const txnDate = txn.date ? new Date(txn.date) : null;
          const txnDesc = (txn.description || "").toLowerCase();
          const txnRef = (txn.reference || "").toLowerCase();

          const suggestions: {
            record_type: string;
            record_id: string;
            record_number: string | null;
            record_name: string | null;
            record_amount: number;
            record_date: string | null;
            confidence: number;
            reasons: string[];
          }[] = [];

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
              // Within 5%
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
            for (const inv of invoices) {
              if (inv.status === "cancelled" || inv.status === "paid") continue;
              scoreMatch(
                inv.id, "sales_invoice", inv.invoice_number, inv.issue_date,
                Number(inv.balance_due || inv.total || 0), inv.customer_name,
              );
            }
            // Supplier credit notes → money in (refunds from suppliers)
            for (const cn of supplierCNs) {
              if (cn.status === "cancelled" || cn.is_applied) continue;
              scoreMatch(
                cn.id, "supplier_credit_note", cn.credit_note_number, cn.credit_note_date,
                Number(cn.total || 0), cn.supplier_name,
              );
            }
          }

          // Purchase bills → money out
          if (Number(txn.money_out || 0) > 0) {
            for (const bill of bills) {
              if (bill.status === "cancelled" || bill.status === "paid") continue;
              scoreMatch(
                bill.id, "purchase_bill", bill.bill_number, bill.bill_date,
                Number(bill.balance_due || bill.total || 0), bill.supplier_name,
              );
            }
            // Sales credit notes → money out (refunds to customers)
            for (const cn of salesCNs) {
              if (cn.status === "cancelled" || cn.is_applied) continue;
              scoreMatch(
                cn.id, "sales_credit_note", cn.credit_note_number, cn.credit_note_date,
                Number(cn.total || 0), cn.customer_name,
              );
            }
          }

          suggestions.sort((a, b) => b.confidence - a.confidence);
          const strongSuggestions = suggestions.filter((s) => s.confidence >= 50);
          if (strongSuggestions.length > 0) {
            allSuggestions[txn.id] = strongSuggestions;
          }

          // ── AI reconciliation: one-to-many combination match ────────────────
          // Money in → outstanding sales invoices only (revenue matching);
          // money out → outstanding purchase bills only. All arithmetic in
          // integer pence to avoid floating-point drift.
          if (txnAmount > 0) {
            const comboType = Number(txn.money_in || 0) > 0 ? "sales_invoice" : "purchase_bill";
            const toPence = (n: number) => Math.round(n * 100);
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
                const c = candidates[i];
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
              // Exact-total combination: high confidence, tempered slightly per
              // extra document and lifted by per-record signals.
              const avgSignal = combo.reduce((s, c) => s + c.confidence, 0) / combo.length;
              overallConfidence = Math.min(100, Math.round(
                70 + Math.min(avgSignal, 100) * 0.3 - (combo.length - 1) * 5,
              ));
              status = "green";
              potential = candidates.filter(
                (s) => s.confidence >= 50 && !combo.some((m) => m.record_id === s.record_id),
              );
            } else {
              // Partial: greedily take high-confidence records that fit within
              // the bank amount, then surface the rest as potential invoices.
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
            const strip = (c: Cand) => { const { pence: _p, ...rest } = c; return rest; };
            allReconciliations[txn.id] = {
              transaction_amount: txnPence / 100,
              matched_records: matched.map(strip),
              matched_total: matchedPence / 100,
              remaining: Math.max(0, txnPence - matchedPence) / 100,
              potential_matches: potential.slice(0, 5).map(strip),
              confidence: overallConfidence,
              status,
            };
          }
        }

        res.json({ suggestions: allSuggestions, reconciliation: allReconciliations });
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
          .where(eq(companyUsersTable.user_id, userId));
        if (memberships.length === 0) { res.json({ data: [] }); return; }
        const companies = await db
          .select()
          .from(companiesTable)
          .where(inArray(companiesTable.id, memberships.map((m) => m.company_id)));
        res.json({ data: companies });
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
      case "generateDemoData":
      case "resetDemoData":
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
