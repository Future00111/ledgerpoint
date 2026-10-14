---
name: GitHub merge readback
description: Distinguish a merged PR's recorded base from current main and actual merge identity.
---

Treat the PR's recorded base SHA, current branch ref and actual merged commit
as separate observations. Never infer current main from `pulls/N.base.sha`,
or actual G from an unmerged PR's synthetic merge commit.

**Why:** A normally merged PR retained the reviewed pre-merge base SHA in its
REST record, while the main ref correctly advanced to the actual merge.
Equating those fields caused a false postmerge drift finding.

**How to apply:** Read merged state/actual merge SHA from the PR and current
main from its ref; verify actual G's ordered parents, full tree and ancestry
against approved identities. Preserve failed-checker receipts rather than
retrying live actions or rewriting historical evidence.
