import test from 'node:test';
import assert from 'node:assert/strict';
import { readCompanySelection, rememberCompanySelection, restoreAuthorizedCompany, requireAuthorizedCompany } from './companySelection.mjs';

const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
const companies = [{id:'standard',name:'Standard VAT'}, {id:'no-vat',name:'No VAT'}];

test('a full reload restores the selected authorized No VAT company, not the first company', () => {
  const browser = storage();
  const selected = requireAuthorizedCompany(companies, 'no-vat');
  rememberCompanySelection(browser, 'account-a', selected.id);
  const reloaded = restoreAuthorizedCompany(companies, readCompanySelection(browser, 'account-a'));
  assert.equal(reloaded.id, 'no-vat');
  assert.equal(reloaded, companies[1]);
});

test('preferences are account-specific and revoked or forged IDs cannot grant company access', () => {
  const browser = storage();
  rememberCompanySelection(browser, 'account-a', 'no-vat');
  assert.equal(readCompanySelection(browser, 'account-b'), null);
  assert.equal(restoreAuthorizedCompany([companies[0]], readCompanySelection(browser, 'account-a')).id, 'standard');
  assert.equal(restoreAuthorizedCompany(companies, 'foreign').id, 'standard');
  assert.equal(restoreAuthorizedCompany([], 'no-vat'), null);
  assert.throws(() => requireAuthorizedCompany(companies, 'foreign'), /not available/);
  rememberCompanySelection(browser, 'account-a', null);
  assert.equal(readCompanySelection(browser, 'account-a'), null);
});
