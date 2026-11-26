import { recordId, poundsToPence, salaryPence, validateReceipt } from './model.mjs';

export const TAX_READ_ROLES = Object.freeze(['owner', 'personal_tax_preparer', 'personal_tax_submitter']);
export function taxPermissions(role) {
  return { read: TAX_READ_ROLES.includes(role), prepare: role === 'owner' || role === 'personal_tax_preparer' };
}
function taxpayerId(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw Error('Enter the taxpayer reference as a UUID.');
  return value.toLowerCase();
}
export function taxYear(value) {
  if (!Number.isInteger(value) || value < 1 || value > 9998) throw Error('Enter a whole starting year from 1 to 9998.');
  return value;
}
export function buildTaxIntent(id, form) {
  if (typeof form.year !== 'string' || !/^[1-9][0-9]{0,3}$/.test(form.year)) throw Error('Enter a whole starting year, for example 2026.');
  let amount;
  try { amount = poundsToPence(form.income); }
  catch { throw Error('Enter a nonnegative GBP amount with up to two decimal places, without commas, within the supported range.'); }
  return Object.freeze({ id: recordId(id), taxpayer_id: taxpayerId(form.taxpayer), tax_year_start: taxYear(Number(form.year)), employment_income_pence: amount });
}
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
export function validateTaxIntent(value) {
  if (!exact(value, ['id', 'taxpayer_id', 'tax_year_start', 'employment_income_pence'])) throw Error('The tax input could not be verified.');
  return Object.freeze({ id: recordId(value.id), taxpayer_id: taxpayerId(value.taxpayer_id),
    tax_year_start: taxYear(value.tax_year_start), employment_income_pence: salaryPence(value.employment_income_pence) });
}
export function validateTaxRecord(value, id, role) {
  const permission = taxPermissions(role);
  const keys = ['id', 'tax_year_start', 'employment_income_pence', 'currency', ...(permission.prepare ? ['taxpayer_id'] : [])];
  if (!permission.read || !exact(value, keys) || value.id !== recordId(id) || value.currency !== 'GBP') throw Error('The tax input response could not be verified.');
  return { id: value.id, tax_year_start: taxYear(value.tax_year_start), employment_income_pence: salaryPence(value.employment_income_pence),
    currency: 'GBP', ...(permission.prepare ? { taxpayer_id: taxpayerId(value.taxpayer_id) } : {}) };
}
export const validateTaxReceipt = validateReceipt;
