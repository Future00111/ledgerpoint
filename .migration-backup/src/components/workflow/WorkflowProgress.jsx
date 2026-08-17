import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { INVOICE_WORKFLOW_STAGES } from '@/lib/workflowEngine';

// Tone → Tailwind classes for stage chips.
const TONE = {
  slate: { ring: 'border-slate-400', solid: 'bg-slate-500', text: 'text-slate-600', badge: 'bg-slate-100 text-slate-700' },
  blue: { ring: 'border-blue-400', solid: 'bg-blue-500', text: 'text-blue-600', badge: 'bg-blue-50 text-blue-700' },
  indigo: { ring: 'border-indigo-400', solid: 'bg-indigo-500', text: 'text-indigo-600', badge: 'bg-indigo-50 text-indigo-700' },
  amber: { ring: 'border-amber-400', solid: 'bg-amber-500', text: 'text-amber-600', badge: 'bg-amber-50 text-amber-700' },
  orange: { ring: 'border-orange-400', solid: 'bg-orange-500', text: 'text-orange-600', badge: 'bg-orange-50 text-orange-700' },
  rose: { ring: 'border-rose-400', solid: 'bg-rose-500', text: 'text-rose-600', badge: 'bg-rose-50 text-rose-700' },
  emerald: { ring: 'border-emerald-400', solid: 'bg-emerald-500', text: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700' },
  muted: { ring: 'border-border', solid: 'bg-muted-foreground', text: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground' },
};

// WorkflowProgress — the reusable stage indicator. Shows every stage with
// ✓ for completed stages, the current stage highlighted in its tone, and
// ○ for upcoming stages. Used on the Invoice page and any workspace.
export default function WorkflowProgress({ stage, stages = INVOICE_WORKFLOW_STAGES, title = 'Invoice Workflow', compact = false }) {
  const currentOrder = stage?.order || 0;
  const tone = TONE[stage?.tone] || TONE.muted;

  return (
    <Card className="border shadow-sm">
      <CardContent className={cn('p-4', compact && 'p-3')}>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <p className="text-sm font-semibold">{title}</p>
          {stage && (
            <Badge variant="secondary" className={tone.badge}>
              {stage.isFinal ? 'Complete' : stage.isCancelled ? 'Cancelled' : `Stage ${currentOrder} of ${stages.length}`} · {stage.label}
            </Badge>
          )}
        </div>

        <div className="flex items-stretch overflow-x-auto pb-1 -mx-1 px-1">
          {stages.map((s, i) => {
            const done = s.order < currentOrder;
            const current = s.order === currentOrder;
            const t = TONE[s.tone] || TONE.muted;
            return (
              <div key={s.key} className="flex items-center flex-shrink-0">
                <div className="flex flex-col items-center gap-1" style={{ minWidth: 58 }}>
                  <span
                    className={cn(
                      'flex items-center justify-center w-7 h-7 rounded-full border-2 text-[11px] font-semibold',
                      done && 'bg-primary border-primary text-primary-foreground',
                      current && cn('bg-card', t.ring, t.text, 'shadow-sm'),
                      !done && !current && 'bg-card border-border text-muted-foreground/40'
                    )}
                  >
                    {done ? <Check className="w-3.5 h-3.5" /> : current ? <span className={cn('w-2.5 h-2.5 rounded-full', t.solid)} /> : s.order}
                  </span>
                  <span className={cn(
                    'text-[10px] leading-tight text-center whitespace-nowrap',
                    current ? cn('font-semibold', t.text) : done ? 'text-foreground' : 'text-muted-foreground/50'
                  )}>
                    {s.label}
                  </span>
                </div>
                {i < stages.length - 1 && (
                  <span className={cn('h-px w-3 sm:w-5 mt-[14px] flex-shrink-0', done ? 'bg-primary/40' : 'bg-border')} />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}