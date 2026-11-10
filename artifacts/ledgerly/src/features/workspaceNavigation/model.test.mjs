import test from 'node:test';
import assert from 'node:assert/strict';
import { SIDEBAR_KEY, SHORTCUTS, readCollapsed, rememberCollapsed, sidebarMode, workspacePermissions, availableShortcuts,
  currentWorkspaceState, loadWorkspaceCapabilities, visibleSections, navigationGroups, moveWidget, restoreNavigationFocus } from './model.mjs';
import { SECTIONS, EVERYDAY_ROUTES, allItems, findActiveItem } from '../../components/layout/navConfig.js';
const company = 'synthetic-company';
const configuration = { company_id: company, revision: 'reviewed-revision', mappings: { bank: 'bank', customer_credit: 'credit', supplier_prepayment: 'prepayment' } };
const state = (drafts = true, payments = true) => ({ key: 'scope-1', companyId: company, loading: false,
  documents: { company: { id: company }, capabilities: { edit_drafts: drafts } },
  payments: { capabilities: { post_payments: payments }, configuration } });

test('tablet collapse and opening mobile navigation do not overwrite the saved desktop preference', () => {
  const entries = new Map([[SIDEBAR_KEY, '0']]);
  const storage = { getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value) };
  const preference = readCollapsed(storage);
  assert.equal(sidebarMode(1280, preference).collapsed, false);
  assert.deepEqual(sidebarMode(800, preference), { rail: true, collapsed: true, tablet: true });
  assert.equal(sidebarMode(375, preference).rail, false);
  assert.equal(readCollapsed(storage), false);
  assert.equal(sidebarMode(1280, preference).collapsed, false);
  rememberCollapsed(storage, true);
  assert.equal(readCollapsed(storage), true);
  assert.equal(sidebarMode(1440, readCollapsed(storage)).collapsed, true);
  assert.equal(sidebarMode(767, false).rail, false);
  assert.equal(sidebarMode(768, false).rail, true);
  assert.equal(sidebarMode(1024, false).tablet, false);
});

test('storage denial is harmless to shell navigation', () => {
  const storage = { getItem() { throw Error('Unavailable'); }, setItem() { throw Error('Unavailable'); } };
  assert.equal(readCollapsed(storage), false);
  assert.doesNotThrow(() => rememberCollapsed(storage, true));
});

test('creation shortcuts use exact server capability facts, with payment setup independently gated', () => {
  assert.deepEqual(availableShortcuts(company, state()).map(item => item.path), SHORTCUTS.map(item => item.path));
  assert.equal(availableShortcuts(company, state(true, false)).some(item => item.id === 'payment'), false);
  assert.deepEqual(availableShortcuts(company, state(false, true)).map(item => item.path), ['/payments?new=payment']);
  assert.deepEqual(availableShortcuts(company, state(false, false)), []);
  assert.equal(availableShortcuts(company, state('true', 'true')).length, 0);
  for (const cfg of [null, { ...configuration, company_id: 'another-company' }, { ...configuration, revision: null }, { ...configuration, mappings: { bank: 'bank' } }]) {
    assert.equal(workspacePermissions(company, { ...state(), payments: { ...state().payments, configuration: cfg } }).payments, false);
  }
});

test('company, role and request changes fail closed before new permissions load', () => {
  const current = state();
  assert.equal(currentWorkspaceState(current, company, 'scope-1'), current);
  for (const [companyId, key] of [['different-company', 'scope-1'], [company, 'new-role-scope'], [company, 'refresh-scope']]) {
    const selected = currentWorkspaceState(current, companyId, key);
    assert.equal(selected, null);
    assert.deepEqual(availableShortcuts(companyId, selected), []);
  }
  assert.deepEqual(availableShortcuts(company, { ...current, loading: true }), []);
  assert.deepEqual(availableShortcuts(undefined, current), []);
  assert.equal(workspacePermissions(company, { ...current, documents: { company: { id: 'other' }, capabilities: { edit_drafts: true } } }).drafts, false);
});

test('late permission reads are discarded after company change or abort; one failed capability domain does not grant it', async () => {
  let finishDocuments, finishPayments, current = true;
  const controller = new AbortController();
  const client = { context: () => new Promise(resolve => { finishDocuments = resolve; }), paymentContext: () => new Promise(resolve => { finishPayments = resolve; }) };
  const pending = loadWorkspaceCapabilities(client, company, controller.signal, () => current);
  current = false; finishDocuments(state().documents); finishPayments(state().payments);
  assert.equal(await pending, null);
  controller.abort();
  assert.equal(await loadWorkspaceCapabilities({ context: async () => state().documents, paymentContext: async () => state().payments }, company, controller.signal, () => true), null);
  const partial = await loadWorkspaceCapabilities({ context: async () => state().documents, paymentContext: async () => { throw Error('Unavailable'); } }, company, new AbortController().signal, () => true);
  assert.deepEqual(workspacePermissions(company, partial), { drafts: true, payments: false });
  assert.ok(partial.error);
});

test('feature search preserves all existing destinations and never reveals development routes without access', () => {
  const normal = visibleSections(SECTIONS, { showPlanned: true, companyRole: 'owner' });
  assert.deepEqual(normal.flatMap(section => section.items.filter(item => item.path).map(item => item.path)), allItems().filter(item => !item.devOnly && item.sectionKey !== 'dev' && item.path).map(item => item.path));
  assert.equal(visibleSections(SECTIONS, { query: 'development' }).length, 0);
  assert.equal(visibleSections(SECTIONS, { query: 'development', canDev: true })[0].key, 'dev');
  const credit = visibleSections(SECTIONS, { query: 'awaiting' }).flatMap(section => section.items);
  assert.deepEqual(credit.map(item => item.path), ['/awaiting-credits']);
  assert.ok(visibleSections(SECTIONS, { query: 'quotes' }).flatMap(section => section.items).every(item => item.soon && !item.path));
});

test('deep-link navigation matches the most specific existing route without sibling prefix confusion', () => {
  assert.equal(findActiveItem('/invoices/new').path, '/invoices');
  assert.equal(findActiveItem('/supplier-credit-notes/synthetic').path, '/supplier-credit-notes');
  assert.equal(findActiveItem('/reports/legacy').path, '/reports/legacy');
  assert.equal(findActiveItem('/general-ledger/manual-journals/synthetic').path, '/general-ledger/manual-journals');
  assert.equal(findActiveItem('/invoices-not-a-route'), null);
});

test('keyboard widget movement preserves dimensions, hidden entries, pinned identities and other sections', () => {
  const layout = [{ id: 'a', w: 1, h: 2, collapsed: true }, { id: 'hidden', hidden: true, w: 3 }, { id: 'other', w: 2 }, { id: 'b', w: 2, h: 1, core: true }];
  const sectionOf = id => id === 'other' ? 'other-section' : 'main';
  const moved = moveWidget(layout, 'b', -1, sectionOf);
  assert.deepEqual(moved.map(item => item.id), ['b', 'hidden', 'other', 'a']);
  assert.equal(moved[0], layout[3]); assert.equal(moved[3], layout[0]);
  assert.equal(moved[1], layout[1]); assert.equal(moved[2], layout[2]);
  assert.deepEqual(layout.map(item => item.id), ['a', 'hidden', 'other', 'b']);
  assert.equal(moveWidget(layout, 'a', -1, sectionOf), layout);
  assert.equal(moveWidget(layout, 'b', 1, sectionOf), layout);
  assert.equal(moveWidget(layout, 'hidden', 1, sectionOf), layout);
  assert.equal(moveWidget(layout, 'missing', 1, sectionOf), layout);
  assert.equal(moveWidget(layout, 'a', 2, sectionOf), layout);
});

test('closing navigation restores its real opener and falls back to the workspace after a responsive unmount', () => {
  const calls = [];
  const opener = { isConnected: true, getClientRects: () => [{}], focus: () => calls.push('opener') };
  const main = { focus: () => calls.push('main') };
  restoreNavigationFocus(opener, main);
  restoreNavigationFocus({ ...opener, isConnected: false }, main);
  restoreNavigationFocus({ ...opener, getClientRects: () => [] }, main);
  restoreNavigationFocus(null, main);
  assert.deepEqual(calls, ['opener', 'main', 'main', 'main']);
});


test('daily navigation keeps its seven direct routes and partitions the entire catalogue without loss or duplicates', () => {
  const groups = navigationGroups(SECTIONS, EVERYDAY_ROUTES, { canDev: true, showPlanned: true, companyRole: 'owner' });
  assert.deepEqual(groups.everyday.map(item => item.path), ['/', '/documents', '/invoices', '/bills', '/awaiting-credits', '/payments', '/reports']);
  const actual = [...groups.everyday, ...groups.more.flatMap(section => section.items)];
  const paths = actual.filter(item => item.path).map(item => item.path);
  assert.deepEqual([...paths].sort(), allItems().filter(item => item.path).map(item => item.path).sort());
  assert.equal(new Set(paths).size, paths.length);
  assert.deepEqual(actual.filter(item => item.soon).map(item => item.label).sort(), allItems().filter(item => item.soon).map(item => item.label).sort());
});

test('navigation searches the whole catalogue and retains development and planned restrictions', () => {
  const credit = navigationGroups(SECTIONS, EVERYDAY_ROUTES, { query: 'awaiting' });
  assert.deepEqual(credit.everyday, []);
  assert.deepEqual(credit.more.flatMap(section => section.items).map(item => item.path), ['/awaiting-credits']);
  const ordinary = navigationGroups(SECTIONS, EVERYDAY_ROUTES);
  assert.ok(ordinary.more.every(section => !section.devOnly));
  assert.ok(ordinary.more.flatMap(section => section.items).every(item => !item.soon));
  assert.equal(navigationGroups(SECTIONS, EVERYDAY_ROUTES, { query: 'development' }).more.length, 0);
  assert.equal(navigationGroups(SECTIONS, EVERYDAY_ROUTES, { query: 'development', canDev: true }).more[0].key, 'dev');
});


test('new everyday names remain discoverable through feature search', () => {
  for (const [query, path] of [['today', '/'], ['document inbox', '/documents']]) {
    const groups = navigationGroups(SECTIONS, EVERYDAY_ROUTES, { query });
    assert.ok(groups.more.flatMap(section => section.items).some(item => item.path === path));
  }
});

test('audit navigation and search respect the active company role and hide while membership is unavailable', () => {
  for (const companyRole of [undefined, null, 'viewer', 'staff', 'unknown']) {
    for (const query of ['', 'audit']) {
      const groups = navigationGroups(SECTIONS, EVERYDAY_ROUTES, { companyRole, query, showPlanned: true, canDev: true });
      assert.ok(![...groups.everyday, ...groups.more.flatMap(section => section.items)].some(item => item.path === '/audit-history'));
    }
  }
  for (const companyRole of ['owner', 'admin', 'accountant']) {
    assert.ok(navigationGroups(SECTIONS, EVERYDAY_ROUTES, { companyRole, query: 'audit' }).more.flatMap(section => section.items).some(item => item.path === '/audit-history'));
  }
});
