# Job 1: preserve completed surplus refunds during compensation

Unintegrated P01-03 candidate, dependent on UNREVIEWED compensation candidate
2212b74816f2f4d9913bb611a58668a8ae5c5094. No coordinator acceptance or lease.

Supported for both customer and supplier: original gross 12000, cash 12000,
conditional credit 1200 releases 1200 from that payment, native surplus refund
100. The original then has 10800 allocated, zero outstanding, and the payment
has 1100 unapplied. A reviewed full credit compensation plus native unallocation
1000 commits atomically: allocated 9800, outstanding 2200, unapplied 2100.
Refund 100 and its cash journal remain unchanged. Compensation changes cash by
zero. The discount consumption remains permanent.

Only completed native surplus refunds on the qualifying payment are admitted.
Native refund capacity, company/party scope and immutable payment journal rules
remain unchanged. Reconcile parent amount = applied + unapplied + refunded;
reject inconsistent or negative history. Capture preserved refund identities,
amounts and projected pool in the review. Existing event snapshot hashing makes
any subsequent refund invalidate that review, even though a newly reviewed
operation may still succeed. Effective date cannot precede any related event.

No refund is reversed, reclaimed, duplicated or silently offset. Cross-document
allocations, full cash reversal, prior-credit and corrected-original expansion
remain rejected. Neither public conditional posting gate nor the native
allocation/refund engine is changed. The public UI remains review-only.

Acceptance: both parties; existing refund records/journals byte-equivalent;
balanced inverse-credit and native unallocation journals only; historical
cutoffs; unchanged cash; permanent consumption; identical replay and conflict;
stale review after another refund; concurrent refund/compensation serialization;
failure injection at all four stages; closed periods and cross-company denial.
