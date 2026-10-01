# Ledgerly #44-TI-03 implementation report

## Current C2 hosted qualification outcome — 2026-10-01

The later owner-authorised next-step preparation is now concrete:
[C3 preparation report](governance/drafts/ledgerly-tr01-c3-preparation-report.md),
ordinary candidate draft PR #11 and separate protected-main producer draft
PR #12. This changes no C2 outcome or authority: immutable C/C2, main and
live controls remain exact, intended immutable C3 is unpublished, and no
identity/qualification dispatch occurred. Development/disposable scope and
the existing owner-review exception remain; no independent-human-review
claim is made.

### Local review correction prepared after the failure

Under the later owner instruction, a concrete two-file correction was prepared
on local branch `review/tr01-c2-offline-pnpm`, worktree
`.local/tr01-c2-offline-pnpm-review`, commit
`e7f43c70e45c068971aeb241ce1b01a30bb01e37`, sole parent exact C2
`3ab9edc28b4922ad82e68afb7b049d69514f91e1`.
The [review patch](governance/drafts/ledgerly-tr01-c2-offline-pnpm-review.patch)
is directly against C2; forward `git apply --check` passed in a clean C2
worktree. This is local review code, not a published or approved successor.

Direct cached-image inspection confirmed `USER node`, `HOME=/home/node`,
a Corepack pnpm shim, absent root `packageManager`, and root-only
`/root/.cache/node/corepack` holding pnpm `10.26.1`; `/root` is mode 0700.
The old image fails offline version resolution as node. The correction
prepares Corepack at shared `/opt/corepack`, makes its files readable by the
final user, disables latest lookup/auto-pinning and runtime Corepack network
access, and adds a final-user `RUN --network=none` version/Drizzle-CLI check.
No source manifest or lockfile is rewritten.

Verification:

- Actual corrected production Dockerfile built from the unchanged pinned Node
  digest. Its final `node`-user, network-disabled check passed.
- New offline regression suite: **3 passed, 0 skipped**. It exercises pinned
  pnpm and the real bootstrap CLI under `--network none`, read-only filesystem,
  dropped capabilities and no-new-privileges; missing cache fails closed.
- Original root-cache image fails the corresponding offline negative baseline.
- Existing pure C2 identity/acceptance guard suite passed with a clean process
  environment and existing local test dependencies; no database test ran.
- Review worktree is clean; patch whitespace and clean-base application pass.

Only `.ci/ledgerly-canonical/Dockerfile.test` and
`scripts/ci/ledgerly-offline-pnpm.test.mjs` differ. PostgreSQL/private-network
controls, coordinator, canonical posting, identity guards, schema and cleanup
code are unchanged. C and C2 refs and the preserved failure JSON remain exact.
No remote publication, pin/protection change, approval, dispatch or database
operation occurred. A separately approved successor/qualification sequence
is still required; these local checks are not TI-03 qualification.

**Not qualified.** [Run 36882700987](https://github.com/Future00111/ledgerpoint/actions/runs/36882700987),
attempt 1, completed with **failure**, phase `bootstrap`, on exact immutable
C2 `3ab9edc28b4922ad82e68afb7b049d69514f91e1`. API approval history verifies
Future00111's normal owner release through Codex, with an explicit comment
excluding independent review and production approval. No second approval or
rerun occurred.

### Precise failure

Host validator installation and pinned test-image construction succeeded.
The bootstrap container then invoked `pnpm --filter @workspace/db run push`
on the private internal Docker network. Before Drizzle could run, Corepack's
`Engine.getDefaultVersion` attempted a fetch of
`https://registry.npmjs.org/pnpm/latest`, which failed DNS with
`getaddrinfo EAI_AGAIN registry.npmjs.org`. The runner rejected this as
`Drizzle bootstrap failed outside the approved FK/index ordering case`.
It did not apply the narrowly allowed index workaround to this unrelated error.

Reviewed C2 Docker configuration prepares/activates pnpm during image build
and later switches to `USER node`; the root package lacks `packageManager`.
The observed runtime registry lookup demonstrates that build-time activation
did not provide a fully offline runtime invocation. A final-user pin/cache
repair is the remediation direction, not permission to restore external
network access. No repair or immutable-source modification was made.

### Artifact and contract review

- Artifact: `11172430934`, `ledgerly-ti-03-36882700987-1`.
- Downloaded archive SHA-256 matches GitHub metadata:
  `3acdf110a300c661922da32d38633fc2fc81a0c002c5322290e9593759f4cf09`.
- Uploaded schema bytes match the exact C2 Git object; strict AJV Draft 2020-12
  validation passes with `schemaVersion:2`, `result:failed`.
- Preserved outside the immutable C2 checkout:
  [failure JSON](governance/evidence/ledgerly-44-ti-03-failed-36882700987-1.json).
- JSON SHA-256:
  `aa120080c81d43d34b4a7a2411b3e9ca61b311678de9f0758f60866cc11b79f2`.
  Both exact emitted path and hash match the actual archived JSON bytes.
- Log marker is `LEDGERLY_TI03_FAILURE_EVIDENCE`; no successful
  `LEDGERLY_TI03_EVIDENCE` was emitted.
- Every CI field matches the authenticated run/source and approved candidate
  context: repository/workflow/ref/job, run/attempt, candidate mode, exact
  workflow/implementation commit, protected/clean/ancestry flags.
- PostgreSQL and Node tag/digest pairs match approved immutable references.
- The failed artifact contains no runtime `binding.sourceDigests`; preflight
  source hashes cannot substitute for missing completed-run digest evidence.
- Full bootstrap roles, memberships, ACLs, constraints/indexes/triggers,
  posting results, concurrency overlap and required negative controls are
  absent/not reached. No partial result is accepted.

### Cleanup and isolation

The failure JSON reports all five cleanup checks **true**: logical drop,
database absence, PostgreSQL container removal, private network removal and
credential-material removal. No cleanup error was emitted. The reviewed runner
requires exact private database binding before DROP and checks absence/removal
before recording those flags; this is failed-run cleanup evidence, not a
successful full qualification.

Parent database URL/Replit markers are absent, secret scanning passed, and
production/Helium contact is reported false. `noPublishedPorts`,
`internalNetwork`, `testContainerNoSocket` and `testContainerNoExternalRoute`
remain false because their observed probes were not reached. Do not relabel
these as passed or infer that an external route was observed.

Bounded post-run readback confirms C, C2 and main unchanged, effective immutable
rules/source integration `15368` intact, both exact pins and two-branch/no-tag
allowlist unchanged. No workspace or production database operation occurred.
Accepted qualification evidence remains **none**. Any repair, successor or
new qualification run requires a separate authorised decision.

## Original implementation report (historical)

Date: 2026-08-26

## Status

**Implementation: complete and independently reviewed.**

**Qualification: BLOCKED in the Replit workspace.**

The Replit Docker daemon starts PostgreSQL 16 successfully, but both Docker
health checks and ordinary `docker exec` fail with:

`OCI runtime exec failed: unable to start container process: error executing setns process`

The approved TI-03 design requires container-local PostgreSQL administration.
No network-admin fallback was introduced. The accepted qualification must run
through the protected GitHub Actions workflow after repository environment
protection is configured.

## Implemented boundary

- Protected manual GitHub Actions workflow on protected `main`.
- Exact workflow name, workflow path/reference, job, run ID, attempt, source
  commit, image digests, execution-tree digest, and per-run nonce binding.
- Fresh PostgreSQL 16 container and internal-only Docker network per run.
- No published PostgreSQL port and no Docker socket in the test container.
- Per-run PostgreSQL administrator and `ledgerly_api` credentials generated
  only after dependency/image construction.
- PostgreSQL bootstrap and cleanup through container-local administrator
  execution only.
- Canonical test process runs only as `ledgerly_api`.
- Private postgres-owned run-control table and fixed-search-path,
  postgres-owned `SECURITY DEFINER` verification function.
- Exact cleanup binding recheck before logical deletion, followed by verified
  container, network, and credential-material removal.
- Real runner negative controls with expected rejection-message matching.
- Observed internal-network, no-published-port, no-socket, and no-external-route
  probes.
- Draft 2020-12 evidence schema validated by pinned AJV 8.20.0 for every
  success and failure artifact, plus stricter semantic acceptance checks and
  secret scanning.
- Deterministic execution manifest covering the Docker controls, workflow,
  workspace manifests, lockfile, TypeScript configuration, and all tracked
  `artifacts`, `lib`, and `scripts` inputs. The unprivileged image process
  recomputes this digest.

## Immutable image references

- PostgreSQL:
  `postgres:16.15-bookworm@sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825`
- Node:
  `node:24.13.0-bookworm-slim@sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f`

## Changed files

- `.dockerignore`
- `.ci/ledgerly-canonical/Dockerfile.test`
- `.github/workflows/ledgerly-canonical-postgresql.yml`
- `package.json`
- `pnpm-lock.yaml`
- `scripts/ci/run-ledgerly-canonical-postgresql.mjs`
- `scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql`
- `scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql`
- `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs`
- `artifacts/api-server/src/services/accounting/canonicalPosting.integration.test.ts`
- `docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json`
- `docs/ledgerly-44-ti-03-external-ci-postgresql-implementation-report.md`

## Verification completed

- Coordinator and canonical runner JavaScript syntax checks passed.
- API server TypeScript typecheck passed.
- Frozen, script-disabled host dependency installation passed.
- Test image built successfully from the pinned Node digest.
- A 559-file execution manifest was recomputed successfully by the
  unprivileged `node` user inside the read-only, network-disabled image.
- Draft 2020-12 evidence schema compiled in strict AJV mode.
- Schema-invalid pinned-image evidence was rejected.
- Coordinator loaded AJV/schema and failed closed at protected-workflow
  preflight outside GitHub Actions.
- Failure-path proof removed credential material and left no TI-03 Docker
  container or network.
- Final independent architecture/security review: **PASS**, with no remaining
  deterministic runtime, SQL, schema, or security defect found.

## Accepted qualification evidence

- Evidence path: **none**
- Evidence SHA-256: **none**
- Reason: the Replit Docker daemon cannot perform the approved container-local
  PostgreSQL administration. A local artifact is not accepted as TI-03
  qualification evidence.

The protected GitHub run must retain:

`docs/governance/evidence/ledgerly-44-ti-03-<run-uuid>.json`

and report its emitted SHA-256 before TI-03 qualification can be approved.

## Scope confirmation

- `heliumdb` was not contacted.
- No production resource, secret, or configuration was used or changed.
- No normal Replit workflow was changed.
- No production/development database migration or RLS change was made.
- No persistent external database or credential was created.
- TR-01 was not resumed.

## Prospective identity-recovery status — 2026-09-21

The implementation identity formerly recorded as
`b03627099616675924a88e9a30c7b5e6547c9166` is:

**HISTORICAL IMPLEMENTATION IDENTITY — OBJECT LOST / UNAVAILABLE**

The historical implementation and verification statements above remain
unchanged. They do not qualify a future replacement commit.

There is still no accepted TI-03 qualification evidence path or SHA-256. Any
future candidate `C` must complete fresh protected-run qualification under the
approved dual-identity recovery amendment. Passing candidate qualification does
not make `C` authoritative without a separate final identity approval and
activated protected-main qualification.

## Candidate identity-contract implementation — 2026-09-21

The approved candidate implementation contract is now represented prospectively
in the exact authorized files:

- `.github/workflows/ledgerly-canonical-postgresql.yml`;
- `scripts/ci/run-ledgerly-canonical-postgresql.mjs`;
- `scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql`;
- `scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql`;
- `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs`;
- `docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json`;
- `scripts/ci/run-ledgerly-canonical-postgresql.test.mjs`; and
- this report.

The contract implements evidence schema version 2, distinct
`workflowSourceCommit` and `implementationSourceCommit` identities, candidate
and activated workflow modes, full-history object/ancestry checks, dual source
roots, and fresh-disposable-only run-control columns. Legacy `sourceCommit` /
`source_commit` evidence is rejected.

This is implementation state only. No candidate commit has been created or
published, no protected GitHub qualification has run, and no qualification
evidence is accepted. Candidate `C` remains non-authoritative and requires
fresh local validation, independent review, exact immutable commit creation,
protected candidate publication, and complete TI-03 qualification.
