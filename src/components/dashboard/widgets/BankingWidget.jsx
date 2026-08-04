import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { Skeleton, EmptyState } from '../WidgetPrimitives';
import { gbp, fmtDate } from '@/lib/format';
import { Landmark, ArrowLeftRight, ArrowRight } from 'lucide-react';

export default function BankingWidget({ company }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const [accts, txns] = await Promise.all([
      base44.entities.BankAccount.filter({ company_id: cid }),
      base44.entities.BankTransaction.filter({ company_id: cid }, '-date', 500),
    ]);
    return { accts, txns };
  });

  if (loading) return <Skeleton className="h-28 w-full" />;
  const { accts, txns } = data || {};
  const balance = (accts || []).reduce((s, a) => s + (Number(a.current_balance) || 0), 0);
  const review = (txns || []).filter((t) => t.status === 'review').length;
  const lastDate = (txns || []).map((t) => t.date).sort().pop();
  const connected = (accts || []).some((a) => a.connection_type === 'open_banking' && a.open_banking_status === 'connected');

  if (!accts || accts.length === 0)
    return (
      <EmptyState
        icon={Landmark}
        title="No bank accounts yet"
        description="Add a bank account to track balances, import transactions and reconcile your books."
        actionLabel="Add Bank Account"
        onAction={() => nav('/bank-accounts')}
      />
    );

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] text-muted-foreground font-medium">Current Balance</p>
        <p className="text-2xl font-semibold tracking-tight">{gbp(balance)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Stat label="Awaiting Review" value={review} highlight={review > 0} />
        <Stat label="Feed Status" value={connected ? 'Connected' : 'Manual'} />
        <Stat label="Last Imported" value={lastDate ? fmtDate(lastDate) : '—'} />
        <Stat label="Accounts" value={accts.length} />
      </div>
      <button
        onClick={() => nav('/transactions')}
        className="w-full flex items-center justify-center gap-2 text-xs font-medium px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <ArrowLeftRight className="w-3.5 h-3.5" />
        Review Transactions
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2.5 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? 'text-amber-600' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}