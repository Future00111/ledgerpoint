import test from 'node:test';
import assert from 'node:assert/strict';
import { companyFormValues, companyFormPayload, readCompanyReceipt } from './companyForm.mjs';
import { emptyTaxRule, selectTaxTreatment, taxRulePayload, vatSettingsValues, vatSettingsPayload } from './taxRuleInputs.mjs';
import { fixture, DATE } from './fixtures.mjs';

test('create and saved-record edit submit only actual company schema fields', () => {
  const fresh = companyFormPayload({ ...companyFormValues(), name: '  Business  ' });
  assert.equal(fresh.name, 'Business'); assert.equal(fresh.vat_return_frequency, 'quarterly'); assert.equal(fresh.vat_accounting_basis, 'invoice');
  const stored = { ...fresh, id: 'server-id', created_at: 'date', updated_at: 'date', invoice_next_number: 500,
    status: 'active', vat_frequency: 'wrong-field', name: 'Updated', vat_return_frequency: 'monthly', email: null, vat_number: null };
  const edited = companyFormPayload(companyFormValues(stored));
  assert.equal(edited.vat_return_frequency, 'monthly'); assert.equal(edited.email, null); assert.equal(edited.vat_number, null);
  for (const key of ['id', 'created_at', 'updated_at', 'invoice_next_number', 'status', 'vat_frequency']) assert.equal(Object.hasOwn(edited, key), false);
});

test('unknown and unsupported saved financial settings are never silently normalized', () => {
  const company = { ...fixture().sales.company, country: null, base_currency: 'USD', vat_registered: null, vat_scheme: 'flat_rate', vat_accounting_basis: null };
  const payload = companyFormPayload(companyFormValues(company));
  for (const key of ['country', 'base_currency', 'vat_registered', 'vat_scheme', 'vat_accounting_basis']) assert.equal(payload[key], company[key]);
});

test('company save requires a usable receipt and reports safe structured validation errors', async () => {
  assert.deepEqual(await readCompanyReceipt({ ok: true, json: async () => ({ id: 'confirmed' }) }), { id: 'confirmed' });
  await assert.rejects(readCompanyReceipt({ ok: false, json: async () => ({ error: { message: 'Invalid company fields' } }) }), /Invalid company fields/);
  await assert.rejects(readCompanyReceipt({ ok: true, json: async () => ({}) }), /could not be verified/);
  await assert.rejects(readCompanyReceipt({ ok: true, json: async () => { throw new Error('bad JSON'); } }), /Reload Companies/);
});

test('explicit supported tax choices retain exact treatment/rate pairs in native payloads', () => {
  assert.equal(emptyTaxRule().treatment, ''); assert.equal(emptyTaxRule().rate, ''); assert.equal(emptyTaxRule().effective_from, '');
  for (const [treatment, rate] of [['standard', '20'], ['reduced', '5'], ['zero', '0'], ['exempt', '0'], ['outside_scope', '0'], ['no_vat', '0']]) {
    const input = { ...selectTaxTreatment(emptyTaxRule(), treatment), code: ' reviewed ', label: 'Reviewed reason', effective_from: DATE };
    const payload = taxRulePayload(input, treatment !== 'no_vat');
    assert.deepEqual(payload, { code: 'REVIEWED', label: 'Reviewed reason', treatment, rate, effective_from: DATE, effective_to: null, is_recoverable: false });
  }
});

test('tax rules reject wrong registration, rate, calendar dates, missing reasons and overlaps', () => {
  const base = { ...selectTaxTreatment(emptyTaxRule(), 'no_vat'), code: 'NOVAT', label: 'Business not VAT registered', effective_from: DATE };
  for (const patch of [{ rate: '20' }, { label: ' ' }, { treatment: 'zero' }, { effective_from: '2026-02-30' }, { effective_to: '2026-10-29' }, { treatment: 'reverse_charge' }]) {
    assert.throws(() => taxRulePayload({ ...base, ...patch }, false));
  }
  assert.throws(() => taxRulePayload(base, true));
  assert.throws(() => taxRulePayload(base, false, [{ code: 'NOVAT', effective_from: '2026-01-01', effective_to: null }]), /overlapping/);
  assert.equal(taxRulePayload(base, false, [{ code: 'NOVAT', effective_from: '2025-01-01', effective_to: '2025-12-31' }]).treatment, 'no_vat');
});

test('new tax rule effective dates stay within the native document date range', () => {
  const base = { ...selectTaxTreatment(emptyTaxRule(), 'no_vat'), code: 'NOVAT', label: 'Business not VAT registered', effective_from: DATE };
  for (const date of ['1899-12-31', '2200-01-01']) {
    assert.throws(() => taxRulePayload({ ...base, effective_from: date }, false), /valid effective start date/);
    assert.throws(() => taxRulePayload({ ...base, effective_to: date }, false), /valid effective start date/);
  }
  const boundaries = taxRulePayload({ ...base, effective_from: '1900-01-01', effective_to: '2199-12-31' }, false);
  assert.equal(boundaries.effective_from, '1900-01-01'); assert.equal(boundaries.effective_to, '2199-12-31');
});

test('VAT settings preserve actual saved unsupported states and send only reviewed edits', () => {
  const company = fixture().sales.company;
  const form = vatSettingsValues(company);
  assert.deepEqual(vatSettingsPayload({ ...form, vat_number: 'GB123' }, company), { vat_number: 'GB123' });
  assert.throws(() => vatSettingsPayload(form, company), /no changes/);
  const unsupported = { ...company, vat_registered: true, vat_scheme: 'flat_rate', vat_accounting_basis: 'cash' };
  const actual = vatSettingsValues(unsupported);
  assert.equal(actual.vat_scheme, 'flat_rate'); assert.equal(actual.vat_accounting_basis, 'cash');
  assert.throws(() => vatSettingsPayload({ ...actual, vat_number: 'GB123' }, unsupported), /supported saved scheme/);
  const missing = { ...company, vat_registration_threshold: null, vat_return_due_days: null };
  assert.deepEqual(vatSettingsPayload({ ...vatSettingsValues(missing), vat_number: 'GB123' }, missing), { vat_number: 'GB123' });
  assert.throws(() => vatSettingsPayload({ ...form, vat_registration_threshold: '1e9' }, company), /threshold/);
});
