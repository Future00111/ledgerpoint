import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Money, JournalLink } from '@/components/accounting/AccountingUI';
import { canConfigurePayments, canPostPayments, recoveryBusy } from './model.mjs';

export function PaymentToolbar({ capabilities, busy, ready, onSetup, onStart }) {
  return <div className="flex flex-wrap items-start gap-2">
    {canConfigurePayments(capabilities) && <Button className="min-h-11" variant="outline" disabled={busy} onClick={onSetup}>Payment setup</Button>}
    {canPostPayments(capabilities) && <Button className="min-h-11" disabled={busy || !ready} onClick={onStart}>Record payment</Button>}
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

export function PaymentRecoveryPanel({ state, capabilities, closing, onCheck, onRetry, onClose, onKeep, onAbandon }) {
  if (!state || state.phase === 'recorded') return null;
  const busy = recoveryBusy(state);
  return <section role="status" aria-live="polite" className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
    <h3 className="font-semibold">{state.phase === 'posting' ? 'Recording the reviewed payment…' : state.phase === 'checking' ? 'Checking payment history…' : 'Payment outcome not yet confirmed'}</h3>
    {!state.readOnly && <p className="break-words">{state.body.reference} · <Money value={state.body.amount_minor} /></p>}
    <p className="break-all text-xs">Payment event reference: {state.body.id}</p>
    {state.phase !== 'posting' && <p>The payment may already be recorded. Check its status before creating another payment. A retry uses the same reviewed payment and cannot create a second event with this reference.</p>}
    {state.check === 'not_found' && <p>Not found in the latest history. The original request may still finish; its outcome remains unknown.</p>}
    {state.error && <p>The latest request did not confirm the outcome{state.error.code ? ` (${state.error.code})` : ''}. This does not establish whether the original recording succeeded.</p>}
    <Link className="underline" to={`/payments?event=${encodeURIComponent(state.body.id)}`}>Open this event in payment history</Link>
    <p className="text-xs">Keep this event reference to check its recorded history after reloading or signing in again. An absent event remains unconfirmed; do not create a replacement payment.</p>
    <p className="text-xs">{state.readOnly ? 'The original review is no longer open. Only status checks are available; do not recreate this payment.' : 'The reviewed details stay frozen while this view is open. After a reload, the saved reference supports status checks only.'}</p>
    <div className="flex flex-wrap gap-2">
      <Button className="min-h-11" variant="outline" disabled={busy} onClick={onCheck}>Check payment status</Button>
      {!state.readOnly && canPostPayments(capabilities) && <Button className="min-h-11" disabled={busy} onClick={onRetry}>Retry same payment</Button>}
    </div>
  </section>;
}
