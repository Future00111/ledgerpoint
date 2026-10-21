import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { invoiceDrafts, displayPence } from '@/api/invoiceDrafts.mjs';
import { newInvoiceDates, changeInvoiceFields } from '@/api/invoiceEditor.mjs';
import InvoiceDocument from '@/components/invoices/InvoiceDocument';
import { useCompany } from '@/lib/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

const line = () => ({ description: '', quantity: '1', unit_price: '0', tax_code: '' });
const initial = () => ({
  customer_id: '', invoice_number: '', price_basis: 'excluding_vat', ...newInvoiceDates(),
  reference: '', notes: '', line_items: [line()],
});
export default function InvoiceForm() {
  const { activeCompany, roles, selectionWarning } = useCompany();
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const editId = id && id !== 'new' ? id : undefined;
  const [form, setForm] = useState(initial);
  const [companyContext, setCompanyContext] = useState(null);
  const [revision, setRevision] = useState(null);
  const [taxContext, setTaxContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hold, setHold] = useState(false);
  const [money, setMoney] = useState(null);
  const [automaticDueDate, setAutomaticDueDate] = useState(!editId);
  const generation = useRef(0);
  const allowed = ['owner', 'admin', 'accountant'].includes(roles[activeCompany?.id]);

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setForm(initial()); setRevision(null); setCompanyContext(null); setTaxContext(null); setMoney(null);
    setAutomaticDueDate(!editId);
    setError(''); setHold(false); setSaving(false); setLoading(true);
    if (!activeCompany) return () => controller.abort();
    (async () => {
      try {
        const [context, draft] = await Promise.all([
          invoiceDrafts.context(activeCompany.id, controller.signal),
          editId ? invoiceDrafts.get(activeCompany.id, editId, controller.signal) : Promise.resolve(null),
        ]);
        if (generation.current !== current || controller.signal.aborted) return;
        setCompanyContext(context);
        if (draft) {
          setAutomaticDueDate(false);
          setForm({ ...draft.source, price_basis: draft.source.price_basis ?? 'excluding_vat' }); setRevision(draft.revision);
          setMoney(draft.money ?? null); setTaxContext(draft.tax_context ?? null);
        }
      } catch (e) {
        if (generation.current === current && !controller.signal.aborted) {
          setError(e.message); setHold(true);
        }
      } finally { if (generation.current === current && !controller.signal.aborted) setLoading(false); }
    })();
    return () => { controller.abort(); generation.current++; };
  }, [activeCompany?.id, editId]);

  const change = (key, value) => {
    setMoney(null); setTaxContext(null);
    if (key === 'due_date') setAutomaticDueDate(false);
    setForm(f => changeInvoiceFields(f, key, value, !editId && automaticDueDate));
  };
  const updateLine = (index, key, value) => {
    setMoney(null); setTaxContext(null);
    setForm(f => ({ ...f, line_items: f.line_items.map((l, i) => i === index ? { ...l, [key]: value } : l) }));
  };
  const save = async (event) => {
    event.preventDefault();
    if (!activeCompany || !allowed || hold || saving || loading) return;
    const current = generation.current;
    setSaving(true); setError('');
    try {
      const saved = await invoiceDrafts.save(activeCompany.id, form, editId, revision);
      if (generation.current !== current) return;
      setRevision(saved.revision); setMoney(saved.money); setTaxContext(saved.tax_context ?? null);
      toast({ title: 'Draft invoice saved', description: `Draft total ${displayPence(saved.money.gross_pence)}. Not sent or posted.` });
      // Keep the saved draft open; a new draft is now reachable by its protected edit route.
      if (!editId) navigate(`/invoices/${saved.id}`, { replace: true });
    } catch (e) {
      if (generation.current !== current) return;
      setError(`${e.message}${e.code ? ` (${e.code})` : ''}`);
      // Do not silently replay after a conflict, provider hold or uncertain commit.
      if (!e.status || e.status >= 500 || [409, 403].includes(e.status)) setHold(true);
    } finally { if (generation.current === current) setSaving(false); }
  };
  const taxRules = (companyContext?.tax_rules ?? []).filter(rule => {
    if (rule.effective_from > form.issue_date || (rule.effective_to && rule.effective_to < form.issue_date)) return false;
    const treatment = String(rule.treatment || '').toLowerCase();
    const expectedRate = { standard: 20, reduced: 5, zero: 0, exempt: 0, outside_scope: 0, no_vat: 0 }[treatment];
    if (expectedRate === undefined || Number(rule.rate) !== expectedRate || !rule.code || !String(rule.label || '').trim()) return false;
    const company = companyContext.company;
    if (company.vat_registered === false) return treatment === 'no_vat';
    return company.vat_registered === true && company.vat_scheme === 'standard' &&
      company.vat_accounting_basis === 'invoice';
  });
  const selectedRulesValid = form.line_items.every(item =>
    taxRules.some(rule => rule.code === item.tax_code));
  const selectedCustomer = companyContext?.customers.find(customer => customer.id === form.customer_id) ?? null;
  const savedLines = Array.isArray(money?.lines) ? money.lines : [];
  const totalsAvailable = Boolean(money && savedLines.length === form.line_items.length);
  const preview = {
    invoice_number: form.invoice_number || 'Draft invoice',
    issue_date: form.issue_date,
    due_date: form.due_date,
    payment_terms: form.payment_terms,
    reference: form.reference,
    notes: form.notes,
    status: 'draft',
    preview: true,
    price_basis: form.price_basis,
    previewTotalsAvailable: totalsAvailable,
    subtotal: totalsAvailable ? Number(money.net_pence) / 100 : null,
    vat_total: totalsAvailable ? Number(money.vat_pence) / 100 : null,
    total: totalsAvailable ? Number(money.gross_pence) / 100 : null,
    line_items: form.line_items.map((item, index) => {
      const savedRule = taxContext?.lines?.[index];
      const rule = savedRule?.code === item.tax_code ? savedRule :
        taxRules.find(candidate => candidate.code === item.tax_code);
      const computed = totalsAvailable ? savedLines[index] : null;
      return {
        ...item,
        vat_rate: rule?.rate ?? '',
        tax_treatment: rule?.treatment ?? '',
        vat_label: rule ? `${rule.code} · ${rule.label}` : (item.tax_code || 'Tax code not selected'),
        amount: computed ? Number(computed.net_pence) / 100 : null,
        vat_amount: computed ? Number(computed.vat_pence) / 100 : null,
        line_total: computed ? Number(computed.gross_pence) / 100 : null,
      };
    }),
  };
  const disabled = !allowed || hold || saving || loading || !companyContext?.can_write_draft;
  if (!activeCompany) return <div className="mx-auto max-w-xl space-y-3 rounded-xl border p-6 text-center">
    <p>Select a company to prepare an invoice draft.</p>
    <Button type="button" variant="outline" onClick={() => navigate('/companies')}>{import.meta.env.DEV ? 'Open Companies to select or create a synthetic demo' : 'Open Companies'}</Button>
  </div>;
  return <form onSubmit={save} className="mx-auto max-w-7xl space-y-6">
    {selectionWarning && <p role="status" className="rounded-lg border p-3 text-sm">{selectionWarning}</p>}
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-primary">Sales · Draft only</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{editId ? 'Edit draft invoice' : 'New invoice'}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Prepare the details, review the document, then save it as a draft.</p>
      </div>
      <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>Back to invoices</Button>
    </header>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      Draft only — not sent or posted. Choose whether your prices include VAT and select a company tax code valid on the invoice date.
      <p className="mt-2">Supports GBP drafts with Standard invoice-basis VAT or a no-VAT treatment. Discounts and credit invoices are not supported.</p>
    </div>
    {search.get('bank_transaction_id') && <p className="rounded-lg border p-3 text-sm text-muted-foreground">Saving this draft does not record a bank receipt or payment.</p>}
    {!allowed && <p role="alert" className="rounded-lg border border-red-300 p-4 text-sm text-red-900">Your current role cannot save invoice drafts.</p>}
    {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-medium">{error}</p>
      {hold && <div className="mt-3 flex flex-wrap items-center gap-3">
        <span>Saving is held. Reloading will discard unsaved changes; do not automatically resubmit an uncertain save.</span>
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>Reload and discard changes</Button>
      </div>}
    </div>}
    {loading && <p role="status" className="text-sm text-muted-foreground">Loading company, customer and tax-rule context…</p>}
    {!loading && companyContext && taxRules.length === 0 && <p role="alert" className="rounded-lg border border-orange-300 bg-orange-50 p-4 text-sm text-orange-950">
      No usable company tax code is effective on this invoice date. Add or correct a company rule before saving; no rate or no-VAT treatment is assumed.
    </p>}
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(400px,0.9fr)]">
      <fieldset disabled={disabled} className="min-w-0 space-y-6">
        <Card><CardContent className="space-y-5 p-5">
          <div>
            <h2 className="text-lg font-semibold">Invoice details</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose an active customer and dates for this draft.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><Label htmlFor="customer">Customer</Label><select id="customer" required value={form.customer_id}
              className="mt-1.5 w-full rounded-md border bg-background p-2.5" onChange={e => change('customer_id', e.target.value)}>
              <option value="">Select customer</option>{companyContext?.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              {form.customer_id && !companyContext?.customers.some(c => c.id === form.customer_id) && <option value={form.customer_id}>Customer needs review</option>}
            </select></div>
            <div><Label htmlFor="number">Invoice number</Label><Input className="mt-1.5" id="number" required maxLength={64} value={form.invoice_number} onChange={e => change('invoice_number', e.target.value)} /></div>
            <div><Label htmlFor="reference">Reference <span className="font-normal text-muted-foreground">(optional)</span></Label><Input className="mt-1.5" id="reference" maxLength={200} value={form.reference} onChange={e => change('reference', e.target.value)} /></div>
            <div><Label htmlFor="issue">Invoice date</Label><Input className="mt-1.5" id="issue" required type="date" value={form.issue_date} onChange={e => change('issue_date', e.target.value)} /></div>
            <div><Label htmlFor="due">Due date</Label><Input className="mt-1.5" id="due" required type="date" value={form.due_date} onChange={e => change('due_date', e.target.value)} /></div>
            <div><Label htmlFor="terms">Payment terms (days)</Label><Input className="mt-1.5" id="terms" required type="number" min={0} max={365} step={1} value={form.payment_terms} onChange={e => change('payment_terms', Number(e.target.value))} /></div>
          </div>
        </CardContent></Card>
        <Card><CardContent className="space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-lg font-semibold">Items</h2><p className="mt-1 text-sm text-muted-foreground">Select a company tax code for each item.</p></div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{form.line_items.length} line{form.line_items.length === 1 ? '' : 's'}</span>
          </div>
          <div className="space-y-2 rounded-lg bg-muted/40 p-4">
            <Label htmlFor="price-basis">Prices are</Label>
            <select id="price-basis" value={form.price_basis}
              className="block w-full rounded-md border bg-background p-2.5 sm:max-w-xs"
              onChange={e => change('price_basis', e.target.value)}>
              <option value="excluding_vat">Excluding VAT</option>
              <option value="including_vat">Including VAT</option>
            </select>
            <p className="text-sm text-muted-foreground">Changing this treats the same entered prices differently; amounts are not converted. Save draft to update the totals.</p>
          </div>
          {form.line_items.map((l, i) => <section key={i} className="space-y-4 rounded-xl border bg-background p-4" aria-label={`Invoice item ${i + 1}`}>
            <div className="flex items-center justify-between"><h3 className="font-medium">Item {i + 1}</h3>
              <Button type="button" variant="ghost" size="sm" disabled={form.line_items.length === 1} onClick={() => change('line_items', form.line_items.filter((_, j) => j !== i))}>Remove</Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label htmlFor={`line-${i}-description`}>Description</Label><Input className="mt-1.5" id={`line-${i}-description`} required maxLength={500} value={l.description} onChange={e => updateLine(i, 'description', e.target.value)} /></div>
              <div><Label htmlFor={`line-${i}-quantity`}>Quantity</Label><Input className="mt-1.5" id={`line-${i}-quantity`} required inputMode="decimal" value={l.quantity} onChange={e => updateLine(i, 'quantity', e.target.value)} /></div>
              <div><Label htmlFor={`line-${i}-unit_price`}>Unit price (GBP, {form.price_basis === 'including_vat' ? 'including' : 'excluding'} VAT)</Label><Input className="mt-1.5" id={`line-${i}-unit_price`} required inputMode="decimal" value={l.unit_price} onChange={e => updateLine(i, 'unit_price', e.target.value)} /></div>
              <div className="sm:col-span-2"><Label htmlFor={`line-${i}-tax_code`}>Company tax code</Label>
                <select id={`line-${i}-tax_code`} required value={l.tax_code} className="mt-1.5 w-full rounded-md border bg-background p-2.5"
                  onChange={e => updateLine(i, 'tax_code', e.target.value)}>
                  <option value="">Select a date-effective tax rule</option>
                  {l.tax_code && !taxRules.some(rule => rule.code === l.tax_code) && <option value={l.tax_code}>{l.tax_code} · no longer available for this date</option>}
                  {taxRules.map(rule => <option key={rule.id} value={rule.code}>{rule.code} · {rule.label} · {Number(rule.rate).toFixed(2)}%</option>)}
                </select>
              </div>
            </div>
          </section>)}
          <Button type="button" variant="outline" disabled={form.line_items.length >= 200} onClick={() => change('line_items', [...form.line_items, line()])}>Add another item</Button>
          <div><Label htmlFor="notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea className="mt-1.5" id="notes" maxLength={4000} value={form.notes} onChange={e => change('notes', e.target.value)} /></div>
        </CardContent></Card>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {totalsAvailable && <p className="mr-auto text-sm text-muted-foreground">Saved total: {displayPence(money.gross_pence)}</p>}
          <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>Cancel</Button>
          <Button type="submit" disabled={disabled || !selectedRulesValid}>{saving ? 'Saving draft…' : 'Save draft'}</Button>
        </div>
      </fieldset>
      <aside className="min-w-0 xl:sticky xl:top-4" aria-label="Invoice document preview">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Preview</h2><p className="text-sm text-muted-foreground">Draft · not issued</p></div>
          {totalsAvailable && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">Saved totals</span>}
        </div>
        <InvoiceDocument invoice={preview} customer={selectedCustomer} company={companyContext?.company ?? activeCompany} />
      </aside>
    </div>
  </form>;
}
