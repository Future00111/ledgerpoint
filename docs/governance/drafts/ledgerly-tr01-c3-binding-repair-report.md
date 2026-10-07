# C3 private-binding probe repair — review only

## Base and scope

Separate local branch `repair/c3-database-binding-probe`, based on exact
`1c26be19295902a38e1939b56ff99ae9a195d3de`, tree
`beb56d35539d81636b609602b3c57d167bc88888`, sole parent
`e7f43c70e45c068971aeb241ce1b01a30bb01e37`.

Frozen C3, C/C2, all GitHub protections, reviewer/admission settings and approved
pins remain unchanged. No GitHub mutation, hosted qualification dispatch,
production/Helium access or production credential inspection.

## Root cause

Saved qualification run **37655209030** failed in bootstrap:

> forgedRunDatabaseMismatch runner probe did not reject

The runtime runner computed `orchestrator` using the CI **coordinator** path
instead of `sourceFiles.canonicalCoordinator`, the runtime orchestrator path.
The coordinator correctly supplies distinct digests for these two files.

The real C3 CLI therefore rejects at its source-digest equality check:

> External-CI source digests do not match the private run binding

It never reaches the SQL binding verifier. The negative-test harness requires
the **specific** private-binding rejection, not just any failure. Its generic
final message hides the earlier rejection reason, but it correctly refuses
to count the unrelated source-digest failure as a passing negative control.

**Classification:** runtime implementation defect in digest selection; not
a SQL identity-check bypass, and not a harness falsely accepting a forged
binding. The unchanged SQL verifier was exercised on actual PostgreSQL and
accepts the correct private row while rejecting forged UUIDs/nonces.

The preceding Drizzle SQLSTATE 42830 foreign-key uniqueness error is separate.
This patch does not change schema bootstrap or claim that the next complete
canonical qualification will succeed.

## Smallest production fix

One line in
`artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs`:

```diff
-    orchestrator: sha256File(sourceFiles.coordinator),
+    orchestrator: sha256File(sourceFiles.canonicalCoordinator),
```

No identity check, digest comparison, SQL predicate, privilege, source admission,
workflow pin or required rejection message is removed or weakened.

## Regression fixture

New manual script:
`scripts/ci/ledgerly-external-binding-regression.test.mjs`.

- Executes on a fresh PostgreSQL **16.15** cluster from the exact pinned image.
- Internal Docker network, no published ports/host binds or Docker socket in
  runtime; memory-backed PostgreSQL data; runtime non-root with read-only
  filesystem, dropped capabilities and no-new-privileges.
- Container-local initializer provisions only the private control schema/row
  and the actual unchanged SQL verifier/ownership/grants from the overlay.
  No network administrative fallback.
- Uses deliberately synthetic, review-only source/CI metadata. It cannot mint
  accepted GitHub qualification provenance. No qualification evidence/status
  is published.
- The imported test-access copy adds exports **only inside the disposable
  image**. The real CLI source is not instrumented; production adds no exports
  or binding-only execution mode.
- Original-defect mode reads the original CLI bytes directly from C3. Recorded
  SHA-256 is
  `43f82bab11a7c106e9926b1c3b3f35e357ba252f99f83fac07e06d03aa65de55`.
- Each fixture removes its PostgreSQL container/volumes, internal network,
  derived review image and temporary credential/fixture directory. All cleanup
  checks completed for original and repaired executions.

Commands from the repair worktree:

```sh
node scripts/ci/ledgerly-external-binding-regression.test.mjs \
  --disposable-review --base-image ledgerly-c3-offline-review:1c26be1 \
  --expect-original-defect

node scripts/ci/ledgerly-external-binding-regression.test.mjs \
  --disposable-review --base-image ledgerly-c3-offline-review:1c26be1

node --test scripts/ci/run-ledgerly-canonical-postgresql.test.mjs
```

The base image is the existing prebuilt offline C3 review image. Tests overlay
the actual reviewed source without reinstalling dependencies or changing the
base image. Running the new script without its explicit manual flag starts no
database.

## Results

Original C3, byte-exact real CLI:

- Digest parity fails at the wrongly selected orchestrator field.
- Actual runner forged probe fails at **source digest mismatch**, reproducing
  why the CI harness cannot find the expected private-binding rejection.
- Unchanged SQL verifier passes valid binding and rejects forged UUID/nonce.

Repaired source: **5/5 binding regressions pass**:

1. All ten source digests agree, with distinct coordinator/orchestrator hashes.
2. Valid binding passes the actual PostgreSQL verifier as `ledgerly_api`.
3. Forged run UUID fails with the intended private-binding error.
4. Forged nonce fails with the same intended private-binding error.
5. Actual runner CLI forged probe exits nonzero with
   `The private external-CI run binding did not verify`, not digest mismatch.

Existing TR-01 identity/acceptance validator suite passes (one Node test file,
zero failures/skips). Syntax checks and Git whitespace checks pass.

These are **binding-specific disposable regressions**, not a full canonical
posting/concurrency qualification or hosted acceptance. Valid binding success
does not claim that all subsequent schema/posting steps have passed.

## Evidence and review identity

Original and repaired logs, existing-suite output, final read-only control
readback, exact review commit/tree/parent and mail-formatted patch are retained
outside the frozen source in the main workspace's governance drafts with prefix
`ledgerly-tr01-c3-binding-repair`. Review commit is recorded in the companion
identity JSON; this report does not embed a self-referential commit hash.

The patch comprises the one-line runtime fix, the regression fixture and this
report only. No branch publication, PR, merge or protected pin change.

## Correction to earlier failure interpretation

The saved failure JSON reports **both** `testContainerNoSocket` and
`testContainerNoExternalRoute` as **true**, not false. The earlier fresh-run
summary incorrectly described those two fields. Original artifact bytes/hash
are unchanged; all five cleanup flags and all positive isolation flags report
true, with production/Helium contact false. This does not turn failed bootstrap
into successful canonical qualification.
