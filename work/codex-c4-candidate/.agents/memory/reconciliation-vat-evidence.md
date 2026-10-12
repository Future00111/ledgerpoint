---
name: Reconciliation VAT evidence
description: Rules for resolving VAT review status during transaction matching without treating bank-feed data as tax evidence.
---

When a transaction has a credible matched invoice or bill, derive VAT review status from that source document. A null or missing bank-feed VAT rate alone must not downgrade a source-backed exact match to VAT review. Where no credible source treatment exists, missing VAT evidence must remain a VAT review.

**Why:** Imported bank transactions normally omit tax rate metadata. Treating that omission as decisive blocks ordinary source-backed matching, while treating it as harmless without a source creates an unsafe VAT decision.

**How to apply:** Keep bank transactions out of VAT return box calculations. In new matching paths, pass credible matched documents into VAT assessment; use bank metadata only as an advisory signal when authoritative source treatment cannot be determined.