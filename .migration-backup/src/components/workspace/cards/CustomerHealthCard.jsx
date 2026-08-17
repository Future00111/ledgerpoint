import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const TONE = {
  emerald: { text: 'text-emerald-600', ring: 'stroke-emerald-500', bg: 'bg-emerald-50' },
  amber: { text: 'text-amber-600', ring: 'stroke-amber-500', bg: 'bg-amber-50' },
  rose: { text: 'text-rose-600', ring: 'stroke-rose-500', bg: 'bg-rose-50' },
};

// Reusable Customer Health indicator — a circular score with a tier label,
// split into Historical payment behaviour and Current account status so a
// historically reliable customer with a large overdue balance is still
// flagged. Falls back to a single `explanation` line for older callers.
export default function CustomerHealthCard({ score = 0, label = '—', tone = 'emerald', historical, current, currentTone, explanation = '' }) {
  const t = TONE[tone] || TONE.emerald;
  const ct = TONE[currentTone] || TONE.amber;
  const r = 18;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = c - (clamped / 100) * c;

  return (
    <Card className="border shadow-sm h-full">
      <CardContent className="p-3.5">
        <div className="flex items-center gap-3 mb-3">
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
          </div>
        </div>
        {historical ? (
          <div className="mb-2.5">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground/80">Historical behaviour</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{historical}</p>
          </div>
        ) : null}
        {current ? (
          <div className={cn('rounded-md px-2.5 py-2', ct.bg)}>
            <p className={cn('text-[10px] uppercase font-semibold tracking-wide', ct.text)}>Current account status</p>
            <p className={cn('text-xs leading-relaxed mt-0.5', ct.text)}>{current}</p>
          </div>
        ) : explanation ? (
          <p className="text-xs text-muted-foreground leading-relaxed">{explanation}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}