/** Compatibility roles for non-ledger writes. Native posting permissions are separate. */
export const COMPANY_ROLES = ["owner", "admin", "accountant", "staff", "member", "read_only"] as const;
export type CompanyRole = typeof COMPANY_ROLES[number];

export function isCompanyRole(role: unknown): role is CompanyRole {
  return typeof role === "string" && (COMPANY_ROLES as readonly string[]).includes(role);
}

/** Call only after resolving an active, company-scoped membership. */
export function canWriteCompanyData(role: unknown): boolean {
  return isCompanyRole(role) && role !== "read_only";
}
