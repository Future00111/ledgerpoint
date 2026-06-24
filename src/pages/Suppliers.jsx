import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Truck, Plus, Pencil, Trash2, Eye, Search, Mail, Phone } from 'lucide-react';
import SupplierForm from '@/components/suppliers/SupplierForm';
import SupplierDetails from '@/components/suppliers/SupplierDetails';

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });

export default function Suppliers() {
  const { activeCompany } = useCompany();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (activeCompany) loadSuppliers();
  }, [activeCompany]);

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.Supplier.filter({ company_id: activeCompany.id });
      setSuppliers(list);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (s) => { setEditing(s); setFormOpen(true); };
  const openView = (s) => { setViewing(s); setDetailsOpen(true); };

  const handleDelete = async (s) => {
    if (!confirm(`Delete ${s.name}?`)) return;
    try { await base44.entities.Supplier.delete(s.id); toast({ title: 'Supplier deleted' }); await loadSuppliers(); }
    catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  const filtered = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.contact_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  if (!activeCompany) return <p className="text-muted-foreground text-center py-12">Please select a company first.</p>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground text-sm mt-1">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Add Supplier</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Truck className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{search ? 'No suppliers match your search' : 'No suppliers yet'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(s => (
            <Card key={s.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{s.name}</p>
                    <Badge variant={s.status === 'active' ? 'default' : 'secondary'} className="text-xs">{s.status === 'active' ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {s.contact_name && <span>{s.contact_name}</span>}
                    {s.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</span>}
                    {s.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{s.phone}</span>}
                    {s.outstanding_balance > 0 && <span className="font-medium text-foreground">Owed: {gbp.format(s.outstanding_balance)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                  <Button variant="ghost" size="icon" onClick={() => openView(s)} title="View"><Eye className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(s)} title="Edit"><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(s)} title="Delete"><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SupplierForm open={formOpen} onOpenChange={setFormOpen} editing={editing} companyId={activeCompany.id} onSaved={loadSuppliers} />
      <SupplierDetails supplier={viewing} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </div>
  );
}