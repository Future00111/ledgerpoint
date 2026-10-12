import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const EMPTY_FORM = {
  name: '',
  registration_number: '',
  vat_number: '',
  business_type: 'other',
  vat_registered: false,
  vat_scheme: 'standard',
  vat_frequency: 'quarterly',
  financial_year_end: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  county: '',
  postcode: '',
  phone: '',
  email: '',
};

export default function CompanyForm({ open, onOpenChange, editing, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setForm(editing ? { ...EMPTY_FORM, ...editing } : EMPTY_FORM);
    }
  }, [open, editing]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const setVal = (key) => (v) => setForm(f => ({ ...f, [key]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        // Update company via dedicated route
        const res = await fetch(`/api/companies/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await res.text());
        toast({ title: 'Company updated' });
      } else {
        // Create company + owner membership in one transactional call
        const res = await fetch('/api/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error(await res.text());
        toast({ title: 'Company created' });
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Company' : 'New Company'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Company Name *</Label>
            <Input value={form.name} onChange={set('name')} placeholder="e.g., ABC Garage Ltd" className="mt-1" />
          </div>
          <div>
            <Label>Companies House Number</Label>
            <Input value={form.registration_number} onChange={set('registration_number')} placeholder="e.g., 12345678" className="mt-1" />
          </div>
          <div className="flex items-center justify-between pt-1">
            <Label>VAT Registered</Label>
            <Switch checked={form.vat_registered} onCheckedChange={setVal('vat_registered')} />
          </div>
          {form.vat_registered && (
            <>
              <div>
                <Label>VAT Number</Label>
                <Input value={form.vat_number} onChange={set('vat_number')} placeholder="GB123456789" className="mt-1" />
              </div>
              <div>
                <Label>VAT Scheme</Label>
                <Select value={form.vat_scheme} onValueChange={setVal('vat_scheme')}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Rate</SelectItem>
                    <SelectItem value="flat_rate">Flat Rate</SelectItem>
                    <SelectItem value="cash_accounting">Cash Accounting</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>VAT Return Frequency</Label>
                <Select value={form.vat_frequency} onValueChange={setVal('vat_frequency')}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div>
            <Label>Address Line 1</Label>
            <Input value={form.address_line_1} onChange={set('address_line_1')} placeholder="Street address" className="mt-1" />
          </div>
          <div>
            <Label>City</Label>
            <Input value={form.city} onChange={set('city')} placeholder="London" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>County</Label>
              <Input value={form.county} onChange={set('county')} className="mt-1" />
            </div>
            <div>
              <Label>Postcode</Label>
              <Input value={form.postcode} onChange={set('postcode')} placeholder="SW1A 1AA" className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={set('phone')} placeholder="+44 (0)20 1234 5678" className="mt-1" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={set('email')} placeholder="hello@example.com" className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editing ? 'Save Changes' : 'Create Company'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
