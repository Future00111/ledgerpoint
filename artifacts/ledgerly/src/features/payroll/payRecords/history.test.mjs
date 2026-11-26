import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAccessHistory, historyActiveLabel, historyRoleLabel, historyOperationLabel, historyTimeLabel } from './historyModel.mjs';
import { createAccessHistoryClient, AccessHistoryError } from './historyClient.mjs';

const id = value => `12345678-1234-4234-8234-${String(value).padStart(12, '0')}`;
const event = (value = 1, extra = {}) => ({ id: id(value), membership_id: id(100), occurred_at: '2026-11-18T16:20:30.123456Z',
  operation: 'member_add', previous_role: null, next_role: 'payroll_reader', previous_active: null, next_active: true, ...extra });
const envelope = (events = [], has_more = false) => ({ events, limit: 50, has_more });
const response = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

test('history preserves absent membership and unknown historical active flags as different facts', () => {
  for (const active of [true, false, null]) {
    const add = event(1, { next_active: active });
    assert.deepEqual(validateAccessHistory(envelope([add])), envelope([add]));
    const removal = event(1, { operation: 'member_remove', previous_role: 'payroll_reader', previous_active: active, next_role: null, next_active: null });
    assert.deepEqual(validateAccessHistory(envelope([removal])), envelope([removal]));
  }
  assert.equal(historyActiveLabel(null, null), 'Not present');
  assert.equal(historyActiveLabel('payroll_reader', null), 'Not recorded');
  assert.equal(historyActiveLabel('payroll_reader', false), 'Inactive');
  assert.equal(historyActiveLabel('payroll_reader', true), 'Active');
});
test('known operations permit only meaningful specialized transitions and never arbitrary role data', () => {
  for (const operation of ['member_add', 'member_invite']) assert.doesNotThrow(() => validateAccessHistory(envelope([event(1, { operation })])));
  for (const operation of ['member_remove', 'company_delete']) assert.doesNotThrow(() => validateAccessHistory(envelope([event(1, { operation, previous_role: 'personal_tax_preparer', previous_active: null, next_role: null, next_active: null })])));
  assert.doesNotThrow(() => validateAccessHistory(envelope([event(1, { operation: 'role_change', previous_role: 'accountant', previous_active: true, next_role: 'payroll_preparer' })])));
  assert.doesNotThrow(() => validateAccessHistory(envelope([event(1, { operation: 'role_change', previous_role: 'payroll_reader', previous_active: false })])));
  for (const extra of [{ operation: 'private-operation' }, { next_role: 'private-role' }, { next_role: 'constructor' }, { next_role: 'accountant' },
    { previous_role: 'owner' }, { previous_active: false }, { next_active: 'private-active' },
    { operation: 'member_remove' }, { operation: 'role_change' }, { operation: 'role_change', previous_role: 'payroll_reader', previous_active: true }])
    assert.throws(() => validateAccessHistory(envelope([event(1, extra)])));
  assert.equal(historyRoleLabel('payroll_reader'), 'Payroll reader'); assert.equal(historyRoleLabel('personal_tax_preparer'), 'Personal tax preparer');
  assert.equal(historyRoleLabel('private-role'), 'Unknown role'); assert.equal(historyOperationLabel('private-operation'), 'Unknown change');
});
test('strict history projection rejects extra/missing keys, raw identities and malformed references', () => {
  for (const value of [null, [], { ...envelope(), actor_id: 'private-actor' }, { events: [], limit: 50 },
    envelope([event(1, { actor_id: 'private-actor' })]), envelope([event(1, { context: { salary: 'private' } })]),
    envelope([event(1, { id: '00000000-0000-0000-0000-000000000000' })]), envelope([event(1, { membership_id: 'private-user' })])])
    assert.throws(() => validateAccessHistory(value));
  for (const key of Object.keys(event())) { const malformed = event(); delete malformed[key]; assert.throws(() => validateAccessHistory(envelope([malformed]))); }
});
test('history validates native UTC microseconds and renders UK date/time with explicit zone', () => {
  assert.equal(historyTimeLabel('2026-11-18T16:20:30.123456Z'), '18 Nov 2026, 16:20:30 UTC');
  assert.equal(historyTimeLabel('0001-01-01T00:00:00.000000Z'), '1 Jan 0001, 00:00:00 UTC');
  for (const time of ['2026-02-29T16:20:30.123456Z', '2026-11-18T24:20:30.123456Z', '2026-11-18T16:60:30.123456Z',
    '2026-11-18T16:20:60.123456Z', '2026-11-18T16:20:30Z', '2026-11-18T16:20:30.123Z', '2026-11-18T16:20:30.123456+00:00', 'private-time'])
    assert.throws(() => validateAccessHistory(envelope([event(1, { occurred_at: time })])));
});
test('bounded newest-first history rejects duplicate IDs, out-of-order microseconds, oversized pages and inconsistent more flags', () => {
  const rows = Array.from({ length: 50 }, (_, index) => event(50 - index));
  assert.deepEqual(validateAccessHistory(envelope(rows, true)), envelope(rows, true));
  assert.deepEqual(validateAccessHistory(envelope()), envelope());
  assert.doesNotThrow(() => validateAccessHistory(envelope([event(1, { occurred_at: '2026-11-18T16:20:30.123457Z' }), event(2)])));
  for (const value of [envelope([...rows, event(51)]), envelope([], true), envelope([event()], true), { ...envelope(), limit: 51 }, { ...envelope(), has_more: 'yes' },
    envelope([event(), event()]), envelope([event(1), event(2)]), envelope([event(2), event(1, { occurred_at: '2026-11-18T16:20:30.123457Z' })])])
    assert.throws(() => validateAccessHistory(value));
});
test('history client performs only explicit credentialed company-scoped no-store GET with abort signal and no query overrides', async () => {
  const calls = [], signal = new AbortController().signal, data = envelope([event()]);
  const client = createAccessHistoryClient(async (url, options) => { calls.push({ url, options }); return response(data); });
  assert.deepEqual(calls, []);
  assert.deepEqual(await client.read(id(99).toUpperCase(), signal), data);
  assert.deepEqual(calls, [{ url: `/api/companies/${id(99)}/specialist-access-history`, options: { method: 'GET', credentials: 'include', cache: 'no-store', signal } }]);
  await assert.rejects(client.read('private-company'), error => error instanceof AccessHistoryError && error.status === 0); assert.equal(calls.length, 1);
});
test('history client redacts non-200, network and malformed-response errors without reading arbitrary failure bodies', async () => {
  for (const status of [400, 401, 403, 409, 503]) {
    const client = createAccessHistoryClient(async () => ({ ok: false, status, json() { throw Error('private diagnostics'); } }));
    await assert.rejects(client.read(id(99)), error => error.status === status && error.message === 'Access history could not be loaded.');
  }
  for (const fetcher of [async () => { throw Error('private diagnostics'); }, async () => response(envelope(), 201),
    async () => response(envelope([event(1, { actor_id: 'private-actor' })])),
    async () => ({ ok: true, status: 200, json() { throw Error('private response'); } })])
    await assert.rejects(createAccessHistoryClient(fetcher).read(id(99)), error => error instanceof AccessHistoryError && error.status === 0 && !error.message.includes('private'));
});
