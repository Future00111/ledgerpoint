export const DATE = '2026-10-30';
export function fixture(registered = false, id = 'synthetic-company') {
  const roles = ['receivables', 'payables', 'revenue', 'expense', ...(registered ? ['output_vat', 'input_vat'] : [])];
  const base = { company: { id, name: 'Synthetic business', country: 'GB', base_currency: 'GBP', vat_registered: registered,
    vat_scheme: 'standard', vat_accounting_basis: 'invoice', vat_return_frequency: 'quarterly', vat_return_due_days: 37,
    vat_registration_threshold: '90000.00', vat_threshold_monitoring: true },
    capabilities: { edit_drafts: true, post_documents: true }, revision: 'synthetic-revision', business_accounting_basis: 'accrual',
    mappings: Object.fromEntries(roles.map(role => [role, 'account-' + role])),
    accounts: roles.map(role => ({ id: 'account-' + role, is_active: true, eligible_roles: [role] })),
    periods: [{ start_date: '2026-01-01', end_date: '2026-12-31', status: 'OPEN' }],
    tax_rules: [{ id: 'synthetic-tax-rule', code: registered ? 'STANDARD' : 'NO_VAT', label: registered ? 'Standard supply' : 'Business not VAT registered',
      rate: registered ? '20.00' : '0.00', treatment: registered ? 'standard' : 'no_vat', is_active: true, effective_from: '2026-01-01', effective_to: null }],
    configuration_errors: [], parties: [{ id: 'synthetic-party', status: 'active', name: 'Synthetic contact' }] };
  return { sales: structuredClone(base), purchases: structuredClone(base) };
}
