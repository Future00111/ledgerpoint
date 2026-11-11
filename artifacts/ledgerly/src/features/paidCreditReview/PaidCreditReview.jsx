import React from 'react';
const amount = value => {const n=BigInt(value);return `£${n/100n}.${(n%100n).toString().padStart(2,'0')}`;};
export default function PaidCreditReview({review,conditional=false,current=false}) {
  return <section aria-label={current ? "Conditional discount posting review" : conditional ? "Conditional credit eligibility preview" : "Credit settlement review"} className="space-y-2 rounded-lg border p-4 text-sm">
    <h3 className="font-semibold">{current ? 'Review conditional discount' : conditional ? 'Conditional eligibility preview' : 'How this credit will be applied'}</h3>
    {conditional && <>
      <p>{current ? 'Confirm to post this discount against the unpaid balance. No paid cash is released. Eligibility is checked again at posting.' : 'Eligible at this review. Posting is unavailable; this preview makes no changes.'}</p>
      <dl><dt>Payment threshold</dt><dd>{amount(review.conditional_admission.threshold_minor)}</dd>
        <dt>Qualifying payments</dt><dd>{amount(review.conditional_admission.qualifying_minor)}</dd>
        <dt>Payment deadline</dt><dd>{review.conditional_admission.deadline}</dd></dl>
    </>}
    <a className="underline" target="_blank" rel="noopener noreferrer" href={`${review.original_kind==='sales_invoice'?'/invoices':'/bills'}/${encodeURIComponent(review.original_id)}`}>Original {review.original_number || 'document'}</a>
    <dl><dt>Full credit</dt><dd>{amount(review.credit_minor)}</dd><dt>Offsets outstanding balance</dt><dd>{amount(review.offset_minor)}</dd>
      <dt>{conditional ? 'Potential payment balance release' : 'Released to reusable or refundable payment balances'}</dt><dd>{amount(review.released_minor)}</dd><dt>Original balance remaining</dt><dd>{amount(review.remaining_minor)}</dd></dl>
    {review.releases.map(r=><div key={r.id}><p>{amount(r.amount_minor)} {conditional ? 'would be released from payment' : 'released from payment'} {r.payment_reference || r.payment_id}</p>
      <p>Unapplied balance: {amount(r.before_unapplied_minor)} → {amount(r.after_unapplied_minor)}</p>
      <a className="underline" target="_blank" rel="noopener noreferrer" href={`/accounting/journals/${encodeURIComponent(r.payment_journal_id)}`}>View original payment journal</a>
      <p className="break-all text-xs">Payment ID: {r.payment_id}</p><p className="break-all text-xs">Original pool account: {r.pool_account_id}</p></div>)}
    <p>{conditional ? 'No credit has been posted and no allocations have been released. No refund is sent.' : 'Original cash payments remain unchanged. This posts the credit and releases the listed allocations together. It does not send a refund.'}</p>
  </section>;
}

export function DiscountRecoveryNotice({pending,busy,onRecover}) {
  if(!pending)return null;
  return <section role="status" aria-label="Conditional discount recovery"><p>A conditional discount outcome needs recovery. Do not submit another discount.</p><button type="button" disabled={busy || pending.invalid} onClick={onRecover}>Recover discount outcome</button></section>;
}
