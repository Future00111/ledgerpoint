import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';

const EMPTY_FORM = {
  name: '', contact_name: '', email: '', phone: '',
  address_line_1: '', address_line_2: '', city: '', county: '', postcode: '', country: 'United Kingdom',
  vat_number: '', customer_reference: '', payment_terms: 30, credit_limit: 0, status: 'active', notes: '',
};

export default function CustomerForm({ open, onOpenChange, editing, companyId, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          name: editing.name || '', contact_name: editing.contact_name || '',
          email: editing.email || '', phone: editing.phone || '',
          address_line_1: editing.address_line_1 || '', address_line_2: editing.address_line_2 || '',
          city: editing.city || '', county: editing.county || '', postcode: editing.postcode || '',
          country: editing.country || 'United Kingdom', vat_number: editing.vat_number || '',
          customer_reference: editing.customer_reference || '', payment_terms: editing.payment_terms ?? 30,
          credit_limit: editing.credit_limit ?? 0, status: editing.status || 'active', notes: editing.notes || '',
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
      const payload = { ...form, credit_limit: Number(form.credit_limit) || 0, payment_terms: Number(form.payment_terms) };
      if (editing) {
        await base44.entities.Customer.update(editing.id, payload);
        toast({ title: 'Customer updated' });
      } else {
        await base44.entities.Customer.create({ ...payload, company_id: companyId });
        toast({ title: 'Customer created' });
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
          <DialogTitle>{editing ? 'Edit Customer' : 'New Customer'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Customer Name *</Label>
            <Input value={form.name} onChange={set('name')} placeholder="Business or customer name" />
          </div>
          <div>
            <Label>Contact Name</Label>
            <Input value={form.contact_name} onChange={set('contact_name')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={set('phone')} />
            </div>
          </div>
          <div>
            <Label>Address Line 1</Label>
            <Input value={form.address_line_1} onChange={set('address_line_1')} />
          </div>
          <div>
            <Label>Address Line 2</Label>
            <Input value={form.address_line_2} onChange={set('address_line_2')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Town/City</Label>
              <Input value={form.city} onChange={set('city')} />
            </div>
            <div>
              <Label>County</Label>
              <Input value={form.county} onChange={set('county')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Postcode</Label>
              <Input value={form.postcode} onChange={set('postcode')} />
            </div>
            <div>
              <Label>Country</Label>
              <Input value={form.country} onChange={set('country')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>VAT Number</Label>
              <Input value={form.vat_number} onChange={set('vat_number')} placeholder="e.g. GB123456789" />
            </div>
            <div>
              <Label>Customer Reference</Label>
              <Input value={form.customer_reference} onChange={set('customer_reference')} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Payment Terms</Label>
              <Select value={String(form.payment_terms)} onValueChange={v => setVal('payment_terms')(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="60">60 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Credit Limit (£)</Label>
              <Input type="number" value={form.credit_limit} onChange={set('credit_limit')} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={setVal('status')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={form.notes} onChange={set('notes')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Customer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}