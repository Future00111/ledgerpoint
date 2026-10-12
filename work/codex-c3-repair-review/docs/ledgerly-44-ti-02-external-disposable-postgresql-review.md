# #44-TI-02 External Disposable PostgreSQL Architecture Review

**Parent:** `#44 — Canonical Posting Safety Enforcement`  
**Related implementation:** `#44-TR-01 — Transactional Authority Provider and Final Revalidation`  
**Predecessor:** `#44-TI-01 — Disposable Canonical Test Database Administration`  
**Status:** Planning and architecture review only  
**Environment:** Development and test only  
**Prepared:** 2026-08-26  

> This review compares external PostgreSQL test environments and recommends an
> architecture for later approval. It does not create an account, provision a
> database, connect to an external database, modify application or test code,
> change secrets or workflows, alter `heliumdb`, access production, resume
> TR-01, or change any task state.

## 1. Executive recommendation

### Preferred architecture

Use an **external Linux CI job with one fresh, official PostgreSQL service
container per authorised canonical-test run**.

The selected design is:

- PostgreSQL 16, pinned to a reviewed patch version and immutable image digest;
- a fresh container and fresh database for every run;
- no persistent database volume;
- an administrative bootstrap/cleanup step running as the container-local
  `postgres` administrator;
- the canonical suite running in a separate, unprivileged process only as
  `ledgerly_api`;
- exact run UUID, nonce, database name, source digests, role state, and
  bootstrap state bound before the test process receives access;
- two or more independent PostgreSQL sessions for concurrency tests;
- explicit logical cleanup followed by CI-platform destruction of the entire
  service container;
- non-secret evidence retained as a CI artifact;
- no production credential, endpoint, data, or workflow in the CI job.

GitHub Actions is the concrete reference implementation because its documented
service-container lifecycle creates a fresh service container for a job and
destroys it when the job completes. An equivalent external CI platform is
acceptable only if it can prove the same isolation, secret scoping, service
lifecycle, independent-session behavior, and evidence properties.

This option is preferred because it uses unmodified upstream PostgreSQL
semantics, supports the exact `postgres` identity expected by the existing
disposable overlay, and has a second cleanup boundary even when SQL cleanup
fails: the job-scoped container is destroyed without a persistent volume.

### Fallback architecture

Use a **dedicated, non-production managed PostgreSQL project with one
API-created branch or project per run**, using a direct unpooled TLS connection.
A Neon-style branch API is the reference model.

The fallback is acceptable only after a zero-data qualification proves that the
selected provider can reproduce the exact RS-01 role, ownership, function,
trigger, transaction, error-code, session, and cleanup behavior. The provider
control-plane token and database administrator credential must remain outside
the Replit workspace, application, and test process. Only the short-lived
`ledgerly_api` connection may enter the authorised test invocation.

The fallback is not preferred because provider role models can differ from
upstream PostgreSQL, hard deletion may have provider-specific retention
semantics, TLS and credential handoff are more complex, and the result depends
on one vendor's control plane.

### Options not selected

- A continuously running dedicated non-production PostgreSQL instance with
  database-per-run lifecycle is technically viable but has higher standing
  cost and operational burden. A shared cluster also makes the exact
  `ledgerly_api` role and credential cluster-scoped, which weakens isolation
  between parallel runs unless runs are serialized or an instance is created
  per run.
- Replit's current managed database channel is not selected because it does not
  expose a supported project-accessible administration plane for exact
  create/drop/session-termination operations and must not be weakened to do so.
- SQLite, mocks, in-memory databases, and non-PostgreSQL engines are rejected
  because they cannot provide valid evidence for PostgreSQL row locks,
  transaction visibility, trigger modes, role privileges, or PostgreSQL SQLSTATE
  behavior.

## 2. Non-negotiable boundaries

The selected architecture must preserve all existing boundaries:

- normal development remains on `heliumdb`;
- normal runtime remains `current_user = ledgerly_api` and
  `session_user = ledgerly_api`;
- `ledgerly_api` remains non-superuser, `NOCREATEDB`, `NOCREATEROLE`,
  `NOREPLICATION`, `NOBYPASSRLS`, and `NOINHERIT`;
- `ledgerly_canonical_owner` remains `NOLOGIN`, non-superuser, and
  `NOINHERIT`;
- canonical tables, guard functions, ownership, ACLs, and all five
  `ENABLE ALWAYS` triggers remain unchanged;
- SC-01 economic-effect identity and BL-01-FI authorization remain unchanged;
- no test may fall back to `heliumdb`;
- no production or deployment secret, endpoint, database, workflow, or data may
  enter the test plane;
- no administrator credential may enter the test child, application workflow,
  source tree, evidence, or logs;
- no external service may become a runtime application dependency;
- no implementation may resume TR-01 until this architecture and a separate
  implementation package are approved.

## 3. Required PostgreSQL compatibility profile

### 3.1 Selected version policy

The proposed baseline is **PostgreSQL 16.x**, pinned to:

1. an explicit patch version available at implementation approval time; and
2. an immutable container digest or provider-reported engine version.

PostgreSQL 16 is selected as a conservative supported baseline. The syntax used
by Ledgerly exists in earlier versions, but an end-of-life or near-end-of-life
major version is not acceptable for new external test infrastructure.

Before implementation, a read-only check must establish the normal development
server's major version. If `heliumdb` is not on PostgreSQL 16, the implementation
package must either:

- pin the disposable environment to the same supported major version; or
- document and approve the version difference, including any transaction,
  trigger, role, JSONB, UUID, and DDL behavioral differences.

No database connection was made for this planning review, so the current
`heliumdb` server version remains an implementation-gate fact, not an assumed
fact.

### 3.2 Required database features

The target must prove all of the following with real SQL before the canonical
suite starts:

| Capability | Required evidence |
|---|---|
| `READ COMMITTED` | Explicit transaction isolation query and two-session visibility test |
| `SELECT ... FOR UPDATE` | Row lock is held until commit or rollback and blocks a conflicting session |
| `lock_timeout` | `SET LOCAL lock_timeout` works inside the transaction and timeout is bounded |
| SQLSTATE `55P03` | Lock-not-available/lock-timeout path is surfaced unchanged to the Node `pg` client |
| SQLSTATE `40P01` | A controlled deadlock produces `deadlock_detected` and aborts one transaction |
| Independent sessions | At least two distinct backend PIDs can overlap on the same database |
| Rollback | Aborted and explicitly rolled-back writes are not visible after transaction end |
| `SECURITY DEFINER` | Guard and run-verification functions execute with the approved owner |
| Fixed `search_path` | Function metadata records only the approved fixed search path |
| `ENABLE ALWAYS` triggers | All five trigger rows report always-enabled state and reject prohibited mutation |
| Role attributes | Exact `LOGIN`/`NOLOGIN`, `NOINHERIT`, creation, replication, bypass, and superuser flags |
| Ownership changes | Administrative bootstrap can assign protected objects to `ledgerly_canonical_owner` |
| Composite foreign keys | Referenced composite identity is accepted only with the required unique constraint/index |
| Partial unique indexes | Authoritative Drizzle indexes and predicates are reproduced exactly |
| UUID and JSONB | `gen_random_uuid()`, UUID casts, JSONB operators, and JSONB trigger checks behave as expected |
| `pg_stat_activity` | `ledgerly_api` can verify its own remaining sessions without receiving session-termination rights |
| PL/pgSQL | The built-in language is available for the reviewed guard functions |

The target must use a direct PostgreSQL connection. Transaction and
session-sensitive tests must not use a transaction-pooling endpoint.

### 3.3 Required connection behavior

The selected target must support:

- standard PostgreSQL URI handling by Node `pg` 8.x;
- explicit host, port, database, and user;
- rejection of target-changing connection parameters;
- multiple simultaneous connections;
- no transparent retry that hides transaction aborts or changes SQLSTATE;
- no statement proxy that rewrites transaction boundaries;
- no pool mode that swaps backend sessions during a transaction.

For an externally reachable managed database, TLS must verify both certificate
trust and hostname. `sslmode=require` without hostname verification is not
sufficient. The implementation must use provider-supported certificate
verification and must record only the non-secret endpoint identity.

## 4. Evaluation criteria

Each option is evaluated against:

1. PostgreSQL behavioral fidelity;
2. admin-plane/test-plane separation;
3. transaction and concurrency realism;
4. deterministic cleanup;
5. secure credential delivery;
6. lifecycle auditability;
7. malicious or compromised test-process containment;
8. implementation complexity;
9. expected cost;
10. vendor dependence;
11. CI suitability;
12. independent-review evidence;
13. compatibility with the existing runner contract;
14. preservation of `heliumdb` and production boundaries.

## 5. Option comparison

| Criterion | A. External CI PostgreSQL service container | B. Managed temporary branch/project | C. Dedicated non-production instance, database per run | D. Current Replit managed database |
|---|---|---|---|---|
| PostgreSQL fidelity | **Excellent** when using the official image | **High, qualification required**; provider patches and role model apply | **Excellent** if standard PostgreSQL is selected | **High engine fidelity**, but required administration is unavailable |
| Exact `postgres` administrator | **Yes** | **Provider-dependent** | **Yes** when instance administration permits it | **No supported project-accessible path** |
| Admin/test separation | **Strong** with step-scoped secrets and an unprivileged test process | **Strong** if control plane remains external | **Strong**, but an external provisioner must be built and operated | **Insufficient for lifecycle operations** |
| Concurrent sessions and locks | **Excellent** | **Good to excellent** on a direct endpoint | **Excellent** | Engine supports them, but disposable lifecycle is blocked |
| Per-run credential isolation | **Excellent**, container-local role | **Excellent** when roles are branch/project scoped | **Weak to medium** on a shared cluster because roles are cluster-scoped | Not available |
| Cleanup | **Excellent**: explicit drop plus container destruction | **Good**, subject to API hard-delete and provider retention semantics | **Good** if exact drop and abandoned-run cleanup are operated correctly | Not available |
| Secret handoff | **Simple inside CI** | **Moderate** across provider control plane and test invocation | **Moderate to complex** | Would require prohibited privilege exposure |
| Auditability | **Excellent** through CI run and artifact metadata | **Good to excellent** through provider audit plus test evidence | **Good**, but custom evidence plumbing is required | Insufficient |
| Malicious test containment | **Strong** if the child has no Docker socket, admin secret, or write token | **Strong** if it has only the short-lived API-role URL | **Medium to strong**, depending on network and cluster isolation | Not acceptable |
| Implementation complexity | **Medium** | **Medium to high** | **High** | Cannot safely implement |
| Standing cost | **None for the database service**; CI usage only | **Low to variable** compute/storage/API usage | **Continuous instance cost** plus operations | Existing service cost, but missing capability |
| Vendor dependence | **Low to medium**; portable CI/container pattern | **High** for branch and deletion APIs | **Medium** | High and currently blocking |
| CI suitability | **Excellent** | **Good** | **Medium** | Poor for disposable administration |
| Independent evidence | **Excellent** | **Good to excellent** | **Good** | Insufficient |
| Existing runner compatibility | Requires a bounded runner-only CI mode | Requires endpoint/TLS policy changes and provider qualification | Requires endpoint policy changes | Existing mode, but no provisioning channel |
| Overall | **Preferred** | **Fallback** | Not selected | Rejected |

## 6. Preferred architecture in detail

### 6.1 Trust boundaries

| Plane | Identity and secret scope | Allowed operations | Prohibited operations |
|---|---|---|---|
| CI control plane | CI platform identity; container-local `postgres` credential; approved source checkout | Start one service, create exact roles/database/binding, bootstrap, verify, clean up, publish non-secret evidence | Application requests, production access, arbitrary database targets |
| Disposable database admin plane | Container-local `postgres` | Exact role/database/object lifecycle for one UUID-bound run | Any `heliumdb` or production connection |
| Coordinator plane | Approved CI step; normal development `ledgerly_api` only if the approved manifest design uses direct CI verification | Validate source digests, prepare sanitized child environment, compare manifests | Database administration, exposing credentials to child |
| Test plane | Disposable `ledgerly_api` only | Run the fixed canonical test command and approved SQL | Create/drop database, role changes, ownership, trigger changes, session termination |
| Evidence plane | CI artifact writer with an allowlisted schema | Store hashes, identities, statuses, timestamps, and test evidence | Store URLs, passwords, tokens, nonce, environment dumps |

The test process must run without:

- the container-local `postgres` password;
- a CI provider administration token;
- a Docker or container-runtime socket;
- a repository write token;
- a deployment or production secret;
- the normal `heliumdb` connection URL;
- generic cloud credentials;
- arbitrary workflow inputs used as SQL identifiers or shell fragments.

### 6.2 Lifecycle

1. Accept only a manually approved or protected-branch CI event.
2. Reject fork-originated and untrusted pull-request execution.
3. Check out an exact commit with read-only repository permission.
4. Compute SHA-256 digests for the schema, Drizzle configuration, overlay, and
   fixed test command.
5. Generate a version-4 run UUID and cryptographically random nonce inside the
   control plane.
6. Derive the exact database name
   `ledgerly_canonical_test_<32 lowercase hexadecimal UUID characters>`.
7. Start a fresh PostgreSQL 16 service container without a persistent volume.
8. Verify `current_user = postgres`, the exact PostgreSQL version, and the
   expected local service endpoint.
9. Create:
   - `ledgerly_canonical_owner` as `NOLOGIN`, non-superuser, `NOINHERIT`,
     `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, and `NOBYPASSRLS`;
   - `ledgerly_api` as `LOGIN`, non-superuser, `NOINHERIT`, `NOCREATEDB`,
     `NOCREATEROLE`, `NOREPLICATION`, and `NOBYPASSRLS`, with a per-run random
     password.
10. Create only the exact derived disposable database.
11. Create the private immutable `ledgerly_test_control.run_identity` binding
    before exposing runtime access.
12. Apply the exact Drizzle bootstrap and approved RS-01 disposable overlay.
13. Verify ownership, ACLs, fixed function search paths, composite keys,
    indexes, five `ENABLE ALWAYS` triggers, role attributes, empty baseline,
    source digests, and private run binding.
14. Construct the coordinator environment. The disposable API-role URL may be
    held only in protected process memory or a runner-local file with restrictive
    permissions. It must not be a command-line argument, workflow output, log
    field, or artifact.
15. Invoke the existing canonical test command through a bounded coordinator
    mode. The child receives only the disposable `DATABASE_URL`.
16. Prove two-connection overlap, lock behavior, final outcomes, runtime
    identity, and absence of privileged sessions.
17. Close all test pools and verify no `ledgerly_api` session remains.
18. Run cleanup in an unconditional CI cleanup step:
    - revalidate the exact run binding;
    - terminate only sessions on the exact bound disposable database if needed;
    - drop only the exact bound database;
    - verify nonexistence;
    - delete runner-local credential material.
19. Publish the non-secret evidence artifact.
20. End the job. The CI platform destroys the fresh service container even when
    the test or SQL cleanup step fails.

No reusable database-administration endpoint is introduced.

### 6.3 Existing runner impact requiring later approval

The existing coordinator is intentionally Replit-development-specific and
requires the disposable and normal databases to share an endpoint. That policy
is incompatible with any genuinely external PostgreSQL target.

A later implementation package must propose a narrow runner-only change that:

- adds an explicit external-CI mode activated only by reviewed CI attestation;
- preserves the existing mode unchanged for prior evidence compatibility;
- removes the `REPLIT_DEV_DOMAIN` requirement only in the external-CI mode;
- replaces same-endpoint equality with an exact local service-container
  allowlist and post-connect server identity verification;
- keeps the exact UUID-derived database name and `ledgerly_api` identity checks;
- keeps source digest and private nonce binding;
- keeps no-fallback behavior;
- keeps child-environment scrubbing;
- records that the external target is isolated rather than claiming it matches
  the normal development endpoint;
- rejects every production/deployment marker and credential.

This is test infrastructure work only. It must not change canonical posting
behavior, authority providers, product routes, schema, migrations, roles in
`heliumdb`, or production configuration.

### 6.4 `heliumdb` before/after manifest

The before/after `heliumdb` manifest remains mandatory.

The preferred initial design is:

- store the normal development `ledgerly_api` URL as a CI environment secret
  restricted to a manually approved Ledgerly canonical-test environment;
- expose it only to the non-privileged coordinator step;
- never expose it to the test child, bootstrap step, service container,
  evidence process, or logs;
- read only the approved deterministic manifest subjects before and after the
  disposable run;
- require byte-for-byte equality;
- fail the workflow if the external CI runner cannot reach the development
  endpoint securely.

This design does expand the storage location of the normal development runtime
credential and therefore requires explicit approval. If that expansion is not
approved, the implementation package must instead define a Replit-side
pre/post attestation handshake bound to the same run UUID, nonce hash, source
digests, and CI run identity. The CI job must never silently omit the manifest.

Production credentials are prohibited in both variants.

### 6.5 Crash and abandoned-run behavior

The preferred architecture has two cleanup layers:

1. an unconditional admin cleanup step that validates and drops the exact
   database; and
2. CI destruction of the job-scoped service container without a persistent
   volume.

If the runner is terminated before the cleanup step:

- the job is failed;
- no completion evidence is issued;
- the CI platform still destroys the service container;
- no external database remains;
- the evidence artifact records the last completed lifecycle phase if artifact
  publication is still possible.

Container destruction is not a substitute for the logical cleanup test.
Successful evidence must still prove exact binding revalidation, session
closure, drop, and nonexistence before job completion.

## 7. Fallback managed-branch architecture

### 7.1 Required provider model

The fallback provider must offer:

- an API to create and delete a non-production project or branch;
- a direct, unpooled PostgreSQL endpoint;
- branch- or project-scoped roles and credentials;
- an empty, synthetic-only parent with no production or development data;
- hard deletion or a documented maximum retention period;
- lifecycle metadata or annotations containing only non-secret run identifiers;
- provider audit logs or API operation records;
- TLS with hostname verification;
- a supported PostgreSQL 16 engine;
- enough administrator capability to reproduce every RS-01 ownership and role
  requirement.

A branch must be created from an empty dedicated test root, not from production
or `heliumdb`. Copy-on-write branching is acceptable only when the parent is
provably empty of business data and the run still applies the authoritative
schema and overlay from the bound source digests.

### 7.2 Neon-style reference assessment

Neon's official documentation describes:

- API creation and deletion of branches;
- copy-on-write branch isolation;
- optional branch expiration;
- branch-scoped PostgreSQL roles;
- a difference between roles created through the Console/API and roles created
  through SQL;
- direct PostgreSQL connection strings;
- provider-specific PostgreSQL compatibility limits.

This is promising but not sufficient evidence for Ledgerly approval.

The qualification must specifically prove:

- whether an administrative role can operate with the exact expected identity
  `postgres`, or whether a separately approved binding/overlay change would be
  required;
- that `ledgerly_canonical_owner` can be created as an exact `NOLOGIN`,
  `NOINHERIT`, non-superuser owner;
- that `ledgerly_api` is created through SQL without provider-admin membership;
- that `ALTER TABLE ... OWNER TO ledgerly_canonical_owner` and
  `ALTER FUNCTION ... OWNER TO ...` work;
- that all five `ENABLE ALWAYS` triggers are honored;
- that direct connections preserve backend sessions, locks, `lock_timeout`,
  `55P03`, and `40P01`;
- that hard deletion has the approved data-retention meaning;
- that provider-created roles do not receive unintended elevated membership;
- that cleanup can target an immutable provider resource ID plus the internal
  run binding, never a name alone.

If any exact requirement requires weakening RS-01 or changing the runtime role,
the managed-branch fallback is rejected.

### 7.3 Secret handoff

The external control plane may hold:

- the provider API token;
- the provider database administrator connection;
- the per-run `ledgerly_api` credential before handoff.

The Replit workspace and test process may receive only:

- the exact short-lived `ledgerly_api` URL;
- run UUID;
- database name;
- environment marker;
- source digests;
- nonce only where required by the non-privileged coordinator.

The provider API token and administrator URL must never enter Replit Secrets,
the API workflow, application code, test child, evidence, logs, or chat.

A later package must identify a supported one-run secret-delivery mechanism.
Temporarily placing a credential in normal workspace configuration without
deterministic removal is not approved.

### 7.4 Cleanup

Cleanup must:

1. close test sessions;
2. verify the provider resource ID, run UUID, internal binding, source digests,
   and nonce hash;
3. terminate only exact bound sessions if the provider permits it;
4. delete the exact branch or project through the external control plane;
5. request hard deletion when supported and approved;
6. verify provider-reported deletion;
7. revoke or delete the per-run role/credential;
8. retain only non-secret evidence;
9. use provider expiration as a failsafe, not as the normal cleanup path.

## 8. Dedicated non-production instance assessment

A dedicated PostgreSQL instance can satisfy upstream PostgreSQL semantics and
the exact `postgres` administration model. It is not selected because:

- the instance incurs continuous compute/storage cost;
- patching, backup policy, network policy, monitoring, and abandoned-run cleanup
  become Ledgerly operational responsibilities;
- PostgreSQL roles are cluster-scoped, so one literal `ledgerly_api` role and
  credential can cross database boundaries unless runs are serialized and the
  credential is rotated;
- safe parallel runs would require stronger network controls, separate
  instances, or a departure from the exact runtime role name;
- a custom provisioner and evidence system would have to be operated
  continuously;
- database drop is the only final disposal boundary unless the whole instance is
  also ephemeral.

This option should be reconsidered only if:

- external CI service containers are unavailable;
- the managed-branch fallback fails qualification;
- a dedicated budget and operator are approved;
- canonical runs are serialized or isolated by instance;
- the full lifecycle and secret boundary are independently reviewed.

## 9. Replit alternative assessment

The current Replit-managed PostgreSQL channel is not a supported substitute for
the missing disposable administration plane.

The available evidence establishes:

- managed SQL currently authenticates as `ledgerly_api`;
- the project-accessible channel does not expose the required
  `CREATE DATABASE`, `DROP DATABASE`, exact session termination, or
  `postgres`-identity operations;
- broadening `ledgerly_api` is prohibited;
- storing a PostgreSQL administrator credential in the workspace is prohibited;
- `heliumdb` is not a disposable target;
- Replit's documented development/production separation does not provide a
  per-test database lifecycle API for this use case.

Replit remains the normal development application environment. It is not the
selected disposable database administrator.

## 10. Threat model

| Threat | Required control |
|---|---|
| Administrator credential leakage | Step-scoped secret; never passed to child, command line, output, artifact, or repository |
| Normal development credential leakage | Restricted CI environment or approved local attestation; never passed to test child |
| Malicious test process | Unprivileged process, no admin secret, no Docker socket, no repository write token, disposable API role only |
| Forged database URL | Strict URI parser, no target overrides, exact expected endpoint, post-connect identity and server-address verification |
| Wrong database cleanup | Immutable internal binding plus external resource ID and exact UUID-derived name; no prefix-only deletion |
| `heliumdb` fallback | All disposable values required; exact inequality; fail before any fixture insert |
| Production connection | No production secrets; explicit deployment rejection; endpoint allowlist; synthetic-only parent |
| TLS interception | Hostname and CA verification; direct endpoint; no permissive TLS downgrade |
| Cross-run credential reuse | Per-container or per-branch role and password; short expiry; one run binding |
| Cross-run database access | Container/branch/project isolation; do not share a cluster-scoped API credential across parallel runs |
| Deadlock/timeout masking | Direct PostgreSQL connection; preserve SQLSTATE; no proxy retry |
| Crash before SQL cleanup | Unconditional cleanup plus service-container destruction or provider expiry failsafe |
| Evidence leakage | Allowlisted structured fields and hashes only; prohibit URLs, tokens, passwords, nonce, and environment dumps |
| Untrusted contribution execution | Manual approval/protected branch; no secrets on fork-originated workflows |
| Dependency or image substitution | Exact source commit, lockfile, image patch version, and immutable digest |
| Provider control-plane compromise | Narrow project token, synthetic-only project, no production/development data, audit log, rotation |

## 11. Evidence requirements

The future evidence bundle must contain no secret and must include:

### Authorization and source

- CI provider and workflow run ID;
- protected/manual trigger class;
- exact source commit identity;
- schema, Drizzle configuration, overlay, and test-command digests;
- PostgreSQL image version and immutable digest, or provider engine version;
- non-secret CI configuration digest;
- run UUID, derived database name, environment, and nonce SHA-256.

### Bootstrap and identity

- `current_database()`;
- `current_user` and `session_user` for admin verification and test verification;
- PostgreSQL server version;
- role attributes and memberships;
- object owners and ACL hashes;
- fixed function search paths;
- constraint and index identities;
- five trigger names and always-enabled state;
- empty canonical and legacy baseline.

### Transaction and concurrency

- distinct backend PIDs;
- overlap barrier evidence;
- `READ COMMITTED` result;
- lock acquisition and release evidence;
- bounded lock timeout and SQLSTATE;
- controlled deadlock and SQLSTATE;
- rollback visibility result;
- canonical test result and failure classification.

### Boundary and cleanup

- child environment-scrubbing result;
- absence of privileged test sessions;
- `heliumdb` before/after manifest and equality result;
- exact binding revalidation before cleanup;
- sessions closed or exact sessions terminated;
- exact database drop result;
- post-drop nonexistence;
- service-container destruction or provider deletion result;
- credential deletion/revocation result;
- cleanup timestamp and abandoned-run classification if applicable.

Evidence must never contain:

- a full or redacted connection string;
- password;
- API token;
- administrator URL;
- actual nonce;
- environment dump;
- private certificate or key;
- production identifier or data.

## 12. Operational complexity and expected cost

### Preferred external CI service container

Expected cost components:

- no separate standing PostgreSQL service fee;
- external Linux CI runner minutes;
- small CI artifact storage;
- container image transfer/cache;
- engineering time for the bounded runner mode, workflow, and review.

The database cost is zero while no job is running. Total monetary cost depends
on the selected CI account's included minutes and overage rate. The later
implementation package must record:

- selected CI provider and plan;
- estimated minutes per run after a measured dry run;
- expected monthly run count;
- artifact retention period;
- monthly budget cap;
- automatic cancellation timeout.

### Managed-branch fallback

Expected cost components:

- provider compute while the branch/project endpoint is active;
- storage and retained history;
- branch/project count limits;
- API or plan limits;
- optional audit-log or enterprise security features;
- engineering time for provisioning, TLS, handoff, cleanup, and qualification.

No exact monetary estimate is possible until a provider, region, plan, compute
size, retention policy, and expected run frequency are selected. The fallback
must not be approved without that estimate.

### Dedicated instance

Expected cost components:

- continuous instance compute;
- storage and backups;
- monitoring and network controls;
- patching and operations;
- provisioner and cleanup service;
- incident response for abandoned runs.

This is expected to be the highest-cost option and is not justified for the
current narrow test requirement.

## 13. Approval gates before implementation

No implementation may begin until a separate approval package resolves:

1. the external CI provider and repository hosting relationship;
2. whether GitHub Actions or an equivalent platform is available;
3. the current `heliumdb` PostgreSQL major version;
4. the exact PostgreSQL 16 patch version and image digest;
5. the protected/manual trigger policy;
6. the CI environment secret access policy;
7. whether storing the development `ledgerly_api` URL in restricted CI is
   approved, or whether a Replit-side attestation handshake is required;
8. the exact runner-only changes and their negative controls;
9. the CI network policy and proof that no production secret is present;
10. the non-secret evidence schema and retention period;
11. the cleanup timeout and failure escalation path;
12. the monthly CI budget and run cap;
13. the independent security reviewer;
14. the fallback provider and zero-data qualification plan;
15. the source owner who may authorize a canonical-test run.

If any gate requires elevating `ledgerly_api`, weakening RS-01, using
`heliumdb` for fixtures, exposing an administrator credential to project code,
or contacting production, implementation must stop.

## 14. Minimum later implementation package

The next package should be a narrowly scoped approval request for the preferred
external CI architecture. It should include:

- proposed workflow and trust-boundary diagram;
- exact event and permission policy;
- exact service-container configuration;
- exact role creation and run-binding SQL;
- exact secret scopes and child environment;
- exact runner changes as a patch for review, not yet executed;
- negative controls for endpoint override, missing binding, forged resource ID,
  fork events, secret inheritance, and cleanup mismatch;
- PostgreSQL compatibility qualification script;
- evidence schema and sample redacted artifact;
- cleanup and crash-recovery sequence;
- budget estimate;
- rollback/removal plan;
- explicit statement that TR-01 remains paused until independent evidence passes.

## 15. Sources consulted

Public documentation was reviewed without creating an account or connecting to
an external database:

- GitHub Docs, “Creating PostgreSQL service containers”:
  <https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers>
- GitHub Docs, “Communicating with Docker service containers”:
  <https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers>
- GitHub Docs, “Using secrets in GitHub Actions”:
  <https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions>
- Neon Docs, “Branching with the Neon API”:
  <https://neon.tech/docs/guides/branching-neon-api>
- Neon Docs, “Manage branches”:
  <https://neon.tech/docs/manage/branches>
- Neon Docs, “Manage roles”:
  <https://neon.tech/docs/manage/roles>
- Neon Docs, “Manage database access”:
  <https://neon.tech/docs/manage/database-access>
- Neon Docs, “Postgres compatibility”:
  <https://neon.tech/docs/reference/compatibility>
- Neon API, “Delete branch”:
  <https://api-docs.neon.tech/reference/deleteprojectbranch>
- PostgreSQL 16 Documentation, “Transaction Isolation”:
  <https://www.postgresql.org/docs/16/transaction-iso.html>
- PostgreSQL 16 Documentation, “Explicit Locking”:
  <https://www.postgresql.org/docs/16/explicit-locking.html>
- PostgreSQL 16 Documentation, “Client Connection Defaults”:
  <https://www.postgresql.org/docs/16/runtime-config-client.html>
- PostgreSQL 16 Documentation, “PostgreSQL Error Codes”:
  <https://www.postgresql.org/docs/16/errcodes-appendix.html>
- PostgreSQL 16 Documentation, `CREATE FUNCTION`:
  <https://www.postgresql.org/docs/16/sql-createfunction.html>
- PostgreSQL 16 Documentation, `ALTER TABLE`:
  <https://www.postgresql.org/docs/16/sql-altertable.html>
- PostgreSQL 16 Documentation, “Database Roles”:
  <https://www.postgresql.org/docs/16/user-manag.html>
- Replit Docs, “SQL Database”:
  <https://docs.replit.com/features/data-and-storage/sql-database>
- Replit Docs, “Development and production databases”:
  <https://docs.replit.com/features/data-and-storage/development-and-production>

## 16. Governance status

This review:

- selects an architecture for a later approval package;
- does not approve implementation;
- does not resume or complete TR-01;
- does not change Task #46 state;
- does not mark `#44` complete;
- does not resume `#40-CF-01`;
- does not execute `#41`;
- does not alter DEC-01 through DEC-22;
- does not create DEC-23;
- does not change DEC-12;
- does not change source-freshness governance;
- does not change BL-06 or BL-07;
- does not enable production posting.

READY FOR EXTERNAL DISPOSABLE POSTGRESQL SELECTION