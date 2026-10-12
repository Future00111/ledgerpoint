import {
  TrendingUp, ShoppingCart, Landmark, Percent,
  FolderOpen, BarChart3, Sparkles, Bell,
} from 'lucide-react';

export const BLOCK_TYPES = ['when', 'if', 'then', 'wait', 'else', 'end'];

export const BLOCK_META = {
  when: { label: 'WHEN', tagline: 'Trigger',     badge: 'bg-emerald-100 text-emerald-700', border: 'border-l-emerald-500' },
  if:   { label: 'IF',   tagline: 'Condition',   badge: 'bg-blue-100 text-blue-700',       border: 'border-l-blue-500' },
  then: { label: 'THEN', tagline: 'Action',       badge: 'bg-purple-100 text-purple-700',   border: 'border-l-purple-500' },
  wait: { label: 'WAIT', tagline: 'Delay',        badge: 'bg-amber-100 text-amber-700',     border: 'border-l-amber-500' },
  else: { label: 'ELSE', tagline: 'Alternative',   badge: 'bg-orange-100 text-orange-700',   border: 'border-l-orange-500' },
  end:  { label: 'END',  tagline: 'Stop',         badge: 'bg-slate-100 text-slate-700',      border: 'border-l-slate-500' },
};

export const TRIGGER_OPTIONS = [
  'an invoice becomes overdue',
  'a bill is received',
  'a bank transaction needs review',
  'a VAT return is due',
  'a document is uploaded',
  'a new customer is added',
  'a new supplier is added',
  'every day',
  'every week',
  'every month',
];

export const CONDITION_OPTIONS = [
  'amount is greater than',
  'amount is less than',
  'customer is',
  'supplier is',
  'category is',
  'status is',
  'description contains',
];

export const ACTION_OPTIONS = [
  'send email reminder',
  'create a task',
  'categorise transaction',
  'notify me',
  'create invoice',
  'generate report',
  'flag for review',
  'request approval',
];

export const CATEGORY_OPTIONS = [
  { value: 'sales', label: 'Sales' },
  { value: 'purchases', label: 'Purchases' },
  { value: 'banking', label: 'Banking' },
  { value: 'vat', label: 'VAT' },
  { value: 'documents', label: 'Documents' },
  { value: 'reports', label: 'Reports' },
  { value: 'ai', label: 'AI' },
  { value: 'notifications', label: 'Notifications' },
];

export const CATEGORY_LABELS = {
  sales: 'Sales',
  purchases: 'Purchases',
  banking: 'Banking',
  vat: 'VAT',
  documents: 'Documents',
  reports: 'Reports',
  ai: 'AI',
  notifications: 'Notifications',
};

export const CATEGORY_ICONS = {
  sales: TrendingUp,
  purchases: ShoppingCart,
  banking: Landmark,
  vat: Percent,
  documents: FolderOpen,
  reports: BarChart3,
  ai: Sparkles,
  notifications: Bell,
};