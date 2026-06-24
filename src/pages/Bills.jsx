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
import { Receipt, Plus, Search, Eye, Pencil, Trash2, CheckCircle2, BadgeCheck } from 'lucide-react';
import moment from 'moment';
import BillView from '@/components/bills/BillView';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const statusColors = {
  draft: 'bg-slate-100 text-slate-700',
  awaiting_review: 'bg-amber-50 text-amber-700',
  approved: 'bg-blue-50 text-blue-700',
  paid: 'bg-emerald-50 text-emerald-700',
  overdue: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function Bills() {
  const { activeCompany } = useCompany();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewing, setViewing] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (activeCompany) loadBills();
  }, [activeCompany]);

  const loadBills = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.PurchaseBill.filter({ company_id: activeCompany.id }, '-bill_date');
      setBills(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const today = moment().format('YYYY-MM-DD');
  const isOverdue = (bill) => ['awaiting_review', 'approved'].includes(bill.status) && bill.due_date < today;

  const updateStatus = async (bill, status) => {
    try {
      await base44.entities.PurchaseBill.update(bill.id, { status });
      toast({ title: `Bill marked as ${status.replace(/_/g, ' ')}` });
      await loadBills();
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleDelete = async (bill) => {
    if (!confirm(`Delete bill ${bill.bill_number}?`)) return;
    try { await base44.entities.PurchaseBill.delete(bill.id); toast({ title: 'Bill deleted' }); await loadBills(); }
    catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const openView = (bill) => { setViewing(bill); setDetailsOpen(true); };

  const filtered = bills.filter(b => {
    const matchSearch = b.bill_number?.toLowerCase().includes(search.toLowerCase()) ||
      b.supplier_name?.toLowerCase().includes(search.toLowerCase());
    let matchStatus = statusFilter === 'all' || b.status === statusFilter;
    if (statusFilter === 'overdue') matchStatus = isOverdue(b);
    return matchSearch && matchStatus;
  });

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Purchase Bills</h1>
          <p className="text-muted-foreground text-sm mt-1">{bills.length} bill{bills.length !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild className="gap-2"><Link to="/bills/new"><Plus className="w-4 h-4" />New Bill</Link></Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by number or supplier..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="awaiting_review">Awaiting Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
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
            <Receipt className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{search || statusFilter !== 'all' ? 'No bills match your filters' : 'No bills yet'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(bill => {
            const overdue = isOverdue(bill);
            return (
              <Card key={bill.id} className={`border-0 shadow-sm hover:shadow-md transition-shadow ${overdue ? 'ring-1 ring-red-200' : ''}`}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">{bill.bill_number}</p>
                      <Badge variant="secondary" className={`text-xs ${statusColors[bill.status] || ''}`}>{bill.status?.replace(/_/g, ' ')}</Badge>
                      {overdue && <Badge variant="secondary" className="text-xs bg-red-50 text-red-700">Overdue</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {bill.supplier_name} · {moment(bill.bill_date).format('DD MMM YYYY')} · Due {moment(bill.due_date).format('DD MMM')}
                    </p>
                    {(bill.balance_due > 0 && bill.amount_paid > 0) && (
                      <p className="text-xs text-muted-foreground mt-0.5">Balance: {gbp.format(bill.balance_due)}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                    {bill.status === 'awaiting_review' && (
                      <Button variant="ghost" size="icon" onClick={() => updateStatus(bill, 'approved')} title="Approve Bill"><BadgeCheck className="w-4 h-4 text-blue-600" /></Button>
                    )}
                    {(bill.status === 'approved' || bill.status === 'awaiting_review') && (
                      <Button variant="ghost" size="icon" onClick={() => updateStatus(bill, 'paid')} title="Mark as Paid"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openView(bill)} title="View"><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" asChild title="Edit">
                      <Link to={`/bills/${bill.id}`}><Pencil className="w-4 h-4" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(bill)} title="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <BillView bill={viewing} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </div>
  );
}