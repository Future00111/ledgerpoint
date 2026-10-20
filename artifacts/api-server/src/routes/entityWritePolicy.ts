import type { RequestHandler } from "express";
/**
 * Entity types whose records are managed only through dedicated workflows.
 * Keeping this decision separate from the Express handlers makes it harder for
 * a newly added generic mutation route to accidentally bypass a workflow lock.
 */
const WORKFLOW_MANAGED_ENTITIES = new Set(["CompanyUser", "VATReturn", "SalesInvoice"]);

export function isGenericEntityWriteBlocked(entityName: string): boolean {
  return WORKFLOW_MANAGED_ENTITIES.has(entityName) || entityName === "Company";
}

export function genericEntityWriteError(entityName: string): string {
  if (entityName === "SalesInvoice") {
    return "Use the protected financial-draft invoice workflow; generic invoice writes are disabled";
  }
  if (entityName === "VATReturn") {
    return "VAT returns are managed by the VAT Assistant workflow and cannot be changed through generic entity routes";
  }
  return "Use /api/companies for company management";
}

/** Central admission guard, in addition to the per-operation checks. */
export const genericEntityWriteBoundary: RequestHandler = (req, res, next) => {
  const name = String(req.params.entity);
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && isGenericEntityWriteBlocked(name)) {
    res.status(403).json({ error: genericEntityWriteError(name) });
    return;
  }
  next();
};