import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import NativeBankStatements from './NativeBankStatements';

const client = new Proxy({}, { get: () => () => new Promise(() => {}) });
const mem = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k), m }; };
const render = storage => renderToStaticMarkup(<MemoryRouter><NativeBankStatements company={{ id: 'c1', name: 'Harbour & Finch Ltd' }} client={client} storage={storage} onOpenLegacy={() => {}} /></MemoryRouter>);

test('initial render shows skeleton, explicit legacy entry and payment guidance', () => {
  const html = render(mem());
  assert.match(html, /Legacy review\/history/);
  assert.match(html, /Harbour &amp; Finch Ltd/);
  assert.match(html, /aria-busy="true"/);
  assert.doesNotMatch(html, /Retry exact request/);
});

test('a pending intent for this company is surfaced for recovery, not resubmitted', () => {
  const s = mem();
  s.setItem('ledgerpoint:bank-statements:pending:c1:match', JSON.stringify({ body: { request_id: 'req-7', amount_minor: '100' } }));
  s.setItem('ledgerpoint:bank-statements:pending:other:import', JSON.stringify({ body: { request_id: 'req-x', rows: [] } }));
  const html = render(s);
  assert.match(html, /payment match was sent but its outcome is not yet confirmed \(request req-7\)/);
  assert.doesNotMatch(html, /req-x/);
  assert.match(html, /Check outcome/);
});

test('a pending correction is surfaced for recovery and blocks new corrections', () => {
  const s = mem();
  s.setItem('ledgerpoint:bank-statements:pending:c1:correction', JSON.stringify({ body: { request_id: 'cor-3', match_request_id: 'm1', reason: 'x', review_token: 't' } }));
  const html = render(s);
  assert.match(html, /unmatch correction was sent but its outcome is not yet confirmed \(request cor-3\)/);
  assert.match(html, /No new correction can be started/);
  assert.doesNotMatch(html, /Retry exact request/);
});
