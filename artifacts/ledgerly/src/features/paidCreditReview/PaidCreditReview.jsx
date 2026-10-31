import React from 'react';
const amount = value => {const n=BigInt(value);return `£${n/100n}.${(n%100n).toString().padStart(2,'0')}`;};
export default function PaidCreditReview({review}) {
  return <section aria-label="Credit settlement review" className="space-y-2 rounded-lg border p-4 text-sm">
    <h3 className="font-semibold">How this credit will be applied</h3>
    <dl><dt>Full credit</dt><dd>{amount(review.credit_minor)}</dd><dt>Offsets outstanding balance</dt><dd>{amount(review.offset_minor)}</dd>
      <dt>Released to reusable or refundable payment balances</dt><dd>{amount(review.released_minor)}</dd><dt>Original balance remaining</dt><dd>{amount(review.remaining_minor)}</dd></dl>
    {review.releases.map(r=><div key={r.id}><p>{amount(r.amount_minor)} released from payment {r.payment_id}</p><p className="break-all text-xs">Original pool account: {r.pool_account_id}</p></div>)}
    <p>Original cash payments remain unchanged. This posts the credit and releases the listed allocations together. It does not send a refund.</p>
  </section>;
}
