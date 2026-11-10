// Disposable loopback harness only. Bundled by the PostgreSQL test, never by the app.
// Real component + native client + native routes; synthetic identity is explicit.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import DocumentCorrections from './DocumentCorrections';

const { company, documentId, foreignCompany, actor, reader } = window.syntheticFixture;
const nativeFetch = window.fetch.bind(window);
let user = actor, mode = '', refreshes = 0;
window.fetch = async (url, options = {}) => {
  if (typeof url !== 'string' || !url.startsWith('/api/companies/')) throw Error('Unexpected harness request');
  const headers = new Headers(options.headers); headers.set('x-test-actor', user);
  const commit = options.method === 'POST' && url.endsWith('/corrections');
  if (commit && mode === 'stale') headers.set('If-Match', '"10000000-0000-4000-8000-000000000099"');
  if (commit && mode === 'denied') headers.set('x-test-actor', reader);
  const result = await nativeFetch(url.slice(4), { ...options, headers });
  if (commit && mode === 'lost' && result.ok) {
    await result.json(); // Server committed; deliberately lose only its response.
    throw Error('Synthetic dropped response');
  }
  return result;
};
const root = createRoot(document.getElementById('root'));
const mount = (c = company) => root.render(<MemoryRouter><DocumentCorrections companyId={c} documentId={documentId} onSaved={() => refreshes++} /></MemoryRouter>);
const wait = async fn => {
  for (let i = 0; i < 240; i++) { if (fn()) return; await new Promise(r => setTimeout(r, 25)); }
  throw Error('Timed out: ' + fn.toString());
};
const button = text => [...document.querySelectorAll('button')].find(b => b.textContent === text);
const change = (el, value) => {
  Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const fill = async () => {
  await wait(() => document.querySelector('textarea'));
  change(document.querySelector('textarea'), 'Synthetic connected UI correction');
  change(document.querySelector('input[type=date]'), '2026-10-30');
  change(document.querySelector('[aria-label="Unit price for line 1"]'), '90');
  await new Promise(r => setTimeout(r, 30));
};
const review = async () => {
  button('Review revised amounts').click();
  await wait(() => button('Post correction'));
  if (!button('Post correction').disabled) throw Error('Posting without acknowledgement');
  document.querySelector('input[type=checkbox]').click();
  await wait(() => !button('Post correction').disabled);
};
const assert = (condition, message) => { if (!condition) throw Error(message); };
(async () => {
  mount();
  if (sessionStorage.getItem('correction-stage') === 'reload') {
    await wait(() => refreshes === 1);
    await wait(() => !new URL(location.href).searchParams.has('correction_request'));
    assert(!document.querySelector('textarea'), 'Confirmed recovery closes the editor');
    assert(refreshes === 1, 'Confirmed recovery refreshes the parent exactly once');
    // Same component instance, different company: keyed editor must not leak old context.
    button('Review corrections').click();
    await wait(() => document.querySelector('textarea'));
    assert(document.querySelector('[data-testid=link-journal]'), 'Missing recovered journal in history');
    mount(foreignCompany);
    await wait(() => document.querySelector('[role=alert]'));
    assert(!document.querySelector('textarea'), 'Old company form leaked');
    assert(!button('Post correction'), 'Old company commit leaked');
    user = reader; mount(company);
    await wait(() => document.getElementById('root').textContent.includes('current role'));
    assert(!button('Review revised amounts'), 'Read-only actor can review');
    assert(!button('Post correction'), 'Read-only actor can post');
    document.body.dataset.correctionAcceptance = 'passed';
    return;
  }
  await wait(() => button('Review corrections'));
  button('Review corrections').click();
  await fill(); await review();
  change(document.querySelector('[aria-label="Unit price for line 1"]'), '91');
  await wait(() => !button('Post correction'));
  assert(!document.querySelector('[aria-label="Reviewed correction"]'), 'Stale review retained');
  button('Close').click(); await wait(() => !document.querySelector('textarea'));
  button('Review corrections').click(); await fill();
  assert(!button('Post correction'), 'Cancelled review revived');
  for (const rejection of ['stale', 'denied']) {
    mode = rejection; await review(); button('Post correction').click();
    await wait(() => document.querySelector('[role=alert]'));
    assert(!new URL(location.href).searchParams.has('correction_request'), 'Rejected request locator retained');
    assert(!button('Post correction'), 'Rejected review remains postable');
    button('Retry').click(); await fill();
  }
  mode = 'lost'; await review(); button('Post correction').click();
  await wait(() => button('Check this correction again'));
  assert(button('Close').disabled, 'Unknown outcome can be discarded');
  assert(!button('Post correction'), 'Unknown outcome offers another post');
  assert(new URL(location.href).searchParams.has('correction_request'), 'Missing recovery locator');
  sessionStorage.setItem('correction-stage', 'reload');
  location.reload(); // Actual page reload; no automatic resubmission.
})().catch(error => {
  document.body.dataset.correctionAcceptance = 'failed';
  document.body.append(document.createTextNode(error.stack || error.message));
});
