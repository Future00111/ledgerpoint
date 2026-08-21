---
name: Product roadmap gate
description: Ledgerpoint implementation and publication are paused until the product roadmap and explicit decision dependencies are accepted, including the accounting-core decision pack.
---

Do not implement backlog items or publish Ledgerpoint until the user has reviewed
and selected the next roadmap task. Treat the Living Product Decisions Register
as the revisitable product-direction record below the Master Backlog; it never
authorises implementation on its own. BL-06 and BL-07 additionally require the
pre-implementation accounting-core decision pack to be explicitly resolved and
approved before work begins.

**Why:** The existing technical foundation and phase work do not demonstrate
complete, end-to-end product workflows; the user explicitly requires
roadmap-led prioritisation, recorded product decisions, and approved work before
more delivery. The canonical accounting foundation affects every consequential
financial workflow, so unresolved accounting, security, migration, and
operations decisions cannot be silently filled in during implementation.

**How to apply:** Treat product-gap analysis, roadmap confirmation, decision
status/dependencies, and the selected next task as the gate for future build or
release work. For BL-06/BL-07, also check the accounting-core decision pack for
Lee's recorded approvals. Do not resolve an OPEN or DEFERRED decision silently;
record the decision update first. Continue to respect explicit accounting-safety
and approval boundaries.