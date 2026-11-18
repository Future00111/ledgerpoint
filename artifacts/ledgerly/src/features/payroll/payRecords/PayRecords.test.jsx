import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PayRecordsWorkspace, PayRecordDetails } from './PayRecordsWorkspace';
import { SECTIONS } from '@/components/layout/navConfig';
import { visibleSections } from '@/features/workspaceNavigation/model.mjs';
const companyId = '12345678-1234-4234-8234-123456789abc';
const render = role => renderToStaticMarkup(<PayRecordsWorkspace companyId={companyId} actorId="synthetic_actor" role={role} companyName="Synthetic company" />);

test('only owners and preparers see the native pay entry form; all four payroll roles can look up', () => {
  for (const role of ['owner', 'payroll_preparer']) {
    const html = render(role);
    for (const text of ['Employee reference', 'Effective from', 'Annual salary (GBP)', 'Save pay record', 'Pay record ID', 'Look up pay record', 'Synthetic company']) assert.ok(html.includes(text), text);
    assert.ok(html.includes('autoComplete="off"')); assert.ok(html.includes('inputMode="decimal"')); assert.ok(html.includes('readOnly=""'));
  }
  for (const role of ['payroll_reader', 'payroll_approver']) {
    const html = render(role); assert.ok(html.includes('Look up pay record'));
    assert.ok(!html.includes('xl:grid-cols-2'));
    for (const text of ['Employee reference', 'Save pay record', 'Enter annual pay']) assert.ok(!html.includes(text));
  }
});
test('ordinary, unknown and missing identity scopes expose neither fields nor controls', () => {
  for (const role of ['admin', 'accountant', 'staff', 'member', 'read_only', 'personal_tax_preparer', null]) {
    const html = render(role); assert.ok(html.includes('does not provide access')); assert.ok(!html.includes('<input')); assert.ok(!html.includes('<button'));
  }
  const missing = renderToStaticMarkup(<PayRecordsWorkspace companyId={companyId} role="owner" />);
  assert.ok(!missing.includes('<input'));
  const unselected = renderToStaticMarkup(<PayRecordsWorkspace actorId="synthetic_actor" role="owner" />);
  assert.ok(unselected.includes('Choose a company')); assert.ok(!unselected.includes('<input'));
});
test('salary formatting remains exact and reader presentation excludes even an unexpected employee value', () => {
  const record = { id: companyId, employee_id: 'employee-private-marker', effective_from: '2026-04-06', annual_salary_pence: '9007199254740993', currency: 'GBP' };
  const html = renderToStaticMarkup(<PayRecordDetails record={record} role="payroll_reader" />);
  assert.ok(html.includes('£90,071,992,547,409.93')); assert.ok(!html.includes('employee-private-marker')); assert.ok(!html.includes('Employee reference'));
});
test('navigation uses the existing role filter and keeps payroll hidden from bookkeeping roles', () => {
  const visible = role => visibleSections(SECTIONS, { companyRole: role }).flatMap(section => section.items).some(item => item.path === '/payroll/pay-records');
  for (const role of ['owner', 'payroll_preparer', 'payroll_reader', 'payroll_approver']) assert.equal(visible(role), true);
  for (const role of ['admin', 'accountant', 'staff', 'member', 'read_only', null]) assert.equal(visible(role), false);
});

test('only owners and payroll preparers see the explicit pay CSV download control', async () => {
  const { PayExportButton } = await import('./PayExportButton');
  const record = { id: companyId, effective_from: '2026-04-06', annual_salary_pence: '4800000', currency: 'GBP' };
  for (const role of ['owner', 'payroll_preparer']) {
    const html = renderToStaticMarkup(<PayExportButton companyId={companyId} record={record} role={role} />);
    assert.ok(html.includes('Download CSV')); assert.ok(!html.includes('4800000'));
  }
  for (const role of ['payroll_reader', 'payroll_approver', 'personal_tax_preparer', 'personal_tax_submitter', 'admin', null])
    assert.equal(renderToStaticMarkup(<PayExportButton companyId={companyId} record={record} role={role} />), '');
});
