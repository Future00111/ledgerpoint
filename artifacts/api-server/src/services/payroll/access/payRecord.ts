import { withPayrollAccess, SensitiveAccessError, type SensitiveContext } from './service';

export interface PayRecord {
  id: string;
  effective_from: string;
  annual_salary_pence: string;
  currency: 'GBP';
  employee_id?: string;
}
const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
function unavailable(): never { throw new SensitiveAccessError('SENSITIVE_OPERATION_UNAVAILABLE'); }

async function requirePayRecordStorage(context: SensitiveContext) {
  const rows = (await context.query(`SELECT current_user actor,pg_get_userbyid(c.relowner) owner,c.relkind,
    has_table_privilege(current_user,c.oid,'SELECT') can_read,
    has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') can_mutate,
    has_any_column_privilege(current_user,c.oid,'INSERT') can_insert_column,
    has_any_column_privilege(current_user,c.oid,'UPDATE') can_update_column
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='employee_pay_records'`)).rows;
  if (rows.length !== 1 || rows[0].actor !== 'ledgerly_api' || rows[0].owner !== 'ledgerly_canonical_owner' ||
      rows[0].relkind !== 'r' || !rows[0].can_read || rows[0].can_mutate || rows[0].can_insert_column || rows[0].can_update_column) unavailable();
}

/** Read-only native record boundary. IDs come from the route and actor from authentication.
 * The employee reference is preparation metadata, selected only for owner/preparer roles. */
export async function readPayRecord(companyId: string, actorId: string, recordId: string): Promise<PayRecord> {
  return withPayrollAccess({ company_id: companyId, actor_id: actorId, resource_company_id: companyId,
    resource_id: recordId, action: 'payroll.read' }, async context => {
    await requirePayRecordStorage(context);
    const includeEmployee = context.role === 'owner' || context.role === 'payroll_preparer';
    const found = await context.query(`SELECT id,to_char(effective_from,'YYYY-MM-DD') effective_from,
      annual_salary_pence::text annual_salary_pence${includeEmployee ? ',employee_id' : ''}
      FROM public.employee_pay_records WHERE company_id=$1 AND id=$2`, [context.companyId, context.resourceId]);
    // Missing and foreign references share one denial and never produce a successful-read audit.
    if (found.rowCount !== 1) throw new SensitiveAccessError('SENSITIVE_ACCESS_DENIED');
    const row = found.rows[0];
    if (row.id !== context.resourceId || typeof row.effective_from !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.effective_from) ||
        typeof row.annual_salary_pence !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(row.annual_salary_pence) ||
        BigInt(row.annual_salary_pence) > 9223372036854775807n || (includeEmployee && !uuid(row.employee_id))) unavailable();
    const result: PayRecord = { id: row.id, effective_from: row.effective_from,
      annual_salary_pence: row.annual_salary_pence, currency: 'GBP' };
    if (includeEmployee) result.employee_id = row.employee_id;
    return result;
  });
}
