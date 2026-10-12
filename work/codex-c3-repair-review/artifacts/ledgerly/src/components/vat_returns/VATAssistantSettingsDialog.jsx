import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { aiApi } from '@/components/ai-accountant/api';

const initialRule = { code: '', label: '', rate: '20', treatment: 'standard', effective_from: new Date().toISOString().slice(0, 10), is_recoverable: true };

export default function VATAssistantSettingsDialog({ open, onOpenChange, companyId, settings, taxRules = [], onSaved }) {
  const [form, setForm] = useState({});
  const [rule, setRule] = useState(initialRule);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setForm({
        vat_registered: Boolean(settings?.vat_registered),
        vat_number: settings?.vat_number || '',
        vat_scheme: 'standard',
        vat_return_frequency: settings?.frequency || 'quarterly',
        vat_accounting_basis: 'invoice',
        vat_return_due_days: settings?.return_due_days ?? 37,
        vat_registration_threshold: settings?.threshold ?? 90000,
        vat_threshold_monitoring: true,
      });
      setRule(initialRule);
      setError(null);
    }
  }, [open, settings]);

  const saveSettings = async () => {
    setSaving(true); setError(null);
    try {
      await aiApi.updateVatSettings(companyId, { ...form, vat_return_due_days: Number(form.vat_return_due_days), vat_registration_threshold: Number(form.vat_registration_threshold) });
      await onSaved();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };
  const addRule = async () => {
    setSaving(true); setError(null);
    try {
      await aiApi.addVatTaxRule(companyId, { ...rule, rate: Number(rule.rate) });
      setRule(initialRule);
      await onSaved();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>VAT Assistant settings</DialogTitle>
          <DialogDescription>These settings guide VAT preparation and review. They do not register you for VAT or make a filing.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          <label className="flex gap-2 items-center text-sm font-medium"><input type="checkbox" checked={Boolean(form.vat_registered)} onChange={e => set('vat_registered', e.target.checked)} /> VAT registered</label>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>VAT registration number</Label><Input value={form.vat_number || ''} onChange={e => set('vat_number', e.target.value)} /></div>
            <div><Label>VAT return due days</Label><Input type="number" min="1" value={form.vat_return_due_days ?? 37} onChange={e => set('vat_return_due_days', e.target.value)} /></div>
            <div><Label>VAT scheme</Label><Select value="standard" disabled><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="standard">Standard accounting</SelectItem></SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Cash and flat-rate schemes are not calculated in this phase.</p></div>
            <div><Label>Return frequency</Label><Select value={form.vat_return_frequency || 'quarterly'} onValueChange={v => set('vat_return_frequency', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="annual">Annual</SelectItem></SelectContent></Select></div>
            <div><Label>Accounting basis</Label><Select value="invoice" disabled><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="invoice">Invoice basis</SelectItem></SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Cash-basis VAT is not calculated in this phase.</p></div>
            <div><Label>Registration threshold (£)</Label><Input type="number" min="0" value={form.vat_registration_threshold ?? 90000} onChange={e => set('vat_registration_threshold', e.target.value)} /></div>
          </div>
          <div className="border-t pt-4">
            <div className="flex justify-between gap-3 items-center mb-3"><div><h3 className="font-medium text-sm">Date-effective tax rules</h3><p className="text-xs text-muted-foreground">Rules are a transparent reference for review. They never reclassify posted documents.</p></div><span className="text-xs text-muted-foreground">{taxRules.length} configured</span></div>
            {taxRules.length > 0 && <div className="mb-3 text-xs space-y-1">{taxRules.map(item => <p key={item.id}>{item.code} · {item.label} · {item.rate}% from {item.effective_from}</p>)}</div>}
            <div className="grid sm:grid-cols-2 gap-2">
              <Input placeholder="Code, e.g. STD" value={rule.code} onChange={e => setRule(r => ({ ...r, code: e.target.value }))} />
              <Input placeholder="Rule label" value={rule.label} onChange={e => setRule(r => ({ ...r, label: e.target.value }))} />
              <Input type="number" step="0.01" placeholder="Rate %" value={rule.rate} onChange={e => setRule(r => ({ ...r, rate: e.target.value }))} />
              <Input type="date" value={rule.effective_from} onChange={e => setRule(r => ({ ...r, effective_from: e.target.value }))} />
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addRule} disabled={saving || !rule.code || !rule.label}>Add tax rule</Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button><Button onClick={saveSettings} disabled={saving}>{saving ? 'Saving…' : 'Save VAT settings'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}