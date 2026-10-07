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

Do not treat schema-push command completion alone as proof of a complete
schema; inspect known SQL errors and verify catalog postconditions.

**Why:** A protected disposable run logged PostgreSQL foreign-key uniqueness
error 42830 from Drizzle and nevertheless continued to a later negative-binding
probe. The probe then failed; neither schema completeness nor posting was proved.

**How to apply:** In a separately approved successor, detect SQL-error output
and verify required constraints/indexes before binding/posting controls. Do not
silently widen the known prerequisite repair or alter a frozen candidate.

Negative binding tests must prove the intended database rejection, not merely
any nonzero exit. First establish that valid source digests reach the SQL guard.

**Why:** A coordinator/runtime digest disagreement stopped the forged-binding
probe before SQL, producing a misleading generic “did not reject” summary.
Actual disposable PostgreSQL confirmed the identity predicate was sound.

**How to apply:** Pair a valid binding with forged UUID/nonce tests on the real
SQL verifier, and also drive the actual CLI to its specific rejection message.
Keep these local synthetic fixtures separate from trusted qualification evidence.

Non-database toolchain smoke images must not mint a usable qualification
manifest merely to satisfy the Dockerfile's required COPY path.

**Why:** The offline CLI checks do not establish protected-run identity,
private run binding, accounting behavior or cleanup. A superficially valid
runtime manifest could make a review-only image appear authoritative.

**How to apply:** Keep smoke fixtures explicitly build-only and intentionally
invalid for the qualification protocol, and test rejection by the actual
manifest guard. Do not "fix" the intentionally incompatible fixture version
or upload smoke output using the qualification evidence naming pattern.