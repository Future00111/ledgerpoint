import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import Breadcrumbs from '@/components/layout/Breadcrumbs';
import { DailyWorkLinks } from './DailyWork';
import { DailyTaskQueue } from './DailyTaskQueue';
import { NavigationLinks } from '@/components/layout/NavigationLinks';
import { SECTIONS, EVERYDAY_ROUTES } from '@/components/layout/navConfig';
import { navigationGroups } from './model.mjs';
import { FileText } from 'lucide-react';
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
  assert.match(root, /aria-current="page"[^>]*>Today/);
});


test('everyday destinations render as real links with one selected route and accessible collapsed labels', () => {
  const { everyday, more } = navigationGroups(SECTIONS, EVERYDAY_ROUTES);
  for (const collapsed of [false, true]) {
    const html = render(<NavigationLinks everyday={everyday} sections={more} activePath="/invoices" collapsed={collapsed} query="" onSectionClick={() => {}} />);
    for (const route of EVERYDAY_ROUTES) assert.ok(html.includes(`href="${route.path}"`));
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    assert.ok(html.includes('aria-label="Document inbox"'));
    assert.ok(html.includes('aria-label="Awaiting credits"'));
    assert.equal(html.includes('/dev-tools'), false);
  }
});

test('the daily task queue shows supplied counts and links without pretending tasks are complete', () => {
  const html = render(<DailyTaskQueue tasks={[
    { label: 'Overdue invoices', count: 2, detail: 'Follow up', to: '/invoices?status=overdue', icon: FileText, urgent: true },
    { label: 'Bill drafts', count: 3, detail: 'Review', to: '/bills?status=draft', icon: FileText },
  ]} />);
  assert.ok(html.includes('5 items'));
  assert.ok(html.includes('href="/invoices?status=overdue"'));
  assert.ok(html.includes('href="/bills?status=draft"'));
  assert.equal(html.includes('completed'), false);
  assert.equal(html.includes('href="/invoices/new"'), false);
});
