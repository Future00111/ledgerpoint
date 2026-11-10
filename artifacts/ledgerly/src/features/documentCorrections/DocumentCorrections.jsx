import { useEffect, useRef, useState } from 'react';
import { accounting } from '@/api/accountingDocuments.mjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Money, ErrorBox, JournalLink, SkeletonRows, today } from '@/components/accounting/AccountingUI';
import { canReviewCorrection, correctionForm, createCorrectionController } from './model.mjs';

export default function DocumentCorrections({ companyId, documentId, onSaved }) {
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('correction_request'));
  const close = () => {
    const url=new URL(window.location.href);url.searchParams.delete('correction_request');
    window.history.replaceState(window.history.state,'',url);setOpen(false);
  };
  return <section className="workspace-card p-5" aria-label="Document corrections">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Corrections & history</h2><p className="mt-1 text-sm text-muted-foreground">Review an amount change while preserving the original and payment history.</p></div><Button variant="outline" onClick={() => setOpen(true)} disabled={open}>Review corrections</Button></div>
    {open && <CorrectionEditor key={`${companyId}:${documentId}`} companyId={companyId} documentId={documentId} onSaved={onSaved} onClose={close} />}
  </section>;
}
function CorrectionEditor({ companyId, documentId, onSaved, onClose }) {
  const [state, setState] = useState({ status: 'loading' }), [form, setForm] = useState(null), [ack, setAck] = useState(false);
  const controller = useRef(null), savedCallback = useRef(onSaved); savedCallback.current = onSaved;
  const notified = useRef(false);
  useEffect(() => {
    if (state.status !== 'posted' || notified.current) return;
    notified.current = true;
    onClose(); // Clear the locator before the parent refetch can remount recovery.
    savedCallback.current?.(state.receipt);
  }, [state.status, state.receipt, onClose]);
  useEffect(() => {
    const session = createCorrectionController({ client: accounting, companyId, documentId,
      recoveryRequestId:new URLSearchParams(window.location.search).get('correction_request'),
      rememberRequest: requestId => {
        const url=new URL(window.location.href);url.searchParams.set('correction_request',requestId);
        window.history.replaceState(window.history.state,'',url);
      }, forgetRequest: () => {
        const url=new URL(window.location.href);url.searchParams.delete('correction_request');
        window.history.replaceState(window.history.state,'',url);
      }, onState: next => {
      setState(next);
      if (next.status === 'ready' && next.context && !next.error) setForm(correctionForm(next.context.document, today()));
    } });
    controller.current = session; session.load();
    return () => session.dispose();
  }, [companyId, documentId]);
  const change = next => { controller.current.discardReview(); setAck(false); setForm(next); };
  return <CorrectionWorkspace state={state} form={form} acknowledged={ack} onAcknowledge={setAck} onChange={change}
    onReview={() => { setAck(false); controller.current.review(form); }} onPost={() => controller.current.post()}
    onRecover={() => controller.current.recover()}
    onRefresh={() => { setAck(false); controller.current.load(); }} onClose={() => {
      onClose(); // Remove the recovery locator before a parent document refresh.
    }} />;
}

export function CorrectionWorkspace({ state, form, acknowledged, onAcknowledge, onChange, onReview, onPost, onRecover, onRefresh, onClose }) {
  const { context, review, status } = state;
  const busy = ['loading', 'reviewing', 'posting', 'checking'].includes(status), uncertain = status === 'unknown';
  const editable = canReviewCorrection(context) && ['ready', 'reviewed'].includes(status);
  return <div className="mt-5 space-y-5 border-t pt-5">
    <ErrorBox error={state.error} onRetry={status === 'error' ? onRefresh : undefined} />
    {status === 'loading' && <SkeletonRows rows={4} />}
    {status === 'checking' && <p role="status">Checking the recorded correction. No changes are being sent…</p>}
    {uncertain && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm"><p>This correction may already be posted or still processing. Check its recorded outcome; do not enter another correction.</p><Button className="mt-3" variant="outline" onClick={onRecover}>Check this correction again</Button><p className="mt-2 text-xs">This page’s recovery link survives reload. Checking is read-only and never resubmits the correction.</p></div>}
    {status === 'posted' && <p role="status" className="text-sm text-emerald-800">Correction recorded. <JournalLink id={state.receipt?.journal_id} /></p>}
    {context && <>
      <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed"><p>The original document, its tax point and payments stay recorded. A correction adds a dated adjustment to the accounts.</p><p className="mt-2 font-medium">Eligible corrected invoices and bills can receive credit notes through the credit workflow, within their remaining line amounts. Conditional-discount replacement terms and return-credit tracking on corrected bills are not available. Posted credits remain included in the outstanding balance. Revised amounts must cover existing credits and allocated payments; a linked draft credit must be resolved before correction.</p><p className="mt-2 text-muted-foreground">Party, VAT codes, accounts, discounts, notes and line order stay fixed. Credit notes and metadata-only edits are not supported here yet.</p></div>
      {context.blockers?.length > 0 && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-medium">This document cannot be corrected here yet</p><ul className="mt-2 list-disc space-y-1 pl-5">{context.blockers.map(item => <li key={item.code}>{item.message}</li>)}</ul></div>}
      {!context.capabilities?.review_corrections && !context.blockers?.length && <p className="text-sm text-muted-foreground">Your current role can view history but cannot review corrections.</p>}
      {canReviewCorrection(context) && form && <fieldset disabled={!editable || busy || uncertain} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Correction date<Input type="date" min="1900-01-01" max="2199-12-31" value={form.effective_date} onChange={e => onChange({ ...form, effective_date: e.target.value })} /></label><label className="text-sm font-medium">Reason<Textarea value={form.reason} maxLength={1000} onChange={e => onChange({ ...form, reason: e.target.value })} placeholder="Explain why these amounts need correcting" /></label></div>
        <p className="text-xs text-muted-foreground">Unit prices {context.document.source.price_basis === 'including_vat' ? 'include' : 'exclude'} VAT. Server review calculates the final amounts.</p>
        <div className="overflow-x-auto"><table className="workspace-table"><thead><tr><th>Item</th><th>Quantity</th><th>Unit price</th><th>VAT code</th></tr></thead><tbody>{form.line_items.map((line, i) => <tr key={i}><td className="min-w-40">{context.document.source.line_items[i]?.description}</td><td><Input aria-label={`Quantity for line ${i + 1}`} inputMode="decimal" className="min-w-24" value={line.quantity} onChange={e => onChange({ ...form, line_items: form.line_items.map((item, n) => n === i ? { ...item, quantity: e.target.value } : item) })} /></td><td><Input aria-label={`Unit price for line ${i + 1}`} inputMode="decimal" className="min-w-28" value={line.unit_price} onChange={e => onChange({ ...form, line_items: form.line_items.map((item, n) => n === i ? { ...item, unit_price: e.target.value } : item) })} /></td><td>{context.document.source.line_items[i]?.tax_code}</td></tr>)}</tbody></table></div>
        <Button type="button" onClick={onReview}>{status === 'reviewing' ? 'Reviewing…' : 'Review revised amounts'}</Button>
      </fieldset>}
      {review && <section aria-label="Reviewed correction" className="rounded-xl border p-4"><h3 className="font-semibold">Review the change</h3><div className="mt-3 overflow-x-auto"><table className="workspace-table"><thead><tr><th>Amount</th><th>Before</th><th>After</th></tr></thead><tbody>{[['Net', 'net_pence'], ['VAT', 'vat_pence'], ['Total', 'gross_pence']].map(([label, key]) => <tr key={key}><th>{label}</th><td><Money value={review.before.money[key]} /></td><td><Money value={review.after.money[key]} /></td></tr>)}<tr><th>Balance due</th><td><Money value={review.settlement.before_open_minor} /></td><td><Money value={review.settlement.after_open_minor} /></td></tr></tbody></table></div><p className="mt-3 text-sm">Payments stay at <Money value={review.settlement.paid_minor} />. Effective {review.intent.effective_date}.</p>
        {status === 'reviewed' && <><label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={acknowledged} onChange={e => onAcknowledge(e.target.checked)} /><span>I have reviewed these amounts, the date and the credit restrictions above.</span></label><Button className="mt-4" disabled={!acknowledged || !context.capabilities?.correct_documents} onClick={onPost}>Post correction</Button></>}
      </section>}
      {status === 'posting' && <p role="status" className="text-sm">Recording the reviewed correction…</p>}
      <details className="rounded-lg border p-4"><summary className="cursor-pointer text-sm font-medium">Correction history ({context.history?.amendments?.length ?? 0})</summary>{context.history?.amendments?.length ? <ol className="mt-3 divide-y">{context.history.amendments.map(item => <li key={item.revision} className="space-y-2 py-3 text-sm"><p>{item.effective_date} · {item.reason}</p><p><Money value={item.before_money.gross_pence} /> → <Money value={item.after_money.gross_pence} /></p><JournalLink id={item.journal_id} /></li>)}</ol> : <p className="mt-3 text-sm text-muted-foreground">No financial corrections recorded.</p>}</details>
      <details className="rounded-lg border p-4"><summary className="cursor-pointer text-sm font-medium">Immutable original</summary><p className="mt-3 text-sm">{context.original?.source?.invoice_number} · {context.original?.source?.issue_date} · <Money value={context.original?.money?.gross_pence} /></p><JournalLink id={context.original?.journal_id} /></details>
    </>}
    <div className="flex gap-3"><Button variant="ghost" disabled={busy || uncertain} onClick={onClose}>Close</Button>{context && !busy && !uncertain && <Button variant="ghost" onClick={onRefresh}>Refresh history</Button>}</div>
  </div>;
}
