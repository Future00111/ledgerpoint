import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowRight, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

// Related Invoices — other outstanding invoices for the same customer.
export default function RelatedInvoices({ invoices = [], onOpen }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <p className="text-sm font-semibold mb-3">Other Outstanding Invoices</p>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other outstanding invoices for this customer.</p>
        ) : (
          <div className="space-y-1.5">
            {invoices.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => onOpen(inv.id)}
                className="w-full flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left hover:bg-muted/30 hover:border-primary/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{inv.number}</p>
                    <p className={cn('text-xs', inv.daysOverdue > 0 ? 'text-rose-600' : 'text-muted-foreground')}>
                      {inv.daysOverdue > 0 ? `${inv.daysOverdue} days overdue` : `Due ${fmt(inv.dueDate)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold tabular-nums">{gbp.format(inv.amount)}</span>
                  <ArrowRight className="w-4 h-4 text-primary" />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}