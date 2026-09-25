import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, FileText, Undo2, Receipt, RotateCcw } from 'lucide-react';
import moment from 'moment';

function formatCurrency(a) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0); }

function DocumentSection({ title, icon: Icon, documents, nameField, numberField, dateField }) {
  const [expanded, setExpanded] = useState(false);
  const totalNet = documents.reduce((s, d) => s + (d.subtotal || 0), 0);
  const totalVat = documents.reduce((s, d) => s + (d.vat_total || 0), 0);

  return (
    <div className="border rounded-lg">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
          <span className="text-xs text-muted-foreground">({documents.length})</span>
        </div>
        <div className="text-right text-xs">
          <span className="text-muted-foreground">Net: {formatCurrency(totalNet)} · VAT: {formatCurrency(totalVat)}</span>
        </div>
      </button>
      {expanded && documents.length > 0 && (
        <div className="border-t">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left p-2 font-medium text-xs text-muted-foreground">Number</th>
                <th className="text-left p-2 font-medium text-xs text-muted-foreground">Name</th>
                <th className="text-left p-2 font-medium text-xs text-muted-foreground">Date</th>
                <th className="text-right p-2 font-medium text-xs text-muted-foreground">Net</th>
                <th className="text-right p-2 font-medium text-xs text-muted-foreground">VAT</th>
              </tr>
            </thead>
            <tbody>
              {documents.map(d => (
                <tr key={d.id} className="border-t">
                  <td className="p-2 text-xs font-medium">{d[numberField]}</td>
                  <td className="p-2 text-xs text-muted-foreground">{d[nameField]}</td>
                  <td className="p-2 text-xs text-muted-foreground">{moment(d.date).format('DD MMM YYYY')}</td>
                  <td className="p-2 text-xs text-right">{formatCurrency(d.subtotal)}</td>
                  <td className="p-2 text-xs text-right">{formatCurrency(d.vat_total)}</td>
                </tr>
              ))}
              <tr className="border-t bg-muted/20">
                <td colSpan={3} className="p-2 text-xs font-semibold text-right">Total</td>
                <td className="p-2 text-xs font-semibold text-right">{formatCurrency(totalNet)}</td>
                <td className="p-2 text-xs font-semibold text-right">{formatCurrency(totalVat)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {expanded && documents.length === 0 && (
        <div className="border-t p-3 text-sm text-muted-foreground text-center">No documents in this period</div>
      )}
    </div>
  );
}

export default function VATReturnBreakdown({ breakdown }) {
  if (!breakdown) return null;

  const salesInvoices = breakdown.sales_invoices || [];
  const salesCreditNotes = breakdown.sales_credit_notes || [];
  const purchaseBills = breakdown.purchase_bills || [];
  const supplierCreditNotes = breakdown.supplier_credit_notes || [];

  const salesInvVat = salesInvoices.reduce((s, d) => s + (d.vat_total || 0), 0);
  const salesCNVat = salesCreditNotes.reduce((s, d) => s + (d.vat_total || 0), 0);
  const purchaseVat = purchaseBills.reduce((s, d) => s + (d.vat_total || 0), 0);
  const supplierCNVat = supplierCreditNotes.reduce((s, d) => s + (d.vat_total || 0), 0);
  const salesInvNet = salesInvoices.reduce((s, d) => s + (d.subtotal || 0), 0);
  const salesCNNet = salesCreditNotes.reduce((s, d) => s + (d.subtotal || 0), 0);
  const purchaseNet = purchaseBills.reduce((s, d) => s + (d.subtotal || 0), 0);
  const supplierCNNet = supplierCreditNotes.reduce((s, d) => s + (d.subtotal || 0), 0);

  const calculations = [
    { box: 'Box 1', label: 'VAT due on sales', formula: `${formatCurrency(salesInvVat)} - ${formatCurrency(salesCNVat)}`, result: salesInvVat - salesCNVat },
    { box: 'Box 4', label: 'VAT reclaimed on purchases', formula: `${formatCurrency(purchaseVat)} - ${formatCurrency(supplierCNVat)}`, result: purchaseVat - supplierCNVat },
    { box: 'Box 6', label: 'Total sales (excl VAT)', formula: `${formatCurrency(salesInvNet)} - ${formatCurrency(salesCNNet)}`, result: salesInvNet - salesCNNet },
    { box: 'Box 7', label: 'Total purchases (excl VAT)', formula: `${formatCurrency(purchaseNet)} - ${formatCurrency(supplierCNNet)}`, result: purchaseNet - supplierCNNet },
  ];

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">How Each Box Was Calculated</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {calculations.map(c => (
              <div key={c.box} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium">{c.box} — {c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.formula}</p>
                </div>
                <p className="text-sm font-semibold">{formatCurrency(c.result)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <DocumentSection title="Sales Invoices" icon={FileText} documents={salesInvoices} nameField="customer_name" numberField="number" dateField="date" />
        <DocumentSection title="Sales Credit Notes" icon={Undo2} documents={salesCreditNotes} nameField="customer_name" numberField="number" dateField="date" />
        <DocumentSection title="Purchase Bills" icon={Receipt} documents={purchaseBills} nameField="supplier_name" numberField="number" dateField="date" />
        <DocumentSection title="Supplier Credit Notes" icon={RotateCcw} documents={supplierCreditNotes} nameField="supplier_name" numberField="number" dateField="date" />
      </div>
    </div>
  );
}