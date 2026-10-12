import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import moment from 'moment';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export default function JournalDetail({ journal, open, onOpenChange }) {
  const [source, setSource] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && journal) loadSource();
  }, [open, journal]);

  const loadSource = async () => {
    setLoading(true);
    try {
      if (journal.source_type === 'sales_invoice' && journal.source_record_id) {
        const doc = await base44.entities.SalesInvoice.get(journal.source_record_id);
        setSource(doc);
      } else if (journal.source_type === 'purchase_bill' && journal.source_record_id) {
        const doc = await base44.entities.PurchaseBill.get(journal.source_record_id);
        setSource(doc);
      } else if (journal.source_type === 'bank_transaction' && journal.source_record_id) {
        const doc = await base44.entities.BankTransaction.get(journal.source_record_id);
        setSource(doc);
      } else if (journal.source_type === 'sales_credit_note' && journal.source_record_id) {
        const doc = await base44.entities.SalesCreditNote.get(journal.source_record_id);
        setSource(doc);
      } else if (journal.source_type === 'supplier_credit_note' && journal.source_record_id) {
        const doc = await base44.entities.SupplierCreditNote.get(journal.source_record_id);
        setSource(doc);
      }
    } catch (e) {
      console.error('Failed to load source record:', e);
    } finally {
      setLoading(false);
    }
  };

  if (!journal) return null;

  const typeLabels = {
    sales_invoice: 'Sales Invoice',
    purchase_bill: 'Purchase Bill',
    sales_credit_note: 'Sales Credit Note',
    supplier_credit_note: 'Supplier Credit Note',
    bank_transaction: 'Bank Transaction',
    manual_journal: 'Manual Journal',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Journal Entry Details</DialogTitle>
          <DialogDescription>{moment(journal.date).format('DD MMM YYYY')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Info */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Reference</p>
                  <p className="font-mono text-sm font-medium">{journal.reference}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <Badge variant={journal.is_system_generated ? 'outline' : 'secondary'}>
                    {typeLabels[journal.source_type] || journal.source_type}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="text-sm">{journal.description}</p>
              </div>
            </CardContent>
          </Card>

          {/* Entry Lines */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Account</th>
                    <th className="px-4 py-3 text-right font-medium">Debit</th>
                    <th className="px-4 py-3 text-right font-medium">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{journal.account_code}</div>
                      <div className="text-xs text-muted-foreground">{journal.account_name}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{journal.debit > 0 ? gbp.format(journal.debit) : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono">{journal.credit > 0 ? gbp.format(journal.credit) : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Source Record */}
          {journal.source_record_id && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-3">Source Record</p>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : source ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Number:</span>
                      <span className="font-mono font-medium">{source.invoice_number || source.bill_number || source.credit_note_number || source.reference || '—'}</span>
                    </div>
                    {source.customer_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Customer:</span>
                        <span>{source.customer_name}</span>
                      </div>
                    )}
                    {source.supplier_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Supplier:</span>
                        <span>{source.supplier_name}</span>
                      </div>
                    )}
                    {source.description && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Description:</span>
                        <span>{source.description}</span>
                      </div>
                    )}
                    {source.total && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="font-mono">{gbp.format(source.total)}</span>
                      </div>
                    )}
                    {source.money_in && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">In:</span>
                        <span className="font-mono">{gbp.format(source.money_in)}</span>
                      </div>
                    )}
                    {source.money_out && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Out:</span>
                        <span className="font-mono">{gbp.format(source.money_out)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Source record not found</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}