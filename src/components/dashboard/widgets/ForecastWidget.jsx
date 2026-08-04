import React from 'react';
import { base44 } from '@/api/base44Client';
import { useAsk } from '@/components/ask/AskProvider';
import { useWidgetData } from '../useWidgetData';
import { Skeleton, EmptyState } from '../WidgetPrimitives';
import { gbp } from '@/lib/format';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { TrendingUp, Sparkles } from 'lucide-react';

const ACTIVE = ['approved', 'sent', 'part_paid', 'paid', 'overdue'];

export default function ForecastWidget({ company, h }) {
  const { openAsk } = useAsk();
  const { data, loading } = useWidgetData(company?.id, (cid) =>
    base44.entities.SalesInvoice.filter({ company_id: cid }, '-issue_date', 2000)
  );

  if (loading) return <Skeleton className="h-32 w-full" />;
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-GB', { month: 'short' }), actual: 0 });
  }
  const map = Object.fromEntries(months.map((m) => [m.key, m]));
  (data || []).forEach((i) => {
    const m = map[(i.issue_date || '').slice(0, 7)];
    if (m && ACTIVE.includes(i.status)) m.actual += Number(i.total) || 0;
  });
  const recent = months.slice(-3).filter((m) => m.actual > 0);
  const trend = recent.length ? recent.reduce((s, m) => s + m.actual, 0) / recent.length : 0;

  if ((data || []).length === 0 || trend === 0)
    return <EmptyState icon={TrendingUp} title="No data to forecast" description="Create invoices to generate a revenue forecast." askLabel="Ask AI" onAsk={() => openAsk('Forecast my next 3 months')} />;

  const proj = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    proj.push({ label: d.toLocaleDateString('en-GB', { month: 'short' }), projected: Math.round(trend) });
  }
  const chart = [...months.map((m) => ({ label: m.label, actual: m.actual })), ...proj];

  return (
    <div className="flex flex-col h-full">
      <p className="text-[11px] text-muted-foreground font-medium mb-1">Revenue forecast · next 3 months</p>
      <ResponsiveContainer width="100%" height={h === 2 ? 220 : 120}>
        <ComposedChart data={chart}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
          <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} width={40} />
          <Tooltip formatter={(v) => (v ? gbp(v) : v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          <Bar dataKey="actual" name="Actual" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} barSize={8} />
          <Line type="monotone" dataKey="projected" name="Projected" stroke="hsl(var(--chart-2))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <button onClick={() => openAsk('Forecast my revenue and cashflow for the next 3 months')} className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:underline">
        <Sparkles className="w-3.5 h-3.5" />
        Ask AI for a detailed forecast
      </button>
    </div>
  );
}