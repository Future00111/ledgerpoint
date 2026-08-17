import React from 'react';
import { useAsk } from '@/components/ask/AskProvider';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { Skeleton, EmptyState } from '../WidgetPrimitives';
import CountUp from '../CountUp';
import { gbp, monthKey, thisMonthKey, prevMonthKey } from '@/lib/format';
import { TrendingUp, Sparkles, Wallet, Receipt, PiggyBank, Hourglass } from 'lucide-react';

const ACTIVE = ['approved', 'sent', 'part_paid', 'paid', 'overdue'];
const HORIZON = 30;

// Cashflow forecast: expected income/bills over the next 30 days, estimated
// cash balance, runway and a plain-English business outlook with confidence.
export default function ForecastWidget({ company, h }) {
  const { openAsk } = useAsk();
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const [inv, bills, accts, txns] = await Promise.all([
      base44.entities.SalesInvoice.filter({ company_id: cid }, '-due_date', 500),
      base44.entities.PurchaseBill.filter({ company_id: cid }, '-due_date', 500),
      base44.entities.BankAccount.filter({ company_id: cid }),
      base44.entities.BankTransaction.filter({ company_id: cid }, '-date', 1000),
    ]);
    return { inv, bills, accts, txns };
  });

  if (loading) return <Skeleton className="h-40 w-full" />;

  const { inv, bills, accts, txns } = data || {};
  const cash = (accts || []).reduce((s, a) => s + (Number(a.current_balance) || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date();
  in30.setDate(in30.getDate() + HORIZON);
  const in30s = in30.toISOString().slice(0, 10);

  const expIncome = (inv || [])
    .filter((i) => ['approved', 'sent', 'part_paid', 'overdue'].includes(i.status) && (Number(i.balance_due) || 0) > 0 && i.due_date >= today && i.due_date <= in30s)
    .reduce((s, i) => s + (Number(i.balance_due) || 0), 0);
  const expBills = (bills || [])
    .filter((b) => ['approved', 'part_paid', 'overdue', 'awaiting_review'].includes(b.status) && (Number(b.balance_due) || 0) > 0 && b.due_date >= today && b.due_date <= in30s)
    .reduce((s, b) => s + (Number(b.balance_due) || 0), 0);
  const estCash = cash + expIncome - expBills;

  const tm = thisMonthKey();
  const pm = prevMonthKey();
  const outThis = (txns || []).filter((t) => monthKey(t.date) === tm).reduce((s, t) => s + (Number(t.money_out) || 0), 0);
  const outPrev = (txns || []).filter((t) => monthKey(t.date) === pm).reduce((s, t) => s + (Number(t.money_out) || 0), 0);
  const avgOut = (outThis + outPrev) / 2 || 1;
  const runwayMonths = estCash > 0 ? Math.max(0, Math.floor(estCash / avgOut)) : 0;

  const outlook = estCash > avgOut * 3 ? 'Healthy' : estCash > avgOut ? 'Watch' : 'Tight';
  const outlookTone = estCash > avgOut * 3 ? 'text-emerald-600' : estCash > avgOut ? 'text-amber-600' : 'text-rose-600';

  const dataCount = (inv || []).length + (bills || []).length + (txns || []).length;
  const confidence = dataCount >= 20 ? 'High' : dataCount >= 8 ? 'Medium' : 'Low';

  if (dataCount === 0)
    return (
      <EmptyState
        icon={TrendingUp}
        title="Forecast needs a little data"
        description="Add invoices and bills to see expected income, bills and your estimated cash balance for the next 30 days."
        askLabel="Ask for a forecast"
        onAsk={() => openAsk('Forecast my cashflow for the next 30 days')}
      />
    );

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Business outlook</span>
        <span className={`text-sm font-semibold ${outlookTone}`}>{outlook}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Tile icon={Wallet} label="Expected income · 30d" value={expIncome} money />
        <Tile icon={Receipt} label="Expected bills · 30d" value={expBills} money />
        <Tile icon={PiggyBank} label="Est. cash in 30 days" value={estCash} money highlight />
        <Tile icon={Hourglass} label="Cash runway" value={runwayMonths} suffix=" mo" />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          Confidence: <span className="font-medium text-foreground">{confidence}</span>
        </span>
        <button onClick={() => openAsk('Forecast my cashflow for the next 30 days')} className="flex items-center gap-1 text-primary font-medium hover:underline">
          <Sparkles className="w-3 h-3" />
          Ask for detail
        </button>
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, value, money, suffix, highlight }) {
  return (
    <div className={`rounded-lg border p-2.5 flex flex-col gap-1 ${highlight ? 'border-primary/30 bg-primary/5' : 'border-border'}`}>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      <span className="text-base font-semibold tracking-tight">
        <CountUp value={value} format={(v) => (money ? gbp(v) : `${Math.round(v)}${suffix || ''}`)} />
      </span>
    </div>
  );
}