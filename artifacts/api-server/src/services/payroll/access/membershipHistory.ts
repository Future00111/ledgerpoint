import { randomUUID } from 'node:crypto';
import { transact } from '../../accountingDocuments/core';
import { isCompanyRole, type CompanyRole } from '../../../security/roles';
import { requireProtectedAudit, SensitiveAccessError } from './boundary';

const limit = 50;
const operations = Object.freeze(['member_add', 'member_invite', 'role_change', 'member_remove', 'company_delete'] as const);
type Operation = typeof operations[number];
interface HistoryEvent {
  id: string;
  occurred_at: string;
  membership_id: string;
  operation: Operation;
  previous_role: CompanyRole | null;
  next_role: CompanyRole | null;
  previous_active: boolean | null;
  next_active: boolean | null;
}
const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const nullableRole = (value: unknown): value is CompanyRole | null => value === null || isCompanyRole(value);
const nullableBoolean = (value: unknown): value is boolean | null => value === null || typeof value === 'boolean';
const specialized = (value: unknown) => isCompanyRole(value) && (value.startsWith('payroll_') || value.startsWith('personal_tax_'));
function unavailable(): never { throw new SensitiveAccessError('SENSITIVE_OPERATION_UNAVAILABLE'); }

function project(row: Record<string, unknown>): HistoryEvent {
  if (!uuid(row.id) || !uuid(row.membership_id) || row.complete_context !== true || row.contract !== 'sensitive-membership.v1' ||
      typeof row.occurred_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(row.occurred_at) ||
      typeof row.operation !== 'string' || !(operations as readonly string[]).includes(row.operation) ||
      !nullableRole(row.previous_role) || !nullableRole(row.next_role) ||
      (!specialized(row.previous_role) && !specialized(row.next_role)) ||
      !nullableBoolean(row.previous_active) || !nullableBoolean(row.next_active)) unavailable();
  if (row.operation === 'member_add' || row.operation === 'member_invite') {
    if (row.previous_role !== null || row.previous_active !== null || !specialized(row.next_role)) unavailable();
  } else if (row.operation === 'member_remove' || row.operation === 'company_delete') {
    if (!specialized(row.previous_role) || row.next_role !== null || row.next_active !== null) unavailable();
  } else if (row.previous_role === null || row.next_role === null ||
      (row.previous_role === row.next_role && row.previous_active === row.next_active)) unavailable();
  // Reconstruct the response explicitly. Never spread a stored audit row/context.
  return { id: row.id, occurred_at: row.occurred_at, membership_id: row.membership_id,
    operation: row.operation as Operation, previous_role: row.previous_role, next_role: row.next_role,
    previous_active: row.previous_active, next_active: row.next_active };
}

/** Internal server call: actorId must come from authentication; companyId from the route.
 * No filters, role overrides, pagination, target identity lookup or arbitrary context projection. */
export async function readSpecialistAccessHistory(companyId: string, actorId: string): Promise<{
  events: HistoryEvent[]; limit: number; has_more: boolean;
}> {
  if (!uuid(companyId) || typeof actorId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(actorId)) {
    throw new SensitiveAccessError('SENSITIVE_REQUEST_INVALID');
  }
  const company = companyId.toLowerCase();
  try {
    return await transact(async q => {
      const locked = await q.query('SELECT id FROM public.companies WHERE id=$1 FOR UPDATE', [company]);
      if (locked.rowCount !== 1) throw new SensitiveAccessError('SENSITIVE_ACCESS_DENIED');
      const members = await q.query('SELECT role,is_active FROM public.company_users WHERE company_id=$1 AND user_id=$2 ORDER BY id FOR UPDATE', [company, actorId]);
      if (members.rowCount !== 1 || members.rows[0]?.role !== 'owner' || members.rows[0]?.is_active !== true) {
        throw new SensitiveAccessError('SENSITIVE_ACCESS_DENIED');
      }
      await requireProtectedAudit(q);
      const rows = (await q.query(`SELECT id,target_id membership_id,
        to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') occurred_at,
        context ?& ARRAY['contract','operation','previous_role','next_role','previous_active','next_active'] complete_context,
        context->'contract' contract,context->'operation' operation,
        context->'previous_role' previous_role,context->'next_role' next_role,
        context->'previous_active' previous_active,context->'next_active' next_active
        FROM public.accounting_audit_events
        WHERE company_id=$1 AND action='sensitive_membership_change' AND outcome='allowed'
          AND target_type='company_membership' AND actor_type='user' AND capability='company.membership.change'
        ORDER BY created_at DESC,id DESC LIMIT $2`, [company, limit + 1])).rows;
      const result = { events: rows.slice(0, limit).map(project), limit, has_more: rows.length > limit };
      const auditId = randomUUID();
      const inserted = await q.query(`INSERT INTO public.accounting_audit_events
        (id,company_id,action,outcome,target_type,target_id,actor_type,actor_id,capability,context)
        VALUES($1,$2,'sensitive_membership_history_read','allowed','company_membership_history',$2::text,'user',$3,
          'company.membership.history.read',$4::jsonb) RETURNING id`,
      [auditId, company, actorId, JSON.stringify({ contract: 'sensitive-membership-history.v1', limit,
        returned_count: result.events.length, has_more: result.has_more })]);
      if (inserted.rowCount !== 1 || inserted.rows[0]?.id !== auditId) unavailable();
      return result;
    });
  } catch (error) {
    if (error instanceof SensitiveAccessError) throw error;
    unavailable();
  }
}
