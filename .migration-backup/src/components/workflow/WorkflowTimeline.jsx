import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Check, History } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

// WorkflowTimeline — the permanent activity history rendered as a visual
// timeline. Every event shows timestamp, user, action and notes.
export default function WorkflowTimeline({ events = [], maxHeight = '24rem', emptyLabel = 'No activity recorded yet.' }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
            <History className="w-4 h-4" />
          </div>
          <p className="text-sm font-semibold">Workflow Timeline</p>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{emptyLabel}</p>
        ) : (
          <div className="overflow-y-auto pr-1" style={{ maxHeight }}>
            <ol>
              {events.map((e, i) => (
                <li key={e.id || i} className="flex gap-3 pb-3 last:pb-0 relative">
                  {i < events.length - 1 && <span className="absolute left-[11px] top-6 bottom-0 w-px bg-border" />}
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary flex-shrink-0 z-10">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{e.label}</p>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{fmt(e.timestamp)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {e.user}{e.notes ? ` · ${e.notes}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}