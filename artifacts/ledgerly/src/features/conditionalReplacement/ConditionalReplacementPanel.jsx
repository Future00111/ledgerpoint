import React, { useEffect, useRef, useState } from 'react';
import { accounting, penceToDisplay } from '../../api/accountingDocuments.mjs';
import { replacementInput, readPending, versionLabel } from './model.mjs';
import { recordReplacement, checkPendingReplacement, observeReplacementVersion } from './actions.mjs';

const field = 'mt-1.5 min-h-11 w-full rounded-lg border bg-background p-2.5 text-sm';
const storage = () => { try { return typeof window === 'undefined' ? null : window.sessionStorage; } catch { return null; } };
const newId = () => globalThis.crypto.randomUUID();
const blankForm = () => ({ agreement_id: newId(), agreement_date: '', payment_deadline: '', discount: '', evidence_text: '', attested: false });

export function TermsList({ terms }) {
  if (!terms) return <p className="text-sm text-muted-foreground">Terms unavailable.</p>;
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
    <div><dt className="text-xs text-muted-foreground">Discount if paid in time</dt><dd className="font-medium tabular-nums">{penceToDisplay(terms.discount_gross_pence)}</dd></div>
    <div><dt className="text-xs text-muted-foreground">Agreed on</dt><dd>{terms.agreement_date}</dd></div>
    <div><dt className="text-xs text-muted-foreground">Pay by</dt><dd>{terms.payment_deadline}</dd></div>
    <div><dt className="text-xs text-muted-foreground">Agreement reference</dt><dd className="break-all font-mono text-xs">{terms.agreement_id}</dd></div>
  </dl>;
}

/** Immutable, ordered version history. Nothing here can edit or delete a version. */
export function ReplacementHistory({ original, history, canObserve = false, observing = null, onObserve }) {
  const rows = history?.replacements ?? [];
  return <ol className="relative space-y-3 border-l pl-5" aria-label="Agreement versions">
    <li className="relative">
      <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-muted-foreground" aria-hidden="true" />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Original agreement · recorded at posting{rows.length ? ' · superseded' : ' · current'}</p>
      <div className="mt-2 rounded-lg border bg-muted/20 p-3"><TermsList terms={original} /></div>
    </li>
    {rows.map(row => <li key={row.id} className="relative" data-testid={`replacement-version-${row.position}`}>
      <span className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-background ${row.current ? 'bg-primary' : 'bg-muted-foreground'}`} aria-hidden="true" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Replacement {row.position} · {versionLabel(row)}</p>
        {canObserve && row.current && row.observation?.state === 'unobserved' && !history.consumed &&
          <button type="button" className="min-h-9 rounded-md border px-3 text-xs font-medium hover:bg-muted" disabled={observing === row.id} onClick={() => onObserve?.(row.id)}>
            {observing === row.id ? 'Recording observation' : 'Record observation of current balance'}
          </button>}
      </div>
      <div className={`mt-2 rounded-lg border p-3 ${row.current ? 'border-primary/40 bg-primary/5' : 'bg-muted/10'}`}>
        <TermsList terms={row.evidence?.terms} />
        {row.evidence?.evidence_text && <p className="mt-3 whitespace-pre-wrap border-t pt-3 text-sm">{row.evidence.evidence_text}</p>}
        <p className="mt-3 text-xs text-muted-foreground">Recorded {row.recorded_at} · request <span className="font-mono">{row.request_id}</span>
          {row.observation?.state === 'observed' && <> · observed {row.observation.observed_at}</>}
          {row.observation?.state === 'unavailable' && <> · observation could not be verified ({row.observation.code})</>}</p>
      </div>
    </li>)}
  </ol>;
}

export function ReplacementTermsReview({ body, partyName, onConfirm, onCancel, busy }) {
  return <section aria-label="Review replacement terms" className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
    <h3 className="font-semibold">Check before recording</h3>
    <p className="text-sm">These terms will be added as a new version for {partyName}. Earlier versions stay in the history unchanged and cannot be edited.</p>
    <TermsList terms={body.terms} />
    <p className="whitespace-pre-wrap rounded-md border bg-background p-3 text-sm">{body.evidence_text}</p>
    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
      <li>The discount is exactly the amount you entered. It is not scaled from earlier terms or from corrections.</li>
      <li>Payments already received do not become qualifying because of this version.</li>
      <li>Recording terms does not post, credit or redeem anything. Conditional credit posting remains unavailable.</li>
    </ul>
    <p className="text-xs text-muted-foreground">Request reference <span className="font-mono">{body.request_id}</span></p>
    <div className="flex flex-wrap gap-2">
      <button type="button" className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60" disabled={busy} onClick={onConfirm}>{busy ? 'Recording' : 'Record replacement terms'}</button>
      <button type="button" className="min-h-11 rounded-md border px-4 text-sm" disabled={busy} onClick={onCancel}>Edit terms</button>
    </div>
  </section>;
}

export function ReplacementRecovery({ pending, outcome, busy, canWrite = true, onCheck }) {
  if (!pending) return null;
  return <section role="status" aria-label="Unconfirmed replacement request" className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
    <p className="font-semibold">We did not receive a reply for your last request.</p>
    <p>It may or may not have been recorded. Do not enter the terms again. Check this request instead; checking reuses the same reference, so it can never be recorded twice.</p>
    <p>Request reference <span className="font-mono">{pending.body.request_id}</span></p>
    {outcome === 'absent' && (canWrite
      ? <p>The history does not contain this request yet. Checking again will submit the same reviewed terms under the same reference.</p>
      : <p>The history does not contain this request. You no longer have permission to resubmit it.</p>)}
    <div className="flex flex-wrap gap-2">
      <button type="button" className="min-h-10 rounded-md border border-amber-400 bg-background px-3" disabled={busy} onClick={onCheck}>{busy ? 'Checking' : outcome === 'absent' && canWrite ? 'Resubmit with the same reference' : 'Check this request'}</button>
    </div>
  </section>;
}

/** Posted invoice/bill panel. Viewers see the history only; writers append explicit terms. */
export default function ConditionalReplacementPanel({ companyId, doc, kind, canWrite, client = accounting }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [form, setForm] = useState(blankForm);
  const [composing, setComposing] = useState(false);
  const [review, setReview] = useState(null);
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [observing, setObserving] = useState(null);
  const [pending, setPending] = useState(() => readPending(storage(), companyId, doc.id));
  const [recovery, setRecovery] = useState(null);
  const [notice, setNotice] = useState(null);
  const gen = useRef(0);
  const scope = `${companyId}:${doc.id}`;
  const scopeRef = useRef(scope); scopeRef.current = scope;

  const load = () => {
    const g = ++gen.current; const c = new AbortController();
    setState(s => ({ status: 'loading', data: s.data && s.scope === scope ? s.data : null, error: null, scope }));
    client.replacementHistory(companyId, doc.id, c.signal)
      .then(data => { if (g === gen.current && scopeRef.current === scope) setState({ status: 'ready', data, error: null, scope }); })
      .catch(error => { if (g === gen.current && !c.signal.aborted && scopeRef.current === scope) setState({ status: 'error', data: null, error, scope }); });
    return c;
  };
  useEffect(() => {
    setForm(blankForm()); setComposing(false); setReview(null); setFormError(null); setBusy(false); setNotice(null); setRecovery(null);
    setPending(readPending(storage(), companyId, doc.id));
    const c = load();
    return () => { c.abort(); gen.current++; };
  }, [companyId, doc.id]);

  const history = state.scope === scope ? state.data : null;
  const original = doc.source?.conditional_discount ?? null;
  const writable = canWrite && history && !history.consumed && !pending;

  const prepare = (e) => {
    e.preventDefault(); setFormError(null);
    try { setReview(replacementInput({ kind, partyId: doc.party_id, history, form, requestId: newId() })); }
    catch (err) { setFormError(err.message); }
  };
  const settle = (row) => {
    setPending(null); setRecovery(null); setReview(null); setComposing(false); setForm(blankForm());
    setNotice('Replacement request confirmed. See the history below for its current status.');
    load();
  };
  const apply = (result, body) => {
    if (result.kind === 'stale') return;
    if (result.kind === 'recorded') settle(result.receipt);
    else if (result.kind === 'unknown') { setPending(result.pending ?? { company_id: companyId, document_id: doc.id, body }); setReview(null); setRecovery(null); }
    else if (result.kind === 'absent') setRecovery('absent');
    else if (result.kind === 'failed') {
      if (result.pending) { setPending(result.pending); setRecovery(null); setReview(null); }
      else if (body) { setPending(null); setRecovery(null); }
      setFormError(result.error?.message || 'The request could not be confirmed. Keep its reference and check again.');
      if (result.reload) { setReview(null); load(); }
    }
  };
  const isCurrentFor = (started) => () => scopeRef.current === started;
  const submit = async (body) => {
    if (!canWrite || busy) return;
    const started = scope;
    setBusy(true); setFormError(null); setNotice(null);
    const result = await recordReplacement({ client, storage: storage(), companyId, documentId: doc.id, body, isCurrent: isCurrentFor(started) });
    if (scopeRef.current !== started) return;
    apply(result, body); setBusy(false);
  };
  const check = async () => {
    if (!pending || busy) return;
    const started = scope;
    setBusy(true); setFormError(null);
    const resend = recovery === 'absent';
    const result = await checkPendingReplacement({ client, storage: storage(), companyId, documentId: doc.id, pending, resend, canWrite, isCurrent: isCurrentFor(started) });
    if (scopeRef.current !== started) return;
    apply(result, resend ? pending.body : null); setBusy(false);
  };
  const observe = async (replacementId) => {
    if (!canWrite) return;
    const started = scope;
    setObserving(replacementId); setFormError(null); setNotice(null);
    const result = await observeReplacementVersion({ client, companyId, documentId: doc.id, replacementId, isCurrent: isCurrentFor(started) });
    if (scopeRef.current !== started) return;
    if (result.kind === 'observed') setNotice('Observation recorded against this version only. Earlier payments are not re-qualified.');
    else if (result.kind === 'unknown') setFormError('No confirmed reply was received. Reload the history to see whether the observation was recorded; repeating it is safe.');
    else setFormError(result.error?.message || 'The observation failed. Nothing was recorded.');
    setObserving(null); load();
  };

  return <section className="workspace-card space-y-4 p-6" aria-label="Conditional discount agreement">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-semibold">Conditional discount agreement</h2>
        <p className="mt-1 text-xs text-muted-foreground">Every version is kept permanently. A replacement does not change this document's posted amounts.</p></div>
      {history && <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${history.consumed ? 'bg-muted text-foreground' : 'bg-primary/10 text-primary'}`}>{history.consumed ? 'Used by a credit · closed' : 'Open for replacement'}</span>}
    </div>
    {state.status === 'loading' && !history && <div className="space-y-2" aria-busy="true"><div className="h-4 w-2/3 animate-pulse rounded bg-muted" /><div className="h-16 animate-pulse rounded bg-muted" /></div>}
    {state.status === 'error' && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <p>{state.error?.message || 'Agreement history is unavailable.'}</p>
      <button type="button" className="mt-2 underline" onClick={load}>Try again</button></div>}
    {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">{notice}</p>}
    {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">{formError}</p>}
    <ReplacementRecovery pending={pending} outcome={recovery} busy={busy} canWrite={canWrite} onCheck={check} />
    {history && <ReplacementHistory original={original} history={history} canObserve={canWrite && !pending} observing={observing} onObserve={observe} />}
    {history?.consumed && <p className="text-sm text-muted-foreground">This agreement has been used by a credit. It cannot be replaced and its history is preserved.</p>}
    {history && !canWrite && <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">You have view-only access. Recording replacement terms requires permission from your company owner.</p>}
    {writable && !composing && !review && <button type="button" className="min-h-11 rounded-md border px-4 text-sm font-medium hover:bg-muted" onClick={() => setComposing(true)}>Record replacement terms</button>}
    {writable && composing && !review && <form onSubmit={prepare} className="space-y-4 rounded-xl border p-4" aria-label="Replacement terms">
      <p className="text-sm text-muted-foreground">Enter the new terms exactly as agreed with {doc.party_name}. Nothing is calculated for you.</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">Agreed on<input type="date" required className={field} value={form.agreement_date} onChange={e => setForm(f => ({ ...f, agreement_date: e.target.value }))} /></label>
        <label className="text-sm">Pay by<input type="date" required className={field} value={form.payment_deadline} onChange={e => setForm(f => ({ ...f, payment_deadline: e.target.value }))} /></label>
        <label className="text-sm">Discount if paid in time (£, incl. VAT)<input inputMode="decimal" required className={field} value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} /></label>
      </div>
      <p className="text-xs text-muted-foreground">New agreement reference <span className="font-mono">{form.agreement_id}</span></p>
      <label className="block text-sm">Agreement wording or evidence held<textarea required maxLength={20000} className={`${field} min-h-24`} value={form.evidence_text} onChange={e => setForm(f => ({ ...f, evidence_text: e.target.value }))} /></label>
      <label className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4" checked={form.attested} onChange={e => setForm(f => ({ ...f, attested: e.target.checked }))} />
        <span>I confirm these are the replacement terms agreed with {doc.party_name}, and that I hold the evidence described above.</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Review terms</button>
        <button type="button" className="min-h-11 rounded-md border px-4 text-sm" onClick={() => { setComposing(false); setForm(blankForm()); setFormError(null); }}>Cancel</button>
      </div>
    </form>}
    {writable && review && <ReplacementTermsReview body={review} partyName={doc.party_name} busy={busy} onConfirm={() => submit(review)} onCancel={() => setReview(null)} />}
    <p className="text-xs text-muted-foreground">Conditional credit posting is unavailable. Recording or observing terms never posts, credits or redeems a discount.</p>
  </section>;
}
