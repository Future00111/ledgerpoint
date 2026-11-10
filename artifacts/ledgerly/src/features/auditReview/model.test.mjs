import test from 'node:test';
import assert from 'node:assert/strict';
import { initialFilters, filtersError, validateAudit, resourcePath, guardedExport } from './model.mjs';
import { requestRead, visibleRead } from '../reporting/model.mjs';
import { createAuditClient } from '../../api/auditReview.mjs';

const filters = initialFilters(new Date('2026-10-30T12:00:00Z'));
const fixture = () => ({ company_id: 'company-a', filters, items: [], as_of: '2026-10-30T12:00:00.123456Z', next_cursor: null, coverage: {}, capabilities: { export: true } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('dates, search and scope validation fail closed', () => {
  assert.equal(filters.from, '2026-01-01'); assert.equal(filtersError(filters), '');
  for (const change of [{ from: '2026-02-29' }, { to: '2200-01-01' }, { to: '2025-12-31' }, { q: 'x'.repeat(101) }, { q: 'a\u202eb' }]) assert.ok(filtersError({ ...filters, ...change }));
  assert.equal(validateAudit(fixture(), 'company-a', filters).company_id, 'company-a');
  for (const change of [{ company_id: 'company-b' }, { filters: { ...filters, action: 'post' } }, { items: Array(101).fill({}) }, { capabilities: {} }, { next_cursor: 1 }])
    assert.throws(() => validateAudit({ ...fixture(), ...change }, 'company-a', filters));
});
test('all supported sources link to existing read views', () => {
  for (const [kind, path] of [['sales_invoice', '/invoices/id'], ['purchase_bill', '/bills/id'], ['sales_credit_note', '/sales-credit-notes/id'], ['supplier_credit_note', '/supplier-credit-notes/id'], ['accounting_payment_event', '/payments?event=id'], ['capture', '/documents?capture=id'], ['chart', '/chart-of-accounts'], ['payment_setup', '/payments'], ['credit_tracking', '/awaiting-credits']]) assert.equal(resourcePath({ resource_kind: kind, resource_id: 'id' }), path);
  assert.equal(resourcePath({ resource_kind: 'unknown', resource_id: 'id' }), null);
});
test('old company and failed requests cannot display prior rows or recover export authority', async () => {
  const old = deferred(), states = [];
  const first = requestRead({ key: 'old', load: () => old.promise, validate: data => validateAudit(data, 'company-a', filters), publish: state => states.push(state) });
  await Promise.resolve(); first.cancel(); old.resolve(fixture()); await first.done;
  assert.deepEqual(states, []);
  const second = requestRead({ key: 'new', load: async () => fixture(), validate: data => validateAudit(data, 'company-b', filters), publish: state => states.push(state) });
  await second.done; assert.equal(states[0].data, null); assert.ok(states[0].error);
  assert.equal(visibleRead({ key: 'old', data: fixture(), loading: false }, 'new').data, null);
});
test('late exports cannot download after company, filter or cancellation changes', async () => {
  for (const cancellation of ['abort', 'scope']) {
    const pending = deferred(), controller = new AbortController(), deliveries = []; let current = true;
    const work = guardedExport({ client: { export: () => pending.promise }, company: 'company-a', filters, signal: controller.signal, isCurrent: () => current, deliver: csv => deliveries.push(csv) });
    if (cancellation === 'abort') controller.abort(); else current = false;
    pending.resolve({ company_id: 'company-a', csv: 'private' });
    assert.equal(await work, false); assert.deepEqual(deliveries, []);
  }
  const options = { company: 'company-a', filters, signal: new AbortController().signal, isCurrent: () => true, deliver: () => assert.fail('foreign export downloaded') };
  await assert.rejects(guardedExport({ ...options, client: { export: async () => ({ company_id: 'company-b', csv: 'foreign' }) } }), /different company/);
  const deliveries = [];
  assert.equal(await guardedExport({ ...options, client: { export: async () => ({ company_id: 'company-a', csv: 'safe' }) }, deliver: value => deliveries.push(value) }), true);
  assert.deepEqual(deliveries, ['safe']);
});
test('native audit client uses selected company, credentials and safe CSV metadata', async () => {
  const calls = [], controller = new AbortController();
  const client = createAuditClient(async (url, options) => { calls.push([url, options]); return Response.json({ data: fixture() }); });
  assert.equal((await client.list('company-a', { ...filters, cursor: null, q: '%_+' }, controller.signal)).company_id, 'company-a');
  assert.ok(calls[0][0].startsWith('/api/companies/company-a/audit-events?'));
  const url = new URL(calls[0][0], 'https://synthetic.invalid'); assert.equal(url.searchParams.get('q'), '%_+'); assert.equal(url.searchParams.has('cursor'), false);
  assert.equal(calls[0][1].credentials, 'include'); assert.equal(calls[0][1].signal, controller.signal);
  for (const headers of [{ 'Content-Type': 'application/json', 'X-Audit-Company': 'company-a' }, { 'Content-Type': 'text/csv', 'X-Audit-Company': 'company-b' }]) {
    await assert.rejects(createAuditClient(async () => new Response('private', { headers })).export('company-a', filters), /verified/);
  }
  const exported = await createAuditClient(async () => new Response('csv', { headers: { 'Content-Type': 'text/csv', 'X-Audit-Company': 'company-a' } })).export('company-a', filters);
  assert.equal(exported.csv, 'csv');
  await assert.rejects(createAuditClient(async () => Response.json({ error: { code: 'AUDIT_EXPORT_LIMIT', message: 'Narrow filters' } }, { status: 409 })).export('company-a', filters), error => error.status === 409 && error.code === 'AUDIT_EXPORT_LIMIT');
});
