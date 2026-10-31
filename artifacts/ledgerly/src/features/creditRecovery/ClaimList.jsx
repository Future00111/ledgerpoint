import { useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, ChevronDown, Clock3, FileCheck2, PackageCheck } from 'lucide-react';
import { creditRecovery } from '@/api/creditRecovery.mjs';
import { docPath } from '@/api/accountingDocuments.mjs';
import { Button } from '@/components/ui/button';
import { Money, ErrorBox, today } from '@/components/accounting/AccountingUI';
import { canCancelClaim, canConfirmCandidate, claimStatus, createRequestBook, isOverdue } from './model.mjs';
import { reviewableCandidates, followUpPresentation } from './queuePresentation.mjs';
import { useMutationScope } from './useCreditClaims';

export function ClaimStatus({ claim }) {
  const status = claimStatus(claim);
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${status.style}`}>{status.label}</span>;
}

/** Pure queue row; the mounted owner below retains mutation scope and retry identity. */
export function ClaimRowView({ claim, canManage, showBill, expanded, detailId, busy = false, error, message,
  confirmCancel = false, onToggle, onReceive, onCancel, onConfirmCancel, onChanged, date = today() }) {
  const candidates = claim.candidates ?? [];
  const matches = reviewableCandidates(claim);
  const overdue = isOverdue(claim, date);
  const followUp = followUpPresentation(claim, date);
  return <article className="bg-card" aria-label={`Credit for ${claim.description}`} data-testid={`credit-claim-${claim.id}`}>
    <div className={`grid gap-4 p-4 sm:px-6 sm:py-5 ${showBill ? 'xl:grid-cols-[minmax(0,1.6fr)_minmax(240px,1fr)_180px] xl:items-center' : ''}`}>
      <div className="min-w-0">
        {showBill && <p className="mb-1.5 text-xs font-medium text-muted-foreground">{claim.party_name} <span aria-hidden="true">· </span><Link className="text-primary hover:underline" to={docPath('purchase_bill', claim.bill_id)}>{claim.bill_number || 'Original bill'}<ArrowUpRight className="ml-0.5 inline h-3 w-3" aria-hidden="true" /></Link></p>}
        <h3 className="break-words text-sm font-semibold leading-6">{claim.description}</h3>
        <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{claim.part_reference && <><span className="font-medium text-foreground">{claim.part_reference}</span> · </>}{claim.return_reference ? `Return ${claim.return_reference}` : 'No return reference'}{claim.job_reference && <> · {claim.job_reference}</>}</p>
        <p className="mt-1 text-xs text-muted-foreground">Quantity {claim.quantity} · Received {claim.received_quantity}{Number.isInteger(claim.original_line_ref) && <> · Bill line {claim.original_line_ref + 1}</>}</p>
        <div className="mt-3 rounded-lg border border-dashed px-3 py-2 text-xs" aria-label="Credit follow-up guidance"><p><span className="font-medium">{followUp.priority}</span> · {followUp.ageLabel}</p><p className="mt-1 text-muted-foreground">Suggested next step: {followUp.next}. No reminder is sent from this tracker.</p></div>
      </div>
      <dl className="grid grid-cols-3 gap-3 rounded-xl bg-muted/40 px-3 py-3 text-sm">
        {[['Expected', claim.expected?.gross_pence], ['Received', claim.received?.gross_pence], ['Still waiting', claim.remaining?.gross_pence]].map(([label, amount]) => <div key={label} className="min-w-0"><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className={`mt-1 break-words tabular-nums ${label === 'Still waiting' ? 'font-semibold text-primary' : 'font-medium'}`}><Money value={amount} /></dd></div>)}
      </dl>
      <div className={`flex flex-wrap items-center justify-between gap-3 ${showBill ? 'xl:flex-col xl:items-end' : ''}`}>
        <div className={`flex flex-wrap items-center gap-2 ${showBill ? 'xl:justify-end' : ''}`}><ClaimStatus claim={claim} />{overdue && <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-800"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />Overdue</span>}</div>
        <Button type="button" variant={matches.length ? 'secondary' : 'ghost'} size="sm" className="min-h-11" aria-expanded={expanded} aria-controls={detailId} disabled={busy} onClick={onToggle}>
          {matches.length > 0 && <FileCheck2 className="h-4 w-4" aria-hidden="true" />}{expanded ? 'Hide details' : matches.length ? `Review ${matches.length === 1 ? 'match' : `${matches.length} matches`}` : 'View details'}<ChevronDown className={`h-4 w-4 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </Button>
      </div>
    </div>
    {expanded && <div id={detailId} className="space-y-5 border-t bg-muted/20 px-4 py-5 sm:px-6" aria-label={`Details for ${claim.description}`}>
      <div className="grid gap-5 lg:grid-cols-2">
        <section><h4 className="workspace-kicker">Return details</h4><dl className="mt-3 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2">
          {[["Reason", claim.reason], ["Return reference", claim.return_reference], ["Part reference", claim.part_reference], ["Job / vehicle", claim.job_reference], ["Returned on", claim.returned_on], ["Expected by", claim.expected_by]].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}
        </dl></section>
        <section className="rounded-xl border bg-card p-4"><h4 className="workspace-kicker">Original credit expectation</h4><p className="mt-3 text-sm">Net <Money value={claim.expected?.net_pence} /> + VAT <Money value={claim.expected?.vat_pence} /></p><p className="mt-2 text-xs leading-5 text-muted-foreground">Queue amounts include VAT and come from the original bill. Tracking an item does not change the bill balance.</p></section>
      </div>
      {claim.status === 'needs_review' && !claim.cancelled && <p role="status" className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-950">The received credit needs review. Check quantities and amounts against the original item before closing the difference.</p>}
      {candidates.length > 0 && !claim.cancelled && <section className="overflow-hidden rounded-xl border border-primary/20 bg-card" aria-label="Possible credit matches">
        <div className="flex items-start gap-3 border-b bg-primary/5 p-4"><FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" /><div><h4 className="text-sm font-semibold">{candidates.length === 1 ? 'Possible credit match' : 'Possible credit matches'}</h4><p className="mt-1 text-xs leading-5 text-muted-foreground">Open the incoming credit and check its line before confirming. Matching updates this tracker only; a draft credit is never counted as received.</p></div></div>
        <ul className="divide-y px-4">{candidates.map(candidate => <li key={`${candidate.credit_id}:${candidate.credit_line_ref}`} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div><Link className="text-sm font-medium text-primary hover:underline" to={docPath('supplier_credit_note', candidate.credit_id)}>{candidate.number || 'Supplier credit'}<ArrowUpRight className="ml-1 inline h-3 w-3" aria-hidden="true" /></Link><p className="mt-1 text-xs text-muted-foreground">Line {candidate.credit_line_ref + 1} · Quantity {candidate.quantity} · {candidate.status === 'posted' ? 'Posted credit' : 'Draft — review and post the credit first'}</p></div>
          <div className="flex flex-wrap items-center gap-3"><Money value={candidate.money?.gross_pence} className="text-sm font-semibold" />{canConfirmCandidate(claim, candidate, canManage) && <Button type="button" size="sm" className="min-h-11" disabled={busy} onClick={() => onReceive(candidate)}><Check className="h-4 w-4" aria-hidden="true" />{busy ? 'Working…' : 'Confirm match'}</Button>}</div>
        </li>)}</ul>
      </section>}
      {!candidates.length && !claim.cancelled && claim.status !== 'received' && <p className="flex items-center gap-2 rounded-xl bg-card p-4 text-sm text-muted-foreground"><PackageCheck className="h-4 w-4 shrink-0" aria-hidden="true" />No possible credit matches yet. Incoming credits will appear here when available.</p>}
      {(claim.receipts ?? []).length > 0 && <section className="rounded-xl border bg-card p-4" aria-label="Credit receipt history"><h4 className="text-sm font-semibold">Credit receipt history</h4><ul className="mt-2 divide-y">{claim.receipts.map(receipt => <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><Link className="font-medium text-primary hover:underline" to={docPath('supplier_credit_note', receipt.credit_id)}>{receipt.number || 'Supplier credit'}</Link><p className="mt-1 text-xs text-muted-foreground">Quantity {receipt.quantity} · {receipt.active ? 'Matched' : 'No longer active'}</p></div><Money value={receipt.money?.gross_pence} /></li>)}</ul></section>}
      {canCancelClaim(claim, canManage) && <div className="border-t pt-4">
        {confirmCancel ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm">Stop waiting for this credit?</p><Button type="button" size="sm" variant="outline" className="min-h-11" disabled={busy} onClick={() => onConfirmCancel(false)}>Keep tracking</Button><Button type="button" size="sm" variant="destructive" className="min-h-11" disabled={busy} onClick={onCancel}>{busy ? 'Working…' : 'Cancel tracking'}</Button></div>
          : <button type="button" disabled={busy} className="min-h-11 rounded-md px-2 text-xs text-muted-foreground underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50" onClick={() => onConfirmCancel(true)}>Cancel tracking</button>}
      </div>}
    </div>}
    {(error || message) && <div className="space-y-2 px-4 pb-4 sm:px-6"><ErrorBox error={error} onRetry={onChanged} />{error && <p className="text-xs text-muted-foreground">If the result was uncertain, retry the same action. It uses the same request reference to avoid recording it twice.</p>}{message && <p role="status" className="rounded-lg bg-primary/5 p-3 text-sm text-primary">{message}</p>}</div>}
  </article>;
}

function ClaimRow({ claim, companyId, canManage, onChanged, showBill }) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [message, setMessage] = useState('');
  const detailId = useId();
  const requests = useRef(createRequestBook());
  const scope = useMutationScope();
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
      setMessage('Match recorded. The remaining credit is shown in this row.');
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
  return <ClaimRowView claim={claim} canManage={canManage} showBill={showBill} expanded={expanded} detailId={detailId}
    busy={busy} error={error} message={message} confirmCancel={confirmCancel} onToggle={() => { if (!busy) setExpanded(value => !value); }}
    onReceive={receive} onCancel={cancel} onConfirmCancel={setConfirmCancel} onChanged={onChanged} />;
}

export default function ClaimList({ claims, companyId, canManage, onChanged, showBill = false }) {
  return <div className="divide-y">{claims.map(claim => <ClaimRow key={`${companyId}:${claim.id}`} claim={claim} companyId={companyId} canManage={canManage} onChanged={onChanged} showBill={showBill} />)}</div>;
}
