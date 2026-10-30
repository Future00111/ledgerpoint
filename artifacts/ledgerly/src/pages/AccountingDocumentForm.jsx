import PostedDocument from '@/components/accounting/PostedDocument';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { StatusPill, SettlementPill, Money, ConfigErrors, JournalLink, ErrorBox, SkeletonRows, today } from '@/components/accounting/AccountingUI';
import { DiscountEditor, SavedDiscountSummary, DiscountBalanceReview, DraftWriteActions } from '@/features/documentDiscounts/DiscountControls';
import DocumentLineFields from '@/features/documentDiscounts/DocumentLineFields';
import { canEditDrafts, canPostDocuments, discountAdjustment, isCurrentDocumentRequest } from '@/features/documentDiscounts/model.mjs';
import { useCaptureDraft } from '@/features/documentIntake/useDocumentIntake';
import { CaptureSourceReview, CaptureDraftActions } from '@/features/documentIntake/CaptureReview';
import SourceAttachments from '@/features/documentIntake/SourceFiles';
import { displayedDocumentMoney } from '@/features/documentIntake/model.mjs';
import { captureReturnPath, savedCapturePath } from '@/features/documentIntake/presentation.mjs';
import DocumentProgress from '@/features/documentIntake/DocumentProgress';
import PageHeader from '@/components/workspace/PageHeader';

const blankLine = () => ({ description: '', quantity: '1', unit_price: '0', tax_code: '' });
const blankForm = () => ({ customer_id: '', invoice_number: '', issue_date: today(), due_date: dueFromTerms(today(), '30'), payment_terms: '30', reference: '', notes: '', price_basis: 'excluding_vat', line_items: [blankLine()] });
const blankExtra = () => ({ original_line_refs: [], original_id: '', reason: '', effective_adjustment_date: '', purchase_vat_eligible: false, posting_account_id: '' });
const sel = 'mt-1.5 w-full rounded-md border bg-background p-2.5 text-sm';

/** Shared native create/review/post page for all four accounting document kinds. */
export default function AccountingDocumentForm({ kind, legacyFallback = null }) {
  const meta = KINDS[kind];
  const { id } = useParams();
  const [params] = useSearchParams();
  const requestedOriginal = params.get('original');
  const requestedDiscount = meta.credit && params.get('discount') === '1';
  const requestedCapture = params.get('capture');
  const editId = id && id !== 'new' ? id : undefined;
  const captureMode = Boolean(requestedCapture && !editId);
  const sourceReturn = captureReturnPath(requestedCapture);
  const { activeCompany } = useCompany();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ctx, setCtx] = useState(null);
  const [loadedScope, setLoadedScope] = useState(null);
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
  const scopeKey = JSON.stringify([activeCompany?.id, editId, kind, requestedOriginal, requestedDiscount, requestedCapture]);
  const latestScope = useRef(scopeKey);
  latestScope.current = scopeKey;
  const currentContext = loadedScope === scopeKey;
  const capabilities = currentContext ? ctx?.capabilities : null;
  const capture = useCaptureDraft({ companyId: activeCompany?.id, sourceId: captureMode ? requestedCapture : null, kind, scope: scopeKey, envelope: buildEnvelope(kind, form, extra) });
  const canEdit = canEditDrafts(capabilities) && (!captureMode || capture.canManage);
  const canPost = canPostDocuments(capabilities);
  const discountMode = meta.credit && Boolean(form.discount_adjustment || (!editId && requestedDiscount));
  const manualDue = useRef(false);
  const [journal, setJournal] = useState({ status: 'idle', data: null, error: null });
  const settlement = useLedgerSnapshot(activeCompany?.id, undefined, undefined, doc?.status === 'posted' && !meta.credit);
  const openItem = settlement.data?.open_items.find(d => d.id === doc?.id);
  const originalSettlement = useLedgerSnapshot(activeCompany?.id, undefined, undefined, discountMode && !!extra.original_id);
  const originalOpenItem = !originalSettlement.error && originalSettlement.data?.open_items.find(d => d.id === extra.original_id);

  // Posted documents show the canonical journal lines, never the current mapping.
  useEffect(() => {
    if (!activeCompany || doc?.status !== 'posted' || !doc.journal_id) { setJournal({ status: 'idle', data: null, error: null }); return; }
    const c = new AbortController();
    setJournal({ status: 'loading', data: null, error: null });
    accounting.journal(activeCompany.id, doc.journal_id, c.signal)
      .then(data => { if (!c.signal.aborted && latestScope.current === scopeKey) setJournal({ status: 'ready', data, error: null }); })
      .catch(e => { if (!c.signal.aborted) setJournal({ status: 'error', data: null, error: e }); });
    return () => c.abort();
  }, [activeCompany?.id, doc?.status, doc?.journal_id]);

  useEffect(() => {
    const g = ++gen.current; const c = new AbortController();
    manualDue.current = Boolean(editId);
    setReview(null);
    setCtx(null); setLoadedScope(null); setDoc(null); setForm(blankForm()); setExtra(blankExtra()); setDirty(false); setBusy(false); setError(null); setLegacy(false); setLoading(true); setOriginalDoc(null);
    if (!activeCompany) return () => c.abort();
    (async () => {
      try {
        const [context, existing, origList] = await Promise.all([
          accounting.context(activeCompany.id, kind, c.signal),
          editId ? accounting.get(activeCompany.id, editId, c.signal).catch(e => { if (e.code === 'LEGACY_DRAFT') return 'LEGACY'; throw e; }) : null,
          meta.credit ? accounting.list(activeCompany.id, meta.original, c.signal) : [],
        ]);
        if (g !== gen.current || latestScope.current !== scopeKey || c.signal.aborted) return;
        setCtx(context);
        setLoadedScope(scopeKey);
        if (existing === 'LEGACY') { setLegacy(true); return; }
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
        } else if (meta.credit && requestedOriginal) {
          const original = origList.find(o => o.id === requestedOriginal && o.status === 'posted');
          if (!original) throw new Error('The original document is unavailable in this company.');
          setOriginalDoc(original);
          setForm(f => ({ ...f, customer_id: original.source.customer_id, price_basis: original.source.price_basis, discount: null, line_items: copyOriginalLines(original),
            ...(requestedDiscount ? { discount_adjustment: discountAdjustment(original) } : {}) }));
          setExtra(x => ({ ...x, original_id: original.id, original_line_refs: original.source.line_items.map((_, i) => i), effective_adjustment_date: today() }));
          setDirty(true);
        }
      } catch (e) { if (g === gen.current && !c.signal.aborted) setError(e); }
      finally { if (g === gen.current && !c.signal.aborted) setLoading(false); }
    })();
    return () => { c.abort(); gen.current++; };
  }, [activeCompany?.id, editId, kind, requestedOriginal, requestedDiscount, requestedCapture]);

  if (legacy && currentContext) return canEdit && legacyFallback ? legacyFallback : <div className="workspace-page"><h1>Earlier draft</h1><p className="text-sm text-muted-foreground">This earlier draft cannot be edited in your current view. Your accounting access remains unchanged.</p><Link className="text-primary underline" to={meta.path}>Back to {meta.plural.toLowerCase()}</Link></div>;
  if (!activeCompany) return <p className="mx-auto max-w-xl rounded-xl border p-6 text-center">Select a company in <Link className="underline" to="/companies">Companies</Link> first.</p>;
  if (!currentContext) return <div className="workspace-page"><Link className="text-primary underline" to={meta.path}>Back to {meta.plural.toLowerCase()}</Link><ErrorBox error={error} />{loading && <SkeletonRows rows={6} />}</div>;

  const posted = doc?.status === 'posted';
  const touch = () => { setDirty(true); if (captureMode) capture.invalidateReview(); };
  const change = (k, v) => {
    if (k === 'due_date') manualDue.current = true;
    touch(); setForm(f => changeDateField(f, k, v, manualDue.current, meta.credit));
  };
  const changeLine = (i, k, v) => { touch(); setForm(f => ({ ...f, line_items: f.line_items.map((l, j) => j === i ? { ...l, [k]: v } : l) })); };
  const removeCreditLine = (i) => {
    if (discountMode || form.line_items.length <= 1) return;
    touch();
    setForm(f => ({ ...f, line_items: f.line_items.filter((_, j) => j !== i) }));
    setExtra(x => ({ ...x, original_line_refs: x.original_line_refs.filter((_, j) => j !== i) }));
  };
  const origLine = (i) => originalDoc?.source?.line_items?.[extra.original_line_refs[i]];
  const overQty = (i) => { const o = origLine(i); return o && Number(form.line_items[i].quantity) > Number(o.quantity); };
  const overPrice = (i) => { const o = origLine(i); return o && Number(form.line_items[i].unit_price) > Number(o.unit_price); };
  const changeExtra = (k, v) => {
    touch();
    setExtra(x => ({ ...x, [k]: v }));
    if (k === 'effective_adjustment_date') setForm(f => ({ ...f, issue_date: v, due_date: f.due_date < v ? v : f.due_date }));
  };
  const pickOriginal = (oid) => {
    const o = originals.find(d => d.id === oid) || null;
    setOriginalDoc(o); touch();
    setExtra(x => ({ ...x, original_id: oid, original_line_refs: o ? o.source.line_items.map((_, i) => i) : [] }));
    if (o) setForm(f => ({ ...f, customer_id: o.source.customer_id, price_basis: o.source.price_basis, discount: null, line_items: copyOriginalLines(o),
      ...(discountMode ? { discount_adjustment: discountAdjustment(o, f.discount_adjustment) } : {}) }));
  };

  const parties = ctx?.parties ?? [];
  const taxRules = (ctx?.tax_rules ?? []).filter(r => (!r.effective_from || r.effective_from <= form.issue_date) && (!r.effective_to || r.effective_to >= form.issue_date)).sort((a, b) => Number(b.rate) - Number(a.rate) || a.label.localeCompare(b.label));
  const allAccounts = ctx?.accounts ?? [];
  const accounts = postingAccounts(allAccounts, kind);
  const role = tradeRole(kind);
  const vatRegistered = ctx?.company?.vat_registered === true;
  const defaultTradeId = role ? mappedId(ctx?.mappings, role) : '';
  const postingIssue = issueFor(error, '/posting_account_id');
  const planned = plannedAccounts(kind, { mappings: meta.credit && originalDoc ? originalDoc.posting_accounts : ctx?.mappings, posting_account_id: meta.credit && originalDoc ? originalDoc.posting_account_id : extra.posting_account_id, purchase_vat_eligible: meta.credit && originalDoc ? originalDoc.purchase_vat_eligible : extra.purchase_vat_eligible, vatRegistered });
  const savedPosting = doc && !dirty && doc.posting_accounts && typeof doc.posting_accounts === 'object' ? plannedAccounts(kind, { mappings: doc.posting_accounts, posting_account_id: doc.posting_account_id, purchase_vat_eligible: doc.purchase_vat_eligible, vatRegistered, vatMinor: doc.totals?.vat_minor }).filter(r => r.id) : null;
  const isPurchase = meta.party === 'supplier';
  const creditInvalid = meta.credit && (!extra.original_id || extra.original_line_refs.length !== form.line_items.length || form.line_items.some((_, i) => overQty(i) || overPrice(i)) || !extra.reason.trim() || !extra.effective_adjustment_date || form.issue_date !== extra.effective_adjustment_date);
  const displayedMoney = displayedDocumentMoney(captureMode, capture.currentReview, doc, dirty);
  const showTotals = Boolean(displayedMoney);
  const configErrors = ctx?.configuration_errors ?? [];

  const save = async (e) => {
    e?.preventDefault();
    if (!canEdit || busy || capture.busy || posted || creditInvalid) return;
    const started = { scope: scopeKey, generation: gen.current };
    const stillCurrent = () => isCurrentDocumentRequest(started, { scope: latestScope.current, generation: gen.current });
    const fields = new FormData(e.currentTarget);
    const submitted = submittedDates(form, Object.fromEntries(
      ['issue_date', 'due_date', 'payment_terms'].map(k => [k, fields.get(k) ?? form[k]]),
    ), manualDue.current, meta.credit);
    setBusy(true); setError(null);
    try {
      const body = buildEnvelope(kind, submitted, extra);
      if (captureMode) {
        setForm(submitted);
        const creating = e.nativeEvent?.submitter?.value === 'save';
        const result = creating ? await capture.saveDraft(body) : await capture.reviewEnvelope(body);
        if (!stillCurrent() || !result) return;
        if (creating) {
          if (!result.document?.id) throw new Error('The linked draft response could not be verified. Refresh the source before retrying.');
          toast({ title: result.duplicate ? 'Existing linked draft opened' : 'Source linked to draft', description: 'Review and post the saved draft separately.' });
          navigate(savedCapturePath(result.document.kind || kind, result.document.id, requestedCapture), { replace: true });
        }
        return;
      }
      const saved = editId ? await accounting.update(activeCompany.id, editId, body, doc.revision) : await accounting.create(activeCompany.id, body);
      if (!stillCurrent()) return;
      setForm({ ...blankForm(), ...saved.source, payment_terms: String(saved.source.payment_terms) });
      manualDue.current = true;
      setDoc(saved); setDirty(false);
      toast({ title: editId ? 'Changes saved' : 'Draft saved', description: 'Totals recalculated. Not yet posted to the accounts.' });
      if (!editId) navigate(docPath(kind, saved.id), { replace: true });
    } catch (err) { if (stillCurrent()) setError(err); } finally { if (stillCurrent()) setBusy(false); }
  };
  const post = async () => {
    if (!canPost || busy || !doc || dirty || doc.money?.gross_pence === '0' || posted || !review || configErrors.length > 0) return;
    const started = { scope: scopeKey, generation: gen.current };
    const stillCurrent = () => isCurrentDocumentRequest(started, { scope: latestScope.current, generation: gen.current });
    if (review.companyId !== activeCompany.id || review.id !== doc.id || review.revision !== doc.revision) {
      setReview(null);
      setError({ message: 'The draft changed. Review its current saved totals before posting.' });
      return;
    }
    setBusy(true); setError(null);
    try {
      const r = await accounting.post(review.companyId, review.id, review.revision);
      if (!stillCurrent()) return;
      setDoc({ ...doc, status: 'posted', journal_id: r.journal_id });
      setReview(null);
      toast({ title: r.status === 'duplicate' ? 'Already posted' : 'Posted to accounts', description: 'Journal recorded.' });
    } catch (err) { if (stillCurrent()) setError(err); } finally { if (stillCurrent()) setBusy(false); }
  };

  if (posted && !loading && currentContext) return <PostedDocument doc={doc} kind={kind} company={activeCompany} journal={journal} settlement={settlement} openItem={openItem} error={error} capabilities={capabilities} sourceReturn={sourceReturn} />;

  return (
    <form onSubmit={save} className="workspace-page">
      <PageHeader eyebrow={`${meta.section} · ${meta.label}`}
        title={editId ? `${canEdit ? 'Edit draft' : 'View draft'} · ${form.invoice_number || meta.label}` : `${captureMode ? 'Prepare' : 'New'} ${discountMode ? 'discount credit' : meta.label.toLowerCase()}`}
        description={doc?.party_name || (captureMode ? 'Enter the source details, check the calculated totals, then save a linked draft.' : 'Enter the details below. You can review the saved draft before posting.')}
        context={doc ? <StatusPill status={doc.status} /> : null}
        actions={<Button type="button" variant="outline" className="min-h-11" onClick={() => navigate(sourceReturn || meta.path)} data-testid="button-back">{sourceReturn ? 'Back to source files' : `Back to ${meta.plural.toLowerCase()}`}</Button>} />

      {posted && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">Posted to the accounts. {meta.credit ? <>This credit reduces the balance of the <Link className="underline font-medium" to={docPath(meta.original, doc.original_id)}>original {meta.original === 'sales_invoice' ? 'invoice' : 'bill'}</Link>; the original document is preserved.</> : 'The original amounts are preserved. Payments and credit notes are recorded separately below.'}</p>}
      {posted && !meta.credit && <section className="rounded-xl border bg-card p-4" aria-label="Settlement balance">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Balance as at {settlement.to}</h2><SettlementPill item={openItem} /></div>
        <ErrorBox error={settlement.error} onRetry={settlement.refresh} />
        {settlement.loading ? <SkeletonRows rows={1} /> : openItem ? <>
          <dl className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[['Original total', openItem.gross_minor], ['Payments', openItem.paid_minor], ['Credit notes', openItem.credited_minor], ['Still due', openItem.open_minor]].map(([label, amount]) => <div key={label} className={label === 'Still due' ? 'rounded-lg bg-primary/5 p-3' : 'p-3'}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold"><Money value={amount} /></dd></div>)}
          </dl>
          <h3 className="mt-5 border-t pt-4 text-sm font-semibold">Payments and credits</h3>
          {openItem.history?.length ? <ul className="mt-2 divide-y">{openItem.history.map((event, i) => <li key={`${event.id}-${i}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
            <div><Link className="font-medium text-primary hover:underline" to={docPath(KINDS[event.kind] ? event.kind : 'accounting_payment_event', event.payment_id ?? event.id)}>{event.number || 'Payment'}</Link><p className="text-xs text-muted-foreground">{event.date} · {KINDS[event.kind]?.label || ({payment: 'Payment', allocation: 'Credit balance allocated', unallocation: 'Payment allocation removed'}[event.kind] || event.kind)}</p></div>
            <div className="flex items-center gap-4"><Money value={event.amount_minor} /><JournalLink id={event.journal_id} /></div>
          </li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No payments or credit notes yet.</p>}
        </> : !settlement.error && <p className="mt-2 text-sm text-muted-foreground">This document is outside the current reporting date.</p>}
      </section>}
      {!posted && <DocumentProgress captureMode={captureMode} reviewed={Boolean(capture.currentReview)} saved={Boolean(doc && !dirty)} />}
      <ConfigErrors errors={configErrors} />
      <ErrorBox error={error} />
      {captureMode && <CaptureSourceReview capture={capture} companyId={activeCompany.id} />}
      {!captureMode && doc && <SourceAttachments companyId={activeCompany.id} documentId={doc.id} />}
      {!posted && (captureMode ? canEdit : canEdit || canPost) && <section id="document-actions" tabIndex={-1} className="workspace-card scroll-mt-24 space-y-3 p-4 sm:p-5" aria-label="Save and review document">
        {captureMode ? <CaptureDraftActions capture={capture} canEdit={canEdit} invalid={creditInvalid || busy} /> : <>
          <div className="flex flex-wrap items-center gap-3"><DraftWriteActions compact capabilities={capabilities} doc={doc} editId={editId} busy={busy} dirty={dirty} creditInvalid={creditInvalid} configurationErrors={configErrors}
            onReview={() => { setError(null); setReview({ companyId: activeCompany.id, id: doc.id, revision: doc.revision, number: form.invoice_number, money: doc.money }); }} /></div>
          <p className="text-sm text-muted-foreground">{doc && dirty ? 'Unsaved changes. Save to update the calculated totals before posting.' : doc ? 'Saved draft. Review and confirm posting when you are ready.' : 'Save a draft to calculate its totals. It will not affect your accounts until you post it.'}</p>
        </>}
      </section>}
      {!posted && !canEditDrafts(capabilities) && <p className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">You have view-only access to this draft. Editing requires permission from your company owner.</p>}
      {loading && <SkeletonRows rows={6} />}

      {!loading && ctx && (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <fieldset disabled={posted || busy || capture.busy || !canEdit} className="min-w-0 space-y-6">
            {meta.credit && (
              <section className="workspace-card space-y-5 p-6">
                <div><h2 className="text-lg font-semibold">{discountMode ? 'Discount credit' : 'Adjustment'}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Offsets the outstanding balance on the original. No cash movement is recorded.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2"><Label htmlFor="original">Original {meta.original === 'sales_invoice' ? 'invoice' : 'bill'} (posted)</Label>
                    <select id="original" data-testid="select-original" required disabled={discountMode && !!extra.original_id} className={sel} value={extra.original_id} onChange={e => pickOriginal(e.target.value)}>
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

            <section className="workspace-card space-y-5 p-6">
              <h2 className="text-base font-semibold">Document details</h2>
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
                  <select id="basis" data-testid="select-price-basis" disabled={meta.credit} className={sel} value={form.price_basis} onChange={e => change('price_basis', e.target.value)}>
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
                  <input type="checkbox" data-testid="checkbox-vat-eligible" className="mt-0.5 h-4 w-4" disabled={discountMode} checked={discountMode ? originalDoc?.purchase_vat_eligible === true : extra.purchase_vat_eligible} onChange={e => changeExtra('purchase_vat_eligible', e.target.checked)} />
                  <span><span className="font-medium">I declare this is a fully recoverable, eligible business purchase.</span>
                    <span className="block text-muted-foreground">Leave unticked and no input VAT is recovered; the VAT stays in the cost.</span></span>
                </label>
              )}
            </section>

            {(!meta.credit || discountMode) && <DiscountEditor value={discountMode ? form.discount_adjustment : form.discount} priceBasis={form.price_basis} adjustment={discountMode} disabled={!canEdit || busy}
              onChange={value => change(discountMode ? 'discount_adjustment' : 'discount', value)} />}

            <section className="workspace-card space-y-5 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">{discountMode ? 'Original items · reference only' : 'Items & services'}</h2>
                {meta.credit && <span className="text-xs text-muted-foreground">{discountMode ? 'The original quantities, prices and VAT rates are retained. The saved discount determines the credit amounts below.' : 'Copied from the original. Reduce the amount or quantity, or exclude a line, for a partial credit. The original VAT basis, rate and accounts are retained.'}</span>}</div>
              {meta.credit && !discountMode && (originalDoc?.source?.discount || doc?.tax_context?.original_discount) && <p className="rounded-lg bg-primary/5 p-3 text-sm">Credit amounts use the original discounted prices.</p>}
              {form.line_items.map((line, index) => <DocumentLineFields key={index} line={line} index={index} credit={meta.credit} discountMode={discountMode}
                originalDiscount={Boolean(originalDoc?.source?.discount || doc?.tax_context?.original_discount)}
                priceBasis={form.price_basis} taxRules={taxRules} originalLine={origLine(index)} originalLineRef={extra.original_line_refs[index]}
                money={displayedMoney?.lines?.[index]} canRemove={form.line_items.length > 1}
                onChange={(field, value) => changeLine(index, field, value)} onRemove={() => meta.credit ? removeCreditLine(index) : change('line_items', form.line_items.filter((_, j) => j !== index))} />)}
              {!meta.credit && <Button type="button" variant="outline" onClick={() => change('line_items', [...form.line_items, blankLine()])} data-testid="button-add-line">Add line</Button>}
              <div><Label htmlFor="notes">Notes</Label><Textarea id="notes" maxLength={4000} className="mt-1.5" value={form.notes} onChange={e => change('notes', e.target.value)} /></div>
            </section>
          </fieldset>

          <aside className="flex flex-col gap-4 xl:sticky xl:top-4">
            <details className="workspace-card order-3 p-5" data-testid="panel-accounts">
              <summary className="cursor-pointer text-sm font-semibold">Accounting details</summary>
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
                  <p className="pt-1 text-xs text-amber-800">{meta.credit && originalDoc ? 'Accounts retained from the original document.' : 'Unsaved preview from your selections and current posting setup.'}</p>
                </dl>
              )}
              {isPurchase && !posted && vatRegistered && !extra.purchase_vat_eligible && <p className="mt-2 text-xs text-muted-foreground">Not declared recoverable: VAT is included in the purchase cost and no input VAT line is posted.</p>}
              {meta.credit && !posted && <p className="mt-2 text-xs text-muted-foreground">Uses the same accounts as the original. Offsets the outstanding balance; no cash movement.</p>}
            </details>
            <div className="workspace-card order-1 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Totals</h2>
              {showTotals ? (
                <dl className="mt-4 space-y-2 text-sm" data-testid="totals">
                  <SavedDiscountSummary money={displayedMoney} />
                  <div className="flex justify-between"><dt>Net</dt><dd><Money value={displayedMoney.net_pence} /></dd></div>
                  <div className="flex justify-between"><dt>VAT</dt><dd><Money value={displayedMoney.vat_pence} /></dd></div>
                  <div className="flex justify-between border-t pt-2 text-base font-semibold"><dt>Total</dt><dd><Money value={displayedMoney.gross_pence} /></dd></div>
                </dl>
              ) : <p className="mt-4 text-sm text-muted-foreground" data-testid="text-totals-stale">{captureMode ? 'Review the current details to calculate the subtotal, VAT and total before saving.' : doc ? 'Changes not saved — save the draft to recalculate totals.' : 'Save your draft to calculate the subtotal, VAT and total.'}</p>}
              {meta.credit && <p className="mt-4 rounded-md bg-muted/50 p-2.5 text-xs">Offset against outstanding balance. No cash movement.</p>}
            </div>
            {discountMode && <DiscountBalanceReview original={originalDoc} item={originalOpenItem} money={doc?.money} dirty={dirty || !doc} loading={originalSettlement.loading} error={originalSettlement.error} onRetry={originalSettlement.refresh} />}
            {!posted && (
              <div className="order-2 space-y-2">
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Draft — not included in your P&amp;L, balance sheet, VAT workings or account balances until you review and post it.</p>
                {creditInvalid && <p className="text-xs text-orange-800">Original, reason and effective date are required; the credit date must match the effective date and quantities cannot exceed the original.</p>}
                {(captureMode ? canEdit : canEdit || canPost) && <a href="#document-actions" className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4">Back to save and review</a>}
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
            <div className="flex justify-between border-t pt-2 font-semibold"><dt>Total</dt><dd><Money value={review.money.gross_pence} /></dd></div>
          </dl>}
          {meta.credit && <p className="text-sm text-muted-foreground">This credit offsets the linked outstanding document. No cash movement is recorded.</p>}
          {error && <ErrorBox error={error} />}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={busy} data-testid="button-cancel-posting">Cancel</AlertDialogCancel>
            <Button type="button" onClick={post} disabled={!canPost || busy || dirty || doc?.money?.gross_pence === '0' || posted || configErrors.length > 0} data-testid="button-confirm-posting">
              {busy ? 'Posting…' : 'Confirm posting'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
