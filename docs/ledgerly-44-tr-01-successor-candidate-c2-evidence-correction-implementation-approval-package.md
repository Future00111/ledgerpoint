# TR-01 C2 evidence correction — implementation approval package

**Date:** 2026-09-25
**Status:** NON-EXECUTABLE PACKAGE — INDEPENDENT PACKAGE REVIEW FAIL
(LITERAL C2 REF NOT APPROVED); FURTHER DESIGN DECISION REQUIRED
**Design approval:** `docs/ledgerly-44-tr-01-successor-candidate-c2-evidence-correction-design-scope-approval-record.md`
**Source proposal:** `docs/ledgerly-44-tr-01-successor-candidate-evidence-acceptance-correction-proposal.md`

This document specifies a future correction; it is not an instruction to
edit code, install dependencies, create commits or branches, configure
GitHub, run qualification, or contact any database. The historic
`C=d292f3a64c6253e022b40de8cf055f3e722ff1ea` and its protected
`refs/heads/tr01/implementation-identity-candidate` remain unchanged,
unqualified and non-authoritative. C2 must be a new immutable normal
descendant of C, not a rewritten C or an unrelated audit-snapshot root.

## 1. Exact implementation inventory and actions

Only the following six paths may differ as the **implementation correction
from C to C2**. The approval record gives each path's purpose, why,
qualification impact, and zero accounting-runtime impact.

1. `docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json`
   - For `result: "passed"`, require `binding.sourceDigests` and exactly
     `sourceTree`, `applicationSchema`, `drizzleConfig`, `securityOverlay`,
     `runControlSql`, `coordinator`, `testSources`, `lockfile`, `workflow`,
     and `orchestrator`. Constrain each to lowercase SHA-256 hex; deny
     unknown and legacy map keys. Preserve the ability to emit failed
     preflight evidence without a completed binding; any supplied digest
     map must still have the exact shape.
   - After explicit approval of the literal C2 ref, set all
     candidate-only `ci.sourceRef`, `binding.ciSourceRef`,
     `ci.workflowRef` and conditional-ref constraints to that single
     exact approved ref. The proposed literal below is **not yet
     authorized**.
     Preserve main/activated identity, version 2, additional-property
     rejection, and all non-digest evidence constraints.
2. `scripts/ci/run-ledgerly-canonical-postgresql.mjs`
   - Compare every passed-evidence digest to independently obtained
     expected values from verified roots: workflow-file SHA-256 at
     workflow-root S; named implementation-file hashes and deterministic
     tracked-file source tree at implementation-root C2. Preserve the
     manifest's approved path ordering/hash algorithm and check its
     source-tree value independently. Require
     `binding.sourceTreeSha256=sourceDigests.sourceTree=verified C2 tree`.
   - Do not accept an expected map copied from the evidence, a shared
     mutable object alias of `binding.sourceDigests`, or a caller-provided
     unverified manifest as an independent source. Authenticate checkout
     HEADs, full SHAs, clean state, protected ref, candidate S=C2 or
     activated C2-ancestor-of-S, and available verified roots before
     accepting passed evidence. Reject missing/mismatched expectations
     rather than falling back to evidence values. A separately downloaded
     evidence artifact is not self-authenticating.
   - Keep failure-evidence reporting possible when preflight ends before
     trusted roots/binding exist; never label that evidence passed. Make
     the actual acceptance function safe to exercise directly from the
     focused test without invoking Docker, the runner, or cleanup. Align
     candidate-mode exact-ref preflight/acceptance with the approved C2
     ref, retaining exact main/activated behavior. Do not change the
     producer's digest algorithm unless independently demonstrated broken
     and separately approved.
3. `scripts/ci/run-ledgerly-canonical-postgresql.test.mjs`
   - Test the actual acceptance function, not merely AJV or source-regex
     patterns. Use independently fixed expected values and distinct
     workflow and implementation fixtures; verify that a changed
     submitted map cannot redefine its own expectations. Test both
     candidate S=C2 and activated C2-ancestor-of-S modes, the exact
     approved ref, and valid passed v2 evidence. Keep valid failed
     preflight evidence reportable but never qualifying.
   - Prove rejection of: missing, empty, partial and extra-key maps;
     wrong workflow hash; wrong C2 tree or any individual implementation
     hash; swapped workflow/implementation values; workflow claimed from
     C2 rather than S; implementation claimed from S rather than C2;
     exactly one wrong attribution amid otherwise valid evidence;
     legacy `sourceCommit`/`source_commit`-only and mixed v1/v2 fields;
     schema v1; short, nonhex, uppercase or otherwise malformed digests;
     wrong SHA/ref/workflow-ref, false ancestry, dirty checkout, absent
     verified roots/manifest, and a self-consistent but untrusted map.
     Exercise distinct S/C2 in activated fixtures to distinguish commit
     attribution; in candidate mode equal bytes cannot prove physical
     read origin without root-bound computation.
4. `.github/workflows/ledgerly-canonical-postgresql.yml`
   - Gate candidate-mode manual dispatch on protected exact
     `refs/heads/tr01/implementation-identity-successor-c2`, not the
     predecessor ref and never a prefix/wildcard. Preserve protected
     `refs/heads/main` activated mode, `github.sha`-pinned root checkout,
     exact C2 checkout in activated mode, SHA-bound Environment variable,
     non-cancelling concurrency, minimum permissions, pinned actions/
     images, bounded timeout, always-run evidence upload, and isolation.
5. `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs`
   - Replace only candidate-ref identity literals/conditions with the
     exact new ref. Preserve manifest recomputation, S-sourced workflow
     digest, C2-sourced implementation digests, private binding checks,
     role/isolation/cleanup controls, and all producer behavior.
6. `scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql`
   - Replace only candidate-ref and candidate workflow-ref-suffix
     constraints with the exact new ref in fresh disposable run-control
     SQL. Preserve full-SHA, equal-candidate-SHA, activated-main,
     protected-ref, ancestry, clean-checkout, and all other constraints.
     Never apply it to production or HeliumDB.

No additional executable/contract file is approved. Do not change
`scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql`,
`artifacts/api-server/src/services/accounting/canonicalPosting.ts`,
schema/migration for production, Dockerfile, lockfile, Base44 source,
or any other accounting/runtime surface. Governance records describing
the decision are outside C2's six-file correction diff, not a seventh
implementation permission. If implementation needs another file or
accounting posting/runtime semantics change, stop and seek design approval
before touching it.

## 2. Identity, provenance and C/S/A/B/G compatibility

The **proposed but unapproved prospective ref string** is
`refs/heads/tr01/implementation-identity-successor-c2`. The source
approval authorizes a new exact-ref strategy but does not name the
literal ref. Obtain the owner's explicit literal-ref decision and
fresh independent review of the reconciled package before any
implementation approval. No C2 ref has been created, configured or
published. Existing C and its ref remain preserved.
Candidate mode: protected exact workflow ref, `S=C2`, exact full
`GITHUB_SHA=C2`, exact `LEDGERLY_APPROVED_CANDIDATE_SHA=C2`, clean S/C2
checkouts, approved schema-v2 evidence and private run binding. Activated
mode: protected main workflow source S, implementation checkout at exact
C2, verified `C2 -> S` ancestry; only later activation governance can
authorize that mode. Do not rewrite or infer A, B, or G and do not
retroactively edit C evidence.

The workflow digest comes from the workflow-file bytes at verified S,
even when the C2 implementation source tree includes C2's copy of the
workflow. All other digest-map entries are computed from verified C2.
`sourceTree` is the manifest's deterministic implementation-tree digest,
not a substitute workflow digest. Candidate S and C2 share a SHA, so
claims of *physical* checkout origin for identical bytes must not be
made solely from hash equality; verify source roles and paths at
authenticated roots, and test wrong-domain claims with unequal
activated-mode roots.

## 3. Fresh implementation validation — future only

Before creation of C2, start from exact C with a clean tracked tree.
Reconcile all files and commit ancestry; do not use an unrelated
history-clean audit branch as the predecessor. Any unrelated intervening
change or seventh corrected path is a stop, not silent scope expansion.
Do not edit or repoint C's protected branch.

Run a **fresh** frozen dependency install (`pnpm install
--frozen-lockfile --ignore-scripts`), syntax checks for both `.mjs`
scripts, `pnpm run typecheck:libs`, `pnpm run typecheck`, the focused
validator/schema tests (strict AJV 8.20.0), relevant unit/pure tests,
workflow/ref static checks, source-manifest SHA recomputation and
consistency checks, disposable SQL/security parity review, secret and
dataflow scan, and exact six-file diff reconciliation. Run any
database-backed canonical-posting test **only in an independently approved
disposable database context** with rollback isolation and no production
or HeliumDB route; never point a test at the shared Replit database merely
to satisfy this checklist. Prove the entire rejection matrix in §1,
including a passing v2 candidate and activated fixture. Historic C
results and green unrelated checks cannot substitute for C2 results.

Obtain a fresh independent implementation/security review of the
proposed correction tree and its validation evidence **before**
candidate creation. After committing, independently verify the exact
C2 SHA and six-file diff against the reviewed tree; pre-commit review
alone is not exact-C2 review. If any gate fails, do not create/publish C2
or report qualification.

## 4. Candidate creation, publication and protection — separately authorized

1. Only after a later **explicit implementation approval** and all §3
   gates, create one normal descendant C2 commit from C containing only
   the six reviewed implementation paths. No amend, rebase, squash,
   reset, history replacement, tag substitute, or move of C's ref.
   Record full C2, its parent and exact per-file/tree digests outside
   the immutable commit; check the committed SHA against the review.
2. Only after the literal C2 ref is approved and with separate GitHub
   authorization, establish an exact-name ruleset for that approved ref
   **before** the ref exists: administrator coverage, update/deletion/
   non-fast-forward restrictions, no ordinary direct push, the
   specified identity-recovery validation-status gate, and no
   unauthorized bypass. Do not claim that `protected: true` proves
   particular rules. Apply a separately approved one-time, audited
   bootstrap bypass only if required to publish the already reviewed
   exact C2. Publish C2 to that ref without force; verify exact remote
   tip, remove the bypass, and read back the effective rules.
3. Generate/require the **actual** C2 validation status when its
   corrected workflow path and protected-ref process are ready.
   Record its check identity and exact SHA, prove required status is
   successful and enforced by the effective ruleset before any
   dispatch. Do not fabricate a status for C or treat its absence as a
   product defect. If status generation/protection is impossible,
   stop for a separate decision.
4. Under separate GitHub configuration authorization, bind
   `ledgerly-canonical` Environment variable
   `LEDGERLY_APPROVED_CANDIDATE_SHA` to exact full C2 and restrict
   candidate deployment to the exact new protected ref. Verify
   `GITHUB_SHA`, `GITHUB_REF`, `GITHUB_REF_PROTECTED`, Environment
   value, workflowRef, private binding and source manifest agree.
   Do not change production/HeliumDB settings. Existing C-only
   Environment or branch-review exceptions do **not** automatically
   authorize C2 live configuration; obtain explicit C2 governance
   extension/restatement before using any solo-operator substitution.
5. Obtain a fresh timestamped owner pre-dispatch attestation **for
   exact C2** recording ref, protection/ruleset/status, independent
   exact-C2 review, SHA/Environment binding, unchanged gates and
   development-only scope. This is neither a human GitHub PR review
   nor a substitute for independent implementation/security review.
   Separately authorize candidate qualification; dispatch only after
   all gates pass on the protected GitHub runner, using fresh
   disposable PostgreSQL, fail-closed negative controls, cleanup and
   retained non-secret v2 evidence. Do not run Phase A.

No approval here authorizes an activated-main run, authority
designation, governance activation, 48-B, Stage 3, production, or
HeliumDB contact. C remains historically preserved and unqualified;
C2 remains merely prospective until all later steps succeed.

## 5. Stop conditions and handoff verdict

Stop before implementation or execution if the approved inventory
needs another path; expected digests derive from submitted evidence
or share its mutable object; attribution cannot be bound to verified
S/C2 roots; a validator accepts missing/incomplete/legacy/mixed maps;
valid v2 is rejected; existing producer/security/cleanup controls
would change; C or its ref would move; exact C2 ref and workflow/SQL/
runner disagree; fresh tests or independent review fail; ruleset or
status cannot be proved; Environment identity is absent/wrong; a
C-only exception is assumed to transfer; any database is
non-disposable; or production, HeliumDB, or Phase A would be involved.

The first independent read-only package review **FAILED** solely because
the proposed ref string was presented as already approved when the
attachment approved only the ref strategy. The six-file technical
inventory, digest model, accounting-runtime boundary, and validation
plan had no other blocking finding. This package remains non-executable
and must be reconciled and re-reviewed after an explicit owner
literal-ref decision. If a fresh independent **read-only review of the
reconciled package** passes, the
result is:

**TR-01 SUCCESSOR CANDIDATE C2 CORRECTION APPROVED — IMPLEMENTATION
PACKAGE READY FOR EXPLICIT APPROVAL.**

This says only that the design/scope and a non-executable implementation
package are ready. It does not itself grant that later explicit
implementation approval or any further operational authorization.
While that literal-ref decision is absent, or if review identifies a
seventh path or architectural expansion, report:

**TR-01 C2 CORRECTION PACKAGE BLOCKED — FURTHER DESIGN APPROVAL REQUIRED.**