---
name: Disposable canonical test administration
description: The trust-boundary requirement for provisioning and cleaning up canonical disposable databases.
---

Canonical disposable integration runs require a separately authorised,
ephemeral PostgreSQL administrative channel. The normal managed development SQL
path authenticates as `ledgerly_api` and is not an administrative substitute.

**Why:** The run must create and bind a new database, bootstrap it, verify the
runtime role, terminate exact bound sessions, and drop only that database.
Allowing the application role to do this would defeat RS-01 role separation;
falling back to `heliumdb` would violate canonical test isolation.

**How to apply:** If the ephemeral `postgres` channel and complete run-binding
environment are not available, let the guarded runner fail closed and report
the blocker. Do not add a reusable admin script, broaden `ledgerly_api`, expose
an admin credential, or run canonical integration tests against `heliumdb`.

Container-local `docker exec` capability is environment-dependent: a prior
OCI `setns` failure was later absent in a throwaway, no-network container.
**Why:** A successful local exec probe proves neither the full PostgreSQL
role/isolation envelope nor an accepted protected qualification run.
**How to apply:** Treat old Docker failure reports as dated observations.
Require the complete approved runner controls and evidence; never replace
container-local administration with network administrator credentials or
claim qualification from a simple exec probe.

A ready disposable PostgreSQL container does not prove that the isolated
test client can reach it, and shared-namespace creation may independently
fail in the local runtime.

**Why:** A local fixture reached readiness while peer TCP connections stalled;
an isolated shared-namespace alternative was denied by OCI mount-namespace
permissions. Neither result reached database identity verification.

**How to apply:** Preserve infrastructure-failure evidence and verify cleanup.
Report binding checks as blocked, not passed or schema-defective. Do not open
external/host networking or relax container privileges to manufacture success;
verify the exact candidate later in a supported disposable environment.