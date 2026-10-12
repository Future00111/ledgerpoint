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

As observed on 2026-08-26, the Replit workspace Docker daemon cannot execute
container-local health checks or `docker exec`; both fail with an OCI `setns`
error even when PostgreSQL is ready. Qualify this boundary on the approved
external GitHub runner rather than replacing local-socket administration with
network administrator credentials.