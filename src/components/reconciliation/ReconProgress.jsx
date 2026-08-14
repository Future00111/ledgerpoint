import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';

// Reconciliation progress — completion %, reconciled vs remaining, est. time.
export default function ReconProgress({ metrics }) {
  const m = metrics || {};
  const pct = m.completionPct ?? 100;
  const remaining = m.remaining ?? 0;
  return (
    <div className="rounded-xl border bg-card shadow-sm p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold">Reconciliation Progress</p>
        <span className={`text-2xl font-semibold tracking-tight ${remaining === 0 ? 'text-emerald-600' : 'text-foreground'}`}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${remaining === 0 ? 'bg-emerald-500' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> {m.reconciled ?? 0} reconciled</span>
        <span>{remaining} remaining</span>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2">
        <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          {remaining === 0
            ? 'All transactions reconciled — nothing left to do.'
            : <>Estimated completion time: <span className="font-medium text-foreground">{m.estimatedLabel}</span></>}
        </p>
      </div>
    </div>
  );
}