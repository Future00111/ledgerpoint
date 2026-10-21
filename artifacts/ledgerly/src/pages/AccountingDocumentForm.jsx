import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { accounting, KINDS, buildEnvelope, copyOriginalLines, docPath } from '@/api/accountingDocuments.mjs';
import { useCompany } from '@/lib/useCompany';
import { useLedgerSnapshot } from '@/lib/useLedgerSnapshot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { dueFromTerms, changeDateField, submittedDates, postingAccounts, mappedId, accountLabel, issueFor, plannedAccounts, tradeRole } from '@/lib/accountingEditor.mjs';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { StatusPill, Money, ConfigErrors, JournalLink, ErrorBox, SkeletonRows, today } from '@/components/accounting/AccountingUI';

const blankLine = () => ({ description: '', quantity: '1', unit_price: '0', tax_code: '' });
const blankForm = () => ({ customer_id: '', invoice_number: '', issue_date: today(), due_date: dueFromTerms(today(), '30'), payment_terms: '30', reference: '', notes: '', price_basis: 'excluding_vat', line_items: [blankLine()] });
const blankExtra = () => ({ original_line_refs: [], original_id: '', reason: '', effective_adjustment_date: '', purchase_vat_eligible: false, posting_account_id: '' });
const sel = 'mt-1.5 w-full rounded-md border bg-background p-2.5 text-sm';

/** Shared native create/review/post page for all four accounting document kinds. */
export default function AccountingDocumentForm({ kind, legacyFallback = null }) {
  const meta = KINDS[kind];
  const { id } = useParams();
  const editId = id && id !== 'new' ? id : undefined;
  const { activeCompany } = useCompany();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ctx, setCtx] = useState(null);
  const [doc, setDoc] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [extra, setExtra] = useState(blankExtra);
  const [originals, setOriginals] = useState([]);
  const [originalDoc, setOriginalDoc] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [review, setReview] = useState(null);
  const [legacy, setLegacy] = useState(false);
  const gen = useRef(0);
  const manualDue = useRef(false);
  const [journal, setJournal] = useState({ status: 'idle', data: null, error: null });
  const settlement = useLedgerSnapshot(activeCompany?.id, undefined, undefined, doc?.status === 'posted' && !meta.credit);
  const openItem = settlement.data?.open_items.find(d => d.id === doc?.id);

  // Posted documents show the canonical journal lines, never the current mapping.
  useEffect(() => {
    if (!activeCompany || doc?.status !== 'posted' || !doc.journal_id) { setJournal({ status: 'idle', data: null, error: null }); return; }
    const c = new AbortController();
    setJournal({ status: 'loading', data: null, error: null });
    accounting.journal(activeCompany.id, doc.journal_id, c.signal)
      .then(data => setJournal({ status: 'ready', data, error: null }))
      .catch(e => { if (!c.signal.aborted) setJournal({ status: 'error', data: null, error: e }); });
    return () => c.abort();
  }, [activeCompany?.id, doc?.status, doc?.journal_id]);

  useEffect(() => {
    const g = ++gen.current; const c = new AbortController();
    manualDue.current = Boolean(editId);
    setReview(null);
    setCtx(null); setDoc(null); setForm(blankForm()); setExtra(blankExtra()); setDirty(false); setError(null); setLegacy(false); setLoading(true); setOriginalDoc(null);
    if (!activeCompany) return () => c.abort();
    (async () => {
      try {
        const [context, existing, origList] = await Promise.all([
          accounting.context(activeCompany.id, kind, c.signal),
          editId ? accounting.get(activeCompany.id, editId, c.signal).catch(e => { if (e.code === 'LEGACY_DRAFT') return 'LEGACY'; throw e; }) : null,
          meta.credit ? accounting.list(activeCompany.id, meta.original, c.signal) : [],
        ]);
        if (g !== gen.current) return;
        if (existing === 'LEGACY') { setLegacy(true); return; }
        setCtx(context);
        setOriginals((origList || []).filter(d => d.status === 'posted'));
        if (existing) {
          setDoc(existing);
          setForm({ ...blankForm(), ...existing.source, payment_terms: String(existing.source?.payment_terms ?? '0') });
          setExtra({
            original_line_refs: existing.tax_context?.original_line_refs ?? existing.source?.line_items?.map((_, i) => i) ?? [],
            original_id: existing.original_id || '', reason: existing.reason || '', effective_adjustment_date: existing.effective_adjustment_date || '',
            purchase_vat_eligible: existing.purchase_vat_eligible === true, posting_account_id: existing.posting_account_id || '',
          });
          if (existing.original_id) setOriginalDoc((origList || []).find(o => o.id === existing.original_id) || null);
        }
      } catch (e) { if (g === gen.current && !c.signal.aborted) setError(e); }
      finally { if (g === gen.current && !c.signal.aborted) setLoading(false); }
    })();
    return () => { c.abort(); gen.current++; };
  }, [activeCompany?.id, editId, kind]);

  if (legacy && legacyFallback) return legacyFallback;
  if (!activeCompany) return <p className="mx-auto max-w-xl rounded-xl border p-6 text-center">Select a company in <Link className="underline" to="/companies">Companies</Link> first.</p>;

  const posted = doc?.status === 'posted';
  const touch = () => setDirty(true);
  const change = (k, v) => {
    if (k === 'due_date') manualDue.current = true;
    touch(); setForm(f => changeDateField(f, k, v, manualDue.current, meta.credit));
  };
  const changeLine = (i, k, v) => { touch(); setForm(f => ({ ...f, line_items: f.line_items.map((l, j) => j === i ? { ...l, [k]: v } : l) })); };
  const removeCreditLine = (i) => {
    if (form.line_items.length <= 1) return;
    touch();
    setForm(f => ({ ...f, line_items: f.line_items.filter((_, j) => j !== i) }));
    setExtra(x => ({ ...x, original_line_refs: x.original_line_refs.filter((_, j) => j !== i) }));
  };
  const origLine = (i) => originalDoc?.source?.line_items?.[extra.original_line_refs[i]];
  const overQty = (i) => { const o = origLine(i); return o && Number(form.line_items[i].quantity) > Number(o.quantity); };
  const changeExtra = (k, v) => {
    touch();
    setExtra(x => ({ ...x, [k]: v }));
    if (k === 'effective_adjustment_date') setForm(f => ({ ...f, issue_date: v, due_date: f.due_date < v ? v : f.due_date }));
  };
  const pickOriginal = (oid) => {
    const o = originals.find(d => d.id === oid) || null;
    setOriginalDoc(o); touch();
    setExtra(x => ({ ...x, original_id: oid, original_line_refs: o ? o.source.line_items.map((_, i) => i) : [] }));
    if (o) setForm(f => ({ ...f, customer_id: o.source.customer_id, price_basis: o.source.price_basis, line_items: copyOriginalLines(o) }));
  };

  const parties = ctx?.parties ?? [];
  const taxRules = (ctx?.tax_rules ?? []).filter(r => (!r.effective_from || r.effective_from <= form.issue_date) && (!r.effective_to || r.effective_to >= form.issue_date));
  const allAccounts = ctx?.accounts ?? [];
  const accounts = postingAccounts(allAccounts, kind);
  const role = tradeRole(kind);
  const vatRegistered = ctx?.company?.vat_registered === true;
  const defaultTradeId = role ? mappedId(ctx?.mappings, role) : '';
  const postingIssue = issueFor(error, '/posting_account_id');
  const planned = plannedAccounts(kind, { mappings: ctx?.mappings, posting_account_id: extra.posting_account_id, purchase_vat_eligible: extra.purchase_vat_eligible, vatRegistered });
  const savedPosting = doc && !dirty && doc.posting_accounts && typeof doc.posting_accounts === 'object' ? plannedAccounts(kind, { mappings: doc.posting_accounts, posting_account_id: doc.posting_account_id, purchase_vat_eligible: doc.purchase_vat_eligible, vatRegistered, vatMinor: doc.totals?.vat_minor }).filter(r => r.id) : null;
  const isPurchase = meta.party === 'supplier';
  const creditInvalid = meta.credit && (!extra.original_id || extra.original_line_refs.length !== form.line_items.length || form.line_items.some((_, i) => overQty(i)) || !extra.reason.trim() || !extra.effective_adjustment_date || form.issue_date !== extra.effective_adjustment_date);
  const showTotals = doc && !dirty;
  const configErrors = ctx?.configuration_errors ?? [];

  const save = async (e) => {
    e?.preventDefault();
    if (busy || posted || creditInvalid) return;
    const fields = new FormData(e.currentTarget);
    const submitted = submittedDates(form, Object.fromEntries(
      ['issue_date', 'due_date', 'payment_terms'].map(k => [k, fields.get(k) ?? form[k]]),
    ), manualDue.current, meta.credit);
    setBusy(true); setError(null);
    try {
      const body = buildEnvelope(kind, submitted, extra);
      const saved = editId ? await accounting.update(activeCompany.id, editId, body, doc.revision) : await accounting.create(activeCompany.id, body);
      setForm({ ...blankForm(), ...saved.source, payment_terms: String(saved.source.payment_terms) });
      manualDue.current = true;
      setDoc(saved); setDirty(false);
      toast({ title: 'Draft saved', description: 'Totals recalculated. Not yet posted to the accounts.' });
      if (!editId) navigate(docPath(kind, saved.id), { replace: true });
    } catch (err) { setError(err); } finally { setBusy(false); }
  };
  const post = async () => {
    if (busy || !doc || dirty || posted || !review || configErrors.length > 0) return;
    if (review.companyId !== activeCompany.id || review.id !== doc.id || review.revision !== doc.revision) {
      setReview(null);
      setError({ message: 'The draft changed. Review its current saved totals before posting.' });
      return;
    }
    setBusy(true); setError(null);
    try {
      const r = await accounting.post(review.companyId, review.id, review.revision);
      setDoc({ ...doc, status: 'posted', journal_id: r.journal_id });
      setReview(null);
      toast({ title: r.status === 'duplicate' ? 'Already posted' : 'Posted to accounts', description: 'Journal recorded.' });
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={save} className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">{meta.section} · {meta.label}</p>
          <h1 className="mt-1 flex items-center gap-3 text-3xl font-semibold tracking-tight">
            {editId ? (form.invoice_number || meta.label) : `New ${meta.label.toLowerCase()}`}
            {doc && <StatusPill status={doc.status} />}
          </h1>
          {doc?.party_name && <p className="mt-1 text-sm text-muted-foreground">{doc.party_name}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {posted && <JournalLink id={doc.journal_id} />}
          {posted && !meta.credit && <Button asChild variant="outline"><Link to={`/payments?party_type=${meta.party}&party_id=${doc.party_id}&document=${doc.id}`}>Record payment</Link></Button>}
          <Button type="button" variant="outline" onClick={() => navigate(meta.path)} data-testid="button-back">Back to {meta.plural.toLowerCase()}</Button>
        </div>
      </header>

      {posted && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">Posted to the accounts. This document is read-only; corrections are made with a credit note.</p>}
      {posted && !meta.credit && <section className="rounded-xl border bg-card p-4" aria-label="Settlement balance">
        <h2 className="font-semibold">Settlement as at {settlement.to}</h2>
        <ErrorBox error={settlement.error} onRetry={settlement.refresh} />
        {settlement.loading ? <SkeletonRows rows={1} /> : openItem ? <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <span>{openItem.settlement === 'settled' ? 'Settled' : openItem.settlement === 'part_paid' ? 'Part paid' : 'Outstanding'}</span>
          <span>Payments allocated: <Money value={openItem.paid_minor} /></span>
          <span>Credits: <Money value={openItem.credited_minor} /></span>
          <strong>Amount remaining: <Money value={openItem.open_minor} /></strong>
        </div> : !settlement.error && <p className="mt-2 text-sm text-muted-foreground">This document is outside the current reporting date.</p>}
      </section>}
      <ConfigErrors errors={configErrors} />
      <ErrorBox error={error} />
      {loading && <SkeletonRows rows={6} />}

      {!loading && ctx && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <fieldset disabled={posted || busy} className="min-w-0 space-y-6">
            {meta.credit && (
              <section className="space-y-4 rounded-xl border bg-card p-5">
                <div><h2 className="text-lg font-semibold">Adjustment</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Offsets the outstanding balance on the original. No cash movement is recorded.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Label htmlFor="original">Original {meta.original === 'sales_invoice' ? 'invoice' : 'bill'} (posted)</Label>
                    <select id="original" data-testid="select-original" required className={sel} value={extra.original_id} onChange={e => pickOriginal(e.target.value)}>
                      <option value="">Select original</option>
                      {originals.map(o => <option key={o.id} value={o.id}>{o.source?.invoice_number} · {o.party_name} · {o.source?.issue_date}</option>)}
                      {extra.original_id && !originals.some(o => o.id === extra.original_id) && <option value={extra.original_id}>Linked original</option>}
                    </select>
                    {originals.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Only posted originals can be credited.</p>}
                  </div>
                  <div className="sm:col-span-2"><Label htmlFor="reason">Reason (required)</Label>
                    <Textarea id="reason" data-testid="input-reason" required maxLength={500} className="mt-1.5" value={extra.reason} onChange={e => changeExtra('reason', e.target.value)} /></div>
                  <div><Label>Adjustment method</Label>
                    <p className="mt-1.5 rounded-md border bg-muted/40 p-2.5 text-sm" data-testid="text-adjustment-method">Offset outstanding balance · no cash movement</p></div>
                  <div><Label htmlFor="effective">Effective adjustment date</Label>
                    <Input id="effective" data-testid="input-effective-date" type="date" required className="mt-1.5" value={extra.effective_adjustment_date} onChange={e => changeExtra('effective_adjustment_date', e.target.value)} />
                    <p className="mt-1 text-xs text-muted-foreground">Sets the credit note date to the same day.</p></div>
                </div>
              </section>
            )}

            <section className="space-y-4 rounded-xl border bg-card p-5">
              <h2 className="text-lg font-semibold">Details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><Label htmlFor="party" className="capitalize">{meta.party}</Label>
                  <select id="party" data-testid="select-party" required className={sel} value={form.customer_id} disabled={meta.credit && !!originalDoc} onChange={e => change('customer_id', e.target.value)}>
                    <option value="">Select {meta.party}</option>
                    {parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    {form.customer_id && !parties.some(p => p.id === form.customer_id) && <option value={form.customer_id}>{doc?.party_name || 'Current party'}</option>}
                  </select></div>
                <div><Label htmlFor="number">{meta.number}</Label><Input id="number" data-testid="input-number" required maxLength={64} className="mt-1.5" value={form.invoice_number} onChange={e => change('invoice_number', e.target.value)} /></div>
                <div><Label htmlFor="reference">Reference</Label><Input id="reference" maxLength={200} className="mt-1.5" value={form.reference} onChange={e => change('reference', e.target.value)} /></div>
                <div><Label htmlFor="issue">Date</Label><Input id="issue" name="issue_date" data-testid="input-issue-date" type="date" required className="mt-1.5" value={form.issue_date} readOnly={meta.credit} onInput={e => change('issue_date', e.target.value)} onChange={e => change('issue_date', e.target.value)} /></div>
                <div><Label htmlFor="due">Due date</Label><Input id="due" name="due_date" type="date" required className="mt-1.5" value={form.due_date} onInput={e => change('due_date', e.target.value)} onChange={e => change('due_date', e.target.value)} /></div>
                <div><Label htmlFor="terms">Payment terms (days)</Label><Input id="terms" name="payment_terms" inputMode="numeric" className="mt-1.5" value={form.payment_terms} onInput={e => change('payment_terms', e.target.value)} onChange={e => change('payment_terms', e.target.value)} /></div>
                <div><Label htmlFor="basis">Prices are</Label>
                  <select id="basis" data-testid="select-price-basis" className={sel} value={form.price_basis} onChange={e => change('price_basis', e.target.value)}>
                    <option value="excluding_vat">Excluding VAT</option><option value="including_vat">Including VAT</option>
                  </select></div>
                {role && <div className="sm:col-span-2"><Label htmlFor="posting">{isPurchase ? 'Purchase account' : 'Sales account'}</Label>
                  <select id="posting" data-testid="select-posting-account" className={`${sel} ${postingIssue ? 'border-red-500' : ''}`} value={extra.posting_account_id}
                    aria-invalid={postingIssue ? 'true' : undefined} aria-describedby={`posting-help${postingIssue ? ' posting-issue' : ''}`}
                    onChange={e => changeExtra('posting_account_id', e.target.value)}>
                    <option value="">Company default: {accountLabel(allAccounts, defaultTradeId)}</option>
                    {extra.posting_account_id && !accounts.some(a => a.id === extra.posting_account_id) && <option value={extra.posting_account_id}>{accountLabel(allAccounts, extra.posting_account_id)} (not eligible)</option>}
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                  </select>
                  <p id="posting-help" className="mt-1 text-xs text-muted-foreground">The company default comes from <Link to="/accounting/setup" className="underline">Posting setup</Link> and is used unless you choose a different {isPurchase ? 'purchase' : 'sales'} account for this document only.</p>
                  {postingIssue && <p id="posting-issue" role="alert" className="mt-1 text-xs text-red-700" data-testid="error-posting-account">{postingIssue.message}</p>}
                </div>}
              </div>
              {isPurchase && (
                <label className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50/60 p-4 text-sm">
                  <input type="checkbox" data-testid="checkbox-vat-eligible" className="mt-0.5 h-4 w-4" checked={extra.purchase_vat_eligible} onChange={e => changeExtra('purchase_vat_eligible', e.target.checked)} />
                  <span><span className="font-medium">I declare this is a fully recoverable, eligible business purchase.</span>
                    <span className="block text-muted-foreground">Leave unticked and no input VAT is recovered; the VAT stays in the cost.</span></span>
                </label>
              )}
            </section>

            <section className="space-y-4 rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Lines</h2>
                {meta.credit && <span className="text-xs text-muted-foreground">Copied from the original in order. Exclude lines or reduce quantities for a partial credit; price and tax code stay as on the original.</span>}</div>
              {form.line_items.map((l, i) => (
                <div key={i} className="grid gap-3 rounded-lg border bg-background p-4 sm:grid-cols-12" data-testid={`row-line-${i}`}>
                  <div className="sm:col-span-12"><Label htmlFor={`d${i}`}>Description</Label><Input id={`d${i}`} required className="mt-1" value={l.description} readOnly={meta.credit} onChange={e => changeLine(i, 'description', e.target.value)} /></div>
                  <div className="sm:col-span-3"><Label htmlFor={`q${i}`}>Quantity</Label><Input id={`q${i}`} data-testid={`input-qty-${i}`} required inputMode="decimal" className="mt-1" value={l.quantity} onChange={e => changeLine(i, 'quantity', e.target.value)} />
                    {meta.credit && origLine(i) && <p className={`mt-1 text-xs ${overQty(i) ? 'text-red-700' : 'text-muted-foreground'}`}>Original line {extra.original_line_refs[i] + 1}: max {origLine(i).quantity} at {origLine(i).unit_price} ({origLine(i).tax_code})</p>}</div>
                  <div className="sm:col-span-4"><Label htmlFor={`p${i}`}>Unit price ({form.price_basis === 'including_vat' ? 'inc' : 'exc'} VAT)</Label><Input id={`p${i}`} required inputMode="decimal" className="mt-1" value={l.unit_price} readOnly={meta.credit} onChange={e => changeLine(i, 'unit_price', e.target.value)} /></div>
                  <div className="sm:col-span-5"><Label htmlFor={`t${i}`}>Tax code</Label>
                    <select id={`t${i}`} required className="mt-1 w-full rounded-md border bg-background p-2.5 text-sm" value={l.tax_code} disabled={meta.credit} onChange={e => changeLine(i, 'tax_code', e.target.value)}>
                      <option value="">Select</option>
                      {l.tax_code && !taxRules.some(r => r.code === l.tax_code) && <option value={l.tax_code}>{l.tax_code}</option>}
                      {taxRules.map(r => <option key={r.id ?? r.code} value={r.code}>{r.code} · {r.label} · {Number(r.rate).toFixed(2)}%</option>)}
                    </select></div>
                  {showTotals && doc.money?.lines?.[i] && <p className="sm:col-span-12 text-right text-xs text-muted-foreground">Net <Money value={doc.money.lines[i].net_pence} /> · VAT <Money value={doc.money.lines[i].vat_pence} /> · Gross <Money value={doc.money.lines[i].gross_pence} /></p>}
                  {form.line_items.length > 1 && <button type="button" data-testid={`button-remove-line-${i}`} className="sm:col-span-12 justify-self-end text-xs text-destructive" onClick={() => meta.credit ? removeCreditLine(i) : change('line_items', form.line_items.filter((_, j) => j !== i))}>{meta.credit ? 'Exclude from credit' : 'Remove line'}</button>}
                </div>
              ))}
              {!meta.credit && <Button type="button" variant="outline" onClick={() => change('line_items', [...form.line_items, blankLine()])} data-testid="button-add-line">Add line</Button>}
              <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" maxLength={4000} className="mt-1.5" value={form.notes} onChange={e => change('notes', e.target.value)} /></div>
            </section>
          </fieldset>

          <aside className="space-y-4 xl:sticky xl:top-4">
            <div className="rounded-xl border bg-card p-5" data-testid="panel-accounts">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{posted ? 'Posted journal lines' : 'Accounts used'}</h2>
              {posted ? (
                journal.status === 'loading' ? <SkeletonRows rows={3} />
                : journal.status === 'error' ? <ErrorBox error={journal.error} />
                : journal.data ? <table className="mt-3 w-full text-xs">
                    <thead className="text-left text-muted-foreground"><tr><th className="py-1">Account</th><th className="py-1 text-right">Debit</th><th className="py-1 text-right">Credit</th></tr></thead>
                    <tbody>{journal.data.lines.map((l, i) => <tr key={i} className="border-t" data-testid={`row-posted-line-${i}`}>
                      <td className="py-1.5"><span className="font-mono">{l.account_code}</span> {l.account_name}</td>
                      <td className="py-1.5 text-right">{l.debit_minor !== '0' && <Money value={l.debit_minor} />}</td>
                      <td className="py-1.5 text-right">{l.credit_minor !== '0' && <Money value={l.credit_minor} />}</td></tr>)}</tbody>
                  </table> : <p className="mt-3 text-sm text-muted-foreground">No journal linked.</p>
              ) : savedPosting && savedPosting.length > 0 ? (
                <dl className="mt-3 space-y-1.5 text-sm" data-testid="list-saved-accounts">
                  {savedPosting.map(r => <div key={r.key} className="flex justify-between gap-3"><dt className="text-muted-foreground">{r.label}</dt><dd className="text-right">{accountLabel(allAccounts, r.id)}</dd></div>)}
                  <p className="pt-1 text-xs text-muted-foreground">Planned from the saved draft.</p>
                </dl>
              ) : (
                <dl className="mt-3 space-y-1.5 text-sm" data-testid="list-planned-accounts">
                  {planned.map(r => <div key={r.key} className="flex justify-between gap-3"><dt className="text-muted-foreground">{r.label}</dt><dd className="text-right">{accountLabel(allAccounts, r.id)}</dd></div>)}
                  <p className="pt-1 text-xs text-amber-800">Unsaved preview from your selections and current posting setup.</p>
                </dl>
              )}
              {isPurchase && !posted && vatRegistered && !extra.purchase_vat_eligible && <p className="mt-2 text-xs text-muted-foreground">Not declared recoverable: VAT is included in the purchase cost and no input VAT line is posted.</p>}
              {meta.credit && !posted && <p className="mt-2 text-xs text-muted-foreground">Uses the same accounts as the original. Offsets the outstanding balance; no cash movement.</p>}
            </div>
            <div className="rounded-xl border bg-card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Totals</h2>
              {showTotals ? (
                <dl className="mt-4 space-y-2 text-sm" data-testid="totals">
                  <div className="flex justify-between"><dt>Net</dt><dd><Money value={doc.money.net_pence} /></dd></div>
                  <div className="flex justify-between"><dt>VAT</dt><dd><Money value={doc.money.vat_pence} /></dd></div>
                  <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Gross</dt><dd><Money value={doc.money.gross_pence} /></dd></div>
                </dl>
              ) : <p className="mt-4 text-sm text-muted-foreground" data-testid="text-totals-stale">{doc ? 'Changes not saved — save the draft to recalculate totals.' : 'Save the draft to calculate totals on the server.'}</p>}
              {meta.credit && <p className="mt-4 rounded-md bg-muted/50 p-2.5 text-xs">Offset against outstanding balance. No cash movement.</p>}
            </div>
            {!posted && (
              <div className="space-y-2">
                {creditInvalid && <p className="text-xs text-orange-800">Original, reason and effective date are required; the credit date must match the effective date and quantities cannot exceed the original.</p>}
                <Button type="submit" className="w-full" disabled={busy || creditInvalid} data-testid="button-save">{busy ? 'Working…' : 'Save draft'}</Button>
                <Button type="button" variant="secondary" className="w-full" disabled={busy || !doc || dirty || configErrors.length > 0}
                  onClick={() => { setError(null); setReview({ companyId: activeCompany.id, id: doc.id, revision: doc.revision, number: form.invoice_number, money: doc.money }); }}
                  data-testid="button-post">Post to accounts</Button>
                {doc && dirty && <p className="text-xs text-muted-foreground">Save changes before posting.</p>}
              </div>
            )}
          </aside>
        </div>
      )}
      <AlertDialog open={review !== null} onOpenChange={open => { if (!open && !busy) setReview(null); }}>
        <AlertDialogContent data-testid="dialog-review-posting" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Review posting · {review?.number}</AlertDialogTitle>
            <AlertDialogDescription>
              Posting creates a balanced, source-linked journal and makes this document read-only.
              You cannot edit or delete its posted amounts here. Posting does not send the document or move cash.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {review && <dl aria-label="Saved amounts to post" className="space-y-2 rounded-lg border p-4 text-sm">
            <div className="flex justify-between"><dt>Document number</dt><dd className="font-medium">{review.number}</dd></div>
            <div className="flex justify-between"><dt>Net</dt><dd><Money value={review.money.net_pence} /></dd></div>
            <div className="flex justify-between"><dt>VAT</dt><dd><Money value={review.money.vat_pence} /></dd></div>
            <div className="flex justify-between border-t pt-2 font-semibold"><dt>Gross</dt><dd><Money value={review.money.gross_pence} /></dd></div>
          </dl>}
          {meta.credit && <p className="text-sm text-muted-foreground">This credit offsets the linked outstanding document. No cash movement is recorded.</p>}
          {error && <ErrorBox error={error} />}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={busy} data-testid="button-cancel-posting">Cancel</AlertDialogCancel>
            <Button type="button" onClick={post} disabled={busy || dirty || posted || configErrors.length > 0} data-testid="button-confirm-posting">
              {busy ? 'Posting…' : 'Confirm posting'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
