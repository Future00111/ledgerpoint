import {
  LayoutDashboard, ListChecks, Sparkles, TrendingUp, BarChart3,
  FileText, Receipt, ShoppingCart, Landmark, Calculator,
  FolderOpen, Settings,
  Users, Undo2, Truck, RotateCcw,
  ArrowLeftRight, BookOpen, Grid3x3, Percent,
  Mail, Filter, FilePlus, ScanText,
  FileBarChart, Building2, Lightbulb, Briefcase, Plug, Bell, History, UserCircle, CreditCard,
  Wrench,
} from 'lucide-react';

// Single source of truth for navigation. New modules are added here and
// automatically render in the correct section — no layout edits needed.
export const SECTIONS = [
  {
    key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard,
    items: [{ label: 'Dashboard', path: '/' }],
  },
  {
    key: 'sales', label: 'Sales', icon: TrendingUp,
    items: [
      { label: 'Customers', path: '/customers', icon: Users },
      { label: 'Invoices', path: '/invoices', icon: FileText },
      { label: 'Credit Notes', path: '/sales-credit-notes', icon: Undo2 },
    ],
  },
  {
    key: 'purchases', label: 'Purchases', icon: ShoppingCart,
    items: [
      { label: 'Suppliers', path: '/suppliers', icon: Truck },
      { label: 'Bills', path: '/bills', icon: Receipt },
      { label: 'Credits', path: '/supplier-credit-notes', icon: RotateCcw },
    ],
  },
  {
    key: 'banking', label: 'Banking', icon: Landmark,
    items: [
      { label: 'Accounts', path: '/bank-accounts', icon: Landmark },
      { label: 'Transactions', path: '/transactions', icon: ArrowLeftRight },
    ],
  },
  {
    key: 'accounting', label: 'Accounting', icon: Calculator,
    items: [
      { label: 'Accounts', path: '/chart-of-accounts', icon: BookOpen },
      { label: 'General Ledger', path: '/general-ledger', icon: Grid3x3 },
      { label: 'VAT Returns', path: '/vat', icon: Percent },
    ],
  },
  {
    key: 'documents', label: 'Documents', icon: FolderOpen,
    items: [
      { label: 'Documents', path: '/documents', icon: FolderOpen },
      { label: 'Email Capture', path: '/email-capture', icon: Mail },
      { label: 'Email Rules', path: '/email-rules', icon: Filter },
      { label: 'Document Templates', icon: FilePlus, soon: true },
      { label: 'OCR History', icon: ScanText, soon: true },
    ],
  },
  {
    key: 'reports', label: 'Reports', icon: BarChart3,
    items: [
      { label: 'Reports', path: '/reports', icon: BarChart3 },
      { label: 'AI Insights', path: '/insights', icon: Sparkles },
      { label: 'Custom Reports', icon: FileBarChart, soon: true },
    ],
  },
  {
    key: 'settings', label: 'Settings', icon: Settings,
    items: [
      { label: 'Manage Companies', path: '/companies', icon: Building2 },
      { label: 'Users & Roles', path: '/settings', icon: Users },
      { label: 'Smart Suggestions', path: '/smart-suggestions', icon: Lightbulb },
      { label: 'Accountant Portal', path: '/accountant', icon: Briefcase },
      { label: 'Tax Settings', icon: Percent, soon: true },
      { label: 'AI Integrations', icon: Sparkles, soon: true },
      { label: 'Integrations', icon: Plug, soon: true },
      { label: 'Notifications', icon: Bell, soon: true },
      { label: 'Audit Log', icon: History, soon: true },
      { label: 'User Profile', icon: UserCircle, soon: true },
      { label: 'Subscription', icon: CreditCard, soon: true },
    ],
  },
  {
    key: 'dev', label: 'Development', icon: Wrench,
    devOnly: true,
    items: [{ label: 'Development Tools', path: '/dev-tools', icon: Wrench }],
  },
];

export function allItems() {
  return SECTIONS.flatMap((s) =>
    s.items.map((i) => ({ ...i, sectionKey: s.key, sectionLabel: s.label }))
  );
}

// Longest-prefix match so /invoices/123 resolves to the Invoices item.
export function findActiveItem(pathname) {
  const items = allItems();
  let best = null;
  for (const it of items) {
    if (!it.path) continue;
    if (it.path === '/') {
      if (pathname === '/') best = it;
      continue;
    }
    if (pathname === it.path || pathname.startsWith(it.path + '/')) {
      if (!best || it.path.length > best.path.length) best = it;
    }
  }
  return best;
}