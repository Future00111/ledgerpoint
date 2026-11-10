import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, CheckCircle2, RefreshCw, FileText } from 'lucide-react';
import { penceToDisplay } from '@/api/accountingDocuments.mjs';
import { bankOpenings, buildIntent, bankLedgerOptions, equityOptions, pendingStore, isUnknownOutcome, isAlreadyPosted } from '@/api/bankOpenings.mjs';

const newRequestId = () => (globalThis.crypto?.randomUUID?.() ?? `ob-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const label = a => [a?.code, a?.name].filter(Boolean).join(' · ') || a?.id;
const fieldCls = 'w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50';

/**
 * Opening balance workflow for one bank account in one company.
 * Mount with key={`${companyId}:${bank.id}`} so a company/bank switch discards in-flight state.
 */
export default function OpeningBalance({ companyId, bank, open, onOpenChange, client = bankOpenings, storage }) {
  const store = useMemo(() => pendingStore(storage), [storage]);
  const alive = useRef(true);
  const [phase, setPhase] = useState('loading'); // loading | error | form | reviewing | reviewed | posting | unknown | recovering | recorded
  const [error, setError] = useState(null);
  const [ctx, setCtx] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [review, setReview] = useState(null);
  const [pendingIntent, setPendingIntent] = useState(null);
  const [form, setForm] = useState({ ledger: '', balancing: '', date: '', amount: '', direction: '' });
  const [formErrors, setFormErrors] = useState([]);
  const requestId = useRef(newRequestId());

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const recover = useCallback(async (signal) => {
    const pending = store.read(companyId, bank.id);
    const status = await client.get(companyId, bank.id, signal);
    if (!alive.current) return;
    if (status?.status === 'recorded') {
      store.clear(companyId, bank.id);
      setReceipt(status); setPhase('recorded'); return;
    }
    if (pending?.intent) { setPendingIntent(pending.intent); requestId.current = pending.intent.request_id; setPhase('unknown'); return; }
    setPhase('form');
  }, [client, companyId, bank.id, store]);

  const load = useCallback(async () => {
    const ac = new AbortController();
    setPhase('loading'); setError(null);
    try {
      const c = await client.context(companyId, ac.signal);
      if (!alive.current) return;
      setCtx(c);
      await recover(ac.signal);
    } catch (e) {
      if (alive.current) { setError(e.message); setPhase('error'); }
    }
    return () => ac.abort();
  }, [client, companyId, recover]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const configuredLedger = ctx?.bank_ledger_account_id ?? null;
  const ledgers = bankLedgerOptions(ctx?.accounts, configuredLedger);
  const ledgerReady = ledgers.length === 1;
  const equities = equityOptions(ctx?.accounts);
  const accountsById = useMemo(() => Object.fromEntries([...(ctx?.accounts || []), ...(review?.accounts || [])].map(a => [String(a.id), a])), [ctx, review]);
  const canPost = ctx?.can_post === true && ledgerReady;
  const busy = ['loading', 'reviewing', 'posting', 'recovering'].includes(phase);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const runReview = async (intent) => {
    setPhase('reviewing'); setError(null);
    try {
      const r = await client.review(companyId, intent);
      if (!alive.current) return;
      setReview(r); setPhase('reviewed');
    } catch (e) {
      if (!alive.current) return;
      if (isAlreadyPosted(e)) { await resolveAlreadyPosted(intent); return; }
      setError(e.message); setPhase(pendingIntent ? 'unknown' : 'form');
    }
  };

  const startReview = () => {
    const { intent, errors } = buildIntent({
      requestId: requestId.current, bankAccountId: bank.id, bankLedgerAccountId: form.ledger,
      balancingAccountId: form.balancing, effectiveDate: form.date, amount: form.amount, direction: form.direction,
    });
    setFormErrors(errors || []);
    if (intent) runReview(intent);
  };

  const confirm = async () => {
    const intent = review?.intent;
    if (!intent || !review?.review_token) return;
    if (!store.write(companyId, bank.id, intent)) {
      setError('This browser could not save the pending request, so it was not posted (a reload would lose track of it). Allow site storage or leave private browsing, then confirm again.');
      return;
    }
    setPhase('posting'); setError(null);
    try {
      const r = await client.post(companyId, intent, review.review_token);
      if (!alive.current) return;
      store.clear(companyId, bank.id);
      setReceipt(r); setReview(null); setPendingIntent(null); setPhase('recorded');
    } catch (e) {
      if (!alive.current) return;
      if (isAlreadyPosted(e)) { await resolveAlreadyPosted(intent); return; }
      if (isUnknownOutcome(e)) { setPendingIntent(intent); setError(e.message); setPhase('unknown'); }
      else { store.clear(companyId, bank.id); setError(e.message); setReview(null); setPhase('form'); }
    }
  };

  /** Server says an opening exists: read it back by GET. Never offer a new intent from here. */
  const resolveAlreadyPosted = async (intent) => {
    setPhase('recovering'); setError(null); setReview(null);
    try {
      const status = await client.get(companyId, bank.id);
      if (!alive.current) return;
      if (status?.status === 'recorded') { store.clear(companyId, bank.id); setReceipt(status); setPendingIntent(null); setPhase('recorded'); return; }
      setPendingIntent(intent);
      setError('The server reported an opening balance already exists but it is not visible yet. Check status again shortly.');
      setPhase('unknown');
    } catch (e) {
      if (!alive.current) return;
      setPendingIntent(intent); setError(e.message); setPhase('unknown');
    }
  };

  const checkStatus = async () => {
    setPhase('recovering'); setError(null);
    try { await recover(); } catch (e) { if (alive.current) { setError(e.message); setPhase('unknown'); } }
  };

  const cancelReview = () => { setReview(null); setPhase(pendingIntent ? 'unknown' : 'form'); };

  return (
    <Dialog open={open} onOpenChange={v => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-opening-balance">
        <DialogHeader>
          <DialogTitle>Opening balance · {bank.account_name}</DialogTitle>
          <DialogDescription>Posts a balanced journal so this bank's opening position reaches the ledger. Bank accounts only; subledger openings are not supported here.</DialogDescription>
        </DialogHeader>

        {phase === 'loading' && (
          <div className="space-y-3 py-2" aria-busy="true">
            {[0, 1, 2, 3].map(i => <div key={i} className="h-9 rounded-md bg-muted animate-pulse" />)}
          </div>
        )}

        {phase === 'error' && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
            <p className="font-medium text-destructive">Couldn't load opening balance status</p>
            <p className="text-muted-foreground mt-1">{error}</p>
            <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={load} data-testid="button-opening-retry-load"><RefreshCw className="w-3 h-3" />Try again</Button>
          </div>
        )}

        {phase === 'recorded' && receipt && (
          <div className="space-y-3" data-testid="opening-receipt">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700"><CheckCircle2 className="w-4 h-4" />Opening balance posted</div>
            <dl className="grid grid-cols-2 gap-3 text-sm rounded-lg border p-3">
              <div><dt className="text-xs text-muted-foreground">Posted ledger balance through today</dt><dd className="font-semibold tabular-nums" data-testid="text-opening-server-balance">{penceToDisplay(receipt.balance_minor)}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Opening amount</dt><dd className="tabular-nums">{penceToDisplay(receipt.intent?.amount_minor)} {receipt.intent?.direction === 'credit' ? '(overdraft)' : '(in credit)'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Effective date</dt><dd>{receipt.intent?.effective_date}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Balancing account</dt><dd>{label(accountsById[String(receipt.intent?.balancing_account_id)]) || receipt.intent?.balancing_account_id}</dd></div>
            </dl>
            <Link to={`/accounting/journals/${encodeURIComponent(receipt.journal_id)}`} className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline" data-testid="link-opening-journal">
              <FileText className="w-4 h-4" />View journal {receipt.journal_id}
            </Link>
          </div>
        )}

        {phase === 'unknown' && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm space-y-2" role="alert" data-testid="opening-unknown">
            <p className="font-medium text-amber-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Outcome not confirmed</p>
            <p className="text-amber-900/80">We sent this opening balance but didn't get a definite answer. Check the status first. If it wasn't recorded, you can retry the exact same request; a new request is not allowed until this one is resolved.</p>
            {pendingIntent && <p className="text-xs text-amber-900/70 tabular-nums">{penceToDisplay(pendingIntent.amount_minor)} {pendingIntent.direction} · {pendingIntent.effective_date}</p>}
            {error && <p className="text-xs text-amber-900/70">{error}</p>}
          </div>
        )}

        {(phase === 'form' || phase === 'reviewing') && (
          <div className="space-y-3">
            {!ledgerReady && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900" role="alert" data-testid="opening-ledger-setup">
                No active bank ledger account is configured for payments. Set the bank GL account in{' '}
                <Link to="/payments" className="font-medium underline underline-offset-2" data-testid="link-opening-payments-setup">Payments setup</Link>, then reopen this dialog.
              </div>
            )}
            {ledgerReady && ctx?.can_post !== true && <p className="text-xs rounded-md bg-muted p-2 text-muted-foreground">You can view this status, but you don't have permission to post opening balances.</p>}
            <label className="block text-xs font-medium">Bank ledger account (configured payment bank GL)
              <select className={fieldCls} value={form.ledger} onChange={set('ledger')} disabled={!canPost || busy} data-testid="select-opening-ledger">
                <option value="">{ledgerReady ? 'Choose…' : 'Not configured'}</option>
                {ledgers.map(a => <option key={a.id} value={a.id}>{label(a)}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium">Balancing account (active equity)
              <select className={fieldCls} value={form.balancing} onChange={set('balancing')} disabled={!canPost || busy} data-testid="select-opening-balancing">
                <option value="">Choose…</option>
                {equities.map(a => <option key={a.id} value={a.id}>{label(a)}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-medium">Effective date
                <input type="date" className={fieldCls} value={form.date} onChange={set('date')} disabled={!canPost || busy} data-testid="input-opening-date" />
              </label>
              <label className="block text-xs font-medium">Amount (£)
                <input inputMode="decimal" placeholder="0.00" className={`${fieldCls} tabular-nums`} value={form.amount} onChange={set('amount')} disabled={!canPost || busy} data-testid="input-opening-amount" />
              </label>
            </div>
            <fieldset className="flex gap-4 text-sm" disabled={!canPost || busy}>
              <legend className="text-xs font-medium mb-1">Balance on the effective date</legend>
              <label className="flex items-center gap-2"><input type="radio" name="ob-dir" value="debit" checked={form.direction === 'debit'} onChange={set('direction')} data-testid="radio-opening-debit" />In credit (debit bank)</label>
              <label className="flex items-center gap-2"><input type="radio" name="ob-dir" value="credit" checked={form.direction === 'credit'} onChange={set('direction')} data-testid="radio-opening-credit" />Overdrawn (credit bank)</label>
            </fieldset>
            {(formErrors.length > 0 || error) && (
              <ul className="text-xs text-destructive space-y-0.5" role="alert">
                {formErrors.map(e => <li key={e}>{e}</li>)}
                {error && <li>{error}</li>}
              </ul>
            )}
          </div>
        )}

        {(phase === 'reviewed' || phase === 'posting') && review && (
          <div className="space-y-2" data-testid="opening-review">
            <p className="text-sm">Check the journal before it's posted on <span className="font-medium">{review.intent?.effective_date}</span>.</p>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted-foreground border-b"><th className="text-left py-1 font-medium">Account</th><th className="text-right font-medium">Debit</th><th className="text-right font-medium">Credit</th></tr></thead>
              <tbody>
                {review.lines?.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5">{label(accountsById[String(l.accountId)]) || l.accountId}</td>
                    <td className="text-right tabular-nums">{BigInt(l.debitMinor || 0) > 0n ? penceToDisplay(l.debitMinor) : ''}</td>
                    <td className="text-right tabular-nums">{BigInt(l.creditMinor || 0) > 0n ? penceToDisplay(l.creditMinor) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          </div>
        )}

        <DialogFooter className="gap-2">
          {(phase === 'form' || phase === 'reviewing') && <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Close</Button>
            <Button onClick={startReview} disabled={!canPost || busy} data-testid="button-opening-review">{phase === 'reviewing' ? 'Preparing review…' : 'Review journal'}</Button>
          </>}
          {(phase === 'reviewed' || phase === 'posting') && <>
            <Button variant="outline" onClick={cancelReview} disabled={busy} data-testid="button-opening-cancel">Cancel</Button>
            <Button onClick={confirm} disabled={busy || !canPost} data-testid="button-opening-confirm">{phase === 'posting' ? 'Posting…' : 'Confirm and post'}</Button>
          </>}
          {(phase === 'unknown' || phase === 'recovering') && <>
            <Button variant="outline" onClick={checkStatus} disabled={busy} className="gap-1" data-testid="button-opening-check"><RefreshCw className="w-3 h-3" />{phase === 'recovering' ? 'Checking…' : 'Check status'}</Button>
            <Button onClick={() => pendingIntent && runReview(pendingIntent)} disabled={busy || !canPost || !pendingIntent} data-testid="button-opening-retry-same">Retry same request</Button>
          </>}
          {phase === 'recorded' && <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

