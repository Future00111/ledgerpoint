import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState } from '../WidgetPrimitives';
import { gbp } from '@/lib/format';
import { Receipt } from 'lucide-react';

const ACTIVE = ['approved', 'part_paid', 'paid', 'overdue'];

export default function TopExpensesWidget({ company }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, (cid) =>
    base44.entities.PurchaseBill.filter({ company_id: cid }, '-bill_date', 2000)
  );

  if (loading) return <ListSkeleton rows={5} />;
  const map = {};
  (data || []).forEach((b) => {
    if (ACTIVE.includes(b.status)) {
      const n = b.supplier_name || '—';
      map[n] = (map[n] || 0) + (Number(b.total) || 0);
    }
  });
  const top = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!top.length)
    return <EmptyState icon={Receipt} title="No expenses yet" description="Top suppliers by spend will appear here." actionLabel="Add Bill" onAction={() => nav('/bills/new')} />;

  const max = top[0][1];
  return (
    <div className="space-y-2">
      {top.map(([name, val], i) => (
        <button key={name} onClick={() => nav('/suppliers')} className="w-full text-left">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium truncate">{i + 1}. {name}</span>
            <span className="font-semibold">{gbp(val)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-chart-3" style={{ width: `${max ? (val / max) * 100 : 0}%` }} />
          </div>
        </button>
      ))}
    </div>
  );
}