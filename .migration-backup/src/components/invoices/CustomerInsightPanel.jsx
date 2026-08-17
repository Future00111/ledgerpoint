import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const TONE = { emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600', primary: 'text-primary', muted: 'text-muted-foreground' };

const Field = ({ label, value, tone, highlight }) => (
  <div className={cn('rounded-md border px-2.5 py-2 min-w-0', highlight ? 'border-border bg-muted/30' : 'border-border bg-muted/20')}>
    <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground">{label}</p>
    <p className={cn('text-sm font-semibold mt-0.5 truncate', tone ? TONE[tone] : '')}>{value}</p>
  </div>
);

// Customer Intelligence — health, relationship value, lifetime revenue, avg
// payment days, open invoices and outstanding balance for this invoice's customer.
export default function CustomerInsightPanel({ health, healthTone, relationshipValue, relationshipValueTone, lifetimeRevenue, avgPaymentDays, openInvoices, customerOutstanding, onOpenCustomer }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary">
              <Heart className="w-4 h-4" />
            </div>
            <p className="text-sm font-semibold">Customer Intelligence</p>
          </div>
          {onOpenCustomer && <button type="button" onClick={onOpenCustomer} className="text-xs text-primary hover:underline">View customer</button>}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Customer Health" value={health} tone={healthTone} highlight />
          <Field label="Relationship Value" value={relationshipValue} tone={relationshipValueTone} />
          <Field label="Lifetime Revenue" value={gbp.format(lifetimeRevenue)} />
          <Field label="Avg Payment Days" value={avgPaymentDays != null ? `${avgPaymentDays}` : '—'} />
          <Field label="Open Invoices" value={String(openInvoices)} />
          <Field label="Outstanding Balance" value={gbp.format(customerOutstanding)} tone={customerOutstanding > 0 ? 'rose' : 'emerald'} />
        </div>
      </CardContent>
    </Card>
  );
}