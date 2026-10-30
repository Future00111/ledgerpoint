import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, Clock3 } from 'lucide-react';
import { creditRecovery } from '@/api/creditRecovery.mjs';
import { docPath } from '@/api/accountingDocuments.mjs';
import { Button } from '@/components/ui/button';
import { Money, ErrorBox, today } from '@/components/accounting/AccountingUI';
import { canCancelClaim, canConfirmCandidate, claimStatus, createRequestBook, isOverdue } from './model.mjs';
import { useMutationScope } from './useCreditClaims';

export function ClaimStatus({ claim }) {
  const status = claimStatus(claim);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${status.style}`}>{status.label}</span>;
}

function ClaimCard({ claim, companyId, canManage, onChanged, showBill }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [message, setMessage] = useState('');
  const requests = useRef(createRequestBook());
  const scope = useMutationScope();
  const candidates = claim.candidates ?? [];
  const overdue = isOverdue(claim, today());
  const receive = async candidate => {
    if (busy || !canConfirmCandidate(claim, candidate, canManage)) return;
    const action = `receive:${claim.id}:${candidate.credit_id}:${candidate.credit_line_ref}`;
    const request = scope.begin();
    setBusy(true); setError(null); setMessage('');
    try {
      const body = requests.current.forRequest(action, {
        credit_id: candidate.credit_id, credit_revision: candidate.credit_revision, credit_line_ref: candidate.credit_line_ref,
      }, claim.revision);
      await creditRecovery.receive(companyId, claim.id, body, claim.revision, request.signal);
      if (!request.current()) return;
      requests.current.complete(action);
      setMessage('Match recorded. The remaining credit is shown below.');
      onChanged();
    } catch (e) { if (request.current()) setError(e); }
    finally { if (request.current()) setBusy(false); request.finish(); }
  };
  const cancel = async () => {
    if (busy || !canCancelClaim(claim, canManage)) return;
    const action = `cancel:${claim.id}`;
    const request = scope.begin();
    setBusy(true); setError(null); setMessage('');
    try {
      const body = requests.current.forRequest(action, {}, claim.revision);
      await creditRecovery.cancel(companyId, claim.id, body, claim.revision, request.signal);
      if (!request.current()) return;
      requests.current.complete(action); setConfirmCancel(false);
      setMessage('Tracking cancelled. The original bill and accounts are unchanged.');
      onChanged();
    } catch (e) { if (request.current()) setError(e); }
    finally { if (request.current()) setBusy(false); request.finish(); }
  };
  return <article className="rounded-xl border bg-card" aria-label={`Credit for ${claim.description}`} data-testid={`credit-claim-${claim.id}`}>
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h3 className="font-semibold">{claim.description}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{claim.party_name}{showBill && <> · <Link className="text-primary hover:underline" to={docPath('purchase_bill', claim.bill_id)}>{claim.bill_number}<ArrowUpRight className="ml-1 inline h-3 w-3" /></Link></>}</p>
          <p className="mt-1 text-xs text-muted-foreground">Quantity expected: {claim.quantity} · Received: {claim.received_quantity}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2"><ClaimStatus claim={claim} />{overdue && <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-800"><Clock3 className="h-3.5 w-3.5" />Overdue</span>}</div>
      </div>
      <dl className="grid grid-cols-3 gap-3 rounded-lg bg-muted/40 p-3 text-sm">
        {[['Expected', claim.expected?.gross_pence], ['Received', claim.received?.gross_pence], ['Still waiting', claim.remaining?.gross_pence]].map(([label, amount]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold"><Money value={amount} /></dd></div>)}
      </dl>
      <p className="text-xs text-muted-foreground">Amounts include VAT. Expected net <Money value={claim.expected?.net_pence} /> + VAT <Money value={claim.expected?.vat_pence} />.</p>
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div><dt className="inline text-muted-foreground">Reason: </dt><dd className="inline">{claim.reason}</dd></div>
        {[["Return reference", claim.return_reference], ["Part reference", claim.part_reference], ["Job / vehicle", claim.job_reference], ["Returned on", claim.returned_on], ["Expected by", claim.expected_by]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="inline text-muted-foreground">{label}: </dt><dd className="inline">{value}</dd></div>)}
      </dl>
      {claim.status === 'needs_review' && !claim.cancelled && <p role="status" className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-950">The received credit needs review. Check quantities and amounts against the original item before closing the difference.</p>}
      <ErrorBox error={error} onRetry={onChanged} />
      {error && <p className="text-xs text-muted-foreground">If the result was uncertain, retry the same action. It uses the same request reference to avoid recording it twice.</p>}
      {message && <p role="status" className="text-sm text-primary">{message}</p>}
      {candidates.length > 0 && !claim.cancelled && <section className="rounded-lg border border-primary/20 bg-primary/5 p-4" aria-label="Possible credit matches">
        <h4 className="text-sm font-semibold">{candidates.length === 1 ? 'Possible credit match' : 'Possible credit matches'}</h4>
        <p className="mt-1 text-xs text-muted-foreground">Check the incoming credit before matching it. Matching only updates this tracker.</p>
        <ul className="mt-3 divide-y">{candidates.map(candidate => <li key={`${candidate.credit_id}:${candidate.credit_line_ref}`} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div><Link className="text-sm font-medium text-primary hover:underline" to={docPath('supplier_credit_note', candidate.credit_id)}>{candidate.number || 'Supplier credit'}<ArrowUpRight className="ml-1 inline h-3 w-3" /></Link><p className="mt-1 text-xs text-muted-foreground">Line {candidate.credit_line_ref + 1} · Quantity {candidate.quantity} · {candidate.status === 'posted' ? 'Posted credit' : 'Draft — review and post the credit first'}</p></div>
          <div className="flex flex-wrap items-center gap-3"><Money value={candidate.money?.gross_pence} className="text-sm font-semibold" />{canConfirmCandidate(claim, candidate, canManage) && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => receive(candidate)}><Check className="h-4 w-4" />{busy ? 'Working…' : 'Confirm match'}</Button>}</div>
        </li>)}</ul>
      </section>}
      {(claim.receipts ?? []).length > 0 && <details className="border-t pt-3"><summary className="cursor-pointer text-sm font-medium">Credit receipt history</summary><ul className="mt-2 divide-y">{claim.receipts.map(receipt => <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><Link className="font-medium text-primary hover:underline" to={docPath('supplier_credit_note', receipt.credit_id)}>{receipt.number || 'Supplier credit'}</Link><p className="mt-1 text-xs text-muted-foreground">Quantity {receipt.quantity} · {receipt.active ? 'Matched' : 'No longer active'}</p></div><Money value={receipt.money?.gross_pence} /></li>)}</ul></details>}
      {canCancelClaim(claim, canManage) && <div className="border-t pt-3">
        {confirmCancel ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm">Stop waiting for this credit?</p><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirmCancel(false)}>Keep tracking</Button><Button type="button" size="sm" variant="destructive" disabled={busy} onClick={cancel}>{busy ? 'Working…' : 'Cancel tracking'}</Button></div>
          : <button type="button" disabled={busy} className="text-xs text-muted-foreground underline underline-offset-4 disabled:opacity-50" onClick={() => setConfirmCancel(true)}>Cancel tracking</button>}
      </div>}
    </div>
  </article>;
}

export default function ClaimList({ claims, companyId, canManage, onChanged, showBill = false }) {
  return <div className="space-y-4">{claims.map(claim => <ClaimCard key={`${companyId}:${claim.id}`} claim={claim} companyId={companyId} canManage={canManage} onChanged={onChanged} showBill={showBill} />)}</div>;
}
