import test from 'node:test';
import assert from 'node:assert/strict';
import { auditRole, auditQuery, decodeCursor, encodeCursor, presentEvent, csvCell, auditCsv, AuditError } from './contract';

const company = '10000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000002';
const filters = auditQuery({}).filters;
const event = () => presentEvent({ event_key: 'documents:' + id, occurred_at: '2026-10-30T11:12:13.123456Z', category: 'documents', action: 'correction', actor_id: 'synthetic-owner', reference: 'INV-1', reason: '', resource_kind: 'sales_invoice', resource_id: id, journal_id: id, changed_fields: ['notes'] });
const invalid = (fn: () => unknown, code = 'INVALID_AUDIT_QUERY') => assert.throws(fn, (error: any) => error instanceof AuditError && error.code === code);

test('sensitive audit and export roles fail closed', () => {
  for (const role of ['owner', 'admin', 'accountant']) assert.equal(auditRole(role), true);
  for (const role of ['staff', 'member', 'read_only', 'OWNER', 'unknown', '', null, undefined, ['owner'], {}]) assert.equal(auditRole(role), false);
});
test('audit filters reject unsupported or unbounded values and preserve literal search', () => {
  assert.deepEqual(auditQuery({ q: '  %_literal  ', limit: '100', from: '2024-02-29', to: '2024-02-29', action: 'correction' }), {
    filters: { from: '2024-02-29', to: '2024-02-29', q: '%_literal', category: 'all', action: 'correction' }, limit: 100, cursor: null,
  });
  for (const input of [null, [], { from: '2026-02-29' }, { to: '2200-01-01' }, { from: '2026-10-31', to: '2026-10-01' },
    { limit: 10 }, { limit: '0' }, { limit: '101' }, { limit: '1e2' }, { category: ['documents'] }, { action: 'delete' },
    { q: 'a'.repeat(101) }, { q: 'x\u202ey' }, { q: 'x\ny' }, { cursor: 'a'.repeat(1501) }, { unknown: 'field' }]) invalid(() => auditQuery(input));
  for (const input of [{ cursor: 'a' }, { limit: '1' }]) invalid(() => auditQuery(input, true));
});
test('continuation preserves microseconds and binds company and every filter', () => {
  const token = encodeCursor(company, filters, '2026-10-30T11:12:14.000001Z', event());
  const result = decodeCursor(token, company, filters)!;
  assert.equal(result.occurred_at, '2026-10-30T11:12:13.123456Z');
  assert.equal(result.event_key, 'documents:' + id);
  invalid(() => decodeCursor(token, id, filters), 'INVALID_AUDIT_CURSOR');
  for (const [key, value] of [['from', '2026-01-01'], ['to', '2026-10-30'], ['q', 'changed'], ['category', 'ledger'], ['action', 'post']])
    invalid(() => decodeCursor(token, company, { ...filters, [key]: value }), 'INVALID_AUDIT_CURSOR');
  for (const change of [{ v: 2 }, { event_key: 'unknown:' + id }, { occurred_at: '2026-10-30T11:12:13.123Z' }, { occurred_at: '2026-10-30T11:12:15.000000Z' }, { extra: 'value' }]) {
    invalid(() => decodeCursor(Buffer.from(JSON.stringify({ ...result, ...change })).toString('base64url'), company, filters), 'INVALID_AUDIT_CURSOR');
  }
  invalid(() => decodeCursor('!bad', company, filters), 'INVALID_AUDIT_CURSOR');
  assert.equal(decodeCursor(null, company, filters), null);
});
test('fixed public projection excludes source, provider errors and unsafe fields', () => {
  const presented = presentEvent({ ...event(), resource_kind: 'https://evil.invalid', resource_id: 'not-a-uuid', actor_id: 'user\u0000\u202e1', changed_fields: ['notes', 'raw.value', 'x'.repeat(51), 4], source: { credential: 'secret' }, context: 'secret', request_hash: 'secret', content: 'secret' });
  assert.equal(presented.label, 'Document corrected');
  assert.equal(presented.resource_kind, null); assert.equal(presented.resource_id, null);
  assert.equal(presented.actor_id, 'user  1'); assert.deepEqual(presented.changed_fields, ['notes']);
  assert.equal(JSON.stringify(presented).includes('secret'), false);
  assert.deepEqual(Object.keys(presented).sort(), ['event_key', 'occurred_at', 'category', 'action', 'label', 'actor_id', 'reference', 'reason', 'resource_kind', 'resource_id', 'journal_id', 'changed_fields'].sort());
});
test('CSV neutralises spreadsheet formulas and controls, quotes delimiters and never silently truncates', () => {
  for (const value of ['=SUM(1)', '+1', '-1', '@cmd', '\t=cmd', '\u202e=cmd', '  =cmd']) assert.match(csvCell(value), /^"'/);
  assert.equal(csvCell('a,"b"\r\nc'), '"a,""b""  c"');
  const csv = auditCsv([{ ...event(), reference: '=DANGEROUS()', reason: 'approved\u0001reason' }]);
  assert.ok(csv.startsWith('\uFEFF"Recorded at (UTC)"')); assert.ok(csv.includes('"\'=DANGEROUS()"'));
  assert.equal(csv.includes('\u0001'), false); assert.equal(csv.trim().split('\r\n').length, 2);
  invalid(() => auditCsv(Array.from({ length: 1001 }, event)), 'AUDIT_EXPORT_LIMIT');
});
