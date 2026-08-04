import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { Skeleton, EmptyState } from '../WidgetPrimitives';
import { Progress } from '@/components/ui/progress';
import { ArrowLeftRight, ArrowRight } from 'lucide-react';

export default function ReconciliationWidget({ company }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const [accts, txns] = await Promise.all([
      base44.entities.BankAccount.filter({ company_id: cid }),
      base44.entities.BankTransaction.filter({ company_id: cid }, '-date', 1000),
    ]);
    return { accts, txns };
  });

  if (loading) return <Skeleton className="h-28 w-full" />;
  const { accts, txns } = data || {};
  if (!accts || accts.length === 0)
    return <EmptyState icon={ArrowLeftRight} title="No bank accounts" description="Add a bank account to start reconciling transactions." actionLabel="Add Account" onAction={() => nav('/bank-accounts')} />;

  const matched = (txns || []).filter((t) => t.status === 'matched').length;
  const review = (txns || []).filter((t) => t.status === 'review').length;
  const total = matched + review;
  const pct = total > 0 ? Math.round((matched / total) * 100) : 100;

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] text-muted-foreground font-medium">Reconciled</p>
          <p className="text-lg font-semibold">{pct}%</p>
        </div>
        <Progress value={pct} className="h-2 mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-muted/50 px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground">Matched</p>
          <p className="text-sm font-semibold text-emerald-600">{matched}</p>
        </div>
        <div className="rounded-lg bg-muted/50 px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground">Awaiting Review</p>
          <p className="text-sm font-semibold text-amber-600">{review}</p>
        </div>
      </div>
      <button onClick={() => nav('/transactions')} className="w-full flex items-center justify-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
        Review Transactions <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}