import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { FileText, Plus, Search, Eye, Pencil, Trash2, Send, CheckCircle2 } from 'lucide-react';
import moment from 'moment';
import InvoiceView from '@/components/invoices/InvoiceView';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const statusColors = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-50 text-blue-700',
  paid: 'bg-emerald-50 text-emerald-700',
  overdue: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function Invoices() {
  const { activeCompany } = useCompany();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewing, setViewing] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
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

  const isOverdue = (inv) => inv.status === 'sent' && inv.due_date < today;

  const updateStatus = async (inv, status) => {
    try {
      await base44.entities.SalesInvoice.update(inv.id, { status });
      toast({ title: `Invoice marked as ${status}` });
      await loadInvoices();
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleDelete = async (inv) => {
    if (!confirm(`Delete invoice ${inv.invoice_number}?`)) return;
    try { await base44.entities.SalesInvoice.delete(inv.id); toast({ title: 'Invoice deleted' }); await loadInvoices(); }
    catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const openView = (inv) => { setViewing(inv); setDetailsOpen(true); };

  const filtered = invoices.filter(i => {
    const matchSearch = i.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      i.customer_name?.toLowerCase().includes(search.toLowerCase());
    let matchStatus = statusFilter === 'all' || i.status === statusFilter;
    if (statusFilter === 'overdue') matchStatus = isOverdue(i);
    return matchSearch && matchStatus;
  });

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Invoices</h1>
          <p className="text-muted-foreground text-sm mt-1">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild className="gap-2"><Link to="/invoices/new"><Plus className="w-4 h-4" />New Invoice</Link></Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by number or customer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{search || statusFilter !== 'all' ? 'No invoices match your filters' : 'No invoices yet'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(inv => {
            const overdue = isOverdue(inv);
            return (
              <Card key={inv.id} className={`border-0 shadow-sm hover:shadow-md transition-shadow ${overdue ? 'ring-1 ring-red-200' : ''}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{inv.invoice_number}</p>
                      <Badge variant="secondary" className={`text-xs ${statusColors[inv.status] || ''}`}>{inv.status}</Badge>
                      {overdue && <Badge variant="secondary" className="text-xs bg-red-50 text-red-700">Overdue</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{inv.customer_name} · {moment(inv.issue_date).format('DD MMM YYYY')} · Due {moment(inv.due_date).format('DD MMM')}</p>
                    {(inv.balance_due > 0 && inv.amount_paid > 0) && (
                      <p className="text-xs text-muted-foreground mt-0.5">Balance: {gbp.format(inv.balance_due)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                    {inv.status === 'draft' && (
                      <Button variant="ghost" size="icon" onClick={() => updateStatus(inv, 'sent')} title="Mark as Sent"><Send className="w-4 h-4" /></Button>
                    )}
                    {(inv.status === 'sent' || inv.status === 'overdue') && (
                      <Button variant="ghost" size="icon" onClick={() => updateStatus(inv, 'paid')} title="Mark as Paid"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openView(inv)} title="View"><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" asChild title="Edit">
                      <Link to={`/invoices/${inv.id}`}><Pencil className="w-4 h-4" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(inv)} title="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <InvoiceView invoice={viewing} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </div>
  );
}