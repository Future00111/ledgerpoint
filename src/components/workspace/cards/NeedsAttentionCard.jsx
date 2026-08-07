import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const SEVERITY = {
  critical: 'text-rose-600 bg-rose-50 border-rose-200',
  warning: 'text-amber-600 bg-amber-50 border-amber-200',
  info: 'text-blue-600 bg-blue-50 border-blue-200',
};

// Reusable "What Needs Attention" widget — shows only important, actionable
// items computed from the record's data. If nothing requires action, shows a
// positive "in good standing" state. Each item opens the related record.
export default function NeedsAttentionCard({ items = [] }) {
  if (!items.length) {
    return (
      <Card className="border border-emerald-200 bg-emerald-50/50 shadow-sm">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-700">Nothing needs your attention</p>
            <p className="text-xs text-emerald-600/80">This customer is in good standing.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">What needs attention</p>
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li
              key={i}
              role={it.onClick ? 'button' : undefined}
              tabIndex={it.onClick ? 0 : undefined}
              onClick={it.onClick}
              onKeyDown={(e) => {
                if (it.onClick && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  it.onClick();
                }
              }}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5',
                SEVERITY[it.severity] || SEVERITY.info,
                it.onClick && 'cursor-pointer hover:shadow-sm transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{it.label}</p>
                {it.detail && <p className="text-xs opacity-80">{it.detail}</p>}
              </div>
              {it.onClick && <ArrowRight className="w-4 h-4 flex-shrink-0" />}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}