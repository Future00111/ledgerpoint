import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const TONE = { emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600', primary: 'text-primary', muted: 'text-muted-foreground' };
const recBg = (t) => ({ emerald: 'border-emerald-200 bg-emerald-50', amber: 'border-amber-200 bg-amber-50', rose: 'border-rose-200 bg-rose-50', primary: 'border-primary/20 bg-primary/5', muted: 'border-border bg-muted/30' }[t] || 'border-border bg-muted/30');

const Stat = ({ label, value, tone }) => (
  <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2 min-w-0">
    <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">{label}</p>
    <p className={cn('text-sm font-semibold mt-0.5 truncate', tone ? TONE[tone] : '')}>{value}</p>
  </div>
);

// Executive Summary — answers the four headline questions about this invoice:
// outstanding, payment probability, customer behaviour, collection period,
// plus the single recommended next action.
export default function InvoiceExecutiveSummary({ balanceDue, probability, likelihood, likelihoodTone, behaviour, avgPaymentDays, recommendation, recommendationTone }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <p className="text-sm font-semibold mb-3">Executive Summary</p>
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <Stat label="Outstanding Amount" value={gbp.format(balanceDue)} />
          <Stat label="Payment Probability" value={`${probability}%`} tone={likelihoodTone} />
          <Stat label="Customer Behaviour" value={behaviour} />
          <Stat label="Avg Collection Period" value={avgPaymentDays != null ? `${avgPaymentDays} days` : '—'} />
        </div>
        <div className={cn('rounded-md border px-3 py-2.5 flex items-center justify-between gap-2', recBg(recommendationTone))}>
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">Recommendation</p>
            <p className={cn('text-sm font-semibold truncate', TONE[recommendationTone])}>{recommendation}</p>
          </div>
          <ArrowRight className={cn('w-4 h-4 flex-shrink-0', TONE[recommendationTone])} />
        </div>
      </CardContent>
    </Card>
  );
}