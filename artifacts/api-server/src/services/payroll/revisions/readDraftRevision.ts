import { withPayrollAccess, SensitiveAccessError } from '../access/service';
import { requireReadOnlySensitiveStorage } from '../access/recordStorage';

/** Internal metadata projection. A draft header conveys no calculation or approval status. */
export function readDraftRevision(companyId: string, actorId: string, revisionId: string) {
  return withPayrollAccess({company_id:companyId, resource_company_id:companyId, actor_id:actorId,
    action:'payroll.read', resource_id:revisionId}, async context => {
    await requireReadOnlySensitiveStorage(context, 'pay_run_draft_revisions');
    const result = await context.query(
      `SELECT run_id, revision_id, revision_number, period_start::text, period_end::text, payday::text,
              currency, rules_version FROM public.pay_run_draft_revisions
        WHERE company_id=$1 AND revision_id=$2`, [context.companyId, context.resourceId]);
    if (result.rowCount !== 1) throw new SensitiveAccessError('SENSITIVE_ACCESS_DENIED');
    return result.rows[0];
  });
}
