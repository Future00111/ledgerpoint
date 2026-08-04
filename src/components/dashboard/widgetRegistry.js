import KpiCardsWidget from './widgets/KpiCardsWidget';
import PrioritiesWidget from './widgets/PrioritiesWidget';
import InsightsWidget from './widgets/InsightsWidget';
import CashflowWidget from './widgets/CashflowWidget';
import ProfitWidget from './widgets/ProfitWidget';
import OutstandingInvoicesWidget from './widgets/OutstandingInvoicesWidget';
import OutstandingBillsWidget from './widgets/OutstandingBillsWidget';
import BankingWidget from './widgets/BankingWidget';
import VATWidget from './widgets/VATWidget';
import NotificationsWidget from './widgets/NotificationsWidget';
import WatchlistWidget from './widgets/WatchlistWidget';
import RecentActivityWidget from './widgets/RecentActivityWidget';
import QuickActionsWidget from './widgets/QuickActionsWidget';

import {
  LayoutDashboard, ListChecks, Sparkles, TrendingUp, BarChart3,
  FileText, Receipt, Landmark, Percent, Bell, Star, History, Zap,
} from 'lucide-react';

// Registry: single source of truth for dashboard widgets.
// To add a new widget, just register it here + give it a default size/priority.
export const WIDGETS = {
  kpis: { id: 'kpis', title: 'Key Metrics', icon: LayoutDashboard, component: KpiCardsWidget, default: { w: 3, h: 1 }, priority: 2 },
  priorities: { id: 'priorities', title: "Today's Priorities", icon: ListChecks, component: PrioritiesWidget, default: { w: 1, h: 2 }, priority: 1 },
  insights: { id: 'insights', title: 'Business Insights', icon: Sparkles, component: InsightsWidget, default: { w: 1, h: 2 }, priority: 4 },
  cashflow: { id: 'cashflow', title: 'Cashflow', icon: TrendingUp, component: CashflowWidget, default: { w: 2, h: 2 }, priority: 5 },
  profit: { id: 'profit', title: 'Profit', icon: BarChart3, component: ProfitWidget, default: { w: 2, h: 2 }, priority: 6 },
  invoices: { id: 'invoices', title: 'Outstanding Invoices', icon: FileText, component: OutstandingInvoicesWidget, default: { w: 2, h: 2 }, priority: 7 },
  bills: { id: 'bills', title: 'Outstanding Bills', icon: Receipt, component: OutstandingBillsWidget, default: { w: 2, h: 2 }, priority: 8 },
  banking: { id: 'banking', title: 'Banking', icon: Landmark, component: BankingWidget, default: { w: 1, h: 1 }, priority: 9 },
  vat: { id: 'vat', title: 'VAT', icon: Percent, component: VATWidget, default: { w: 1, h: 1 }, priority: 10 },
  notifications: { id: 'notifications', title: 'Notifications', icon: Bell, component: NotificationsWidget, default: { w: 1, h: 2 }, priority: 3 },
  recent: { id: 'recent', title: 'Recent Activity', icon: History, component: RecentActivityWidget, default: { w: 2, h: 1 }, priority: 11 },
  watchlist: { id: 'watchlist', title: 'Watchlist', icon: Star, component: WatchlistWidget, default: { w: 1, h: 1 }, priority: 12 },
  quickActions: { id: 'quickActions', title: 'Quick Actions', icon: Zap, component: QuickActionsWidget, default: { w: 1, h: 1 }, priority: 13 },
};

export const DEFAULT_LAYOUT = Object.values(WIDGETS).map((w) => ({
  id: w.id,
  w: w.default.w,
  h: w.default.h,
  hidden: false,
}));

// Ensure a saved layout stays in sync with the registry (new widgets appended,
// removed widgets dropped) — keeps the dashboard future-ready.
export function normalizeLayout(arr) {
  const have = new Set(arr.map((x) => x.id));
  const out = arr
    .filter((x) => WIDGETS[x.id])
    .map((x) => ({
      id: x.id,
      w: x.w ?? WIDGETS[x.id].default.w,
      h: x.h ?? WIDGETS[x.id].default.h,
      hidden: !!x.hidden,
    }));
  Object.keys(WIDGETS).forEach((id) => {
    if (!have.has(id)) out.push({ id, ...WIDGETS[id].default, hidden: false });
  });
  return out;
}