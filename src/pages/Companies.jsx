import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCompany } from '@/lib/useCompany';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react';

export default function Companies() {
  const { companies, loadCompanies, switchCompany, activeCompany } = useCompany();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: '', registration_number: '', vat_number: '',
    address_line_1: '', address_line_2: '', city: '', county: '', postcode: '',
    phone: '', email: '', vat_scheme: 'standard'
  });

  const resetForm = () => {
    setForm({ name: '', registration_number: '', vat_number: '', address_line_1: '', address_line_2: '', city: '', county: '', postcode: '', phone: '', email: '', vat_scheme: 'standard' });
    setEditing(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      name: c.name || '', registration_number: c.registration_number || '', vat_number: c.vat_number || '',
      address_line_1: c.address_line_1 || '', address_line_2: c.address_line_2 || '',
      city: c.city || '', county: c.county || '', postcode: c.postcode || '',
      phone: c.phone || '', email: c.email || '', vat_scheme: c.vat_scheme || 'standard'
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.Company.update(editing.id, form);
        toast({ title: 'Company updated' });
      } else {
        const created = await base44.entities.Company.create(form);
        switchCompany(created);
        toast({ title: 'Company created' });
      }
      await loadCompanies();
      setDialogOpen(false);
      resetForm();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    if (!confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    try {
      await base44.entities.Company.delete(c.id);
      toast({ title: 'Company deleted' });
      await loadCompanies();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your business profiles</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Company
        </Button>
      </div>

      {companies.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Building2 className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-4">No companies yet. Create your first one to get started.</p>
            <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" />Add Company</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {companies.map(c => (
            <Card key={c.id} className={`border-0 shadow-sm ${activeCompany?.id === c.id ? 'ring-2 ring-primary/20' : ''}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base">{c.name}</h3>
                      {activeCompany?.id === c.id && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Active</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      {c.registration_number && <p>Reg: {c.registration_number}</p>}
                      {c.vat_number && <p>VAT: {c.vat_number}</p>}
                      {c.city && <p>{[c.address_line_1, c.city, c.postcode].filter(Boolean).join(', ')}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                    {activeCompany?.id !== c.id && (
                      <Button variant="outline" size="sm" onClick={() => switchCompany(c)}>Switch to</Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Company' : 'New Company'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Company Name *</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Smith's Garage Ltd" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Registration Number</Label>
                <Input value={form.registration_number} onChange={e => setForm({...form, registration_number: e.target.value})} placeholder="e.g. 12345678" />
              </div>
              <div>
                <Label>VAT Number</Label>
                <Input value={form.vat_number} onChange={e => setForm({...form, vat_number: e.target.value})} placeholder="e.g. GB123456789" />
              </div>
            </div>
            <div>
              <Label>Address Line 1</Label>
              <Input value={form.address_line_1} onChange={e => setForm({...form, address_line_1: e.target.value})} />
            </div>
            <div>
              <Label>Address Line 2</Label>
              <Input value={form.address_line_2} onChange={e => setForm({...form, address_line_2: e.target.value})} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>City</Label>
                <Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
              </div>
              <div>
                <Label>County</Label>
                <Input value={form.county} onChange={e => setForm({...form, county: e.target.value})} />
              </div>
              <div>
                <Label>Postcode</Label>
                <Input value={form.postcode} onChange={e => setForm({...form, postcode: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} type="email" />
              </div>
            </div>
            <div>
              <Label>VAT Scheme</Label>
              <Select value={form.vat_scheme} onValueChange={v => setForm({...form, vat_scheme: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="flat_rate">Flat Rate</SelectItem>
                  <SelectItem value="cash_accounting">Cash Accounting</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Company'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}