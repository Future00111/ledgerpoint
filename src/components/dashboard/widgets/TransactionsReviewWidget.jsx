import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState } from '../WidgetPrimitives';
import { gbp, fmtDate } from '@/lib/format';
import { ArrowLeftRight } from 'lucide-react';

export default function TransactionsReviewWidget({ company, h }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, (cid) =>
    base44.entities.BankTransaction.filter({ company_id: cid, status: 'review' }, '-date', 200)
  );

  if (loading) return <ListSkeleton />;
  const items = (data || []).slice(0, h === 2 ? 10 : 6);
  if (!items.length)
    return <EmptyState icon={ArrowLeftRight} title="Nothing to review" description="All bank transactions are matched. Great work!" />;

  return (
    <div className="space-y-1">
      {items.map((t) => (
        <button key={t.id} onClick={() => nav('/transactions')} className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted text-left">
          <span className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{t.description}</p>
            <p className="text-[11px] text-muted-foreground">{fmtDate(t.date)} · {t.bank_account_name || ''}</p>
          </span>
          <span className="text-sm font-semibold flex-shrink-0">{gbp((Number(t.money_in) || 0) - (Number(t.money_out) || 0))}</span>
        </button>
      ))}
    </div>
  );
}