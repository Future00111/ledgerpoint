---
name: Test source freeze
description: Keep migration source and registry frozen throughout disposable runs.
---

Do not edit source or a migration manifest while a disposable test run is active.

**Why:** Partial-schema cases reload migration inputs later in the run. Updating
a migration before its manifest can trip the checksum guard even after earlier
tests passed, producing a mixed-source run that cannot qualify either revision.

**How to apply:** Stop or finish the run first; preserve its evidence, commit the
coherent source and manifest, then run final validation against that frozen tree.
