---
name: #44 relation identity schema gap
description: The approved #44 correction/reversal uniqueness index cannot be applied to the current relation table without an additional schema decision.
---

The approved #44 design requires a correction/reversal identity index containing
`economic_effect_id`, but the current `canonical_journal_relations` table does
not expose that column. The existing relation identity fields are
`company_id`, `original_journal_id`, `related_journal_id`, `relation_type`, and
`idempotency_key`; the economic effect exists on the separate posting-effect
table.

**Why:** Implementing the index exactly as approved would require an unapproved
column/schema change, while substituting a different index would weaken or
change the selected identity contract. Role separation and #44 DDL must stop
until the schema/identity contract is explicitly revised and approved.

**How to apply:** Before retrying #44-RS-01 or #44 implementation, resolve this
gap through an explicit approval package; do not create partial roles/triggers
or broaden the DDL boundary to work around it.