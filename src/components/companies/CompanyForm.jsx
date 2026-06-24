import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

const BUSINESS_TYPES = [
  { value: 'garage', label: 'Garage / Motor Trade' },
  { value: 'retail', label: 'Retail' },
  { value: 'wholesale', label: 'Wholesale' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'construction', label: 'Construction' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'transport', label: 'Transport' },
  { value: 'it_services', label: 'IT Services' },
  { value: 'consultancy', label: 'Consultancy' },
  { value: 'other', label: 'Other' },
];

const EMPTY_FORM = {
  name: '', registration_number: '', vat_number: '', business_type: 'other',
  vat_registered: false, vat_scheme: 'standard', vat_frequency: 'quarterly',
  financial_year_end: '', address_line_1: '', address_line_2: '',
  city: '', county: '', postcode: '', phone: '', email: '',
};

export default function CompanyForm({ open, onOpenChange, editing, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          name: editing.name || '',
          registration_number: editing.registration_number || '',
          vat_number: editing.vat_number || '',
          business_type: editing.business_type || 'other',
          vat_registered: editing.vat_registered ?? false,
          vat_scheme: editing.vat_scheme || 'standard',
          vat_frequency: editing.vat_frequency || 'quarterly',
          financial_year_end: editing.financial_year_end || '',
          address_line_1: editing.address_line_1 || '',
          address_line_2: editing.address_line_2 || '',
          city: editing.city || '',
          county: editing.county || '',
          postcode: editing.postcode || '',
          phone: editing.phone || '',
          email: editing.email || '',
        });
      } else {
        setForm(EMPTY_FORM);
      }
    }
  }, [open, editing]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const setVal = (key) => (v) => setForm({ ...form, [key]: v });

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.Company.update(editing.id, form);
        toast({ title: 'Company updated' });
      } else {
        const company = await base44.entities.Company.create(form);
        const user = await base44.auth.me();
        await base44.entities.CompanyUser.create({
          company_id: company.id,
          user_id: user.id,
          user_email: (user.email || '').toLowerCase(),
          role: 'owner',
          status: 'active',
        });
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
            <Input value={form.name} onChange={set('name')} placeholder="e.g. Smith's Garage Ltd" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Company Number</Label>
              <Input value={form.registration_number} onChange={set('registration_number')} placeholder="e.g. 12345678" />
            </div>
            <div>
              <Label>VAT Number</Label>
              <Input value={form.vat_number} onChange={set('vat_number')} placeholder="e.g. GB123456789" />
            </div>
          </div>
          <div>
            <Label>Business Type</Label>
            <Select value={form.business_type} onValueChange={setVal('business_type')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BUSINESS_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <Label>VAT Registered</Label>
              <p className="text-xs text-muted-foreground">Is this company registered for VAT?</p>
            </div>
            <Switch checked={form.vat_registered} onCheckedChange={setVal('vat_registered')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>VAT Scheme</Label>
              <Select value={form.vat_scheme} onValueChange={setVal('vat_scheme')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="cash_accounting">Cash Accounting</SelectItem>
                  <SelectItem value="flat_rate">Flat Rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>VAT Frequency</Label>
              <Select value={form.vat_frequency} onValueChange={setVal('vat_frequency')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Financial Year End Date</Label>
            <Input type="date" value={form.financial_year_end} onChange={set('financial_year_end')} />
          </div>
          <div>
            <Label>Address Line 1</Label>
            <Input value={form.address_line_1} onChange={set('address_line_1')} />
          </div>
          <div>
            <Label>Address Line 2</Label>
            <Input value={form.address_line_2} onChange={set('address_line_2')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>City</Label>
              <Input value={form.city} onChange={set('city')} />
            </div>
            <div>
              <Label>County</Label>
              <Input value={form.county} onChange={set('county')} />
            </div>
            <div>
              <Label>Postcode</Label>
              <Input value={form.postcode} onChange={set('postcode')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={set('phone')} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={set('email')} type="email" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Company'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}