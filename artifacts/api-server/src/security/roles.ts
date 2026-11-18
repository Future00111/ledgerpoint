/** Compatibility roles for non-ledger writes. Native posting permissions are separate. */
export const COMPANY_ROLES = Object.freeze(["owner", "admin", "accountant", "staff", "member", "read_only",
  "payroll_reader", "payroll_preparer", "payroll_approver", "personal_tax_preparer", "personal_tax_submitter"] as const);
export type CompanyRole = typeof COMPANY_ROLES[number];

export function isCompanyRole(role: unknown): role is CompanyRole {
  return typeof role === "string" && (COMPANY_ROLES as readonly string[]).includes(role);
}

/** Call only after resolving an active, company-scoped membership. */
export function canWriteCompanyData(role: unknown): boolean {
  // Specialized roles never inherit bookkeeping writes merely by being valid.
  return typeof role === "string" && ["owner", "admin", "accountant", "staff", "member"].includes(role);
}

export const SENSITIVE_ACTIONS = Object.freeze(["payroll.read", "payroll.export", "payroll.prepare", "payroll.approve", "payroll.bank.read",
  "personal_tax.read", "personal_tax.export", "personal_tax.prepare", "personal_tax.submit"] as const);
export type SensitiveAction = typeof SENSITIVE_ACTIONS[number];

/** Company ownership retains administration; ordinary bookkeeping roles confer no sensitive rights.
 * Approval/submission are separate from preparation. A submit right is not external filing authority. */
const sensitiveRights: Readonly<Partial<Record<CompanyRole, readonly SensitiveAction[]>>> = Object.freeze({
  owner: SENSITIVE_ACTIONS,
  payroll_reader: ["payroll.read"],
  payroll_preparer: ["payroll.read", "payroll.export", "payroll.prepare", "payroll.bank.read"],
  payroll_approver: ["payroll.read", "payroll.approve", "payroll.bank.read"],
  personal_tax_preparer: ["personal_tax.read", "personal_tax.export", "personal_tax.prepare"],
  personal_tax_submitter: ["personal_tax.read", "personal_tax.submit"],
});

export function isSensitiveAction(action: unknown): action is SensitiveAction {
  return typeof action === "string" && (SENSITIVE_ACTIONS as readonly string[]).includes(action);
}

/** Invoke only with current company-scoped membership, never request-supplied capabilities. */
export function canAccessSensitiveData(role: unknown, active: unknown, action: unknown): boolean {
  return active === true && isCompanyRole(role) && isSensitiveAction(action)
    && (sensitiveRights[role]?.includes(action) ?? false);
}
