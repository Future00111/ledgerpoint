import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const TONE = {
  emerald: { text: 'text-emerald-600', ring: 'stroke-emerald-500' },
  amber: { text: 'text-amber-600', ring: 'stroke-amber-500' },
  rose: { text: 'text-rose-600', ring: 'stroke-rose-500' },
};

// Reusable Customer Health indicator — a compact circular score with a tier
// label (Excellent / Good / Monitor / Needs Attention / At Risk) and a concise,
// data-grounded explanation. Reusable across all future Workspaces.
export default function CustomerHealthCard({ score = 0, label = '—', tone = 'emerald', explanation = '' }) {
  const t = TONE[tone] || TONE.emerald;
  const r = 18;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = c - (clamped / 100) * c;

  return (
    <Card className="border shadow-sm h-full">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 flex-shrink-0">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
              <circle cx="20" cy="20" r={r} className="stroke-muted" strokeWidth="4" fill="none" />
              <circle
                cx="20" cy="20" r={r}
                className={cn(t.ring)}
                strokeWidth="4" fill="none" strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <span className={cn('absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums', t.text)}>
              {clamped}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Customer Health</p>
            <p className={cn('text-sm font-semibold', t.text)}>{label}</p>
            {explanation && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{explanation}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}