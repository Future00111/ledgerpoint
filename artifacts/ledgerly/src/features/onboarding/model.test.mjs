import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveReadiness, loadReadiness, resumeCreatedCompany, availableTaxRules, validDate } from './model.mjs';
import { DATE, fixture } from './fixtures.mjs';
const review = data => deriveReadiness('synthetic-company', data, DATE);
const both = (data, edit) => { edit(data.sales); edit(data.purchases); return data; };

test('blank company resumes from fresh server configuration rather than visited steps', async () => {
  const empty = both(fixture(), context => { context.revision = null; context.business_accounting_basis = null; context.mappings = {}; context.accounts = []; context.periods = []; context.tax_rules = []; context.parties = []; context.configuration_errors = ['Choose accrual accounting and map the company accounts.']; });
  let saved = empty, reads = 0;
  const client = { context: async (_id, kind) => { reads++; return structuredClone(kind === 'sales_invoice' ? saved.sales : saved.purchases); } };
  const first = review(await loadReadiness(client, 'synthetic-company', new AbortController().signal));
  assert.equal(first.configuredCount, 1); assert.equal(first.sales.canCreateDraft, false);
  saved = fixture();
  const resumed = review(await loadReadiness(client, 'synthetic-company', new AbortController().signal));
  assert.equal(reads, 4); assert.equal(resumed.configuredCount, 5); assert.equal(resumed.sales.canCreateDraft, true); assert.equal(resumed.purchases.canCreateDraft, true);
});

test('an existing customer does not mask missing mappings, tax rules or unsupported business', () => {
  for (const edit of [c => c.mappings = {}, c => c.tax_rules = [], c => c.company.vat_registered = null,
    c => c.company.base_currency = 'USD', c => c.company.country = 'US', c => c.business_accounting_basis = 'cash',
    c => c.configuration_errors = ['Unknown future server requirement']]) {
    assert.equal(review(both(fixture(), edit)).sales.canCreateDraft, false);
  }
  for (const scheme of ['flat_rate', 'cash_accounting', null]) assert.equal(review(both(fixture(true), c => c.company.vat_scheme = scheme)).draftSetupAvailable, false);
});

test('current date must fall in one open period; draft permission stays separate from posting setup', () => {
  for (const periods of [[], [{ start_date: '2025-01-01', end_date: '2025-12-31', status: 'OPEN' }],
    [{ start_date: '2026-01-01', end_date: '2026-12-31', status: 'CLOSED' }],
    [{ start_date: '2026-01-01', end_date: '2026-12-31', status: 'OPEN' }, { start_date: DATE, end_date: DATE, status: 'CLOSED' }]]) {
    const state = review(both(fixture(), c => { c.periods = periods; }));
    assert.equal(state.checks.find(item => item.id === 'period').ready, false);
    assert.equal(state.sales.postingSetupAvailable, false); assert.equal(state.sales.canPost, true);
    assert.equal(state.sales.canCreateDraft, true);
  }
});

test('inactive, ineligible and repeated mappings fail readiness even if server errors are empty', () => {
  for (const edit of [c => c.accounts[0].is_active = false, c => c.accounts[0].eligible_roles = [], c => c.mappings.payables = c.mappings.receivables]) {
    assert.equal(review(both(fixture(), edit)).draftSetupAvailable, false);
  }
});

test('tax readiness needs valid effective unambiguous codes, rates, labels and non-VAT treatment', () => {
  const rule = fixture().sales.tax_rules[0];
  for (const patch of [{ is_active: false }, { effective_from: '2027-01-01' }, { effective_to: '2026-10-29' }, { effective_from: '2026-02-30' },
    { rate: '20' }, { label: ' ' }, { treatment: 'zero' }, { code: '' }, { code: 'lowercase' }]) {
    assert.equal(availableTaxRules([{ ...rule, ...patch }], false, DATE).length, 0);
  }
  assert.equal(availableTaxRules([rule, { ...rule, id: 'overlap' }], false, DATE).length, 0);
  assert.equal(availableTaxRules([{ ...rule, effective_from: DATE, effective_to: DATE }], false, DATE).length, 1);
  assert.equal(availableTaxRules([rule], true, DATE).length, 0);
  assert.equal(validDate('2026-02-30'), false);
});

test('readiness date checks match the native document range including its boundaries', () => {
  for (const date of ['1899-12-31', '2200-01-01']) {
    assert.equal(validDate(date), false);
    assert.throws(() => deriveReadiness('synthetic-company', fixture(), date), /valid document date/);
    assert.deepEqual(availableTaxRules(fixture().sales.tax_rules, false, date), []);
  }
  for (const date of ['1900-01-01', '2199-12-31']) assert.equal(validDate(date), true);
});

test('draft and posting permissions are independent server facts, and active parties are required', () => {
  const readonly = review(both(fixture(), c => c.capabilities = { edit_drafts: false, post_documents: false }));
  assert.equal(readonly.sales.canCreateDraft, false); assert.equal(readonly.sales.canPost, false);
  const preparer = review(both(fixture(), c => c.capabilities.post_documents = false));
  assert.equal(preparer.sales.canCreateDraft, true); assert.equal(preparer.sales.canPost, false);
  const missing = fixture(); missing.sales.parties = []; missing.purchases.parties[0].status = 'inactive';
  assert.equal(review(missing).sales.canCreateDraft, false); assert.equal(review(missing).purchases.canCreateDraft, false);
});

test('wrong-company, malformed and partial reads fail closed', async () => {
  const data = fixture();
  await assert.rejects(loadReadiness({ context: async () => ({ ...data.sales, company: { id: 'other' } }) }, 'synthetic-company', new AbortController().signal), /selected company/);
  await assert.rejects(loadReadiness({ context: async (_id, kind) => { if (kind === 'purchase_bill') throw new Error('Forbidden'); return data.sales; } }, 'synthetic-company', new AbortController().signal), /Forbidden/);
  assert.throws(() => review({ sales: data.sales, purchases: {} }), /selected company/);
});

test('late results after company switch, refresh or cancellation cannot restore readiness', async () => {
  const data = fixture(); let release;
  const gate = new Promise(resolve => release = resolve);
  const client = { context: async () => { await gate; return data.sales; } };
  const controller = new AbortController(); let current = true;
  const pending = loadReadiness(client, 'synthetic-company', controller.signal, () => current);
  current = false; release(); assert.equal(await pending, null);
  controller.abort(); assert.equal(await loadReadiness(client, 'synthetic-company', controller.signal), null);
});

test('concurrent configuration revisions require another fresh read', async () => {
  const data = fixture(); data.purchases.revision = 'changed';
  await assert.rejects(loadReadiness({ context: async (_id, kind) => kind === 'sales_invoice' ? data.sales : data.purchases }, 'synthetic-company', new AbortController().signal), /changed during/);
});

test('created-company entry uses only the freshly authorized record and switches before navigation', async () => {
  const events = [], confirmed = { id: 'saved', name: 'Server company' };
  await resumeCreatedCompany({ id: 'saved', name: 'Untrusted receipt name' }, async () => [confirmed], company => events.push(company), path => events.push(path));
  assert.deepEqual(events, [confirmed, '/setup']);
  for (const companies of [null, [], [{ id: 'different' }]]) await assert.rejects(resumeCreatedCompany({ id: 'saved' }, async () => companies, () => assert.fail('Must not select'), () => assert.fail('Must not navigate')), /access could not be refreshed/);
  await assert.rejects(resumeCreatedCompany({ id: 'saved' }, async () => [confirmed], () => { throw new Error('Membership revoked'); }, () => assert.fail('Must not navigate')), /Membership revoked/);
});
