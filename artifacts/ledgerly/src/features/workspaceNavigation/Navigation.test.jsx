import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { DailyWorkLinks } from './DailyWork';
const render = (node, route = '/') => renderToStaticMarkup(<MemoryRouter initialEntries={[route]}>{node}</MemoryRouter>);

test('closed navigation sheet renders no hidden focusable menu entries', () => {
  const html = render(<Sheet open={false}><SheetContent side="left"><SheetTitle>Workspace navigation</SheetTitle><SheetDescription>Choose a feature</SheetDescription><a href="/invoices">Invoices</a><button>Switch company</button></SheetContent></Sheet>);
  assert.equal(html.includes('href="/invoices"'), false);
  assert.equal(html.includes('Switch company'), false);
  assert.equal(html.includes('role="dialog"'), false);
});

test('daily capture and awaiting-credit routes stay available without suggesting unauthorized writes', () => {
  const readonly = render(<DailyWorkLinks />);
  assert.ok(readonly.includes('href="/documents"'));
  assert.ok(readonly.includes('href="/awaiting-credits"'));
  assert.ok(readonly.includes('Supplier source files'));
  assert.equal(readonly.includes('Upload invoices'), false);
  const writable = render(<DailyWorkLinks canPrepare />);
  assert.ok(writable.includes('Upload invoices &amp; credits'));
  assert.equal(writable.includes('extracted'), false);
});

test('breadcrumbs retain document parent navigation and mark the current view', () => {
  const html = render(<Breadcrumbs />, '/supplier-credit-notes/synthetic-id');
  assert.ok(html.includes('aria-label="Breadcrumb"'));
  assert.ok(html.includes('href="/supplier-credit-notes"'));
  assert.match(html, /aria-current="page"[^>]*>Details/);
  const root = render(<Breadcrumbs />);
  assert.match(root, /aria-current="page"[^>]*>Overview/);
});
