import { withPayrollAccess, SensitiveAccessError } from '../access/service';
import { requireReadOnlySensitiveStorage } from '../access/recordStorage';

/** The optional review projection is available only to current approval roles. */
export function readDraftRevision(companyId: string, actorId: string, revisionId: string, review: boolean | "history" = false) {
  return withPayrollAccess({company_id:companyId, resource_company_id:companyId, actor_id:actorId,
    action:'payroll.read', resource_id:revisionId}, async context => {
    if (review && context.role !== 'owner' && context.role !== 'payroll_approver')
      throw new SensitiveAccessError('SENSITIVE_ACCESS_DENIED');
    await requireReadOnlySensitiveStorage(context, 'pay_run_draft_revisions');
    const reviewFields = review ? ', draft.prepared_by, draft.prepared_at, review_breakdown, head.current_revision_id, draft.revision_id = head.current_revision_id AS is_current_revision' : '';
    const historyFields = review === 'history' ? `,
      (SELECT adjacent.revision_id FROM public.pay_run_draft_revisions adjacent
       WHERE adjacent.company_id=draft.company_id AND adjacent.run_id=draft.run_id
         AND adjacent.revision_number=draft.revision_number::bigint-1) AS previous_revision_id,
      (SELECT adjacent.revision_id FROM public.pay_run_draft_revisions adjacent
       WHERE adjacent.company_id=draft.company_id AND adjacent.run_id=draft.run_id
         AND adjacent.revision_number=draft.revision_number::bigint+1) AS next_revision_id` : '';
    const headJoin = review ? `CROSS JOIN LATERAL (
      SELECT revision_id AS current_revision_id FROM public.pay_run_draft_revisions
      WHERE company_id = draft.company_id AND run_id = draft.run_id
      ORDER BY revision_number DESC LIMIT 1
    ) head` : '';
    const result = await context.query(
      `SELECT run_id, revision_id, revision_number, period_start::text, period_end::text, payday::text,
              currency, rules_version ${reviewFields} ${historyFields} FROM public.pay_run_draft_revisions draft ${headJoin}
        WHERE company_id=$1 AND revision_id=$2`, [context.companyId, context.resourceId]);
    if (result.rowCount !== 1) throw new SensitiveAccessError('SENSITIVE_ACCESS_DENIED');
    return result.rows[0];
  });
}
