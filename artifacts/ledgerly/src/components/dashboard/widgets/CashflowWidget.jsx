import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWidgetData } from '../useWidgetData';
import { Skeleton, EmptyState } from '../WidgetPrimitives';
import { gbp } from '@/lib/format';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Brush } from 'recharts';
import { TrendingUp } from 'lucide-react';

const RANGES = [
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '12M', days: 365 },
];

export default function CashflowWidget({ company, h }) {
  const nav = useNavigate();
  const [range, setRange] = useState(30);
  const { data, loading } = useWidgetData(company?.id, async (cid) => {
    const [accts, txns] = await Promise.all([
      base44.entities.BankAccount.filter({ company_id: cid }),
      base44.entities.BankTransaction.filter({ company_id: cid }, '-date', 1000),
    ]);
    return { accts, txns };
  });

  const chartH = h === 2 ? 320 : 170;

  const series = useMemo(() => {
    if (!data) return [];
    const balance = (data.accts || []).reduce((s, a) => s + (Number(a.current_balance) || 0), 0);
    const now = new Date();
    const start = new Date(now.getTime() - range * 86400000);
    const inRange = (data.txns || []).filter((t) => {
      const d = new Date(t.date);
      return d >= start && d <= now;
    });
    const net = inRange.reduce((s, t) => s + (Number(t.money_in) || 0) - (Number(t.money_out) || 0), 0);
    const startBal = balance - net;
    const buckets = {};
    inRange.forEach((t) => {
      buckets[t.date] = (buckets[t.date] || 0) + (Number(t.money_in) || 0) - (Number(t.money_out) || 0);
    });
    let running = startBal;
    const out = [];
    for (let i = 0; i <= range; i++) {
      const d = new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10);
      running += buckets[d] || 0;
      out.push({ date: d.slice(5), value: Math.round(running) });
    }
    return out;
  }, [data, range]);

  if (loading) return <Skeleton className="w-full" style={{ height: chartH }} />;
  if (!data || ((data.txns || []).length === 0 && (data.accts || []).length === 0))
    return (
      <EmptyState
        icon={TrendingUp}
        title="No cashflow data yet"
        description="Connect a bank account or import transactions to see your cash position over time."
        actionLabel="Go to Banking"
        onAction={() => nav('/bank-accounts')}
      />
    );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 mb-2">
        {RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setRange(r.days)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              range === r.days ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={chartH}>
        <AreaChart data={series} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
            width={48}
          />
          <Tooltip formatter={(v) => gbp(v)} contentStyle={{ fontSize: 12, borderRadius: 8, padding: '6px 10px' }} />
          {range >= 90 && <Brush dataKey="date" height={18} stroke="hsl(var(--primary))" fill="hsl(var(--muted))" travellerWidth={6} />}
          <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#cf)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}