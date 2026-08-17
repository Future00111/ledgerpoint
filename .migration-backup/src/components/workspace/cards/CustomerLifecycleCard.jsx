import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONE = {
  emerald: 'bg-emerald-500 border-emerald-500 text-white',
  amber: 'bg-amber-500 border-amber-500 text-white',
  rose: 'bg-rose-500 border-rose-500 text-white',
  primary: 'bg-primary border-primary text-primary-foreground',
  muted: 'bg-muted-foreground/30 border-muted-foreground/30 text-foreground',
};

const TEXT_TONE = {
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  rose: 'text-rose-600',
  primary: 'text-primary',
  muted: 'text-muted-foreground',
};

const STAGES = ['New', 'Growing', 'Established', 'Declining', 'At-risk', 'Inactive'];

// Customer Lifecycle — one active state shown prominently with a supporting
// explanation beneath it; the remaining states appear muted so context is
// clear without competing for attention. Only one state is ever active.
export default function CustomerLifecycleCard({ stage = 'New', detail = '', tone = 'muted' }) {
  const activeTone = TONE[tone] || TONE.muted;
  const activeText = TEXT_TONE[tone] || 'text-muted-foreground';

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
            <Workflow className="w-4 h-4" />
          </div>
          <p className="text-sm font-semibold">Customer Lifecycle</p>
        </div>

        <span className={cn('inline-flex items-center rounded-md border-2 px-3 py-1 text-sm font-semibold', activeTone)}>
          {stage}
        </span>
        <p className={cn('text-xs leading-relaxed mt-2.5 mb-3', activeText)}>{detail}</p>

        <div className="flex flex-wrap gap-1.5">
          {STAGES.map((s) => {
            const active = s === stage;
            return (
              <span
                key={s}
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                  active ? activeTone : 'border-border text-muted-foreground/45 bg-transparent'
                )}
              >
                {s}
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}