/** Read-only setup hints. The native server still validates every document and posting. */
export const TAX_TREATMENTS = Object.freeze([
  { value: 'standard', label: 'Standard rated', rate: '20' },
  { value: 'reduced', label: 'Reduced rated', rate: '5' },
  { value: 'zero', label: 'Zero rated', rate: '0' },
  { value: 'exempt', label: 'Exempt', rate: '0' },
  { value: 'outside_scope', label: 'Outside the scope of VAT', rate: '0' },
  { value: 'no_vat', label: 'Not VAT registered', rate: '0' },
]);
export const MIN_ACCOUNTING_DATE = '1900-01-01';
export const MAX_ACCOUNTING_DATE = '2199-12-31';
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < MIN_ACCOUNTING_DATE || value > MAX_ACCOUNTING_DATE) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
export function supportedBusiness(company) {
  return company?.country === 'GB' && company.base_currency === 'GBP' && typeof company.vat_registered === 'boolean' &&
    (!company.vat_registered || company.vat_scheme === 'standard' && company.vat_accounting_basis === 'invoice');
}
export function validTreatment(rule, registered) {
  const treatment = TAX_TREATMENTS.find(item => item.value === rule?.treatment);
  const rate = String(rule?.rate ?? '');
  return Boolean(treatment && /^(0|[1-9]\d{0,2})(?:\.\d{1,2})?$/.test(rate) &&
    rate.replace(/\.0{1,2}$/, '') === treatment.rate && typeof rule.label === 'string' && rule.label.trim() &&
    (registered === false ? treatment.value === 'no_vat' : registered === true && treatment.value !== 'no_vat'));
}
export function availableTaxRules(rules, registered, date) {
  if (!validDate(date)) return [];
  const effective = rules.filter(rule => rule.is_active === true && validDate(rule.effective_from) && rule.effective_from <= date &&
    (!rule.effective_to || validDate(rule.effective_to) && rule.effective_to >= date));
  return effective.filter(rule => typeof rule.code === 'string' && rule.code.trim() === rule.code && rule.code.toUpperCase() === rule.code && rule.code.length > 0 &&
    rule.code.length <= 64 && validTreatment(rule, registered) && effective.filter(other => other.code === rule.code).length === 1);
}
const requiredRoles = registered => ['receivables', 'payables', 'revenue', 'expense', ...(registered ? ['output_vat', 'input_vat'] : [])];
function checkContext(context, companyId) {
  if (context?.company?.id !== companyId || !context.capabilities ||
      !['parties', 'tax_rules', 'accounts', 'periods', 'configuration_errors'].every(key => Array.isArray(context[key]))) {
    throw new Error('Setup could not be verified for the selected company. Refresh to try again.');
  }
}
export function deriveReadiness(companyId, contexts, date) {
  const { sales, purchases } = contexts;
  checkContext(sales, companyId); checkContext(purchases, companyId);
  if (!validDate(date)) throw new Error('Choose a valid document date.');
  const both = [sales, purchases];
  const business = both.every(context => supportedBusiness(context.company));
  const chart = both.every(context => requiredRoles(context.company.vat_registered).every(role =>
    context.accounts.some(account => account.is_active === true && account.eligible_roles?.includes(role))));
  const mappings = both.every(context => {
    const roles = requiredRoles(context.company.vat_registered);
    const ids = roles.map(role => context.mappings?.[role]);
    return Boolean(context.revision) && context.business_accounting_basis === 'accrual' && new Set(ids).size === ids.length &&
      roles.every(role => context.accounts.some(account => account.id === context.mappings?.[role] &&
        account.is_active === true && account.eligible_roles?.includes(role)));
  });
  const period = both.every(context => {
    const covering = context.periods.filter(item => validDate(item.start_date) && validDate(item.end_date) && item.start_date <= date && item.end_date >= date);
    return covering.length === 1 && covering[0].status === 'OPEN';
  });
  const tax = both.every(context => availableTaxRules(context.tax_rules, context.company.vat_registered, date).length > 0);
  const serverIssues = [...new Set(both.flatMap(context => context.configuration_errors))];
  const unexpectedIssues = serverIssues.filter(issue => issue !== 'Create an open accounting period for the document date.');
  const draftSetupAvailable = business && chart && mappings && tax && unexpectedIssues.length === 0;
  const checks = [
    { id: 'business', title: 'Business & VAT profile', ready: business, to: '/companies', action: 'Review company',
      detail: business ? (sales.company.vat_registered ? 'UK · GBP · Standard scheme, invoice-basis VAT' : 'UK · GBP · Not VAT registered') : 'Review the saved country, currency and VAT settings. The current native workflow supports UK, GBP, Standard invoice-basis VAT or non-VAT businesses.',
      help: 'Your actual VAT position must be recorded. This review never registers you for VAT or changes your scheme.' },
    { id: 'chart', title: 'Chart of accounts', ready: chart, to: '/chart-of-accounts', action: 'Review accounts',
      detail: chart ? 'Eligible active accounts are available for the required posting roles.' : 'Add the customer balance, supplier balance, income and expense accounts needed by your business, plus VAT controls if registered.',
      help: 'These categories keep your sales, costs, customer balances and supplier balances organised. Existing users can keep their own chart.' },
    { id: 'mappings', title: 'Posting accounts', ready: mappings, to: '/accounting/setup', action: 'Open posting setup',
      detail: mappings ? 'Accrual accounting and distinct eligible default accounts are saved.' : 'Choose accrual accounting and map each posting role to a distinct eligible account.',
      help: 'Choose where each side of a document goes in your accounts. LedgerPoint does not guess these choices.' },
    { id: 'period', title: 'Accounting period', ready: period, to: '/accounting/setup', action: 'Review periods',
      detail: period ? `One open accounting period covers ${date}.` : `An open accounting period covering ${date} is required before posting.`,
      help: 'A period groups activity by date. The native posting review checks the date again before recording anything in the ledger.' },
    { id: 'tax', title: 'Date-effective tax rules', ready: tax, to: '/vat', action: 'Review tax rules',
      detail: tax ? `At least one supported, unambiguous tax code is available on ${date}. Check the treatment for each actual item.` : sales.company.vat_registered === false ? 'Add an explicit “Not VAT registered” tax rule with a 0 rate, descriptive label and effective date. Zero-rated sales are a different treatment.' : 'Add the explicit supported tax treatments needed for your sales and purchases, with a label and effective date.',
      help: 'In VAT preparation, expand Historical VAT returns and settings, then open VAT settings. Each tax rule must match your actual business activity; none is inferred here.' },
  ];
  const task = (context, kind) => ({
    canCreateDraft: draftSetupAvailable && context.capabilities.edit_drafts === true && context.parties.some(party => party.id && party.status === 'active'),
    canPost: context.capabilities.post_documents === true,
    postingSetupAvailable: draftSetupAvailable && period && serverIssues.length === 0,
    canEdit: context.capabilities.edit_drafts === true,
    partyCount: context.parties.filter(party => party.id && party.status === 'active').length,
    kind,
  });
  return { companyId, date, checks, serverIssues, draftSetupAvailable, configuredCount: checks.filter(check => check.ready).length,
    sales: task(sales, 'sales_invoice'), purchases: task(purchases, 'purchase_bill') };
}

/** A fresh read is the only progress record; a late response can never replace another company. */
export async function loadReadiness(client, companyId, signal, isCurrent = () => true) {
  const [sales, purchases] = await Promise.all([
    client.context(companyId, 'sales_invoice', signal), client.context(companyId, 'purchase_bill', signal),
  ]);
  if (signal.aborted || !isCurrent()) return null;
  checkContext(sales, companyId); checkContext(purchases, companyId);
  // The two reads can straddle a concurrent setup edit. Require another read rather than mixing revisions.
  const signature = context => JSON.stringify([context.company.country, context.company.base_currency, context.company.vat_registered,
    context.company.vat_scheme, context.company.vat_accounting_basis, context.revision, context.business_accounting_basis,
    context.mappings, context.tax_rules, context.periods]);
  if (signature(sales) !== signature(purchases)) throw new Error('Business setup changed during this check. Refresh to review the latest saved setup.');
  return { sales, purchases };
}

export async function resumeCreatedCompany(receipt, loadCompanies, switchCompany, navigate) {
  const companies = await loadCompanies();
  const confirmed = companies?.find(company => company.id === receipt?.id);
  if (!confirmed) throw new Error('Your company was saved, but access could not be refreshed. Reload Companies to continue setup.');
  switchCompany(confirmed);
  navigate('/setup');
}
