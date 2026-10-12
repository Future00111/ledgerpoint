import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { Skeleton, EmptyState } from '../WidgetPrimitives';
import { gbp } from '@/lib/format';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';

const ACTIVE = ['approved', 'sent', 'part_paid', 'paid', 'overdue'];
const BILL_ACTIVE = ['approved', 'part_paid', 'paid', 'overdue', 'awaiting_review'];

export default function ProfitWidget({ company, h }) {
  const nav = useNavigate();
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const [inv, bills] = await Promise.all([
      base44.entities.SalesInvoice.filter({ company_id: cid }, '-issue_date', 1000),
      base44.entities.PurchaseBill.filter({ company_id: cid }, '-bill_date', 1000),
    ]);
    return { inv, bills };
  });

  const chartH = h === 2 ? 320 : 170;

  const series = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: d.toISOString().slice(0, 7), label: d.toLocaleDateString('en-GB', { month: 'short' }), revenue: 0, cost: 0, profit: 0 });
    }
    const map = Object.fromEntries(months.map((m) => [m.key, m]));
    (data.inv || []).forEach((i) => {
      const m = map[(i.issue_date || '').slice(0, 7)];
      if (m && ACTIVE.includes(i.status)) m.revenue += Number(i.total) || 0;
    });
    (data.bills || []).forEach((b) => {
      const m = map[(b.bill_date || '').slice(0, 7)];
      if (m && BILL_ACTIVE.includes(b.status)) m.cost += Number(b.total) || 0;
    });
    months.forEach((m) => (m.profit = m.revenue - m.cost));
    return months;
  }, [data]);

  if (loading) return <Skeleton className="w-full" style={{ height: chartH }} />;
  if (!data || (data.inv || []).length === 0)
    return (
      <EmptyState
        icon={BarChart3}
        title="No profit data yet"
        description="Create invoices and bills to see your revenue, costs and profit trend over the last 12 months."
        actionLabel="Create Invoice"
        onAction={() => nav('/invoices/new')}
      />
    );

  return (
    <ResponsiveContainer width="100%" height={chartH}>
      <ComposedChart data={series} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} width={48} />
        <Tooltip formatter={(v) => gbp(v)} contentStyle={{ fontSize: 12, borderRadius: 8, padding: '6px 10px' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
        <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} barSize={10} />
        <Bar dataKey="cost" name="Cost of Sales" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} barSize={10} />
        <Line type="monotone" dataKey="profit" name="Profit" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}