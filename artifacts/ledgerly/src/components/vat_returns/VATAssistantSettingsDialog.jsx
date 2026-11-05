import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { aiApi } from '@/components/ai-accountant/api';

import { accounting } from '@/api/accountingDocuments.mjs';
import { TAX_TREATMENTS, supportedBusiness, MIN_ACCOUNTING_DATE, MAX_ACCOUNTING_DATE } from '@/features/onboarding/model.mjs';
import { emptyTaxRule, selectTaxTreatment, taxRulePayload, vatSettingsValues, vatSettingsPayload } from '@/features/onboarding/taxRuleInputs.mjs';

export default function VATAssistantSettingsDialog({ open, onOpenChange, companyId, onSaved }) {
  const [form, setForm] = useState({});
  const [rule, setRule] = useState(emptyTaxRule);
  const [setup, setSetup] = useState(null);
  const company = setup?.company?.id === companyId ? setup.company : null;
  const taxRules = company ? setup.tax_rules : [];
  const canEdit = Boolean(company && setup.capabilities?.edit_drafts === true);
  const supported = supportedBusiness(company);
  const current = useRef(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const selected = {}, controller = new AbortController();
    current.current = selected;
    setSetup(null); setForm({}); setRule(emptyTaxRule()); setError(null); setSaving(false);
    if (open) accounting.context(companyId, 'sales_invoice', controller.signal).then(context => {
      if (controller.signal.aborted || current.current !== selected) return;
      if (context?.company?.id !== companyId || !Array.isArray(context.tax_rules)) throw new Error('The current company tax setup could not be verified.');
      setSetup(context); setForm(vatSettingsValues(context.company));
    }).catch(failure => { if (!controller.signal.aborted && current.current === selected) setError(failure.message); });
    return () => { controller.abort(); current.current = null; };
  }, [open, companyId]);

  const saveSettings = async () => {
    if (saving || !canEdit || !supported) return;
    const selected = current.current;
    setSaving(true); setError(null);
    try {
      await aiApi.updateVatSettings(companyId, vatSettingsPayload(form, company));
      if (current.current === selected) await onSaved();
    } catch (e) { if (current.current === selected) setError(e.message); }
    finally { if (current.current === selected) setSaving(false); }
  };
  const addRule = async () => {
    if (saving || !canEdit || !supported) return;
    if (form.vat_registered !== company.vat_registered) { setError('Save the VAT registration setting first, then reopen settings to add tax rules for the saved status.'); return; }
    const selected = current.current;
    setSaving(true); setError(null);
    try {
      await aiApi.addVatTaxRule(companyId, taxRulePayload(rule, company.vat_registered, taxRules));
      if (current.current === selected) setRule(emptyTaxRule());
      if (current.current === selected) await onSaved();
    } catch (e) { if (current.current === selected) setError(e.message); }
    finally { if (current.current === selected) setSaving(false); }
  };
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>VAT settings &amp; tax rules</DialogTitle>
          <DialogDescription>These settings guide VAT preparation and review. They do not register you for VAT or make a filing.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {company && !supported && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">The saved business profile is outside the current UK GBP, Standard invoice-basis VAT or non-VAT workflow. Existing settings are preserved. Review the company profile before changing tax rules.</p>}
          {company && !canEdit && <p className="text-sm text-muted-foreground">You can review these settings. An owner, administrator or accountant must make changes.</p>}
          {!company && !error && <p role="status" className="text-sm text-muted-foreground">Loading saved VAT settings…</p>}
          <fieldset disabled={saving || !canEdit || !supported} className="space-y-5">
          <label className="flex gap-2 items-center text-sm font-medium"><input type="checkbox" checked={Boolean(form.vat_registered)} onChange={e => set('vat_registered', e.target.checked)} /> VAT registered</label>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>VAT registration number</Label><Input value={form.vat_number || ''} onChange={e => set('vat_number', e.target.value)} /></div>
            <div><Label>VAT return due days</Label><Input type="number" min="1" value={form.vat_return_due_days ?? ''} onChange={e => set('vat_return_due_days', e.target.value)} /></div>
            <div><Label>VAT scheme</Label><Select value={form.vat_scheme || 'unconfigured'} disabled><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={form.vat_scheme || 'unconfigured'}>{form.vat_scheme || 'Not configured'}</SelectItem></SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Cash and flat-rate schemes are not calculated in this phase.</p></div>
            <div><Label>Return frequency</Label><Select value={form.vat_return_frequency || 'quarterly'} onValueChange={v => set('vat_return_frequency', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="annual">Annual</SelectItem></SelectContent></Select></div>
            <div><Label>Accounting basis</Label><Select value={form.vat_accounting_basis || 'unconfigured'} disabled><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={form.vat_accounting_basis || 'unconfigured'}>{form.vat_accounting_basis || 'Not configured'}</SelectItem></SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Cash-basis VAT is not calculated in this phase.</p></div>
            <div><Label>Registration threshold (£)</Label><Input type="number" min="0" value={form.vat_registration_threshold ?? ''} onChange={e => set('vat_registration_threshold', e.target.value)} /></div>
          </div>
          <div className="border-t pt-4">
            <div className="flex justify-between gap-3 items-center mb-3"><div><h3 className="font-medium text-sm">Date-effective tax rules</h3><p className="text-xs text-muted-foreground">Rules are a transparent reference for review. They never reclassify posted documents.</p></div><span className="text-xs text-muted-foreground">{taxRules.length} configured</span></div>
            {taxRules.length > 0 && <div className="mb-3 text-xs space-y-1">{taxRules.map(item => <p key={item.id}>{item.code} · {item.label} · {item.rate}% from {item.effective_from}</p>)}</div>}
            <p className="mb-3 text-xs text-muted-foreground">Choose the treatment and effective dates explicitly for the saved VAT registration status. Not VAT registered and zero rated are different treatments. Adding a rule does not approve its use for a particular invoice or bill.</p>
            {company && form.vat_registered !== company.vat_registered && <p className="mb-3 text-sm text-amber-900">Save the VAT registration setting first, then reopen settings to add tax rules for the saved status.</p>}
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label htmlFor="tax-rule-code">Tax code</Label><Input id="tax-rule-code" value={rule.code} onChange={e => setRule(r => ({ ...r, code: e.target.value }))} /></div>
              <div><Label htmlFor="tax-rule-label">Label / reason for treatment</Label><Input id="tax-rule-label" value={rule.label} onChange={e => setRule(r => ({ ...r, label: e.target.value }))} /></div>
              <div><Label htmlFor="tax-rule-treatment">Treatment and rate</Label><select id="tax-rule-treatment" className="mt-1 w-full rounded-md border bg-background p-2 text-sm" value={rule.treatment} onChange={e => setRule(r => selectTaxTreatment(r, e.target.value))}>
                <option value="">Choose a treatment</option>{TAX_TREATMENTS.filter(item => company?.vat_registered === false ? item.value === 'no_vat' : company?.vat_registered === true && item.value !== 'no_vat').map(item => <option key={item.value} value={item.value}>{item.label} · {item.rate}%</option>)}
              </select></div>
              <div><Label htmlFor="tax-rule-start">Effective from</Label><Input id="tax-rule-start" type="date" min={MIN_ACCOUNTING_DATE} max={MAX_ACCOUNTING_DATE} value={rule.effective_from} onChange={e => setRule(r => ({ ...r, effective_from: e.target.value }))} /></div>
              <div><Label htmlFor="tax-rule-end">Effective to (optional)</Label><Input id="tax-rule-end" type="date" min={MIN_ACCOUNTING_DATE} max={MAX_ACCOUNTING_DATE} value={rule.effective_to} onChange={e => setRule(r => ({ ...r, effective_to: e.target.value }))} /></div>
            </div>
            {company?.vat_registered && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={rule.is_recoverable} onChange={e => setRule(r => ({ ...r, is_recoverable: e.target.checked }))} />Rule is eligible for recoverable purchase VAT; each bill still requires review</label>}
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addRule} disabled={saving || !rule.code || !rule.label || !rule.treatment || !rule.effective_from || form.vat_registered !== company?.vat_registered}>Add reviewed tax rule</Button>
          </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button><Button onClick={saveSettings} disabled={saving || !canEdit || !supported}>{saving ? 'Saving…' : 'Save VAT settings'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
