import { withPayrollAccess, SensitiveAccessError } from '../access/service';
import { requireReadOnlySensitiveStorage } from '../access/recordStorage';

/** The optional review projection is available only to current approval roles. */
export function readDraftRevision(companyId: string, actorId: string, revisionId: string, includeBreakdown = false) {
  return withPayrollAccess({company_id:companyId, resource_company_id:companyId, actor_id:actorId,
    action:'payroll.read', resource_id:revisionId}, async context => {
    if (includeBreakdown && context.role !== 'owner' && context.role !== 'payroll_approver')
      throw new SensitiveAccessError('SENSITIVE_ACCESS_DENIED');
    await requireReadOnlySensitiveStorage(context, 'pay_run_draft_revisions');
    const result = await context.query(
      `SELECT run_id, revision_id, revision_number, period_start::text, period_end::text, payday::text,
              currency, rules_version ${includeBreakdown ? ', review_breakdown' : ''} FROM public.pay_run_draft_revisions
        WHERE company_id=$1 AND revision_id=$2`, [context.companyId, context.resourceId]);
    if (result.rowCount !== 1) throw new SensitiveAccessError('SENSITIVE_ACCESS_DENIED');
    return result.rows[0];
  });
}
