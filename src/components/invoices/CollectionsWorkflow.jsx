import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Gavel, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONE = { emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600' };

// Collections Workflow — a vertical 5-stage progress tracker showing what has
// already happened (✓) and the next action required (○).
export default function CollectionsWorkflow({ stages = [], stageNum = 0 }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
            <Gavel className="w-4 h-4" />
          </div>
          <p className="text-sm font-semibold">Collections Workflow</p>
          {stageNum > 0 && <span className="ml-auto text-xs text-muted-foreground">Stage {stageNum} of 5</span>}
        </div>

        <ol>
          {stages.map((s, i) => (
            <li key={s.n} className="flex items-start gap-3 pb-3 last:pb-0 relative">
              {i < stages.length - 1 && (
                <span className={cn('absolute left-[11px] top-6 bottom-1 w-px', s.done ? 'bg-primary/40' : 'bg-border')} />
              )}
              <span className={cn(
                'flex items-center justify-center w-6 h-6 rounded-full border-2 text-[11px] font-semibold flex-shrink-0 z-10 bg-card',
                s.done ? 'bg-primary border-primary text-primary-foreground'
                  : s.next ? 'border-primary text-primary'
                  : 'border-border text-muted-foreground/40'
              )}>
                {s.done ? <Check className="w-3.5 h-3.5" /> : s.n}
              </span>
              <div className="pt-0.5">
                <p className={cn('text-sm font-medium', s.done ? 'text-foreground' : s.next ? TONE[s.tone] : 'text-muted-foreground/50')}>
                  {s.label}
                </p>
                {s.done && <p className="text-[11px] text-emerald-600">Completed</p>}
                {s.next && <p className="text-[11px] text-muted-foreground">Next action</p>}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}