import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { AlertCircle, X } from 'lucide-react';

function formatCurrency(a) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0); }

export default function ReconciliationWorkflow({ open, onOpenChange, transaction, companyId, onReconciled }) {
  const [stage, setStage] = useState('select'); // select, confirm, finalizing, done
  const [invoices, setInvoices] = useState([]);
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]);
  const [finalizing, setFinalizing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && transaction) {
      loadAvailableRecords();
    }
  }, [open, transaction]);

  const loadAvailableRecords = async () => {
    setLoading(true);
    try {
      const txnAmount = transaction.money_in || transaction.money_out || 0;
      const isIncome = (transaction.money_in || 0) > 0;

      if (isIncome) {
        // For income, match to unpaid sales invoices
        const invoiceList = await base44.entities.SalesInvoice.filter({
          company_id: companyId,
          status: { $in: ['approved', 'sent', 'part_paid'] }
        });
        // Filter invoices with outstanding balance
        const outstanding = invoiceList.filter(inv => (inv.balance_due || 0) > 0);
        setInvoices(outstanding);
      } else {
        // For expenses, match to unpaid purchase bills
        const billList = await base44.entities.PurchaseBill.filter({
          company_id: companyId,
          status: { $in: ['approved', 'part_paid'] }
        });
        // Filter bills with outstanding balance
        const outstanding = billList.filter(bill => (bill.balance_due || 0) > 0);
        setBills(outstanding);
      }
      setMatches([]);
    } catch (e) { 
      toast({ title: 'Error loading records', description: e.message, variant: 'destructive' });
    } finally { 
      setLoading(false); 
    }
  };

  const txnAmount = transaction?.money_in || transaction?.money_out || 0;
  const matchedTotal = matches.reduce((sum, m) => sum + m.amount, 0);
  const remaining = txnAmount - matchedTotal;
  const isFullyMatched = Math.abs(remaining) < 0.01;

  const addMatch = (record, type) => {
    if (matches.some(m => m.id === record.id)) {
      toast({ title: 'Already matched to this record', variant: 'destructive' });
      return;
    }
    const maxAmount = record.balance_due || 0;
    setMatches(prev => [...prev, {
      id: record.id,
      type, // sales_invoice, purchase_bill, sales_credit_note, supplier_credit_note
      number: type === 'sales_invoice' ? record.invoice_number : record.bill_number,
      amount: Math.min(maxAmount, remaining),
      maxAmount
    }]);
  };

  const removeMatch = (id) => {
    setMatches(prev => prev.filter(m => m.id !== id));
  };

  const updateMatchAmount = (id, amount) => {
    const parsed = parseFloat(amount) || 0;
    setMatches(prev => prev.map(m => m.id === id ? { ...m, amount: parsed } : m));
  };

  const handleFinalize = async () => {
    if (!isFullyMatched) {
      toast({ title: 'Please match the full amount before finalizing', variant: 'destructive' });
      return;
    }

    setFinalizing(true);
    try {
      // Update transaction to matched status
      const updateData = {
        status: 'matched',
        matched_type: matches[0].type,
        matched_record_id: matches[0].id,
        matched_record_number: matches[0].number
      };
      await base44.entities.BankTransaction.update(transaction.id, updateData);

      // Update payment status for each matched record
      for (const match of matches) {
        const amount = match.amount;
        if (match.type === 'sales_invoice') {
          await base44.functions.invoke('updatePaymentStatus', {
            entity_type: 'sales_invoice',
            record_id: match.id,
            amount_paid_delta: amount
          });
        } else if (match.type === 'purchase_bill') {
          await base44.functions.invoke('updatePaymentStatus', {
            entity_type: 'purchase_bill',
            record_id: match.id,
            amount_paid_delta: amount
          });
        }
      }

      toast({ title: 'Transaction reconciled successfully' });
      setStage('done');
      onReconciled?.();
      setTimeout(() => {
        onOpenChange(false);
        setStage('select');
        setMatches([]);
      }, 1500);
    } catch (e) {
      toast({ title: 'Error reconciling transaction', description: e.message, variant: 'destructive' });
    } finally {
      setFinalizing(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reconcile Bank Transaction</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Transaction Summary */}
          <div className="bg-muted/50 rounded-lg p-4 border border-muted">
            <p className="text-sm font-medium text-muted-foreground mb-2">Transaction</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm font-medium">{transaction.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{transaction.date} · {transaction.reference}</p>
              </div>
              <p className="text-lg font-semibold">
                {transaction.money_in > 0 ? '+' : '-'}{formatCurrency(txnAmount)}
              </p>
            </div>
          </div>

          {stage === 'select' && (
            <>
              <div>
                <p className="text-sm font-medium mb-3">Match to Invoices & Bills</p>
                {loading ? (
                  <div className="flex justify-center py-6">
                    <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {(transaction.money_in || 0) > 0 && invoices.length > 0 && (
                      <div className="space-y-2 mb-4">
                        <Label className="text-xs text-muted-foreground">Sales Invoices with Outstanding Balance</Label>
                        {invoices.slice(0, 10).map(inv => (
                          <Button
                            key={inv.id}
                            variant="outline"
                            onClick={() => addMatch(inv, 'sales_invoice')}
                            className="w-full justify-between text-left h-auto py-2"
                          >
                            <div>
                              <p className="text-sm font-medium">{inv.invoice_number}</p>
                              <p className="text-xs text-muted-foreground">{inv.customer_name}</p>
                            </div>
                            <span className="text-sm font-medium text-emerald-600">Outstanding: {formatCurrency(inv.balance_due)}</span>
                          </Button>
                        ))}
                        {invoices.length === 0 && (
                          <p className="text-xs text-muted-foreground">No invoices with outstanding balance</p>
                        )}
                      </div>
                    )}
                    {(transaction.money_out || 0) > 0 && bills.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Purchase Bills with Outstanding Balance</Label>
                        {bills.slice(0, 10).map(bill => (
                          <Button
                            key={bill.id}
                            variant="outline"
                            onClick={() => addMatch(bill, 'purchase_bill')}
                            className="w-full justify-between text-left h-auto py-2"
                          >
                            <div>
                              <p className="text-sm font-medium">{bill.bill_number}</p>
                              <p className="text-xs text-muted-foreground">{bill.supplier_name}</p>
                            </div>
                            <span className="text-sm font-medium text-rose-600">Outstanding: {formatCurrency(bill.balance_due)}</span>
                          </Button>
                        ))}
                        {bills.length === 0 && (
                          <p className="text-xs text-muted-foreground">No bills with outstanding balance</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {matches.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">Matched Records</p>
                  <div className="space-y-3">
                    {matches.map(match => (
                      <div key={match.id} className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{match.number}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Label className="text-xs text-muted-foreground">Amount:</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={match.amount}
                              onChange={(e) => updateMatchAmount(match.id, e.target.value)}
                              className="w-24 h-7 text-xs"
                              max={match.maxAmount}
                            />
                            <span className="text-xs text-muted-foreground">max {formatCurrency(match.maxAmount)}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMatch(match.id)}
                          className="h-6 w-6 flex-shrink-0 mt-1"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Balance Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">Transaction Amount:</span>
                  <span className="text-sm font-semibold">{formatCurrency(txnAmount)}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">Matched:</span>
                  <span className="text-sm font-semibold">{formatCurrency(matchedTotal)}</span>
                </div>
                <div className="border-t border-blue-200 pt-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-900">Remaining:</span>
                  <span className={`text-sm font-semibold ${isFullyMatched ? 'text-emerald-600' : 'text-orange-600'}`}>
                    {formatCurrency(remaining)}
                  </span>
                </div>
              </div>

              {!isFullyMatched && remaining > 0 && matches.length > 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    {remaining > 0 ? `You have ${formatCurrency(remaining)} remaining to match.` : `You have over-matched by ${formatCurrency(Math.abs(remaining))}.`}
                  </p>
                </div>
              )}
            </>
          )}

          {stage === 'done' && (
            <div className="text-center py-6">
              <div className="text-4xl mb-2">✓</div>
              <p className="text-sm font-medium text-emerald-600">Transaction reconciled successfully</p>
            </div>
          )}
        </div>

        <DialogFooter>
          {stage !== 'done' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                onClick={handleFinalize}
                disabled={!isFullyMatched || matches.length === 0 || finalizing}
              >
                {finalizing ? 'Finalizing...' : 'Finalize Reconciliation'}
              </Button>
            </>
          )}
          {stage === 'done' && (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}