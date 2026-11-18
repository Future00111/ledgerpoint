/**
 * /api/companies — secure company management.
 *
 * GET    /api/companies                      — list companies the user belongs to
 * POST   /api/companies                      — create company + owner membership (transactional)
 * PUT    /api/companies/:id                  — update company fields (owner only)
 * DELETE /api/companies/:id                  — delete company (owner only)
 * GET    /api/companies/:id/members          — list members of a company
 * GET    /api/companies/:id/specialist-access-history — bounded audited owner-only history
 * GET    /api/companies/:id/payroll-pay-records/:recordId — audited pay fields by payroll role
 * GET    /api/companies/:id/personal-tax-preparations/:recordId — audited annual draft input by tax role
 * GET    /api/companies/:id/personal-tax-preparations/:recordId/export.csv — audited single-input export
 * POST   /api/companies/:id/personal-tax-preparations — create/replay an annual draft input (owner/preparer)
 * POST   /api/companies/:id/payroll-pay-records — create or replay dated pay intent (owner/preparer)
 * POST   /api/companies/:id/members          — add a member by Clerk user_id
 * PUT    /api/companies/:id/members/:userId  — change a member's role (owner only)
 * DELETE /api/companies/:id/members/:userId  — remove a member (owner can remove anyone; member can remove self)
 * POST   /api/companies/:id/invite           — add member by email (looks up Clerk user)
 */
import { Router, type Request, type Response, type RequestHandler } from "express";
import { db } from "@workspace/db";
import { companiesTable, companyUsersTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { findActiveMembership } from "../middlewares/companyScope";
import { isCompanyRole } from "../security/roles";
import { safeErrorLog, safeRouteErrors } from "../security/publicErrors";
import { authorizeMemberChange, CompanyPolicyError, createCompanyBody, updateCompanyBody } from "../security/companyPolicy";
import { queryAdapter } from "../services/accountingDocuments/core";
import { auditSpecializedMembershipChange, auditSpecializedMembershipChanges } from "../services/payroll/access/membershipAudit";
import { SensitiveAccessError } from "../services/payroll/access/boundary";
import { readSpecialistAccessHistory } from "../services/payroll/access/membershipHistory";
import { readPayRecord, createPayRecord } from "../services/payroll/access/payRecord";
import { readPersonalTaxPreparation, createPersonalTaxPreparation, exportPersonalTaxPreparation } from "../services/tax/access/preparationRecord";

// ─── helpers ─────────────────────────────────────────────────────────────────

async function getCallerMembership(companyId: string, userId: string) {
  return findActiveMembership(userId, companyId);
}

type CompanyTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// All membership writers take the same parent-row lock, then re-read authority.
// This serializes concurrent last-owner changes without changing the shared schema.
async function lockedMembers(tx: CompanyTx, companyId: string) {
  const [company] = await tx.select({ id: companiesTable.id }).from(companiesTable)
    .where(eq(companiesTable.id, companyId)).for("update");
  if (!company) throw new CompanyPolicyError("company_missing");
  return tx.select().from(companyUsersTable).where(eq(companyUsersTable.company_id, companyId)).for("update");
}

function companyError(req: Request, res: Response, error: unknown, operation: string) {
  if (error instanceof SensitiveAccessError) {
    res.status(error.status).json({ error: error.code === "SENSITIVE_REQUEST_CONFLICT"
      ? "This request conflicts with an existing record." : "Unable to complete this request. Please try again.", code: error.code });
    return;
  }
  if (error instanceof CompanyPolicyError) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  req.log?.error(safeErrorLog(error), operation);
  res.status(500).json({ error: "Unable to complete this request. Please try again." });
}

export interface CompanyIdentityLookup {
  byId(userId: string): Promise<{ id: string } | null>;
  byEmail(email: string): Promise<{ id: string } | null>;
}
const clerkIdentityLookup: CompanyIdentityLookup = {
  async byId(userId) {
    try { return await clerkClient.users.getUser(userId); }
    catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status === 404) return null;
      throw error;
    }
  },
  async byEmail(email) {
    const users = await clerkClient.users.getUserList({ emailAddress: [email.toLowerCase()] });
    return users.data?.length === 1 ? users.data[0]! : null;
  },
};

/** Injectable dependencies permit synthetic authorization tests without Clerk requests. */
export function createCompaniesRouter(auth: RequestHandler = requireAuth, identities: CompanyIdentityLookup = clerkIdentityLookup) {
const router = Router();
// Apply before authentication so denied/unauthenticated responses also cannot be cached.
router.use(["/:id/specialist-access-history", "/:id/payroll-pay-records", "/:id/personal-tax-preparations"], (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
router.use(auth);

router.get("/:id/personal-tax-preparations/:recordId/export.csv", async (req: Request, res: Response) => {
  // Express otherwise treats HEAD as GET. An explicit download is the only audited export action.
  if (req.method !== 'GET') { res.set('Allow', 'GET').status(405).end(); return; }
  try {
    if (Object.keys(req.query).length > 0) throw new SensitiveAccessError("SENSITIVE_REQUEST_INVALID");
    const { userId } = req as AuthenticatedRequest;
    const csv = await exportPersonalTaxPreparation(req.params["id"] as string, userId, req.params["recordId"] as string);
    res.status(200).set({ 'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="personal-tax-input.csv"',
      'X-Personal-Tax-Company': (req.params['id'] as string).toLowerCase(),
      'X-Personal-Tax-Record': (req.params['recordId'] as string).toLowerCase(),
      'Content-Length': String(Buffer.byteLength(csv)) }).end(csv);
  } catch (error) {
    companyError(req, res, error, "personal tax preparation export error");
  }
});

router.post("/:id/personal-tax-preparations", async (req: Request, res: Response) => {
  try {
    if (Object.keys(req.query).length > 0) throw new SensitiveAccessError("SENSITIVE_REQUEST_INVALID");
    const { userId } = req as AuthenticatedRequest;
    const result = await createPersonalTaxPreparation(req.params["id"] as string, userId, req.body);
    res.status(result.status === "created" ? 201 : 200).json(result);
  } catch (error) {
    companyError(req, res, error, "personal tax preparation create error");
  }
});

router.get("/:id/personal-tax-preparations/:recordId", async (req: Request, res: Response) => {
  try {
    if (Object.keys(req.query).length > 0) throw new SensitiveAccessError("SENSITIVE_REQUEST_INVALID");
    const { userId } = req as AuthenticatedRequest;
    const record = await readPersonalTaxPreparation(req.params["id"] as string, userId, req.params["recordId"] as string);
    res.json(record);
  } catch (error) {
    companyError(req, res, error, "personal tax preparation read error");
  }
});

router.post("/:id/payroll-pay-records", async (req: Request, res: Response) => {
  try {
    if (Object.keys(req.query).length > 0) throw new SensitiveAccessError("SENSITIVE_REQUEST_INVALID");
    const { userId } = req as AuthenticatedRequest;
    const result = await createPayRecord(req.params["id"] as string, userId, req.body);
    res.status(result.status === "created" ? 201 : 200).json(result);
  } catch (error) {
    companyError(req, res, error, "payroll pay record create error");
  }
});

router.get("/:id/payroll-pay-records/:recordId", async (req: Request, res: Response) => {
  try {
    if (Object.keys(req.query).length > 0) throw new SensitiveAccessError("SENSITIVE_REQUEST_INVALID");
    const { userId } = req as AuthenticatedRequest;
    const record = await readPayRecord(req.params["id"] as string, userId, req.params["recordId"] as string);
    res.json(record);
  } catch (error) {
    companyError(req, res, error, "payroll pay record read error");
  }
});

router.get("/:id/specialist-access-history", async (req: Request, res: Response) => {
  try {
    if (Object.keys(req.query).length > 0) throw new SensitiveAccessError("SENSITIVE_REQUEST_INVALID");
    const { userId } = req as AuthenticatedRequest;
    const history = await readSpecialistAccessHistory(req.params["id"] as string, userId);
    res.json(history);
  } catch (error) {
    companyError(req, res, error, "specialist access history error");
  }
});

// ─── GET /api/companies ───────────────────────────────────────────────────────
router.get("/", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const memberships = await db
      .select({ company_id: companyUsersTable.company_id, role: companyUsersTable.role })
      .from(companyUsersTable)
      .where(and(eq(companyUsersTable.user_id, userId), eq(companyUsersTable.is_active, true)));

    if (memberships.length === 0) {
      res.json({ companies: [], roles: {} });
      return;
    }

    const companyIds = memberships.map((m) => m.company_id);
    const companies = await db.select().from(companiesTable).where(inArray(companiesTable.id, companyIds));
    const roles: Record<string, string> = {};
    memberships.forEach((m) => {
      const consistent = memberships.filter(other => other.company_id === m.company_id)
        .every(other => other.role === m.role);
      roles[m.company_id] = consistent && isCompanyRole(m.role) ? m.role : "read_only";
    });
    res.json({ companies, roles });
  } catch (err: unknown) {
    companyError(req, res, err, "companies list error");
  }
});

// ─── POST /api/companies ──────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const parsed = createCompanyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Provide a company name and valid company details only" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [company] = await tx.insert(companiesTable).values(parsed.data).returning();
      await tx.insert(companyUsersTable).values({ company_id: company.id, user_id: userId, role: "owner" });
      return company;
    });
    res.status(201).json(result);
  } catch (err: unknown) {
    companyError(req, res, err, "company create error");
  }
});

// ─── PUT /api/companies/:id ───────────────────────────────────────────────────
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const companyId = req.params["id"] as string;

    const membership = await getCallerMembership(companyId, userId);
    if (!membership) { res.status(403).json({ error: "Access denied" }); return; }
    if (membership.role !== "owner" && membership.role !== "accountant") {
      res.status(403).json({ error: "Only owners and accountants can update company details" });
      return;
    }

    const parsed = updateCompanyBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Provide valid editable company details only" }); return; }
    const company = await db.transaction(async tx => {
      // Use the same company-then-members lock order as membership changes.
      // The preflight lookup is not authority after waiting for another writer.
      const members = await lockedMembers(tx, companyId);
      const actors = members.filter(member => member.user_id === userId);
      if (actors.length !== 1 || actors[0]?.is_active !== true ||
        !["owner", "accountant"].includes(actors[0]?.role ?? "")) {
        throw new CompanyPolicyError("access_denied");
      }
      const [updated] = await tx.update(companiesTable).set({ ...parsed.data, updated_at: new Date() })
        .where(eq(companiesTable.id, companyId)).returning();
      return updated;
    });
    if (!company) { res.status(404).json({ error: "Company not found" }); return; }
    res.json(company);
  } catch (err: unknown) {
    companyError(req, res, err, "company update error");
  }
});

// ─── DELETE /api/companies/:id ────────────────────────────────────────────────
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const companyId = req.params["id"] as string;

    const membership = await getCallerMembership(companyId, userId);
    if (!membership || membership.role !== "owner") {
      res.status(403).json({ error: "Only company owners can delete a company" });
      return;
    }

    await db.transaction(async (tx) => {
      const members = await lockedMembers(tx, companyId);
      const actors = members.filter(member => member.user_id === userId);
      if (actors.length !== 1 || actors[0]?.role !== "owner" || actors[0]?.is_active !== true) {
        throw new CompanyPolicyError("access_denied");
      }
      const removed = await tx.delete(companyUsersTable).where(eq(companyUsersTable.company_id, companyId)).returning();
      if (removed.length !== members.length) throw new SensitiveAccessError("SENSITIVE_OPERATION_UNAVAILABLE");
      await auditSpecializedMembershipChanges(queryAdapter(tx), {
        companyId, actorId: userId,
        changes: removed.map(member => ({ operation: "company_delete", before: member, after: null })),
      });
      const deleted = await tx.delete(companiesTable).where(eq(companiesTable.id, companyId)).returning({ id: companiesTable.id });
      if (deleted.length !== 1 || deleted[0]?.id !== companyId.toLowerCase()) throw new SensitiveAccessError("SENSITIVE_OPERATION_UNAVAILABLE");
    });
    res.json({ success: true });
  } catch (err: unknown) {
    companyError(req, res, err, "company delete error");
  }
});

// ─── GET /api/companies/:id/members ──────────────────────────────────────────
router.get("/:id/members", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const companyId = req.params["id"] as string;

    const membership = await getCallerMembership(companyId, userId);
    if (!membership) { res.status(403).json({ error: "Access denied" }); return; }

    const members = await db.select().from(companyUsersTable).where(eq(companyUsersTable.company_id, companyId));
    res.json(members);
  } catch (err: unknown) {
    companyError(req, res, err, "list members error");
  }
});

// ─── POST /api/companies/:id/members — add by Clerk user_id ──────────────────
router.post("/:id/members", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const companyId = req.params["id"] as string;
    const { user_id, role = "member" } = (req.body ?? {}) as { user_id: string; role?: string };

    if (typeof user_id !== "string" || !user_id.trim()) { res.status(400).json({ error: "user_id is required" }); return; }

    if (!isCompanyRole(role)) { res.status(400).json({ error: "Choose a valid company role" }); return; }
    const membership = await getCallerMembership(companyId, userId);
    if (!membership || membership.role !== "owner") { res.status(403).json({ error: "Access denied" }); return; }
    const target = await identities.byId(user_id);
    if (!target || target.id !== user_id) {
      res.status(404).json({ error: "This user must have a LedgerPoint account before they can be added" }); return;
    }
    const m = await db.transaction(async tx => {
      const members = await lockedMembers(tx, companyId);
      authorizeMemberChange({ companyId, actorId: userId, targetId: user_id, members, action: "add", nextRole: role });
      const [created] = await tx.insert(companyUsersTable).values({ company_id: companyId, user_id, role }).returning();
      if (!created) throw new SensitiveAccessError("SENSITIVE_OPERATION_UNAVAILABLE");
      await auditSpecializedMembershipChange(queryAdapter(tx), {
        companyId, actorId: userId, operation: "member_add", before: null, after: created,
      });
      return created;
    });
    res.status(201).json(m);
  } catch (err: unknown) {
    companyError(req, res, err, "add member error");
  }
});

// ─── PUT /api/companies/:id/members/:userId — change role ────────────────────
router.put("/:id/members/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const companyId = req.params["id"] as string;
    const targetUserId = req.params["userId"] as string;
    const { role } = (req.body ?? {}) as { role: string };

    if (!isCompanyRole(role)) { res.status(400).json({ error: "Choose a valid company role" }); return; }
    const updated = await db.transaction(async tx => {
      const members = await lockedMembers(tx, companyId);
      authorizeMemberChange({ companyId, actorId: userId, targetId: targetUserId, members, action: "change_role", nextRole: role });
      const [changed] = await tx.update(companyUsersTable).set({ role, updated_at: new Date() })
        .where(and(eq(companyUsersTable.company_id, companyId), eq(companyUsersTable.user_id, targetUserId))).returning();
      if (!changed) throw new SensitiveAccessError("SENSITIVE_OPERATION_UNAVAILABLE");
      await auditSpecializedMembershipChange(queryAdapter(tx), {
        companyId, actorId: userId, operation: "role_change", before: members.find(member => member.user_id === targetUserId)!, after: changed,
      });
      return changed;
    });
    res.json(updated);
  } catch (err: unknown) {
    companyError(req, res, err, "change role error");
  }
});

// ─── DELETE /api/companies/:id/members/:userId ────────────────────────────────
router.delete("/:id/members/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const companyId = req.params["id"] as string;
    const targetUserId = req.params["userId"] as string;

    await db.transaction(async tx => {
      const members = await lockedMembers(tx, companyId);
      authorizeMemberChange({ companyId, actorId: userId, targetId: targetUserId, members, action: "remove" });
      const [removed] = await tx.delete(companyUsersTable)
        .where(and(eq(companyUsersTable.company_id, companyId), eq(companyUsersTable.user_id, targetUserId))).returning();
      if (!removed) throw new SensitiveAccessError("SENSITIVE_OPERATION_UNAVAILABLE");
      await auditSpecializedMembershipChange(queryAdapter(tx), {
        companyId, actorId: userId, operation: "member_remove", before: removed, after: null,
      });
    });
    res.json({ success: true });
  } catch (err: unknown) {
    companyError(req, res, err, "remove member error");
  }
});

// ─── POST /api/companies/:id/invite — add member by email ────────────────────
router.post("/:id/invite", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const companyId = req.params["id"] as string;
    const { email, role = "staff" } = (req.body ?? {}) as { email: string; role?: string };

    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "A valid email is required" }); return;
    }
    if (!isCompanyRole(role)) { res.status(400).json({ error: "Choose a valid company role" }); return; }

    const membership = await getCallerMembership(companyId, userId);
    if (!membership || membership.role !== "owner") {
      res.status(403).json({ error: "Only company owners can invite members" });
      return;
    }

    const invitee = await identities.byEmail(email);
    if (!invitee) {
      res.status(404).json({ error: "No LedgerPoint account found for this email. They must sign up first." });
      return;
    }

    const m = await db.transaction(async tx => {
      const members = await lockedMembers(tx, companyId);
      authorizeMemberChange({ companyId, actorId: userId, targetId: invitee.id, members, action: "add", nextRole: role });
      const [created] = await tx.insert(companyUsersTable)
        .values({ company_id: companyId, user_id: invitee.id, role }).returning();
      if (!created) throw new SensitiveAccessError("SENSITIVE_OPERATION_UNAVAILABLE");
      await auditSpecializedMembershipChange(queryAdapter(tx), {
        companyId, actorId: userId, operation: "member_invite", before: null, after: created,
      });
      return created;
    });

    res.status(201).json({ member: m, message: `${email} has been added to the company.` });
  } catch (err: unknown) {
    companyError(req, res, err, "invite error");
  }
});

router.use(safeRouteErrors);
return router;
}

export default createCompaniesRouter();
