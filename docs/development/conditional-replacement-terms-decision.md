# Conditional replacement terms — owner decision

On 2026-11-06 the owner selected “Require explicit replacement terms
(recommended)” after reviewing the financial alternatives.

For a corrected original or a prior-credit combination, require explicit
replacement terms. Preserve the original agreement, record the newly agreed
discount and deadline with evidence, and review the resulting payment threshold.
Do not automatically scale the discount, retrospectively qualify earlier
payments, or reset an already-consumed agreement. Unsupported histories continue
to reject safely.

This approves the isolated implementation contract only. It does not enable
public posting, change live data, approve deployment, or constitute independent
accounting review.

## Engineering consequence

The existing original binding is deliberately bound to the original journal's
top transaction. A replacement must NOT overwrite that binding or call its
original-binding function in a later transaction. Use separate append-only
replacement history with its own committed observation and predecessor identity.
Payment evidence must identify the particular replacement in effect when the
new qualifying payment was recorded; old snapshots cannot be relabelled.

The existing original agreement remains permanently consumed if it was ever
consumed, including after compensation. Replacement is not another redemption
path for that original.

The Job3 ordinary corrected-credit candidate remains unchanged. The prior
question about discount policy is now resolved; the remaining work is engineering,
connected acceptance and independent review, not another owner-policy approval.
