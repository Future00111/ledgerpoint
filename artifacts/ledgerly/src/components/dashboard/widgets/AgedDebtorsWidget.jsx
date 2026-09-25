import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState } from '../WidgetPrimitives';
import { gbp } from '@/lib/format';
import { FileText } from 'lucide-react';

export default function AgedDebtorsWidget({ company }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, (cid) =>
    base44.entities.SalesInvoice.filter({ company_id: cid }, '-due_date', 2000)
  );

  if (loading) return <ListSkeleton rows={5} />;
  const today = new Date();
  const items = (data || []).filter(
    (i) => ['approved', 'sent', 'part_paid', 'overdue'].includes(i.status) && (Number(i.balance_due) || 0) > 0
  );
  if (!items.length)
    return <EmptyState icon={FileText} title="No outstanding invoices" description="Aged debtors will appear here once you have unpaid invoices." />;

  const buckets = { current: 0, d30: 0, d60: 0, d90: 0 };
  items.forEach((i) => {
    const days = Math.floor((today - new Date(i.due_date)) / 86400000);
    const v = Number(i.balance_due) || 0;
    if (days <= 0) buckets.current += v;
    else if (days <= 30) buckets.d30 += v;
    else if (days <= 60) buckets.d60 += v;
    else buckets.d90 += v;
  });
  const total = buckets.current + buckets.d30 + buckets.d60 + buckets.d90;
  const rows = [['Current', buckets.current], ['1–30', buckets.d30], ['31–60', buckets.d60], ['60+', buckets.d90]];

  return (
    <div className="space-y-1.5">
      {rows.map(([label, val]) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-16">{label}</span>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${total ? (val / total) * 100 : 0}%` }} />
          </div>
          <span className="text-xs font-semibold w-20 text-right">{gbp(val)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        <span className="text-sm font-semibold">Total</span>
        <button onClick={() => nav('/invoices')} className="text-sm font-semibold text-primary hover:underline">{gbp(total)}</button>
      </div>
    </div>
  );
}