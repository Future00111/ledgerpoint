import { allItems } from '@/components/layout/navConfig';
import {
  LayoutDashboard, Users, FileText, Undo2, Truck, Receipt, RotateCcw,
  Landmark, ArrowLeftRight, BookOpen, Grid3x3, Percent, FolderOpen, Mail,
  Filter, BarChart3, Sparkles, Lightbulb, Briefcase, Building2, FileBarChart,
  Settings2, LifeBuoy, Rocket,
} from 'lucide-react';

const NAV_KEYWORDS = {
  '/': ['dashboard', 'home', 'overview'],
  '/customers': ['customer', 'customers', 'clients', 'client'],
  '/invoices': ['invoice', 'invoices', 'sales invoice'],
  '/sales-credit-notes': ['credit note', 'credit notes', 'sales credit', 'refund'],
  '/suppliers': ['supplier', 'suppliers', 'vendor', 'vendors'],
  '/bills': ['bill', 'bills', 'purchase bill'],
  '/supplier-credit-notes': ['supplier credit', 'supplier credits', 'credits'],
  '/bank-accounts': ['bank account', 'bank accounts', 'banking', 'bank feed'],
  '/transactions': ['transaction', 'transactions', 'bank transaction', 'bank statement', 'statement'],
  '/chart-of-accounts': ['chart of accounts', 'ledger account', 'coa'],
  '/general-ledger': ['general ledger', 'ledger', 'journal', 'journals', 'journal entry'],
  '/vat': ['vat', 'vat return', 'tax return', 'tax'],
  '/documents': ['document', 'documents', 'files', 'file'],
  '/email-capture': ['email capture', 'capture'],
  '/email-rules': ['email rule', 'email rules'],
  '/reports': ['report', 'reports'],
  '/insights': ['insights', 'ai insights', 'insight'],
  '/smart-suggestions': ['smart suggestions', 'account suggestion', 'suggestions'],
  '/accountant': ['accountant', 'accountant portal'],
  '/companies': ['companies', 'manage compan', 'create company'],
  '/settings': ['settings', 'users', 'roles', 'permissions', 'profile'],
};

export const CREATE_ITEMS = [
  { label: 'Invoice', path: '/invoices/new', icon: FileText, keys: ['invoice', 'invoices'] },
  { label: 'Bill', path: '/bills/new', icon: Receipt, keys: ['bill', 'bills'] },
  { label: 'Customer', path: '/customers', icon: Users, keys: ['customer', 'clients', 'client'] },
  { label: 'Supplier', path: '/suppliers', icon: Truck, keys: ['supplier', 'vendor', 'vendors'] },
  { label: 'Credit Note', path: '/sales-credit-notes/new', icon: Undo2, keys: ['credit note', 'refund'] },
  { label: 'Journal', path: '/general-ledger', icon: Grid3x3, keys: ['journal', 'journal entry'] },
  { label: 'Bank Transaction', path: '/transactions', icon: ArrowLeftRight, keys: ['bank transaction', 'transaction'] },
  { label: 'Company', path: '/companies', icon: Building2, keys: ['company', 'business'], ownerOnly: true },
  { label: 'Document', path: '/documents', icon: FolderOpen, keys: ['document', 'file', 'upload'] },
];

export const ACTION_ITEMS = [
  { label: 'Export Report', path: '/reports', icon: FileBarChart, keys: ['export report', 'export'] },
  { label: 'Submit VAT', path: '/vat', icon: Percent, keys: ['submit vat', 'file vat'] },
  { label: 'Import CSV', path: '/transactions', icon: ArrowLeftRight, keys: ['import csv', 'import bank', 'import statement', 'import'] },
  { label: 'Approve Bills', path: '/bills', icon: Receipt, keys: ['approve bill', 'approve bills', 'approve'] },
  { label: 'Email Customers', path: '/customers', icon: Mail, keys: ['email customer'] },
  { label: 'Reconnect Bank Feed', path: '/bank-accounts', icon: Landmark, keys: ['reconnect bank', 'bank feed', 'connect bank'] },
  { label: 'Generate Report', path: '/reports', icon: BarChart3, keys: ['generate report', 'generate'] },
  { label: 'Recalculate VAT', path: '/vat', icon: Percent, keys: ['recalculate vat', 'recalculate'] },
];

const QUESTION_WORDS = [
  'why', 'how', 'what', 'which', 'can ', 'should', 'is ', 'are ', 'summarise',
  'summarize', 'explain', 'tell me', 'who ', 'when', 'will ', 'could', 'would', 'do i', 'afford',
];

export function isQuestion(query) {
  const q = query.toLowerCase().trim();
  if (!q) return false;
  if (q.includes('?')) return true;
  return QUESTION_WORDS.some((w) => q.startsWith(w.trim()));
}

export function getNavigationMatches(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const items = allItems().filter((i) => i.path);
  const seen = new Set();
  const matches = [];
  for (const it of items) {
    if (seen.has(it.path)) continue;
    const kws = NAV_KEYWORDS[it.path] || [it.label.toLowerCase()];
    if (kws.some((k) => q.includes(k))) {
      seen.add(it.path);
      matches.push({
        type: 'navigate',
        kind: 'navigate',
        label: it.label,
        sublabel: it.sectionLabel,
        path: it.path,
        icon: it.icon || LayoutDashboard,
      });
    }
  }
  return matches.slice(0, 6);
}

export function getCreateMatches(query, isOwner) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const creating = /\b(create|new|add|make|start)\b/.test(q);
  return CREATE_ITEMS.filter((it) => {
    if (it.ownerOnly && !isOwner) return false;
    return creating || it.keys.some((k) => q.includes(k));
  }).map((it) => ({
    type: 'create',
    kind: 'create',
    label: `Create ${it.label}`,
    sublabel: 'Create',
    path: it.path,
    icon: it.icon,
  }));
}

export function getActionMatches(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return ACTION_ITEMS.filter((it) => it.keys.some((k) => q.includes(k))).map((it) => ({
    type: 'action',
    kind: 'action',
    label: it.label,
    sublabel: 'Action',
    path: it.path,
    icon: it.icon,
  }));
}

export const RECORD_ICONS = {
  Customers: Users,
  Suppliers: Truck,
  Invoices: FileText,
  Bills: Receipt,
  'Credit Notes': Undo2,
  'Supplier Credits': RotateCcw,
  'Bank Transactions': ArrowLeftRight,
  Documents: FolderOpen,
  'Ledger Accounts': BookOpen,
  'VAT Returns': Percent,
  Companies: Building2,
  'Journal Entries': Grid3x3,
  Reports: BarChart3,
  'Dashboard Widgets': LayoutDashboard,
  Settings: Settings2,
  'Help Articles': LifeBuoy,
  'Future Modules': Rocket,
};

export function recordIcon(label) {
  return RECORD_ICONS[label] || FileText;
}