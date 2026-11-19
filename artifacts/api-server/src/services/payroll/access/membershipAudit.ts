import { randomUUID } from 'node:crypto';
import type { Queryable } from '../../accountingDocuments/core';
import { isCompanyRole } from '../../../security/roles';
import { requireProtectedAudit, SensitiveAccessError } from './boundary';

interface Membership {
  id: string;
  company_id: string;
  role: string | null;
  is_active: boolean | null;
}
type MembershipOperation = 'member_add' | 'member_invite' | 'role_change' | 'member_remove' | 'company_delete';
interface MembershipChange { operation: MembershipOperation; before: Membership | null; after: Membership | null }
const specialized = (role: unknown) => isCompanyRole(role) &&
  (role.startsWith('payroll_') || role.startsWith('personal_tax_'));

/** Internal only. Caller must authorize against locked current memberships, perform
 * the mutation and pass its actual before/RETURNING rows in this same transaction.
 * Ordinary bookkeeping-only changes and same-role changes do not produce events. */
export async function auditSpecializedMembershipChange(q: Queryable, input: MembershipChange & {
  companyId: string;
  actorId: string;
}): Promise<void> {
  return auditSpecializedMembershipChanges(q, { ...input, changes: [input] });
}

/** Batch removal checks storage protection once and commits all events in the caller's transaction. */
export async function auditSpecializedMembershipChanges(q: Queryable, input: {
  companyId: string; actorId: string; changes: readonly MembershipChange[];
}): Promise<void> {
  const { actorId } = input, companyId = input.companyId.toLowerCase();
  const changes = input.changes.filter(({ before, after }) => specialized(before?.role) || specialized(after?.role));
  for (const { before, after } of changes) {
    const target = before ?? after;
    if (!target || [before, after].some(row => row &&
      (row.company_id.toLowerCase() !== companyId || row.id !== target.id || !isCompanyRole(row.role)))) {
      throw new SensitiveAccessError('SENSITIVE_OPERATION_UNAVAILABLE');
    }
  }
  const changed = changes.filter(({ before, after }) => !before || !after || before.role !== after.role || before.is_active !== after.is_active);
  if (!changed.length) return;
  try {
    await requireProtectedAudit(q);
    for (const { operation, before, after } of changed) {
      const target = (before ?? after)!;
      const auditId = randomUUID();
      const inserted = await q.query(`INSERT INTO public.accounting_audit_events
        (id,company_id,action,outcome,target_type,target_id,actor_type,actor_id,capability,context)
        VALUES($1,$2,'sensitive_membership_change','allowed','company_membership',$3,'user',$4,$5,$6::jsonb) RETURNING id`,
      [auditId, companyId, target.id, actorId, 'company.membership.change', JSON.stringify({
        contract: 'sensitive-membership.v1', operation,
        previous_role: before?.role ?? null, next_role: after?.role ?? null,
        previous_active: before?.is_active ?? null, next_active: after?.is_active ?? null,
      })]);
      // A BEFORE INSERT trigger can silently skip a row; a successful query is insufficient.
      if (inserted.rowCount !== 1 || inserted.rows[0]?.id !== auditId) throw new SensitiveAccessError('SENSITIVE_OPERATION_UNAVAILABLE');
    }
  } catch {
    throw new SensitiveAccessError('SENSITIVE_OPERATION_UNAVAILABLE');
  }
}
