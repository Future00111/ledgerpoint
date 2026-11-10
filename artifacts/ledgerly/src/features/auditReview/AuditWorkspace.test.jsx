import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import AuditWorkspace from './AuditWorkspace';
import { initialFilters } from './model.mjs';

const row = { event_key: 'documents:event-id', occurred_at: '2026-10-30T11:12:13.123456Z', category: 'documents', action: 'post', label: 'Document posted', actor_id: 'synthetic-owner', reference: 'SYNTH-INVOICE-1', reason: 'Approved reason', resource_kind: 'sales_invoice', resource_id: 'invoice-id', journal_id: 'journal-id', changed_fields: ['line_items'], source: { credential: 'DO-NOT-EXPOSE' } };
const props = { filters: initialFilters(new Date('2026-10-30T12:00:00Z')), data: { items: [row], as_of: '2026-10-30T12:00:00.000001Z', next_cursor: 'cursor' } };
const render = changes => renderToStaticMarkup(<MemoryRouter><AuditWorkspace {...props} {...changes} /></MemoryRouter>);
const exportButton = html => html.match(/<button[^>]*>[\s\S]*?Export filtered CSV<\/button>/g)?.at(-1) ?? '';

test('audit workspace presents source and journal trace, UTC precision, actor and read-only scope', () => {
  const html = render({});
  for (const text of ['Audit history', 'scope="col"', 'Recorded (UTC)', 'synthetic-owner', 'SYNTH-INVOICE-1', 'href="/invoices/invoice-id"', 'href="/accounting/journals/journal-id"', '2026-10-30T11:12:13.123456Z', 'Changed fields: ', 'line items', 'Event counts are not transaction totals', 'Sign-ins, company membership changes', 'at most 1,000']) assert.ok(html.includes(text), text);
  assert.equal(html.includes('DO-NOT-EXPOSE'), false);
  assert.equal(html.includes('Delete event'), false);
});
test('loading, errors and edited filters disable export and stale rows stay hidden during reads', () => {
  for (const changes of [{ loading: true }, { error: new Error('Access denied') }]) {
    const html = render(changes);
    assert.equal(html.includes('SYNTH-INVOICE-1'), false); assert.equal(html.includes('/accounting/journals/journal-id'), false);
    assert.match(exportButton(html), /disabled=""/);
  }
  const dirty = render({ dirty: true }); assert.ok(dirty.includes('Apply them to update the table and export')); assert.match(exportButton(dirty), /disabled=""/);
  assert.ok(render({ validation: 'Invalid date' }).includes('role="alert"'));
});
test('empty history is a filter result and explains supported sources without inventing completeness', () => {
  const html = render({ data: { ...props.data, items: [], next_cursor: null } });
  assert.ok(html.includes('No recorded changes match')); assert.ok(html.includes('supported audit sources'));
  assert.equal(html.includes('No changes have ever happened'), false);
  assert.ok(html.includes('aria-label="Audit history filters"')); assert.ok(html.includes('for="audit-search"'));
});
