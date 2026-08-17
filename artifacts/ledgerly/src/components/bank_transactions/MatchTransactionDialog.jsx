import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import moment from 'moment';

function formatCurrency(a) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0); }

export default function MatchTransactionDialog({ open, onOpenChange, transaction, companyId, onMatched }) {
  const [tab, setTab] = useState('sales_invoice');
  const [search, setSearch] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [bills, setBills] = useState([]);
  const [salesCNs, setSalesCNs] = useState([]);
  const [supplierCNs, setSupplierCNs] = useState([]);
  const [ledgerAccounts, setLedgerAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && companyId) {
      Promise.all([
        base44.entities.SalesInvoice.filter({ company_id: companyId }),
        base44.entities.PurchaseBill.filter({ company_id: companyId }),
        base44.entities.SalesCreditNote.filter({ company_id: companyId }),
        base44.entities.SupplierCreditNote.filter({ company_id: companyId }),
        base44.entities.ChartOfAccount.filter({ company_id: companyId }),
      ]).then(([inv, bil, scn, supcn, coa]) => {
        setInvoices(inv.filter(i => i.status !== 'cancelled' && i.status !== 'draft'));
        setBills(bil.filter(b => b.status !== 'cancelled' && b.status !== 'draft'));
        setSalesCNs(scn.filter(c => c.status !== 'cancelled' && c.status !== 'draft'));
        setSupplierCNs(supcn.filter(c => c.status !== 'cancelled' && c.status !== 'draft'));
        setLedgerAccounts(coa.filter(a => a.is_active !== false));
      });
    }
    if (!open) { setSelected(null); setSearch(''); }
  }, [open, companyId]);

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      let updateData = {};
      if (tab === 'sales_invoice') {
        updateData = { matched_type: 'sales_invoice', matched_record_id: selected.id, matched_record_number: selected.invoice_number, linked_invoice_id: selected.id, linked_bill_id: '', status: 'matched' };
      } else if (tab === 'purchase_bill') {
        updateData = { matched_type: 'purchase_bill', matched_record_id: selected.id, matched_record_number: selected.bill_number, linked_bill_id: selected.id, linked_invoice_id: '', status: 'matched' };
      } else if (tab === 'sales_credit_note') {
        updateData = { matched_type: 'sales_credit_note', matched_record_id: selected.id, matched_record_number: selected.credit_note_number, linked_invoice_id: '', linked_bill_id: '', status: 'matched' };
      } else if (tab === 'supplier_credit_note') {
        updateData = { matched_type: 'supplier_credit_note', matched_record_id: selected.id, matched_record_number: selected.credit_note_number, linked_invoice_id: '', linked_bill_id: '', status: 'matched' };
      } else if (tab === 'ledger_account') {
        updateData = { matched_type: 'ledger_account', matched_record_id: selected.id, matched_record_number: `${selected.code} ${selected.name}`, linked_invoice_id: '', linked_bill_id: '', status: 'matched' };
      }
      await base44.entities.BankTransaction.update(transaction.id, updateData);
      // Update amount paid on matched invoice/bill
      if (tab === 'sales_invoice') {
        const paymentAmount = transaction.money_in || transaction.amount || 0;
        if (paymentAmount > 0) {
          await base44.functions.invoke('updatePaymentStatus', {
            entity_type: 'sales_invoice', record_id: selected.id, amount_paid_delta: paymentAmount
          });
        }
      } else if (tab === 'purchase_bill') {
        const paymentAmount = transaction.money_out || transaction.amount || 0;
        if (paymentAmount > 0) {
          await base44.functions.invoke('updatePaymentStatus', {
            entity_type: 'purchase_bill', record_id: selected.id, amount_paid_delta: paymentAmount
          });
        }
      }
      toast({ title: 'Transaction matched' });
      onMatched();
      onOpenChange(false);
      setSelected(null);
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
    finally { setLoading(false); }
  };

  const filterFn = (arr, fields) => arr.filter(item =>
    fields.some(f => (item[f] || '').toLowerCase().includes(search.toLowerCase()))
  );

  const filteredInvoices = filterFn(invoices, ['invoice_number', 'customer_name']);
  const filteredBills = filterFn(bills, ['bill_number', 'supplier_name']);
  const filteredSalesCNs = filterFn(salesCNs, ['credit_note_number', 'customer_name']);
  const filteredSupplierCNs = filterFn(supplierCNs, ['credit_note_number', 'supplier_name']);
  const filteredLedger = filterFn(ledgerAccounts, ['code', 'name']);

  const RecordRow = ({ item, number, name, date, total }) => (
    <button onClick={() => setSelected(item)} className={`w-full text-left p-3 rounded-lg border transition-colors ${selected?.id === item.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
      <div className="flex justify-between">
        <div><p className="text-sm font-medium">{number}</p><p className="text-xs text-muted-foreground">{name}{date ? ` · ${moment(date).format('DD MMM YYYY')}` : ''}</p></div>
        {total != null && <p className="text-sm font-medium">{formatCurrency(total)}</p>}
      </div>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Match Transaction</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{transaction?.description} — {formatCurrency(transaction?.money_in || transaction?.money_out || transaction?.amount)}</p>
        <Tabs value={tab} onValueChange={v => { setTab(v); setSelected(null); }}>
          <TabsList className="grid grid-cols-5 w-full text-xs">
            <TabsTrigger value="sales_invoice">Invoice</TabsTrigger>
            <TabsTrigger value="purchase_bill">Bill</TabsTrigger>
            <TabsTrigger value="sales_credit_note">Sales CN</TabsTrigger>
            <TabsTrigger value="supplier_credit_note">Supplier CN</TabsTrigger>
            <TabsTrigger value="ledger_account">Ledger</TabsTrigger>
          </TabsList>
          <TabsContent value="sales_invoice" className="space-y-2">
            <Input placeholder="Search invoices..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {filteredInvoices.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No invoices found</p> :
                filteredInvoices.map(i => <RecordRow key={i.id} item={i} number={i.invoice_number} name={i.customer_name} date={i.issue_date} total={i.total} />)}
            </div>
            <Button onClick={handleConfirm} disabled={!selected || loading} className="w-full">{loading ? 'Matching...' : 'Match Selected'}</Button>
          </TabsContent>
          <TabsContent value="purchase_bill" className="space-y-2">
            <Input placeholder="Search bills..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {filteredBills.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No bills found</p> :
                filteredBills.map(b => <RecordRow key={b.id} item={b} number={b.bill_number} name={b.supplier_name} date={b.bill_date} total={b.total} />)}
            </div>
            <Button onClick={handleConfirm} disabled={!selected || loading} className="w-full">{loading ? 'Matching...' : 'Match Selected'}</Button>
          </TabsContent>
          <TabsContent value="sales_credit_note" className="space-y-2">
            <Input placeholder="Search sales credit notes..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {filteredSalesCNs.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No sales credit notes found</p> :
                filteredSalesCNs.map(c => <RecordRow key={c.id} item={c} number={c.credit_note_number} name={c.customer_name} date={c.credit_note_date} total={c.total} />)}
            </div>
            <Button onClick={handleConfirm} disabled={!selected || loading} className="w-full">{loading ? 'Matching...' : 'Match Selected'}</Button>
          </TabsContent>
          <TabsContent value="supplier_credit_note" className="space-y-2">
            <Input placeholder="Search supplier credit notes..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {filteredSupplierCNs.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No supplier credit notes found</p> :
                filteredSupplierCNs.map(c => <RecordRow key={c.id} item={c} number={c.credit_note_number} name={c.supplier_name} date={c.credit_note_date} total={c.total} />)}
            </div>
            <Button onClick={handleConfirm} disabled={!selected || loading} className="w-full">{loading ? 'Matching...' : 'Match Selected'}</Button>
          </TabsContent>
          <TabsContent value="ledger_account" className="space-y-2">
            <Input placeholder="Search ledger accounts..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="max-h-64 overflow-y-auto space-y-1.5">
              {filteredLedger.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No ledger accounts found</p> :
                filteredLedger.map(a => <RecordRow key={a.id} item={a} number={a.code} name={a.name} date={null} total={null} />)}
            </div>
            <Button onClick={handleConfirm} disabled={!selected || loading} className="w-full">{loading ? 'Matching...' : 'Match Selected'}</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}