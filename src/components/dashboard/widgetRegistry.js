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
import ReconciliationWidget from './widgets/ReconciliationWidget';
import TransactionsReviewWidget from './widgets/TransactionsReviewWidget';
import BillsApprovalWidget from './widgets/BillsApprovalWidget';
import DocumentsReviewWidget from './widgets/DocumentsReviewWidget';
import TrialBalanceWidget from './widgets/TrialBalanceWidget';
import ProfitLossWidget from './widgets/ProfitLossWidget';
import BalanceSheetWidget from './widgets/BalanceSheetWidget';
import AgedDebtorsWidget from './widgets/AgedDebtorsWidget';
import AgedCreditorsWidget from './widgets/AgedCreditorsWidget';
import GeneralLedgerWidget from './widgets/GeneralLedgerWidget';
import RevenueWidget from './widgets/RevenueWidget';
import ForecastWidget from './widgets/ForecastWidget';
import TopCustomersWidget from './widgets/TopCustomersWidget';
import TopExpensesWidget from './widgets/TopExpensesWidget';
import AiForecastsWidget from './widgets/AiForecastsWidget';

import {
  LayoutDashboard, ListChecks, Sparkles, TrendingUp, BarChart3,
  FileText, Receipt, Landmark, Percent, Bell, Star, History, Zap,
  ArrowLeftRight, Scale, BookOpen, Users, User, ClipboardList, Calculator, Crown,
} from 'lucide-react';

// Registry: single source of truth for dashboard widgets.
// To add a new widget, register it here + give it a default size/priority.
// New widgets automatically become available to every Dashboard Mode.
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

  reconciliation: { id: 'reconciliation', title: 'Bank Reconciliation', icon: ArrowLeftRight, component: ReconciliationWidget, default: { w: 1, h: 1 }, priority: 14 },
  transactionsReview: { id: 'transactionsReview', title: 'Transactions Awaiting Review', icon: ArrowLeftRight, component: TransactionsReviewWidget, default: { w: 1, h: 2 }, priority: 15 },
  billsApproval: { id: 'billsApproval', title: 'Bills Awaiting Approval', icon: Receipt, component: BillsApprovalWidget, default: { w: 1, h: 2 }, priority: 16 },
  docsReview: { id: 'docsReview', title: 'Documents Awaiting Review', icon: BookOpen, component: DocumentsReviewWidget, default: { w: 1, h: 2 }, priority: 17 },
  trialBalance: { id: 'trialBalance', title: 'Trial Balance', icon: Scale, component: TrialBalanceWidget, default: { w: 2, h: 2 }, priority: 18 },
  profitLoss: { id: 'profitLoss', title: 'Profit & Loss', icon: BarChart3, component: ProfitLossWidget, default: { w: 1, h: 2 }, priority: 19 },
  balanceSheet: { id: 'balanceSheet', title: 'Balance Sheet', icon: Scale, component: BalanceSheetWidget, default: { w: 1, h: 2 }, priority: 20 },
  agedDebtors: { id: 'agedDebtors', title: 'Aged Debtors', icon: FileText, component: AgedDebtorsWidget, default: { w: 1, h: 1 }, priority: 21 },
  agedCreditors: { id: 'agedCreditors', title: 'Aged Creditors', icon: Receipt, component: AgedCreditorsWidget, default: { w: 1, h: 1 }, priority: 22 },
  generalLedger: { id: 'generalLedger', title: 'General Ledger', icon: BookOpen, component: GeneralLedgerWidget, default: { w: 2, h: 2 }, priority: 23 },
  revenue: { id: 'revenue', title: 'Revenue', icon: TrendingUp, component: RevenueWidget, default: { w: 1, h: 1 }, priority: 24 },
  forecast: { id: 'forecast', title: 'Forecast', icon: TrendingUp, component: ForecastWidget, default: { w: 2, h: 2 }, priority: 25 },
  topCustomers: { id: 'topCustomers', title: 'Top Customers', icon: Users, component: TopCustomersWidget, default: { w: 1, h: 1 }, priority: 26 },
  topExpenses: { id: 'topExpenses', title: 'Top Expenses', icon: Receipt, component: TopExpensesWidget, default: { w: 1, h: 1 }, priority: 27 },
  aiForecasts: { id: 'aiForecasts', title: 'AI Forecasts', icon: Sparkles, component: AiForecastsWidget, default: { w: 2, h: 2 }, priority: 28 },
};

// Dashboard Modes — presets over the same engine. Each lists the widgets to
// show, in priority order. Hidden widgets remain available to add back.
export const MODES = {
  owner: {
    label: 'Business Owner',
    icon: User,
    widgets: ['priorities', 'kpis', 'invoices', 'bills', 'vat', 'insights', 'notifications'],
  },
  bookkeeper: {
    label: 'Bookkeeper',
    icon: ClipboardList,
    widgets: ['reconciliation', 'transactionsReview', 'billsApproval', 'docsReview', 'vat', 'recent', 'notifications', 'quickActions'],
  },
  accountant: {
    label: 'Accountant',
    icon: Calculator,
    widgets: ['trialBalance', 'profitLoss', 'balanceSheet', 'vat', 'agedDebtors', 'agedCreditors', 'generalLedger', 'reconciliation', 'notifications'],
  },
  executive: {
    label: 'Executive',
    icon: Crown,
    widgets: ['kpis', 'revenue', 'profit', 'cashflow', 'forecast', 'topCustomers', 'topExpenses', 'insights', 'aiForecasts'],
  },
};

export function buildModeLayout(modeKey) {
  const visible = MODES[modeKey].widgets;
  const arr = visible.map((id) => ({ id, w: WIDGETS[id].default.w, h: WIDGETS[id].default.h, hidden: false }));
  Object.keys(WIDGETS).forEach((id) => {
    if (!visible.includes(id)) arr.push({ id, ...WIDGETS[id].default, hidden: true });
  });
  return arr;
}

export const DEFAULT_LAYOUT = buildModeLayout('owner');

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