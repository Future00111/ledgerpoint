---
name: Product roadmap gate
description: Ledgerly has an approved governance hierarchy, but implementation and publication remain paused until explicit decision dependencies, including the accounting-core decision pack, are accepted.
---

Decision 1 approved the living hierarchy of Manifesto → Product Principles →
PRD/Product Scope → Technical Architecture → Feature Specifications/Master
Backlog. It does not approve unresolved launch scope or accounting-core design
choices, and it does not authorise implementation. Do not implement backlog
items or publish Ledgerly until the user has reviewed and selected the next
roadmap task. Treat the Living Product Decisions Register as the revisitable
product-direction record below the Master Backlog; it never authorises
implementation on its own. BL-06 and BL-07 additionally require the
pre-implementation accounting-core decision pack to be explicitly resolved and
approved before work begins.

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