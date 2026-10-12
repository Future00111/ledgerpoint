---
name: Source-freshness governance
description: The decision-placement boundary for Ledgerly’s cross-cutting source-freshness and posting-safety contract.
---

Source freshness is a cross-cutting posting-safety contract for every
consequential action, not a new payment/allocation rule. It is not part of
DEC-12 as that approved payment policy is currently written.

**Why:** DEC-12 intentionally governs payment evidence, payments, allocations,
settlement, and duplicate-free cash effects, while source freshness applies
equally to invoices, VAT, configuration, periods, reconciliation, AI, queues,
migration, refunds, and other consequential commands. Silently treating it as
already decided by DEC-12 would broaden policy without an explicit owner
decision.

**How to apply:** Before authorising a consequential implementation task, record
which existing decision owns the cross-cutting contract and whether a narrowly
scoped DEC-12 boundary amendment is needed for payment/allocation-specific
application. Do not create a new DEC number just to make that placement, and do
not treat a prior approval or recommendation as a waiver of final
server-side revalidation.

For a consequential accounting write, “final revalidation” means an
authoritative lock or conditional-version check that remains valid through the
same transaction as persistence; an ordinary provider read earlier in a
transaction is not sufficient.

**Why:** Context, membership, source state, account eligibility, and period or
configuration versions can change between an ordinary read and commit. A
fail-closed posting boundary must not claim a safety guarantee it cannot
enforce.

**How to apply:** Require source and posting-context providers to document the
lock or version-precondition they use before enabling production posting. If
that contract is unavailable, keep the command disabled rather than replacing
the check with a best-effort fixture or ambient lookup.