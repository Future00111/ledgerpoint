import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Users, Plus, Search } from 'lucide-react';
import CustomerForm from '@/components/customers/CustomerForm';
import CustomerCard from '@/components/customers/CustomerCard';
import CustomerWorkspace from '@/components/customers/CustomerWorkspace';
import CustomerMergeDialog from '@/components/customers/CustomerMergeDialog';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export default function Customers() {
  const { activeCompany } = useCompany();
  const nav = useNavigate();
  const { id: focusId } = useParams();
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

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-muted-foreground text-sm mt-1">{customers.length} customer{customers.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Add Customer</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Users className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{search ? 'No customers match your search' : 'No customers yet'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
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
        onOpenChange={(o) => { setDetailsOpen(o); if (!o && focusId) nav('/customers', { replace: true }); }}
        onEdit={openEdit}
      />
      <CustomerMergeDialog customer={viewing} customers={customers} open={mergeOpen} onOpenChange={setMergeOpen} onMerged={loadCustomers} />
    </div>
  );
}