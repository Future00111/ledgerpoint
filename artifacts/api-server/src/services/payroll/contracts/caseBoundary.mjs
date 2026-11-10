import { resolveQualifiedCase } from '../../tax/contracts/caseRegistry.mjs';
/** Payroll cannot accidentally select an income-tax or VAT contract. */
export function resolvePayrollCase(registry, selector) {
  if (selector?.domain !== 'payroll') return { ok: false, code: 'INVALID_PAYROLL_CASE' };
  return resolveQualifiedCase(registry, selector);
}
