import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Users, Plus, Search, UserRound, UserCheck, Mail, WalletCards } from 'lucide-react';
import CustomerForm from '@/components/customers/CustomerForm';
import CustomerCard from '@/components/customers/CustomerCard';
import CustomerWorkspace from '@/components/customers/CustomerWorkspace';
import CustomerMergeDialog from '@/components/customers/CustomerMergeDialog';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export default function Customers() {
  const { activeCompany } = useCompany();
  const nav = useNavigate();
  const { id: focusId } = useParams();
  const [searchParams] = useSearchParams();
  const arrival = (searchParams.get('from') || searchParams.get('highlight'))
    ? { source: searchParams.get('from') || 'search', highlight: searchParams.get('highlight') || undefined, query: searchParams.get('q') || undefined }
    : null;
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (activeCompany) loadCustomers();
  }, [activeCompany]);

  // Open the Customer Workspace directly when navigated via /customers/:id
  // (e.g. from an Ask search result).
  useEffect(() => {
    if (!focusId) return;
    const c = customers.find((c) => c.id === focusId);
    if (c) { setViewing(c); setDetailsOpen(true); }
  }, [focusId, customers]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Customer.filter({ company_id: activeCompany.id });
      setCustomers(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (c) => { setEditing(c); setFormOpen(true); };
  const openView = (c) => { setViewing(c); setDetailsOpen(true); };

  const handleDelete = async (c) => {
    if (!confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    try { await base44.entities.Customer.delete(c.id); toast({ title: 'Customer deleted' }); await loadCustomers(); }
    catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleArchive = async (c) => {
    try { await base44.entities.Customer.update(c.id, { status: 'inactive' }); toast({ title: 'Customer archived' }); await loadCustomers(); }
    catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleDuplicate = async (c) => {
    try {
      const { id, created_date, updated_date, created_by_id, ...rest } = c;
      await base44.entities.Customer.create({ ...rest, name: `${c.name} (Copy)`, customer_reference: '', outstanding_balance: 0 });
      toast({ title: 'Customer duplicated' }); await loadCustomers();
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const handleExport = (c) => {
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${c.contact_name || c.name}`, `ORG:${c.name}`];
    if (c.email) lines.push(`EMAIL:${c.email}`);
    if (c.phone) lines.push(`TEL:${c.phone}`);
    const adr = [c.address_line_1, c.address_line_2, c.city, c.county, c.postcode, c.country].filter(Boolean).join(';');
    if (adr) lines.push(`ADR:;;${adr}`);
    lines.push('END:VCARD');
    const blob = new Blob([lines.join('\n')], { type: 'text/vcard' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${c.name.replace(/\s+/g, '_')}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openMerge = (c) => { setViewing(c); setMergeOpen(true); };

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );
  const activeCount = customers.filter((c) => c.status !== 'inactive').length;
  const contactCount = customers.filter((c) => c.email || c.phone).length;
  const outstandingTotal = customers.reduce((sum, c) => sum + (Number(c.outstanding_balance) || 0), 0);

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/[0.04] px-5 py-5 shadow-sm sm:px-6">
        <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/[0.08] blur-3xl" />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary">Sales directory</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">Customers</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep every customer relationship, conversation, and balance in one place.
                </p>
              </div>
            </div>
            <Button onClick={openCreate} className="gap-2 self-start shadow-sm">
              <Plus className="w-4 h-4" />Add Customer
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-border/70 bg-background/60 px-3.5 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <UserCheck className="h-3.5 w-3.5 text-emerald-600" /> Active customers
              </div>
              <p className="mt-1 text-xl font-semibold">{activeCount}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 px-3.5 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="h-3.5 w-3.5 text-primary" /> With contact details
              </div>
              <p className="mt-1 text-xl font-semibold">{contactCount}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 px-3.5 py-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <WalletCards className="h-3.5 w-3.5 text-amber-600" /> Outstanding balance
              </div>
              <p className="mt-1 text-xl font-semibold">{gbp.format(outstandingTotal)}</p>
            </div>
          </div>
        </div>
      </section>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <UserRound className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Customer directory</p>
                <p className="text-xs text-muted-foreground">
                  {search ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : `${customers.length} customer${customers.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, contact or email"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-10 rounded-lg border-border/80 bg-background pl-9"
              />
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
              <Users className="w-7 h-7" />
            </span>
            <p className="font-medium">{search ? 'No customers match your search' : 'No customers yet'}</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {search ? 'Try a different name, contact or email.' : 'Add your first customer to start building your sales directory.'}
            </p>
            {!search && <Button onClick={openCreate} size="sm" className="mt-4 gap-2"><Plus className="h-3.5 w-3.5" />Add Customer</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map(c => (
            <CustomerCard
              key={c.id}
              customer={c}
              onOpen={openView}
              onEdit={openEdit}
              onArchive={handleArchive}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onExport={handleExport}
              onMerge={openMerge}
            />
          ))}
        </div>
      )}

      <CustomerForm open={formOpen} onOpenChange={setFormOpen} editing={editing} companyId={activeCompany.id} onSaved={loadCustomers} />
      <CustomerWorkspace
        customer={viewing}
        open={detailsOpen}
        onOpenChange={(o) => { setDetailsOpen(o); if (!o && searchParams.toString()) nav('/customers', { replace: true }); }}
        arrival={arrival}
        onEdit={openEdit}
        onArchive={handleArchive}
        onDuplicate={handleDuplicate}
        onExport={handleExport}
        onMerge={openMerge}
        onDelete={handleDelete}
      />
      <CustomerMergeDialog customer={viewing} customers={customers} open={mergeOpen} onOpenChange={setMergeOpen} onMerged={loadCustomers} />
    </div>
  );
}