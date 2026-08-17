import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

// Revenue Analytics — interactive revenue module. The whole card opens the
// invoices view; the largest-invoice row opens that specific invoice.
export default function RevenueAnalyticsCard({
  revenue12m = 0, growthPct, avgInvoiceValue = 0,
  largestInvoice, invoiceFrequency = '—',
  onOpenLargest, onOpenInvoices,
}) {
  const growthTone = growthPct == null ? 'text-muted-foreground'
    : growthPct > 0 ? 'text-emerald-600'
    : growthPct < 0 ? 'text-rose-600'
    : 'text-muted-foreground';
  const GrowthIcon = growthPct != null && growthPct < 0 ? TrendingDown : TrendingUp;

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-3.5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
              <BarChart3 className="w-4 h-4" />
            </div>
            <p className="text-sm font-semibold">Revenue Analytics</p>
          </div>
          <button type="button" onClick={onOpenInvoices} className="text-xs text-primary inline-flex items-center gap-1 hover:underline">
            View invoices <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">12-Month Revenue</p>
            <p className="text-sm font-semibold mt-0.5">{gbp.format(revenue12m)}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Revenue Growth</p>
            <p className={cn('text-sm font-semibold mt-0.5 inline-flex items-center gap-1', growthTone)}>
              <GrowthIcon className="w-3 h-3" />
              {growthPct == null ? '—' : `${growthPct > 0 ? '+' : ''}${growthPct}%`}
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Avg Invoice</p>
            <p className="text-sm font-semibold mt-0.5">{gbp.format(avgInvoiceValue)}</p>
          </div>
          <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Frequency</p>
            <p className="text-sm font-semibold mt-0.5">{invoiceFrequency}</p>
          </div>
        </div>

        {largestInvoice ? (
          <button
            type="button"
            onClick={onOpenLargest}
            className="w-full flex items-center justify-between gap-2 rounded-md border border-border hover:bg-muted/30 transition-colors px-2.5 py-2 mt-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Largest Invoice</p>
              <p className="text-sm font-semibold truncate">{largestInvoice.number}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-semibold tabular-nums">{gbp.format(largestInvoice.amount)}</span>
              <ArrowRight className="w-4 h-4 text-primary" />
            </div>
          </button>
        ) : (
          <p className="text-xs text-muted-foreground mt-2">No invoices yet.</p>
        )}
      </CardContent>
    </Card>
  );
}