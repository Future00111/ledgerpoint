import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import WorkspaceEmptyState from '../WorkspaceEmptyState';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

// Reusable Related Records card — one or more titled sections of clickable rows.
// Each row: { primary, secondary, amount, onClick }. Rows open their record
// directly (One Click Rule); negative amounts render as credits.
export default function RelatedRecordsCard({ sections = [] }) {
  const hasAny = sections.some((s) => s.records?.length);

  if (!hasAny) {
    return (
      <WorkspaceEmptyState
        icon={Link2}
        title="No related records"
        description="Related invoices, payments, credit notes and documents will appear here automatically."
      />
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((s, si) =>
        s.records?.length > 0 ? (
          <Card key={si} className="border shadow-sm">
            <CardContent className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {s.title}
              </p>
              <div className="space-y-1.5">
                {s.records.map((r, i) => (
                  <div
                    key={i}
                    role="button"
                    tabIndex={0}
                    onClick={() => r.onClick?.()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        r.onClick?.();
                      }
                    }}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm cursor-pointer hover:bg-muted/30 hover:border-primary/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.primary}</p>
                      {r.secondary && <p className="text-xs text-muted-foreground truncate">{r.secondary}</p>}
                    </div>
                    {r.amount != null && (
                      <span
                        className={cn(
                          'font-medium tabular-nums flex-shrink-0 ml-3',
                          r.amount < 0 ? 'text-emerald-600' : 'text-foreground'
                        )}
                      >
                        {r.amount < 0 ? '-' : ''}{gbp.format(Math.abs(Number(r.amount) || 0))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null
      )}
    </div>
  );
}