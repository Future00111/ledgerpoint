import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { computeHealth, openHealthDetails } from '../useBusinessHealth';
import { gbp, monthKey, thisMonthKey } from '@/lib/format';
import {
  Wallet, PiggyBank, FileText, Receipt, Activity, ArrowRight, ListChecks,
  ArrowLeftRight, FolderOpen,
} from 'lucide-react';

const ACTIVE = ['approved', 'sent', 'part_paid', 'paid', 'overdue'];

// Featured hero widget — the primary panel of the Business Command Centre.
export default function BusinessSnapshotWidget({ company }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const [inv, bills, accts, txns, docs, vat] = await Promise.all([
      base44.entities.SalesInvoice.filter({ company_id: cid }, '-issue_date', 500),
      base44.entities.PurchaseBill.filter({ company_id: cid }, '-bill_date', 500),
      base44.entities.BankAccount.filter({ company_id: cid }),
      base44.entities.BankTransaction.filter({ company_id: cid }, '-date', 500),
      base44.entities.Document.filter({ company_id: cid }),
      base44.entities.VATReturn.filter({ company_id: cid }, '-created_date', 5),
    ]);
    return { inv, bills, accts, txns, docs, vat };
  });

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const { inv, bills, accts, txns, docs, vat } = data || {};
  const tm = thisMonthKey();
  const cash = (accts || []).reduce((s, a) => s + (Number(a.current_balance) || 0), 0);
  const revM = (inv || []).filter((i) => ACTIVE.includes(i.status) && monthKey(i.issue_date) === tm).reduce((s, i) => s + (Number(i.total) || 0), 0);
  const costM = (bills || []).filter((b) => ACTIVE.includes(b.status) && monthKey(b.bill_date) === tm).reduce((s, b) => s + (Number(b.total) || 0), 0);
  const netProfit = revM - costM;
  const outInv = (inv || []).filter((i) => ['approved', 'sent', 'part_paid', 'overdue'].includes(i.status) && (Number(i.balance_due) || 0) > 0).reduce((s, i) => s + (Number(i.balance_due) || 0), 0);
  const outBills = (bills || []).filter((b) => ['approved', 'part_paid', 'overdue', 'awaiting_review'].includes(b.status) && (Number(b.balance_due) || 0) > 0).reduce((s, b) => s + (Number(b.balance_due) || 0), 0);
  const health = computeHealth({ accts, txns, docs, vat, inv, bills });
  const hColor = health.score >= 90 ? 'text-emerald-600' : health.score >= 70 ? 'text-amber-600' : 'text-rose-600';
  const hDot = health.score >= 90 ? 'bg-emerald-500' : health.score >= 70 ? 'bg-amber-500' : 'bg-rose-500';

  const metrics = [
    { label: 'Cash', value: gbp(cash), icon: Wallet, route: '/bank-accounts' },
    { label: 'Net Profit', value: gbp(netProfit), icon: PiggyBank, route: '/reports' },
    { label: 'Owed to you', value: gbp(outInv), icon: FileText, route: '/invoices' },
    { label: 'You owe', value: gbp(outBills), icon: Receipt, route: '/bills' },
  ];

  const today = new Date().toISOString().slice(0, 10);
  const review = (txns || []).filter((t) => t.status === 'review').length;
  const approve = (bills || []).filter((b) => b.status === 'awaiting_review' || b.status === 'draft').length;
  const overdue = (inv || []).filter((i) => ['approved', 'sent', 'part_paid'].includes(i.status) && (Number(i.balance_due) || 0) > 0 && i.due_date < today).length;
  const pendingDocs = (docs || []).filter((d) => d.status === 'pending_review' || d.status === 'pending_extraction').length;
  const tasks = [];
  if (review > 0) tasks.push({ label: `Review ${review} bank transaction${review > 1 ? 's' : ''}`, route: '/transactions', icon: ArrowLeftRight });
  if (approve > 0) tasks.push({ label: `Approve ${approve} bill${approve > 1 ? 's' : ''}`, route: '/bills', icon: Receipt });
  if (overdue > 0) tasks.push({ label: `Chase ${overdue} overdue invoice${overdue > 1 ? 's' : ''}`, route: '/invoices', icon: FileText });
  if (pendingDocs > 0) tasks.push({ label: `Review ${pendingDocs} document${pendingDocs > 1 ? 's' : ''}`, route: '/documents', icon: FolderOpen });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {metrics.map((m, i) => (
          <button
            key={i}
            onClick={() => nav(m.route)}
            className="text-left rounded-xl border border-border bg-card hover:shadow-sm hover:border-primary/30 transition-all p-3 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted-foreground">{m.label}</span>
              <m.icon className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight">{m.value}</span>
          </button>
        ))}
        <button
          onClick={openHealthDetails}
          className="text-left rounded-xl border border-border bg-gradient-to-br from-primary/5 to-card hover:shadow-sm transition-all p-3 flex flex-col gap-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-muted-foreground">Business Health</span>
            <Activity className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-lg font-semibold tracking-tight flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${hDot}`} />
            <span className={hColor}>{health.score}/100</span>
          </span>
        </button>
      </div>
      <div className="rounded-xl border border-border bg-card p-3 flex flex-col">
        <div className="flex items-center gap-1.5 mb-2">
          <ListChecks className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Today’s priorities</span>
        </div>
        {tasks.length ? (
          <div className="space-y-1 flex-1">
            {tasks.slice(0, 3).map((t, i) => (
              <button
                key={i}
                onClick={() => nav(t.route)}
                className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted transition-colors text-left group"
              >
                <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <t.icon className="w-3.5 h-3.5" />
                </span>
                <span className="flex-1 text-xs font-medium truncate">{t.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">You’re all caught up — nothing needs your attention today.</p>
        )}
      </div>
    </div>
  );
}