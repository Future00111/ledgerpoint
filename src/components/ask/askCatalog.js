// Instant client-side catalog search for non-entity, always-available content:
// Dashboard Widgets, Settings, Help Articles, Future Modules. Matched locally
// so results appear in milliseconds with no network round-trip.

import { LayoutDashboard, Settings as SettingsIcon, LifeBuoy, Rocket } from 'lucide-react';

function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, k) => k);
  let cur = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    const ai = a[i - 1];
    for (let j = 1; j <= n; j++) {
      const cost = ai === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

function matchOne(normQuery, qTokens, vals) {
  const normVals = vals.map(normalize).filter(Boolean);
  if (!normVals.length) return false;
  if (normVals.some((v) => v.includes(normQuery))) return true;
  if (!qTokens.length) return false;
  const fieldTokens = normVals.join(' ').split(' ').filter(Boolean);
  if (!fieldTokens.length) return false;
  return qTokens.every((qt) =>
    fieldTokens.some(
      (ft) => ft.includes(qt) || qt.includes(ft) || levenshtein(qt, ft) <= (qt.length <= 4 ? 1 : 2)
    )
  );
}

export const CATALOG_GROUPS = [
  {
    label: 'Dashboard Widgets',
    icon: LayoutDashboard,
    items: [
      { label: 'Cash Flow Widget', route: '/' },
      { label: 'Profit & Loss Widget', route: '/' },
      { label: 'Outstanding Invoices Widget', route: '/' },
      { label: 'Outstanding Bills Widget', route: '/' },
      { label: 'VAT Summary Widget', route: '/' },
      { label: 'Banking Widget', route: '/' },
      { label: 'Recent Activity Widget', route: '/' },
      { label: 'Business Health Widget', route: '/' },
    ],
  },
  {
    label: 'Settings',
    icon: SettingsIcon,
    items: [
      { label: 'Company Settings', route: '/settings' },
      { label: 'VAT Settings', route: '/settings' },
      { label: 'Chart of Accounts', route: '/chart-of-accounts' },
      { label: 'Email Capture Rules', route: '/email-rules' },
      { label: 'Users & Roles', route: '/settings' },
      { label: 'Bank Accounts', route: '/bank-accounts' },
      { label: 'Smart Suggestions Settings', route: '/smart-suggestions' },
      { label: 'Email Capture', route: '/email-capture' },
    ],
  },
  {
    label: 'Help Articles',
    icon: LifeBuoy,
    items: [
      { label: 'How to prepare a VAT return', route: '/vat' },
      { label: 'How to reconcile bank transactions', route: '/transactions' },
      { label: 'How to create an invoice', route: '/invoices/new' },
      { label: 'How to approve a bill', route: '/bills' },
      { label: 'How to import a bank statement', route: '/transactions' },
      { label: 'Understanding the Chart of Accounts', route: '/chart-of-accounts' },
      { label: 'How to match a bank transaction', route: '/transactions' },
    ],
  },
  {
    label: 'Future Modules',
    icon: Rocket,
    items: [
      { label: 'Payroll — Coming soon', route: '/settings', soon: true },
      { label: 'Open Banking Feeds — Coming soon', route: '/bank-accounts', soon: true },
      { label: 'Multi-currency — Coming soon', route: '/settings', soon: true },
      { label: 'Budgeting & Forecasting — Coming soon', route: '/reports', soon: true },
      { label: 'HMRC Bridging — Coming soon', route: '/vat', soon: true },
    ],
  },
];

export function searchCatalog(query) {
  const normQuery = normalize(query);
  if (!normQuery) return [];
  const qTokens = normQuery.split(' ').filter(Boolean);
  const groups = [];
  for (const g of CATALOG_GROUPS) {
    const matched = g.items
      .filter((it) => matchOne(normQuery, qTokens, [it.label]))
      .slice(0, 4)
      .map((it) => ({ label: it.label, sublabel: g.label, route: it.route, soon: !!it.soon }));
    if (matched.length) groups.push({ label: g.label, icon: g.icon, items: matched });
  }
  return groups;
}