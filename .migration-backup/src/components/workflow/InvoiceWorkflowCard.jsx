import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Gavel } from 'lucide-react';
import { cn } from '@/lib/utils';
import { computeInvoiceStage, INVOICE_WORKFLOW_STAGES } from '@/lib/workflowEngine';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const TONE_BADGE = {
  slate: 'bg-slate-100 text-slate-700', blue: 'bg-blue-50 text-blue-700', indigo: 'bg-indigo-50 text-indigo-700',
  amber: 'bg-amber-50 text-amber-700', orange: 'bg-orange-50 text-orange-700', rose: 'bg-rose-50 text-rose-700',
  emerald: 'bg-emerald-50 text-emerald-700', muted: 'bg-muted text-muted-foreground',
};

// InvoiceWorkflowCard — workspace card for the Customer Workspace. Summarises
// the customer's invoices across the invoice workflow stages and surfaces the
// most-advanced (worst) stage so staff always know where the relationship sits.
export default function InvoiceWorkflowCard({ invoices = [], onOpenInvoice, onOpenCollections }) {
  const now = new Date();
  const rows = invoices.map((inv) => {
    const daysOverdue = inv.due_date && new Date(inv.due_date) < now && ['approved', 'sent', 'part_paid', 'overdue'].includes(inv.status)
      ? Math.floor((now - new Date(inv.due_date)) / 86400000) : 0;
    const stage = computeInvoiceStage(inv, { daysOverdue });
    return { inv, stage, daysOverdue, balance: Number(inv.balance_due) || 0 };
  });

  const counts = {};
  rows.forEach((r) => { counts[r.stage.key] = (counts[r.stage.key] || 0) + 1; });
  const activeStages = INVOICE_WORKFLOW_STAGES.filter((s) => counts[s.key]);

  const open = rows.filter((r) => r.inv.status !== 'cancelled' && r.inv.status !== 'paid');
  const worst = open.slice().sort((a, b) => b.stage.order - a.stage.order)[0] || null;
  const overdueTotal = rows.filter((r) => r.daysOverdue > 0).reduce((s, r) => s + r.balance, 0);
  const top = open.slice().sort((a, b) => b.stage.order - a.stage.order).slice(0, 5);

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
              <Gavel className="w-4 h-4" />
            </div>
            <p className="text-sm font-semibold">Invoice Workflow</p>
          </div>
          {onOpenCollections && (
            <button type="button" onClick={onOpenCollections} className="text-xs text-primary hover:underline">Collections</button>
          )}
        </div>

        {worst ? (
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 mb-3">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Most advanced stage</p>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <Badge variant="secondary" className={TONE_BADGE[worst.stage.tone] || TONE_BADGE.muted}>{worst.stage.label}</Badge>
              <span className="text-xs text-muted-foreground">{open.length} open · {gbp.format(overdueTotal)} overdue</span>
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-muted/20 px-3 py-2 mb-3">
            <p className="text-sm text-muted-foreground">No open invoices — all paid or cancelled.</p>
          </div>
        )}

        {activeStages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {activeStages.map((s) => (
              <span key={s.key} className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full', TONE_BADGE[s.tone] || TONE_BADGE.muted)}>
                {s.label} · {counts[s.key]}
              </span>
            ))}
          </div>
        )}

        {top.length > 0 && (
          <div className="space-y-1.5">
            {top.map((r) => (
              <button
                key={r.inv.id}
                type="button"
                onClick={() => onOpenInvoice?.(r.inv)}
                className="w-full flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-2 text-left hover:bg-muted/30 hover:border-primary/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{r.inv.invoice_number}</p>
                  <p className="text-[11px] text-muted-foreground">{r.daysOverdue > 0 ? `${r.daysOverdue} days overdue` : `Due ${r.inv.due_date || '—'}`}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="secondary" className={cn('text-[10px]', TONE_BADGE[r.stage.tone] || TONE_BADGE.muted)}>{r.stage.label}</Badge>
                  <span className="text-sm font-semibold tabular-nums">{gbp.format(r.balance)}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-primary" />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}