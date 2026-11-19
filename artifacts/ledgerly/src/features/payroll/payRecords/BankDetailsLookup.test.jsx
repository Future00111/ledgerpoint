import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BankDetailsLookup, BankLookupResult } from './BankDetailsLookup';
import { PayRecordsWorkspace } from './PayRecordsWorkspace';

const companyId = '12345678-1234-4234-8234-123456789abc';
const render = (role, state) => renderToStaticMarkup(<BankLookupResult role={role} state={state} />);

test('owner/preparer/approver receive an explicit bank lookup without any mount fetch', () => {
  let calls = 0;
  for (const role of ['owner', 'payroll_preparer', 'payroll_approver']) {
    const html = renderToStaticMarkup(<BankDetailsLookup companyId={companyId} actorId="synthetic" role={role} client={{ read() { calls++; } }} />);
    for (const value of ['Employee bank details', 'Employee UUID for bank lookup', 'Look up bank details', 'autoComplete="off"', 'maxLength="36"']) assert.ok(html.includes(value), value);
    assert.ok(!html.includes('Employee bank lookup result')); assert.ok(!html.includes('Download'));
  }
  assert.equal(calls, 0);
});
test('reader, unrelated roles and missing identity/company expose no bank controls or result', () => {
  for (const role of ['payroll_reader', 'admin', 'accountant', 'staff', 'member', 'read_only', 'personal_tax_preparer', 'personal_tax_submitter', null]) {
    assert.equal(renderToStaticMarkup(<BankDetailsLookup companyId={companyId} actorId="synthetic" role={role} />), '');
    assert.equal(render(role, { status: 'ready', result: { account_number: '12345678' } }), '');
  }
  assert.equal(renderToStaticMarkup(<BankDetailsLookup companyId={companyId} role="owner" />), '');
  assert.equal(renderToStaticMarkup(<BankDetailsLookup actorId="synthetic" role="owner" />), '');
  const reader = renderToStaticMarkup(<PayRecordsWorkspace companyId={companyId} actorId="synthetic" role="payroll_reader" />);
  assert.ok(reader.includes('Look up pay record')); assert.ok(!reader.includes('Employee bank details'));
});
test('full account preserves zeroes; approver displays only an exact four-digit projection', () => {
  for (const role of ['owner', 'payroll_preparer']) {
    const html = render(role, { status: 'ready', result: { account_number: '00123456' } });
    assert.ok(html.includes('Bank account number')); assert.ok(html.includes('00123456'));
  }
  const masked = render('payroll_approver', { status: 'ready', result: { last_four: '0007' } });
  assert.ok(masked.includes('Account number ending')); assert.ok(masked.includes('••••0007')); assert.ok(!masked.includes('Bank account number'));
  for (const result of [{ account_number: '12345678' }, { account_number: '12345678', last_four: '5678' }]) {
    const html = render('payroll_approver', { status: 'ready', result }); assert.ok(!html.includes('12345678')); assert.ok(!html.includes('5678')); assert.ok(html.includes('could not be loaded'));
  }
});
test('pending/invalid/denied/failed states never display previous bank details or raw errors', () => {
  for (const status of ['idle', 'loading', 'invalid', 'unavailable', 'failed']) {
    const html = render('owner', { status, result: { account_number: '12345678' }, error: 'private diagnostic' });
    assert.ok(!html.includes('12345678')); assert.ok(!html.includes('private diagnostic')); assert.ok(!html.includes('Employee bank lookup result'));
  }
});
