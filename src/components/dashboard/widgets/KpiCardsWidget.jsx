import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { Skeleton } from '../WidgetPrimitives';
import { gbp, deltaPct, monthKey, thisMonthKey, prevMonthKey } from '@/lib/format';
import {
  ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, TrendingDown,
  PiggyBank, FileText, Receipt, Percent, Banknote,
} from 'lucide-react';

const ACTIVE = ['approved', 'sent', 'part_paid', 'paid', 'overdue'];

export default function KpiCardsWidget({ company }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const [inv, bills, accts, txns, vat] = await Promise.all([
      base44.entities.SalesInvoice.filter({ company_id: cid }, '-issue_date', 500),
      base44.entities.PurchaseBill.filter({ company_id: cid }, '-bill_date', 500),
      base44.entities.BankAccount.filter({ company_id: cid }),
      base44.entities.BankTransaction.filter({ company_id: cid }, '-date', 500),
      base44.entities.VATReturn.filter({ company_id: cid }, '-created_date', 5),
    ]);
    return { inv, bills, accts, txns, vat };
  });

  if (loading) return <GridSkeleton />;

  const { inv, bills, accts, txns, vat } = data || {};
  const tm = thisMonthKey();
  const pm = prevMonthKey();
  const cash = (accts || []).reduce((s, a) => s + (Number(a.current_balance) || 0), 0);
  const inM = (txns || []).filter((t) => monthKey(t.date) === tm).reduce((s, t) => s + (Number(t.money_in) || 0), 0);
  const inP = (txns || []).filter((t) => monthKey(t.date) === pm).reduce((s, t) => s + (Number(t.money_in) || 0), 0);
  const outM = (txns || []).filter((t) => monthKey(t.date) === tm).reduce((s, t) => s + (Number(t.money_out) || 0), 0);
  const outP = (txns || []).filter((t) => monthKey(t.date) === pm).reduce((s, t) => s + (Number(t.money_out) || 0), 0);
  const revM = (inv || []).filter((i) => ACTIVE.includes(i.status) && monthKey(i.issue_date) === tm).reduce((s, i) => s + (Number(i.total) || 0), 0);
  const revP = (inv || []).filter((i) => ACTIVE.includes(i.status) && monthKey(i.issue_date) === pm).reduce((s, i) => s + (Number(i.total) || 0), 0);
  const costM = (bills || []).filter((b) => ACTIVE.includes(b.status) && monthKey(b.bill_date) === tm).reduce((s, b) => s + (Number(b.total) || 0), 0);
  const costP = (bills || []).filter((b) => ACTIVE.includes(b.status) && monthKey(b.bill_date) === pm).reduce((s, b) => s + (Number(b.total) || 0), 0);
  const netM = revM - costM;
  const netP = revP - costP;
  const outSales = (inv || []).filter((i) => ['approved', 'sent', 'part_paid', 'overdue'].includes(i.status) && (Number(i.balance_due) || 0) > 0).reduce((s, i) => s + (Number(i.balance_due) || 0), 0);
  const outBills = (bills || []).filter((b) => ['approved', 'part_paid', 'overdue', 'awaiting_review'].includes(b.status) && (Number(b.balance_due) || 0) > 0).reduce((s, b) => s + (Number(b.balance_due) || 0), 0);
  const matched = (txns || []).filter((t) => t.status === 'matched').length;
  const review = (txns || []).filter((t) => t.status === 'review').length;
  const reconPct = matched + review > 0 ? Math.round((matched / (matched + review)) * 100) : 100;
  const vatEst = (vat && vat[0] && Number(vat[0].vat_due)) || ((inv || []).reduce((s, i) => s + (Number(i.vat_total) || 0), 0) - (bills || []).reduce((s, b) => s + (Number(b.vat_total) || 0), 0));

  const cards = [
    { label: 'Cash Balance', value: gbp(cash), delta: null, icon: Wallet, route: '/bank-accounts' },
    { label: 'Money In (Month)', value: gbp(inM), delta: deltaPct(inM, inP), up: inM >= inP, icon: TrendingUp, route: '/transactions' },
    { label: 'Money Out (Month)', value: gbp(outM), delta: deltaPct(outM, outP), up: outM <= outP, goodWhenDown: true, icon: TrendingDown, route: '/transactions' },
    { label: 'Net Profit (Month)', value: gbp(netM), delta: deltaPct(netM, netP), up: netM >= netP, icon: PiggyBank, route: '/reports' },
    { label: 'Outstanding Sales', value: gbp(outSales), delta: null, icon: FileText, route: '/invoices' },
    { label: 'Outstanding Bills', value: gbp(outBills), delta: null, icon: Receipt, route: '/bills' },
    { label: 'VAT Estimate', value: gbp(vatEst), delta: null, icon: Percent, route: '/vat' },
    { label: 'Bank Reconciled', value: reconPct + '%', delta: null, icon: Banknote, route: '/transactions' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c, i) => (
        <button
          key={i}
          onClick={() => nav(c.route)}
          className="text-left rounded-xl border border-border bg-card hover:shadow-sm hover:border-primary/30 transition-all p-3.5 flex flex-col gap-1.5"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground truncate">{c.label}</span>
            <c.icon className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <span className="text-xl font-semibold tracking-tight">{c.value}</span>
          {c.delta != null ? (
            <span className={`text-[11px] font-medium flex items-center gap-0.5 ${c.up ? 'text-emerald-600' : 'text-rose-600'}`}>
              {c.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {c.delta} vs last month
            </span>
          ) : (
            <span className="text-[11px] text-transparent">.</span>
          )}
        </button>
      ))}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-20" />
      ))}
    </div>
  );
}