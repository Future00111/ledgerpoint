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
DEC-04 is architecture approval only. DEC-05 approves Option B: server-side
capabilities with conservative role presets, including active company scope,
posted-journal immutability, AI capability inheritance, auditable actions, and
conservative migration. DEC-06 approves the financial-year policy: 1 April to
31 March is the UK default, company-specific starts are supported before
posting, historical boundaries cannot be rebased through ordinary settings, and
changes require privileged audit controls. DEC-07 approves contiguous
company-scoped monthly periods, automated generation, OPEN/CLOSED states,
server-side posting-date assignment, audited close/reopen, and no direct
closed-period posting bypass. DEC-08 approves reporting-only year-end
treatment: no automatic closing or retained-earnings journals, canonical
history remains unchanged, and completion is an auditable derived condition.
DEC-09 approves the versioned, company-copied UK small-business Chart of
Accounts policy: six primary account types, stable identities independent of
names/codes, controlled lifecycle, no destructive deletion after use, no launch
account merging, protected system-account candidates, and journal-authoritative
reporting. DEC-10 approves protected company-scoped AR, AP, bank/cash, Output
VAT, and Input VAT mappings, with prospective-only capability-gated changes and
historical posting identity preserved. DEC-11 approves immutable,
company-scoped, effective-dated versions for material accounting configuration:
posting-date selection, no ordinary backdating over history, resolved account
IDs and version context retained on postings, and immutable audit. DEC-12
approves distinct payment evidence, accounting payment, allocation, and
settlement concepts; one canonical payment posting; non-duplicating,
many-to-many allocation; derived settlement; and immutable payment/allocation
history. DEC-13 approves no-loss excess handling: customer excess is a
customer-credit liability, supplier excess is a supplier-prepayment asset, and
known-party payments may exist before allocation without negative documents.
DEC-14 approves a dedicated unapplied-cash workspace with contextual entry
points, deterministic eligibility, explicit user confirmation, AI suggestions
only, and no silent automatic allocation at launch. DEC-15 approves controlled
customer refunds and supplier refund receipts only from approved refundable
party balances, with explicit approval, amount limits, canonical cash journals,
reconciliation, immutable correction, and no silent launch automation. DEC-16
approves no separate user-facing payment-on-account feature, workflow,
navigation item, accounting object, or journal type at launch; it relies on the
approved payment, credit/prepayment, unapplied-cash, allocation, and refund
foundation. DEC-17 through DEC-22 remain unresolved, and BL-06/BL-07 remain blocked
pending the applicable decisions and an approved implementation task.
Do not implement
backlog items or publish Ledgerly until the user has reviewed and selected the
next roadmap task. Treat the Living Product Decisions Register as the
revisitable product-direction record below the Master Backlog; it never
authorises implementation on its own.

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