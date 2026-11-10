export const EMPTY_COMPANY_FORM = Object.freeze({ name: '', registration_number: '', vat_number: '', business_type: 'other',
  vat_registered: false, vat_scheme: 'standard', vat_return_frequency: 'quarterly', vat_accounting_basis: 'invoice',
  country: 'GB', base_currency: 'GBP', financial_year_end: '', address_line_1: '', address_line_2: '', city: '', county: '',
  postcode: '', phone: '', email: '' });

/** A server record is not a writable payload. Preserve actual saved settings without forwarding IDs or metadata. */
export function companyFormValues(company) {
  return Object.fromEntries(Object.entries(EMPTY_COMPANY_FORM).map(([key, fallback]) => [key, company && Object.hasOwn(company, key) ? company[key] : fallback]));
}
export function companyFormPayload(form) {
  return { ...companyFormValues(form), name: String(form.name ?? '').trim() };
}
export async function readCompanyReceipt(response) {
  let body;
  try { body = await response.json(); } catch { throw new Error('The company save response could not be verified. Reload Companies before trying again.'); }
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : body.error?.message || 'The company could not be saved.');
  if (typeof body?.id !== 'string' || !body.id) throw new Error('The saved company could not be verified. Reload Companies before trying again.');
  return body;
}
