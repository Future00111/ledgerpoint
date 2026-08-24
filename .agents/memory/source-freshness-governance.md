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