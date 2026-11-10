---
name: Bank opening scope
description: Why the initial opening workflow is limited to bank asset versus explicit equity.
---

Initial bank openings are not a general accounting migration. Require a reviewed
equity counteraccount and the configured payment bank ledger; do not infer a
balancing figure from legacy bank metadata.

**Why:** Receivable/payable and other control-account openings need matching
subledger detail. Posting their nominal balances alone would make financial
reports disagree with customer/supplier history. Legacy bank metadata has never
proved a canonical posting.

**How to apply:** Broader migration support needs its own reviewed subledger
contract. Preserve historical bank identity after setup changes; changing a
current mapping must not reclassify past cash as a party pool or erase cash history.
