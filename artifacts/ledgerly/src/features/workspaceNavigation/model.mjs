export const SIDEBAR_KEY = 'lp.sidebar.collapsed';
export const SHORTCUTS = Object.freeze([
  { id: 'capture', label: 'Upload supplier files', path: '/documents', capability: 'drafts' },
  { id: 'invoice', label: 'Invoice', path: '/invoices/new', capability: 'drafts' },
  { id: 'bill', label: 'Bill', path: '/bills/new', capability: 'drafts' },
  { id: 'customer_credit', label: 'Customer credit', path: '/sales-credit-notes/new', capability: 'drafts' },
  { id: 'supplier_credit', label: 'Supplier credit', path: '/supplier-credit-notes/new', capability: 'drafts' },
  { id: 'payment', label: 'Record payment', path: '/payments?new=payment', capability: 'payments' },
]);

export function readCollapsed(storage) {
  try { return storage?.getItem(SIDEBAR_KEY) === '1'; } catch { return false; }
}
export function rememberCollapsed(storage, collapsed) {
  try { storage?.setItem(SIDEBAR_KEY, collapsed ? '1' : '0'); } catch { /* A browser preference must not block navigation. */ }
}
export function sidebarMode(width, preference) {
  return { rail: width >= 768, collapsed: width >= 768 && width < 1024 || Boolean(preference), tablet: width >= 768 && width < 1024 };
}

/** Capabilities are server facts, never inferred from a broad company role. */
export function workspacePermissions(companyId, state) {
  if (!companyId || state?.companyId !== companyId || state.loading) return { drafts: false, payments: false };
  return {
    drafts: state.documents?.company?.id === companyId && state.documents?.capabilities?.edit_drafts === true,
    payments: state.payments?.capabilities?.post_payments === true && state.payments?.configuration?.company_id === companyId && Boolean(state.payments?.configuration?.revision) &&
      ['bank', 'customer_credit', 'supplier_prepayment'].every(role => typeof state.payments.configuration.mappings?.[role] === 'string' && state.payments.configuration.mappings[role].length > 0),
  };
}
export function availableShortcuts(companyId, state) {
  const permissions = workspacePermissions(companyId, state);
  return SHORTCUTS.filter(action => permissions[action.capability]);
}

/** Move within the visible section without changing IDs, dimensions or hidden widgets. */
export function moveWidget(layout, id, direction, sectionOf) {
  if (direction !== -1 && direction !== 1) return layout;
  const index = layout.findIndex(widget => widget.id === id && !widget.hidden);
  if (index < 0) return layout;
  const peers = layout.filter(widget => !widget.hidden && sectionOf(widget.id) === sectionOf(id));
  const at = peers.findIndex(widget => widget.id === id), target = peers[at + direction];
  if (!target) return layout;
  const other = layout.findIndex(widget => widget.id === target.id);
  const next = [...layout];
  [next[index], next[other]] = [next[other], next[index]];
  return next;
}

export function currentWorkspaceState(state, companyId, key) {
  return state?.companyId === companyId && state.key === key ? state : null;
}

export async function loadWorkspaceCapabilities(client, companyId, signal, isCurrent) {
  const [documents, payments] = await Promise.allSettled([
    client.context(companyId, 'sales_invoice', signal), client.paymentContext(companyId, signal),
  ]);
  if (signal.aborted || !isCurrent()) return null;
  return { companyId, loading: false,
    documents: documents.status === 'fulfilled' ? documents.value : null,
    payments: payments.status === 'fulfilled' ? payments.value : null,
    error: documents.status === 'rejected' || payments.status === 'rejected'
      ? 'Some creation permissions could not be checked. You can still browse your workspace.' : null };
}

export function visibleSections(sections, { canDev = false, showPlanned = false, query = '', companyRole = null } = {}) {
  const search = query.trim().toLowerCase();
  return sections.filter(section => !section.devOnly || canDev).map(section => ({ ...section,
    items: section.items.filter(item => (!item.roles || item.roles.includes(companyRole)) && (!item.devOnly || canDev) && (showPlanned || !item.soon || search))
      .filter(item => !search || `${section.label} ${item.label}`.toLowerCase().includes(search)),
  })).filter(section => section.items.length);
}

export function restoreNavigationFocus(opener, fallback) {
  if (opener?.isConnected && opener.getClientRects?.().length && typeof opener.focus === 'function') opener.focus();
  else fallback?.focus?.();
}

/** Partition the existing catalogue without dropping or duplicating destinations. */
export function navigationGroups(sections, everydayRoutes, options = {}) {
  const visible = visibleSections(sections, options);
  if (options.query?.trim()) {
    const query = options.query.trim().toLowerCase();
    const aliasPaths = new Set(everydayRoutes.filter(item => item.label.toLowerCase().includes(query)).map(item => item.path));
    // Search both the existing catalogue and the new everyday labels. Filtering
    // through visibleSections first retains development access restrictions.
    const catalogue = visibleSections(sections, { ...options, query: '', showPlanned: true });
    return { everyday: [], more: catalogue.map(section => ({ ...section,
      items: section.items.filter(item => aliasPaths.has(item.path) || `${section.label} ${item.label}`.toLowerCase().includes(query)),
    })).filter(section => section.items.length) };
  }
  const byPath = new Map(visible.flatMap(section => section.items.filter(item => item.path).map(item => [item.path, item])));
  const everyday = everydayRoutes.filter(item => byPath.has(item.path)).map(item => ({ ...byPath.get(item.path), ...item }));
  const paths = new Set(everyday.map(item => item.path));
  const more = visible.map(section => ({ ...section, items: section.items.filter(item => !paths.has(item.path)) })).filter(section => section.items.length);
  return { everyday, more };
}


/** Verified provider limits for existing routes; never infer a connection from saved settings. */
export function workspaceAvailabilityNotice(pathname) {
  if (!['/email-capture', '/email-rules'].includes(pathname.replace(/\/$/, ''))) return null;
  return {
    title: 'Email capture is not connected',
    message: 'Saved email accounts and rules do not scan a mailbox or import attachments. You can upload supplier files to the document inbox and review them manually.',
    path: '/documents',
    label: 'Open document inbox',
  };
}
