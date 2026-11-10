import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Undo2 } from 'lucide-react';
import { createGate, formatMinor, newRequestId, retainPendingOnFailure, unresolvedRecovery } from './model.mjs';
import { buildCorrectionBody, canCorrect, formatWhen, MAX_REASON, verifyCorrectionReceipt, verifyCorrectionReview } from './correctionModel.mjs';

function Notice({ tone = 'info', children, testId }) {
  const cls = tone === 'error' ? 'border-red-200 bg-red-50 text-red-950' : tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-950' : tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-slate-200 bg-slate-50 text-slate-800';
  return <div role={tone === 'error' ? 'alert' : 'status'} data-testid={testId} className={`rounded-lg border p-3 text-sm space-y-1 ${cls}`}>{children}</div>;
}
const PENDING_MSG = 'An earlier correction for this company is still unconfirmed. Resolve it above (Check outcome) before starting a new one.';

/** One original match receipt plus its correction history. Corrected receipts stay visible. */
export function MatchReceiptRow({ match, paymentLabel, canWrite, open, onOpen, children }) {
  const corrected = match.active !== true;
  return (
    <div className={`rounded-md px-2 py-1.5 text-xs space-y-1 ${corrected ? 'border border-dashed bg-background' : 'bg-muted/40'}`} data-testid={`row-match-${match.request_id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={corrected ? 'line-through text-muted-foreground' : ''}>Matched {formatMinor(match.amount_minor)} to payment {paymentLabel}</span>
        {corrected && <span className="rounded border border-slate-300 px-1.5 text-[11px] text-slate-700" data-testid={`status-corrected-${match.request_id}`}>Corrected</span>}
        {match.journal_id && <Link to={`/accounting/journals/${match.journal_id}`} className="text-primary underline" data-testid={`link-journal-${match.request_id}`}>View journal</Link>}
        {canCorrect(match, canWrite) && !open && <Button size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1 ml-auto" onClick={onOpen} data-testid={`button-correct-${match.request_id}`}><Undo2 className="w-3 h-3" />Unmatch</Button>}
      </div>
      <p className="text-muted-foreground">Original receipt {match.request_id}</p>
      {corrected && match.correction_request_id && <p className="text-muted-foreground" data-testid={`text-correction-${match.request_id}`}>
        Unmatched {match.corrected_at ? formatWhen(match.corrected_at) : ''}{match.correction_actor ? ` by ${match.correction_actor}` : ''}: {match.correction_reason || 'No reason recorded'} (correction {match.correction_request_id}). The payment and journal were not changed.</p>}
      {children}
    </div>
  );
}

/** Explicit review then confirm of an append-only unmatch. Releases the whole receipt; never changes cash, journals or dates. */
export function CorrectionPanel({ companyId, match, paymentLabel, client, store, signal, onClose, onRecorded }) {
  const gate = useRef(createGate());
  const [reason, setReason] = useState('');
  const [review, setReview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [outcome, setOutcome] = useState(null);
  useEffect(() => () => gate.current.cancel(), []);
  const reset = () => { gate.current.cancel(); setReview(null); setError(''); setBusy(''); };

  async function runReview() {
    if (store.read(companyId, 'correction')) { setError(PENDING_MSG); return; }
    const built = buildCorrectionBody({ requestId: newRequestId(), match, reason });
    if (built.error) { setError(built.error); return; }
    const t = gate.current.begin(); setBusy('Checking correction'); setError('');
    try {
      const data = verifyCorrectionReview(await client.correctionReview(companyId, built.body, signal), built.body, match);
      if (gate.current.current(t)) setReview({ body: built.body, data });
    } catch (e) { if (gate.current.current(t) && e?.name !== 'AbortError') setError(e.message); }
    finally { if (gate.current.current(t)) setBusy(''); }
  }
  async function send(body, how) {
    const phase = how === 'check' || outcome?.kind === 'unknown' ? 'recovery' : 'initial';
    const t = gate.current.begin();
    setBusy(how === 'check' ? 'Checking outcome' : 'Recording correction');
    try {
      const raw = how === 'check' ? await client.correctionStatus(companyId, body.request_id, signal) : await client.recordCorrection(companyId, body, signal);
      if (!gate.current.current(t)) return;
      const v = verifyCorrectionReceipt(raw, body, match.amount_minor);
      if (v.status === 'unknown') { setOutcome({ kind: 'unknown', body, notFound: true }); return; }
      store.clear(companyId, 'correction'); setOutcome({ kind: 'done', receipt: v.receipt }); onRecorded();
    } catch (e) {
      if (e?.name === 'AbortError' || !gate.current.current(t)) return;
      if (retainPendingOnFailure(e, phase)) setOutcome({ kind: 'unknown', body, checkError: unresolvedRecovery(e) });
      else { store.clear(companyId, 'correction'); setOutcome(null); setReview(null); setError(`Nothing was changed: ${e.message}`); }
    } finally { if (gate.current.current(t)) setBusy(''); }
  }
  function confirm() {
    if (!review || busy) return;
    if (store.read(companyId, 'correction')) { setError(PENDING_MSG); return; }
    const body = { ...review.body, review_token: review.data.review_token };
    if (!store.write(companyId, 'correction', body)) { setError('This browser could not save a recovery record, so the correction was not sent.'); return; }
    send(body, 'record');
  }

  if (outcome?.kind === 'done') return <Notice tone="ok" testId="text-correction-done">
    <p className="font-medium">Unmatched: {formatMinor(outcome.receipt.released_minor)} released at {formatWhen(outcome.receipt.effective_at)}.</p>
    <p>The original receipt stays in history. The payment, its journal and the bank ledger were not changed.</p>
    <div className="flex gap-3">{outcome.receipt.journal_id && <Link to={`/accounting/journals/${outcome.receipt.journal_id}`} className="text-primary underline">View source journal</Link>}<button className="underline" onClick={onClose}>Close</button></div>
  </Notice>;
  if (outcome?.kind === 'unknown') return <Notice tone="warn" testId="text-correction-unknown">
    <p className="font-medium">The correction outcome could not be confirmed (request {outcome.body.request_id}).</p>
    <p>{outcome.notFound ? 'The server has no record of it. You may resend the exact same request.' : outcome.checkError ? `Check failed: ${outcome.checkError}` : 'Check the outcome first. It will not be sent again automatically.'}</p>
    <div className="flex gap-2"><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={() => send(outcome.body, 'check')} data-testid="button-check-correction">Check outcome</Button>
      {outcome.notFound && <Button size="sm" disabled={Boolean(busy)} onClick={() => send(outcome.body, 'record')} data-testid="button-retry-correction">Retry exact request</Button>}</div>
  </Notice>;

  const reasonId = `correction-reason-${match.request_id}`;
  return (
    <div className="rounded-md border p-3 space-y-3 bg-background" data-testid="panel-correction">
      <p className="text-sm font-medium">Unmatch {formatMinor(match.amount_minor)} from payment {paymentLabel}</p>
      <p className="text-xs text-muted-foreground">The whole receipt is released and recorded as a correction now. The original receipt remains in history. No payment, journal or cash is changed, and you cannot backdate it.</p>
      <label htmlFor={reasonId} className="text-sm font-medium block">Reason</label>
      <textarea id={reasonId} maxLength={MAX_REASON} rows={2} disabled={Boolean(busy) || Boolean(review)} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" value={reason} onChange={e => { reset(); setReason(e.target.value); }} data-testid="input-correction-reason" />
      <p className="text-[11px] text-muted-foreground">{reason.length}/{MAX_REASON}</p>
      {error && <Notice tone="error" testId="text-correction-error">{error}</Notice>}
      {review && <Notice testId="text-correction-review">
        <p className="font-medium">Confirm: release {formatMinor(review.data.match.amount_minor)} matched to payment {paymentLabel}.</p>
        <p>Afterwards the statement line has {formatMinor(review.data.statement_remaining_minor)} unexplained and the payment has {formatMinor(review.data.payment_remaining_minor)} unmatched.</p>
        {review.data.match.journal_id && <Link to={`/accounting/journals/${review.data.match.journal_id}`} className="text-primary underline" data-testid="link-correction-journal">View source journal (unchanged)</Link>}
      </Notice>}
      {busy && <p role="status" className="text-xs text-muted-foreground">{busy}...</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" disabled={busy === 'Recording correction'} onClick={() => { reset(); onClose(); }} data-testid="button-cancel-correction">Cancel</Button>
        {review ? <><Button size="sm" variant="outline" disabled={Boolean(busy)} onClick={reset}>Change</Button><Button size="sm" variant="destructive" disabled={Boolean(busy)} onClick={confirm} data-testid="button-confirm-correction">Confirm unmatch</Button></>
          : <Button size="sm" disabled={Boolean(busy) || !reason.trim()} onClick={runReview} data-testid="button-review-correction">Review unmatch</Button>}
      </div>
    </div>
  );
}

/** After reload: GET first; exact retry only on explicit action when the server reports unknown. */
export function CorrectionRecovery({ companyId, client, store, signal, onResolved }) {
  const [pending, setPending] = useState(() => store.read(companyId, 'correction'));
  const [st, setSt] = useState({});
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  const run = async how => {
    const body = pending.body;
    setSt({ busy: true });
    try {
      const raw = how === 'check' ? await client.correctionStatus(companyId, body.request_id, signal) : await client.recordCorrection(companyId, body, signal);
      if (!alive.current) return;
      const v = verifyCorrectionReceipt(raw, body);
      if (v.status === 'unknown') { setSt({ unknown: true }); return; }
      store.clear(companyId, 'correction');
      setSt({ done: `${formatMinor(v.receipt.released_minor)} was released.`, journal: v.receipt.journal_id });
      onResolved();
    } catch (e) {
      if (e?.name === 'AbortError' || !alive.current) return;
      setSt({ error: unresolvedRecovery(e) });
    }
  };
  useEffect(() => { if (pending) run('check'); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pending) return null;
  if (st.done) return <Notice tone="ok" testId="text-recovered-correction"><p>Previous unmatch confirmed. {st.done}</p>{st.journal && <Link to={`/accounting/journals/${st.journal}`} className="text-primary underline">View source journal</Link>}<Button size="sm" variant="ghost" onClick={() => setPending(null)}>Dismiss</Button></Notice>;
  return <Notice tone="warn" testId="text-pending-correction">
    <p className="font-medium">An unmatch correction was sent but its outcome is not yet confirmed (request {pending.body.request_id}).</p>
    <p>{st.busy ? 'Checking with the server...' : st.unknown ? 'The server has no record of it. You can resend the exact same request; it cannot release the receipt twice.' : st.error ? `Could not check: ${st.error}` : ''}</p>
    <p>No new correction can be started until this is resolved.</p>
    <div className="flex gap-2 pt-1">
      <Button size="sm" variant="outline" disabled={st.busy} onClick={() => run('check')} data-testid="button-check-correction-pending">Check outcome</Button>
      {st.unknown && <Button size="sm" disabled={st.busy} onClick={() => run('retry')} data-testid="button-retry-exact-correction">Retry exact request</Button>}
    </div>
  </Notice>;
}
