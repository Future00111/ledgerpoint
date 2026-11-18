import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AccessHistoryWorkspace, AccessHistoryContent } from './AccessHistoryWorkspace';
import { SECTIONS } from '@/components/layout/navConfig';
import { visibleSections } from '@/features/workspaceNavigation/model.mjs';

const company = '12345678-1234-4234-8234-123456789abc';
const event = { id: company, membership_id: '12345678-1234-4234-8234-123456789abd', occurred_at: '2026-11-18T16:20:30.123456Z',
  operation: 'member_add', previous_role: null, previous_active: null, next_role: 'payroll_reader', next_active: null };
const result = { events: [event], limit: 50, has_more: false };
const render = state => renderToStaticMarkup(<AccessHistoryContent state={state} />);

test('owner starts with an explicit history action and mounting neither fetches nor claims an empty result', () => {
  let calls = 0;
  const html = renderToStaticMarkup(<AccessHistoryWorkspace companyId={company} companyName="Synthetic company" actorId="synthetic_owner" role="owner" client={{ read() { calls++; } }} />);
  assert.equal(calls, 0); assert.ok(html.includes('View history')); assert.ok(html.includes('Synthetic company'));
  assert.ok(!html.includes('Refresh history')); assert.ok(!html.includes('<table')); assert.ok(!html.includes('No specialist access changes recorded'));
});
test('every non-owner role and missing actor/company scope has no history controls or results', () => {
  for (const role of ['admin', 'accountant', 'staff', 'member', 'read_only', 'payroll_preparer', 'payroll_reader', 'payroll_approver', 'personal_tax_preparer', 'personal_tax_submitter', null]) {
    const html = renderToStaticMarkup(<AccessHistoryWorkspace companyId={company} actorId="synthetic_actor" role={role} />);
    assert.ok(html.includes('Only a current company owner')); assert.ok(!html.includes('<button')); assert.ok(!html.includes('<table'));
  }
  const missing = renderToStaticMarkup(<AccessHistoryWorkspace companyId={company} role="owner" />); assert.ok(!missing.includes('<button'));
  const empty = renderToStaticMarkup(<AccessHistoryWorkspace actorId="synthetic_actor" role="owner" />); assert.ok(empty.includes('Choose a company')); assert.ok(!empty.includes('<button'));
});
test('accessible history table shows plain names, exact membership ref and absence versus unknown active state', () => {
  const html = render({ status: 'ready', result });
  for (const text of ['aria-label="Specialist access history"', 'scope="col"', 'When (UTC)', 'Before', 'After', 'Membership reference', 'Member added',
    'Payroll reader', 'Not present', 'Not recorded', '18 Nov 2026, 16:20:30 UTC', event.membership_id, `dateTime="${event.occurred_at}"`, `title="${event.occurred_at}"`]) assert.ok(html.includes(text), text);
  assert.ok(html.includes('historical active status is unknown'));
  const active = render({ status: 'ready', result: { ...result, events: [{ ...event, next_role: 'personal_tax_preparer', next_active: true }] } });
  assert.ok(active.includes('Personal tax preparer')); assert.ok(active.includes('Active')); assert.ok(!active.includes('historical active status is unknown'));
  const inactive = render({ status: 'ready', result: { ...result, events: [{ ...event, next_active: false }] } }); assert.ok(inactive.includes('Inactive'));
});
test('loading, denied and failed views never render previously loaded rows, empty state or private diagnostics', () => {
  for (const status of ['loading', 'denied', 'failed']) {
    const html = render({ status, result, error: Error('private-actor diagnostic') });
    assert.ok(!html.includes(event.membership_id)); assert.ok(!html.includes('Payroll reader')); assert.ok(!html.includes('private-actor'));
    assert.ok(!html.includes('No specialist access changes recorded'));
    assert.ok(html.includes(status === 'loading' ? 'aria-busy="true"' : 'role="alert"'));
  }
  assert.ok(render({ status: 'ready', result: { events: [], limit: 50, has_more: false } }).includes('No specialist access changes recorded.'));
});
test('bounded view reports older results without pagination controls and never displays extra audit fields', () => {
  const html = render({ status: 'ready', result: { ...result, has_more: true, events: [{ ...event, actor_id: 'private-actor', email: 'private-email', context: { salary: 'private-salary' } }] } });
  assert.ok(html.includes('Showing the latest 50 changes. Older changes are not shown.'));
  assert.ok(!html.includes('<button')); for (const text of ['private-actor', 'private-email', 'private-salary']) assert.ok(!html.includes(text));
});
test('access history navigation is visible to owners only while existing payroll read navigation remains available', () => {
  const paths = role => visibleSections(SECTIONS, { companyRole: role }).flatMap(section => section.items).map(item => item.path);
  assert.ok(paths('owner').includes('/payroll/access-history'));
  for (const role of ['admin', 'accountant', 'payroll_reader', 'payroll_preparer', 'payroll_approver', 'personal_tax_preparer', null]) assert.ok(!paths(role).includes('/payroll/access-history'));
  for (const role of ['owner', 'payroll_reader', 'payroll_preparer', 'payroll_approver']) assert.ok(paths(role).includes('/payroll/pay-records'));
});
