import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import SetupWorkspace from './SetupWorkspace';
import { deriveReadiness } from './model.mjs';
import { fixture, DATE } from './fixtures.mjs';

const render = (contexts, props = {}) => renderToStaticMarkup(<MemoryRouter><SetupWorkspace company={contexts.sales.company}
  readiness={deriveReadiness('synthetic-company', contexts, DATE)} date={DATE} onDateChange={() => {}} onRefresh={() => {}} onGuidedChange={() => {}} {...props} /></MemoryRouter>);
const links = html => [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);

test('professional and explained views preserve native first tasks and full accounting links', () => {
  const data = fixture(), professional = render(data), guided = render(data, { guided: true });
  assert.deepEqual(links(guided), links(professional));
  for (const route of ['/invoices/new', '/bills/new', '/customers', '/suppliers', '/accounting/setup', '/chart-of-accounts', '/awaiting-credits', '/payments', '/reports', '/documents', '/']) assert.ok(links(professional).includes(route));
  assert.match(professional, /Show explanations/); assert.match(guided, /Hide explanations/);
  assert.match(professional, /min="1900-01-01"/); assert.match(professional, /max="2199-12-31"/);
  assert.match(guided, /Historical VAT returns and settings/);
  assert.match(professional, /Saving a draft does not post, send or pay it/);
  assert.equal(/Setup complete|All set|Finish setup|Import ready/.test(professional), false);
});

test('read-only users get browse paths without document create or manage-contact claims', () => {
  const data = fixture(); data.sales.capabilities = {}; data.purchases.capabilities = {};
  const html = render(data);
  assert.ok(links(html).includes('/invoices')); assert.ok(links(html).includes('/bills'));
  assert.equal(links(html).includes('/invoices/new'), false); assert.equal(links(html).includes('/bills/new'), false);
  assert.match(html, /View customers/); assert.match(html, /View suppliers/);
  assert.equal(html.includes('Manage customers'), false); assert.match(html, /Posting permission: not granted/);
});

test('loading or failed refresh hides previously supplied readiness and create actions', () => {
  for (const state of [{ loading: true }, { error: new Error('Access could not be verified') }]) {
    const html = render(fixture(), state);
    assert.equal(html.includes('setup-check-tax'), false); assert.equal(links(html).includes('/invoices/new'), false);
  }
  const failure = render(fixture(), { error: new Error('Access could not be verified') });
  assert.match(failure, /role="alert"/); assert.match(failure, /Retry checks/);
});

test('missing non-VAT rule is actionable and does not masquerade as successful setup', () => {
  const data = fixture(); data.sales.tax_rules = []; data.purchases.tax_rules = [];
  const html = render(data, { guided: true });
  assert.match(html, /Not VAT registered/); assert.match(html, /Zero-rated sales are a different treatment/);
  assert.match(html, /Needs attention/); assert.ok(links(html).includes('/vat'));
  assert.equal(links(html).includes('/invoices/new'), false);
});
