# Ledgerly #44-TI-03 implementation report

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
