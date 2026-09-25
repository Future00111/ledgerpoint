import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const Row = ({ label, value, tone }) => (
  <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/20 px-2.5 py-2">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={cn('text-sm font-semibold text-right min-w-0 truncate', tone || 'text-foreground')}>{value}</span>
  </div>
);

// Invoice Analytics — this invoice vs the customer's history: amount vs
// average, largest previous invoice, trend, and historical on-time rate.
export default function InvoiceAnalytics({ amountVsAvgPct, largestPrevious, isLargestEver, trend, onTimeRate }) {
  const vsLabel = amountVsAvgPct == null ? '—' : amountVsAvgPct >= 0 ? `${amountVsAvgPct}% above average` : `${Math.abs(amountVsAvgPct)}% below average`;
  const vsTone = amountVsAvgPct == null ? '' : amountVsAvgPct > 50 ? 'text-rose-600' : amountVsAvgPct > 0 ? 'text-amber-600' : 'text-emerald-600';
  const onTimeTone = onTimeRate == null ? '' : onTimeRate >= 80 ? 'text-emerald-600' : onTimeRate >= 50 ? 'text-amber-600' : 'text-rose-600';

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
            <BarChart3 className="w-4 h-4" />
          </div>
          <p className="text-sm font-semibold">Invoice Analytics</p>
        </div>
        <div className="space-y-2.5">
          <Row label="Invoice Amount" value={vsLabel} tone={vsTone} />
          <Row label="Largest Previous Invoice" value={largestPrevious > 0 ? gbp.format(largestPrevious) : '—'} />
          <Row label="Trend" value={trend} tone={isLargestEver ? 'text-primary' : ''} />
          <Row label="Historical On-Time Rate" value={onTimeRate != null ? `${onTimeRate}%` : '—'} tone={onTimeTone} />
        </div>
      </CardContent>
    </Card>
  );
}