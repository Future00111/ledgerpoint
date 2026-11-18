import { withPayrollAccess, SensitiveAccessError, type SensitiveContext } from './service';
import { requireReadOnlySensitiveStorage } from './recordStorage';

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

export interface PayRecordCreation {
  id: string;
  employee_id: string;
  effective_from: string;
  annual_salary_pence: string;
}
function invalid(): never { throw new SensitiveAccessError('SENSITIVE_REQUEST_INVALID'); }
const creationFields = ['annual_salary_pence', 'effective_from', 'employee_id', 'id'];

/** Exact native intent, with no inferred date, currency, floating-point money or caller authority. */
export function parsePayRecordCreation(input: unknown): PayRecordCreation {
  if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(input).length !== creationFields.length || Object.keys(descriptors).sort().join('|') !== creationFields.join('|') ||
      Object.values(descriptors).some(descriptor => !('value' in descriptor))) invalid();
  const body = input as PayRecordCreation;
  if (!uuid(body.id) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab]/i.test(body.id) || !uuid(body.employee_id) ||
      typeof body.effective_from !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.effective_from) ||
      typeof body.annual_salary_pence !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(body.annual_salary_pence) ||
      BigInt(body.annual_salary_pence) > 9223372036854775807n) invalid();
  const year = Number(body.effective_from.slice(0, 4)), month = Number(body.effective_from.slice(5, 7)), day = Number(body.effective_from.slice(8, 10));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]!) invalid();
  return { id: body.id.toLowerCase(), employee_id: body.employee_id.toLowerCase(),
    effective_from: body.effective_from, annual_salary_pence: body.annual_salary_pence };
}

async function requirePayCreationFunction(context: SensitiveContext) {
  const rows = (await context.query(`SELECT pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proretset,p.prokind,p.proconfig,
    p.prorettype='text'::regtype text_result,has_function_privilege(current_user,p.oid,'EXECUTE') can_execute,
    EXISTS(SELECT 1 FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
      WHERE acl.grantee<>p.proowner AND (acl.grantee<>'ledgerly_api'::regrole OR acl.privilege_type<>'EXECUTE' OR acl.is_grantable)) unsafe_acl
    FROM pg_proc p WHERE p.oid=to_regprocedure('public.ledgerly_create_employee_pay_record(uuid,text,uuid,uuid,date,bigint)')`)).rows;
  if (rows.length !== 1 || rows[0].owner !== 'ledgerly_canonical_owner' || !rows[0].prosecdef || rows[0].proretset ||
      rows[0].prokind !== 'f' || !rows[0].text_result || !rows[0].can_execute || rows[0].unsafe_acl ||
      JSON.stringify(rows[0].proconfig) !== '["search_path=pg_catalog"]') unavailable();
}

/** Create one dated record or replay the same native-created intent. The restricted
 * function owns the creation receipt; the boundary audits each successful prepare call. */
export async function createPayRecord(companyId: string, actorId: string, input: unknown): Promise<{
  id: string; status: 'created' | 'replayed';
}> {
  const body = parsePayRecordCreation(input);
  return withPayrollAccess({ company_id: companyId, actor_id: actorId, resource_company_id: companyId,
    resource_id: body.id, action: 'payroll.prepare' }, async context => {
    await requireReadOnlySensitiveStorage(context, 'employee_pay_records');
    await requirePayCreationFunction(context);
    const result = await context.query(`SELECT public.ledgerly_create_employee_pay_record(
      $1::uuid,$2::text,$3::uuid,$4::uuid,$5::date,$6::bigint) status`,
    [context.companyId, context.actorId, context.resourceId, body.employee_id, body.effective_from, body.annual_salary_pence]);
    if (result.rowCount !== 1) unavailable();
    const status = result.rows[0]?.status;
    if (status === 'denied') throw new SensitiveAccessError('SENSITIVE_ACCESS_DENIED');
    if (status === 'conflict') throw new SensitiveAccessError('SENSITIVE_REQUEST_CONFLICT');
    if (status !== 'created' && status !== 'replayed') unavailable();
    return { id: context.resourceId, status };
  });
}

/** Read-only native record boundary. IDs come from the route and actor from authentication.
 * The employee reference is preparation metadata, selected only for owner/preparer roles. */
export async function readPayRecord(companyId: string, actorId: string, recordId: string): Promise<PayRecord> {
  return withPayrollAccess({ company_id: companyId, actor_id: actorId, resource_company_id: companyId,
    resource_id: recordId, action: 'payroll.read' }, async context => {
    await requireReadOnlySensitiveStorage(context, 'employee_pay_records');
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
