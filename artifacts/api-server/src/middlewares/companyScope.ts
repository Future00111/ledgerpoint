import { db } from "@workspace/db";
import { companyUsersTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import type { Response } from "express";

export interface ActiveCompanyMembership {
  company_id: string;
  user_id: string;
  role: string | null;
  is_active: boolean | null;
}

export interface CompanyScope {
  userId: string;
  companyId: string;
  role: string | null;
}

export type CompanyScopeFailure =
  | "missing_company_context"
  | "invalid_company_context"
  | "conflicting_company_context"
  | "inactive_or_missing_membership"
  | "membership_scope_mismatch"
  | "membership_lookup_failed";

export type CompanyScopeDecision =
  | { ok: true; scope: CompanyScope }
  | { ok: false; reason: CompanyScopeFailure };

export type MembershipLookup = (
  userId: string,
  companyId: string,
) => Promise<ActiveCompanyMembership | null>;

/**
 * Resolve active membership rows without allowing database row order to decide
 * authorization. Duplicate rows are safe only when every authorization
 * attribute agrees; conflicting rows fail closed.
 */
export function resolveActiveMembership(
  memberships: ActiveCompanyMembership[],
): ActiveCompanyMembership | null {
  const [first] = memberships;
  if (!first) return null;
  const isConsistent = memberships.every((membership) =>
    membership.company_id === first.company_id &&
    membership.user_id === first.user_id &&
    membership.role === first.role &&
    membership.is_active === true
  );
  return isConsistent ? first : null;
}

/**
 * The only database-backed membership lookup used by request authorization.
 * Active status is part of the query, not a later best-effort check.
 */
export async function findActiveMembership(
  userId: string,
  companyId: string,
): Promise<ActiveCompanyMembership | null> {
  const memberships = await db
    .select({
      company_id: companyUsersTable.company_id,
      user_id: companyUsersTable.user_id,
      role: companyUsersTable.role,
      is_active: companyUsersTable.is_active,
    })
    .from(companyUsersTable)
    .where(
      and(
        eq(companyUsersTable.user_id, userId),
        eq(companyUsersTable.company_id, companyId),
        eq(companyUsersTable.is_active, true),
      ),
    );

  return resolveActiveMembership(memberships);
}

export async function findActiveCompanyIds(userId: string): Promise<string[]> {
  const memberships = await db
    .select({ company_id: companyUsersTable.company_id })
    .from(companyUsersTable)
    .where(
      and(
        eq(companyUsersTable.user_id, userId),
        eq(companyUsersTable.is_active, true),
      ),
    );

  return [...new Set(memberships.map((membership) => membership.company_id))];
}

type CompanyContextValue =
  | { state: "missing"; value?: undefined }
  | { state: "valid"; value: string }
  | { state: "invalid"; value?: undefined };

function parseCompanyContext(value: unknown): CompanyContextValue {
  if (value === undefined) return { state: "missing" };
  if (typeof value === "string" && value.length > 0) {
    return { state: "valid", value };
  }
  return { state: "invalid" };
}

/**
 * Keep the authorization decision pure so revocation, mismatch, and
 * fail-closed behavior can be tested without a database or Clerk session.
 */
export function evaluateCompanyScope(input: {
  userId: string | undefined;
  requestedCompanyId?: unknown;
  resourceCompanyId?: unknown;
  membership: ActiveCompanyMembership | null;
}): CompanyScopeDecision {
  const { userId, requestedCompanyId, resourceCompanyId, membership } = input;
  const requested = parseCompanyContext(requestedCompanyId);
  const resource = parseCompanyContext(resourceCompanyId);

  if (requested.state === "invalid" || resource.state === "invalid") {
    return { ok: false, reason: "invalid_company_context" };
  }
  if (!userId || (requested.state === "missing" && resource.state === "missing")) {
    return { ok: false, reason: "missing_company_context" };
  }
  if (
    requested.state === "valid" &&
    resource.state === "valid" &&
    requested.value !== resource.value
  ) {
    return { ok: false, reason: "conflicting_company_context" };
  }

  const companyId =
    resource.state === "valid"
      ? resource.value
      : requested.state === "valid"
        ? requested.value
        : undefined;
  if (!companyId) {
    return { ok: false, reason: "missing_company_context" };
  }
  if (!membership || membership.is_active !== true) {
    return { ok: false, reason: "inactive_or_missing_membership" };
  }
  if (
    membership.user_id !== userId ||
    membership.company_id !== companyId
  ) {
    return { ok: false, reason: "membership_scope_mismatch" };
  }

  return {
    ok: true,
    scope: { userId, companyId, role: membership.role },
  };
}

/**
 * Resolve and validate a request's company scope. A resource-derived company
 * ID wins over caller input, while conflicting IDs are rejected.
 */
export async function resolveCompanyScope(
  input: {
    userId: string | undefined;
    requestedCompanyId?: unknown;
    resourceCompanyId?: unknown;
  },
  lookup: MembershipLookup = findActiveMembership,
): Promise<CompanyScopeDecision> {
  const requested = parseCompanyContext(input.requestedCompanyId);
  const resource = parseCompanyContext(input.resourceCompanyId);

  if (requested.state === "invalid" || resource.state === "invalid") {
    return { ok: false, reason: "invalid_company_context" };
  }
  if (
    requested.state === "valid" &&
    resource.state === "valid" &&
    requested.value !== resource.value
  ) {
    return { ok: false, reason: "conflicting_company_context" };
  }
  const companyId =
    resource.state === "valid"
      ? resource.value
      : requested.state === "valid"
        ? requested.value
        : undefined;

  if (!input.userId || !companyId) {
    return evaluateCompanyScope({ ...input, membership: null });
  }

  try {
    const membership = await lookup(input.userId, companyId);
    return evaluateCompanyScope({ ...input, membership });
  } catch {
    return { ok: false, reason: "membership_lookup_failed" };
  }
}

/**
 * Express adapter for handlers that want a single checked scope. It never
 * places company context from the request into the response or global state.
 */
export async function requireCompanyScope(
  res: Response,
  input: {
    userId: string | undefined;
    requestedCompanyId?: unknown;
    resourceCompanyId?: unknown;
  },
): Promise<CompanyScope | null> {
  const decision = await resolveCompanyScope(input);
  if (decision.ok) return decision.scope;

  if (
    decision.reason === "missing_company_context" ||
    decision.reason === "invalid_company_context"
  ) {
    res.status(400).json({ error: "A valid company context is required" });
  } else {
    res.status(403).json({ error: "Access denied" });
  }
  return null;
}

export function createCompanyJobContext(companyId: string): CompanyJobContext {
  if (!companyId) throw new Error("Background job company context is required");
  return {
    companyId,
    principal: { kind: "system", id: "ai-task-scheduler" },
  };
}

export interface CompanyJobContext {
  companyId: string;
  principal: { kind: "system"; id: string };
}

export function requireCompanyJobContext(context: CompanyJobContext): string {
  if (
    !context ||
    context.principal?.kind !== "system" ||
    !context.principal.id ||
    !context.companyId
  ) {
    throw new Error("Invalid background job company context");
  }
  return context.companyId;
}