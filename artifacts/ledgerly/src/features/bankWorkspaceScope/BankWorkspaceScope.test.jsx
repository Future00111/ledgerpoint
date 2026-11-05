import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import BankWorkspaceScope, { BankReadStatus } from './BankWorkspaceScope';
import { CompanyBankTransactions } from '../../pages/BankTransactions';

const render = element => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
const a = { id: 'company-a', name: 'Company A private name' }, b = { id: 'company-b', name: 'Company B' };

test('company loading or missing access never renders the bank workspace or old company details', () => {
  const blocked = () => { throw new Error('Financial workspace must not render'); };
  for (const props of [{ company: a, loading: true }, { company: null, loading: false }]) {
    const html = render(<BankWorkspaceScope {...props} Workspace={blocked} />);
    assert.ok(!html.includes(a.name)); assert.ok(!html.includes('Import CSV'));
  }
});

test('company identity gives the actual stateful workspace a new key and renders only the selected company', () => {
  const first = BankWorkspaceScope({ company: a, loading: false, Workspace: CompanyBankTransactions });
  const next = BankWorkspaceScope({ company: b, loading: false, Workspace: CompanyBankTransactions });
  assert.notEqual(first.key, next.key);
  assert.equal(next.type, CompanyBankTransactions);
  // The existing toast hook is browser-only. Exercise the real scope boundary's
  // render contract without replacing it or modifying that unrelated hook.
  const SentinelWorkspace = ({ company }) => <section><h1>{company.name}</h1><p>Financial workspace for {company.id}</p></section>;
  const html = render(<BankWorkspaceScope company={b} loading={false} Workspace={SentinelWorkspace} />);
  assert.ok(html.includes('Company B'));
  assert.ok(!html.includes('Company A private name'));
  assert.ok(html.includes('Financial workspace for company-b'));
  assert.ok(!html.includes('company-a'));
});

test('failed reads offer scoped retries; suggestion failure does not falsely declare the transaction list empty', () => {
  const failed = render(<BankReadStatus error="Transactions unavailable" suggestionsError="Suggestions unavailable" />);
  assert.ok(failed.includes('role="alert"'));
  assert.ok(failed.includes('Retry bank transactions')); assert.ok(failed.includes('Retry suggested matches'));
  assert.ok(!failed.includes('No transactions'));
  const pending = render(<BankReadStatus loading={false} suggestionsLoading />);
  assert.ok(pending.includes('Loading suggested matches')); assert.ok(pending.includes('role="status"'));
});
