---
name: Batch approval freshness
description: The atomic freshness rule for high-confidence reconciliation batch approvals.
---

Any reconciliation batch approval must revalidate and lock the exact selected analysis record inside the same database transaction as its invoice/bill and bank transaction writes.

**Why:** A preflight eligibility check alone can become stale when a re-analysis, rejection, or new evidence changes the pending recommendation between the check and the accounting write.

**How to apply:** Pass the analysis identity and the eligibility requirements (current pending state, confidence threshold, exception flags, and matched evidence) into the protected approval service. Refuse the write if its conditional in-transaction validation no longer holds.