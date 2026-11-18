import test from 'node:test';
import assert from 'node:assert/strict';
import { createPayRecordsClient, PayRecordsError } from './client.mjs';
const company = '12345678-1234-4234-8234-123456789abc';
const id = '12345678-1234-4234-8234-123456789abd';
const body = Object.freeze({ id, employee_id: '00000000-0000-0000-0000-000000000000', effective_from: '2026-04-06', annual_salary_pence: '9007199254740993' });
const response = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

test('creation and identical retry send the exact company/body with credentials, no-store and stable record ID', async () => {
  const requests = [], signal = new AbortController().signal;
  const client = createPayRecordsClient(async (url, options) => { requests.push({ url, options }); return response({ id, status: requests.length === 1 ? 'created' : 'replayed' }, requests.length === 1 ? 201 : 200); });
  assert.equal((await client.create(company.toUpperCase(), body, signal)).status, 'created');
  assert.equal((await client.create(company, body, signal)).status, 'replayed');
  assert.equal(requests[0].url, `/api/companies/${company}/payroll-pay-records`);
  assert.deepEqual(requests[0], requests[1]);
  assert.deepEqual(requests[0].options, { method: 'POST', signal, credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.throws(() => client.create(company, { ...body, role: 'owner' }));
});
test('lookup is exact-company/id scoped and payroll readers cannot receive employee reference', async () => {
  const { employee_id: _, ...readBody } = body; const record = { ...readBody, currency: 'GBP' }; let requests = 0;
  const client = createPayRecordsClient(async (url, options) => {
    requests++; assert.equal(url, `/api/companies/${company}/payroll-pay-records/${id}`);
    assert.equal(options.method, 'GET'); assert.equal(options.cache, 'no-store'); assert.equal(options.credentials, 'include');
    return response(record);
  });
  assert.deepEqual(await client.read(company, id.toUpperCase(), 'payroll_reader'), record);
  await assert.rejects(client.read(company, id, 'accountant'), error => error.status === 403); assert.equal(requests, 1);
  const leaking = createPayRecordsClient(async () => response({ ...record, employee_id: body.employee_id }));
  await assert.rejects(leaking.read(company, id, 'payroll_reader'), error => error instanceof PayRecordsError && error.status === 0);
});
test('private response and transport diagnostics never reach the error, and malformed success stays unconfirmed', async () => {
  for (const status of [400, 401, 403, 503]) {
    const client = createPayRecordsClient(async () => ({ ok: false, status, json() { throw Error('private diagnostic'); } }));
    await assert.rejects(client.create(company, body), error => error.status === status && error.message === 'The pay record request could not be completed.');
  }
  for (const fetcher of [async () => { throw Error('private salary/employee diagnostic'); }, async () => response({ id, status: 'created', salary: 'private' }, 201),
    async () => response({ id, status: 'created' }, 200), async () => response({ id: company, status: 'created' }, 201),
    async () => ({ ok: true, status: 201, json() { throw Error('private response'); } })]) {
    await assert.rejects(createPayRecordsClient(fetcher).create(company, body), error => error.status === 0 && error.message === 'The pay record request could not be completed.');
  }
});
test('only the fixed native conflict code permits a definitive conflict; unrelated proxy 409 remains uncertain', async () => {
  const conflict = createPayRecordsClient(async () => response({ code: 'SENSITIVE_REQUEST_CONFLICT', error: 'private diagnostic is never rendered' }, 409));
  await assert.rejects(conflict.create(company, body), error => error.status === 409 && error.code === 'SENSITIVE_REQUEST_CONFLICT' && !error.message.includes('private'));
  for (const value of [null, {}, { code: 'PROXY_CONFLICT' }, { error: 'private proxy error' }, { code: ['SENSITIVE_REQUEST_CONFLICT'] }]) {
    const client = createPayRecordsClient(async () => response(value, 409));
    await assert.rejects(client.create(company, body), error => error.status === 0 && error.code === undefined);
  }
  const malformed = createPayRecordsClient(async () => ({ ok: false, status: 409, json: async () => { throw Error('private HTML'); } }));
  await assert.rejects(malformed.create(company, body), error => error.status === 0 && error.code === undefined);
});
