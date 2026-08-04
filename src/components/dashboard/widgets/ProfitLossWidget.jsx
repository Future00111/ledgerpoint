import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { ListSkeleton, EmptyState } from '../WidgetPrimitives';
import { gbp } from '@/lib/format';
import { BarChart3 } from 'lucide-react';

const ACTIVE = ['approved', 'sent', 'part_paid', 'paid', 'overdue'];
const COS = ['parts', 'tools', 'fuel'];
const EXP = ['rent', 'utilities', 'insurance', 'wages', 'office', 'professional_fees', 'other'];

export default function ProfitLossWidget({ company }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const [inv, bills] = await Promise.all([
      base44.entities.SalesInvoice.filter({ company_id: cid }, '-issue_date', 5000),
      base44.entities.PurchaseBill.filter({ company_id: cid }, '-bill_date', 5000),
    ]);
    return { inv, bills };
  });

  if (loading) return <ListSkeleton rows={5} />;
  const { inv, bills } = data || {};
  const revenue = (inv || []).filter((i) => ACTIVE.includes(i.status)).reduce((s, i) => s + (Number(i.total) || 0), 0);
  const cos = (bills || []).filter((b) => ACTIVE.includes(b.status) && COS.includes(b.category)).reduce((s, b) => s + (Number(b.total) || 0), 0);
  const expenses = (bills || []).filter((b) => ACTIVE.includes(b.status) && EXP.includes(b.category)).reduce((s, b) => s + (Number(b.total) || 0), 0);
  const gross = revenue - cos;
  const net = gross - expenses;

  if (revenue === 0 && cos === 0 && expenses === 0)
    return <EmptyState icon={BarChart3} title="No P&L data yet" description="Post invoices and bills to generate a profit & loss statement." />;

  const rows = [
    ['Revenue', revenue],
    ['Cost of Sales', -cos],
    ['Gross Profit', gross],
    ['Expenses', -expenses],
    ['Net Profit', net],
  ];

  return (
    <div className="space-y-1.5">
      {rows.map(([label, val]) => (
        <div key={label} className={`flex items-center justify-between py-1.5 ${label.includes('Profit') ? 'border-t border-border/60 font-semibold' : ''}`}>
          <span className="text-sm">{label}</span>
          <span className={`text-sm font-semibold ${val < 0 ? 'text-rose-600' : ''}`}>{gbp(val)}</span>
        </div>
      ))}
      <button onClick={() => nav('/reports')} className="w-full text-xs text-primary hover:underline mt-2 text-center">
        View full report
      </button>
    </div>
  );
}