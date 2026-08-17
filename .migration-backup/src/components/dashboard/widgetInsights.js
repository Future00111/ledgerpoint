import { base44 } from '@/api/base44Client';
import { WIDGETS } from './widgetRegistry';
import { gbp, monthKey, thisMonthKey, prevMonthKey } from '@/lib/format';

const ACTIVE = ['approved', 'sent', 'part_paid', 'paid', 'overdue'];
const BILL_ACTIVE = ['approved', 'part_paid', 'paid', 'overdue', 'awaiting_review'];
const todayStr = () => new Date().toISOString().slice(0, 10);

// Related report/page per widget (null = no report link shown).
const REPORT_ROUTES = {
  snapshot: '/reports', cashflow: '/reports', profit: '/reports', kpis: '/reports',
  forecast: '/reports', revenue: '/reports', topExpenses: '/reports', profitLoss: '/reports',
  balanceSheet: '/reports', trialBalance: '/reports', generalLedger: '/general-ledger',
  invoices: '/invoices', bills: '/bills', agedDebtors: '/invoices', agedCreditors: '/bills',
  vat: '/vat', insights: '/insights', banking: '/bank-accounts', reconciliation: '/transactions',
  transactionsReview: '/transactions', billsApproval: '/bills', docsReview: '/documents',
  topCustomers: '/customers', aiForecasts: '/insights',
};

const ROUTE_LABELS = {
  '/reports': 'Open Reports', '/invoices': 'Open Invoices', '/bills': 'Open Bills',
  '/vat': 'Open VAT', '/insights': 'Open Insights', '/bank-accounts': 'Open Bank Accounts',
  '/transactions': 'Open Transactions', '/documents': 'Open Documents',
  '/general-ledger': 'Open General Ledger', '/customers': 'Open Customers',
};

function reportFor(widgetId) {
  const r = REPORT_ROUTES[widgetId];
  return r ? { label: ROUTE_LABELS[r] || 'Open report', route: r } : null;
}

// ---- Per-widget generators (each returns { why, action, ask [, report] }) ----

async function snapshot() {
  return {
    why: 'A real-time snapshot of your cash, profit, money owed and business health — your financial position at a glance.',
    action: 'Use it as your daily starting point: resolve anything red before it grows.',
    ask: 'Summarise my business performance today',
  };
}

async function cashflow(c) {
  const [accts, txns] = await Promise.all([
    base44.entities.BankAccount.filter({ company_id: c.id }),
    base44.entities.BankTransaction.filter({ company_id: c.id }, '-date', 1000),
  ]);
  const cash = (accts || []).reduce((s, a) => s + (Number(a.current_balance) || 0), 0);
  const tm = thisMonthKey();
  const pm = prevMonthKey();
  const outThis = (txns || []).filter((t) => monthKey(t.date) === tm).reduce((s, t) => s + (Number(t.money_out) || 0), 0);
  const outPrev = (txns || []).filter((t) => monthKey(t.date) === pm).reduce((s, t) => s + (Number(t.money_out) || 0), 0);
  const avg = (outThis + outPrev) / 2;
  const months = avg > 0 ? cash / avg : null;
  const why = months != null
    ? `Your current cash balance of ${gbp(cash)} covers approximately ${months.toFixed(1)} months of operating costs.`
    : `Your current cash balance is ${gbp(cash)}.`;
  const action = months != null && months < 2
    ? 'Tight runway — prioritise collecting overdue invoices and delay non-essential spending.'
    : 'Keep monitoring your outflows to protect your cash buffer.';
  return { why, action, ask: 'Explain my cash position' };
}

async function profit(c) {
  const [inv, bills] = await Promise.all([
    base44.entities.SalesInvoice.filter({ company_id: c.id }, '-issue_date', 1000),
    base44.entities.PurchaseBill.filter({ company_id: c.id }, '-bill_date', 1000),
  ]);
  const tm = thisMonthKey();
  const pm = prevMonthKey();
  const rev = (arr, k, f) => (arr || []).filter((x) => ACTIVE.includes(x.status) && monthKey(x[f]) === k).reduce((s, x) => s + (Number(x.total) || 0), 0);
  const cost = (arr, k, f) => (arr || []).filter((x) => BILL_ACTIVE.includes(x.status) && monthKey(x[f]) === k).reduce((s, x) => s + (Number(x.total) || 0), 0);
  const revM = rev(inv, tm, 'issue_date');
  const revP = rev(inv, pm, 'issue_date');
  const costM = cost(bills, tm, 'bill_date');
  const costP = cost(bills, pm, 'bill_date');
  const netM = revM - costM;
  const netP = revP - costP;
  let why;
  if (netM > netP) why = `Profit increased because ${revM > revP ? 'revenue rose faster than expenses' : 'expenses fell faster than revenue'} — up ${gbp(netM - netP)} versus last month.`;
  else if (netM < netP) why = `Profit decreased because ${revM < revP ? 'revenue fell faster than expenses' : 'expenses rose faster than revenue'} — down ${gbp(Math.abs(netM - netP))} versus last month.`;
  else why = `Profit held steady at ${gbp(netM)} versus last month.`;
  const action = netM < netP
    ? 'Review your rising costs and chase outstanding invoices to recover margin.'
    : 'Keep this momentum — repeat what drove the revenue increase.';
  return { why, action, ask: 'Why did my profit change this month?' };
}

async function invoices(c) {
  const inv = await base44.entities.SalesInvoice.filter({ company_id: c.id }, 'due_date', 500);
  const outstanding = (inv || [])
    .filter((i) => ['approved', 'sent', 'part_paid', 'overdue'].includes(i.status) && (Number(i.balance_due) || 0) > 0)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));
  if (!outstanding.length)
    return {
      why: 'You have no outstanding invoices — all sales are paid. Nicely done.',
      action: 'Keep invoicing promptly to maintain a steady cashflow.',
      ask: 'Which customers owe me money?',
    };
  const oldest = outstanding.slice(0, 3);
  const sum = oldest.reduce((s, i) => s + (Number(i.balance_due) || 0), 0);
  return {
    why: `Collecting the ${oldest.length} oldest outstanding invoice${oldest.length > 1 ? 's' : ''} would increase available cash by ${gbp(sum)}.`,
    action: 'Send reminders to your oldest overdue invoices to bring cash in sooner.',
    ask: 'Which customers should I chase for payment?',
  };
}

async function bills(c) {
  const b = await base44.entities.PurchaseBill.filter({ company_id: c.id }, 'due_date', 500);
  const today = todayStr();
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const in7s = in7.toISOString().slice(0, 10);
  const due = (b || []).filter((x) => BILL_ACTIVE.includes(x.status) && (Number(x.balance_due) || 0) > 0 && x.due_date >= today && x.due_date <= in7s);
  if (!due.length)
    return {
      why: 'No bills are due in the next 7 days — your short-term obligations are covered.',
      action: 'Use the quiet period to review bills falling due later this month.',
      ask: 'Which bills are due soon?',
    };
  const sum = due.reduce((s, x) => s + (Number(x.balance_due) || 0), 0);
  return {
    why: `You have ${gbp(sum)} in bills due in the next 7 days across ${due.length} supplier${due.length > 1 ? 's' : ''}.`,
    action: 'Plan these payments to avoid late fees and protect supplier relationships.',
    ask: 'Which bills are due soon?',
  };
}

async function vat(c) {
  const [inv, bills, vr] = await Promise.all([
    base44.entities.SalesInvoice.filter({ company_id: c.id }, '-issue_date', 1000),
    base44.entities.PurchaseBill.filter({ company_id: c.id }, '-bill_date', 1000),
    base44.entities.VATReturn.filter({ company_id: c.id }, '-created_date', 5),
  ]);
  const outputVat = (inv || []).filter((i) => ACTIVE.includes(i.status)).reduce((s, i) => s + (Number(i.vat_total) || 0), 0);
  const inputVat = (bills || []).filter((b) => BILL_ACTIVE.includes(b.status)).reduce((s, b) => s + (Number(b.vat_total) || 0), 0);
  const vatEst = (vr && vr[0] && Number(vr[0].vat_due)) || Math.max(0, outputVat - inputVat);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const wa = weekAgo.toISOString().slice(0, 10);
  const postedThisWeek = (inv || []).filter((i) => (i.issue_date || '') >= wa).length;
  let why = `Your estimated VAT payable is ${gbp(vatEst)}.`;
  if (postedThisWeek > 0) why += ` ${postedThisWeek} sales invoice${postedThisWeek > 1 ? 's were' : ' was'} posted this week, which raised the estimate.`;
  return {
    why,
    action: 'Review your VAT return and make sure all transactions are posted before submitting to HMRC.',
    ask: 'Explain my VAT estimate',
  };
}

async function insights() {
  return {
    why: 'Ledgerly analyses your books daily and surfaces trends, risks and opportunities you might miss.',
    action: "Review each insight and dismiss the ones you've actioned.",
    ask: 'What insights should I act on?',
  };
}

async function forecast() {
  return {
    why: 'A 30-day projection of your cash position based on outstanding invoices, bills and your spending pattern.',
    action: 'If runway is tight, accelerate invoice collection or delay discretionary spending.',
    ask: 'Forecast my cashflow for the next 30 days',
  };
}

async function priorities() {
  return {
    why: 'These are the tasks that most need your attention today, ranked by urgency and impact on your books.',
    action: 'Clear the top item first — each one resolved lifts your Business Health score.',
    ask: 'What should I focus on today?',
    report: null,
  };
}

async function notifications() {
  return {
    why: 'A live feed of activity across your books — payments, documents and approvals as they happen.',
    action: 'Clear notifications regularly so nothing important slips through.',
    ask: 'What happened recently in my business?',
    report: null,
  };
}

async function recent() {
  return {
    why: 'Your latest activity across invoices, bills, transactions and documents, newest first.',
    action: 'Scan recent activity to catch anything unexpected early.',
    ask: 'What happened recently in my business?',
    report: null,
  };
}

async function kpis() {
  return {
    why: 'Your headline numbers at a glance — cash, profit, outstanding balances, VAT and health.',
    action: 'Track these each week to spot trends before they become problems.',
    ask: 'Explain my key metrics',
  };
}

async function banking() {
  return {
    why: 'Your connected bank accounts and their current balances.',
    action: 'Keep your bank feed connected so transactions reconcile automatically.',
    ask: 'Explain my bank balances',
  };
}

const GENERATORS = {
  snapshot, cashflow, profit, invoices, bills, vat, insights, forecast,
  priorities, notifications, recent, kpis, banking,
};

function generic(widgetId) {
  const title = WIDGETS[widgetId]?.title || widgetId;
  return {
    why: `This widget shows your ${title.toLowerCase()} — a focused view to help you spot what needs attention.`,
    action: 'Use Ask Ledgerly to dig into the numbers behind this widget.',
    ask: `Explain my ${title.toLowerCase()}`,
  };
}

// Main entry — returns { why, action, report, ask } for any widget.
export async function getWidgetInsight(widgetId, company) {
  const gen = GENERATORS[widgetId];
  let base;
  try {
    base = gen && company ? await gen(company) : generic(widgetId);
  } catch {
    base = generic(widgetId);
  }
  if (base.report === undefined) base.report = reportFor(widgetId);
  return base;
}