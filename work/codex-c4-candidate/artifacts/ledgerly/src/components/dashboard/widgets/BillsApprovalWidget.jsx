import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState } from '../WidgetPrimitives';
import { gbp, fmtDate } from '@/lib/format';
import { Receipt } from 'lucide-react';

export default function BillsApprovalWidget({ company, h }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, (cid) =>
    base44.entities.PurchaseBill.filter({ company_id: cid, status: { $in: ['awaiting_review', 'draft'] } }, '-bill_date', 200)
  );

  if (loading) return <ListSkeleton />;
  const items = (data || []).slice(0, h === 2 ? 10 : 6);
  if (!items.length)
    return <EmptyState icon={Receipt} title="No bills awaiting approval" description="Supplier bills ready for approval will appear here." />;

  return (
    <div className="space-y-1">
      {items.map((b) => (
        <button key={b.id} onClick={() => nav(`/bills/${b.id}`)} className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted text-left">
          <span className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{b.supplier_name}</p>
            <p className="text-[11px] text-muted-foreground">{b.bill_number} · {fmtDate(b.bill_date)}</p>
          </span>
          <span className="text-sm font-semibold flex-shrink-0">{gbp(b.total)}</span>
        </button>
      ))}
    </div>
  );
}