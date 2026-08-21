---
name: Product roadmap gate
description: Ledgerly has an approved governance hierarchy, but implementation and publication remain paused until explicit decision dependencies, including the accounting-core decision pack, are accepted.
---

Decision 1 approved the living hierarchy of Manifesto → Product Principles →
PRD/Product Scope → Technical Architecture → Feature Specifications/Master
Backlog. DEC-02 approved the initial UK/GBP accounting scope: authoritative
core accounting, VAT preparation, invoices, bills, payments, banking,
reconciliation, and reporting. DEC-03 approves Standard VAT on invoice basis,
controlled source-linked and return-level corrections, and VAT
preparation/export without direct HMRC submission. DEC-04 approves the
accounting-core architecture foundation: canonical normalized append-only
journals, server-side transactional posting, immutable correction history,
deterministic VAT integration, journal-authoritative reporting, company-scoped
capability/audit boundaries, and additive evidence-based migration. Special VAT
schemes, specialist adjustments, and direct HMRC workflows remain future scope.
DEC-04 is architecture approval only: DEC-05 through DEC-22 remain unresolved,
and BL-06/BL-07 remain blocked pending the applicable decisions and an approved
implementation task. Do not implement backlog items or publish Ledgerly until
the user has reviewed and selected the next roadmap task. Treat the Living
Product Decisions Register as the revisitable product-direction record below
the Master Backlog; it never authorises implementation on its own.

**Why:** The existing technical foundation and phase work do not demonstrate
complete, end-to-end product workflows; the user explicitly requires
roadmap-led prioritisation, recorded product decisions, and approved work before
more delivery. The canonical accounting foundation affects every consequential
financial workflow, so unresolved accounting, security, migration, and
operations decisions cannot be silently filled in during implementation. The
approved hierarchy makes those decision boundaries explicit without making them
permanent or bypassable.

**How to apply:** Treat product-gap analysis, roadmap confirmation, decision
status/dependencies, and the selected next task as the gate for future build or
release work. For BL-06/BL-07, also check the accounting-core decision pack for
Lee's recorded approvals. Do not resolve an OPEN, PROVISIONAL, or DEFERRED
decision silently; record the decision update first. Continue to respect
explicit accounting-safety and approval boundaries.