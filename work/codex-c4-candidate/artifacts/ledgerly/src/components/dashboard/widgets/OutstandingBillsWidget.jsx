import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAsk } from '@/components/ask/AskProvider';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState, StatusBadge } from '../WidgetPrimitives';
import { gbp, fmtDate } from '@/lib/format';
import { Receipt, Eye, Check, CreditCard, Sparkles } from 'lucide-react';

export default function OutstandingBillsWidget({ company, h }) {
  const nav = useNavigate();
  const { openAsk } = useAsk();
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const bills = await base44.entities.PurchaseBill.filter({ company_id: cid }, 'due_date', 500);
    return bills;
  });

  if (loading) return <ListSkeleton />;
  const today = new Date().toISOString().slice(0, 10);
  const items = (data || [])
    .filter((b) => ['approved', 'part_paid', 'overdue', 'awaiting_review'].includes(b.status) && (Number(b.balance_due) || 0) > 0)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
    .slice(0, h === 2 ? 8 : 5);

  if (!items.length)
    return (
      <EmptyState
        icon={Receipt}
        title="No outstanding bills"
        description="All supplier bills are paid. Add a bill to track what you owe here."
        actionLabel="New Bill"
        onAction={() => nav('/bills/new')}
      />
    );

  return (
    <div className="space-y-2">
      {items.map((b) => (
        <div key={b.id} className="rounded-lg border border-border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{b.supplier_name || '—'}</p>
              <p className="text-[11px] text-muted-foreground">
                {b.bill_number} · due {fmtDate(b.due_date)}
                {b.due_date < today && b.status !== 'awaiting_review' && <span className="text-rose-600 font-medium"> · overdue</span>}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold">{gbp(b.balance_due)}</p>
              <StatusBadge status={b.status} />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2">
            <Action icon={Eye} label="View" onClick={() => nav(`/bills/${b.id}`)} />
            <Action icon={Check} label="Approve" onClick={() => nav(`/bills/${b.id}`)} />
            <Action icon={CreditCard} label="Pay" onClick={() => nav(`/bills/${b.id}`)} />
            <Action icon={Sparkles} label="Ask" onClick={() => openAsk(`What's the status of bill ${b.bill_number}?`)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Action({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-muted hover:bg-muted/70 text-muted-foreground transition-colors"
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}