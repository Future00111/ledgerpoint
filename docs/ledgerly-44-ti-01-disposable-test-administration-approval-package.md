# #44-TI-01 Disposable Canonical Test Database Administration

**Parent:** `#44 — Canonical Posting Safety Enforcement`  
**Related implementation:** `#44-TR-01 — Transactional Authority Provider and Final Revalidation`  
**Status:** Planning and approval package only  
**Environment:** Development only  
**Prepared:** 2026-08-26  

> This document defines a possible narrow administrative boundary for the
> already approved disposable canonical integration-test model. It does not
> implement TI-01, resume TR-01, change application code, change database
> state, or grant approval to operate an administrative channel.

## 1. Decision requested

The decision requested is whether a separately authorised, development-only
administrative plane can be made available for one cryptographically bound
canonical integration-test run at a time.

The required plane would provision and destroy only an exact disposable
PostgreSQL database. The canonical test process would remain a separate,
non-administrative process running only as `ledgerly_api`.

The current workspace does not expose a supported administrative plane with the
required capabilities. The package therefore does not request permission to
broaden `ledgerly_api`, expose a PostgreSQL administrator credential, or add an
application-facing administration mechanism.

## 2. Current blocker

The following state was verified from the existing runner contract, prior
disposable-run evidence, the current development database identity, and the
current platform capability documentation:

- The normal development database is `heliumdb`.
- The normal API identity is `ledgerly_api`.
- The normal managed SQL channel currently authenticates as both:
  - `current_user = ledgerly_api`;
  - `session_user = ledgerly_api`.
- `ledgerly_api` is intentionally not the PostgreSQL administrative identity.
- The canonical disposable runner requires:
  - `LEDGERLY_CANONICAL_TEST_DATABASE_URL`;
  - `LEDGERLY_CANONICAL_TEST_DATABASE_NAME`;
  - `LEDGERLY_CANONICAL_TEST_RUN_ID`;
  - `LEDGERLY_CANONICAL_TEST_RUN_NONCE`;
  - `LEDGERLY_CANONICAL_TEST_ENVIRONMENT`;
  - schema, Drizzle configuration, and RS-01 overlay SHA-256 bindings.
- Those disposable-run values are not available in the current workspace
  invocation.
- The runner refuses to fall back to `heliumdb` and stops before fixture
  insertion when the values are absent.
- The available managed PostgreSQL capability does not provide supported
  operations for:
  - `CREATE DATABASE`;
  - `DROP DATABASE`;
  - terminating database sessions;
  - running as the PostgreSQL `postgres` superuser.
- `heliumdb` must never be used as the disposable-test fallback.
- The existing TR-01 implementation is partial and remains blocked before
  disposable database validation.

Broadening `ledgerly_api` is prohibited. The application role must not receive
database creation, database destruction, session-termination, role-assumption,
ownership, trigger, or superuser privileges.

### Evidence consulted

- `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs`
- `docs/ledgerly-44-test-isolation-and-development-fixture-disposition-approval-package.md`
- `docs/governance/evidence/ledgerly-44-disposable-test-87b46859-6c8d-4aa9-bcf8-3f4a4ec3055b.json`
- `docs/governance/evidence/ledgerly-44-disposable-test-0a0a8313-d39c-4b29-8f6e-77c031dfaeb9.json`
- Read-only current development identity check
- Replit documentation:
  - [SQL Database](https://docs.replit.com/features/data-and-storage/sql-database)
  - [Development and production databases](https://docs.replit.com/features/data-and-storage/development-and-production)

## 3. Purpose and bounded scope

If a supported secure administrative plane later becomes available, TI-01
would be limited to enabling the already approved test-isolation contract:

1. Provision a fresh ephemeral PostgreSQL database.
2. Bind it to exactly one authorised test run.
3. Bootstrap the approved application schema and RS-01 disposable overlay.
4. Grant the same approved direct runtime access to `ledgerly_api`.
5. Run the canonical suite only against that database and only as
   `ledgerly_api`.
6. Verify runtime identity, protected objects, empty baseline, test result, and
   normal-development equality.
7. Close all test connections.
8. Terminate only bound disposable sessions if needed.
9. Drop only the exact bound disposable database.
10. Preserve non-secret evidence of the complete lifecycle.

TI-01 would not:

- alter canonical posting behavior;
- implement or resume TR-01;
- add source-authority tables;
- change application schema;
- modify normal development data;
- modify production data or configuration;
- modify RLS;
- change roles or role memberships in the normal database;
- weaken RS-01;
- create a reusable admin API;
- make `ledgerly_api` an administrator;
- mark `#44` complete;
- resume `#40-CF-01`;
- enable production posting;
- execute `#41`.

## 4. Administrative channel

### 4.1 Required separation

TI-01 requires two trust boundaries:

| Plane | Principal | Permitted responsibility | Prohibited responsibility |
|---|---|---|---|
| Admin plane | Separately authorised development PostgreSQL administrator supplied by a supported platform operation | Create, bind, bootstrap, verify, terminate exact bound sessions, and drop one exact disposable database | Application requests, production access, generic database management, unknown database names, test execution |
| Test/application plane | `ledgerly_api` | Connect to the exact bound disposable database and run the canonical suite with approved DML/EXECUTE rights | Database create/drop, session termination, role assumption, ownership, trigger changes, canonical destructive mutation |

The admin plane must not be inherited by the test child process, API workflow,
application routes, build process, or evidence collector.

### 4.2 Capability assessment

The available Replit-managed PostgreSQL capability was checked against the
required bounded operations:

| Operation | Required | Current supported capability verified? |
|---|---:|---:|
| Create exact ephemeral database | Yes | No |
| Store immutable private run binding before test access | Yes | No supported project-accessible path verified |
| Apply exact schema bootstrap | Yes | Not reachable through an approved admin plane |
| Apply exact RS-01 overlay | Yes | Not reachable through an approved admin plane |
| Grant direct disposable access to `ledgerly_api` | Yes | Not reachable through an approved admin plane |
| Verify database metadata as administrator | Yes | No |
| Terminate only exact bound sessions | Yes | No |
| Drop exact bound database | Yes | No |
| Run canonical suite as `ledgerly_api` | Yes | Existing runner supports this once a bound URL exists |

Replit’s documented managed PostgreSQL capability does not support the
superuser-level database lifecycle operations required here. No supported
platform operation was verified that can replace the missing admin plane
without exposing an administrator credential to project code.

### 4.3 No workaround is approved

The following alternatives are explicitly rejected:

- granting `CREATEDB`, `SUPERUSER`, role membership, or equivalent rights to
  `ledgerly_api`;
- storing a PostgreSQL administrator password or connection string in a Replit
  Secret for application or test use;
- adding a generic `/admin/database` endpoint;
- adding a reusable project script that accepts arbitrary database names;
- running `CREATE DATABASE` or `DROP DATABASE` from the test child process;
- using `heliumdb` and deleting rows afterward;
- disabling or bypassing RS-01 protections;
- using a production database or production administrator;
- relying on a database name prefix without an immutable run binding;
- asking the test process to clean up a database it did not securely bind.

If a future platform mechanism requires any of these, the correct result is
`NOT READY`, not an implementation compromise.

## 5. Immutable per-run binding

### 5.1 Required binding values

Each authorised run must receive a fresh version-4 UUID and a cryptographically
random nonce. The disposable database name must be exactly:

```text
ledgerly_canonical_test_<run UUID with hyphens removed and lowercased>
```

The immutable binding must include:

- run UUID;
- exact derived database name;
- environment marker:
  `development-disposable-test`;
- expected creator identity:
  `postgres`;
- expected runtime identity:
  `ledgerly_api`;
- random per-run nonce;
- nonce SHA-256;
- application schema SHA-256;
- Drizzle configuration SHA-256;
- RS-01 overlay SHA-256;
- expected test command:
  `pnpm --filter @workspace/api-server run test:canonical-posting`;
- creation timestamp;
- expiry timestamp or maximum run lifetime;
- normal development endpoint and database identity;
- explicit prohibition on `heliumdb`;
- explicit prohibition on production/deployment endpoints.

The binding must also identify the approved project/task context without using
that context as a substitute for exact database identity.

### 5.2 Storage and verification

The run binding should be stored in a private control schema in the exact
disposable database before the database is exposed to the test process:

- schema: `ledgerly_test_control`;
- table: `run_identity`;
- owner: `postgres`;
- immutable single row for the run;
- no `USAGE` or table privileges for `PUBLIC`;
- no `USAGE` or table privileges for `ledgerly_api`;
- no `USAGE` or table privileges for `ledgerly_canonical_owner`.

The row must be inserted once, never updated, and must contain all values needed
for independent cleanup authorization.

The runtime test process must verify the binding through a narrowly scoped
read/verification function exposed by the approved disposable overlay. It must
not receive administrative credentials or control-schema privileges.

Cleanup must independently compare:

- database name;
- run UUID;
- environment marker;
- creator;
- schema/configuration/overlay digests;
- nonce;
- external evidence record;
- exact target endpoint.

A name or prefix match alone is not authorization.

## 6. Secure connection delivery

### 6.1 Runtime variable

The test child process must receive the disposable API-role connection through:

```text
LEDGERLY_CANONICAL_TEST_DATABASE_URL
```

The value must be:

- generated for one run;
- valid only for the exact disposable database;
- authenticated as `ledgerly_api`;
- available only to the authorised invocation;
- absent from repository files;
- absent from normal workspace configuration;
- absent from the normal `DATABASE_URL`;
- absent from the API workflow;
- absent from evidence and logs;
- removed after the child process exits.

The existing normal `DATABASE_URL` must continue to identify
`ledgerly_api` on `heliumdb`. It must never be overwritten, temporarily
repointed, or used to select the disposable target.

### 6.2 Child environment scrubbing

The existing non-privileged coordinator must remove administrative and
run-binding values from the child environment where the approved isolation
design requires it. At minimum, the child must not inherit:

- an administrator connection string;
- an administrator password;
- `LEDGERLY_CANONICAL_TEST_DATABASE_URL` if the child receives its sanitized
  `DATABASE_URL` through the approved handoff model;
- nonce material when no longer required;
- platform control-plane credentials;
- unrelated `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, or `PGDATABASE`
  overrides.

No value containing a password or credential may be printed by the coordinator,
test process, workflow, evidence serializer, or error handler.

### 6.3 Authentication boundary

The disposable connection must authenticate directly as `ledgerly_api` using
the platform-managed database credential delivery mechanism. The application
must not know, derive, request, or store the `postgres` credential.

If the platform cannot provide a direct disposable `ledgerly_api` connection
without exposing its password or an administrator credential to project code,
TI-01 is not ready.

## 7. Exact bootstrap sequence

The future admin-plane operation must execute the following sequence against
the exact generated target, not against `heliumdb`:

1. Generate the run UUID, derived database name, nonce, expiry, and source
   digests outside the test/application process.
2. Verify the development endpoint and reject production/deployment endpoints.
3. Verify the administrator identity is the separately authorised development
   `postgres` identity.
4. Verify the generated database name matches the strict allowlist.
5. Verify the target name is not `heliumdb` and is not any production database.
6. Verify no pre-existing database with the generated name is accepted as the
   target.
7. Create the empty disposable database.
8. Create the private `ledgerly_test_control` schema and immutable binding row
   before granting runtime access.
9. Apply the authoritative application schema from:
   `lib/db/src/schema/index.ts`, using the reviewed
   `lib/db/drizzle.config.ts`.
10. Apply the reviewed
    `scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql`.
11. Verify the overlay created the approved:
    - `ledgerly_canonical_owner` object ownership;
    - `ledgerly_api` grants;
    - database and `public` schema ACL;
    - fixed-search-path guard functions;
    - canonical constraints and indexes;
    - five named `ENABLE ALWAYS` triggers.
12. Verify the immutable run binding from the admin plane.
13. Verify the empty canonical and legacy baseline.
14. Grant only the approved direct runtime access to `ledgerly_api`.
15. Deliver the exact disposable URL and non-secret binding values to the
    authorised test invocation.
16. Require the test process to verify `current_database()`,
    `current_user`, `session_user`, binding, trigger state, and baseline before
    the first fixture insert.

The bootstrap must not add a permanent schema object to the normal development
database. If bootstrap requires a new permanent schema, role, privilege,
trigger, RLS, or migration change, TI-01 must stop and require separate
approval.

## 8. Normal development database protection

The normal development database remains outside the test target and outside
the admin operation’s allowed database set.

### 8.1 Before-run checks

Before the suite starts, the authorised coordinator must capture a read-only
manifest for `heliumdb` containing:

- current database;
- current user and session user;
- canonical posting effects;
- canonical journal entries;
- canonical journal lines;
- canonical journal relations;
- accounting audit events;
- legacy `journal_entries`;
- `Canonical posting %` companies;
- relevant schema/trigger/role-state identifiers where available.

For each manifest subject, capture a deterministic count and row-content
SHA-256. The coordinator must also verify:

- the disposable target name differs from `heliumdb`;
- the disposable endpoint matches the approved development endpoint;
- the disposable baseline is empty;
- the test child has no administrative environment;
- the run binding matches the exact target.

### 8.2 Target-equality and override rejection

The coordinator must reject the run if:

- the normal URL is not `ledgerly_api` on `heliumdb`;
- the disposable URL is not `ledgerly_api` on the exact generated name;
- the endpoints differ unexpectedly;
- a URI query parameter can redirect, select, or override the target;
- a `PG*` variable overrides the bound target;
- the target is `heliumdb`;
- the target is production or deployment infrastructure;
- the database name is not an exact run-derived allowlisted name.

The existing runner already rejects unsafe URI overrides and mismatched target
identity. Those checks must remain fail-closed.

### 8.3 After-run checks

After test completion and after disposable disposal, the coordinator must
re-read the `heliumdb` manifest and require byte-for-byte equality for:

- canonical effects;
- canonical journals;
- canonical lines;
- canonical relations;
- accounting audits;
- legacy journals;
- canonical test-company counts;
- relevant role/trigger/schema state.

The normal API identity and health check must remain unchanged. Any difference
blocks completion and requires investigation; no compensating cleanup is
authorised.

## 9. Cleanup

Cleanup must be safe on success, assertion failure, test failure, process
termination, and coordinator failure.

### 9.1 Normal cleanup sequence

1. Record the test result without recording credentials or connection strings.
2. Close every `ledgerly_api` test pool and child-process connection.
3. Verify no expected `ledgerly_api` sessions remain on the exact disposable
   database.
4. If sessions remain, verify each session belongs to the exact bound database,
   exact run, and expected runtime principal.
5. Terminate only those exact sessions through the admin plane if required.
6. Re-verify that no unexpected session or normal API workflow is connected.
7. Re-verify the complete immutable binding.
8. Drop only the exact UUID-derived disposable database.
9. Verify the database no longer exists.
10. Verify the normal-development manifest is unchanged.
11. Record creation, bootstrap, test, cleanup, and destruction evidence.

### 9.2 Cleanup prohibitions

Cleanup must never:

- issue wildcard database deletion;
- delete by prefix alone;
- truncate or delete canonical rows as test teardown;
- run as `ledgerly_api`;
- use the normal development database;
- terminate sessions outside the exact bound database;
- drop a database when binding evidence is missing or inconsistent;
- continue after a target identity mismatch;
- log an administrator credential or connection string.

If exact cleanup cannot be guaranteed, the run must be marked failed and the
database must remain untouched until an independently authorised operator can
verify the binding.

## 10. Crash and abandoned-run handling

An abandoned database may be considered for cleanup only when all of the
following are true:

- its name matches the strict `ledgerly_canonical_test_<32 hex>` format;
- its private binding row exists and is readable only through the approved
  administrative path;
- its run UUID, derived name, environment, creator, source digests, overlay
  digest, and nonce match external evidence;
- it is not `heliumdb`;
- it is not a production or deployment database;
- its expiry has passed or the authorised run is explicitly failed;
- no active authorised test run owns the binding;
- no normal API workflow is attached;
- cleanup evidence will identify the exact run and target.

The cleanup operation must refuse arbitrary caller-supplied names. It must not
accept a prefix, substring, or unverified external claim as authority.

Suggested expiry policy for later approval:

- a short active-run lease sufficient for bootstrap, test, and cleanup;
- an explicit failed/abandoned state in external evidence;
- a separate review requirement before deleting an expired run;
- no automatic deletion if the internal and external bindings disagree;
- retention of non-secret lifecycle evidence after destruction.

No reusable cleanup service is approved by this package.

## 11. Non-secret evidence

The future run must produce evidence sufficient for independent review without
containing passwords, connection strings, tokens, or secret environment values.

### 11.1 Authorization evidence

- operator or platform operation identity class;
- development-only environment marker;
- administrator identity class, recorded as `postgres` without credentials;
- approval/run reference;
- authorization timestamp;
- allowed operation set;
- refusal evidence for production and `heliumdb`.

### 11.2 Binding evidence

- run UUID;
- derived database name;
- environment marker;
- expected creator;
- expected runtime role;
- creation and expiry timestamps;
- nonce SHA-256, never the nonce;
- schema/configuration/overlay SHA-256 digests;
- expected command;
- exact endpoint identity without credentials.

### 11.3 Bootstrap evidence

- schema source digest;
- Drizzle configuration digest;
- RS-01 overlay digest;
- bootstrap exit status;
- ownership and ACL verification;
- function-owner and fixed-search-path verification;
- constraint/index verification;
- trigger names and `ENABLE ALWAYS` state;
- empty baseline counts and hashes.

### 11.4 Runtime and test evidence

- disposable database name;
- `current_database()`;
- `current_user = ledgerly_api`;
- `session_user = ledgerly_api`;
- private binding verification result;
- test start/end timestamps;
- test command identity;
- result and failure classification;
- two-connection concurrency identities and barrier evidence where applicable;
- no-privileged-session evidence.

### 11.5 Protection and cleanup evidence

- `heliumdb` before/after manifests;
- exact target-equality checks;
- child environment scrubbing result;
- expected session count before cleanup;
- sessions terminated, if any, limited to the exact target;
- database destruction result;
- post-destruction existence check;
- database-dropped timestamp;
- abandonment/expiry evidence where applicable.

Evidence must be hashed or identity-based where appropriate and must never
contain:

- passwords;
- administrator URLs;
- `DATABASE_URL` values;
- bearer tokens;
- secret environment dumps;
- private keys;
- session cookies.

## 12. Security review

### 12.1 Credential leakage

**Threat:** An administrator password, URL, or token reaches source, child
environment, logs, evidence, or chat.

**Control:** The admin operation must be outside application code; secrets must
be ephemeral and scoped to the admin plane; the child environment must be
sanitized; evidence must use hashes and identity classes only.

**Stop condition:** Any required credential exposure to project code returns
`NOT READY`.

### 12.2 Environment inheritance

**Threat:** The test child inherits an admin connection or a `PG*` override and
connects with elevated rights or to the wrong target.

**Control:** Construct an explicit child environment, remove administrative and
ambiguous connection variables, and verify runtime identity before fixtures.

### 12.3 Command injection

**Threat:** A run name, command, or environment value is passed to a shell
without validation.

**Control:** Use fixed command arguments, strict UUID/name allowlists, no
free-form SQL identifiers, and no shell interpolation for secrets or target
names.

### 12.4 Database-name injection

**Threat:** A caller selects an unrelated database using a crafted name or URI.

**Control:** Derive the name only from a fresh UUID; compare the exact internal
binding and external evidence; reject all caller-selected arbitrary names.

### 12.5 Accidental `heliumdb` connection

**Threat:** Missing disposable values cause the suite to use the normal
development database.

**Control:** Fail closed when any disposable binding value is absent; require
exact target inequality; preserve the runner’s no-fallback behavior.

### 12.6 Production connection

**Threat:** The admin plane or test child reaches production/deployment
infrastructure.

**Control:** Development endpoint equality checks, explicit deployment
environment rejection, allowlisted database names, no production credentials,
and no production contact in the test workflow.

### 12.7 Forged run metadata

**Threat:** A test process or attacker fabricates a run ID, digest, or database
name.

**Control:** The admin plane creates the immutable private row before runtime
access; external evidence and internal binding must agree; the runtime verifies
the binding through the approved disposable function.

### 12.8 Stale authorization

**Threat:** An expired or abandoned run is reused.

**Control:** Include creation/expiry timestamps, explicit run state, one-time
nonce, and exact cleanup authorization. Refuse expired or conflicting runs.

### 12.9 Cleanup of another run

**Threat:** A cleanup request terminates sessions or drops another run’s
database.

**Control:** Require exact UUID/name/creator/environment/digest/nonce-hash
agreement and external evidence; never accept prefix-only deletion.

### 12.10 Privilege escalation by `ledgerly_api`

**Threat:** Tests or application code attempt database administration.

**Control:** Keep the runtime role non-administrative; verify grants,
ownership, role attributes, and prohibited operations on the disposable
database before tests.

### 12.11 Malicious test process

**Threat:** A test process uses inherited environment or SQL access to escape
its database boundary.

**Control:** Provide only direct API-role access; remove admin values; restrict
the target; preserve RS-01 `ENABLE ALWAYS` protections; independently inspect
the child result and cleanup.

### 12.12 Evidence leakage

**Threat:** Diagnostic output serializes a full environment or connection URI.

**Control:** Structured allowlisted evidence fields only; hash sensitive
binding material; prohibit environment dumps and raw driver configuration.

## 13. Expected TI-01 implementation impact

TI-01, if later authorised, should be implemented primarily outside normal
application runtime.

### 13.1 External resources required

The following are required but are not currently available through the
workspace:

1. A supported Replit-managed or separately authorised development
   administrative operation with exact `postgres`-level database lifecycle
   capability.
2. A secure per-run handoff for an API-role disposable connection.
3. A private run-control binding mechanism in the disposable database.
4. An external non-secret evidence store or approved evidence artifact path.
5. A cleanup operation with exact binding checks and no wildcard behavior.

The external operation must not become an application dependency or a generic
database-management service.

### 13.2 Existing project resources that would be consumed

The later operation would consume, without changing their normal-development
meaning:

- `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs`;
- `scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql`;
- `lib/db/src/schema/index.ts`;
- `lib/db/drizzle.config.ts`;
- the existing `ledgerly_api` and `ledgerly_canonical_owner` role boundary;
- the existing disposable-run evidence model;
- the existing canonical test command.

Any change to those resources would require a separate implementation review if
it changes the approved contract, digest, ownership, privileges, triggers,
application behavior, or cleanup boundary.

### 13.3 Changes explicitly not required or permitted

TI-01 must not require:

- a normal `DATABASE_URL` change;
- a new application secret containing `postgres` credentials;
- a project-accessible admin credential;
- an elevated `ledgerly_api`;
- a generic administration route;
- a normal development schema migration;
- a production schema or role change;
- a deployment change;
- an RLS change;
- an application posting change;
- canonical row deletion or teardown cleanup;
- a new permanent development database.

If any of those become necessary, return `NOT READY` and request a separate
approval package rather than expanding TI-01.

## 14. TR-01 resumption boundary

TI-01 must not mark TR-01 complete.

If TI-01 is later implemented and independently reviewed successfully, the
existing partial TR-01 implementation may resume only to:

- execute the approved adversarial matrix in a bound disposable database;
- correct application/test issues inside the already approved TR-01 scope;
- complete runtime/database verification;
- produce the TR-01 implementation report;
- request the independent post-implementation review.

TI-01 does not authorize:

- new authoritative source/product tables;
- migrations;
- role or privilege changes;
- trigger changes;
- RLS;
- production posting;
- BL-06 or BL-07;
- `#40-CF-01`;
- `#41`;
- completion of `#44`.

## 15. Production boundary

This package is development-only.

There must be no:

- production database access;
- production role or secret access;
- deployment or publishing;
- production posting;
- production migration or cutover;
- RLS work;
- BL-06 execution;
- BL-07 execution;
- `#41` execution.

Production posting remains disabled.

## 16. Governance and current status

The following status must remain unchanged:

- DEC-01 through DEC-22 remain approved;
- no DEC-23 is introduced;
- DEC-12 remains the Payment, Allocation and Settlement Policy;
- source freshness remains implementation-level;
- BL-06 remains blocked;
- BL-07 remains blocked;
- `#40-CF-01` remains incomplete;
- `#44` remains incomplete;
- `#44-TR-01` remains partial/incomplete;
- `#44-SC-01` remains complete;
- `#44-RS-01` remains complete;
- production posting remains disabled.

No task state is changed by this planning package.

## 17. Stop conditions

TI-01 must return `NOT READY` and must not implement when:

- no supported secure admin plane exists;
- administrator credentials must enter application or test-process scope;
- `ledgerly_api` must be elevated;
- `heliumdb` must be used for disposable fixtures;
- production connectivity is required;
- run binding cannot be enforced before runtime access;
- exact database cleanup cannot be guaranteed;
- bootstrap cannot reproduce RS-01 protections;
- internal and external bindings cannot be compared;
- a child process can inherit administrative credentials;
- a cleanup operation accepts arbitrary database names;
- evidence would contain secrets;
- a permanent schema, role, privilege, trigger, RLS, migration, or production
  change is required;
- any proposed solution expands beyond a development-only external
  administration and evidence boundary.

The current workspace meets the first stop condition and lacks the required
bound disposable-run environment. Therefore no TI-01 implementation is
authorised by this package.

NOT READY — SECURE DISPOSABLE TEST ADMINISTRATION GAP REMAINS