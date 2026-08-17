/**
 * Generic CRUD router for all entities — with tenant isolation and role enforcement.
 *
 * Authorization model:
 *  - Every request must be authenticated (Clerk session → userId).
 *  - Authorized companies = CompanyUser rows where user_id = userId.
 *  - Role-based write protection: members with role 'read_only' cannot create/update/delete.
 *  - Company entity: filtered to authorized IDs; create/update/delete go through /api/companies.
 *  - CompanyUser entity: read-only via generic CRUD; mutations go through /api/companies routes.
 *  - All other entities: must supply company_id that the user is authorized for.
 *
 * Filter operators supported:
 *  - Scalar equality: ?field=value
 *  - IN list:         ?field[]=a&field[]=b  (sent by entities.js $in operator)
 */

import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import {
  companiesTable,
  companyUsersTable,
  customersTable,
  suppliersTable,
  salesInvoicesTable,
  purchaseBillsTable,
  salesCreditNotesTable,
  supplierCreditNotesTable,
  bankAccountsTable,
  bankTransactionsTable,
  chartOfAccountsTable,
  journalEntriesTable,
  vatReturnsTable,
  documentsTable,
  emailAccountsTable,
  emailRulesTable,
  emailCaptureLogsTable,
  emailScanConfigsTable,
  insightsTable,
  automationsTable,
  automationActivitiesTable,
  workflowActivitiesTable,
  accountLearningsTable,
  accountSuggestionLogsTable,
  suggestionRulesTable,
  suggestionSettingsTable,
  transactionCommentsTable,
} from "@workspace/db/schema";
import { eq, and, desc, asc, inArray } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { PgTableWithColumns } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Entity map
// ---------------------------------------------------------------------------

type AnyTable = PgTableWithColumns<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const ENTITY_MAP: Record<string, AnyTable> = {
  Company: companiesTable,
  CompanyUser: companyUsersTable,
  Customer: customersTable,
  Supplier: suppliersTable,
  SalesInvoice: salesInvoicesTable,
  PurchaseBill: purchaseBillsTable,
  SalesCreditNote: salesCreditNotesTable,
  SupplierCreditNote: supplierCreditNotesTable,
  BankAccount: bankAccountsTable,
  BankTransaction: bankTransactionsTable,
  ChartOfAccount: chartOfAccountsTable,
  JournalEntry: journalEntriesTable,
  VATReturn: vatReturnsTable,
  Document: documentsTable,
  EmailAccount: emailAccountsTable,
  EmailRule: emailRulesTable,
  EmailCaptureLog: emailCaptureLogsTable,
  EmailScanConfig: emailScanConfigsTable,
  Insight: insightsTable,
  Automation: automationsTable,
  AutomationActivity: automationActivitiesTable,
  WorkflowActivity: workflowActivitiesTable,
  AccountLearning: accountLearningsTable,
  AccountSuggestionLog: accountSuggestionLogsTable,
  SuggestionRule: suggestionRulesTable,
  SuggestionSettings: suggestionSettingsTable,
  TransactionComment: transactionCommentsTable,
};

/** CompanyUser mutations go through /api/companies; block generic CRUD writes. */
const READONLY_ENTITIES = new Set(["CompanyUser"]);
/** Company has no company_id column; scope to membership list via /api/companies. */
const COMPANY_ENTITY = "Company";
/** Roles that cannot perform write operations. */
const WRITE_BLOCKED_ROLES = new Set(["read_only"]);

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** Returns all company IDs the Clerk user is a member of. */
async function getAuthorizedCompanyIds(userId: string): Promise<string[]> {
  const memberships = await db
    .select({ company_id: companyUsersTable.company_id })
    .from(companyUsersTable)
    .where(eq(companyUsersTable.user_id, userId));
  return memberships.map((m) => m.company_id);
}

/** Returns the user's role in a specific company, or null if not a member. */
async function getUserRole(userId: string, companyId: string): Promise<string | null> {
  const [m] = await db
    .select({ role: companyUsersTable.role })
    .from(companyUsersTable)
    .where(and(eq(companyUsersTable.user_id, userId), eq(companyUsersTable.company_id, companyId)))
    .limit(1);
  return m?.role ?? null;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = Router();

// Validate entity name + authenticate
router.use("/:entity", requireAuth, (req: Request, res: Response, next) => {
  const entityName = req.params["entity"] as string;
  if (!ENTITY_MAP[entityName]) {
    res.status(404).json({ error: `Unknown entity: ${entityName}` });
    return;
  }
  next();
});

// ─── GET /api/entities/:entity — list/filter ─────────────────────────────────
router.get("/:entity", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const entityName = req.params["entity"] as string;
    const table = ENTITY_MAP[entityName] as AnyTable;

    // Parse query: separate control params from filters
    // Express places repeated ?field[]=a&field[]=b under req.query["field[]"]
    const rawQuery = req.query as Record<string, string | string[]>;
    const _order = rawQuery["_order"] as string | undefined;
    const _limit = rawQuery["_limit"] as string | undefined;

    const authorizedIds = await getAuthorizedCompanyIds(userId);
    if (authorizedIds.length === 0) {
      res.json([]);
      return;
    }

    // Build WHERE conditions
    const conditions: Array<SQL<unknown>> = [];

    if (entityName === COMPANY_ENTITY) {
      conditions.push(inArray(table["id"], authorizedIds));
    } else {
      // Scope to company
      const requestedCompanyId = rawQuery["company_id"] as string | undefined;
      if (requestedCompanyId) {
        if (!authorizedIds.includes(requestedCompanyId)) {
          res.status(403).json({ error: "Access denied to this company" });
          return;
        }
        conditions.push(eq(table["company_id"], requestedCompanyId));
      } else {
        conditions.push(inArray(table["company_id"], authorizedIds));
      }

      // Apply additional filters (skip control params and company_id, already handled)
      for (const [rawKey, rawVal] of Object.entries(rawQuery)) {
        if (rawKey === "company_id" || rawKey === "_order" || rawKey === "_limit") continue;

        // Handle $in operator: field[] → IN (...)
        if (rawKey.endsWith("[]")) {
          const colName = rawKey.slice(0, -2);
          const col = table[colName];
          if (col) {
            const vals = Array.isArray(rawVal) ? rawVal : [rawVal as string];
            if (vals.length > 0) conditions.push(inArray(col, vals));
          }
          continue;
        }

        // Scalar equality
        const col = table[rawKey];
        if (col && typeof rawVal === "string") {
          conditions.push(eq(col, rawVal));
        }
      }
    }

    // Order clause
    let orderClause: ReturnType<typeof asc | typeof desc> | undefined;
    if (_order) {
      const isDesc = _order.startsWith("-");
      const colName = isDesc ? _order.slice(1) : _order;
      const col = table[colName];
      if (col) orderClause = isDesc ? desc(col) : asc(col);
    } else if (table["created_at"]) {
      orderClause = desc(table["created_at"]);
    }

    const limit = _limit ? Math.min(parseInt(_limit, 10), 1000) : 500;

    let query = db.select().from(table).$dynamic();
    if (conditions.length > 0) {
      query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
    }
    if (orderClause) query = query.orderBy(orderClause);
    query = query.limit(limit);

    const rows = await query;
    res.json(rows);
  } catch (err: unknown) {
    req.log.error({ err }, "entity list error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── GET /api/entities/:entity/:id — get by id ───────────────────────────────
router.get("/:entity/:id", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const entityName = req.params["entity"] as string;
    const id = req.params["id"] as string;
    const table = ENTITY_MAP[entityName] as AnyTable;

    const authorizedIds = await getAuthorizedCompanyIds(userId);
    if (authorizedIds.length === 0) {
      res.status(403).json({ error: "No authorized companies" });
      return;
    }

    const rows = await db.select().from(table).where(eq(table["id"], id)).limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const row = rows[0] as Record<string, unknown>;

    // Verify ownership
    if (entityName === COMPANY_ENTITY) {
      if (!authorizedIds.includes(row["id"] as string)) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    } else if (!authorizedIds.includes(row["company_id"] as string)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    res.json(row);
  } catch (err: unknown) {
    req.log.error({ err }, "entity get error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── PATCH /api/entities/:entity/bulk-update — bulk update ───────────────────
router.patch("/:entity/bulk-update", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const entityName = req.params["entity"] as string;

    if (READONLY_ENTITIES.has(entityName) || entityName === COMPANY_ENTITY) {
      res.status(403).json({ error: "Use /api/companies for company management" });
      return;
    }

    const records: Array<Record<string, unknown>> = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ error: "Body must be a non-empty array" });
      return;
    }

    const table = ENTITY_MAP[entityName] as AnyTable;
    const results: Array<Record<string, unknown>> = [];

    for (const record of records) {
      const id = record["id"] as string | undefined;
      if (!id) continue;

      // Verify ownership for each record
      const existing = await db.select().from(table).where(eq(table["id"], id)).limit(1);
      if (!existing[0]) continue;
      const existingRow = existing[0] as Record<string, unknown>;
      const companyId = existingRow["company_id"] as string;

      const role = await getUserRole(userId, companyId);
      if (!role || WRITE_BLOCKED_ROLES.has(role)) continue;

      // Prevent tenant reassignment
      if (record["company_id"] && record["company_id"] !== companyId) continue;

      const updateData = { ...record };
      delete updateData["id"];
      if (table["updated_at"]) updateData["updated_at"] = new Date();

      const updated = await db.update(table).set(updateData).where(eq(table["id"], id)).returning();
      if (updated[0]) results.push(updated[0] as Record<string, unknown>);
    }

    res.json(results);
  } catch (err: unknown) {
    req.log.error({ err }, "entity bulk-update error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── POST /api/entities/:entity/bulk — bulk create ───────────────────────────
router.post("/:entity/bulk", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const entityName = req.params["entity"] as string;

    if (READONLY_ENTITIES.has(entityName) || entityName === COMPANY_ENTITY) {
      res.status(403).json({ error: "Use /api/companies for company management" });
      return;
    }

    const records: Array<Record<string, unknown>> = req.body;
    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ error: "Body must be a non-empty array" });
      return;
    }

    // All records must target the same authorized company
    const companyId = records[0]["company_id"] as string | undefined;
    if (!companyId) {
      res.status(400).json({ error: "company_id is required in each record" });
      return;
    }
    if (records.some((r) => r["company_id"] !== companyId)) {
      res.status(400).json({ error: "All bulk records must share the same company_id" });
      return;
    }

    const role = await getUserRole(userId, companyId);
    if (!role) {
      res.status(403).json({ error: "Not authorized for this company" });
      return;
    }
    if (WRITE_BLOCKED_ROLES.has(role)) {
      res.status(403).json({ error: "Your role does not permit creating records" });
      return;
    }

    const table = ENTITY_MAP[entityName] as AnyTable;
    const rows = await db.insert(table).values(records).returning();
    res.status(201).json(rows);
  } catch (err: unknown) {
    req.log.error({ err }, "entity bulk create error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── POST /api/entities/:entity — create ─────────────────────────────────────
router.post("/:entity", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const entityName = req.params["entity"] as string;

    if (READONLY_ENTITIES.has(entityName) || entityName === COMPANY_ENTITY) {
      res.status(403).json({ error: "Use /api/companies for company management" });
      return;
    }

    const companyId = req.body["company_id"] as string | undefined;
    if (!companyId) {
      res.status(400).json({ error: "company_id is required" });
      return;
    }

    const role = await getUserRole(userId, companyId);
    if (!role) {
      res.status(403).json({ error: "Not authorized for this company" });
      return;
    }
    if (WRITE_BLOCKED_ROLES.has(role)) {
      res.status(403).json({ error: "Your role does not permit creating records" });
      return;
    }

    const table = ENTITY_MAP[entityName] as AnyTable;
    const rows = await db.insert(table).values(req.body).returning();
    const row = rows[0] as Record<string, unknown>;
    res.status(201).json(row);
  } catch (err: unknown) {
    req.log.error({ err }, "entity create error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── PUT /api/entities/:entity/:id — update ──────────────────────────────────
router.put("/:entity/:id", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const entityName = req.params["entity"] as string;
    const id = req.params["id"] as string;

    if (READONLY_ENTITIES.has(entityName) || entityName === COMPANY_ENTITY) {
      res.status(403).json({ error: "Use /api/companies for company management" });
      return;
    }

    const table = ENTITY_MAP[entityName] as AnyTable;

    // Verify ownership before mutating
    const existing = await db.select().from(table).where(eq(table["id"], id)).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const existingRow = existing[0] as Record<string, unknown>;
    const companyId = existingRow["company_id"] as string;

    const role = await getUserRole(userId, companyId);
    if (!role) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (WRITE_BLOCKED_ROLES.has(role)) {
      res.status(403).json({ error: "Your role does not permit updating records" });
      return;
    }

    // Never allow changing company_id — prevents cross-tenant record reassignment
    if (req.body["company_id"] && req.body["company_id"] !== companyId) {
      res.status(400).json({ error: "Changing company_id is not permitted" });
      return;
    }

    const updateData = { ...req.body };
    delete updateData["id"];
    if (table["updated_at"]) updateData["updated_at"] = new Date();

    const rows = await db.update(table).set(updateData).where(eq(table["id"], id)).returning();
    const row = rows[0] as Record<string, unknown>;
    res.json(row);
  } catch (err: unknown) {
    req.log.error({ err }, "entity update error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── DELETE /api/entities/:entity/:id — delete ───────────────────────────────
router.delete("/:entity/:id", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const entityName = req.params["entity"] as string;
    const id = req.params["id"] as string;

    if (READONLY_ENTITIES.has(entityName) || entityName === COMPANY_ENTITY) {
      res.status(403).json({ error: "Use /api/companies for company management" });
      return;
    }

    const table = ENTITY_MAP[entityName] as AnyTable;

    // Look up first to verify ownership
    const existing = await db.select().from(table).where(eq(table["id"], id)).limit(1);
    if (existing.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const existingRow = existing[0] as Record<string, unknown>;
    const companyId = existingRow["company_id"] as string;

    const role = await getUserRole(userId, companyId);
    if (!role) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (WRITE_BLOCKED_ROLES.has(role)) {
      res.status(403).json({ error: "Your role does not permit deleting records" });
      return;
    }

    await db.delete(table).where(eq(table["id"], id));
    res.json({ success: true });
  } catch (err: unknown) {
    req.log.error({ err }, "entity delete error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
