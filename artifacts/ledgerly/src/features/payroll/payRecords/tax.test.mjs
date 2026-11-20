import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTaxIntent, taxPermissions, taxYear, validateTaxIntent, validateTaxRecord } from './taxModel.mjs';
import { createTaxPreparationsClient, TaxPreparationsError } from './taxClient.mjs';
const id = '12345678-1234-4234-8234-123456789abc';
const company = '12345678-1234-4234-8234-123456789abd';
const taxpayer = '00000000-0000-0000-0000-000000000001';
const body = { id, taxpayer_id: taxpayer, tax_year_start: 2026, employment_income_pence: '9007199254740993' };
const response = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

test('only owner and personal-tax preparer may prepare; submitter has lookup and other roles have neither', () => {
  for (const role of ['owner', 'personal_tax_preparer']) assert.deepEqual(taxPermissions(role), { read: true, prepare: true });
  assert.deepEqual(taxPermissions('personal_tax_submitter'), { read: true, prepare: false });
  for (const role of ['admin', 'accountant', 'staff', 'member', 'read_only', 'payroll_reader', 'payroll_preparer', 'payroll_approver', null, 'OWNER', {}, []])
    assert.deepEqual(taxPermissions(role), { read: false, prepare: false });
});
test('form builds an immutable exact GBP and integer-year intent without monetary rounding', () => {
  assert.deepEqual(buildTaxIntent(id.toUpperCase(), { taxpayer, year: '2026', income: '90071992547409.93' }), body);
  for (const [year, income, pence] of [['1', '0', '0'], ['9998', '92233720368547758.07', '9223372036854775807'], ['2026', '0.1', '10']]) {
    const value = buildTaxIntent(id, { taxpayer, year, income });
    assert.ok(Object.isFrozen(value)); assert.equal(value.tax_year_start, Number(year)); assert.equal(value.employment_income_pence, pence);
  }
});
test('tax form rejects partial/coerced years, malformed money, references and unexpected body authority', () => {
  for (const year of ['', '0', '-1', '9999', '10000', '02026', '2026.0', '2026.5', '2e3', '2026x', ' 2026', '2026 ', 2026, null])
    assert.throws(() => buildTaxIntent(id, { taxpayer, year, income: '1' }));
  for (const year of [0, 9999, -1, 2026.5, '2026', null, true, NaN, Infinity]) assert.throws(() => taxYear(year));
  for (const income of ['-1', '+1', '01', '1,000', '£10', '1.001', '1e3', '.50', '92233720368547758.08', ' 1', 10])
    assert.throws(() => buildTaxIntent(id, { taxpayer, year: '2026', income }));
  assert.throws(() => buildTaxIntent(id, { taxpayer: 'private@example.invalid', year: '2026', income: '1' }));
  assert.throws(() => buildTaxIntent('00000000-0000-0000-0000-000000000000', { taxpayer, year: '2026', income: '1' }));
  for (const value of [{ ...body, currency: 'GBP' }, { ...body, role: 'owner' }, { ...body, company_id: company }, { ...body, created_by_tax_command: true },
    { ...body, tax_year_start: '2026' }, { ...body, employment_income_pence: 1 }, { ...body, employment_income_pence: '01' }]) assert.throws(() => validateTaxIntent(value));
});
test('tax record projection validates exact keys and never accepts taxpayer reference for submitter', () => {
  const owner = { ...body, currency: 'GBP' }, { taxpayer_id: _, ...submitter } = owner;
  assert.deepEqual(validateTaxRecord(owner, id, 'owner'), owner); assert.deepEqual(validateTaxRecord(submitter, id, 'personal_tax_submitter'), submitter);
  assert.throws(() => validateTaxRecord(owner, id, 'personal_tax_submitter')); assert.throws(() => validateTaxRecord(submitter, id, 'personal_tax_preparer'));
  for (const value of [{ ...owner, id: company }, { ...owner, currency: 'USD' }, { ...owner, actor_id: 'private' }, { ...owner, tax_year_start: '2026' },
    { ...owner, employment_income_pence: 9007199254740992 }]) assert.throws(() => validateTaxRecord(value, id, 'owner'));
  assert.throws(() => validateTaxRecord(owner, id, 'payroll_preparer'));
});
test('native tax create/retry sends one identical company-scoped body with no cache and validates the receipt', async () => {
  const calls = [], signal = new AbortController().signal;
  const client = createTaxPreparationsClient(async (url, options) => { calls.push({ url, options }); return response({ id, status: calls.length === 1 ? 'created' : 'replayed' }, calls.length === 1 ? 201 : 200); });
  assert.deepEqual(await client.create(company.toUpperCase(), body, signal), { id, status: 'created' });
  assert.deepEqual(await client.create(company, body, signal), { id, status: 'replayed' });
  assert.deepEqual(calls[0], calls[1]); assert.equal(calls[0].url, `/api/companies/${company}/personal-tax-preparations`);
  assert.deepEqual(calls[0].options, { method: 'POST', signal, credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.throws(() => client.create(company, { ...body, role: 'owner' })); assert.equal(calls.length, 2);
});
test('native lookup is exact company/record scope and denies wrong roles or leaked submitter fields', async () => {
  let calls = 0; const { taxpayer_id: _, ...fields } = body; const record = { ...fields, currency: 'GBP' };
  const client = createTaxPreparationsClient(async (url, options) => {
    calls++; assert.equal(url, `/api/companies/${company}/personal-tax-preparations/${id}`);
    assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'include'); assert.equal(options.cache, 'no-store'); return response(record);
  });
  assert.deepEqual(await client.read(company, id.toUpperCase(), 'personal_tax_submitter'), record);
  await assert.rejects(client.read(company, id, 'payroll_reader'), error => error.status === 403); assert.equal(calls, 1);
  const leaking = createTaxPreparationsClient(async () => response({ ...record, taxpayer_id: taxpayer }));
  await assert.rejects(leaking.read(company, id, 'personal_tax_submitter'), error => error instanceof TaxPreparationsError && error.status === 0);
});
test('only verified native conflict is definitive; private diagnostics and malformed success stay unconfirmed', async () => {
  const definitive = createTaxPreparationsClient(async () => response({ code: 'SENSITIVE_REQUEST_CONFLICT', error: 'private diagnostic' }, 409));
  await assert.rejects(definitive.create(company, body), error => error.status === 409 && error.code === 'SENSITIVE_REQUEST_CONFLICT' && !error.message.includes('private'));
  for (const fetcher of [async () => { throw Error('private taxpayer/income'); }, async () => response({ error: 'private proxy' }, 409),
    async () => response({ code: 'PROXY_CONFLICT' }, 409), async () => response({ id, status: 'created' }, 200),
    async () => response({ id: company, status: 'created' }, 201), async () => response({ id, status: 'created', private: 'x' }, 201),
    async () => ({ ok: false, status: 409, json: async () => { throw Error('private HTML'); } })])
    await assert.rejects(createTaxPreparationsClient(fetcher).create(company, body), error => error.status === 0 && error.code === undefined && error.message === 'The tax input request could not be completed.');
  for (const status of [400, 401, 403, 503]) {
    const client = createTaxPreparationsClient(async () => ({ ok: false, status, json() { throw Error('private response must not be read'); } }));
    await assert.rejects(client.create(company, body), error => error.status === status && error.message === 'The tax input request could not be completed.');
  }
});
