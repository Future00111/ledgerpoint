---
name: Asset presentation and exact revision approvals
description: Library presentation can add metadata-only local history after a document commit.
---

Verify an approval against its named Git object and document bytes, not just
current HEAD. Preserve intervening platform asset-metadata commits.

**Why:** Presenting a proposal in the Library added a metadata-only local
commit after the proposal commit; the owner then approved the earlier exact
proposal revision, whose file bytes remained unchanged.

**How to apply:** Check the named commit, blob/hash, current document equality
and intervening diff. Record approval separately without resetting history or
assuming a later HEAD is the revision the owner approved.
