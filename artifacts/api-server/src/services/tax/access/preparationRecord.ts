import { withPersonalTaxAccess, SensitiveAccessError } from './service';
import { requireReadOnlySensitiveStorage } from '../../payroll/access/recordStorage';

export interface PersonalTaxPreparation {
  id: string;
  tax_year_start: number;
  employment_income_pence: string;
  currency: 'GBP';
  taxpayer_id?: string;
}
const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** One persisted raw draft input, not a qualified tax calculation, return or filing authority. */
export async function readPersonalTaxPreparation(companyId: string, actorId: string, recordId: string): Promise<PersonalTaxPreparation> {
  return withPersonalTaxAccess({ company_id: companyId, actor_id: actorId, resource_company_id: companyId,
    resource_id: recordId, action: 'personal_tax.read' }, async context => {
    await requireReadOnlySensitiveStorage(context, 'personal_tax_preparations');
    const includeTaxpayer = context.role === 'owner' || context.role === 'personal_tax_preparer';
    const found = await context.query(`SELECT id,tax_year_start,employment_income_pence::text employment_income_pence${includeTaxpayer ? ',taxpayer_id' : ''}
      FROM public.personal_tax_preparations WHERE company_id=$1 AND id=$2`, [context.companyId, context.resourceId]);
    if (found.rowCount !== 1) throw new SensitiveAccessError('SENSITIVE_ACCESS_DENIED');
    const row = found.rows[0];
    if (row.id !== context.resourceId || !Number.isInteger(row.tax_year_start) || row.tax_year_start < 1 || row.tax_year_start > 9998 ||
        typeof row.employment_income_pence !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(row.employment_income_pence) ||
        BigInt(row.employment_income_pence) > 9223372036854775807n || (includeTaxpayer && !uuid(row.taxpayer_id))) {
      throw new SensitiveAccessError('SENSITIVE_OPERATION_UNAVAILABLE');
    }
    const result: PersonalTaxPreparation = { id: row.id, tax_year_start: row.tax_year_start,
      employment_income_pence: row.employment_income_pence, currency: 'GBP' };
    if (includeTaxpayer) result.taxpayer_id = row.taxpayer_id;
    return result;
  });
}
