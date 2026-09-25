import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

function formatCurrency(a) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0);
}

function getColumns(items) {
  if (!items || items.length === 0) return [];
  const first = items[0];
  if (first.invoice_number !== undefined) return [
    { key: 'invoice_number', label: 'Invoice #' },
    { key: 'issue_date', label: 'Date' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'total', label: 'Total', isAmount: true },
  ];
  if (first.bill_number !== undefined) return [
    { key: 'bill_number', label: 'Bill #' },
    { key: 'bill_date', label: 'Date' },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'total', label: 'Total', isAmount: true },
  ];
  if (first.money_in !== undefined || first.money_out !== undefined) return [
    { key: 'date', label: 'Date' },
    { key: 'description', label: 'Description' },
    { key: 'money_in', label: 'Money In', isAmount: true },
    { key: 'money_out', label: 'Money Out', isAmount: true },
    { key: 'status', label: 'Status' },
  ];
  if (first.credit_note_number !== undefined) return [
    { key: 'credit_note_number', label: 'CN #' },
    { key: 'credit_note_date', label: 'Date' },
    { key: 'customer_name', label: 'Customer' },
    { key: 'supplier_name', label: 'Supplier' },
    { key: 'total', label: 'Total', isAmount: true },
  ];
  return [];
}

export default function DrillDownDialog({ open, onOpenChange, drillDown }) {
  if (!drillDown) return null;
  const columns = getColumns(drillDown.items);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{drillDown.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-3">{drillDown.items.length} transaction(s)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                {columns.map(c => <th key={c.key} className="text-left py-2 px-2 font-medium whitespace-nowrap">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {drillDown.items.map((item, i) => (
                <tr key={i} className="border-b hover:bg-muted/50">
                  {columns.map(c => (
                    <td key={c.key} className="py-2 px-2 whitespace-nowrap">
                      {c.isAmount ? formatCurrency(item[c.key]) : (item[c.key] || '-')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}