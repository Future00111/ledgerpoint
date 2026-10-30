/**
 * /api/companies — secure company management.
 *
 * GET    /api/companies                      — list companies the user belongs to
 * POST   /api/companies                      — create company + owner membership (transactional)
 * PUT    /api/companies/:id                  — update company fields (owner only)
 * DELETE /api/companies/:id                  — delete company (owner only)
 * GET    /api/companies/:id/members          — list members of a company
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
router.use(auth);

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
    const [company] = await db.update(companiesTable).set({ ...parsed.data, updated_at: new Date() })
      .where(eq(companiesTable.id, companyId)).returning();
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
      await tx.delete(companyUsersTable).where(eq(companyUsersTable.company_id, companyId));
      await tx.delete(companiesTable).where(eq(companiesTable.id, companyId));
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
      await tx.delete(companyUsersTable)
        .where(and(eq(companyUsersTable.company_id, companyId), eq(companyUsersTable.user_id, targetUserId)));
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
