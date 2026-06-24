import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  PoundSterling,
  FileText,
  Receipt,
  Landmark,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertCircle,
  TrendingUp,
  Building2
} from 'lucide-react';
import moment from 'moment';
import VATDashboardCard from '@/components/dashboard/VATDashboardCard';
import HealthScore from '@/components/dashboard/HealthScore';

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount || 0);
}

export default function Dashboard() {
  const { activeCompany } = useCompany();
  const [invoices, setInvoices] = useState([]);
  const [bills, setBills] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeCompany) loadData();
  }, [activeCompany]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [inv, bil, txn] = await Promise.all([
        base44.entities.SalesInvoice.filter({ company_id: activeCompany.id }),
        base44.entities.PurchaseBill.filter({ company_id: activeCompany.id }),
        base44.entities.BankTransaction.filter({ company_id: activeCompany.id }, '-date', 10),
      ]);
      setInvoices(inv);
      setBills(bil);
      setTransactions(txn);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!activeCompany) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Building2 className="w-16 h-16 text-muted-foreground/40 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Welcome to LedgerUK</h2>
        <p className="text-muted-foreground mb-6">Create your first company to get started</p>
        <Link to="/companies" className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Building2 className="w-4 h-4" />
          Add Company
        </Link>
      </div>
    );
  }

  const unpaidInvoices = invoices.filter(i => ['sent', 'part_paid', 'overdue'].includes(i.status));
  const unpaidTotal = unpaidInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const awaitingBills = bills.filter(b => b.status === 'awaiting_review');
  const awaitingTotal = awaitingBills.reduce((s, b) => s + (b.total || 0), 0);
  const outputVat = invoices.filter(i => i.status !== 'cancelled').reduce((s, i) => s + (i.vat_total || 0), 0);
  const inputVat = bills.filter(b => b.status !== 'cancelled').reduce((s, b) => s + (b.vat_total || 0), 0);
  const vatDue = outputVat - inputVat;

  const incomeThisMonth = transactions
    .filter(t => t.type === 'income' && moment(t.date).isSame(moment(), 'month'))
    .reduce((s, t) => s + (t.amount || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview for {activeCompany.name}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">VAT Due</span>
              <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                <PoundSterling className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <p className={`text-2xl font-bold ${vatDue > 0 ? 'text-foreground' : 'text-emerald-600'}`}>{formatCurrency(vatDue)}</p>
            <p className="text-xs text-muted-foreground mt-1">Output: {formatCurrency(outputVat)} · Input: {formatCurrency(inputVat)}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Unpaid Invoices</span>
              <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(unpaidTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">{unpaidInvoices.length} invoice{unpaidInvoices.length !== 1 ? 's' : ''} outstanding</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Bills to Review</span>
              <div className="w-9 h-9 bg-rose-50 rounded-lg flex items-center justify-center">
                <Receipt className="w-4 h-4 text-rose-600" />
              </div>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(awaitingTotal)}</p>
            <p className="text-xs text-muted-foreground mt-1">{awaitingBills.length} bill{awaitingBills.length !== 1 ? 's' : ''} awaiting review</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">Income This Month</span>
              <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(incomeThisMonth)}</p>
            <p className="text-xs text-muted-foreground mt-1">{moment().format('MMMM YYYY')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Health Score & VAT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <VATDashboardCard />
        </div>
        <HealthScore companyId={activeCompany.id} />
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Unpaid Invoices */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Unpaid Invoices</CardTitle>
              <Link to="/invoices" className="text-xs text-primary hover:underline font-medium">View all</Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {unpaidInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No unpaid invoices — you're all caught up!</p>
            ) : (
              <div className="space-y-2">
                {unpaidInvoices.slice(0, 5).map(inv => (
                  <Link to={`/invoices/${inv.id}`} key={inv.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/60 transition-colors group">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{inv.customer_name || inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{inv.invoice_number} · Due {moment(inv.due_date).format('DD MMM')}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-sm font-semibold">{formatCurrency(inv.total)}</span>
                      {inv.status === 'overdue' && <Badge variant="destructive" className="text-xs">Overdue</Badge>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bills Awaiting Review */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Bills Awaiting Review</CardTitle>
              <Link to="/bills" className="text-xs text-primary hover:underline font-medium">View all</Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {awaitingBills.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No bills to review</p>
            ) : (
              <div className="space-y-2">
                {awaitingBills.slice(0, 5).map(bill => (
                  <Link to={`/bills/${bill.id}`} key={bill.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/60 transition-colors group">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{bill.supplier_name || bill.bill_number}</p>
                      <p className="text-xs text-muted-foreground">{bill.bill_number} · Due {moment(bill.due_date).format('DD MMM')}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className="text-sm font-semibold">{formatCurrency(bill.total)}</span>
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">Review</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
              <Link to="/transactions" className="text-xs text-primary hover:underline font-medium">View all</Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No transactions recorded yet</p>
            ) : (
              <div className="space-y-1">
                {transactions.slice(0, 8).map(txn => (
                  <div key={txn.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/60 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${txn.type === 'income' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                        {txn.type === 'income' 
                          ? <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                          : <ArrowUpRight className="w-4 h-4 text-rose-600" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{txn.description}</p>
                        <p className="text-xs text-muted-foreground">{moment(txn.date).format('DD MMM YYYY')} · {txn.category?.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold flex-shrink-0 ml-3 ${txn.type === 'income' ? 'text-emerald-600' : 'text-foreground'}`}>
                      {txn.type === 'income' ? '+' : '-'}{formatCurrency(txn.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}