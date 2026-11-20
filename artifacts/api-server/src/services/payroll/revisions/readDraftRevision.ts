import { withPayrollAccess, SensitiveAccessError } from '../access/service';
import { requireReadOnlySensitiveStorage } from '../access/recordStorage';

/** The optional review projection is available only to current approval roles. */
export function readDraftRevision(companyId: string, actorId: string, revisionId: string, includeBreakdown = false) {
  return withPayrollAccess({company_id:companyId, resource_company_id:companyId, actor_id:actorId,
    action:'payroll.read', resource_id:revisionId}, async context => {
    if (includeBreakdown && context.role !== 'owner' && context.role !== 'payroll_approver')
      throw new SensitiveAccessError('SENSITIVE_ACCESS_DENIED');
    await requireReadOnlySensitiveStorage(context, 'pay_run_draft_revisions');
    const reviewFields = includeBreakdown ? ', review_breakdown, head.current_revision_id, draft.revision_id = head.current_revision_id AS is_current_revision' : '';
    const headJoin = includeBreakdown ? `CROSS JOIN LATERAL (
      SELECT revision_id AS current_revision_id FROM public.pay_run_draft_revisions
      WHERE company_id = draft.company_id AND run_id = draft.run_id
      ORDER BY revision_number DESC LIMIT 1
    ) head` : '';
    const result = await context.query(
      `SELECT run_id, revision_id, revision_number, period_start::text, period_end::text, payday::text,
              currency, rules_version ${reviewFields} FROM public.pay_run_draft_revisions draft ${headJoin}
        WHERE company_id=$1 AND revision_id=$2`, [context.companyId, context.resourceId]);
    if (result.rowCount !== 1) throw new SensitiveAccessError('SENSITIVE_ACCESS_DENIED');
    return result.rows[0];
  });
}
