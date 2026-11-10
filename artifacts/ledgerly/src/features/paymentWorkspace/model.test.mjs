import { paymentFormContextPending } from './model.mjs';
test('open payment survives context invalidation during outcome refresh without rendering null parties', () => {
  const form = { id: 'same-request', party_type: 'supplier' };
  assert.equal(paymentFormContextPending(form, null), true);
  assert.equal(paymentFormContextPending(form, { suppliers: [], capabilities: {} }), false);
  assert.equal(paymentFormContextPending(null, null), false);
  assert.equal(form.id, 'same-request');
});
import test from 'node:test';
import assert from 'node:assert/strict';
import { filterPayments, statementPath, createPaymentShortcutGate, clearPaymentShortcut, statementDateError, statementPeriod, loadStatementParties, selectedStatementParty, retryStatementReads, statementCsvRows } from './model.mjs';
import { csv } from '../../lib/ledgerCsv.mjs';

const payments = [
  { id: 'customer-payment', party_type: 'customer', source: { party_name: 'Synthetic Garage' }, reference: 'RECEIPT-19', unapplied_minor: '9007199254740993' },
  { id: 'supplier-payment', party_type: 'supplier', source: { party_name: 'Synthetic Parts' }, reference: 'BANK-20', unapplied_minor: '0' },
  { id: 'supplier-prepayment', party_type: 'supplier', source: { party_name: 'Synthetic Parts' }, reference: 'BANK-21', unapplied_minor: '1' },
];
const ids = rows => rows.map(row => row.id);
const ready = { entry: 'entry-1', intent: 'payment', contextLoaded: true, canPost: true, configured: true, ledgerReady: true, busy: false, unresolved: false, formOpen: false };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('payment filters combine party/reference, direction and exact unapplied pence without mutating rows', () => {
  const before = structuredClone(payments);
  assert.deepEqual(ids(filterPayments(payments, { search: '  gArAgE  ' })), ['customer-payment']);
  assert.deepEqual(ids(filterPayments(payments, { search: 'bank-', direction: 'paid', balance: 'unapplied' })), ['supplier-prepayment']);
  assert.deepEqual(ids(filterPayments(payments, { direction: 'received', balance: 'unapplied' })), ['customer-payment']);
  assert.deepEqual(ids(filterPayments(payments, { search: 'BANK-20', balance: 'unapplied' })), []);
  assert.deepEqual(filterPayments(payments), before);
  assert.deepEqual(payments, before);
});

test('statement links require a party of the correct type in the currently loaded company context', () => {
  const context = { customers: [{ id: 'customer/a' }], suppliers: [{ id: 'supplier-b' }] };
  assert.equal(statementPath(context, { party_type: 'customer', party_id: 'customer/a' }), '/statements?party_id=customer%2Fa');
  assert.equal(statementPath(context, { party_type: 'supplier', party_id: 'supplier-b' }), '/statements?party_id=supplier-b');
  for (const party of [{ party_type: 'supplier', party_id: 'customer/a' }, { party_type: 'customer', party_id: 'another-company' }, { party_type: 'unknown', party_id: 'supplier-b' }]) assert.equal(statementPath(context, party), null);
  assert.equal(statementPath(null, { party_type: 'supplier', party_id: 'supplier-b' }), null);
});

test('payment shortcut waits for verified permission, setup and current ledger before one opening', () => {
  const gate = createPaymentShortcutGate();
  for (const changed of [{ contextLoaded: false }, { configured: false }, { ledgerReady: false }, { busy: true }]) assert.equal(gate.take({ ...ready, ...changed }), 'wait');
  assert.equal(gate.take(ready), 'open');
  assert.equal(gate.take(ready), 'discard');
  assert.equal(gate.take({ ...ready, entry: 'entry-2' }), 'open');
  assert.equal(gate.take({ ...ready, entry: 'entry-3', intent: 'refund' }), 'none');
});

test('unresolved outcomes, existing forms and denied roles consume shortcuts without creating a new payment', () => {
  for (const blocked of [{ unresolved: true }, { formOpen: true }, { canPost: false }]) {
    const gate = createPaymentShortcutGate();
    assert.equal(gate.take({ ...ready, ...blocked }), 'discard');
    assert.equal(gate.take(ready), 'discard', 'Finishing the old form must not open a deferred new payment');
  }
});

test('consumed shortcut URL cannot reopen after close, refresh or a remount and keeps existing deep-link parameters', () => {
  const original = new URLSearchParams('new=payment&document=bill-1&party_id=supplier-1&party_type=supplier&event=allocation-1');
  const consumed = clearPaymentShortcut(original);
  assert.equal(original.get('new'), 'payment');
  assert.equal(consumed.has('new'), false);
  for (const key of ['document', 'party_id', 'party_type', 'event']) assert.equal(consumed.get(key), original.get(key));
  assert.equal(createPaymentShortcutGate().take({ ...ready, intent: consumed.get('new') }), 'none');
});

test('statement dates reject incomplete, reversed and impossible ranges before a ledger read or export', () => {
  assert.equal(statementDateError('2026-10-01', '2026-10-31'), null);
  assert.equal(statementDateError('2024-02-29', '2024-02-29'), null);
  for (const [from, to] of [['', '2026-10-31'], ['2026-02-29', '2026-03-01'], ['2026-11-01', '2026-10-31'], ['2026-10-31', 'invalid']]) assert.ok(statementDateError(from, to));
});

test('statement links preserve a reports closing-date basis and later URL period changes', () => {
  const defaults = { from: '2026-01-01', to: '2026-10-30' };
  assert.deepEqual(statementPeriod(new URLSearchParams('party_id=party-a'), defaults), defaults);
  const closing = statementPeriod(new URLSearchParams('party_id=party-a&from=0001-01-01&to=2026-09-30'), defaults);
  assert.deepEqual(closing, { from: '0001-01-01', to: '2026-09-30' });
  assert.equal(statementDateError(closing.from, closing.to), null);
  assert.deepEqual(statementPeriod(new URLSearchParams('party_id=party-a&from=2026-10-01&to=2026-10-31'), defaults), { from: '2026-10-01', to: '2026-10-31' });
  assert.ok(statementDateError(statementPeriod(new URLSearchParams('from='), defaults).from, defaults.to));
});

test('late party lookup success or failure is ignored on company switch and retry cancellation', async () => {
  for (const outcome of ['success', 'failure']) {
    const old = deferred(), events = [];
    const request = loadStatementParties('company-a', { paymentContext: async (company, signal) => { assert.equal(company, 'company-a'); assert.equal(signal.aborted, false); return old.promise; } }, {
      success: value => events.push(value), failure: error => events.push(error),
    });
    await Promise.resolve(); request.cancel();
    const current = loadStatementParties('company-b', { paymentContext: async () => ({ customers: [{ id: 'b-customer' }], suppliers: [] }) }, {
      success: value => events.push(value), failure: error => events.push(error),
    });
    await current.promise;
    if (outcome === 'success') old.resolve({ customers: [{ id: 'old-customer' }], suppliers: [] }); else old.reject(new Error('Old failure'));
    await request.promise;
    assert.deepEqual(events, [{ companyId: 'company-b', parties: [{ id: 'b-customer', type: 'customer' }] }]);
  }
});

test('party selection rejects old, loading, failed and out-of-company links', () => {
  const state = { companyId: 'company-a', parties: [{ id: 'customer', type: 'customer' }], loading: false, error: null };
  assert.equal(selectedStatementParty(state, 'company-a', 'customer').type, 'customer');
  assert.equal(selectedStatementParty(state, 'company-b', 'customer'), null);
  assert.equal(selectedStatementParty(state, 'company-a', 'other-party'), null);
  assert.equal(selectedStatementParty({ ...state, loading: true }, 'company-a', 'customer'), null);
  assert.equal(selectedStatementParty({ ...state, error: new Error('Unavailable') }, 'company-a', 'customer'), null);
});

test('statement retry attempts both sources independently even when either fails', async () => {
  for (const failSource of ['parties', 'ledger']) {
    const calls = [];
    const results = await retryStatementReads(() => { calls.push('parties'); if (failSource === 'parties') throw Error('Lookup unavailable'); }, async () => { calls.push('ledger'); if (failSource === 'ledger') throw Error('Ledger unavailable'); });
    assert.deepEqual(calls, ['parties', 'ledger']);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  }
});

test('malformed party data becomes a retryable lookup error without publishing accounts', async () => {
  const events = [];
  const request = loadStatementParties('company-a', { paymentContext: async () => ({ customers: null, suppliers: [] }) }, { success: value => events.push(value), failure: error => events.push(error) });
  await request.promise;
  assert.equal(events.length, 1); assert.ok(events[0] instanceof Error);
});

test('statement CSV retains exact signed amounts, opening balances and unapplied columns', () => {
  const statement = { opening: '9007199254740993', openingUnapplied: '3000', closing: '9007199254740893', unapplied: '1000', net: '9007199254739893', rows: [
    { date: '2026-10-30', number: '=SYNTHETIC', payment_kind: 'allocation', source_type: 'accounting_payment_event', balance_effect_minor: '-100', unapplied_effect_minor: '-2000', running_balance_minor: '9007199254740893', running_unapplied_minor: '1000' },
  ] };
  const exported = statementCsvRows({ companyName: 'Synthetic company', party: { name: 'Synthetic party' }, from: '2026-10-01', to: '2026-10-31', statement });
  assert.deepEqual(exported[4], ['2026-10-01', 'Opening balance', '', '', '', '90071992547409.93', '30.00']);
  assert.deepEqual(exported[5], ['2026-10-30', '=SYNTHETIC', 'allocation', '-1.00', '-20.00', '90071992547408.93', '10.00']);
  assert.deepEqual(exported[7], ['Net balance after unapplied credit/prepayment', '90071992547398.93']);
  const text = csv(exported);
  assert.ok(text.includes('"\'=SYNTHETIC"')); assert.ok(text.includes('"-1.00"'));
});
