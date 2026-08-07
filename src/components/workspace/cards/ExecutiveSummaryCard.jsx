import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONE = {
  positive: 'text-emerald-600 bg-emerald-100',
  warning: 'text-amber-600 bg-amber-100',
  critical: 'text-rose-600 bg-rose-100',
  info: 'text-blue-600 bg-blue-100',
};

// Reusable Executive Summary — concise, structured insight cards (not one long
// paragraph). Each insight explains one facet of the record with a tone-coded
// icon, a short title and a one-line data-grounded detail. Kept compact so it
// never dominates the page. Insights are computed by the Workspace from live
// data, so the summary is instant and deterministic.
export default function ExecutiveSummaryCard({ insights = [] }) {
  return (
    <Card className="border border-border bg-muted/30">
      <CardContent className="p-3.5">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Executive Summary</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-5 gap-y-2.5">
          {insights.map((it, i) => {
            const Icon = it.icon;
            const tone = TONE[it.tone] || TONE.info;
            return (
              <div key={i} className="flex items-start gap-2.5">
                <span className={cn('flex items-center justify-center w-7 h-7 rounded-full flex-shrink-0', tone)}>
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight">{it.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{it.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}