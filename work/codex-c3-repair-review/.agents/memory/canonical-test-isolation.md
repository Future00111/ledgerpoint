---
name: Canonical test isolation
description: Safety rule for testing append-only canonical accounting tables after database immutability is enabled.
---

Canonical integration tests must use transaction rollback isolation or a disposable development database once append-only triggers and restricted runtime grants are active. Never broaden the API role or bypass triggers solely to let test teardown delete canonical records.

**Why:** A suite designed around committed fixtures plus direct DELETE cleanup can exercise valid posting behavior but then fail teardown under the intended immutability boundary, leaving its committed fixtures behind.

**How to apply:** Before running canonical integration suites against a shared development database, verify that every fixture is rollback-isolated or created in an approved disposable database. Treat cleanup that requires canonical DELETE, trigger disabling, or superuser bypass as separate governance work.

Disposable runners must validate the effective PostgreSQL destination, not only the URI authority: connection-string query parameters can override host, port, and credentials. Bind each run to private control metadata and source digests, reject target overrides before any connection, and prove the normal development manifest is unchanged.

**Why:** A name-prefixed database URL can still be redirected by parser-supported query parameters. Also, schema push into an empty database may partially create tables before failing when a foreign key is processed ahead of its referenced composite unique index.

**How to apply:** Allowlist only non-target URI parameters, compare the full approved development endpoint, and verify a nonce-bound private run record. For empty-database bootstrap, fail closed on unknown errors; only apply a narrowly documented prerequisite index after the exact known ordering failure, then rerun the same schema push to convergence.