import { randomUUID } from 'node:crypto';
import { transact, type Queryable } from '../../accountingDocuments/core';
import { canAccessSensitiveData, isSensitiveAction, type CompanyRole, type SensitiveAction } from '../../../security/roles';

export class SensitiveAccessError extends Error {
  constructor(readonly code: 'SENSITIVE_ACCESS_DENIED' | 'SENSITIVE_REQUEST_INVALID' | 'SENSITIVE_REQUEST_CONFLICT' | 'SENSITIVE_OPERATION_UNAVAILABLE') {
    super(code);
  }
  get status() { return this.code === 'SENSITIVE_ACCESS_DENIED' ? 403 : this.code === 'SENSITIVE_REQUEST_INVALID' ? 400 : this.code === 'SENSITIVE_REQUEST_CONFLICT' ? 409 : 503; }
}

export interface SensitiveRequest {
  company_id: string;
  actor_id: string;
  resource_company_id: string;
  resource_id: string;
  action: SensitiveAction;
}
export interface SensitiveContext {
  readonly companyId: string;
  readonly actorId: string;
  readonly resourceId: string;
  readonly role: CompanyRole;
  readonly action: SensitiveAction;
  readonly query: Queryable['query'];
}
function invalid(): never { throw new SensitiveAccessError('SENSITIVE_REQUEST_INVALID'); }
function denied(): never { throw new SensitiveAccessError('SENSITIVE_ACCESS_DENIED'); }
function unavailable(): never { throw new SensitiveAccessError('SENSITIVE_OPERATION_UNAVAILABLE'); }
const uuid = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const fields = ['action', 'actor_id', 'company_id', 'resource_company_id', 'resource_id'];

function request(input: unknown, domain: 'payroll' | 'personal_tax'): SensitiveRequest {
  if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(input).length !== fields.length || Object.keys(descriptors).sort().join('|') !== fields.join('|') ||
      Object.values(descriptors).some(d => !('value' in d))) invalid();
  const value = input as SensitiveRequest;
  if (!uuid(value.company_id) || !uuid(value.resource_company_id) || !uuid(value.resource_id) ||
      typeof value.actor_id !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(value.actor_id) ||
      !isSensitiveAction(value.action) || !value.action.startsWith(domain + '.')) invalid();
  if (value.resource_company_id.toLowerCase() !== value.company_id.toLowerCase()) denied();
  return { ...value, company_id: value.company_id.toLowerCase(), resource_company_id: value.resource_company_id.toLowerCase(), resource_id: value.resource_id.toLowerCase() };
}

export async function requireProtectedAudit(q: Queryable) {
  const r = (await q.query(`SELECT current_user actor,pg_get_userbyid(c.relowner) owner,c.relkind,
    has_table_privilege(current_user,c.oid,'SELECT') can_read,
    has_table_privilege(current_user,c.oid,'INSERT') can_insert,
    has_table_privilege(current_user,c.oid,'UPDATE,DELETE,TRUNCATE') can_mutate,
    has_any_column_privilege(current_user,c.oid,'UPDATE') can_update_column
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='accounting_audit_events'`)).rows;
  if (r.length !== 1 || r[0].actor !== 'ledgerly_api' || r[0].owner !== 'ledgerly_canonical_owner' ||
      r[0].relkind !== 'r' || !r[0].can_read || !r[0].can_insert || r[0].can_mutate || r[0].can_update_column) unavailable();
  const t = (await q.query(`SELECT t.tgenabled,t.tgtype,t.tgqual IS NULL unconditional,octet_length(t.tgargs) args,
    p.proname,pg_get_userbyid(p.proowner) owner,p.prosrc
    FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
    WHERE t.tgrelid='public.accounting_audit_events'::regclass AND t.tgname='ledgerly_accounting_audit_events_guard'`)).rows;
  if (t.length !== 1 || t[0].tgenabled !== 'A' || t[0].tgtype !== 27 || !t[0].unconditional || t[0].args !== 0 ||
      t[0].proname !== 'ledgerly_canonical_append_only_guard' || t[0].owner !== 'ledgerly_canonical_owner' ||
      t[0].prosrc.replace(/\s/g, '') !== "BEGINRAISEEXCEPTIONUSINGERRCODE='P0001',MESSAGE='canonicalaccountingevidenceisappend-only';END;") unavailable();
}

/** Internal server composition boundary. Operation is trusted code, never request data.
 * It must use only the supplied transaction and scoped IDs, perform no network/streaming side effects,
 * and return its result for release after audit + commit. Native record ownership checks remain mandatory. */
export async function runSensitiveOperation<T>(domain: 'payroll' | 'personal_tax', input: unknown,
  operation: (context: SensitiveContext) => Promise<T>): Promise<T> {
  const r = request(input, domain);
  if (typeof operation !== 'function') invalid();
  try {
    return await transact(async q => {
      // Same lock order as native membership changes: a queued operation observes revocation/demotion.
      const company = await q.query('SELECT id FROM public.companies WHERE id=$1 FOR UPDATE', [r.company_id]);
      if (company.rowCount !== 1) denied();
      const membership = await q.query('SELECT role,is_active FROM public.company_users WHERE company_id=$1 AND user_id=$2 ORDER BY id FOR UPDATE', [r.company_id, r.actor_id]);
      if (membership.rowCount !== 1 || !canAccessSensitiveData(membership.rows[0].role, membership.rows[0].is_active, r.action)) denied();
      await requireProtectedAudit(q);
      const role = membership.rows[0].role as CompanyRole;
      const result = await operation(Object.freeze({ companyId: r.company_id, actorId: r.actor_id,
        resourceId: r.resource_id, role, action: r.action, query: q.query.bind(q) }));
      // Never store salaries, identifiers, bank details, request bodies, exports or callback results.
      const auditId = randomUUID();
      const inserted = await q.query(`INSERT INTO public.accounting_audit_events
        (id,company_id,action,outcome,target_type,target_id,actor_type,actor_id,capability,context)
        VALUES($1,$2,'sensitive_access','allowed',$3,$4,'user',$5,$6,$7::jsonb) RETURNING id`,
      [auditId, r.company_id, domain + '_resource', r.resource_id, r.actor_id, r.action,
        JSON.stringify({ contract: 'sensitive-access.v1', role })]);
      if (inserted.rowCount !== 1 || inserted.rows[0]?.id !== auditId) unavailable();
      return result;
    });
  } catch (error) {
    if (error instanceof SensitiveAccessError) throw error;
    // Database/provider/callback diagnostics must not disclose private data or SQL.
    unavailable();
  }
}
