import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { FileText, Plus, Search, Eye, Pencil, Trash2, Send, CheckCircle2, FileCheck2, Clock3, AlertTriangle, WalletCards } from 'lucide-react';
import moment from 'moment';
const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const statusColors = {
  draft: 'border-slate-200 bg-slate-100 text-slate-700',
  sent: 'border-blue-200 bg-blue-50 text-blue-700',
  part_paid: 'border-purple-200 bg-purple-50 text-purple-700',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  overdue: 'border-red-200 bg-red-50 text-red-700',
  cancelled: 'border-gray-200 bg-gray-100 text-gray-500',
};

const statusLabels = {
  draft: 'Draft',
  sent: 'Sent',
  part_paid: 'Part paid',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export default function Invoices() {
  const { activeCompany } = useCompany();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (activeCompany) loadInvoices();
  }, [activeCompany]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.SalesInvoice.filter({ company_id: activeCompany.id }, '-issue_date');
      setInvoices(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const today = moment().format('YYYY-MM-DD');

  const isOverdue = (inv) => ['sent', 'part_paid'].includes(inv.status) && inv.due_date < today;

  const updateStatus = async (inv, status) => {
    try {
      const updateData = { status };
      if (status === 'paid') {
        updateData.amount_paid = inv.total;
        updateData.balance_due = 0;
      }
      await base44.entities.SalesInvoice.update(inv.id, updateData);
      toast({ title: `Invoice marked as ${status.replace(/_/g, ' ')}` });
      await loadInvoices();
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleDelete = async (inv) => {
    if (!confirm(`Delete invoice ${inv.invoice_number}?`)) return;
    try { await base44.entities.SalesInvoice.delete(inv.id); toast({ title: 'Invoice deleted' }); await loadInvoices(); }
    catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const openView = (inv) => { navigate(`/invoices/${inv.id}/view`); };

  const filtered = invoices.filter(i => {
    const matchSearch = i.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      i.customer_name?.toLowerCase().includes(search.toLowerCase());
    let matchStatus = statusFilter === 'all' || i.status === statusFilter;
    if (statusFilter === 'overdue') matchStatus = isOverdue(i);
    return matchSearch && matchStatus;
  });

  const totalValue = invoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
  const outstandingValue = invoices
    .filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled')
    .reduce((sum, inv) => sum + (Number(inv.balance_due) || 0), 0);
  const overdueInvoices = invoices.filter(isOverdue);
  const overdueValue = overdueInvoices.reduce((sum, inv) => sum + (Number(inv.balance_due) || 0), 0);
  const paidCount = invoices.filter(inv => inv.status === 'paid').length;

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/[0.04] px-5 py-5 shadow-sm sm:px-6">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/[0.08] blur-3xl" />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">Sales ledger</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">Invoices</h1>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  Create, send, and keep track of every customer invoice from one focused workspace.
                </p>
              </div>
            </div>
            <Button asChild className="gap-2 self-start shadow-sm">
              <Link to="/invoices/new"><Plus className="h-4 w-4" />New Invoice</Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/70 bg-background/60 px-3.5 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <WalletCards className="h-3.5 w-3.5 text-primary" /> Total invoice value
              </div>
              <p className="mt-1 text-xl font-semibold">{gbp.format(totalValue)}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 px-3.5 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5 text-amber-600" /> Outstanding
              </div>
              <p className="mt-1 text-xl font-semibold">{gbp.format(outstandingValue)}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 px-3.5 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> Overdue
              </div>
              <p className="mt-1 text-xl font-semibold">{gbp.format(overdueValue)}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 px-3.5 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" /> Paid in full
              </div>
              <p className="mt-1 text-xl font-semibold">{paidCount}</p>
            </div>
          </div>
        </div>
      </section>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Invoice register</p>
                <p className="text-xs text-muted-foreground">
                  {search || statusFilter !== 'all'
                    ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`
                    : `${invoices.length} invoice${invoices.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <div className="relative min-w-0 flex-1 sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search number or customer"
                  aria-label="Search invoices by number or customer"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-10 rounded-lg border-border/80 bg-background pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 w-full rounded-lg border-border/80 bg-background sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="part_paid">Part paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-border/80 shadow-sm">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <FileText className="h-7 w-7" />
            </span>
            <p className="font-medium">{search || statusFilter !== 'all' ? 'No invoices match your filters' : 'No invoices yet'}</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {search || statusFilter !== 'all'
                ? 'Try a different search or clear the status filter.'
                : 'Create your first invoice to start tracking customer payments.'}
            </p>
            {!search && statusFilter === 'all' && (
              <Button asChild size="sm" className="mt-4 gap-2"><Link to="/invoices/new"><Plus className="h-3.5 w-3.5" />New Invoice</Link></Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(inv => {
            const overdue = isOverdue(inv);
            return (
              <Card
                key={inv.id}
                role="button"
                tabIndex={0}
                aria-label={`Open invoice ${inv.invoice_number}`}
                onClick={() => openView(inv)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openView(inv); } }}
                className={`rounded-2xl border-border/80 shadow-sm cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md hover:bg-muted/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${overdue ? 'border-red-200 ring-1 ring-red-100' : ''}`}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${overdue ? 'bg-red-50 text-red-600' : 'bg-primary/10 text-primary'}`}>
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-sm">{inv.invoice_number}</p>
                          <Badge variant="secondary" className={`border text-[11px] ${statusColors[inv.status] || ''}`}>{statusLabels[inv.status] || inv.status}</Badge>
                          {overdue && <Badge variant="secondary" className="border border-red-200 bg-red-50 text-[11px] text-red-700">Overdue</Badge>}
                        </div>
                        <p className="mt-1 truncate text-sm text-foreground/80">{inv.customer_name || 'Unnamed customer'}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Issued {moment(inv.issue_date).format('DD MMM YYYY')} · Due {moment(inv.due_date).format('DD MMM YYYY')}
                        </p>
                        {(inv.balance_due > 0 && inv.amount_paid > 0) && (
                          <p className="mt-1 text-xs font-medium text-muted-foreground">Balance remaining: {gbp.format(inv.balance_due)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0" onClick={(e) => e.stopPropagation()}>
                      <div className="text-left sm:text-right">
                        <p className="text-base font-semibold">{gbp.format(inv.total || 0)}</p>
                        <p className="text-xs text-muted-foreground">{inv.status === 'paid' ? 'Paid in full' : 'Invoice total'}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {inv.status === 'draft' && (
                          <Button variant="ghost" size="icon" onClick={() => updateStatus(inv, 'sent')} title="Mark as Sent"><Send className="w-4 h-4" /></Button>
                        )}
                        {(inv.status === 'sent' || inv.status === 'part_paid' || inv.status === 'overdue') && (
                          <Button variant="ghost" size="icon" onClick={() => updateStatus(inv, 'paid')} title="Mark as Paid"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openView(inv)} title="View"><Eye className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" asChild title="Edit">
                          <Link to={`/invoices/${inv.id}`}><Pencil className="w-4 h-4" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(inv)} title="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

    </div>
  );
}