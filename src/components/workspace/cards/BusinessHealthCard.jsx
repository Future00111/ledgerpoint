import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// Reusable Business Health card — a 0–100 score with a progress bar, a one-line
// verdict and a breakdown of the factors behind it.
export default function BusinessHealthCard({ score = 0, label, factors = [] }) {
  const tone =
    score >= 75 ? 'text-emerald-600'
    : score >= 50 ? 'text-amber-600'
    : 'text-rose-600';

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Health</p>
          <span className={cn('text-2xl font-semibold tabular-nums', tone)}>{Math.round(score)}</span>
        </div>
        <Progress value={score} className="mt-2 h-2" />
        <p className="text-sm font-medium mt-2">{label}</p>
        {factors.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {factors.map((f, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{f.label}</span>
                <span className={cn('font-medium', f.positive ? 'text-emerald-600' : 'text-amber-600')}>
                  {f.value}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}