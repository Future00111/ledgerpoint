import { withPersonalTaxAccess, SensitiveAccessError, type SensitiveContext } from './service';
import { requireReadOnlySensitiveStorage } from '../../payroll/access/recordStorage';
import { requireSensitiveCreationCommand } from '../../payroll/access/commandProtection';

export interface PersonalTaxPreparation {
  id: string;
  tax_year_start: number;
  employment_income_pence: string;
  currency: 'GBP';
  taxpayer_id?: string;
}
const uuid = (value: unknown): value is string => typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export interface PersonalTaxPreparationCreation {
  id: string;
  taxpayer_id: string;
  tax_year_start: number;
  employment_income_pence: string;
}
const creationFields = ['employment_income_pence', 'id', 'tax_year_start', 'taxpayer_id'];
function invalid(): never { throw new SensitiveAccessError('SENSITIVE_REQUEST_INVALID'); }
function unavailable(): never { throw new SensitiveAccessError('SENSITIVE_OPERATION_UNAVAILABLE'); }

/** Exact raw annual input. Storage bounds do not qualify a calculation or tax year. */
export function parsePersonalTaxPreparationCreation(input: unknown): PersonalTaxPreparationCreation {
  if (!input || typeof input !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (Reflect.ownKeys(input).length !== creationFields.length || Object.keys(descriptors).sort().join('|') !== creationFields.join('|') ||
      Object.values(descriptors).some(descriptor => !('value' in descriptor))) invalid();
  const body = input as PersonalTaxPreparationCreation;
  if (!uuid(body.id) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab]/i.test(body.id) || !uuid(body.taxpayer_id) ||
      !Number.isInteger(body.tax_year_start) || body.tax_year_start < 1 || body.tax_year_start > 9998 ||
      typeof body.employment_income_pence !== 'string' || !/^(0|[1-9][0-9]{0,18})$/.test(body.employment_income_pence) ||
      BigInt(body.employment_income_pence) > 9223372036854775807n) invalid();
  return { id: body.id.toLowerCase(), taxpayer_id: body.taxpayer_id.toLowerCase(),
    tax_year_start: body.tax_year_start, employment_income_pence: body.employment_income_pence };
}

/** Restricted command owns the creation receipt; the boundary audits every successful prepare call. */
export async function createPersonalTaxPreparation(companyId: string, actorId: string, input: unknown): Promise<{
  id: string; status: 'created' | 'replayed';
}> {
  const body = parsePersonalTaxPreparationCreation(input);
  return withPersonalTaxAccess({ company_id: companyId, actor_id: actorId, resource_company_id: companyId,
    resource_id: body.id, action: 'personal_tax.prepare' }, async context => {
    await requireReadOnlySensitiveStorage(context, 'personal_tax_preparations');
    await requireSensitiveCreationCommand(context, 'personal_tax');
    const result = await context.query(`SELECT public.ledgerly_create_personal_tax_preparation(
      $1::uuid,$2::text,$3::uuid,$4::uuid,$5::integer,$6::bigint) status`,
    [context.companyId, context.actorId, context.resourceId, body.taxpayer_id, body.tax_year_start, body.employment_income_pence]);
    if (result.rowCount !== 1) unavailable();
    const status = result.rows[0]?.status;
    if (status === 'denied') throw new SensitiveAccessError('SENSITIVE_ACCESS_DENIED');
    if (status === 'conflict') throw new SensitiveAccessError('SENSITIVE_REQUEST_CONFLICT');
    if (status !== 'created' && status !== 'replayed') unavailable();
    return { id: context.resourceId, status };
  });
}

/** One persisted raw draft input, not a qualified tax calculation, return or filing authority. */
export async function readPersonalTaxPreparation(companyId: string, actorId: string, recordId: string): Promise<PersonalTaxPreparation> {
  return withPersonalTaxAccess({ company_id: companyId, actor_id: actorId, resource_company_id: companyId,
    resource_id: recordId, action: 'personal_tax.read' }, async context => {
    return readPreparationFields(context, context.role === 'owner' || context.role === 'personal_tax_preparer');
  });
}

async function readPreparationFields(context: SensitiveContext, includeTaxpayer: boolean): Promise<PersonalTaxPreparation> {
  await requireReadOnlySensitiveStorage(context, 'personal_tax_preparations');
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
}

/** One fixed-schema CSV, released only after the export-specific audit commits. */
export async function exportPersonalTaxPreparation(companyId: string, actorId: string, recordId: string): Promise<string> {
  return withPersonalTaxAccess({ company_id: companyId, actor_id: actorId, resource_company_id: companyId,
    resource_id: recordId, action: 'personal_tax.export' }, async context => {
    const record = await readPreparationFields(context, false);
    return 'tax_year_start,employment_income_pence,currency\r\n' +
      `${record.tax_year_start},${record.employment_income_pence},GBP\r\n`;
  });
}
