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

## Final preparation readback

Candidate: 273f714c876260636346b7fbcc588224e9795141

Tree: 168f81192d1fea635cd3c038e6be3a709ab11a82

Sole parent: 9d50d4e86696fd18eb7f877c9edfaba710b3572e

Producer: f03abf3fc7c481ed50ecfb30fc5275b8f2013849; sole parent exact main 65f3453c29f1eb1057bc66edc0cc7de508e87c2d

Review PRs: https://github.com/Future00111/ledgerpoint/pull/14 and https://github.com/Future00111/ledgerpoint/pull/15

The exact C4 Dockerfile build and 3/3 offline runtime checks subsequently passed. Producer contract/source-fixture suite: 26/26 passed with zero skips in a sanitized CI-like environment. The initial local producer fixture correctly refused Replit database/target environment variables; only the test process environment was sanitized, with no changes to its fail-closed production checks.

Read-only GitHub preflight confirmed zero repository and qualification-Environment secrets; existing admission remains main+C3 with the C3 candidate pin. Proposed C4 ruleset and exact identity/control evidence are retained alongside this report.
