import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PaymentFilters, PaymentList, PaymentBalanceSummary } from './PaymentList';
import PaymentAllocations from './PaymentAllocations';
import StatementMovements from './StatementMovements';
import PaymentOverview from './PaymentOverview';
import StatementSummary from './StatementSummary';

const render = element => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);
const payment = { id: 'p1', party_type: 'supplier', source: { party_name: 'Synthetic Parts' }, reference: 'SYNTHETIC-21', effective_date: '2026-10-30', amount_minor: '15000', allocated_minor: '10000', unapplied_minor: '5000', refunded_minor: '0', reversed: false };

test('payment overview shortcuts use existing row filters and clear conflicting search', () => {
  const payments = [payment, { ...payment, id:'p2', party_type:'customer', unapplied_minor:'0' }];
  const selected = [];
  const element = PaymentOverview({ payments, filters:{ search:'old search', direction:'paid', balance:'all' }, onChange:value => selected.push(value) });
  const choices = element.props.children;
  choices.forEach(choice => choice.props.onClick());
  assert.deepEqual(selected, [{search:'',direction:'received',balance:'all'}, {search:'',direction:'paid',balance:'all'}, {search:'',direction:'all',balance:'unapplied'}]);
  const html = render(<PaymentOverview payments={payments} filters={selected[2]} />);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1);
  assert.ok(html.includes('Customer payment records')); assert.ok(html.includes('Payments with an unapplied amount'));
  assert.ok(!html.includes('£'), 'Record counts must not imply cash totals');
  const unavailable = render(<PaymentOverview payments={null} filters={selected[0]} />);
  assert.equal((unavailable.match(/disabled=""/g) || []).length, 3);
  assert.equal((unavailable.match(/>—</g) || []).length, 3);
});

test('statement summary preserves server balances separately and retains exact large values', () => {
  const html = render(<StatementSummary party={{name:'Synthetic Supplier',type:'supplier'}} from="2026-10-01" to="2026-10-30" statement={{ closing:'9007199254740993', unapplied:'200', net:'9007199254740793' }} />);
  for (const text of ['Synthetic Supplier', 'Outstanding documents', 'Supplier prepayments', 'Net account balance', '£90,071,992,547,409.93', '£2.00', '£90,071,992,547,407.93', 'through 2026-10-30']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('settled'));
});

test('payment filters have named search/direction/unapplied controls and preserve selected view', () => {
  const html = render(<PaymentFilters filters={{ search: 'SYNTHETIC', direction: 'paid', balance: 'unapplied' }} />);
  for (const text of ['for="payment-search"', 'for="payment-direction"', 'for="payment-balance"', 'type="search"', 'value="SYNTHETIC"', 'Amount left to allocate']) assert.ok(html.includes(text), text);
  assert.match(html, /<option value="paid" selected="">/);
  assert.match(html, /<option value="unapplied" selected="">/);
});

test('payment history provides mobile cards and keyboard scrollable table with real amounts and named actions', () => {
  const html = render(<PaymentList payments={[payment]} total={3} />);
  for (const text of ['aria-label="Payment history"', 'aria-label="Payment history table"', 'tabindex="0"', 'Showing 1 of 3 payments', 'SYNTHETIC-21', 'Synthetic Parts', '£150.00', '£100.00', '£50.00', 'Review payment SYNTHETIC-21 for Synthetic Parts', 'scope="col"']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Record refund'), 'History rows must not add unguarded write actions');
  const disabled = render(<PaymentList payments={[payment]} total={1} disabled />);
  assert.equal((disabled.match(/disabled=""/g) || []).length, 2);
});

test('empty and filtered payment results explain different next steps without inventing zero balances', () => {
  const empty = render(<PaymentList payments={[]} total={0} />), filtered = render(<PaymentList payments={[]} total={4} />);
  assert.ok(empty.includes('Your payment history will appear here'));
  assert.ok(!empty.includes('Clear filters'));
  assert.ok(filtered.includes('No payments match this view'));
  assert.ok(filtered.includes('Clear filters'));
  assert.ok(!empty.includes('£0.00'));
});

test('payment status and detailed balances preserve refund/reversal distinctions and large pence precision', () => {
  assert.ok(render(<PaymentList payments={[{ ...payment, reversed: true }]} total={1} />).includes('Reversed'));
  assert.ok(render(<PaymentList payments={[{ ...payment, refunded_minor: '1' }]} total={1} />).includes('Refund recorded'));
  const summary = render(<PaymentBalanceSummary payment={{ ...payment, amount_minor: '9007199254740993' }} />);
  assert.ok(summary.includes('£90,071,992,547,409.93'));
  for (const text of ['Original amount', 'Allocated', 'Unapplied', 'sm:grid-cols-3']) assert.ok(summary.includes(text));
});

test('allocation rows retain original document links, exact amounts and accessible decimal inputs', () => {
  const documents = [{ id: 'bill-1', kind: 'purchase_bill', number: 'SYNTHETIC-B1', due_date: '2026-11-01', open_minor: '12345' }];
  const form = { kind: 'allocation', allocations: { 'bill-1': '12.34' } };
  const html = render(<PaymentAllocations documents={documents} form={form} />);
  for (const text of ['/bills/bill-1', '£123.45', 'for="allocate-bill-1"', 'id="allocate-bill-1"', 'inputMode="decimal"', 'value="12.34"']) assert.ok(html.includes(text), text);
  const undo = render(<PaymentAllocations documents={documents} form={{ ...form, kind: 'unallocation', payment: { allocation_balances: [{ document_id: 'bill-1', amount_minor: '5000' }] } }} />);
  assert.ok(undo.includes('£50.00'));
  assert.ok(undo.includes('Amounts to unallocate'));
});

test('statement movements preserve source/journal links and separate document and unapplied balances on both layouts', () => {
  const html = render(<StatementMovements rows={[{ source_id: 'event-1', source_type: 'accounting_payment_event', payment_kind: 'unallocation', number: 'SYNTHETIC-UNDO', date: '2026-10-30', balance_effect_minor: '1000', unapplied_effect_minor: '1000', running_balance_minor: '5000', running_unapplied_minor: '3000', journal_id: 'journal-1' }]} />);
  for (const text of ['/payments?event=event-1', '/accounting/journals/journal-1', 'Document change', 'Unapplied change', 'Document balance', 'Unapplied balance', '£10.00', '£50.00', '£30.00', 'tabindex="0"']) assert.ok(html.includes(text), text);
});

test('statement empty state retains opening-balance context without pretending the account is settled', () => {
  const html = render(<StatementMovements rows={[]} />);
  assert.ok(html.includes('No movements in this period'));
  assert.ok(html.includes('opening balances are retained'));
  assert.ok(!html.includes('settled'));
});
