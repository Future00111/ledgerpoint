import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { GeneralLedgerView, LegacyJournalDetails } from './GeneralLedger';

const render = history => renderToStaticMarkup(
  <MemoryRouter><GeneralLedgerView history={history} onRetry={() => {}} /></MemoryRouter>,
);
const journal = { id: 'synthetic-entry', date: '2026-10-30', reference: 'SYNTHETIC-JOURNAL',
  company_id: 'synthetic-company', description: 'Preserved journal history', total_debit: '100.10', total_credit: '100.10',
  source_type: 'purchase_bill', source_record_id: 'synthetic-source', source_record_number: 'BILL-123', status: 'posted',
  lines: [{ account_id: 'synthetic-expense', account_code: '5000', account_name: 'Repairs', debit: '100.10', credit: '0.00' },
    { account_id: 'synthetic-payables', account_code: '2000', account_name: 'Payables', debit: '0.00', credit: '100.10' }] };

test('failed history is retryable and cannot imply an empty or balanced ledger or expose diagnostics', () => {
  const html = render({ status: 'error', rows: [journal], error: 'permission denied SELECT * FROM journal_entries' });
  assert.match(html, /role="alert"/);
  assert.match(html, /Journal history could not be loaded/);
  assert.match(html, /Try again/);
  for (const text of ['Displayed legacy entry totals match', 'Some displayed legacy entries do not balance', 'Entry debits', 'No journal entries found',
    '0 journal entries', 'SYNTHETIC-JOURNAL', 'permission denied', 'SELECT', 'journal_entries']) {
    assert.ok(!html.includes(text), text);
  }
});

test('loading history never displays stale rows, zero counts or balance assertions', () => {
  const html = render({ status: 'loading', rows: [journal] });
  assert.match(html, /Loading journal history/);
  for (const text of ['Displayed legacy entry totals match', 'Some displayed legacy entries do not balance', 'Entry debits', 'No journal entries found', '0 journal entries', 'SYNTHETIC-JOURNAL']) {
    assert.ok(!html.includes(text), text);
  }
});

test('successful reads preserve journal rows and distinguish an actual empty result', () => {
  const rows = render({ status: 'ready', rows: [journal] });
  assert.match(rows, /1 journal entry/);
  assert.match(rows, /SYNTHETIC-JOURNAL/);
  assert.match(rows, /Preserved journal history/);
  assert.match(rows, /View journal details/);
  assert.match(rows, /£100.10/);
  assert.match(rows, /Displayed legacy entry totals match/);
  assert.match(rows, /filtered legacy entries only/);
  assert.match(rows, /up to 500 entries/);
  assert.ok(!rows.includes('Ledger is balanced'));
  assert.ok(!rows.includes('Journal history could not be loaded'));
  const empty = render({ status: 'ready', rows: [] });
  assert.match(empty, /0 journal entries/);
  assert.match(empty, /No journal entries found/);
  assert.ok(!empty.includes('Journal history could not be loaded'));
});


test('opposite unbalanced entries cannot imply balance merely because their aggregate cancels out', () => {
  const rows = [
    { ...journal, id: 'unbalanced-1', total_debit: '100.10', total_credit: '100.00' },
    { ...journal, id: 'unbalanced-2', total_debit: '100.00', total_credit: '100.10' },
  ];
  const html = render({ status: 'ready', rows });
  assert.match(html, /Some displayed legacy entries do not balance/);
  assert.match(html, /£200.10/);
  assert.ok(!html.includes('Displayed legacy entry totals match'));
});

test('missing or malformed historical header totals are unavailable, never inferred as zero', () => {
  for (const total of [undefined, null, '', 'incorrect', '1.001', 0]) {
    const html = render({ status: 'ready', rows: [{ ...journal, total_debit: total }] });
    assert.match(html, /Totals unavailable for displayed legacy entries/);
    assert.match(html, /Unavailable/);
    assert.ok(!html.includes('Displayed legacy entry totals match'));
    assert.ok(!html.includes('£0.00'));
  }
});

test('schema-shaped legacy details show header totals, line accounts and a valid source link', () => {
  const html = renderToStaticMarkup(<MemoryRouter><LegacyJournalDetails journal={journal} /></MemoryRouter>);
  for (const text of ['£100.10', 'Repairs', 'Payables', '5000', '2000', 'BILL-123', '/bills/synthetic-source']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Account unavailable'));
  const invalid = renderToStaticMarkup(<MemoryRouter><LegacyJournalDetails journal={{ ...journal, total_debit: null,
    total_credit: 'malformed', lines: [null, { debit: undefined, credit: 'invalid' }], source_record_id: null }} /></MemoryRouter>);
  assert.match(invalid, /Unavailable/);
  assert.match(invalid, /Account unavailable/);
  assert.ok(!invalid.includes('£0.00'));
  assert.ok(!invalid.includes('View source document'));
  const missingPayment = renderToStaticMarkup(<MemoryRouter><LegacyJournalDetails journal={{ ...journal,
    source_type: 'accounting_payment_event', source_record_id: null }} /></MemoryRouter>);
  assert.ok(!missingPayment.includes('/payments?event='));
});
