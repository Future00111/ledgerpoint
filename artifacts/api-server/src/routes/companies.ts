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
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { companiesTable, companyUsersTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/requireAuth";
import { findActiveMembership } from "../middlewares/companyScope";

const router = Router();
router.use(requireAuth);

// ─── helpers ─────────────────────────────────────────────────────────────────

async function getCallerMembership(companyId: string, userId: string) {
  return findActiveMembership(userId, companyId);
}

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
    memberships.forEach((m) => { roles[m.company_id] = m.role ?? "member"; });
    res.json({ companies, roles });
  } catch (err: unknown) {
    req.log.error({ err }, "companies list error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── POST /api/companies ──────────────────────────────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const { name, ...rest } = req.body as Record<string, unknown>;
    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "company name is required" });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [company] = await tx.insert(companiesTable).values({ name: name.trim(), ...rest }).returning();
      await tx.insert(companyUsersTable).values({ company_id: company.id, user_id: userId, role: "owner" });
      return company;
    });
    res.status(201).json(result);
  } catch (err: unknown) {
    req.log.error({ err }, "company create error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
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

    const updateData: Record<string, unknown> = { ...req.body as Record<string, unknown>, updated_at: new Date() };
    delete updateData["id"];

    const [company] = await db.update(companiesTable).set(updateData).where(eq(companiesTable.id, companyId)).returning();
    if (!company) { res.status(404).json({ error: "Company not found" }); return; }
    res.json(company);
  } catch (err: unknown) {
    req.log.error({ err }, "company update error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
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
      await tx.delete(companyUsersTable).where(eq(companyUsersTable.company_id, companyId));
      await tx.delete(companiesTable).where(eq(companiesTable.id, companyId));
    });
    res.json({ success: true });
  } catch (err: unknown) {
    req.log.error({ err }, "company delete error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
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
    req.log.error({ err }, "list members error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── POST /api/companies/:id/members — add by Clerk user_id ──────────────────
router.post("/:id/members", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const companyId = req.params["id"] as string;
    const { user_id, role = "member" } = req.body as { user_id: string; role?: string };

    if (!user_id) { res.status(400).json({ error: "user_id is required" }); return; }

    const membership = await getCallerMembership(companyId, userId);
    if (!membership || membership.role !== "owner") {
      res.status(403).json({ error: "Only company owners can add members" });
      return;
    }

    const [m] = await db.insert(companyUsersTable).values({ company_id: companyId, user_id, role }).returning();
    res.status(201).json(m);
  } catch (err: unknown) {
    req.log.error({ err }, "add member error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── PUT /api/companies/:id/members/:userId — change role ────────────────────
router.put("/:id/members/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const companyId = req.params["id"] as string;
    const targetUserId = req.params["userId"] as string;
    const { role } = req.body as { role: string };

    if (!role) { res.status(400).json({ error: "role is required" }); return; }

    const membership = await getCallerMembership(companyId, userId);
    if (!membership || membership.role !== "owner") {
      res.status(403).json({ error: "Only company owners can change roles" });
      return;
    }

    const [updated] = await db
      .update(companyUsersTable)
      .set({ role })
      .where(and(eq(companyUsersTable.company_id, companyId), eq(companyUsersTable.user_id, targetUserId)))
      .returning();
    if (!updated) { res.status(404).json({ error: "Member not found" }); return; }
    res.json(updated);
  } catch (err: unknown) {
    req.log.error({ err }, "change role error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── DELETE /api/companies/:id/members/:userId ────────────────────────────────
router.delete("/:id/members/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const companyId = req.params["id"] as string;
    const targetUserId = req.params["userId"] as string;

    const membership = await getCallerMembership(companyId, userId);
    if (!membership) { res.status(403).json({ error: "Access denied" }); return; }
    if (membership.role !== "owner" && userId !== targetUserId) {
      res.status(403).json({ error: "Only company owners can remove other members" });
      return;
    }

    await db
      .delete(companyUsersTable)
      .where(and(eq(companyUsersTable.company_id, companyId), eq(companyUsersTable.user_id, targetUserId)));
    res.json({ success: true });
  } catch (err: unknown) {
    req.log.error({ err }, "remove member error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

// ─── POST /api/companies/:id/invite — add member by email ────────────────────
router.post("/:id/invite", async (req: Request, res: Response) => {
  try {
    const { userId } = req as AuthenticatedRequest;
    const companyId = req.params["id"] as string;
    const { email, role = "staff" } = req.body as { email: string; role?: string };

    if (!email) { res.status(400).json({ error: "email is required" }); return; }

    const membership = await getCallerMembership(companyId, userId);
    if (!membership || membership.role !== "owner") {
      res.status(403).json({ error: "Only company owners can invite members" });
      return;
    }

    // Look up the Clerk user by email
    const users = await clerkClient.users.getUserList({ emailAddress: [email.toLowerCase()] });
    if (!users.data || users.data.length === 0) {
      res.status(404).json({
        error: `No Ledgerly account found for ${email}. They must sign up first, then you can add them.`,
      });
      return;
    }

    const invitee = users.data[0];
    if (!invitee) {
      res.status(404).json({ error: `No account found for ${email}` });
      return;
    }

    // Check if already a member
    const existing = await getCallerMembership(companyId, invitee.id);
    if (existing) {
      res.status(409).json({ error: `${email} is already a member of this company` });
      return;
    }

    const [m] = await db
      .insert(companyUsersTable)
      .values({ company_id: companyId, user_id: invitee.id, role })
      .returning();

    res.status(201).json({ member: m, message: `${email} has been added to the company.` });
  } catch (err: unknown) {
    req.log.error({ err }, "invite error");
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
});

export default router;
