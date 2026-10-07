# C4 digest-repair successor — prepared for review

C4 is a successor of repair commit 9d50d4e86696fd18eb7f877c9edfaba710b3572e, whose sole parent is frozen C3 1c26be19295902a38e1939b56ff99ae9a195d3de. The original C3 qualification remains failed; its artifact is retained.

The inherited production repair hashes the runtime orchestrator rather than the CI coordinator. C4 names only refs/heads/tr01/implementation-identity-successor-c4 in the qualification workflow, coordinator, runtime runner, SQL private-run identity check and schema-v2 evidence contract. Activated-main mode is retained. Tests reject coherent C3/C2 aliases, stale approved pins, mismatched identities and invalid evidence.

The manual binding regression now selects C4 for the repaired-source case. Original-defect mode reads all source bytes directly from frozen C3, preserving its original identity and SQL contract. It uses synthetic review metadata and cannot publish accepted GitHub qualification evidence.

## Verification

- Identity and evidence acceptance suite: passed, including new C3 ref/workflow/pin/evidence rejection cases.
- Fresh pinned PostgreSQL 16.15: 6/6 binding regressions passed, including valid binding, forged UUID/nonce, old C3 identity rejection and the actual CLI reaching the private-binding rejection.
- Original byte-exact C3: reproduced the wrong-digest defect; unchanged SQL accepts the valid binding and rejects forged identities.
- Both disposable executions reported all container/network/image/fixture cleanup checks true.
- Library and workspace typechecks passed. Git whitespace checks passed.

## Drizzle observation

The prior log includes SQLSTATE 42830 for accounting_posting_effects. The schema declares the required composite unique index, and the existing coordinator has a narrowly scoped FK/index ordering recovery path (lines 695–720). The failed hosted run reached the later forged-binding probe. This investigation does not establish another schema defect, so application schema, Drizzle config and recovery logic are unchanged. A fresh complete hosted qualification remains necessary; binding-specific review is not canonical posting/concurrency acceptance.

## Live steps still pending

A separate protected-main C4 status producer must pin the exact C4 SHA/tree/single parent, use its own tr01/c4-identity-validation context and TR01_C4_APPROVED_WORKFLOW_SHA, and retain normal owner Environment review. C4 needs a new exact-ref frozen ruleset, one-time immutable publication, successful identity validation, then an exact Environment pin and admission swap from C3 to C4 before one fresh development/disposable qualification.

No immutable C/C2/C3 update, main merge, Environment pin/admission change, bypass, qualification dispatch, or production/Helium access has occurred during preparation. Review publication is not immutable-candidate publication.
