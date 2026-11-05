import { insertCompanySchema } from "@workspace/db/schema";
import { isCompanyRole } from "./roles";

export const createCompanyBody = insertCompanySchema.extend({
  name: insertCompanySchema.shape.name.trim().min(1),
}).strict();
export const updateCompanyBody = createCompanyBody.partial().strict();

const ERRORS = {
  access_denied: [403, "Access denied"],
  company_missing: [404, "Company not found"],
  member_missing: [404, "Member not found"],
  duplicate_member: [409, "This user already has a membership in this company"],
  ambiguous_membership: [409, "Membership records need review before this change can be made"],
  last_owner: [409, "Keep at least one active owner before removing or changing this owner"],
} as const;

export class CompanyPolicyError extends Error {
  readonly status: number;
  constructor(readonly code: keyof typeof ERRORS) {
    super(ERRORS[code][1]);
    this.status = ERRORS[code][0];
  }
}

export interface PolicyMembership {
  company_id: string;
  user_id: string;
  role: string | null;
  is_active: boolean | null;
}

/** Rows must be reloaded inside the transaction after taking the company lock. */
export function authorizeMemberChange(input: {
  companyId: string;
  actorId: string;
  targetId: string;
  members: PolicyMembership[];
  action: "add" | "change_role" | "remove";
  nextRole?: unknown;
}): void {
  const { companyId, actorId, targetId, members, action, nextRole } = input;
  if (members.some(member => member.company_id !== companyId)) throw new CompanyPolicyError("access_denied");
  const actors = members.filter(member => member.user_id === actorId);
  const actor = actors[0];
  if (actors.length !== 1 || !actor || actor.is_active !== true || !isCompanyRole(actor.role)) {
    throw new CompanyPolicyError("access_denied");
  }
  if (actor.role !== "owner" && !(action === "remove" && actorId === targetId)) {
    throw new CompanyPolicyError("access_denied");
  }
  if (action !== "remove" && !isCompanyRole(nextRole)) throw new CompanyPolicyError("access_denied");
  const targets = members.filter(member => member.user_id === targetId);
  if (action === "add") {
    if (targets.length) throw new CompanyPolicyError("duplicate_member");
    return;
  }
  const target = targets[0];
  if (!target) throw new CompanyPolicyError("member_missing");
  if (targets.length !== 1 || !isCompanyRole(target.role) || typeof target.is_active !== "boolean") {
    throw new CompanyPolicyError("ambiguous_membership");
  }
  if (target.role === "owner" && target.is_active && (action === "remove" || nextRole !== "owner")) {
    // Conflicting duplicate rows never count as a second owner.
    const anotherOwner = members.some(member => member.user_id !== targetId && member.role === "owner" &&
      member.is_active === true && members.filter(other => other.user_id === member.user_id).length === 1);
    if (!anotherOwner) throw new CompanyPolicyError("last_owner");
  }
}
