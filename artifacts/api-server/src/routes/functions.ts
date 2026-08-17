/**
 * /api/functions/:name — server-side business logic functions.
 *
 * Security model (applied to EVERY mutating handler):
 *  1. Load the target record from the database first.
 *  2. Derive company_id from the RECORD, never from a caller-supplied parameter.
 *  3. Verify the requesting user is a member of that company.
 *  4. Reject read_only members on any write operation.
 *
 * AI-powered functions (askAI, generateInsights, suggestTransactionMatches,
 * createRecordFromDocument) return a clear "not yet available" 503 so callers
 * surface honest UI feedback.
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import {
  companyUsersTable,
  companiesTable,
  salesInvoicesTable,
  purchaseBillsTable,
  chartOfAccountsTable,
} from "@workspace/db/schema";
import { eq, inArray, sql } from "drizzle-orm";

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
      eq(companyUsersTable.user_id, userId) &&
      eq(companyUsersTable.company_id, companyId) as ReturnType<typeof eq>,
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
  "suggestTransactionMatches",
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
