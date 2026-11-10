import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { EMPTY_COMPANY_FORM, companyFormValues, companyFormPayload, readCompanyReceipt } from '@/features/onboarding/companyForm.mjs';

export default function CompanyForm({ open, onOpenChange, editing, onSaved }) {
  const [form, setForm] = useState(EMPTY_COMPANY_FORM);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setForm(companyFormValues(editing));
    }
  }, [open, editing]);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));
  const setVal = (key) => (v) => setForm(f => ({ ...f, [key]: v }));

  const handleSave = async () => {
    if (saving || !String(form.name ?? '').trim()) return;
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/companies/${encodeURIComponent(editing.id)}` : '/api/companies', {
        method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(companyFormPayload(form)),
      });
      const receipt = await readCompanyReceipt(res);
      toast({ title: editing ? 'Company updated' : 'Company created', description: editing ? undefined : 'Review your accounting setup next.' });
      onOpenChange(false);
      await onSaved(receipt, { created: !editing });
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
          <p className="text-sm text-muted-foreground">The current native accounting workflow supports UK businesses using GBP and accrual accounting. Creating a company does not create accounts, tax rules or accounting periods.</p>
          <div>
            <Label>Company Name *</Label>
            <Input value={form.name ?? ''} onChange={set('name')} placeholder="e.g., ABC Garage Ltd" className="mt-1" />
          </div>
          <div>
            <Label>Companies House Number</Label>
            <Input value={form.registration_number ?? ''} onChange={set('registration_number')} placeholder="e.g., 12345678" className="mt-1" />
          </div>
          <div className="flex items-center justify-between pt-1">
            <Label>VAT Registered</Label>
            <Switch checked={form.vat_registered === true} onCheckedChange={setVal('vat_registered')} />
          </div>
          {form.vat_registered && (
            <>
              <div>
                <Label>VAT Number</Label>
                <Input value={form.vat_number ?? ''} onChange={set('vat_number')} placeholder="GB123456789" className="mt-1" />
              </div>
              <div>
                <Label>VAT Scheme</Label>
                <Select value={form.vat_scheme || 'unconfigured'} onValueChange={setVal('vat_scheme')} disabled={Boolean(editing && form.vat_scheme !== 'standard')}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard scheme · invoice basis</SelectItem>
                    {form.vat_scheme !== 'standard' && <SelectItem value={form.vat_scheme || 'unconfigured'}>{form.vat_scheme || 'Not configured'} · not supported by native calculations</SelectItem>}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Cash and flat-rate schemes are not currently calculated. Existing scheme and accounting-basis settings are preserved; review changes in VAT settings.</p>
                {form.vat_accounting_basis !== 'invoice' && <p role="alert" className="mt-1 text-sm text-amber-900">Saved VAT basis: {form.vat_accounting_basis || 'not configured'}. Native calculations require invoice basis.</p>}
              </div>
              <div>
                <Label>VAT Return Frequency</Label>
                <Select value={form.vat_return_frequency || 'unconfigured'} onValueChange={setVal('vat_return_frequency')}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annually</SelectItem>
                    {!['quarterly', 'monthly', 'annual'].includes(form.vat_return_frequency) && <SelectItem value={form.vat_return_frequency || 'unconfigured'}>{form.vat_return_frequency || 'Not configured'}</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div>
            <Label>Address Line 1</Label>
            <Input value={form.address_line_1 ?? ''} onChange={set('address_line_1')} placeholder="Street address" className="mt-1" />
          </div>
          <div>
            <Label>City</Label>
            <Input value={form.city ?? ''} onChange={set('city')} placeholder="London" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>County</Label>
              <Input value={form.county ?? ''} onChange={set('county')} className="mt-1" />
            </div>
            <div>
              <Label>Postcode</Label>
              <Input value={form.postcode ?? ''} onChange={set('postcode')} placeholder="SW1A 1AA" className="mt-1" />
            </div>
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone ?? ''} onChange={set('phone')} placeholder="+44 (0)20 1234 5678" className="mt-1" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email ?? ''} onChange={set('email')} placeholder="hello@example.com" className="mt-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !String(form.name ?? '').trim()} className="gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editing ? 'Save Changes' : 'Create Company'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
