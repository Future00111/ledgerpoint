# TR-01 successor candidate evidence-acceptance correction — scope proposal

**Status:** DESIGN / SCOPE REVIEW ONLY — FURTHER EXPLICIT APPROVAL REQUIRED
**Predecessor:** `C=d292f3a64c6253e022b40de8cf055f3e722ff1ea`
**C status:** IMMUTABLE PREDECESSOR CANDIDATE — NOT QUALIFIED / NOT AUTHORITATIVE
**Successor:** `C2` is a future SHA, not yet created or approved.

No code, SQL, schema, workflow, branch, Environment, database, or production
change is authorized by this document. C and its exact protected ref must not
be amended, rebased, force-pushed, moved to C2, deleted, or replaced. Candidate
qualification, Phase A, production, and HeliumDB contact remain blocked.

## Read-only diagnosis at exact C

The schema at
`docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json` permits
`binding.sourceDigests` without requiring it. Its `digestMap` definition
accepts an empty object and arbitrary well-formed key names instead of the
complete approved map. Passed evidence requires `binding`, but not the map.

The acceptance function in
`scripts/ci/run-ledgerly-canonical-postgresql.mjs` validates schema-v2
identity, clean checkouts, negative controls, cleanup, and isolation, but
does not compare the map or `binding.sourceTreeSha256` with independently
computed digests from the verified workflow checkout S and implementation
checkout C. The function writes evidence through `writeEvidence`; it is not
currently exercised directly by the focused test. This is an
**acceptance-validator defect** and a **schema defect**.

The coordinator's **producer** computes the workflow-file digest from
`workflowRoot` (S), builds the execution manifest/source-tree digest at
`implementationRoot` (C), hashes implementation inputs there, and emits a
complete `sourceDigests` map. The disposable test runner independently
recomputes/compares those source digests and consumes the workflow digest
from the verified manifest. Read-only inspection did not establish a
producer defect or a need to modify the disposable runner's digest
calculation. The **test gap** is that the focused tests cover the schema
and some digest-source patterns, but not a passed-evidence acceptance
rejection for missing, wrong, or misattributed digest entries. No
accounting-posting/runtime semantic change is indicated.

The complete existing map is exactly `sourceTree`, `applicationSchema`,
`drizzleConfig`, `securityOverlay`, `runControlSql`, `coordinator`,
`testSources`, `lockfile`, `workflow`, and `orchestrator`; all are lowercase
64-character SHA-256 values. The workflow entry is the digest of the
workflow file at S. The source tree and nine implementation entries are
computed from C2. `binding.sourceTreeSha256` must equal
`binding.sourceDigests.sourceTree`.

## Proposed minimum fail-closed acceptance design

For **passed** schema-v2 evidence, require the exact ten-key map (no missing,
extra, empty, partial, legacy, or malformed entries). Keep failed/preflight
evidence representable when a run stops before a binding exists; do not
silently turn failed evidence into a passing record.

The acceptance validator must take trusted expected digests calculated
from the verified checkout roots and manifest, not copy its expectations
from the submitted evidence. Bind the expected workflow digest to the
workflow file at S and every implementation digest, including the manifest
source-tree digest, to the C2 checkout. Validate both full commit identities,
the source ref, clean HEADs, candidate `S=C2` equality or activated
`C2 -> S` ancestry as appropriate, and exact equality of every named map
entry. Reject a map with correct-looking hashes attached to the wrong key,
wrong root, wrong commit/role, or wrong path. Fail closed if the verified
roots/manifest are unavailable. A downloaded artifact cannot prove its own
provenance by self-comparison: later acceptance must re-establish trusted
commit-bound inputs or decline to call it verified.

In candidate mode S and C2 are the **same commit**. A SHA-256 alone therefore
cannot prove which identical checkout supplied identical bytes. Domain
assertions must be about the checked source **role, path, checkout HEAD,
and computed digest**, not a claim that unequal commit IDs will distinguish
the roots. Exercise unequal `S` and `C2` in activated-mode negative fixtures
to prove cross-commit misattribution rejection. Do not claim the validator
can infer a physical read origin from two identical byte streams without
trusted root-bound computation.

Preserve schema-v2 identity, legacy/mixed rejection, C/S/A/B/G semantics,
protected-ref and workflow identity, cleanup, negative controls, and the
development-only boundary. Do not change financial posting, double-entry
logic, production database behavior, or HeliumDB access.

## Successor-ref dependency and exact minimum executable inventory

A three-file evidence-only fix cannot be **qualified as C2** while C remains
at its immutable candidate ref: the currently approved candidate ref is
hard-coded in six executable/contract files. Moving the existing ref to C2
would violate this proposal's C preservation rule. A new **exact** protected
candidate-development ref is therefore needed. The proposed name
`refs/heads/tr01/implementation-identity-successor-c2` is a design
placeholder, not an authorized live ref; it must be fixed by separate
identity/governance approval. Do not broaden any ref check to a wildcard or
allow C and C2 to compete for candidate qualification.

| Path | Change required | Why required | Runtime impact | Qualification impact |
| --- | --- | --- | --- | --- |
| `docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json` | Require the exact ten-key digest map for passed v2 evidence, deny extra/legacy keys, preserve failed-evidence semantics; bind candidate source-ref constraints to the newly approved exact C2 ref. | Schema currently permits absent/empty/partial maps and only the old candidate ref. | None in accounting/product runtime; evidence-contract validation changes. | Malformed passed evidence is rejected; valid C2 candidate/activated evidence remains representable. |
| `scripts/ci/run-ledgerly-canonical-postgresql.mjs` | Compare all named evidence digests and tree digest with trusted S/C2 checkout-derived values; make the validator safely exercisable in focused tests; update exact candidate-ref identity guards only after the new ref is approved. Leave producer digest computation unchanged unless later independent review finds a defect. | Current validator does not enforce provenance/equality; coordinator also rejects any candidate ref other than C's. | None in accounting/product runtime; CI evidence acceptance and candidate preflight change. | Wrong-domain passed evidence fails before acceptance or publication; only the exact successor ref can run candidate mode. |
| `scripts/ci/run-ledgerly-canonical-postgresql.test.mjs` | Add valid passed-evidence, negative digest-domain and identity fixtures; replace old-ref candidate fixtures only after approved ref migration. | Current tests do not exercise passed-evidence acceptance or successor candidate ref. | None; focused test coverage only. | Proves rejection and preserves valid candidate/activated v2 behavior. |
| `.github/workflows/ledgerly-canonical-postgresql.yml` | Replace the old candidate-only ref allowance with the exact approved C2 ref; retain manual dispatch, protected-ref guard, SHA/checkout identity, pinned dependencies, and separate activated-main behavior. | Workflow currently allows the old candidate ref, not a new immutable successor ref. | CI workflow only, not accounting/runtime. | Dispatch can be gated to C2 without moving C's branch. |
| `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs` | Update exact external-CI candidate ref/identity checks to the approved C2 ref; do not modify producer digest computation, canonical posting, or database privileges. | Disposable qualification preflight currently rejects any candidate ref other than C's. | Disposable test-runner identity only; no production accounting/runtime change. | C2's private run binding and source digests remain verified. |
| `scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql` | Bind the **disposable run-control** candidate ref/workflow-ref constraint to the approved C2 ref, preserving every other constraint. | Its check constraint currently accepts only C's ref in candidate mode. | No application/production database or accounting semantic change; disposable CI SQL policy only. | Fresh disposable PostgreSQL can accept exact C2 identity, not arbitrary refs. |

No change is proposed to the SQL security overlay, business posting code,
production database schema, dependency lockfile, Dockerfile, or image
construction. A non-executable approval/evidence record outside C2 can
document the later identity decision and test results; it is not an
additional implementation file. The six-file inventory is a **requested
expansion of successor identity scope**, not implementation authority.
If review finds any necessary accounting posting/runtime change, stop:
**TR-01 EVIDENCE CORRECTION EXPANDS INTO ACCOUNTING RUNTIME — DESIGN APPROVAL
REQUIRED.**

## Mandatory future probes (no execution now)

Against the **actual acceptance validator** with trusted expected values
and a valid passed schema-v2 baseline, reject separately:

1. Missing, empty, incomplete, and extra-key source-digest maps.
2. Wrong workflow digest; wrong implementation digest (including the
   source-tree digest and an individual implementation file digest);
   swapped workflow/source-tree values.
3. A workflow digest substituted from the implementation checkout and an
   implementation digest substituted from the workflow checkout. Use distinct
   S/C2 activated fixtures as well as candidate role/key fixtures. Reject
   an otherwise valid record with exactly one wrong attribution.
4. Legacy `sourceCommit`/`source_commit`-only evidence, mixed v1/v2 fields,
   v1 evidence, short/nonhex/uppercase/malformed digests, and extra keys.
5. Wrong candidate ref/SHA or workflow ref, false ancestry, dirty checkout,
   absent trusted root/manifest, and a self-consistent but untrusted artifact
   map. Confirm that a mutated evidence map cannot become its own baseline.

Prove that valid passed candidate v2 evidence and valid activated v2
evidence still pass, and that legitimate failed/preflight evidence remains
reportable without being accepted as success. Re-run complete fresh
validation: source checks, schema/fixture suite, identity tests,
SQL/security and canonical-posting tests in their **approved disposable
context**, followed by independent exact-C2 implementation/security review.
Do not run database-backed qualification in this design task.

## Future process and explicit stop

1. Obtain explicit approval of the **expanded six-file scope**, successor
   ref and identity governance, and the exact evidence-acceptance contract.
2. Implement only that approved inventory on a normal descendant of C; do
   not amend or move C or its branch.
3. Run complete fresh validation, including digest rejection probes, and a
   fresh independent implementation/security review of the proposed tree
   **before** candidate creation. This is not yet a review of an exact SHA.
4. Create immutable descendant commit C2 only after that review passes.
   Independently verify the committed **exact C2** against the reviewed tree,
   inventory, and evidence; a pre-commit review alone cannot be reported as
   an exact-C2 verdict.
5. Configure the approved exact-name protected ruleset for the new ref
   **before** publishing C2, then publish exactly C2, remove any one-time
   bootstrap bypass, and read back tip equality and rules. Generate and
   verify the new required validation status only after the corrected
   protected workflow path is ready. A status for old C is neither expected
   nor a substitute; do not invent or backfill one now.
6. With separate GitHub configuration authorization, bind
   `ledgerly-canonical`'s SHA variable and candidate-only deployment policy
   to C2 and the new exact ref; confirm no production or HeliumDB access.
7. Obtain a fresh owner pre-dispatch attestation for C2, then separate
   qualification authorization before running full disposable PostgreSQL
   candidate qualification and fail-closed cleanup.

C remains a historical predecessor, not an authoritative qualified
candidate. The previous Environment and branch-review exceptions do not
silently rebind themselves to C2; extending their development-only scope
and updating old governance references requires the explicit successor
decision. Activated-main governance and future independent-human controls
remain unchanged.

**Proposed outcome:** TR-01 EVIDENCE CORRECTION BLOCKED — FURTHER DESIGN
APPROVAL REQUIRED (successor-ref identity expansion). No executable work
is authorized.

**Independent read-only design review:** PASS on the six-file scope and
boundaries. This is not approval to implement, create C2, configure GitHub,
or run qualification; the independent implementation/security reviews of
the future tree and exact C2 remain to be performed.