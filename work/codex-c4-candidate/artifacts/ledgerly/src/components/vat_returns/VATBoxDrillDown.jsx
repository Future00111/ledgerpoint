import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FileText, Undo2, Receipt, RotateCcw } from 'lucide-react';
import moment from 'moment';

function formatCurrency(a) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0); }

const ICONS = {
  sales_invoices: FileText,
  sales_credit_notes: Undo2,
  purchase_bills: Receipt,
  supplier_credit_notes: RotateCcw,
};

const NAME_FIELDS = {
  sales_invoices: 'customer_name',
  sales_credit_notes: 'customer_name',
  purchase_bills: 'supplier_name',
  supplier_credit_notes: 'supplier_name',
};

const BOX_SOURCES = {
  1: {
    title: 'Box 1 — VAT due on sales and other outputs',
    description: 'Output VAT from sales invoices, less VAT credited back via sales credit notes.',
    sources: [
      { type: 'sales_invoices', label: 'Sales Invoice', sign: 1, field: 'vat_total' },
      { type: 'sales_credit_notes', label: 'Sales Credit Note', sign: -1, field: 'vat_total' },
    ],
  },
  2: {
    title: 'Box 2 — VAT due on acquisitions from other EC Member States',
    description: 'VAT due on intra-EU acquisitions of goods.',
    sources: [],
  },
  3: {
    title: 'Box 3 — Total VAT due (Box 1 + Box 2)',
    description: 'Sum of output VAT (Box 1) and EC acquisition VAT (Box 2).',
    sources: [
      { type: 'sales_invoices', label: 'Sales Invoice', sign: 1, field: 'vat_total' },
      { type: 'sales_credit_notes', label: 'Sales Credit Note', sign: -1, field: 'vat_total' },
    ],
  },
  4: {
    title: 'Box 4 — VAT reclaimed on purchases and other inputs',
    description: 'Input VAT from purchase bills, less VAT credited back via supplier credit notes.',
    sources: [
      { type: 'purchase_bills', label: 'Purchase Bill', sign: 1, field: 'vat_total' },
      { type: 'supplier_credit_notes', label: 'Supplier Credit Note', sign: -1, field: 'vat_total' },
    ],
  },
  5: {
    title: 'Box 5 — Net VAT to be paid to HMRC or reclaimed',
    description: 'Output VAT less input VAT (Box 3 − Box 4).',
    sources: [
      { type: 'sales_invoices', label: 'Sales Invoice', sign: 1, field: 'vat_total' },
      { type: 'sales_credit_notes', label: 'Sales Credit Note', sign: -1, field: 'vat_total' },
      { type: 'purchase_bills', label: 'Purchase Bill', sign: -1, field: 'vat_total' },
      { type: 'supplier_credit_notes', label: 'Supplier Credit Note', sign: 1, field: 'vat_total' },
    ],
  },
  6: {
    title: 'Box 6 — Total value of sales excluding VAT',
    description: 'Net sales from invoices, less net values credited back via sales credit notes.',
    sources: [
      { type: 'sales_invoices', label: 'Sales Invoice', sign: 1, field: 'subtotal' },
      { type: 'sales_credit_notes', label: 'Sales Credit Note', sign: -1, field: 'subtotal' },
    ],
  },
  7: {
    title: 'Box 7 — Total value of purchases excluding VAT',
    description: 'Net purchases from bills, less net values credited back via supplier credit notes.',
    sources: [
      { type: 'purchase_bills', label: 'Purchase Bill', sign: 1, field: 'subtotal' },
      { type: 'supplier_credit_notes', label: 'Supplier Credit Note', sign: -1, field: 'subtotal' },
    ],
  },
  8: {
    title: 'Box 8 — Total value of supplies to other EC Member States',
    description: 'Total value of intra-EU supplies of goods and services.',
    sources: [],
  },
  9: {
    title: 'Box 9 — Total value of acquisitions from other EC Member States',
    description: 'Total value of intra-EU acquisitions of goods and services.',
    sources: [],
  },
};

export default function VATBoxDrillDown({ boxNumber, boxValue, breakdown, open, onOpenChange }) {
  const config = boxNumber ? BOX_SOURCES[boxNumber] : null;

  const groups = config
    ? config.sources.map(source => {
        const docs = (breakdown?.[source.type] || []).map(doc => ({
          ...doc,
          sign: source.sign,
          rawAmount: doc[source.field] || 0,
        }));
        const subtotal = docs.reduce((s, d) => s + d.rawAmount * d.sign, 0);
        return { source, docs, subtotal };
      }).filter(g => g.docs.length > 0)
    : [];

  const total = groups.reduce((s, g) => s + g.subtotal, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {config && (
          <>
            <DialogHeader>
              <DialogTitle>{config.title}</DialogTitle>
              <DialogDescription>{config.description}</DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between py-2.5 px-4 bg-muted/30 rounded-lg">
              <span className="text-sm font-medium">Box {boxNumber} Total</span>
              <span className="text-lg font-bold">{formatCurrency(boxValue)}</span>
            </div>

            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No documents contributed to this box.</p>
            ) : (
              <div className="space-y-4">
                {groups.map((group, gi) => {
                  const Icon = ICONS[group.source.type];
                  return (
                    <div key={gi}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{group.source.label}s</span>
                        <span className="text-xs text-muted-foreground">({group.docs.length})</span>
                        <span className="text-xs text-muted-foreground ml-auto">Subtotal: {formatCurrency(group.subtotal)}</span>
                      </div>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/20">
                            <tr>
                              <th className="text-left p-2 font-medium text-xs text-muted-foreground">Number</th>
                              <th className="text-left p-2 font-medium text-xs text-muted-foreground">Name</th>
                              <th className="text-left p-2 font-medium text-xs text-muted-foreground">Date</th>
                              <th className="text-right p-2 font-medium text-xs text-muted-foreground">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.docs.map((doc, di) => (
                              <tr key={di} className="border-t">
                                <td className="p-2 text-xs font-medium">{doc.number}</td>
                                <td className="p-2 text-xs text-muted-foreground">{doc[NAME_FIELDS[group.source.type]]}</td>
                                <td className="p-2 text-xs text-muted-foreground">{moment(doc.date).format('DD MMM YYYY')}</td>
                                <td className={`p-2 text-xs text-right font-medium ${doc.sign < 0 ? 'text-rose-600' : ''}`}>{doc.sign < 0 ? '−' : ''}{formatCurrency(doc.rawAmount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between py-2.5 px-4 bg-primary/5 rounded-lg border border-primary/20">
                  <span className="text-sm font-semibold">Calculated Total</span>
                  <span className="text-lg font-bold">{formatCurrency(total)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}