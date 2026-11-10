import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReplacementHistory, ReplacementTermsReview, ReplacementRecovery } from './ConditionalReplacementPanel';

const terms = (p, id) => ({ version: 1, party_type: 'customer', party_id: 'p', currency: 'GBP', agreement_id: id, agreement_date: '2026-11-01', payment_deadline: '2026-11-30', discount_gross_pence: p });
const history = { consumed: false, current_replacement_id: 'r2', replacements: [
  { id: 'r1', position: 1, current: false, request_id: 'q1', recorded_at: 't1', observation: { state: 'observed', observed_at: 'o1' }, evidence: { terms: terms('500', 'a1'), evidence_text: 'First email' } },
  { id: 'r2', position: 2, current: true, request_id: 'q2', recorded_at: 't2', observation: { state: 'unobserved' }, evidence: { terms: terms('750', 'a2'), evidence_text: 'Second email' } }] };

test('history shows original, every version, current/superseded and observed/unobserved states without edit controls', () => {
  const html = renderToStaticMarkup(<ReplacementHistory original={terms('1000', 'a0')} history={history} />);
  for (const t of ['£10.00', '£5.00', '£7.50', 'Original agreement', 'superseded', 'Superseded · observed', 'Current · not yet observed', 'q1', 'q2', 'First email'])
    assert.ok(html.includes(t), t);
  assert.doesNotMatch(html, /<button|Delete|Edit/);
});
test('writer sees observation action only for current unobserved; consumed hides it', () => {
  assert.match(renderToStaticMarkup(<ReplacementHistory original={null} history={history} canObserve />), /Record observation/);
  assert.doesNotMatch(renderToStaticMarkup(<ReplacementHistory original={null} history={{ ...history, consumed: true }} canObserve />), /Record observation/);
});
test('terms review states non-scaling, no retrospective qualification and posting unavailable', () => {
  const html = renderToStaticMarkup(<ReplacementTermsReview body={{ request_id: 'req-9', terms: terms('1234', 'a3'), evidence_text: 'Call note' }} partyName="Harrow Joinery" />);
  for (const t of ['£12.34', 'not scaled', 'do not become qualifying', 'remains unavailable', 'req-9', 'Harrow Joinery']) assert.ok(html.includes(t), t);
});
test('recovery shows request reference and never claims success', () => {
  const html = renderToStaticMarkup(<ReplacementRecovery pending={{ body: { request_id: 'req-7' } }} />);
  assert.match(html, /req-7/); assert.match(html, /may or may not have been recorded/); assert.doesNotMatch(html, /Replacement \d* ?recorded|Success|is current/);
  assert.equal(renderToStaticMarkup(<ReplacementRecovery pending={null} />), '');
  assert.doesNotMatch(html, /Forget this request/);
});
test('read-only recovery never offers resubmission', () => {
  const html = renderToStaticMarkup(<ReplacementRecovery pending={{ body: { request_id: 'req-8' } }} outcome="absent" canWrite={false} />);
  assert.match(html, /no longer have permission/); assert.doesNotMatch(html, /Resubmit/);
  assert.match(renderToStaticMarkup(<ReplacementRecovery pending={{ body: { request_id: 'req-8' } }} outcome="absent" canWrite />), /Resubmit with the same reference/);
});
