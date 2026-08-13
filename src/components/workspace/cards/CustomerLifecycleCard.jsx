import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONE = {
  emerald: 'bg-emerald-500 text-emerald-600 border-emerald-200',
  amber: 'bg-amber-500 text-amber-600 border-amber-200',
  rose: 'bg-rose-500 text-rose-600 border-rose-200',
  primary: 'bg-primary text-primary border-primary/20',
  muted: 'bg-muted-foreground text-muted-foreground border-border',
};

const STAGES = ['New', 'Growing', 'Established', 'Declining', 'At-risk', 'Inactive'];

// Customer Lifecycle — classifies the customer into a lifecycle stage and
// shows where they sit across the full lifecycle spectrum. Data-driven.
export default function CustomerLifecycleCard({ stage = 'New', detail = '', tone = 'muted' }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-3.5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
            <Workflow className="w-4 h-4" />
          </div>
          <p className="text-sm font-semibold">Customer Lifecycle</p>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border', TONE[tone] || TONE.muted)}>
            {stage}
          </span>
          <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STAGES.map((s) => (
            <span
              key={s}
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                s === stage ? (TONE[tone] || TONE.muted) : 'border-border text-muted-foreground/60 bg-transparent'
              )}
            >
              {s}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}