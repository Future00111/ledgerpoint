import { Button } from '@/components/ui/button';
import { Money, JournalLink } from '@/components/accounting/AccountingUI';
import { canConfigurePayments, canPostPayments, recoveryBusy } from './model.mjs';

export function PaymentToolbar({ capabilities, busy, ready, onSetup, onStart }) {
  return <div className="flex items-start gap-2">
    {canConfigurePayments(capabilities) && <Button variant="outline" disabled={busy} onClick={onSetup}>Payment setup</Button>}
    {canPostPayments(capabilities) && <Button disabled={busy || !ready} onClick={onStart}>Record payment</Button>}
  </div>;
}

export function PaymentHistoryActions({ capabilities, payment, disabled, onStart }) {
  if (!canPostPayments(capabilities) || payment.reversed) return null;
  return <div className="flex flex-wrap gap-2">
    <Button disabled={disabled || BigInt(payment.unapplied_minor) === 0n} onClick={() => onStart('allocation', payment)}>Allocate</Button>
    <Button variant="outline" disabled={disabled || BigInt(payment.allocated_minor) === 0n} onClick={() => onStart('unallocation', payment)}>Undo allocation</Button>
    <Button variant="outline" disabled={disabled || BigInt(payment.unapplied_minor) === 0n} onClick={() => onStart('refund', payment)}>Record refund</Button>
    <Button variant="outline" disabled={disabled || payment.unapplied_minor !== payment.amount_minor || BigInt(payment.refunded_minor) > 0n} onClick={() => onStart('reversal', payment)}>Reverse payment</Button>
  </div>;
}

export function PaymentEventHistory({ events, labels }) {
  return events.map(event => <div key={event.id} className="rounded-lg border p-3">
    <div className="flex justify-between"><span>{event.effective_date} · {labels[event.kind]}</span><Money value={event.amount_minor} /></div>
    <p className="text-sm text-muted-foreground">{event.reference}</p><JournalLink id={event.journal_id} />
  </div>);
}

export function PaymentRecoveryPanel({ state, capabilities, closing, onCheck, onRetry, onClose, onKeep, onAbandon }) {
  if (!state || state.phase === 'recorded') return null;
  const busy = recoveryBusy(state);
  return <section role="status" aria-live="polite" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
    <h3 className="font-semibold">{state.phase === 'posting' ? 'Recording the reviewed payment…' : state.phase === 'checking' ? 'Checking payment history…' : 'Payment outcome not yet confirmed'}</h3>
    <p>{state.body.reference} · <Money value={state.body.amount_minor} /></p>
    <p className="break-all text-xs">Payment event reference: {state.body.id}</p>
    {state.phase !== 'posting' && <p>The payment may already be recorded. Check its status before creating another payment. A retry uses the same reviewed payment and cannot create a second event with this reference.</p>}
    {state.check === 'not_found' && <p>Not found in the latest history. The original request may still finish; its outcome remains unknown.</p>}
    {state.error && <p>The latest request did not confirm the outcome{state.error.code ? ` (${state.error.code})` : ''}. This does not establish whether the original recording succeeded.</p>}
    <p className="text-xs">The reviewed details stay frozen while this view is open. Leaving, reloading or switching company clears this recovery view; it does not cancel a payment.</p>
    {closing ? <div role="alert" className="space-y-3 border-t border-amber-300 pt-3">
      <p className="font-medium">Close this view with the outcome still unknown?</p>
      <p>Closing does not cancel, delete or reverse anything. Check payment history before recording this payment again.</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={onKeep}>Keep checking</Button><Button variant="outline" disabled={busy} onClick={onAbandon}>Close view — outcome unknown</Button></div>
    </div> : <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy} onClick={onCheck}>Check payment status</Button>
      {canPostPayments(capabilities) && <Button disabled={busy} onClick={onRetry}>Retry same payment</Button>}
      <Button variant="ghost" disabled={busy} onClick={onClose}>Close recovery view</Button>
    </div>}
  </section>;
}
