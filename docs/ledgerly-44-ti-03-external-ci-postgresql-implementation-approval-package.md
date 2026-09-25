# #44-TI-03 External CI Disposable PostgreSQL Harness

**Parent:** `#44 — Canonical Posting Safety Enforcement`  
**Related implementation:** `#44-TR-01 — Transactional Authority Provider and Final Revalidation`  
**Predecessors:** `#44-TI-01`, `#44-TI-02`  
**Selected architecture:** External Linux CI job with a fresh, pinned PostgreSQL
16 service container per authorised test run  
**Status:** Planning and implementation-approval package only  
**Prepared:** 2026-08-26  

> This package converts the selected TI-02 architecture into an
> implementation-ready development/test design. It does not create or configure
> CI, create an external account, pull or start a container, connect to any
> database, change a workflow, change a secret, modify application or test code,
> resume TR-01, or change any task state.

## 1. Decision requested

Approval is requested for a later, separately executed implementation of one
external CI harness that:

1. runs on a trusted Linux CI worker;
2. creates a fresh PostgreSQL 16 service container for one authorised run;
3. reproduces the approved Ledgerly disposable-database role, schema, SC-01,
   RS-01, and run-binding state;
4. runs the canonical suite only as `ledgerly_api`;
5. provides synchronized independent PostgreSQL connections for the outstanding
   TR-01 adversarial matrix;
6. emits machine-readable, non-secret evidence;
7. destroys the database container and all credentials at job end; and
8. has no Replit development or production credential, endpoint, or data.

This package does not itself grant that implementation approval. A later user
instruction must explicitly approve TI-03 implementation.

## 2. Current repository and CI state

The repository was inspected read-only.

Current facts:

- the Git remote includes a GitHub origin for the Ledgerly repository;
- no `.github/workflows` directory or other repository CI configuration was
  found;
- the current Replit workflows are application-preview workflows, not
  disposable integration-test infrastructure;
- the current workspace runtime is Node `24.13.0` and pnpm `10.26.1`;
- the existing fixed canonical command is:
  `pnpm --filter @workspace/api-server run test:canonical-posting`;
- that command invokes
  `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs`;
- the runner currently requires a Replit development environment, a normal
  `ledgerly_api`/`heliumdb` `DATABASE_URL`, and same-endpoint equality;
- those requirements intentionally prevent using an external CI target without
  a reviewed runner adaptation;
- the application schema remains authoritative at
  `lib/db/src/schema/index.ts`, selected by
  `lib/db/drizzle.config.ts`;
- the RS-01 disposable security overlay remains authoritative at
  `scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql`.

There is therefore no existing repository-integrated CI workflow to reuse
unchanged.

## 3. Proposed CI platform boundary

### 3.1 Proposed provider

The proposed provider is **GitHub Actions** because:

- the repository already has a GitHub origin;
- GitHub Actions supports Linux workers and Docker service containers;
- CI run identity, attempt identity, job identity, protected environments,
  read-only checkout permissions, timeouts, concurrency groups, and artifact
  retention are available;
- the resulting design remains portable to another Linux CI provider if it
  supplies the same controls.

No GitHub Actions workflow, environment, branch protection rule, account, or
secret is created by this planning package.

### 3.2 Execution topology

The narrowest safe topology is one trusted GitHub-hosted Linux job with three
isolated execution components:

1. **Trusted CI control process on the ephemeral runner**
   - checks out the approved source;
   - builds the test-runner image before any database credential exists;
   - generates per-run identifiers and credentials;
   - creates one internal Docker network;
   - launches and controls the PostgreSQL service container;
   - performs bootstrap and cleanup through `docker exec`;
   - never passes its Docker socket or admin values to the test container.
2. **PostgreSQL 16 service container**
   - is created after credentials are generated;
   - has no persistent volume;
   - exposes no host port;
   - is attached only to the run-specific internal Docker network;
   - uses SCRAM password authentication for network connections;
   - is destroyed in unconditional cleanup and again by CI worker disposal.
3. **Unprivileged Ledgerly test container**
   - is built from the exact checked-out source and lockfile;
   - is attached only to the internal Docker network;
   - has no Docker socket;
   - has no CI control token;
   - has no Replit or production credential;
   - receives only the disposable `ledgerly_api` connection and non-secret
     binding values required by the coordinator;
   - exits after the fixed test command.

The PostgreSQL container is a CI service container in lifecycle and purpose,
but the proposed workflow launches it from the trusted control step rather than
using a declarative `services:` password.

That choice is deliberate. A declarative service starts before workflow steps
can generate a per-run administrator password. The control-step launch permits
a random password for every run and avoids a long-lived repository or
environment PostgreSQL administrator secret.

### 3.3 Linux runner requirements

The proposed job requires:

- GitHub-hosted `ubuntu-24.04`, or an independently reviewed equivalent;
- `x86_64`;
- Docker Engine capable of:
  - immutable-digest image pulls;
  - `--internal` bridge networks;
  - containers without published ports;
  - `docker exec`;
  - `--rm` lifecycle;
  - health checks;
- at least 2 vCPU;
- at least 4 GiB memory;
- at least 10 GiB free ephemeral disk;
- no persistent runner reuse;
- no self-hosted runner unless separately approved.

A self-hosted runner is not part of this proposal because persistent workers
increase credential-remanence, Docker-socket, and cross-job isolation risk.

### 3.4 Repository checkout and action pinning

The later workflow must:

- run only from an exact trusted commit on a protected branch;
- use a read-only checkout token;
- set workflow permissions to `contents: read` and deny unnecessary write,
  package, deployment, and OIDC permissions;
- set checkout credential persistence to false;
- pin every third-party action to a reviewed full commit SHA;
- reject `pull_request_target`;
- reject direct execution of fork-originated or otherwise untrusted code;
- make no free-form workflow input part of a command, SQL identifier, database
  name, image name, or file path;
- use the checked-in `pnpm-lock.yaml` with `--frozen-lockfile`;
- preserve the workspace's `minimumReleaseAge` and dependency overrides;
- perform dependency resolution before generating any database credential.

### 3.5 Node and package runtime

The proposed initial toolchain is:

- Node `24.13.0`;
- pnpm `10.26.1`;
- Linux `x86_64`;
- `pnpm install --frozen-lockfile`;
- the existing package scripts and lockfile.

The test-runner container image must pin the Node image to an exact patch tag
and immutable digest. It must not use `node:latest`, `node:24`, or an unpinned
third-party pnpm image.

The later implementation may add a checked-in toolchain declaration if needed,
but it must not update application dependencies merely to create the harness.

### 3.6 Timeouts and resources

Initial limits:

- complete job timeout: 20 minutes;
- dependency/build phase: 7 minutes;
- PostgreSQL readiness/bootstrap phase: 4 minutes;
- canonical/TR-01 test phase: 7 minutes;
- normal cleanup phase: 2 minutes;
- PostgreSQL health-check interval: 2 seconds;
- PostgreSQL readiness deadline: 60 seconds;
- application `lock_timeout`: remains the approved 2000 ms;
- concurrency barrier timeout: remains bounded and must not exceed the test
  phase limit.

The job must fail closed when any phase exceeds its limit.

### 3.7 Concurrency policy

Each CI job has:

- one unique run UUID;
- one unique Docker network;
- one unique PostgreSQL container name;
- one unique test container name;
- one unique database;
- one unique `ledgerly_api` password.

The design supports parallel CI jobs without shared database state. The initial
governance policy nevertheless permits only one Ledgerly canonical CI job at a
time. The workflow concurrency group must queue rather than cancel an active
run so that its cleanup and evidence sequence can complete.

Parallel transactions inside one suite remain required and must use distinct
PostgreSQL backend sessions.

## 4. Three-plane trust separation

### 4.1 Plane A — CI admin/bootstrap

Principal:

- trusted protected workflow;
- ephemeral CI runner control process;
- container-local PostgreSQL `postgres` administrator.

Permitted:

- create the run UUID, nonce, and random credentials;
- launch and stop the exact run containers and network;
- create the exact database and roles;
- create private run-control metadata;
- apply the authoritative schema and overlay;
- verify roles, ownership, ACLs, indexes, constraints, functions, and triggers;
- close or terminate only exact disposable sessions;
- drop the exact disposable database;
- emit non-secret lifecycle evidence.

Prohibited:

- application requests;
- normal Replit workflow execution;
- `heliumdb` access;
- production access;
- arbitrary caller-selected database names;
- reusable database-administration service;
- exposing Docker control or administrator values to the test plane.

### 4.2 Plane B — test

Principal:

- exact PostgreSQL role `ledgerly_api`;
- unprivileged test container;
- fixed canonical command.

Permitted:

- connect only to the exact bound disposable database;
- run the current canonical integration suite;
- later run the approved TR-01 adversarial tests;
- use independent sessions and approved DML/EXECUTE rights;
- verify its own identity, binding, baseline, trigger state, and sessions.

Prohibited:

- Docker access;
- host filesystem access;
- external network access;
- database creation or destruction;
- role creation, alteration, or assumption;
- ownership changes;
- trigger disabling or replacement;
- session termination;
- access to the administrator password, nonce after verification, or CI token;
- any Replit or production credential.

### 4.3 Plane C — normal Replit development

Principal and database:

- `ledgerly_api`;
- `heliumdb`.

State:

- remains the normal application development plane;
- is not reachable from the isolated test network;
- supplies no credential to external CI;
- is never a canonical test target;
- is not read, snapshotted, migrated, or modified by TI-03.

Normal Replit workflow configuration and normal `DATABASE_URL` remain
unchanged.

## 5. PostgreSQL image pinning

### 5.1 Initial image

The proposed initial database image is:

```text
postgres:16.15-bookworm
```

Implementation must replace the tag-only reference with:

```text
postgres:16.15-bookworm@sha256:<reviewed-immutable-digest>
```

The digest must be resolved from the official image registry during the later
implementation review, recorded in the workflow, and included in every evidence
artifact. This planning package does not pull the image and therefore does not
invent or record an unverified digest.

### 5.2 Authentication initialization

The service container must initialize with:

- a cryptographically random per-run `POSTGRES_PASSWORD`;
- host authentication using SCRAM-SHA-256;
- local administration through the container-local `postgres` operating-system
  identity;
- no trust authentication over the Docker network;
- no published host port;
- no persistent volume.

The random `POSTGRES_PASSWORD` is a defense against network login as
`postgres`. The admin/bootstrap process should use
`docker exec --user postgres` and the container-local socket, so the password
does not need to be supplied to bootstrap commands.

### 5.3 Upgrade policy

Patch upgrade:

1. open a specific review changing tag and digest;
2. review PostgreSQL release notes and official-image changes;
3. run the complete bootstrap compatibility suite;
4. run the full canonical/TR-01 matrix on the old and proposed image;
5. compare role, ACL, function, trigger, index, constraint, SQLSTATE, and
   concurrency evidence;
6. obtain independent review before replacing the pin.

Major upgrade:

- requires a new architecture/compatibility approval package;
- may not be introduced as routine dependency maintenance.

No unbounded tag is permitted.

## 6. Exact bootstrap contract

### 6.1 Authoritative repository sources

The later harness must consume, not duplicate:

| Purpose | Authoritative source |
|---|---|
| Application schema | `lib/db/src/schema/index.ts` |
| Drizzle selection/configuration | `lib/db/drizzle.config.ts` |
| Schema command | `pnpm --filter @workspace/db run push` |
| RS-01 disposable protection | `scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql` |
| Canonical coordinator | `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs` |
| Canonical/TR-01 tests | `artifacts/api-server/src/services/accounting/canonicalPosting.integration.test.ts` and later approved TR-01 test additions |
| Fixed test command | `pnpm --filter @workspace/api-server run test:canonical-posting` |
| Dependency graph | `pnpm-lock.yaml` and `pnpm-workspace.yaml` |

One new versioned admin-only SQL artifact is proposed for the private
`ledgerly_test_control` schema and run row. It must not define application or
accounting product tables.

### 6.2 Ordered sequence

The later control process must perform exactly this sequence:

1. Verify the protected CI event, exact commit, workflow identity, and read-only
   permissions.
2. Build the test-runner image from the exact source and frozen lockfile before
   generating database credentials.
3. Compute SHA-256 values for:
   - source tree;
   - schema;
   - Drizzle config;
   - RS-01 overlay;
   - private run-control SQL;
   - canonical coordinator;
   - canonical/TR-01 test bundle sources;
   - lockfile;
   - workflow;
   - orchestration script;
   - fixed command.
4. Generate:
   - version-4 run UUID;
   - 256-bit nonce;
   - nonce SHA-256;
   - random `postgres` network password;
   - random `ledgerly_api` password;
   - creation and expiry timestamps.
5. Derive the database name exactly as:

   ```text
   ledgerly_canonical_test_<run UUID without hyphens, lowercase>
   ```

6. Create a run-specific internal Docker network.
7. Start the pinned PostgreSQL container with no volume and no published port.
8. Wait for the health check and verify as container-local `postgres`:
   - `current_user = postgres`;
   - `session_user = postgres`;
   - exact PostgreSQL version;
   - expected empty cluster;
   - expected authentication configuration.
9. Create cluster roles:
   - `ledgerly_canonical_owner` as `NOLOGIN`, `NOSUPERUSER`,
     `NOINHERIT`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`,
     `NOBYPASSRLS`;
   - `ledgerly_api` as `LOGIN`, `NOSUPERUSER`, `NOINHERIT`, `NOCREATEDB`,
     `NOCREATEROLE`, `NOREPLICATION`, `NOBYPASSRLS`, with the random per-run
     password;
   - no membership between either role and `postgres`.
10. Create only the exact UUID-derived database, owned by `postgres`.
11. Connect to the exact database as `postgres`.
12. Create the private `ledgerly_test_control` schema and `run_identity` table,
    owned by `postgres`, with no `PUBLIC`, `ledgerly_api`, or
    `ledgerly_canonical_owner` access.
13. Insert exactly one immutable run row before granting runtime access.
14. Apply the authoritative Drizzle application schema through the exact
    database URL.
15. If the known Drizzle composite-FK/index ordering failure occurs, stop unless
    the error exactly matches the previously approved narrow prerequisite case.
    Only the exact approved prerequisite index may then be applied, followed by
    the same non-force Drizzle push. Unknown errors fail closed. `push-force`,
    schema inference, a database dump, and a copy of `heliumdb` are prohibited.
16. Apply the reviewed RS-01 disposable SQL overlay as `postgres`.
17. Verify SC-01 constraints and indexes from the authoritative schema.
18. Verify the private run binding from the admin plane.
19. Verify all canonical and legacy fixture baselines are empty.
20. Verify the complete role, membership, ownership, ACL, function,
    `search_path`, index, constraint, and trigger state.
21. Construct the exact `ledgerly_api` URL in memory without logging it.
22. Start the unprivileged test container on the internal network with only the
    approved environment.
23. Require the coordinator to verify identity and binding before any fixture
    insert.

### 6.3 Private run-control schema

The proposed admin-only artifact is:

```text
scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql
```

It may create only:

- schema `ledgerly_test_control`;
- table `ledgerly_test_control.run_identity`;
- constraints that make one row self-consistent and immutable to non-admin
  principals;
- grants/revocations required to keep the schema private.

Required row fields:

- run UUID;
- exact database name;
- environment;
- target classification;
- CI provider;
- CI repository identity;
- CI workflow identity;
- CI run ID;
- CI run attempt;
- CI job identity;
- exact source commit;
- source-tree SHA-256;
- application-schema SHA-256;
- Drizzle-config SHA-256;
- RS-01-overlay SHA-256;
- run-control SQL SHA-256;
- coordinator SHA-256;
- test-source SHA-256;
- lockfile SHA-256;
- workflow/orchestrator SHA-256 values;
- expected command;
- creator identity;
- expected runtime identity;
- nonce;
- UTC creation time;
- UTC expiry time.

The application schema must not import or depend on this test-control schema.

### 6.4 Final bootstrap verification

Before runtime access, admin evidence must prove:

- exact database and server version;
- exact `postgres` identity;
- exact role flags and no prohibited membership;
- exact database and schema ACLs;
- protected object owners;
- ordinary table grants;
- protected table grants;
- guard function owners and fixed search paths;
- five exact triggers with `tgenabled = 'A'`;
- SC-01 company/economic-effect foreign keys and unique indexes;
- the approved posting-effect unique identity;
- no unexpected canonical object;
- empty canonical and legacy baselines;
- one matching private run row;
- no non-admin session.

Any mismatch prevents the test container from starting.

## 7. Credential model

### 7.1 Generation

The trusted control process generates both PostgreSQL passwords from a
cryptographically secure random source after dependency installation and before
container launch.

Minimum:

- 256 bits of random data per password;
- independent values;
- URL encoding when constructing the API-role connection;
- no caller-supplied password;
- no deterministic derivation from run ID, commit, or nonce.

### 7.2 Administrator confinement

The `postgres` password:

- exists only in the trusted control process and PostgreSQL container
  environment;
- is not a repository or CI environment secret;
- is not a workflow output;
- is not written to the workspace;
- is not passed to the test image or container;
- is not needed by admin SQL because administration uses local `docker exec`;
- ceases to exist when the control process and container are destroyed.

Shell tracing must be disabled before generation. The value must be registered
with CI log masking as defense in depth, but masking is not a substitute for
not printing it.

### 7.3 API-role delivery

The `ledgerly_api` URL must identify only:

- internal network host alias reserved for the PostgreSQL container;
- port `5432`;
- exact UUID-derived database;
- user `ledgerly_api`;
- the per-run password;
- `sslmode=disable` only because the connection remains inside the isolated
  internal Docker network.

It is supplied to the coordinator as:

```text
LEDGERLY_CANONICAL_TEST_DATABASE_URL
```

The coordinator constructs the test child environment and replaces
`DATABASE_URL` with that exact disposable URL. The child must not receive the
administrator password, CI token, Docker socket, run nonce after verification,
or the original `LEDGERLY_CANONICAL_TEST_DATABASE_URL` variable.

The URL must never appear in:

- command-line arguments;
- process listings outside the isolated test container;
- workflow outputs;
- logs;
- thrown error text;
- evidence;
- artifacts;
- repository files.

### 7.4 Credential destruction

On every exit path:

- close all test pools;
- stop the test container;
- remove any runner-local credential file;
- overwrite only where supported, then unlink;
- remove the PostgreSQL container;
- remove the internal network;
- allow the ephemeral CI worker to be destroyed.

No long-lived PostgreSQL secret is required.

## 8. Run binding

### 8.1 Exact values

The binding must contain:

- run UUID;
- random nonce and external nonce hash;
- CI provider exactly `github-actions`;
- repository identity;
- workflow identity;
- CI run ID, attempt, and job identity;
- environment exactly `external-ci-disposable-test`;
- target classification exactly `external-ci-postgresql-service-container`;
- exact UUID-derived database name;
- creator/bootstrap identity exactly `postgres`;
- expected runtime identity exactly `ledgerly_api`;
- source commit and source-tree digest;
- schema, config, overlay, run-control, runner, test, lockfile, workflow, and
  orchestrator digests;
- exact command identity;
- creation and expiry timestamps;
- PostgreSQL image tag and immutable digest;
- Node image tag and immutable digest;
- explicit statements that `heliumdb` and production are prohibited.

Suggested expiry is 30 minutes from creation. The CI job timeout remains
shorter.

### 8.2 Runtime verification

Before the first fixture insert, the non-privileged coordinator must verify:

1. every required environment value is present;
2. UUID, nonce, database, environment, and target-class formats;
3. the exact internal host alias and port;
4. no forbidden URI query or target override;
5. no conflicting `PG*` variable;
6. no normal Replit `DATABASE_URL` existed in the parent CI environment;
7. post-connect database, current user, and session user;
8. PostgreSQL server version;
9. the complete private binding through a narrowly scoped
   `SECURITY DEFINER` verification function;
10. the source digests computed from the test container's files;
11. empty baseline and five `ENABLE ALWAYS` triggers;
12. negative privilege probes required by RS-01.

The existing disposable verification function must be strengthened or replaced
within the disposable-only overlay so that CI identity, target class, expiry,
and the additional digests are checked without granting direct control-schema
access to `ledgerly_api`.

The function must remain:

- owned by `postgres`;
- `SECURITY DEFINER`;
- fixed to `pg_catalog` and `ledgerly_test_control`;
- executable only by the approved runtime role;
- absent from normal development.

## 9. Runner adaptation

The existing runner cannot be reused unchanged.

### 9.1 Minimum mode addition

Add a fail-closed external-CI mode activated only by:

```text
LEDGERLY_CANONICAL_TEST_MODE=external-ci
```

Existing Replit-disposable behavior must remain unchanged unless separately
removed after review.

External-CI mode must:

- require `DATABASE_URL` to be absent from the parent control environment;
- require `REPLIT_DEV_DOMAIN`, `REPLIT_DEPLOYMENT`, and
  `REPLIT_DEPLOYMENT_ID` to be absent;
- require the external-CI environment and target-class values;
- require GitHub run/job binding values;
- parse only `LEDGERLY_CANONICAL_TEST_DATABASE_URL`;
- require `ledgerly_api`, exact database name, exact internal host alias, port
  `5432`, and the approved `sslmode`;
- reject every other host, port, database, protocol, user, and URI query key;
- verify post-connect server identity;
- skip all `heliumdb` snapshot code;
- prove that no Replit database credential or endpoint was available;
- preserve source-digest checks;
- preserve private binding verification;
- preserve no-fallback behavior;
- preserve child-environment scrubbing;
- construct an allowlisted child environment rather than copying the complete
  parent environment;
- emit external-CI isolation evidence instead of
  `developmentEndpointMatched`.

### 9.2 Target override controls

External-CI mode must reject:

- `host`, `hostaddr`, `port`, `user`, `dbname`, `service`, `passfile`,
  certificate-file, socket, or other target-changing query parameters;
- duplicate query keys;
- URI fragments;
- percent-decoded username/database mismatches;
- IPv6/IPv4 host alternatives not equal to the exact network alias;
- any `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGSERVICE`,
  `PGSERVICEFILE`, `PGPASSFILE`, `PGPASSWORD`, or `PGOPTIONS`;
- any database name equal to `heliumdb`;
- any production/deployment marker;
- any missing run binding.

### 9.3 Child environment

The child environment should be constructed from an explicit allowlist:

- `PATH`;
- required Node runtime variables with non-secret fixed values;
- `NODE_ENV=test`;
- disposable `DATABASE_URL`;
- non-secret run ID, database name, environment, and target class where tests
  require them;
- no CI credential;
- no Docker variable/socket;
- no package-registry credential;
- no Replit variable;
- no nonce;
- no administrator value;
- no parent `LEDGERLY_CANONICAL_TEST_DATABASE_URL`.

## 10. `heliumdb` isolation

### 10.1 Selected policy

The external CI job must have **no `heliumdb` credential and no network
dependency on the Replit development database**.

The previous before/after manifest is not appropriate for this architecture
because:

- supplying the Replit development credential to external CI is an explicit
  stop condition;
- the test target is an isolated local CI service, not another database on the
  Replit endpoint;
- the test container can be placed on an internal-only network.

No `heliumdb` manifest is calculated in TI-03.

### 10.2 Equivalent non-contact evidence

The harness must prove:

- parent CI `DATABASE_URL` was absent before construction of the disposable
  child URL;
- no GitHub repository/environment secret is referenced by the workflow;
- no variable name associated with Replit database access is present;
- the only database URL is generated during the job;
- the URL host is the run-specific internal PostgreSQL alias;
- the PostgreSQL container has no published host port;
- the test container is attached only to a Docker `--internal` network;
- the test container has no default external route;
- DNS and connection attempts outside the internal network fail;
- no Replit domain or database endpoint appears in the workflow, environment,
  process configuration, or evidence;
- `current_database()` is the UUID-derived disposable name;
- `current_user` and `session_user` are `ledgerly_api`;
- the test source has no credential with which to authenticate to `heliumdb`.

This is stronger than a before/after manifest: the CI test process cannot reach
or authenticate to the normal development database.

## 11. TR-01 adversarial matrix execution

TI-03 supplies the database and synchronization harness. It does not invent
missing product authority or complete TR-01 business logic.

After TI-03 passes independent review, TR-01 may add or complete the approved
tests below. Every database-backed case runs inside the same disposable
PostgreSQL environment and must use distinct backend PIDs where concurrency is
claimed.

| Case | Harness execution contract | Authority status |
|---|---|---|
| Membership revocation race | Transaction A locks/revalidates membership; transaction B attempts revocation; barrier proves overlap and final authorized/denied outcome | Use existing company membership schema |
| Company/resource ownership race | Two sessions mutate/read the approved company-scoped resource authority with ordered locks | Use only an approved existing resource |
| Source revision race | Competing revision change is synchronized against posting | Fail closed if no approved authoritative source table exists |
| Accounting-period closure race | Closure and posting overlap at the period lock | Fail closed if no approved period authority exists |
| Configuration-version race | Configuration change and posting overlap | Fail closed if no approved version authority exists |
| Control-mapping race | Mapping change and posting overlap | Fail closed if no approved mapping authority exists |
| Account eligibility race | Account active/eligible/company state changes during posting | Use existing approved account state only |
| Same command concurrency | Two independent sessions submit the same command | Exactly one posted journal; retry-safe duplicate result |
| Same economic effect, different command | Competing commands share economic effect identity | One accepted effect; conflicting command fails closed |
| Reversal vs reversal | Two sessions reverse one original | At most one approved reversal identity |
| Correction vs correction | Two sessions correct one original | Ordered additive outcomes or approved identity conflict |
| Correction vs reversal | Correction and reversal overlap on one original | Deterministic ordered result with no partial evidence |
| Lock timeout | Hold approved lock beyond 2000 ms | SQLSTATE `55P03`, bounded retry only where approved |
| Deadlock | Controlled inverse lock order in a harness-only compatibility case | SQLSTATE `40P01`; no partial canonical write |
| Audit-write failure | Inject failure before audit persistence | Whole transaction rolls back |
| Line-write failure | Inject line persistence failure | Header, effect, relation, audit, and lines roll back |
| Uncertain/unknown commit outcome | Simulate only at the approved commit-result boundary | Durable uncertain effect; no blind replay |
| Company A/B isolation | Concurrent commands use disjoint companies and principals | No cross-company authority or accounting evidence |

For every row:

- barrier evidence must record distinct backend PIDs and arrival order;
- the final database state must be independently queried;
- partial effects, journals, lines, relations, and audits are prohibited;
- unsupported authority must return the approved fail-closed error;
- no fixture-only table may masquerade as production authority;
- no product table may be added merely to make the matrix pass.

## 12. Evidence model

### 12.1 Machine-readable artifact

Each run produces one allowlisted JSON evidence document with:

- evidence schema version;
- CI provider, repository, workflow, run, attempt, and job identities;
- source commit and bound source digests;
- PostgreSQL tag, immutable digest, and server version;
- Node tag/digest and runtime version;
- pnpm version and lockfile digest;
- run UUID and nonce SHA-256;
- environment and target classification;
- database name without any credential;
- bootstrap start/end/status;
- admin identity class;
- role flags and membership result;
- database/schema/table/function ACL hashes;
- ownership result;
- constraints and indexes;
- guard function and fixed-search-path result;
- five `ENABLE ALWAYS` trigger rows;
- empty baseline;
- runtime database/current/session identity;
- private binding verification;
- test case result list;
- backend PID and barrier evidence;
- SQLSTATE evidence for lock/deadlock cases;
- final canonical-state hashes;
- lingering-session result;
- exact logical drop result;
- container removal result;
- internal network removal result;
- no-Replit-credential assertion;
- no-external-route assertion;
- secret-redaction check;
- overall result and failure phase.

### 12.2 Repository versus CI retention

CI artifacts:

- per-run evidence JSON;
- concise test report;
- sanitized bootstrap/cleanup diagnostics;
- retained for 30 days during initial TI-03 qualification;
- no raw environment dump;
- no raw database log unless separately sanitized.

Committed evidence:

- the evidence JSON schema;
- one independently reviewed, successful TI-03 qualification record;
- any required negative-control records;
- no routine per-commit evidence;
- no noisy logs;
- no failed-run artifact unless it establishes a governance-relevant negative
  control and is manually reviewed.

The proposed committed evidence path remains:

```text
docs/governance/evidence/
```

### 12.3 Secret exclusion

Evidence generation must fail if it detects:

- `postgresql://` or `postgres://`;
- password, token, cookie, private key, or authorization header fields;
- actual nonce;
- environment dump;
- Docker inspect environment;
- GitHub token;
- Replit variable or endpoint;
- production identifier.

Redaction is a secondary control. The primary control is never serializing the
value.

## 13. Failure and cleanup

| Failure | Required behavior |
|---|---|
| Dependency/build failure | No database credential has been generated; stop with no service container |
| PostgreSQL image/start failure | Record non-secret phase failure; remove container/network if created |
| Bootstrap failure | Never start test container; remove exact database/container/network |
| Binding/verification failure | Never insert fixtures; fail and destroy service |
| Test assertion failure | Preserve sanitized result, close child, run exact cleanup, fail job |
| Test timeout | Kill test container, close/terminate exact sessions, destroy service, fail job |
| Runner script crash | Host `trap` removes containers/network; CI VM disposal is final boundary |
| CI cancellation | Platform disposal removes the ephemeral worker and containers; no external database survives |
| PostgreSQL crash | Test fails; capture non-secret health status; remove container/network |
| Logical drop failure | Mark run failed; force-remove the service container; no persistent volume survives |
| Evidence upload failure | Job fails; cleanup still runs before upload result is evaluated where possible |

Normal cleanup order:

1. stop the test container;
2. verify or terminate only exact `ledgerly_api` sessions;
3. reverify internal run binding as `postgres`;
4. drop only the exact UUID-derived database;
5. verify nonexistence;
6. remove credential material;
7. remove PostgreSQL container;
8. verify container absence;
9. remove internal network;
10. verify network absence;
11. publish non-secret evidence.

The job-scoped container and ephemeral CI worker are the ultimate cleanup
boundary. No abandoned external database can survive the job.

## 14. Expected repository and workflow impact

If later approved, implementation is expected to change only:

1. `.github/workflows/ledgerly-canonical-postgresql.yml`
   - new manual protected CI workflow.
2. `.ci/ledgerly-canonical/Dockerfile.test`
   - pinned Node/pnpm test-runner image.
3. `scripts/ci/run-ledgerly-canonical-postgresql.mjs`
   - trusted host-side lifecycle/bootstrap/evidence coordinator.
4. `scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql`
   - private run-control schema/table only.
5. `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs`
   - bounded external-CI mode and allowlisted child environment.
6. `scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql`
   - only the minimum disposable run-verification strengthening if required;
     canonical guard semantics must not change.
7. `artifacts/api-server/src/services/accounting/canonicalPosting.integration.test.ts`
   - only environment/evidence compatibility required to run the existing suite
     externally; outstanding TR-01 test logic remains TR-01-owned.
8. `docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json`
   - non-secret evidence schema.
9. TI-03 implementation and independent-review reports.

Possible toolchain declaration changes must be separately justified and must
not update unrelated dependencies.

Implementation must not change:

- normal Replit workflow configuration;
- normal `DATABASE_URL`;
- `heliumdb`;
- production workflow, deployment, database, role, or secret;
- application routes or runtime startup;
- accounting product schema;
- RLS;
- BL-06, BL-07, `#40-CF-01`, or `#41`;
- posting availability.

## 15. Security threat model

| Threat | Control |
|---|---|
| CI secret leakage | No PostgreSQL CI secret; per-run generation after dependency build; no production/Replit secret references |
| Log leakage | Disable shell tracing; never echo URLs; CI mask as defense in depth; structured allowlisted output |
| Malicious pull request | Manual protected-branch execution only; no `pull_request_target`; no fork code with protected context |
| Workflow modification | Full-SHA action pins; branch protection and required review for workflow/harness paths |
| Dependency/script injection | Frozen lockfile; minimum release age; dependency build before secrets; test container gets no Docker socket or external network |
| Admin credential inheritance | Admin value remains in control process/PostgreSQL container; explicit test-container env allowlist |
| Database URL leakage | Generated in memory; not a command argument/output/artifact; error sanitization and evidence scanner |
| Command injection | Fixed command/arguments; generated UUID names; no shell interpolation of workflow inputs |
| Database-name injection | Derive name only from validated v4 UUID; parameterized/quoted admin operations; exact internal binding |
| Forged run binding | Admin inserts private row before grants; runtime verifies through fixed-search-path function; internal/external hashes agree |
| Test escapes database role | SCRAM authentication; no admin password; RS-01 negative probes; no role membership |
| Test escapes network | Internal Docker network; no published port; no default external route; no Docker socket |
| Accidental Replit credential | No workflow secret reference; parent `DATABASE_URL` must be absent; explicit variable-name scan |
| Production contact | No production secret; internal-only network; explicit deployment-marker rejection |
| Docker socket abuse | Test executes in a separate container with no socket mount |
| Image substitution | Exact image tag and immutable digest; evidence records both |
| Evidence leakage | Allowlisted schema plus secret-pattern rejection before artifact upload |
| Cleanup of wrong resource | UUID-derived container/network/database names plus private binding; no wildcard or prefix-only deletion |
| CI cancellation | Ephemeral runner and no persistent database volume; platform disposal is final cleanup |

## 16. Cost and execution policy

### 16.1 Trigger policy

Initial TI-03 execution policy:

- `workflow_dispatch` only;
- maintainers only;
- exact protected branch/commit;
- no automatic pull-request execution;
- no fork execution;
- one active run at a time;
- no scheduled execution until TI-03 independent review passes.

After TI-03 and TR-01 are independently approved, a separate policy decision
may permit protected-branch or selected trusted-PR runs for changes to:

- canonical posting service;
- canonical tests;
- database schema;
- RS-01 overlay;
- run-control or CI harness;
- database/runtime dependency lockfile.

### 16.2 Runtime and cost envelope

Expected initial runtime:

- warm-cache run: approximately 5–10 Linux runner minutes;
- cold-cache run: approximately 10–15 minutes;
- hard maximum: 20 minutes.

Expected direct database cost:

- zero standing database cost;
- no managed PostgreSQL subscription;
- PostgreSQL compute exists only inside the billed CI worker.

Expected CI cost:

- the provider's Linux runner minutes and artifact storage;
- at most 20 billable Linux minutes per authorised run under the hard timeout;
- initial cap of 20 authorised qualification runs, or 400 maximum runner
  minutes, before budget review;
- 30-day artifact retention.

Exact monetary cost depends on the GitHub account plan and included minutes.
The later implementation approval must confirm the account's rate or included
allowance without exposing billing details in source.

## 17. TI-03 validation and independent review

The implementation may be considered for independent review only after it
proves:

1. workflow-event and permission restrictions;
2. immutable action, Node, and PostgreSQL image pins;
3. no long-lived PostgreSQL secret;
4. no Replit or production secret in CI;
5. no external route from the test container;
6. exact role separation and negative privilege probes;
7. exact schema, SC-01, RS-01, and run-binding bootstrap;
8. successful existing canonical suite;
9. distinct backend session evidence;
10. exact cleanup on success and test failure;
11. container/network removal after bootstrap failure and timeout;
12. artifact secret scanner;
13. no `heliumdb` contact;
14. no normal Replit workflow or database change.

Required negative controls:

- missing run binding;
- forged run UUID/database mismatch;
- malformed URI;
- target-changing query parameter;
- wrong host, port, database, or role;
- supplied parent `DATABASE_URL`;
- supplied Replit/deployment marker;
- inherited `PG*` override;
- non-pinned image;
- untrusted event;
- role escalation attempt;
- trigger-disable attempt;
- cleanup binding mismatch;
- evidence containing a credential pattern.

TI-03 must receive an independent post-implementation security and database
review before it can unblock TR-01.

## 18. TR-01 resumption boundary

Successful TI-03 implementation does not complete TR-01 or `#44`.

After TI-03 passes independent review, TR-01 may resume only to:

- complete or correct the already approved TR-01 implementation;
- add and execute the approved adversarial tests;
- preserve fail-closed behavior for unsupported authority;
- produce the TR-01 implementation report;
- request its own independent post-implementation review.

TI-03 does not authorize:

- new accounting authority tables;
- schema invention to satisfy a test;
- production posting;
- production deployment, migration, or cutover;
- RLS;
- BL-06 or BL-07;
- `#40-CF-01`;
- `#41`;
- completion of `#44`.

## 19. Governance and unchanged status

The following remain unchanged:

- DEC-01 through DEC-22 are approved;
- no DEC-23 is created;
- DEC-12 remains unchanged;
- source freshness remains implementation-level;
- BL-06 and BL-07 remain blocked;
- `#40-CF-01` remains incomplete;
- `#44` remains incomplete;
- `#44-TR-01` remains partial/incomplete;
- SC-01 remains complete;
- RS-01 remains complete;
- production posting remains disabled.

No production deployment, publishing, migration, cutover, database access, RLS,
or credential operation is authorized.

## 20. Stop conditions

TI-03 implementation must return not ready if safe implementation requires:

- exposing a Replit development credential to external CI;
- connecting to or modifying `heliumdb`;
- exposing a production credential or endpoint;
- storing a long-lived PostgreSQL administrator credential;
- giving the test process a Docker socket or administrator value;
- allowing untrusted PR or fork code into the protected execution context;
- weakening `ledgerly_api`;
- weakening RS-01 roles, ownership, ACLs, functions, or triggers;
- replacing PostgreSQL with another database engine;
- using an unpinned PostgreSQL or Node image;
- granting the test container external network access;
- inventing accounting/schema authority;
- changing normal Replit workflow configuration or `DATABASE_URL`;
- failing to bind cleanup to the exact internal run identity;
- retaining a database or credential outside the CI job;
- emitting secret-bearing evidence;
- contacting production.

## 21. Implementation approval scope

If explicitly approved later, TI-03 implementation is limited to the files and
controls in this package. It must stop after:

- creating the reviewed external CI harness;
- running TI-03 qualification and negative controls;
- producing non-secret evidence;
- documenting results;
- requesting independent review.

It must not resume TR-01 in the same implementation instruction unless the user
separately approves that later step after TI-03 review.

READY FOR #44-TI-03 IMPLEMENTATION APPROVAL

## 22. Prospective implementation-identity recovery amendment — 2026-09-21

The former implementation commit
`b03627099616675924a88e9a30c7b5e6547c9166` remains a historical reviewed
identity whose object is lost and unavailable. No current file or historical
validation result establishes equivalence to it.

Future identity recovery must use the approved `C` / `S` / `G` model and exact
candidate ref `refs/heads/tr01/implementation-identity-candidate`. Candidate
qualification binds `S=C`; activated qualification binds workflow source
`S=G` to separately checked-out implementation `C`.

The protected runner must record distinct `workflowSourceCommit` and
`implementationSourceCommit` fields and preserve every TI-03 role, database,
network, image, evidence, negative-control, secret, and cleanup requirement in
this package. The executable changes required for that model remain separately
gated by:

`docs/ledgerly-44-tr-01-implementation-identity-recovery-implementation-approval-package.md`

This appendix grants no implementation, GitHub configuration, qualification,
publication, production, or Phase A authority.
