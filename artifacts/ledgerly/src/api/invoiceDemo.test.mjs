import test from 'node:test';
import assert from 'node:assert/strict';
import { openSyntheticInvoiceDemo } from './invoiceDemo.mjs';

const companyIds = {
  vatCompanyId: '11111111-1111-5111-8111-111111111111',
  noVatCompanyId: '22222222-2222-5222-8222-222222222222',
};

test('synthetic demo uses the guarded native POST, cookie authentication and no caller-supplied identity', async () => {
  const calls = [];
  const result = await openSyntheticInvoiceDemo(async (url, options) => {
    calls.push([url, options]);
    return new Response(JSON.stringify(companyIds), { status: 200 });
  });
  assert.deepEqual(result, companyIds);
  assert.equal(calls[0][0], '/api/dev/invoice-demo/bootstrap');
  assert.equal(calls[0][1].method, 'POST');
  assert.equal(calls[0][1].credentials, 'include');
  assert.equal(calls[0][1].body, undefined);
});

test('an HTML fallback becomes a helpful service message, not a JSON parser error', async () => {
  await assert.rejects(
    openSyntheticInvoiceDemo(async () => new Response('<!DOCTYPE html><html></html>', { status: 404 })),
    /isolated demo service is still starting/,
  );
});

test('authentication, network failures and conflicting sample data remain explicit', async () => {
  await assert.rejects(openSyntheticInvoiceDemo(async () => new Response('{"error":"Unauthorized"}', { status: 401 })), /Sign in/);
  await assert.rejects(openSyntheticInvoiceDemo(async () => { throw new TypeError('network'); }), /Could not reach/);
  await assert.rejects(openSyntheticInvoiceDemo(async () => new Response(
    '{"error":{"code":"DEMO_MEMBERSHIP_CONFLICT"}}', { status: 409 },
  )), /No existing records were overwritten/);
});

test('malformed successful responses cannot select an unverified company', async () => {
  await assert.rejects(openSyntheticInvoiceDemo(async () => new Response('{}', { status: 200 })), /incomplete response/);
});
