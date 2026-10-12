import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import moment from 'moment';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const VAT_LABELS = { '20': '20%', '5': '5%', '0': '0%', exempt: 'Exempt', no_vat: 'No VAT' };
const statusColors = {
  draft: 'bg-slate-100 text-slate-700', approved: 'bg-blue-50 text-blue-700', sent: 'bg-blue-50 text-blue-700',
  part_paid: 'bg-purple-50 text-purple-700', paid: 'bg-emerald-50 text-emerald-700', overdue: 'bg-red-50 text-red-700', cancelled: 'bg-gray-100 text-gray-500',
};

// The invoice itself — a clean, non-modal document card: parties, dates,
// line items and totals. This is "the invoice" in the left column.
export default function InvoiceDocument({ invoice, customer, company }) {
  if (!invoice) return null;
  const addr = (c) => [c?.address_line_1, c?.address_line_2, c?.city, c?.county, c?.postcode].filter(Boolean).join(', ');

  return (
    <Card className="border shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-lg font-semibold">{invoice.invoice_number}</p>
              <Badge variant="secondary" className={`text-xs ${statusColors[invoice.status] || ''}`}>{invoice.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{company?.name || '—'}</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>Issued {moment(invoice.issue_date).format('DD MMM YYYY')}</p>
            <p>Due {moment(invoice.due_date).format('DD MMM YYYY')}</p>
            <p>Terms {invoice.payment_terms || 30} days</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5 text-sm">
          <div className="min-w-0">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground mb-1">Bill To</p>
            <p className="font-medium truncate">{customer?.name || invoice.customer_name || '—'}</p>
            {addr(customer) && <p className="text-xs text-muted-foreground mt-0.5">{addr(customer)}</p>}
            {customer?.email && <p className="text-xs text-muted-foreground truncate">{customer.email}</p>}
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground mb-1">Reference</p>
            <p className="font-medium">{invoice.reference || '—'}</p>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-2.5 font-medium">Description</th>
                <th className="text-right p-2.5 font-medium">Qty</th>
                <th className="text-right p-2.5 font-medium">Unit Price</th>
                <th className="text-right p-2.5 font-medium">VAT</th>
                <th className="text-right p-2.5 font-medium">Net</th>
                <th className="text-right p-2.5 font-medium">Gross</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.line_items || []).map((line, idx) => (
                <tr key={idx} className="border-t border-border">
                  <td className="p-2.5">{line.description || '—'}</td>
                  <td className="p-2.5 text-right tabular-nums">{line.quantity}</td>
                  <td className="p-2.5 text-right tabular-nums">{gbp.format(line.unit_price || 0)}</td>
                  <td className="p-2.5 text-right">{VAT_LABELS[String(line.vat_rate)] || line.vat_rate}</td>
                  <td className="p-2.5 text-right tabular-nums">{gbp.format(line.amount || 0)}</td>
                  <td className="p-2.5 text-right tabular-nums font-medium">{gbp.format(line.line_total || 0)}</td>
                </tr>
              ))}
              {(!invoice.line_items || invoice.line_items.length === 0) && (
                <tr><td colSpan={6} className="p-4 text-center text-sm text-muted-foreground">No line items</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end mt-4">
          <div className="w-60 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{gbp.format(invoice.subtotal || 0)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">VAT Total</span><span className="tabular-nums">{gbp.format(invoice.vat_total || 0)}</span></div>
            <div className="flex justify-between font-semibold border-t pt-2"><span>Total</span><span className="tabular-nums">{gbp.format(invoice.total || 0)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Amount Paid</span><span className="tabular-nums">{gbp.format(invoice.amount_paid || 0)}</span></div>
            <div className="flex justify-between font-semibold text-primary border-t pt-2"><span>Balance Due</span><span className="tabular-nums">{gbp.format(invoice.balance_due || 0)}</span></div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-5 pt-4 border-t border-border">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted-foreground mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}