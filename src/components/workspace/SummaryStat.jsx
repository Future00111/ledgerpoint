import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

// Reusable summary stat tile used in Workspace headers and financial cards.
// tone drives the value colour: rose (risk), emerald (positive), amber (caution).
export default function SummaryStat({ label, value, tone, hint, helper, loading, onClick }) {
  const toneCls =
    tone === 'rose' ? 'text-rose-600'
    : tone === 'emerald' ? 'text-emerald-600'
    : tone === 'amber' ? 'text-amber-600'
    : 'text-foreground';

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
      className={cn('group rounded-xl border border-border bg-card p-4 transition-all', onClick && 'cursor-pointer hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring')}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {onClick && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />}
      </div>
      <p className={cn('text-xl font-semibold mt-1 tabular-nums', toneCls)}>
        {loading ? '…' : value}
      </p>
      {helper && onClick && !loading ? (
        <p className="text-[11px] text-primary/80 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">{helper}</p>
      ) : hint && !loading ? (
        <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
      ) : null}
    </div>
  );
}