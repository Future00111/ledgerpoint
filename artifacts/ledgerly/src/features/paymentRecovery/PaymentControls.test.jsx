import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { PaymentToolbar, PaymentHistoryActions, PaymentEventHistory, PaymentRecoveryPanel } from './PaymentControls';

const owner = { configure_payments: true, post_payments: true };
const admin = { configure_payments: true, post_payments: false };
const viewer = { configure_payments: false, post_payments: false };
const payment = { amount_minor: '15000', allocated_minor: '5000', unapplied_minor: '10000', refunded_minor: '0', reversed: false };
const state = { phase: 'unknown', check: 'not_found', body: { id: 'synthetic-event', reference: 'Synthetic receipt', amount_minor: '15000' } };
const render = element => renderToStaticMarkup(<MemoryRouter>{element}</MemoryRouter>);

test('only owner/accountant posting capabilities expose recording and settlement write actions', () => {
  const allowed = render(<><PaymentToolbar capabilities={owner} ready /><PaymentHistoryActions capabilities={owner} payment={payment} /></>);
  for (const action of ['Payment setup', 'Record payment', 'Allocate', 'Undo allocation', 'Record refund', 'Reverse payment']) assert.ok(allowed.includes(action), action);
  for (const capabilities of [viewer, null, {}, { post_payments: 'true' }]) {
    const readonly = render(<><PaymentToolbar capabilities={capabilities} ready /><PaymentHistoryActions capabilities={capabilities} payment={payment} /></>);
    assert.ok(!readonly.includes('<button'), 'Read-only or unknown capabilities expose no write controls');
  }
  const setupOnly = render(<><PaymentToolbar capabilities={admin} ready /><PaymentHistoryActions capabilities={admin} payment={payment} /></>);
  assert.ok(setupOnly.includes('Payment setup'));
  assert.ok(!setupOnly.includes('Record payment'));
  assert.ok(!setupOnly.includes('Record refund'));
});

test('settlement actions preserve existing unapplied, allocation, refund and reversal constraints', () => {
  const disabled = render(<PaymentHistoryActions capabilities={owner} payment={payment} disabled />);
  assert.equal((disabled.match(/disabled=""/g) || []).length, 4);
  const partial = render(<PaymentHistoryActions capabilities={owner} payment={payment} />);
  assert.match(partial, /<button[^>]*disabled=""[^>]*>Reverse payment<\/button>/);
  const refunded = render(<PaymentHistoryActions capabilities={owner} payment={{ ...payment, allocated_minor: '0', unapplied_minor: '15000', refunded_minor: '1000' }} />);
  assert.match(refunded, /<button[^>]*disabled=""[^>]*>Reverse payment<\/button>/);
  assert.equal(render(<PaymentHistoryActions capabilities={owner} payment={{ ...payment, reversed: true }} />), '');
});

test('all payment event kinds retain dates, amounts and journal links for read-only history', () => {
  const kinds = ['payment', 'allocation', 'unallocation', 'refund', 'reversal'];
  const events = kinds.map(kind => ({ id: kind, kind, effective_date: '2026-10-30', reference: `Synthetic ${kind}`, amount_minor: '15000', journal_id: `journal-${kind}` }));
  const html = render(<PaymentEventHistory events={events} labels={Object.fromEntries(kinds.map(kind => [kind, kind]))} />);
  for (const kind of kinds) {
    assert.ok(html.includes(`Synthetic ${kind}`));
    assert.ok(html.includes(`/accounting/journals/journal-${kind}`));
  }
  assert.equal((html.match(/£150\.00/g) || []).length, 5);
  assert.ok(!html.includes('<button'));
});

test('unknown outcome offers explicit read and same-payment retry without edit or success claims', () => {
  const html = render(<PaymentRecoveryPanel state={state} capabilities={owner} />);
  for (const text of ['Payment outcome not yet confirmed', 'Check payment status', 'Retry same payment', 'synthetic-event', '£150.00', 'outcome remains unknown', 'saved reference supports status checks only']) assert.ok(html.includes(text), text);
  for (const text of ['Back to edit', 'Confirm and record', 'Payment event recorded']) assert.ok(!html.includes(text));
  const unsafeMessage = render(<PaymentRecoveryPanel state={{ ...state, error: { code: 'ACCOUNTING_OPERATION_FAILED', message: 'No changes were committed.' } }} capabilities={owner} />);
  assert.ok(!unsafeMessage.includes('No changes were committed'));
  assert.ok(unsafeMessage.includes('does not establish whether the original recording succeeded'));
});

test('status can still be checked with read permission while retry requires posting permission', () => {
  for (const capabilities of [admin, viewer, null]) {
    const html = render(<PaymentRecoveryPanel state={state} capabilities={capabilities} />);
    assert.ok(html.includes('Check payment status'));
    assert.ok(!html.includes('Retry same payment'));
  }
  const pending = render(<PaymentRecoveryPanel state={{ ...state, phase: 'checking' }} capabilities={owner} />);
  assert.equal((pending.match(/disabled=""/g) || []).length, 2);
});

test('unknown outcomes cannot be discarded and restored references are read-only', () => {
  const html = render(<PaymentRecoveryPanel state={state} capabilities={owner} closing />);
  assert.ok(!html.includes('Close view'));
  const restored=render(<PaymentRecoveryPanel state={{...state,body:{id:'synthetic-event'},readOnly:true}} capabilities={owner}/>);
  assert.ok(restored.includes('Only status checks'));assert.ok(!restored.includes('Retry same payment'));assert.ok(!restored.includes('£'));
  assert.equal(render(<PaymentRecoveryPanel state={{ ...state, phase: 'recorded' }} capabilities={owner} />), '');
});
