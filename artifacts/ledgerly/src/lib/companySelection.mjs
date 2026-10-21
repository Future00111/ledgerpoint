const key = accountId => `ledgerly.selected-company:${encodeURIComponent(accountId)}`;

export function readCompanySelection(storage, accountId) {
  return storage.getItem(key(accountId));
}

export function rememberCompanySelection(storage, accountId, companyId) {
  if (companyId) storage.setItem(key(accountId), companyId);
  else storage.removeItem(key(accountId));
}

// Only fresh companies from the authenticated membership response may be used.
// A browser preference contains an ID, never a company object or a role grant.
export function restoreAuthorizedCompany(companies, preferredId) {
  return companies.find(company => company.id === preferredId) ?? companies[0] ?? null;
}

export function requireAuthorizedCompany(companies, companyId) {
  const company = companies.find(item => item.id === companyId);
  if (!company) throw new Error('This company is not available for your account. Reload the company list.');
  return company;
}
