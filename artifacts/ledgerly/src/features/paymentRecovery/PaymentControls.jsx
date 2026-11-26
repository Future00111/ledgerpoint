import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Money, JournalLink } from '@/components/accounting/AccountingUI';
import { canConfigurePayments, canPostPayments, recoveryBusy } from './model.mjs';

export function PaymentToolbar({ capabilities, busy, ready, onSetup, onStart }) {
  return <div className="flex flex-wrap items-start gap-2">
    {canConfigurePayments(capabilities) && <Button className="min-h-11" variant="outline" disabled={busy} onClick={onSetup}>Payment setup</Button>}
    {canPostPayments(capabilities) && <Button className="min-h-11" disabled={busy || !ready} onClick={onStart}>Record payment</Button>}
    <Button className="min-h-11" variant="outline" disabled={busy} asChild={!busy}>{busy ? <span>Find a recorded payment</span> : <a href="/payments?recover=lost">Find a recorded payment</a>}</Button>
  </div>;
}

export function PaymentHistoryActions({ capabilities, payment, disabled, onStart }) {
  if (!canPostPayments(capabilities) || payment.reversed) return null;
  return <div className="flex flex-wrap gap-2">
    <Button className="min-h-11" disabled={disabled || BigInt(payment.unapplied_minor) === 0n} onClick={() => onStart('allocation', payment)}>Allocate</Button>
    <Button className="min-h-11" variant="outline" disabled={disabled || BigInt(payment.allocated_minor) === 0n} onClick={() => onStart('unallocation', payment)}>Undo allocation</Button>
    <Button className="min-h-11" variant="outline" disabled={disabled || BigInt(payment.unapplied_minor) === 0n} onClick={() => onStart('refund', payment)}>Record refund</Button>
    <Button className="min-h-11" variant="outline" disabled={disabled || payment.unapplied_minor !== payment.amount_minor || BigInt(payment.refunded_minor) > 0n} onClick={() => onStart('reversal', payment)}>Reverse payment</Button>
  </div>;
}

export function PaymentEventHistory({ events, labels }) {
  return events.map(event => <div key={event.id} className="rounded-lg border p-3">
    <div className="flex flex-wrap justify-between gap-2"><span>{event.effective_date} · {labels[event.kind]}</span><Money value={event.amount_minor} /></div>
    <p className="mt-1 break-words text-sm text-muted-foreground">{event.reference}</p><JournalLink id={event.journal_id} />
  </div>);
}

export function PaymentRecoveryPanel({ state, capabilities, closing, onCheck, onRetry, onClose, onKeep, onAbandon, onContinue = () => window.location.assign(window.location.pathname) }) {
  if (!state || state.phase === 'recorded') return null;
  if (state.phase === 'discovery') return <section role="status" aria-live="polite" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
    <h3 className="font-semibold">Find a recorded payment after losing its reference</h3>
    <p>Check payments recorded by your signed-in account in this company. Select the exact event you recognise from its reference, date and amount. Nothing is selected automatically and this check never records a payment.</p>
    <p>If your event is missing or you cannot distinguish it from another, its outcome remains unknown. It may still be processing. Do not create a replacement payment.</p>
    <Button className="min-h-11" variant="outline" disabled={state.loading} onClick={() => state.discover()}>{state.loading ? 'Checking recorded payments…' : 'Check my recorded payments'}</Button>
    {state.error && <p>History could not confirm the outcome{state.error.code ? ` (${state.error.code})` : ''}. Ordinary payment recording remains locked.</p>}
    {state.candidates?.length === 0 && <p>No recorded events found for your account in this company. This does not prove that a missing payment failed.</p>}
    {state.hasMore && <p>Pending attempts are shown first, followed by the latest 100 recorded events. Older recorded events remain unconfirmed here.</p>}
    {state.candidates?.map(receipt => <div key={receipt.id} className="space-y-2 rounded border p-3">
      <p>{receipt.status === 'pending' ? 'Pending · ' : 'Recorded · '}{receipt.effective_date} · {receipt.party_type} {receipt.kind} · <Money value={receipt.amount_minor} /></p>
      <p className="break-words">{receipt.reference}</p><p className="break-all text-xs">Event: {receipt.id}</p>
      <Button className="min-h-11" variant="outline" disabled={state.loading} onClick={() => state.selectReceipt(receipt.id)}>This is my event — verify status</Button>
    </div>)}
  </section>;
  const busy = recoveryBusy(state);
  return <section role="status" aria-live="polite" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
    <h3 className="font-semibold">{state.phase === 'resolving' ? 'Closing the selected attempt…' : state.phase === 'posting' ? 'Recording the reviewed payment…' : state.phase === 'checking' ? 'Checking payment history…' : state.check === 'no_effect' ? 'Attempt closed without effect' : 'Payment outcome not yet confirmed'}</h3>
    {!state.readOnly && <p className="break-words">{state.body.reference} · <Money value={state.body.amount_minor} /></p>}
    <p className="break-all text-xs">Payment event reference: {state.body.id}</p>
    {state.phase !== 'posting' && state.check !== 'no_effect' && <p>The payment may already be recorded. Check its status before creating another payment. A retry uses the same reviewed payment and cannot create a second event with this reference.</p>}
    {state.check === 'pending' && <p>The server received this attempt; its outcome is still pending. Check again using this same reference.</p>}
    {state.check === 'no_effect' && <p>This attempt was explicitly closed with no recorded effect. Continue only after a fresh status check; the next payment needs a new review and reference.</p>}
    {state.check === 'not_found' && <p>Not found in the latest history. The original request may still finish; its outcome remains unknown.</p>}
    {state.error && <p>The latest request did not confirm the outcome{state.error.code ? ` (${state.error.code})` : ''}. This does not establish whether the original recording succeeded.</p>}
    <Link className="underline" to={`/payments?event=${encodeURIComponent(state.body.id)}`}>Open this event in payment history</Link>
    <p className="text-xs">Keep this event reference to check its recorded history after reloading or signing in again. An absent event remains unconfirmed; do not create a replacement payment.</p>
    <p className="text-xs">{state.readOnly ? (state.binding ? 'The original review cannot be replayed. You can check status or explicitly resolve a verified pending attempt before starting a new review.' : 'Only status checks are available until this attempt is verified. The original review cannot be replayed.') : 'The reviewed details stay frozen while this view is open. After a reload, the saved reference supports status checks only.'}</p>
    <div className="flex flex-wrap gap-2">
      <Button className="min-h-11" variant="outline" disabled={busy} onClick={onCheck}>Check payment status</Button>
      {!state.readOnly && !state.confirming && state.check !== 'no_effect' && canPostPayments(capabilities) && <Button className="min-h-11" disabled={busy} onClick={onRetry}>Retry same payment</Button>}
    </div>
    {canPostPayments(capabilities) && state.selectTerminal && state.check === 'pending' && !state.confirming && <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => state.selectTerminal(capabilities)}>Select this attempt to close without effect</Button>}
    {state.confirming && <div className="space-y-3 rounded border p-3">
      <p className="font-semibold">Close this exact attempt without recording a payment?</p>
      <p>{state.binding?.reference} · {state.binding?.party_type} {state.binding?.kind} · <Money value={state.binding?.amount_minor} /></p>
      <p>This permanently prevents this reference from recording later. If it has already recorded, its recorded outcome takes precedence. This does not reverse a payment or move money.</p>
      <Button className="min-h-11" variant="outline" disabled={busy} onClick={() => state.cancelTerminal()}>Keep checking this attempt</Button>
      {canPostPayments(capabilities) && <Button className="min-h-11" disabled={busy} onClick={() => state.confirmTerminal(capabilities)}>Confirm close without effect</Button>}
    </div>}
    {state.check === 'no_effect' && state.binding && canPostPayments(capabilities) && <Button className="min-h-11" disabled={busy} onClick={() => state.continueFresh(capabilities, onContinue)}>Continue to a fresh payment review</Button>}
  </section>;
}
