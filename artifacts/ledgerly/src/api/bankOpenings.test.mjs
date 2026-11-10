import test from 'node:test';
import assert from 'node:assert/strict';
import { isAlreadyPosted, poundsToPence, buildIntent, createBankOpeningsClient, pendingStore, isUnknownOutcome, bankLedgerOptions, equityOptions } from './bankOpenings.mjs';

test('poundsToPence is strict and never rounds', () => {
  assert.equal(poundsToPence('1,234.5'), '123450');
  assert.equal(poundsToPence('1,234,567.89'), '123456789');
  assert.equal(poundsToPence('0.01'), '1');
  assert.equal(poundsToPence('9999999999.99'), '999999999999');
  for (const bad of ['', '0', '0.00', '-5', '1.234', 'abc', '1e3', '£5', '1,2', '12,34', '1,2345', ',123', '1,234,', '1,,234', '1234,567', '10000000000.00', '9999999999.991']) assert.equal(poundsToPence(bad), null, bad);
});
test('buildIntent requires every explicit choice', () => {
  assert.ok(buildIntent({ requestId: 'r', amount: '5', direction: 'debit' }).errors.some(e => /date/.test(e)));
  const { intent } = buildIntent({ requestId: 'r', bankAccountId: 'b', bankLedgerAccountId: 'g', balancingAccountId: 'e', effectiveDate: '2026-04-06', amount: '10.10', direction: 'credit' });
  assert.deepEqual(intent, { request_id: 'r', bank_account_id: 'b', bank_ledger_account_id: 'g', balancing_account_id: 'e', effective_date: '2026-04-06', amount_minor: '1010', direction: 'credit' });
});
test('account filters use exact fields, is_active===true and the configured bank GL only', () => {
  const a = [
    { id: 'g1', account_type: 'asset', is_active: true }, { id: 'g2', account_type: 'assets', is_active: true },
    { id: 'g3', account_type: 'asset', is_active: false }, { id: 'g4', account_type: 'asset' }, { id: 'g5', type: 'asset', is_active: true },
    { id: 'e1', account_type: 'equity', is_active: true }, { id: 'e2', account_type: 'equity', is_active: 'true' }, { id: 'e3', account_type: 'equity', status: 'active' },
    { id: 'i1', account_type: 'income', is_active: true },
  ];
  assert.deepEqual(bankLedgerOptions(a, 'g1').map(x => x.id), ['g1']);
  assert.deepEqual(bankLedgerOptions(a, 'g2').map(x => x.id), ['g2']);
  for (const id of ['g3', 'g4', 'g5', 'e1', null, undefined]) assert.deepEqual(bankLedgerOptions(a, id), [], String(id));
  assert.deepEqual(equityOptions(a).map(x => x.id), ['e1']);
});
test('already-posted conflict is recognised and is not an unknown outcome', () => {
  const e = Object.assign(new Error('x'), { status: 409, code: 'OPENING_ALREADY_POSTED' });
  assert.ok(isAlreadyPosted(e) && !isUnknownOutcome(e));
  assert.ok(!isAlreadyPosted({ status: 409, code: 'other' }));
});
test('pending write reports failure so posting can be blocked', () => {
  assert.equal(pendingStore({ setItem() { throw new Error('quota'); }, getItem: () => null }).write('c', 'b', { request_id: 'r' }), false);
  assert.equal(pendingStore({ setItem() {}, getItem: () => null }).write('c', 'b', { request_id: 'r' }), false);
  assert.equal(pendingStore(null).write('c', 'b', {}), false);
});
test('client posts intent with review token, includes credentials, maps errors', async () => {
  const calls = [];
  const c = createBankOpeningsClient(async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ data: { status: 'recorded' } }) }; });
  await c.post('co/1', { request_id: 'r' }, 'tok');
  assert.equal(calls[0].url, '/api/companies/co%2F1/opening-balances');
  assert.equal(calls[0].init.credentials, 'include');
  assert.deepEqual(JSON.parse(calls[0].init.body), { request_id: 'r', review_token: 'tok' });
  const bad = createBankOpeningsClient(async () => ({ ok: false, status: 409, json: async () => ({ error: { code: 'ALREADY', message: 'Already recorded' } }) }));
  await assert.rejects(bad.get('c', 'b'), e => e.code === 'ALREADY' && e.status === 409 && !isUnknownOutcome(e));
  assert.ok(isUnknownOutcome(new TypeError('network')));
});
test('pending store is keyed per company and bank and holds only intent', () => {
  const m = new Map(); const s = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
  const p = pendingStore(s);
  assert.equal(p.write('c1', 'b1', { request_id: 'r' }), true);
  assert.equal(p.read('c2', 'b1'), null);
  assert.deepEqual(p.read('c1', 'b1'), { intent: { request_id: 'r' } });
  assert.ok(![...m.values()][0].includes('token'));
  p.clear('c1', 'b1'); assert.equal(p.read('c1', 'b1'), null);
});
