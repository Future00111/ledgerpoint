import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, PoundSterling, ArrowRight, FileText, Receipt } from 'lucide-react';
import moment from 'moment';

function formatCurrency(a) { return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(a || 0); }

export default function VATReturn() {
  const { activeCompany } = useCompany();
  const [dateFrom, setDateFrom] = useState(moment().startOf('quarter').format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(moment().endOf('quarter').format('YYYY-MM-DD'));
  const [invoices, setInvoices] = useState([]);
  const [bills, setBills] = useState([]);
  const [salesCreditNotes, setSalesCreditNotes] = useState([]);
  const [supplierCreditNotes, setSupplierCreditNotes] = useState([]);
  const [bankTxns, setBankTxns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [calculated, setCalculated] = useState(false);

  const calculate = async () => {
    if (!activeCompany) return;
    setLoading(true);
    try {
      const [allInvoices, allBills, allSalesCNs, allSupplierCNs, allBankTxns] = await Promise.all([
        base44.entities.SalesInvoice.filter({ company_id: activeCompany.id }),
        base44.entities.PurchaseBill.filter({ company_id: activeCompany.id }),
        base44.entities.SalesCreditNote.filter({ company_id: activeCompany.id }),
        base44.entities.SupplierCreditNote.filter({ company_id: activeCompany.id }),
        base44.entities.BankTransaction.filter({ company_id: activeCompany.id }),
      ]);

      const filteredInvoices = allInvoices.filter(i => 
        i.status !== 'cancelled' && i.issue_date >= dateFrom && i.issue_date <= dateTo
      );
      const filteredBills = allBills.filter(b => 
        b.status !== 'cancelled' && b.bill_date >= dateFrom && b.bill_date <= dateTo
      );
      const filteredSalesCNs = allSalesCNs.filter(c => 
        c.status !== 'cancelled' && c.status !== 'draft' && c.credit_note_date >= dateFrom && c.credit_note_date <= dateTo
      );
      const filteredSupplierCNs = allSupplierCNs.filter(c => 
        c.status !== 'cancelled' && c.status !== 'draft' && c.credit_note_date >= dateFrom && c.credit_note_date <= dateTo
      );

      // Only bank transactions matched to a ledger account with manual VAT
      // (invoice/bill/credit note matches are already counted via their linked document)
      const filteredBankTxns = allBankTxns.filter(t =>
        (t.vat_amount || 0) > 0 &&
        t.matched_type === 'ledger_account' &&
        t.date >= dateFrom && t.date <= dateTo
      );

      setInvoices(filteredInvoices);
      setBills(filteredBills);
      setSalesCreditNotes(filteredSalesCNs);
      setSupplierCreditNotes(filteredSupplierCNs);
      setBankTxns(filteredBankTxns);
      setCalculated(true);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // VAT Calculations (UK VAT Return boxes)
  const salesCNVat = salesCreditNotes.reduce((s, c) => s + (c.vat_total || 0), 0);
  const salesCNSubtotal = salesCreditNotes.reduce((s, c) => s + (c.subtotal || 0), 0);
  const supplierCNVat = supplierCreditNotes.reduce((s, c) => s + (c.vat_total || 0), 0);
  const supplierCNSubtotal = supplierCreditNotes.reduce((s, c) => s + (c.subtotal || 0), 0);

  // Bank transactions with manual VAT (not linked to invoice/bill — those are already counted)
  const bankIncomeVat = bankTxns.filter(t => t.type === 'income').reduce((s, t) => s + (t.vat_amount || 0), 0);
  const bankExpenseVat = bankTxns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.vat_amount || 0), 0);
  const bankIncomeNet = bankTxns.filter(t => t.type === 'income').reduce((s, t) => s + ((t.amount || 0) - (t.vat_amount || 0)), 0);
  const bankExpenseNet = bankTxns.filter(t => t.type === 'expense').reduce((s, t) => s + ((t.amount || 0) - (t.vat_amount || 0)), 0);

  const box1 = invoices.reduce((s, i) => s + (i.vat_total || 0), 0) - salesCNVat + bankIncomeVat;
  const box2 = 0;
  const box3 = box1 + box2;
  const box4 = bills.reduce((s, b) => s + (b.vat_total || 0), 0) - supplierCNVat + bankExpenseVat;
  const box5 = box3 - box4;
  const box6 = invoices.reduce((s, i) => s + (i.subtotal || 0), 0) - salesCNSubtotal + bankIncomeNet;
  const box7 = bills.reduce((s, b) => s + (b.subtotal || 0), 0) - supplierCNSubtotal + bankExpenseNet;
  const box8 = 0; // Supplies to EU
  const box9 = 0; // Acquisitions from EU

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">VAT Return Calculator</h1>
        <p className="text-muted-foreground text-sm mt-1">Calculate your VAT return for any period</p>
        <p className="text-xs text-muted-foreground mt-2">Bank transactions only affect the VAT return when matched to an invoice, bill, or credit note, or when manually posted with a VAT rate.</p>
      </div>

      {/* Period selector */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-1 w-full">
              <Label>Period From</Label>
              <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setCalculated(false); }} />
            </div>
            <div className="flex-1 w-full">
              <Label>Period To</Label>
              <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setCalculated(false); }} />
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" className="flex-1 sm:flex-none text-xs" onClick={() => {
                setDateFrom(moment().subtract(1,'quarter').startOf('quarter').format('YYYY-MM-DD'));
                setDateTo(moment().subtract(1,'quarter').endOf('quarter').format('YYYY-MM-DD'));
                setCalculated(false);
              }}>Last Quarter</Button>
              <Button onClick={calculate} disabled={loading} className="flex-1 sm:flex-none gap-2">
                <Calculator className="w-4 h-4" />{loading ? 'Calculating...' : 'Calculate'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {calculated && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5 text-center">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-sm text-muted-foreground">Sales Invoices</p>
                <p className="text-xl font-bold mt-1">{invoices.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Total: {formatCurrency(box6)}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5 text-center">
                <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Receipt className="w-5 h-5 text-amber-600" />
                </div>
                <p className="text-sm text-muted-foreground">Purchase Bills</p>
                <p className="text-xl font-bold mt-1">{bills.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Total: {formatCurrency(box7)}</p>
              </CardContent>
            </Card>
            <Card className={`border-0 shadow-sm ${box5 > 0 ? 'ring-2 ring-blue-100' : 'ring-2 ring-emerald-100'}`}>
              <CardContent className="p-5 text-center">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3 ${box5 > 0 ? 'bg-blue-50' : 'bg-emerald-50'}`}>
                  <PoundSterling className={`w-5 h-5 ${box5 > 0 ? 'text-blue-600' : 'text-emerald-600'}`} />
                </div>
                <p className="text-sm text-muted-foreground">{box5 > 0 ? 'VAT to Pay HMRC' : 'VAT Refund Due'}</p>
                <p className={`text-2xl font-bold mt-1 ${box5 > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>{formatCurrency(Math.abs(box5))}</p>
              </CardContent>
            </Card>
          </div>

          {/* VAT Return Boxes */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">VAT Return Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {[
                  { box: 1, label: 'VAT due on sales and other outputs', value: box1 },
                  { box: 2, label: 'VAT due on acquisitions from other EC Member States', value: box2 },
                  { box: 3, label: 'Total VAT due (sum of boxes 1 and 2)', value: box3, bold: true },
                  { box: 4, label: 'VAT reclaimed on purchases and other inputs', value: box4 },
                  { box: 5, label: 'Net VAT to be paid to Customs or reclaimed', value: box5, bold: true, highlight: true },
                  { box: 6, label: 'Total value of sales excluding VAT', value: box6 },
                  { box: 7, label: 'Total value of purchases excluding VAT', value: box7 },
                  { box: 8, label: 'Total value of all supplies of goods to other EC Member States', value: box8 },
                  { box: 9, label: 'Total value of all acquisitions from other EC Member States', value: box9 },
                ].map(row => (
                  <div key={row.box} className={`flex items-center justify-between px-6 py-3.5 ${row.highlight ? 'bg-primary/5' : ''}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 bg-muted rounded flex items-center justify-center text-xs font-semibold flex-shrink-0">{row.box}</span>
                      <span className={`text-sm ${row.bold ? 'font-semibold' : 'text-muted-foreground'}`}>{row.label}</span>
                    </div>
                    <span className={`text-sm flex-shrink-0 ml-3 ${row.bold ? 'font-bold text-base' : 'font-medium'} ${row.highlight && row.value > 0 ? 'text-blue-600' : ''} ${row.highlight && row.value < 0 ? 'text-emerald-600' : ''}`}>
                      {formatCurrency(Math.abs(row.value))}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Breakdown */}
          {invoices.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">Sales in Period</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {invoices.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between px-6 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{inv.invoice_number} — {inv.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{moment(inv.issue_date).format('DD MMM YYYY')}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-medium">{formatCurrency(inv.subtotal)}</p>
                        <p className="text-xs text-muted-foreground">VAT: {formatCurrency(inv.vat_total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {bills.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">Purchases in Period</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {bills.map(bill => (
                    <div key={bill.id} className="flex items-center justify-between px-6 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{bill.bill_number} — {bill.supplier_name}</p>
                        <p className="text-xs text-muted-foreground">{moment(bill.bill_date).format('DD MMM YYYY')} · {bill.category?.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-medium">{formatCurrency(bill.subtotal)}</p>
                        <p className="text-xs text-muted-foreground">VAT: {formatCurrency(bill.vat_total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {bankTxns.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader><CardTitle className="text-base">Bank Transactions with Manual VAT</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {bankTxns.map(t => (
                    <div key={t.id} className="flex items-center justify-between px-6 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t.description}</p>
                        <p className="text-xs text-muted-foreground">{moment(t.date).format('DD MMM YYYY')} · {t.type} · {t.category?.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-medium">{formatCurrency((t.amount || 0) - (t.vat_amount || 0))}</p>
                        <p className="text-xs text-muted-foreground">VAT: {formatCurrency(t.vat_amount)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}