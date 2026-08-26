# #44 / #46 Canonical Test Isolation and Development Fixture Disposition Approval Package

**Status:** PROPOSED FOR APPROVAL — DECISION ONLY  
**Prepared:** 2026-08-26  
**Environment:** Development only  
**Implementation authority:** None

> This package defines a proposed test-isolation design and a proposed one-time
> disposition boundary for synthetic development fixtures. It does not
> authorise code, configuration, schema, migration, database, secret, workflow,
> deployment, publishing, production, or fixture-cleanup work.

## 1. Decision requested

Approve or reject both of the following as one narrowly scoped safety package:

1. a schema-only disposable-database mechanism for canonical integration,
   transaction, failure-injection, and concurrency tests; and
2. a separately approved, one-time, administrative isolated-test reset for the
   exact retained synthetic development fixture graph recorded below.

Approval of this package would approve the design only. A later explicit
implementation instruction would still be required before either the test
harness or the retained fixtures may be changed.

## 2. Existing authority and non-negotiable boundaries

This package preserves:

- DEC-04: canonical accounting is server-generated, balanced, source-linked,
  idempotent, immutable, and changed only through controlled additive
  accounting mechanisms;
- DEC-17: authoritative accounting and necessary audit evidence have governed
  retention classifications;
- DEC-18: posted business accounting and audit evidence is not physically
  deleted, and disposal is not an accounting-correction mechanism;
- #40: a controlled environment containing test postings may be removed or
  restored only through an approved isolated test reset, never through a
  production accounting deletion path;
- #44: canonical headers, lines, relations, and audit events are append-only,
  and posting effects allow only the approved finalisation transitions;
- #44-SC-01: every canonical relation is company-scoped and bound to the
  resolved economic effect; and
- #44-RS-01: the development API connects directly as `ledgerly_api`, while
  protected canonical objects remain owned and guarded outside that role.

The following remain prohibited:

- canonical `UPDATE`, `DELETE`, or `TRUNCATE` authority for `ledgerly_api`;
- trigger-disable, owner-role, superuser, or administrative authority for
  `ledgerly_api`;
- `SET ROLE` as a substitute for a direct API-role connection;
- weakening or replacing the five `ENABLE ALWAYS` guards;
- committed canonical test writes in the normal development database;
- treating synthetic fixture disposal as an ordinary reversal or correction;
- production access, production posting, production cleanup, or deployment;
- a persistent change to the normal development `DATABASE_URL`; and
- BL-06, BL-07, #41, migration/backfill, RLS, or unrelated product work.

Production posting remains disabled.

## 3. Safety-gate evidence

The development API has been restarted and observed running directly as:

- `current_user = ledgerly_api`
- `session_user = ledgerly_api`

The approved role, ownership, ACL, trigger, escalation, mutation-resistance,
effect-transition, permitted-write, and public-default checks passed. The API
health endpoint and scheduler database access also passed.

The canonical integration suite then exercised valid committed canonical
transactions but failed in its teardown when it attempted:

```text
DELETE FROM accounting_audit_events ...
```

PostgreSQL correctly rejected that cleanup for `ledgerly_api`. No privilege was
broadened and no trigger was weakened.

This is a test-isolation defect, not evidence that the runtime API needs broad
canonical mutation authority.

## 4. Read-only provenance of the retained development fixtures

The following evidence was obtained through read-only development queries on
2026-08-26. No row was deleted, updated, anonymised, rewritten, reversed, or
corrected.

### 4.1 Exact synthetic company allowlist

| Test family | Company ID | Canonical effects / journals / lines / relations / audits |
|---|---|---:|
| Atomicity and concurrency | `bcb3569f-703f-46e8-b554-f0447c2d78df` | 3 / 3 / 6 / 2 / 3 |
| Fail-closed Company A | `33d1466a-a116-4bb7-bc82-a44fb38259c3` | 0 / 0 / 0 / 0 / 0 |
| Fail-closed Company B | `59f25ad4-c123-4db2-b50f-8c2f7360e3ea` | 0 / 0 / 0 / 0 / 0 |
| Happy path | `8944dfd1-4a76-41d3-be5f-1c9267c1f0c3` | 1 / 1 / 2 / 0 / 1 |
| SC-01 primary company | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | 4 / 4 / 8 / 3 / 4 |
| SC-01 other company | `74ee2198-2196-40fc-8eb3-2aa038f48358` | 0 / 0 / 0 / 0 / 0 |
| **Total** | **6 companies** | **8 / 8 / 16 / 5 / 8** |

The company names contain the expected `Canonical posting` test-family prefix
and generated UUID suffix. The three companies with canonical rows use
test-generated actor identifiers with the `canonical-owner-` prefix.

### 4.2 Canonical source and effect provenance

All eight effects and all eight journals have status `posted`.

| Source type | Posting kind | Count | Relationship |
|---|---|---:|---|
| `fixture_document` | `fixture_posting` | 3 | Original synthetic test postings |
| `canonical_journal` | `journal_reversal` | 2 | Additive reversal journals |
| `canonical_journal` | `journal_correction` | 3 | Additive correction journals |

The five relations comprise:

- one reversal and one correction for the atomicity/concurrency company; and
- one reversal and two distinct corrections for the SC-01 primary company.

Read-only integrity checks found:

- zero posted effects with a missing, cross-company, or wrong-effect journal;
- zero relations with a missing economic effect;
- zero relations with missing original or related journals;
- zero relation company mismatches;
- zero audit events with missing referenced effects; and
- zero legacy `journal_entries`.

The rows are therefore structurally valid canonical records produced by the
test source and test actors. Their synthetic provenance does not make them
mutable through the ordinary application boundary.

### 4.3 Associated ordinary fixture rows

The six companies also retain ordinary test setup rows:

| Test family | Company users | Chart accounts |
|---|---:|---:|
| Atomicity and concurrency | 1 | 2 |
| Fail-closed Company A | 1 | 2 |
| Fail-closed Company B | 0 | 1 |
| Happy path | 1 | 2 |
| SC-01 primary company | 1 | 2 |
| SC-01 other company | 0 | 0 |
| **Total** | **4** | **9** |

Read-only checks found no bank accounts, bank transactions, customers, or
suppliers under these six company IDs.

The exact company IDs, not a name pattern alone, form the proposed disposition
allowlist.

## 5. Test-isolation options considered

### Option A — Outer transaction and rollback in the normal development database

**Not selected for the complete canonical integration suite.**

Transaction rollback is preferred where one test controls every statement
through one connection and one transaction. It is not sufficient for the
current complete suite because:

- the canonical public service methods open and commit their own transactions;
- an unrelated outer test transaction cannot roll back those independently
  committed writes;
- the retry/idempotency test intentionally uses multiple concurrent calls and
  database connections; and
- making all calls share one connection would stop testing the required
  multi-connection uniqueness, locking, and commit visibility behavior.

A future lower-level single-transaction test may use rollback isolation when
the tested function receives the same transaction handle. That does not replace
the required public-boundary and concurrency integration tests.

### Option B — Row cleanup in the normal development database

**Rejected.**

This would require one or more of:

- canonical `DELETE` or `TRUNCATE`;
- trigger suspension;
- owner-role or superuser access in the test process; or
- a persistent administrative cleanup function.

It would weaken the boundary being tested and would make a failed or malicious
test capable of mutating ordinary development accounting history.

### Option C — Schema-only disposable database

**Selected.**

A unique disposable database gives each canonical test run the same PostgreSQL
transaction, uniqueness, lock, trigger, role, and multi-connection semantics as
development without committing rows to the normal development database.

Cleanup is disposal of the isolated test database by an administrative
provisioner. It is not deletion through `ledgerly_api` and not an accounting
operation.

## 6. Selected canonical integration-test mechanism

### 6.1 Isolation unit

Use one uniquely named disposable PostgreSQL database per invocation of the
canonical integration test command.

The database must:

1. be created by a separate administrative provisioner;
2. start from the approved schema only, never a clone of live development data;
3. contain no business, development, or prior test rows;
4. have the same canonical constraints, indexes, ownership, grants, four guard
   functions, and five `ENABLE ALWAYS` triggers as the normal development
   database;
5. grant the test process only a direct `ledgerly_api` connection; and
6. be dropped as a database after all test connections close, whether tests
   pass or fail.

The normal development database is never a fallback. Provisioning failure must
fail the suite before its first fixture insert.

### 6.2 Provisioning boundary

The provisioner and test process are separate trust boundaries.

The administrative provisioner may only:

- create a database with an allowlisted generated test-database prefix;
- apply the approved schema-only definition;
- apply the approved RS-01 database/schema ACL, object ownership, functions,
  and trigger state;
- grant direct database access to `ledgerly_api`;
- verify an empty canonical and legacy baseline;
- terminate sessions connected to that exact disposable database after the
  suite; and
- drop that exact disposable database.

The provisioner must refuse to operate when:

- the target is the normal development database;
- the target is a production database;
- the generated name does not match the strict test allowlist;
- any canonical or legacy row exists before test setup;
- expected ownership, grants, functions, or trigger states differ; or
- a credential or connection string would be printed.

No administrative connection or password may be passed into the application
test process.

### 6.3 Test-process connection

The canonical test child process receives an ephemeral `DATABASE_URL` that
selects the disposable database but authenticates directly as
`ledgerly_api`.

This value:

- exists only for the child test process;
- does not modify the workspace development secret;
- is not inherited by the API workflow;
- is never printed, persisted, committed, or placed in test output; and
- is cleared when the process exits.

The test must assert `current_user` and `session_user` are both
`ledgerly_api` before inserting fixtures.

### 6.4 Concurrency and multi-connection behavior

Concurrency tests open at least two independent pool connections to the same
disposable database and run the actual public canonical command concurrently.

They must prove:

- one durable effect for the same idempotency identity;
- one linked journal for the winning effect;
- retry-safe equivalent results;
- no partial journal, line, relation, effect, or audit graph;
- actual lock/uniqueness behavior across connections;
- deterministic retry behavior after lock timeout or deadlock where tested; and
- no use of a privileged session.

Tests must not be serialized onto one transaction merely to make rollback easy.

### 6.5 Preventing normal-development contamination

Before the suite:

- capture read-only normal-development counts for the five canonical tables,
  legacy `journal_entries`, and `Canonical posting %` companies;
- verify the test database name differs from the normal development database;
  and
- verify the disposable baseline is empty.

After the suite and after disposable-database disposal:

- re-read the normal-development counts;
- require byte-for-byte equality of the captured count manifest;
- require the normal API identity and health check to remain unchanged; and
- fail verification if any new normal-development fixture is found.

No canonical row-cleanup hook may remain in the test suite.

## 7. Required implementation changes if later authorised

Only the following changes would be in scope:

1. Add a test-only administrative provision/dispose command with strict
   database-name and environment guards.
2. Add a schema-only test bootstrap that reproduces the approved development
   schema, ownership, ACL, guard functions, and `ENABLE ALWAYS` trigger state.
3. Change the canonical integration-test command to:
   - provision the disposable database;
   - launch the suite with its ephemeral API-role connection;
   - close all pools;
   - dispose of the database in a final administrative step; and
   - verify the normal-development before/after manifest.
4. Remove canonical row deletion from `cleanCompanies` and other teardown
   paths.
5. Preserve unique per-test company, source, effect, and idempotency identities
   so tests can coexist inside one disposable run without row cleanup.
6. Add explicit runtime-identity, empty-baseline, privilege, ownership, and
   trigger-state assertions to the suite.

No application posting behavior, production code path, canonical schema,
normal-development secret, or runtime role grant is approved to change by this
package.

## 8. Test-isolation privilege boundary

| Principal | Permitted | Prohibited |
|---|---|---|
| `ledgerly_api` test process | Same direct login and exact DML/EXECUTE rights as approved development API | Canonical update/delete/truncate, trigger changes, ownership, role assumption, database create/drop |
| `ledgerly_canonical_owner` | Own protected test-database objects and guard functions | Login, test execution, ordinary application access |
| Administrative provisioner | Strictly allowlisted disposable database create/bootstrap/verify/drop | Application test execution, production access, broad row cleanup, normal-development database disposal |
| Normal development API | Continue current RS-01 runtime behavior | Awareness of or access to the disposable database |

The test environment is valid only if the API-role privilege matrix matches the
approved normal-development matrix.

## 9. Required regression and acceptance evidence

A later authorised implementation must pass:

1. direct disposable-session identity checks;
2. complete role, ownership, ACL, grant-option, membership, function-owner, and
   trigger-state checks;
3. permitted ordinary application DML;
4. permitted canonical inserts and only the approved effect transitions;
5. rejected canonical header, line, relation, and audit mutation;
6. rejected effect identity changes and invalid status transitions;
7. balanced posting, idempotent retry, correction, reversal, SC-01 identity,
   company isolation, final revalidation, failure injection, and concurrency;
8. BL-01-FI company-scope tests;
9. existing matcher, collections, VAT scenario, Phase 5, and Phase 6 suites;
10. the VAT integration suite where its own fixture isolation is confirmed;
11. workspace typecheck and API build;
12. API restart, scheduler access, logs, and health;
13. empty disposable baseline and successful database disposal; and
14. unchanged normal-development canonical, legacy, and fixture manifests.

The test command must also prove that a forced test failure still disposes of
only the exact disposable database and never attempts canonical row deletion.

## 10. Test-isolation stop conditions

Stop without broadening access if:

- schema-only provisioning cannot reproduce the approved trigger and ownership
  boundary;
- the test requires a privileged application connection;
- the disposable target cannot be distinguished conclusively from development
  and production;
- a child process could inherit administrative credentials;
- the suite can fall back to the normal development database;
- the concurrency test requires trigger suspension or canonical cleanup;
- normal-development counts change;
- the disposable database cannot be dropped without affecting another
  consumer;
- any connection string or credential would be logged; or
- implementation expands beyond test harness/configuration work.

## 11. Existing fixture classification

The retained rows are:

- synthetic;
- development-only;
- created by the controlled canonical integration fixture;
- structurally valid and internally linked;
- unrelated to legacy `journal_entries`;
- not evidence of a real customer transaction or business accounting event;
  and
- currently protected by the same canonical database boundary as all other
  posted rows.

This classification permits an approval request for #40's isolated test reset.
It does not let the application treat the rows as drafts, delete them through
generic CRUD, or manufacture accounting reversals to make them disappear.

An accounting reversal or correction is not the right disposition:

- it would preserve rather than remove the synthetic fixture graph;
- it would create additional synthetic posted accounting and audit evidence;
- it would misstate the reason as an accounting event; and
- it would confuse operational test hygiene with business accounting semantics.

## 12. Selected one-time fixture-disposition mechanism

### 12.1 Selection

Use one explicit development-only administrative isolated-test reset against
the exact six-company allowlist in section 4.

This is an exceptional test-environment hygiene operation under #40 section
18.2. It is not an ordinary accounting correction, DEC-18 lifecycle deletion
for real business evidence, an API capability, or a reusable product feature.

Because the approved `ENABLE ALWAYS` guards correctly reject canonical
deletion, the operation requires a separately approved, temporary
administrative exception. Approval must name the exact five triggers and six
company IDs. No general cleanup authority may remain afterward.

### 12.2 Required evidence before any reset

Before a later reset may begin:

1. stop only the development API workflow to prevent concurrent writes;
2. confirm the target is the development `heliumdb` database and not
   production;
3. verify the session is administrative and not `ledgerly_api`;
4. recapture the exact allowlisted company graph, row counts, source families,
   actor prefixes, statuses, balances, and relationship integrity;
5. prove there are no inbound references from a non-allowlisted company or
   non-fixture record;
6. capture a machine-readable before-manifest with IDs, counts, and content
   hashes in a governed execution record outside the application database;
7. capture total counts and hashes for every unaffected canonical and legacy
   row set; and
8. abort on any difference from the approved provenance in section 4.

The approval must be cancelled rather than widened if any affected row no
longer matches the exact fixture graph.

### 12.3 Atomic administrative reset

If later and separately authorised, the reset must run as one administrative
transaction with an exclusive maintenance boundary:

1. acquire an administrative advisory lock dedicated to this one-time reset;
2. lock the five canonical tables and affected ordinary fixture tables against
   concurrent writes;
3. temporarily suspend only the five named #44 guard triggers, never foreign
   key or unrelated constraint triggers;
4. delete only rows whose `company_id` is in the exact six-ID allowlist, in a
   foreign-key-safe order:
   - allowlisted accounting audit events;
   - allowlisted canonical relations;
   - allowlisted canonical lines;
   - allowlisted posting effects;
   - allowlisted canonical journal headers;
   - allowlisted company memberships;
   - allowlisted chart-of-account rows;
   - the six allowlisted companies;
5. re-enable each named guard trigger with `ENABLE ALWAYS` before commit;
6. re-run trigger, function-owner, table-owner, role, ACL, and no-membership
   checks;
7. prove every allowlisted row is absent;
8. prove all non-allowlisted canonical and legacy counts and hashes are
   unchanged; and
9. commit only when every check passes.

Any error must roll back the complete transaction, including trigger-state
changes. No partial reset is acceptable.

### 12.4 Audit evidence for the reset

The reset must produce a durable governed execution record outside the rows
being removed. It must contain:

- the approved package reference;
- development-only target metadata without credentials;
- operator and reviewer identity;
- start and completion timestamps;
- exact six-company allowlist;
- named triggers temporarily suspended and restored;
- before and after counts and hashes;
- all verification outcomes;
- transaction commit or rollback outcome; and
- confirmation that production was not contacted.

Do not insert a misleading business accounting event or correction merely to
audit administrative test-fixture disposal.

### 12.5 After the reset

After a successful reset:

1. restart only the development API workflow;
2. verify direct `ledgerly_api` identity;
3. verify all five triggers remain `ENABLE ALWAYS`;
4. rerun the complete RS-01 privilege and mutation-resistance matrix;
5. rerun health and scheduler access;
6. run canonical tests only through the approved disposable-database harness;
7. prove the normal development database remains fixture-free; and
8. keep production posting disabled.

## 13. Fixture-disposition privilege boundary

The one-time reset must never:

- grant canonical mutation rights to `ledgerly_api`;
- make `ledgerly_api` a member of the owner or administrative role;
- expose the operation through an API route, UI, generic CRUD, function
  executable by `ledgerly_api`, migration, or recurring script;
- use a company-name wildcard as the deletion authority;
- affect rows outside the exact six-company allowlist;
- delete real business accounting or audit evidence;
- be reused for production or ordinary development cleanup; or
- remain installed as latent administrative functionality.

If a safe, atomic, exact reset cannot be proved, the fixtures must remain
retained and isolated. Failure to dispose of synthetic fixtures is safer than
weakening canonical immutability.

## 14. Fixture-disposition stop conditions

Stop without cleanup if:

- any listed company or canonical row has changed since the evidence capture;
- any non-fixture row refers to the allowlisted graph;
- an affected source, actor, or company no longer has unambiguous synthetic
  provenance;
- any trigger cannot be restored to `ENABLE ALWAYS` inside the transaction;
- any ownership, role, ACL, or function-security check changes;
- the operation requires a persistent bypass;
- the operation cannot preserve unaffected rows byte-for-byte;
- the administrative evidence record cannot be produced;
- the target could be production;
- production credentials or data are encountered; or
- the reset would become an ordinary accounting-deletion path.

## 15. Unrelated mockup build issue

The workspace-wide build currently reaches the mockup sandbox and fails because
that artifact's Vite configuration requires a `PORT` environment variable
during build. The API-specific build and workspace typecheck pass.

This issue is unrelated and non-blocking for the present test-isolation and
fixture-disposition decision. It does not justify broadening database access or
expanding this package. If later investigation shows a shared configuration
dependency, that finding requires separate scope and approval.

## 16. Approval choices

### Approve

Approval means:

- accept the schema-only disposable-database design as the required canonical
  integration-test boundary;
- accept the exact one-time administrative isolated-test reset design;
- preserve every privilege and production boundary in this package; and
- require a later explicit implementation instruction before any change.

### Reject

Rejection means:

- do not refactor the tests;
- do not dispose of the retained fixtures;
- leave RS-01 protections in place;
- keep Task #46 incomplete; and
- keep production posting disabled.

No partial approval should be inferred from discussion or from the existence of
the retained fixtures.

READY FOR TEST-ISOLATION / FIXTURE-DISPOSITION APPROVAL