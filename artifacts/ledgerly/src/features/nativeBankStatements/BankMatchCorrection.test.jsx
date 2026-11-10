import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { CorrectionPanel, MatchReceiptRow } from './BankMatchCorrection';
import { pendingStore } from './model.mjs';

const m = { request_id: 'm1', bank_transaction_id: 's1', payment_id: 'p1', amount_minor: '1250', journal_id: 'j1', active: true };
const r = el => renderToStaticMarkup(<MemoryRouter>{el}</MemoryRouter>);

test('active receipt shows unmatch only for writers', () => {
  assert.match(r(<MatchReceiptRow match={m} paymentLabel="INV-9" canWrite onOpen={() => {}} />), /button-correct-m1/);
  assert.doesNotMatch(r(<MatchReceiptRow match={m} paymentLabel="INV-9" canWrite={false} onOpen={() => {}} />), /button-correct-m1/);
});

test('corrected receipt keeps original and shows correction history', () => {
  const html = r(<MatchReceiptRow match={{ ...m, active: false, correction_request_id: 'c9', corrected_at: '2026-11-05T10:00:00Z', correction_reason: 'Wrong customer', correction_actor: 'Priya' }} paymentLabel="INV-9" canWrite onOpen={() => {}} />);
  assert.match(html, /Corrected/); assert.match(html, /Wrong customer/); assert.match(html, /Priya/); assert.match(html, /c9/);
  assert.match(html, /\/accounting\/journals\/j1/);
  assert.doesNotMatch(html, /button-correct-m1/);
});

test('panel asks for reason, review before confirm, no date input', () => {
  const html = r(<CorrectionPanel companyId="c" match={m} paymentLabel="INV-9" client={{}} store={pendingStore(null)} onClose={() => {}} onRecorded={() => {}} />);
  assert.match(html, /Review unmatch/); assert.match(html, /Cancel/);
  assert.doesNotMatch(html, /Confirm unmatch/); assert.doesNotMatch(html, /type="date"/);
  assert.match(html, /£12\.50/);
});
