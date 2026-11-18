import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaxPreparationsWorkspace, TaxPreparationDetails } from './TaxPreparationsWorkspace';
import { SECTIONS } from '@/components/layout/navConfig';
import { visibleSections } from '@/features/workspaceNavigation/model.mjs';
const company = '12345678-1234-4234-8234-123456789abc';
const render = role => renderToStaticMarkup(<TaxPreparationsWorkspace companyId={company} companyName="Synthetic company" actorId="synthetic_actor" role={role} />);

test('owner/preparer have explicit entry and lookup controls; submitter has a full-width lookup only', () => {
  for (const role of ['owner', 'personal_tax_preparer']) {
    const html = render(role);
    for (const text of ['Taxpayer reference', 'Tax year starting', 'Employment income (GBP)', 'Save tax input', 'Look up tax input', 'Record ID', 'Synthetic company']) assert.ok(html.includes(text), text);
    assert.ok(html.includes('autoComplete="off"')); assert.ok(html.includes('readOnly=""')); assert.ok(html.includes('does not calculate or file tax'));
  }
  const html = render('personal_tax_submitter'); assert.ok(html.includes('Look up tax input'));
  for (const text of ['Taxpayer reference', 'Save tax input', 'Enter employment income', 'xl:grid-cols-2']) assert.ok(!html.includes(text), text);
});
test('payroll/bookkeeping roles and missing identity/scope have no tax input controls', () => {
  for (const role of ['admin', 'accountant', 'staff', 'member', 'read_only', 'payroll_reader', 'payroll_preparer', 'payroll_approver', null]) {
    const html = render(role); assert.ok(html.includes('does not provide access')); assert.ok(!html.includes('<input')); assert.ok(!html.includes('<button'));
  }
  assert.ok(!renderToStaticMarkup(<TaxPreparationsWorkspace companyId={company} role="owner" />).includes('<input'));
  assert.ok(renderToStaticMarkup(<TaxPreparationsWorkspace actorId="synthetic_actor" role="owner" />).includes('Choose a company'));
});
test('tax result renders exact amount and stored year without exposing unexpected taxpayer metadata to submitter', () => {
  const record = { id: company, taxpayer_id: 'private-taxpayer-marker', tax_year_start: 2026, employment_income_pence: '9007199254740993', currency: 'GBP' };
  const html = renderToStaticMarkup(<TaxPreparationDetails record={record} role="personal_tax_submitter" />);
  assert.ok(html.includes('£90,071,992,547,409.93')); assert.ok(html.includes('2026'));
  assert.ok(!html.includes('private-taxpayer-marker')); assert.ok(!html.includes('Taxpayer reference'));
});
test('company navigation includes personal tax only for its three read roles', () => {
  const visible = role => visibleSections(SECTIONS, { companyRole: role }).flatMap(section => section.items).some(item => item.path === '/personal-tax/preparations');
  for (const role of ['owner', 'personal_tax_preparer', 'personal_tax_submitter']) assert.equal(visible(role), true);
  for (const role of ['admin', 'accountant', 'staff', 'member', 'read_only', 'payroll_reader', 'payroll_preparer', 'payroll_approver', null]) assert.equal(visible(role), false);
});
