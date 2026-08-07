import React from 'react';
import { cn } from '@/lib/utils';

// Reusable summary stat tile used in Workspace headers and financial cards.
// tone drives the value colour: rose (risk), emerald (positive), amber (caution).
export default function SummaryStat({ label, value, tone, hint, loading }) {
  const toneCls =
    tone === 'rose' ? 'text-rose-600'
    : tone === 'emerald' ? 'text-emerald-600'
    : tone === 'amber' ? 'text-amber-600'
    : 'text-foreground';

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-xl font-semibold mt-1 tabular-nums', toneCls)}>
        {loading ? '…' : value}
      </p>
      {hint && !loading && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}