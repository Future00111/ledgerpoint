import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Gavel, ArrowRight, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ConfirmActionButton from './ConfirmActionButton';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const STAGES = [
  { n: 1, label: 'Reminder', tone: 'amber' },
  { n: 2, label: 'Escalation', tone: 'amber' },
  { n: 3, label: 'Final demand', tone: 'amber' },
  { n: 4, label: 'Account on hold', tone: 'rose' },
  { n: 5, label: 'Legal action', tone: 'rose' },
];

const STAGE_TONE = {
  amber: { node: 'bg-amber-500 border-amber-500 text-white', text: 'text-amber-600' },
  rose: { node: 'bg-rose-500 border-rose-500 text-white', text: 'text-rose-600' },
  emerald: { node: 'bg-emerald-500 border-emerald-500 text-white', text: 'text-emerald-600' },
};

const LEGAL_TONE = {
  emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600', muted: 'text-muted-foreground',
};

// Collections Centre — proactive command module with a 5-stage visual
// progression (Reminder → Escalation → Final demand → Account on hold →
// Legal action), legal status, oldest outstanding invoice, days overdue,
// total overdue balance and collection history. Destructive next actions
// (hold, legal) require confirmation.
export default function CollectionsCentreCard({
  stage = 0, stageLabel = 'Clear', legalStatus = 'Clear', legalTone = 'emerald',
  oldestInvoice, onOpenOldest, totalOverdue = 0, overdueCount = 0, oldestDays = 0,
  history = [], nextAction,
}) {
  const clear = stage === 0;
  const activeTone = STAGES.find((s) => s.n === stage)?.tone || 'emerald';
  const tone = STAGE_TONE[activeTone];

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
              <Gavel className="w-4 h-4" />
            </div>
            <p className="text-sm font-semibold">Collections Centre</p>
          </div>
          {clear ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-0.5">
              <CheckCircle2 className="w-3 h-3" /> Clear
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5">
              Stage {stage} of 5
            </span>
          )}
        </div>

        {/* 5-stage progression */}
        <div className="flex items-start mb-4">
          {STAGES.map((s, i) => {
            const done = !clear && s.n < stage;
            const active = !clear && s.n === stage;
            const sTone = STAGE_TONE[s.tone];
            return (
              <React.Fragment key={s.n}>
                <div className="flex flex-col items-center min-w-0 flex-1">
                  <span className={cn(
                    'flex items-center justify-center w-6 h-6 rounded-full border-2 text-[11px] font-semibold transition-colors',
                    active ? sTone.node
                      : done ? 'bg-primary/15 border-primary/40 text-primary'
                      : 'bg-card border-border text-muted-foreground/40'
                  )}>
                    {done ? '✓' : s.n}
                  </span>
                  <span className={cn(
                    'text-[9px] mt-1 text-center leading-tight',
                    active ? 'font-semibold ' + sTone.text : done ? 'text-primary/70' : 'text-muted-foreground/40'
                  )}>
                    {s.label}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div className={cn('h-0.5 mt-3 flex-1', done ? 'bg-primary/30' : 'bg-border')} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {clear ? (
          <p className="text-sm text-muted-foreground">No outstanding invoices — account is clear. No collections action required.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-2.5">
              <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
                <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Total Overdue</p>
                <p className="text-sm font-semibold mt-0.5 tabular-nums">{gbp.format(totalOverdue)}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
                <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Days Overdue</p>
                <p className="text-sm font-semibold mt-0.5 tabular-nums">{oldestDays}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
                <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Overdue</p>
                <p className="text-sm font-semibold mt-0.5 tabular-nums">{overdueCount}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2.5">
              <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2 min-w-0">
                <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Collection Stage</p>
                <p className={cn('text-sm font-semibold mt-0.5 truncate', tone.text)}>{stageLabel}</p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2 min-w-0">
                <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Legal Status</p>
                <p className={cn('text-sm font-semibold mt-0.5 truncate', LEGAL_TONE[legalTone] || LEGAL_TONE.muted)}>{legalStatus}</p>
              </div>
            </div>

            {oldestInvoice && (
              <button
                type="button"
                onClick={onOpenOldest}
                className="w-full flex items-center justify-between gap-2 rounded-md border border-border hover:bg-muted/30 transition-colors px-2.5 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring mb-3"
              >
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Oldest Outstanding</p>
                  <p className="text-sm font-semibold truncate">{oldestInvoice.number} · {oldestInvoice.days} days</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold tabular-nums">{gbp.format(oldestInvoice.amount)}</span>
                  <ArrowRight className="w-4 h-4 text-primary" />
                </div>
              </button>
            )}

            {nextAction && (
              <ConfirmActionButton
                label={nextAction.label}
                onClick={nextAction.onClick}
                destructive={nextAction.destructive}
                description={nextAction.description}
                className="w-full"
              />
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
                        <span className="text-xs font-medium truncate">{h.reference}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{h.detail}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}