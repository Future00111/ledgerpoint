import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import ReportToolbar, { ReportNavigation } from './ReportToolbar';
import LedgerTable from './LedgerTable';
import JournalReview from './JournalReview';
import { CompanyReports } from '../../pages/AccountingReports';
import ReportLibrary from '../../pages/ReportLibrary';
import HistoricalVatNotice, { historicalStatus } from '../vatPreparation/HistoricalVatNotice';
import { visibleRead } from './model.mjs';
import ProfitLossReport, { ProfitLossOverview } from '../../components/accounting/ProfitLossReport';
const render = (element, entry = '/reports') => renderToStaticMarkup(<MemoryRouter initialEntries={[entry]}>{element}</MemoryRouter>);

test('navigation announces selection; closing date toolbar presents one As-at control', () => {
  const nav = render(<ReportNavigation tab="bs" />);
  assert.match(nav, /aria-current="page"[^>]*data-testid="tab-bs"/);
  assert.equal((nav.match(/aria-current="page"/g) || []).length, 1);
  const closing = render(<ReportToolbar tab="bs" from="0001-01-01" to="2026-10-30" />);
  assert.ok(closing.includes('As at')); assert.ok(!closing.includes('input-from')); assert.ok(closing.includes('all posted entries'));
  const movement = render(<ReportToolbar tab="pnl" from="2026-10-31" to="2026-10-01" validation="Start after end" />);
  assert.ok(movement.includes('input-from')); assert.ok(movement.includes('aria-invalid="true"')); assert.ok(movement.includes('role="alert"'));
});

test('report shell shows company but has no export during loading or invalid input', () => {
  const props = { company: { id: 'synthetic-company', name: 'Synthetic owner company' }, defaultTab: 'pnl' };
  const loading = render(<CompanyReports {...props} />, '/reports?tab=pnl&from=2026-10-01&to=2026-10-31');
  assert.ok(loading.includes('Synthetic owner company')); assert.ok(loading.includes('Loading report')); assert.ok(!loading.includes('Export report CSV'));
  const invalid = render(<CompanyReports {...props} />, '/reports?tab=gl&from=&to=2026-10-31');
  assert.ok(invalid.includes('Enter valid report dates')); assert.ok(!invalid.includes('Loading report')); assert.ok(!invalid.includes('Export matching entries CSV'));
});

test('ledger table retains exact money, source routes, captions and keyboard scrolling', () => {
  const rows = [{ id: 'line', posting_date: '2026-10-30', account_code: '4000', account_name: 'Sales', source_type: 'sales_credit_note', source_id: 'credit', source_number: 'CREDIT-1', journal_id: 'j1', debit_minor: '9007199254740993', credit_minor: '0' }];
  const html = render(<LedgerTable rows={rows} from="2026-10-01" to="2026-10-31" />);
  for (const text of ['£90,071,992,547,409.93', '/sales-credit-notes/credit', '/accounting/journals/j1', 'Matching movement totals', 'scope="col"', 'tabindex="0"', 'View journal for CREDIT-1, account 4000']) assert.ok(html.includes(text), text);
  assert.ok(render(<LedgerTable rows={[]} />).includes('No posted entries match'));
});

test('journal review presents evidence and hides prior-scope links and amounts', () => {
  const company = { name: 'Synthetic company' }, data = { entry: { id: 'j1', company_id: 'a', reference: 'INV-1', posting_date: '2026-10-30', source_type: 'sales_invoice', source_id: 'invoice', description: 'Invoice for synthetic work', total_debit_minor: '12000', total_credit_minor: '12000', status: 'posted' }, lines: [{ account_code: '1100', account_name: 'Receivables', source_line_ref: 'control', debit_minor: '12000', credit_minor: '0' }] };
  const html = render(<JournalReview company={company} data={data} />);
  for (const text of ['Synthetic company', 'INV-1', 'Open sales invoice', '/invoices/invoice', 'Posted totals', 'read-only evidence', '£120.00']) assert.ok(html.includes(text), text);
  const current = visibleRead({ key: 'a', data, loading: false, error: null }, 'b');
  const stale = render(<JournalReview company={{ name: 'New company' }} data={current.data} loading={current.loading} error={current.error} />);
  assert.ok(stale.includes('New company')); assert.ok(!stale.includes('INV-1')); assert.ok(!stale.includes('£120.00')); assert.ok(!stale.includes('/invoices/invoice'));
});

test('report library leads to native VAT and historical status never implies verified filing', () => {
  const library = render(<ReportLibrary />);
  assert.ok(library.includes('href="/vat"')); assert.ok(library.includes('href="/reports?tab=pnl"'));
  assert.equal(historicalStatus('submitted'), 'Historical submitted status (unverified)');
  const notice = render(<HistoricalVatNotice from="2026-07-01" to="2026-09-30" />);
  assert.ok(notice.includes('not a verified HMRC submission receipt'));
  assert.ok(notice.includes('/vat?from=2026-07-01&amp;to=2026-09-30'));
});

test('report hub retains every current report and historical tools without invented figures', () => {
  const html = render(<ReportLibrary />);
  for (const route of ['/reports?tab=pnl', '/reports?tab=bs', '/vat', '/reports?tab=parties', '/reports?tab=ageing', '/reports?tab=tb', '/reports?tab=gl', '/statements', '/reports/legacy']) assert.ok(html.includes(`href="${route}"`), route);
  assert.ok(html.includes('they do not submit a return'));
  assert.ok(!html.includes('£'));
});

test('profit overview keeps server totals exact and the statement keeps category and account drilldowns', () => {
  const pnl = { profit_minor:'9007199254740993', revenue_minor:'9007199254741003', expense_minor:'10', gross_profit_minor:'9007199254740998', sections:[{category:'income',label:'Revenue',total_minor:'9007199254741003',groups:[{name:'Service income',subtotal_minor:'9007199254741003',accounts:[{account_id:'a1',code:'4000',name:'Sales',amount_minor:'9007199254741003'}]}]}] };
  const summary = render(<ProfitLossOverview pnl={pnl} />);
  for (const text of ['£90,071,992,547,409.93', '£90,071,992,547,410.03', '£0.10', '£90,071,992,547,409.98', 'View revenue transactions']) assert.ok(summary.includes(text), text);
  const statement = render(<ProfitLossReport data={{pnl}} company={{name:'Synthetic company'}} from="2026-10-01" to="2026-10-30" />);
  for (const text of ['View Revenue transactions', 'View Service income transactions', 'View transactions for 4000 Sales', 'tabindex="0"', 'Drafts are excluded']) assert.ok(statement.includes(text), text);
});
