import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import moment from 'moment';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const statusColors = {
  draft: 'bg-slate-100 text-slate-700',
  awaiting_review: 'bg-amber-50 text-amber-700',
  approved: 'bg-blue-50 text-blue-700',
  part_paid: 'bg-purple-50 text-purple-700',
  paid: 'bg-emerald-50 text-emerald-700',
  overdue: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const VAT_LABELS = { '20': '20%', '5': '5%', '0': '0%', exempt: 'Exempt', no_vat: 'No VAT' };
const CATEGORY_LABELS = { parts: 'Parts', tools: 'Tools', utilities: 'Utilities', rent: 'Rent', insurance: 'Insurance', wages: 'Wages', fuel: 'Fuel', office: 'Office', professional_fees: 'Professional Fees', other: 'Other' };

export default function BillView({ bill, open, onOpenChange }) {
  if (!bill) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{bill.bill_number}</span>
            <Badge variant="secondary" className={`text-xs ${statusColors[bill.status] || ''}`}>{bill.status?.replace(/_/g, ' ')}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Supplier</p>
              <p className="font-medium">{bill.supplier_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reference</p>
              <p className="font-medium">{bill.reference || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bill Date</p>
              <p className="font-medium">{moment(bill.bill_date).format('DD MMM YYYY')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Due Date</p>
              <p className="font-medium">{moment(bill.due_date).format('DD MMM YYYY')}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="font-medium">{CATEGORY_LABELS[bill.category] || bill.category || '—'}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left p-2 font-medium">Description</th>
                  <th className="text-right p-2 font-medium">Qty</th>
                  <th className="text-right p-2 font-medium">Unit Price</th>
                  <th className="text-right p-2 font-medium">VAT</th>
                  <th className="text-right p-2 font-medium">Category</th>
                  <th className="text-right p-2 font-medium">Net</th>
                  <th className="text-right p-2 font-medium">Gross</th>
                </tr>
              </thead>
              <tbody>
                {(bill.line_items || []).map((line, idx) => (
                  <tr key={idx} className="border-t border-border">
                    <td className="p-2">{line.description || '—'}</td>
                    <td className="p-2 text-right">{line.quantity}</td>
                    <td className="p-2 text-right">{gbp.format(line.unit_price || 0)}</td>
                    <td className="p-2 text-right">{VAT_LABELS[String(line.vat_rate)] || line.vat_rate}</td>
                    <td className="p-2 text-right">{CATEGORY_LABELS[line.category] || line.category || '—'}</td>
                    <td className="p-2 text-right">{gbp.format(line.amount || 0)}</td>
                    <td className="p-2 text-right font-medium">{gbp.format(line.line_total || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-56 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{gbp.format(bill.subtotal || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">VAT Total</span><span>{gbp.format(bill.vat_total || 0)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-2"><span>Total</span><span>{gbp.format(bill.total || 0)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Amount Paid</span><span>{gbp.format(bill.amount_paid || 0)}</span></div>
              <div className="flex justify-between font-semibold text-primary border-t pt-2"><span>Balance Due</span><span>{gbp.format(bill.balance_due || 0)}</span></div>
            </div>
          </div>

          {bill.notes && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Notes</p>
              <p className="text-sm whitespace-pre-wrap">{bill.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}