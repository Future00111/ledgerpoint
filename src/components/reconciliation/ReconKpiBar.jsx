import React from 'react';
import { Landmark, Clock, Sparkles, AlertCircle, CheckCircle2, Hourglass } from 'lucide-react';
import { gbp } from '@/lib/format';

function Tile({ icon: Icon, label, value, hint, tone = 'default' }) {
  const tones = {
    default: 'text-foreground',
    positive: 'text-emerald-600',
    warning: 'text-amber-600',
    critical: 'text-rose-600',
  };
  return (
    <div className="rounded-xl border bg-card p-3.5 shadow-sm">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[11px] font-medium truncate">{label}</span>
      </div>
      <p className={`text-lg font-semibold tracking-tight ${tones[tone]}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
    </div>
  );
}

export default function ReconKpiBar({ metrics, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }
  const m = metrics || {};
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <Tile icon={Landmark} label="Total bank balance" value={gbp(m.totalBalance)} />
      <Tile icon={Hourglass} label="Awaiting reconciliation" value={m.reviewCount ?? 0} tone={m.reviewCount ? 'warning' : 'positive'} hint="transactions" />
      <Tile icon={Sparkles} label="Auto-matched" value={m.autoMatchableCount ?? 0} tone="positive" hint="ready to approve" />
      <Tile icon={AlertCircle} label="Requiring review" value={m.requiringReviewCount ?? 0} tone={m.requiringReviewCount ? 'warning' : 'positive'} hint="manual" />
      <Tile icon={CheckCircle2} label="Completion" value={`${m.completionPct ?? 100}%`} tone="positive" hint={`${m.reconciled ?? 0} of ${m.total ?? 0}`} />
      <Tile icon={Clock} label="Est. completion" value={m.estimatedLabel || 'Complete'} tone={m.remaining ? 'default' : 'positive'} hint={m.remaining ? `${m.remaining} remaining` : 'all done'} />
    </div>
  );
}