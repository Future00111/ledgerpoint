import test from 'node:test';
import assert from 'node:assert/strict';
import { createCreditRecoveryClient } from './creditRecovery.mjs';

function recorder(result = { can_manage: true, claims: [] }) {
  const requests = [];
  const client = createCreditRecoveryClient(async (url, init) => {
    requests.push({ url, init });
    return { ok: true, status: 200, json: async () => ({ data: result }) };
  });
  return { client, requests };
}

test('list scopes and encodes company and optional bill, preserves abort signal and session credentials', async () => {
  const { client, requests } = recorder();
  const controller = new AbortController();
  assert.deepEqual(await client.list('co/one', 'bill ?1', controller.signal), { can_manage: true, claims: [] });
  assert.equal(requests[0].url, '/api/companies/co%2Fone/credit-claims?bill_id=bill%20%3F1');
  assert.equal(requests[0].init.credentials, 'include');
  assert.equal(requests[0].init.signal, controller.signal);
  await client.list('co');
  assert.equal(requests[1].url, '/api/companies/co/credit-claims');
});

test('create sends exact quantities, bill revision and request identity without posting fields', async () => {
  const { client, requests } = recorder({ ids: ['claim'] });
  const body = { request_id: 'request-1', bill_id: 'bill-1', bill_revision: 7, reason: 'Return',
    return_reference: 'R123', returned_on: null, expected_by: '2026-11-03',
    lines: [{ original_line_ref: 2, quantity: '0.000001', part_reference: 'PART-2', job_reference: 'SYNTHETIC' }] };
  assert.deepEqual(await client.create('co', body), { ids: ['claim'] });
  assert.equal(requests[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].init.body), body);
  assert.equal(requests[0].init.headers['Content-Type'], 'application/json');
  assert.ok(!requests[0].url.includes('/post'));
});

test('receipt confirmation and cancellation send quoted UUID revision and stable caller request identity', async () => {
  const { client, requests } = recorder({ claim_id: 'claim/1', revision: 4 });
  const receipt = { request_id: 'same-id', credit_id: 'credit1', credit_revision: 5, credit_line_ref: 0 };
  const revision = '12345678-1234-4234-9234-123456789abc';
  await client.receive('co', 'claim/1', receipt, revision);
  assert.equal(requests[0].url, '/api/companies/co/credit-claims/claim%2F1/receipts');
  assert.equal(requests[0].init.headers['If-Match'], `"${revision}"`);
  assert.deepEqual(JSON.parse(requests[0].init.body), receipt);
  await client.cancel('co', 'claim/1', { request_id: 'cancel-id' }, revision);
  assert.equal(requests[1].url, '/api/companies/co/credit-claims/claim%2F1/cancel');
  assert.equal(requests[1].init.headers['If-Match'], `"${revision}"`);
});

test('permission and stale revision failures keep server code, status and issues', async () => {
  for (const [status, code] of [[403, 'FORBIDDEN'], [409, 'REVISION_CONFLICT']]) {
    const issues = [{ path: '/lines/0/quantity', message: 'Quantity exceeds the bill.' }];
    const client = createCreditRecoveryClient(async () => ({ ok: false, status,
      json: async () => ({ error: { code, message: 'Cannot save.', issues } }) }));
    await assert.rejects(client.create('co', {}), error => error.status === status && error.code === code && error.issues[0].path === issues[0].path);
  }
});

test('malformed success and unavailable network are not treated as a saved claim', async () => {
  const malformed = createCreditRecoveryClient(async () => ({ ok: true, status: 200, json: async () => ({}) }));
  await assert.rejects(malformed.create('co', {}), /could not be verified/);
  const offline = createCreditRecoveryClient(async () => { throw new TypeError('Network unavailable'); });
  await assert.rejects(offline.create('co', {}), /Network unavailable/);
});
