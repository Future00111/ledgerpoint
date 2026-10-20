import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { invoiceDrafts, displayPence } from '@/api/invoiceDrafts.mjs';
import { useCompany } from '@/lib/useCompany';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

const line = () => ({ description: '', quantity: '1', unit_price: '0', tax_code: '' });
const initial = () => ({
  customer_id: '', invoice_number: '', issue_date: new Date().toISOString().slice(0, 10),
  due_date: new Date().toISOString().slice(0, 10), payment_terms: 30,
  reference: '', notes: '', line_items: [line()],
});
export default function InvoiceForm() {
  const { activeCompany, roles } = useCompany();
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const editId = id && id !== 'new' ? id : undefined;
  const [form, setForm] = useState(initial);
  const [customers, setCustomers] = useState([]);
  const [revision, setRevision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hold, setHold] = useState(false);
  const [money, setMoney] = useState(null);
  const generation = useRef(0);
  const allowed = ['owner', 'admin', 'accountant'].includes(roles[activeCompany?.id]);

  useEffect(() => {
    const current = ++generation.current;
    const controller = new AbortController();
    setForm(initial()); setRevision(null); setCustomers([]); setMoney(null);
    setError(''); setHold(false); setSaving(false); setLoading(true);
    if (!activeCompany) return () => controller.abort();
    (async () => {
      try {
        const list = await base44.entities.Customer.filter({ company_id: activeCompany.id });
        const draft = editId ? await invoiceDrafts.get(activeCompany.id, editId, controller.signal) : null;
        if (generation.current !== current || controller.signal.aborted) return;
        setCustomers(list);
        if (draft) { setForm(draft.source); setRevision(draft.revision); setMoney(draft.money ?? null); }
      } catch (e) {
        if (generation.current === current && !controller.signal.aborted) {
          setError(e.message); setHold(true);
        }
      } finally { if (generation.current === current && !controller.signal.aborted) setLoading(false); }
    })();
    return () => { controller.abort(); generation.current++; };
  }, [activeCompany?.id, editId]);

  const change = (key, value) => setForm(f => ({ ...f, [key]: value }));
  const updateLine = (index, key, value) => setForm(f => ({ ...f,
    line_items: f.line_items.map((l, i) => i === index ? { ...l, [key]: value } : l) }));
  const save = async (event) => {
    event.preventDefault();
    if (!activeCompany || !allowed || hold || saving || loading) return;
    const current = generation.current;
    setSaving(true); setError('');
    try {
      const saved = await invoiceDrafts.save(activeCompany.id, form, editId, revision);
      if (generation.current !== current) return;
      setRevision(saved.revision); setMoney(saved.money);
      toast({ title: 'Draft invoice saved', description: `Server total ${displayPence(saved.money.gross_pence)}. No posting or payment was created.` });
      // List remount refetches, and edit reload uses this protected source/revision.
      navigate('/invoices');
    } catch (e) {
      if (generation.current !== current) return;
      setError(`${e.message}${e.code ? ` (${e.code})` : ''}`);
      // Do not silently replay after a conflict, provider hold or uncertain commit.
      if (!e.status || e.status >= 500 || [409, 403].includes(e.status)) setHold(true);
    } finally { if (generation.current === current) setSaving(false); }
  };
  const disabled = !allowed || hold || saving || loading;
  if (!activeCompany) return <p>Select a company to prepare an invoice draft.</p>;
  return <form onSubmit={save} className="max-w-4xl mx-auto space-y-6">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-semibold">{editId ? 'Edit draft invoice' : 'New draft invoice'}</h1>
      <Button type="button" variant="outline" onClick={() => navigate('/invoices')}>Back to invoices</Button>
    </div>
    <p className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-950">
      Development draft contract: saving is held until approved VAT and lifecycle providers and reviewed storage are connected.
      Precision/rounding fixtures await accounting acceptance. Saving never issues, posts, pays or reconciles an invoice.
    </p>
    {search.get('bank_transaction_id') && <p className="text-sm">Bank receipt context does not establish VAT eligibility or record a payment.</p>}
    {!allowed && <p role="alert">Your current role cannot save invoice drafts. Managers need an approved scope; no Manager write grant is enabled.</p>}
    {error && <div role="alert" className="rounded border border-red-300 p-4 text-red-900">
      {error}{hold && <><p>Saving is held. Reloading will discard unsaved changes; do not automatically resubmit an uncertain save.</p>
        <Button type="button" variant="outline" onClick={() => window.location.reload()}>Reload and discard unsaved changes</Button></>}
    </div>}
    {loading && <p>Loading current company draft context…</p>}
    <fieldset disabled={disabled} className="space-y-6">
      <Card><CardContent className="pt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="customer">Customer</Label><select id="customer" required value={form.customer_id}
            className="w-full border rounded p-2" onChange={e => change('customer_id', e.target.value)}>
            <option value="">Select customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
          <div><Label htmlFor="number">Invoice number</Label><Input id="number" required maxLength={64} value={form.invoice_number} onChange={e => change('invoice_number', e.target.value)} /></div>
          <div><Label htmlFor="issue">Invoice date</Label><Input id="issue" required type="date" value={form.issue_date} onChange={e => change('issue_date', e.target.value)} /></div>
          <div><Label htmlFor="due">Due date</Label><Input id="due" required type="date" value={form.due_date} onChange={e => change('due_date', e.target.value)} /></div>
          <div><Label htmlFor="terms">Payment terms (days)</Label><Input id="terms" required type="number" min={0} max={365} step={1} value={form.payment_terms} onChange={e => change('payment_terms', Number(e.target.value))} /></div>
          <div><Label htmlFor="reference">Reference</Label><Input id="reference" maxLength={200} value={form.reference} onChange={e => change('reference', e.target.value)} /></div>
        </div>
        <p className="text-sm text-muted-foreground">GBP, VAT-exclusive source prices. Enter an approved company tax code, not a guessed rate. Totals are calculated by the server.</p>
        {form.line_items.map((l, i) => <div key={i} className="grid gap-3 border rounded p-3 sm:grid-cols-2">
          {[['description', 'Description'], ['quantity', 'Quantity (up to 4 decimals)'], ['unit_price', 'Unit price GBP (up to 4 decimals)'], ['tax_code', 'Approved tax code']].map(([key, title]) =>
            <div key={key}><Label htmlFor={`line-${i}-${key}`}>{title}</Label><Input id={`line-${i}-${key}`} required
              inputMode={['quantity', 'unit_price'].includes(key) ? 'decimal' : 'text'} value={l[key]}
              onChange={e => updateLine(i, key, e.target.value)} /></div>)}
          <Button type="button" variant="outline" disabled={form.line_items.length === 1} onClick={() => change('line_items', form.line_items.filter((_, j) => j !== i))}>Remove line</Button>
        </div>)}
        <Button type="button" variant="outline" disabled={form.line_items.length >= 200} onClick={() => change('line_items', [...form.line_items, line()])}>Add line</Button>
        <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" maxLength={4000} value={form.notes} onChange={e => change('notes', e.target.value)} /></div>
      </CardContent></Card>
      {money && <p>Last server-calculated draft total: {displayPence(money.gross_pence)} (GBP).</p>}
      <Button type="submit">{saving ? 'Saving draft…' : 'Save draft invoice'}</Button>
    </fieldset>
  </form>;
}
