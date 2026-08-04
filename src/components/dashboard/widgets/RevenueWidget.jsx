import React from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { Skeleton, EmptyState } from '../WidgetPrimitives';
import { gbp } from '@/lib/format';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

const ACTIVE = ['approved', 'sent', 'part_paid', 'paid', 'overdue'];

export default function RevenueWidget({ company }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, (cid) =>
    base44.entities.SalesInvoice.filter({ company_id: cid }, '-issue_date', 2000)
  );

  if (loading) return <Skeleton className="h-24 w-full" />;
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-GB', { month: 'short' }), v: 0 });
  }
  const map = Object.fromEntries(months.map((m) => [m.key, m]));
  (data || []).forEach((i) => {
    const m = map[(i.issue_date || '').slice(0, 7)];
    if (m && ACTIVE.includes(i.status)) m.v += Number(i.total) || 0;
  });
  const thisMonth = months[months.length - 1].v;
  const prev = months[months.length - 2]?.v || 0;

  if (thisMonth === 0 && prev === 0 && (data || []).length === 0)
    return <EmptyState icon={TrendingUp} title="No revenue yet" description="Create invoices to track revenue over time." actionLabel="New Invoice" onAction={() => nav('/invoices/new')} />;

  return (
    <div className="flex flex-col h-full">
      <p className="text-[11px] text-muted-foreground font-medium">Revenue this month</p>
      <p className="text-2xl font-semibold">{gbp(thisMonth)}</p>
      <p className="text-[11px] text-muted-foreground mb-2">
        {prev ? `${thisMonth >= prev ? '+' : ''}${(((thisMonth - prev) / Math.abs(prev)) * 100).toFixed(0)}% vs last month` : '—'}
      </p>
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={months}>
          <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} fill="hsl(var(--primary) / 0.15)" />
          <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v) => gbp(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}