import test from 'node:test';
import assert from 'node:assert/strict';
import { poundsToPence, replacementInput, isUnknownOutcome, readPending, writePending, clearPending, recoveredReceipt, versionLabel } from './model.mjs';
import { createAccountingClient } from '../../api/accountingDocuments.mjs';

const form = { agreement_id: 'a', agreement_date: '2026-11-01', payment_deadline: '2026-11-30', discount: '12.30', evidence_text: 'Email of 1 Nov', attested: true };
test('pence are exact and explicit; no scaling or float rounding', () => {
  assert.equal(poundsToPence('12.3'), '1230'); assert.equal(poundsToPence('0.01'), '1');
  for (const v of ['0', '1.001', '-1', '1e2', '', 'abc']) assert.throws(() => poundsToPence(v));
});
test('append body uses reviewed predecessor, explicit attestation and only whitelisted fields', () => {
  const b = replacementInput({ kind: 'purchase_bill', partyId: 'p', history: { consumed: false, current_replacement_id: 'r1' }, form, requestId: 'q' });
  assert.deepEqual(Object.keys(b).sort(), ['attested', 'evidence_text', 'predecessor_id', 'request_id', 'terms']);
  assert.equal(b.predecessor_id, 'r1'); assert.equal(b.terms.party_type, 'supplier'); assert.equal(b.terms.discount_gross_pence, '1230');
  assert.equal(replacementInput({ kind: 'sales_invoice', partyId: 'p', history: { consumed: false, current_replacement_id: null }, form, requestId: 'q' }).predecessor_id, null);
  assert.throws(() => replacementInput({ kind: 'sales_invoice', partyId: 'p', history: { consumed: false }, form: { ...form, attested: false }, requestId: 'q' }), /Confirm/);
  assert.throws(() => replacementInput({ kind: 'sales_invoice', partyId: 'p', history: { consumed: true }, form, requestId: 'q' }), /cannot be replaced/);
  assert.throws(() => replacementInput({ kind: 'sales_credit_note', partyId: 'p', history: { consumed: false }, form, requestId: 'q' }));
  assert.throws(() => replacementInput({ kind: 'sales_invoice', partyId: 'p', history: { consumed: false }, form: { ...form, payment_deadline: '2026-10-01' }, requestId: 'q' }));
});
test('unknown outcome only when no trustworthy reply', () => {
  assert.equal(isUnknownOutcome(new TypeError('fetch failed')), true);
  assert.equal(isUnknownOutcome({ status: 504 }), true);
  assert.equal(isUnknownOutcome({ status: 500, code: 'ACCOUNTING_OPERATION_FAILED' }), true);
  assert.equal(isUnknownOutcome({ status: 409, code: 'CONDITIONAL_REPLACEMENT_STALE' }), false);
  assert.equal(isUnknownOutcome({ status: 503, code: 'CONDITIONAL_REPLACEMENT_SCHEMA_UNAVAILABLE' }), false);
  assert.equal(isUnknownOutcome(Object.assign(new Error('x'), { name: 'AbortError' })), true);
});
test('pending request is company and document scoped', () => {
  const m = new Map(); const s = { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) };
  writePending(s, 'c1', 'd1', { request_id: 'q' });
  assert.equal(readPending(s, 'c1', 'd1').body.request_id, 'q');
  assert.equal(readPending(s, 'c2', 'd1'), null); assert.equal(readPending(s, 'c1', 'd2'), null);
  clearPending(s, 'c1', 'd1'); assert.equal(readPending(s, 'c1', 'd1'), null);
});
test('recovery confirms only from history; labels distinguish states', () => {
  assert.equal(recoveredReceipt({ replacements: [{ request_id: 'q', id: 'r' }] }, 'q').id, 'r');
  assert.equal(recoveredReceipt({ replacements: [] }, 'q'), null);
  assert.equal(versionLabel({ current: true, observation: { state: 'unobserved' } }), 'Current · not yet observed');
  assert.equal(versionLabel({ current: false, observation: { state: 'observed' } }), 'Superseded · observed');
  assert.equal(versionLabel({ current: false, observation: { state: 'unobserved' } }), 'Superseded · never observed');
});
test('client uses company-scoped endpoints and exposes no redemption/commit method', async () => {
  const calls = [];
  const c = createAccountingClient(async (url, o) => { calls.push({ url, ...o }); return { ok: true, json: async () => ({ data: {} }) }; });
  await c.replacementHistory('co', 'doc'); await c.appendReplacement('co', 'doc', { request_id: 'q' }); await c.observeReplacement('co', 'doc', 'r');
  assert.deepEqual(calls.map(x => [x.method, x.url]), [
    ['GET', '/api/companies/co/accounting-documents/doc/conditional-replacements'],
    ['POST', '/api/companies/co/accounting-documents/doc/conditional-replacements'],
    ['POST', '/api/companies/co/accounting-documents/doc/conditional-replacements/r/observe']]);
  assert.ok(calls.every(x => x.credentials === 'include'));
  for (const k of Object.keys(c)) assert.doesNotMatch(k, /redeem|commitReplacement|commitCompensation|conditionalPost/i);
});
