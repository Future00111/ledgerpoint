import { withPayrollAccess, SensitiveAccessError } from './service';
import { requireReadOnlySensitiveStorage } from './recordStorage';

export type EmployeeBankDetails = { account_number: string } | { last_four: string };

/** One employee's bank account projection. No sort code, payment instruction, export or mutation. */
export async function readEmployeeBankDetails(companyId: string, actorId: string, employeeId: string): Promise<EmployeeBankDetails> {
  return withPayrollAccess({ company_id: companyId, actor_id: actorId, resource_company_id: companyId,
    resource_id: employeeId, action: 'payroll.bank.read' }, async context => {
    const full = context.role === 'owner' || context.role === 'payroll_preparer';
    const masked = context.role === 'payroll_approver';
    if (!full && !masked) throw new SensitiveAccessError('SENSITIVE_ACCESS_DENIED');
    await requireReadOnlySensitiveStorage(context, 'employee_bank_details');
    // An approver's SQL result never contains the full account number.
    const found = await context.query(`SELECT ${masked ? 'right(account_number,4) AS last_four' : 'account_number'}
      FROM public.employee_bank_details WHERE company_id=$1 AND employee_id=$2`, [context.companyId, context.resourceId]);
    if (found.rowCount !== 1) throw new SensitiveAccessError('SENSITIVE_ACCESS_DENIED');
    const value = masked ? found.rows[0].last_four : found.rows[0].account_number;
    const length = masked ? 4 : 8;
    if (typeof value !== 'string' || value.length !== length || !/^[0-9]+$/.test(value))
      throw new SensitiveAccessError('SENSITIVE_OPERATION_UNAVAILABLE');
    return masked ? { last_four: value } : { account_number: value };
  });
}
