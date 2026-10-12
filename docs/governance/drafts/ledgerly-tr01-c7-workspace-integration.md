# C7 workspace integration — local composite, not qualified exact C7

Owner-authorized selective workspace integration completed on local branch
`integration/tr01-c7-workspace`, created from the **current workspace HEAD**
`07551a8e340f9de54b84340adf6185f0a08de9e7`.
The original `audit/replit-2026-09-25` branch remains preserved at that base.
No branch was reset or rebased onto GitHub main/C7 and nothing was pushed.

## Exact imported source

The prepared patch hashes and applicability were checked before import.
The resulting 17 files match their exact GitHub Git blobs byte-for-byte,
including EOF bytes. Compact source/file SHA-256 records are saved in
`ledgerly-tr01-c7-integration/imported-file-hashes.json`.

### Fourteen files from exact frozen C7

Source: `787d76decfa345e3c1104231e08d5ab00bc90259`.

- `.ci/ledgerly-canonical/Dockerfile.test`
- `.github/workflows/ledgerly-canonical-postgresql.yml`
- `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs`
- `artifacts/api-server/src/services/accounting/canonicalPosting.integration.test.ts`
- `artifacts/api-server/src/services/accounting/canonicalPosting.ts`
- `docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json`
- `scripts/ci/ledgerly-external-binding-regression.test.mjs`
- `scripts/ci/ledgerly-nested-offline-review.mjs`
- `scripts/ci/ledgerly-offline-pnpm.test.mjs`
- `scripts/ci/ledgerly-schema-push-regression.test.mjs`
- `scripts/ci/run-ledgerly-canonical-postgresql.mjs`
- `scripts/ci/run-ledgerly-canonical-postgresql.test.mjs`
- `scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql`
- `scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql`

### Three producer files from exact GitHub main

Source: `0da401737f35d68b9404982baad7405fe997636a`.

- `.github/workflows/ledgerly-tr01-c7-identity-status.yml`
- `scripts/ci/ledgerly-tr01-c7-identity-status.mjs`
- `scripts/ci/ledgerly-tr01-c7-identity-status.test.mjs`

Local apps, package/config changes, prior governance reports, original
qualification evidence, attachments and tracked review work remain preserved.
Historical C4 report overlap was deliberately excluded from these imports.
Only the imported 17 paths and current integration/status records are part of
this stage's change.

## Verification

- `pnpm run typecheck`: **passed**, including composite libraries and API
  server, Ledgerly, mockup sandbox and scripts leaf packages.
- Non-database regression pass: **56 tests, 56 passed, zero failures/skips**:
  - `scripts/ci/run-ledgerly-canonical-postgresql.test.mjs`
  - `scripts/ci/ledgerly-schema-push-regression.test.mjs`
  - `scripts/ci/ledgerly-offline-pnpm.test.mjs`
  - `scripts/ci/ledgerly-tr01-c7-identity-status.test.mjs`
- The initial smoke pass without optional fixtures had seven skips; the final
  pass supplied a build-only offline image and detached exact-C7 validation
  copy, covering those cases. The final figures above do not count the initial
  pass twice.
- Six offline tests covered UID 1000, network-none/read-only/no-new-privileges,
  pinned shared Corepack cache, real sanitized nested pnpm/Node invocation,
  canonical compilation/module loading **without database tests**, and
  missing writable/read-only cache fail-closed behavior.
- Schema-convergence regressions used mocked push/index executors only.
  **No SQL command, migration, database fixture or canonical posting run was
  executed by these integration checks.**
- The temporary build manifest was deliberately version 1, review-only and
  marked not qualification evidence. Actual exact-C7 validation rejected
  build-only provenance before source hashing/qualification.
- Source bytes were verified again after testing. All seventeen still match.
- Fresh read-only before/after GitHub snapshots match: frozen C through C7,
  effective candidate rules, main protection/rules, rulesets, Environment
  policy/reviewer, workflow/candidate pins and branch admission are unchanged.
- Temporary smoke containers were absent, the newly created smoke image was
  removed, and the temporary build copy/detached candidate worktree were
  removed. Existing images, worktrees and local work were not removed.
- The existing development API workflow was restarted once after the import;
  its build and startup succeeded. Its existing development scheduler started
  normally. The public signed-out app preview rendered correctly. Neither
  service startup nor this visual check is qualification evidence.

Compact records: `ledgerly-tr01-c7-integration/`.
Raw logs, read-only control snapshots and cleanup/image records:
`generated-artifacts/ledgerly-c7-integration/` (ignored by Git/deployment).
After commit, the actual SHA/tree/parent/changed-path readback is saved there
as `integration-commit-readback.json` and reported to the owner.

## Qualification and governance boundary

This is a **workspace integration commit**, containing local preserved work,
exact C7 runtime imports and exact-main producer imports. Its identity is
different from frozen C7. Existing development qualification run `38284785813`
applies to **exact C7 only**; the integration does not inherit that
qualification merely because the seventeen selected files match.

No frozen candidate alteration, live GitHub control mutation, new
qualification dispatch, database migration, production/Helium access,
deployment, governance activation or Phase A occurred. No
independent-human-review claim is made.
