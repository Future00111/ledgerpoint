import { TAX_TREATMENTS, validDate, validTreatment, supportedBusiness } from './model.mjs';

export const emptyTaxRule = () => ({ code: '', label: '', rate: '', treatment: '', effective_from: '', effective_to: '', is_recoverable: false });
/** Choosing a labelled treatment/rate pair is explicit input, not a company default. */
export function selectTaxTreatment(rule, value) {
  const choice = TAX_TREATMENTS.find(item => item.value === value);
  return { ...rule, treatment: choice?.value ?? '', rate: choice?.rate ?? '', is_recoverable: false };
}
export function taxRulePayload(rule, registered, existing = []) {
  const code = String(rule.code ?? '').trim().toUpperCase(), label = String(rule.label ?? '').trim();
  if (!code || code.length > 64 || !label || !validTreatment({ ...rule, label }, registered)) {
    throw new Error('Choose a supported tax treatment for the saved VAT registration status, with a code and a descriptive label.');
  }
  if (!validDate(rule.effective_from) || rule.effective_to && (!validDate(rule.effective_to) || rule.effective_to < rule.effective_from)) {
    throw new Error('Choose a valid effective start date and, if needed, an end date on or after it.');
  }
  if (existing.some(item => item.code === code && item.is_active !== false && item.effective_from <= (rule.effective_to || '9999-12-31') &&
    (!item.effective_to || item.effective_to >= rule.effective_from))) {
    throw new Error('This code already has a rule covering these dates. Review the existing rule instead of creating an overlapping rule.');
  }
  return { code, label, treatment: rule.treatment, rate: rule.rate, effective_from: rule.effective_from,
    effective_to: rule.effective_to || null, is_recoverable: rule.is_recoverable === true };
}
export function vatSettingsValues(company) {
  return { vat_registered: company.vat_registered, vat_number: company.vat_number || '', vat_scheme: company.vat_scheme,
    vat_return_frequency: company.vat_return_frequency, vat_accounting_basis: company.vat_accounting_basis,
    vat_return_due_days: company.vat_return_due_days, vat_registration_threshold: company.vat_registration_threshold,
    vat_threshold_monitoring: company.vat_threshold_monitoring };
}
export function vatSettingsPayload(form, company) {
  const initial = vatSettingsValues(company);
  const changed = Object.fromEntries(Object.keys(initial).filter(key => form[key] !== initial[key]).map(key => [key, form[key]]));
  if (!Object.keys(changed).length) throw new Error('There are no changes to save.');
  if (!supportedBusiness({ ...company, ...changed })) throw new Error('The selected VAT status requires a supported saved scheme and accounting basis. Review the business profile first.');
  if ('vat_return_due_days' in changed) {
    if (!/^[1-9]\d{0,2}$/.test(String(changed.vat_return_due_days)) || Number(changed.vat_return_due_days) > 365) throw new Error('Return due days must be a whole number from 1 to 365.');
    changed.vat_return_due_days = Number(changed.vat_return_due_days);
  }
  if ('vat_registration_threshold' in changed) {
    if (!/^(0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(String(changed.vat_registration_threshold))) throw new Error('Enter a valid registration threshold with at most two decimal places.');
    changed.vat_registration_threshold = String(changed.vat_registration_threshold);
  }
  return changed;
}
