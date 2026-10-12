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
import { Undo2, Plus, Search, Eye, Pencil, Trash2, Send, CheckCircle2 } from 'lucide-react';
import moment from 'moment';
import SalesCreditNoteView from '@/components/sales_credit_notes/SalesCreditNoteView';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

const statusColors = {
  draft: 'bg-slate-100 text-slate-700',
  issued: 'bg-blue-50 text-blue-700',
  applied: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function SalesCreditNotes() {
  const { activeCompany } = useCompany();
  const [creditNotes, setCreditNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewing, setViewing] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (activeCompany) loadCreditNotes(); }, [activeCompany]);

  const loadCreditNotes = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.SalesCreditNote.filter({ company_id: activeCompany.id }, '-credit_note_date');
      setCreditNotes(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const updateStatus = async (cn, status) => {
    try {
      const shouldApply = status === 'applied' && cn.original_invoice_id;
      const wasApplied = cn.is_applied || false;
      await base44.entities.SalesCreditNote.update(cn.id, { status, is_applied: shouldApply });
      if (shouldApply && !wasApplied && cn.original_invoice_id) {
        await base44.functions.invoke('updatePaymentStatus', {
          entity_type: 'sales_invoice', record_id: cn.original_invoice_id, amount_paid_delta: cn.total || 0
        });
      } else if (!shouldApply && wasApplied && cn.original_invoice_id) {
        await base44.functions.invoke('updatePaymentStatus', {
          entity_type: 'sales_invoice', record_id: cn.original_invoice_id, amount_paid_delta: -(cn.total || 0)
        });
      }
      toast({ title: `Credit note marked as ${status}` });
      await loadCreditNotes();
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleDelete = async (cn) => {
    if (!confirm(`Delete credit note ${cn.credit_note_number}?`)) return;
    try { await base44.entities.SalesCreditNote.delete(cn.id); toast({ title: 'Credit note deleted' }); await loadCreditNotes(); }
    catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const openView = (cn) => { setViewing(cn); setDetailsOpen(true); };

  const filtered = creditNotes.filter(c => {
    const matchSearch = c.credit_note_number?.toLowerCase().includes(search.toLowerCase()) ||
      c.customer_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Credit Notes</h1>
          <p className="text-muted-foreground text-sm mt-1">{creditNotes.length} credit note{creditNotes.length !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild className="gap-2"><Link to="/sales-credit-notes/new"><Plus className="w-4 h-4" />New Credit Note</Link></Button>
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
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="applied">Applied</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Undo2 className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{search || statusFilter !== 'all' ? 'No credit notes match your filters' : 'No credit notes yet'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(cn => (
            <Card
              key={cn.id}
              role="button"
              tabIndex={0}
              aria-label={`Open credit note ${cn.credit_note_number}`}
              onClick={() => openView(cn)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openView(cn); } }}
              className="border-0 shadow-sm cursor-pointer transition-all hover:shadow-md hover:bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm">{cn.credit_note_number}</p>
                    <Badge variant="secondary" className={`text-xs ${statusColors[cn.status] || ''}`}>{cn.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cn.customer_name} · {moment(cn.credit_note_date).format('DD MMM YYYY')}
                    {cn.original_invoice_number && ` · Ref: ${cn.original_invoice_number}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
                  {cn.status === 'draft' && (
                    <Button variant="ghost" size="icon" onClick={() => updateStatus(cn, 'issued')} title="Mark as Issued"><Send className="w-4 h-4" /></Button>
                  )}
                  {cn.status === 'issued' && (
                    <Button variant="ghost" size="icon" onClick={() => updateStatus(cn, 'applied')} title="Apply to Invoice"><CheckCircle2 className="w-4 h-4 text-emerald-600" /></Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openView(cn)} title="View"><Eye className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" asChild title="Edit">
                    <Link to={`/sales-credit-notes/${cn.id}`}><Pencil className="w-4 h-4" /></Link>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(cn)} title="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SalesCreditNoteView creditNote={viewing} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </div>
  );
}