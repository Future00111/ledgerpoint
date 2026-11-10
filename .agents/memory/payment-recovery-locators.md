---
name: Payment recovery locators
description: Browser restart recovery preserves an operation identity, not authority to reconstruct financial intent.
---
Persist only a company-scoped opaque operation reference for cross-reload recovery.
Do not persist amounts or reviewed tokens merely to recreate a retry after reload.
Without the original reviewed command, recovery is read-only and an absent event
remains unknown, not cancelled.

**Why:** A lost response can outlive the page or its permission state. Rebuilding
intent from today's form/configuration could submit different financial effects
or duplicate an original that later commits.

**How to apply:** Resolve the retained reference through authenticated native
company-scoped status lookup. Retrying requires the exact original reviewed
command and current authority; any future cross-session retry design must obtain
that command from an authoritative source, not infer it.

Retain unresolved identities independently rather than in one replaceable browser
slot or an unguarded read-modify-write array.

**Why:** Two tabs can both pass an empty-slot check before either writes. Losing
one reference makes its unknown outcome difficult to recover even when each tab
correctly prevents a second local submission.

**How to apply:** Confirming one event must remove only that identity, and any
remaining unresolved reference must be surfaced before permitting a new write.
