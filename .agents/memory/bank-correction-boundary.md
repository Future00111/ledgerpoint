---
name: Bank correction boundary
description: Unmatching releases capacity but preserves historical bank identity.
---

Correcting a match releases only that immutable receipt's matched capacity,
not the historical bank-to-ledger assignment.

**Why:** The review identified that filtering assignment evidence to active
matches could implicitly reassign a bank and change historical cash identity.
Preserving the existing assignment is the conservative scope; reassignment
needs a separate explicit rule, not an accidental consequence of unmatching.

**How to apply:** Use active matches for capacity and reversal eligibility, but
retain original historical receipts/openings for bank identity. Do not claim
correction can repair a wrongly assigned bank ledger.
