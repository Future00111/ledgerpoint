import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState } from '../WidgetPrimitives';
import { gbp, fmtDate } from '@/lib/format';
import { BookOpen } from 'lucide-react';

export default function GeneralLedgerWidget({ company, h }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, (cid) =>
    base44.entities.JournalEntry.filter({ company_id: cid }, '-date', 200)
  );

  if (loading) return <ListSkeleton />;
  const items = (data || []).slice(0, h === 2 ? 12 : 8);
  if (!items.length)
    return <EmptyState icon={BookOpen} title="No journal entries" description="Posted transactions will appear in your general ledger." actionLabel="Go to Ledger" onAction={() => nav('/general-ledger')} />;

  return (
    <div className="space-y-1">
      {items.map((j) => (
        <button key={j.id} onClick={() => nav('/general-ledger')} className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted text-left">
          <span className="text-[10px] text-muted-foreground w-16 flex-shrink-0">{fmtDate(j.date)}</span>
          <span className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{j.account_name || j.account_code}</p>
            <p className="text-[10px] text-muted-foreground truncate">{j.reference} · {j.description}</p>
          </span>
          <span className="text-xs font-semibold flex-shrink-0">{j.debit ? gbp(j.debit) : gbp(-(j.credit || 0))}</span>
        </button>
      ))}
    </div>
  );
}