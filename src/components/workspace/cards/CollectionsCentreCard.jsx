import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Gavel, ArrowRight, Clock, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const LEGAL_TONE = {
  emerald: 'text-emerald-600',
  amber: 'text-amber-600',
  rose: 'text-rose-600',
  muted: 'text-muted-foreground',
};

// Collections Centre — a proactive command module showing the current
// collection stage, legal status, next recommended action, the oldest
// outstanding invoice and recent collection history. Every record is
// clickable to open the underlying invoice.
export default function CollectionsCentreCard({
  stage = 0, stageLabel = 'Clear',
  nextAction, onNextAction,
  oldestInvoice, onOpenOldest,
  legalStatus = 'Clear', legalTone = 'emerald',
  history = [],
}) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-3.5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
              <Gavel className="w-4 h-4" />
            </div>
            <p className="text-sm font-semibold">Collections Centre</p>
          </div>
          {stage > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
              Stage {stage}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Collection Stage</p>
            <p className="text-sm font-semibold mt-0.5">{stageLabel}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Legal Status</p>
            <p className={cn('text-sm font-semibold mt-0.5', LEGAL_TONE[legalTone] || LEGAL_TONE.muted)}>{legalStatus}</p>
          </div>
        </div>

        {oldestInvoice ? (
          <button
            type="button"
            onClick={onOpenOldest}
            className="w-full flex items-center justify-between gap-2 rounded-md border border-border hover:bg-muted/30 transition-colors px-2.5 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Oldest Outstanding</p>
              <p className="text-sm font-semibold truncate">{oldestInvoice.number} · {oldestInvoice.days} days overdue</p>
            </div>
            <ArrowRight className="w-4 h-4 text-primary flex-shrink-0" />
          </button>
        ) : (
          <p className="text-xs text-muted-foreground">No outstanding invoices — account is clear.</p>
        )}

        {nextAction && (
          <Button onClick={onNextAction} className="w-full mt-3 gap-1.5" size="sm">
            {nextAction} <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}

        {history.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground mb-1.5">Collection History</p>
            <ul className="space-y-1">
              {history.map((h, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={h.onClick}
                    className="w-full flex items-center justify-between gap-2 rounded-md hover:bg-muted/30 px-1.5 py-1 text-left transition-colors"
                  >
                    <span className="text-xs font-medium truncate inline-flex items-center gap-1.5">
                      <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" /> {h.reference}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{h.detail}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}