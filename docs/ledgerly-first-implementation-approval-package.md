# Ledgerly First Implementation Approval Package

**Status:** REVIEW ONLY — NO IMPLEMENTATION AUTHORISED  
**Review conclusion:** Planning/design work is complete enough to seek approval
for one narrowly scoped first implementation task.  
**Governance baseline:** DEC-01 through DEC-22 APPROVED  
**BL-06 / BL-07:** BLOCKED  
**DEC-23:** Not created and not required  
**Related planning records:**

- [Ledgerly Implementation Brief](ledgerly-implementation-brief.md)
- [Ledgerly Source-Freshness and Posting-Safety Contract](ledgerly-source-freshness-posting-safety-contract.md)
- [Ledgerly Safety-Rule Ownership Record](ledgerly-safety-rule-ownership-record.md)
- [Ledgerly Accounting Core Architecture Review](ledgerly-accounting-core-architecture-review.md)
- [Ledgerly Accounting Core Decision Pack](ledgerly-accounting-core-decision-pack.md)
- [Ledgerly Historical Accounting Migration Pilot Plan](ledgerly-historical-accounting-migration-pilot-plan.md)
- [Ledgerly Master Backlog](ledgerly-master-backlog.md)

> This is a final implementation approval package for review. It does not
> approve, create, or execute an implementation task. It does not change
> application code, schema, migrations, accounting logic, UI, workflows,
> dependencies, infrastructure, deployment, publishing, migration, or
> cutover.

## 1. Combined review of #39, safety-rule ownership, #40, and #41

### 1.1 Findings

The four planning/design workstreams are consistent when their authority levels
are kept distinct:

| Workstream | What it establishes | What it does not establish |
|---|---|---|
| #39 — source freshness/posting safety | Final revalidation contract for consequential persistence: principal, tenant, source, period, configuration, mappings, VAT, domain state, idempotency, concurrency, accounting invariants, atomicity, and audit | A physical schema, API, queue, provider, or implementation task |
| Safety-rule ownership | Eight preserved logical ownership boundaries and one consequential command boundary | Microservices, modules, routes, tables, or a new governance decision |
| #40 — canonical accounting foundation | Canonical journals/lines, balanced double-entry, immutable posted history, corrections/reversals, account/period/configuration context, payment separation, VAT authority, and journal-authoritative reporting | Permission to implement BL-06/BL-07 or a selected physical data model |
| #41 — historical migration pilot | Additive adapters, snapshots, provenance, explicit exceptions, validation/reconciliation, recovery, bounded comparison, controlled cutover, and legacy read-only evidence | A selected source/cohort, extraction, migration, cutover, or implementation task |

### 1.2 No contradiction identified

No conflict requiring a governance amendment was found across these planning
records. Their intended sequence is:

```text
Principal and tenant authority
  -> consequential command boundary
  -> source freshness and final revalidation
  -> accounting context and domain-state validation
  -> idempotency/concurrency boundary
  -> canonical posting authority
  -> atomic audit evidence
```

Migration adapters enter as a source-specific producer of candidates and
evidence. They do not bypass this sequence or create canonical journals
directly.

### 1.3 Responsibilities that must not be duplicated

The following ownership boundaries are preserved exactly:

1. **Consequential Accounting Command Boundary** — the single server-side
   orchestration boundary for consequential persistence.
2. **Principal and Tenant Guard** — authentication, active membership,
   capability/approval, and company/resource scope.
3. **Source Freshness Guard** — source identity, revision/snapshot, evidence,
   stale/conflict, queue age, and approval-context comparison.
4. **Accounting Context Resolver** — posting date, financial year, accounting
   period, configuration version, control mappings, account eligibility, and VAT
   context.
5. **Domain State Guard** — payment, allocation, credit, prepayment, refund,
   reconciliation, migration, and other current operation state.
6. **Idempotency and Concurrency Coordinator** — command/effect identity,
   serialization, duplicate detection, and safe retry outcome.
7. **Canonical Posting Authority** — final journal invariants and canonical
   accounting transaction.
8. **Audit Evidence Writer** — durable evidence of checks, outcome, and effect.

In particular:

- Source freshness is not reassigned to DEC-12.
- The migration adapter is not a second posting authority.
- The audit writer does not grant permission to post.
- The command boundary does not become a second ledger.
- The Canonical Posting Authority is the only proposed owner allowed to create a
  canonical journal after all final checks pass.

### 1.4 Missing dependencies and unresolved questions

The following remain implementation design questions, not silently resolved
choices:

- exact first implementation task brief and approval;
- final source revision versus normalized hash/snapshot semantics;
- source evidence strength and no-native-revision handling;
- physical schema and relationship model;
- exact API/DTO/error contracts;
- transaction isolation and lock strategy;
- idempotency/economic-effect key construction and durable storage;
- account, control-mapping, period, and configuration-version representation;
- exact VAT interface and unsupported-treatment behavior;
- queue, worker, retry, and dead-letter technology;
- audit storage, immutability, redaction, and retention mechanics;
- source system, cohort, record classes, and migration thresholds;
- recovery provider, RPO/RTO, and restore operations;
- universal RLS adoption;
- final user-facing UI and workflow behavior;
- post-cutover comparison duration and materiality thresholds; and
- deployment and publishing controls.

These open choices do not block the recommended first task because that task
does not post, migrate, alter schema, or create a consequential accounting
effect. They remain mandatory before any task that persists accounting.

### 1.5 Unsafe assumptions rejected

This package rejects these assumptions:

- governance approval means implementation approval;
- existing authentication means all company actions are safe;
- role names or browser controls are sufficient authority;
- current generic CRUD is a safe canonical posting path;
- the existing JSON journal shape is the final canonical model;
- a source snapshot is current without final revalidation;
- a migration adapter may write directly to journals;
- a paid/balance field proves payment or allocation history;
- a bank match proves a canonical payment;
- a source VAT field overrides DEC-03;
- current configuration can be presented as historical configuration;
- a migration batch date can replace a historical posting date;
- a report projection can become accounting authority;
- RLS is already selected or sufficient on its own; or
- a new DEC is needed to connect these approved decisions.

### 1.6 Accidental policy changes avoided

This package does not:

- amend DEC-01 through DEC-22;
- assign source freshness to DEC-12;
- create DEC-23;
- add a VAT scheme;
- add payment-on-account scope;
- change reporting-only year-end;
- make legacy systems permanent dual authorities;
- approve a migration source or cohort;
- unblock BL-06 or BL-07; or
- turn a proposed technical owner into an approved physical architecture.

## 2. BL-06 and BL-07 status and unblock evidence

### 2.1 BL-06 — Canonical Posting Engine

#### What BL-06 requires

BL-06 must eventually provide a server-side canonical accounting authority that:

- accepts validated source-linked posting commands;
- creates normalized journal headers and journal lines;
- uses integer minor units and explicit currency;
- enforces debit/credit and balanced double-entry invariants;
- records source identity, source revision/snapshot, and provenance;
- resolves company, financial year, period, configuration, account, control
  mapping, and VAT context;
- applies active membership, capability, approval, segregation-of-duties, and
  tenant checks;
- prevents duplicate economic effects through durable idempotency;
- serializes or rejects conflicting concurrent commands;
- commits journals, source/effect relationships, idempotency result, and
  required audit evidence atomically;
- makes posted history immutable;
- creates linked corrections/reversals rather than rewriting history;
- keeps payments, allocations, settlement, bank evidence, credits, prepayments,
  refunds, and reconciliation effects distinct;
- uses DEC-03 as the sole VAT authority;
- supports recovery and no-replay behavior under DEC-20; and
- supplies journal-authoritative reporting inputs.

#### Why BL-06 remains blocked

BL-06 remains blocked because:

- its architecture is approved as a foundation, not as implementation
  authorization;
- the physical data contract and schema are not approved;
- BL-03 and BL-04 prerequisites remain incomplete;
- source-freshness semantics are a planning contract, not an implemented guard;
- BL-07 context and posting controls are not implemented;
- capability, approval, concurrency, audit, recovery, and tenant contracts need
  an approved implementation design;
- payment/allocation/refund/reconciliation domain effects are not complete;
- acceptance and accounting-invariant tests are not yet an approved execution
  pack; and
- no explicit BL-06 implementation task has been approved.

#### Exact evidence required to unblock BL-06

Before BL-06 can be unblocked, the project must have all of the following:

1. an explicitly approved implementation task with scope and exclusions;
2. an accepted physical data contract for journal headers, lines, source/effect
   links, idempotency, corrections/reversals, audit, and provenance;
3. an approved relationship to BL-07 period, account, mapping, and
   configuration context;
4. a completed #39 implementation treatment covering source freshness,
   conflicts, retries, concurrency, and final revalidation;
5. a preserved eight-boundary ownership design without bypass routes;
6. approved capability, active-membership, tenant, support, and segregation-
   of-duties behavior;
7. deterministic money, currency, VAT, account, control-mapping, period, and
   configuration contracts;
8. an idempotency/economic-effect and transaction/atomicity design;
9. immutable posting and linked correction/reversal behavior;
10. payment/allocation/bank/reconciliation non-duplication rules;
11. unit, integration, concurrency, idempotency, permission, company-isolation,
    accounting-invariant, failure, recovery, and rollback tests;
12. audit, observability, rejection, retry, and uncertain-outcome behavior;
13. a migration/evidence compatibility strategy that does not require
    immediate migration execution;
14. accounting, security, architecture, product, and operations review; and
15. explicit user approval of the implementation task.

### 2.2 BL-07 — Chart, Defaults, Periods, and Accounting Configuration

#### What BL-07 requires

BL-07 must eventually provide:

- stable company-scoped Chart of Accounts identity and classification;
- controlled account types and defaults;
- DEC-10 protected AR, AP, bank/cash, Input VAT, Output VAT, and settlement
  mappings;
- financial-year definition and assignment under DEC-06;
- accounting-period identity, contiguous state, close/reopen controls, and
  closed-period protection under DEC-07;
- reporting-only year-end behavior under DEC-08;
- immutable effective-dated material configuration under DEC-11;
- posting/document numbering and control rules;
- server-side validation of account eligibility and mapping;
- capability and approval boundaries for chart/configuration/period actions;
- company/tenant isolation and audit;
- concurrency behavior when period/configuration state changes during posting;
  and
- recovery and no-replay behavior for configuration and period changes.

#### Why BL-07 remains blocked

BL-07 remains blocked because:

- the approved policies do not select a physical schema or API;
- its dependency relationship with canonical posting must be implemented and
  tested rather than assumed;
- period/configuration concurrency and effective-dating behavior remain open;
- chart defaults and protected mapping activation/immutability need a physical
  contract;
- capability and approval behavior needs a separately approved implementation
  design;
- close/reopen, numbering, recovery, audit, and tenant behavior are not
  implemented;
- no explicit BL-07 implementation task has been approved; and
- BL-06 depends on the resulting context, while BL-07 must not be smuggled into
  an unbounded BL-06 build.

#### Exact evidence required to unblock BL-07

Before BL-07 can be unblocked, the project must have:

1. an explicitly approved implementation task with independently testable
   scope;
2. an accepted physical contract for accounts, protected mappings, financial
   years, periods, configuration versions, numbering, and control state;
3. effective-dated and immutable configuration semantics;
4. a period/year/close/reopen concurrency design;
5. capability, approval, active-membership, tenant, support, and audit rules;
6. account and control-mapping eligibility and uniqueness rules;
7. a clear relationship to the Canonical Posting Authority;
8. validation for period, year, account, mapping, configuration, and
   reporting-only year-end invariants;
9. recovery and no-replay behavior;
10. unit, integration, concurrency, permission, company-isolation, accounting,
    failure, and recovery tests;
11. architecture, accounting, security, product, and operations review; and
12. explicit user approval of the implementation task.

### 2.3 Should BL-06 or BL-07 be split?

**Review finding:** Yes, they should be split into independently reviewable
implementation slices before execution, but this package does not create or
schedule those slices.

The split should preserve:

- BL-07's context/configuration responsibilities;
- BL-06's canonical posting responsibilities;
- the single Consequential Accounting Command Boundary;
- the eight logical ownership boundaries; and
- one canonical posting authority.

The split must not create competing ledgers, duplicate period/configuration
resolution, or an implementation path that bypasses #39. Exact sequencing and
task decomposition require a future approved implementation brief.

### 2.4 Are BL-06 or BL-07 the correct first implementation area?

No. Neither is the correct first implementation area.

Both are large, high-consequence, schema-affecting accounting-core efforts.
They require prerequisites, physical contracts, accounting-invariant tests,
recovery behavior, tenant controls, and an explicit implementation approval
that do not yet exist.

The first implementation should establish one narrow server-side safety
prerequisite without creating accounting effects. The recommendation below uses
the existing P0 BL-01 backlog item.

## 3. Recommended first implementation task

### TASK NAME

**Complete server-side active-membership and company-scope enforcement**

### TASK ID

**BL-01-FI — proposed first-implementation identifier only; not created or
approved**

This is a tightly scoped first implementation slice of the existing BL-01
backlog area, not a new project task record.

### PURPOSE

Implement the reusable **Principal and Tenant Guard** prerequisite required by
DEC-05, DEC-21, #39, #40, and the future Consequential Accounting Command
Boundary.

The guard must fail closed when the authenticated principal does not have an
active membership in the server-resolved company scope. It must prevent a
deactivated or cross-company principal from reaching protected company actions.

The task creates no accounting effect. It is intended to establish the smallest
useful server-side authority boundary before work on canonical posting,
configuration, or migration.

### SCOPE

The future approved task should contain only:

1. Resolve the target company from trusted server-side context and the protected
   resource, not from an untrusted client role or company claim.
2. Load and evaluate the principal's active membership for that company.
3. Reject missing, inactive, malformed, expired, or mismatched membership.
4. Reject a request when the requested company/resource does not match the
   server-resolved company.
5. Make the guard fail closed on lookup errors, missing context, or ambiguous
   ownership.
6. Provide a reusable typed authorization result for protected server actions.
7. Ensure protected paths cannot silently fall back to a generic or
   client-controlled company/role check.
8. Cover human request context and ensure a background job cannot use ambient
   or missing company context as authority.
9. Preserve an audit/correlation hook for protected decisions using existing
   facilities, without adding an audit schema in this task.
10. Add focused tests for positive, negative, concurrent-revocation, and
    cross-company behavior.

The task must not create a posting command, journal, payment, allocation,
refund, VAT effect, migration record, or canonical accounting write.

### FILES / AREAS EXPECTED TO CHANGE

Expected areas after explicit approval, subject to a task-specific file review:

- API-server authentication and company-membership authorization boundary;
- a reusable server-side Principal and Tenant Guard/helper;
- protected API request context handling;
- narrowly selected server-side protected-path integration points;
- API unit/integration/security test areas; and
- existing audit/correlation plumbing only where required to preserve the
  decision result.

Expected non-changes:

- no database schema files;
- no migration files;
- no journal or accounting tables;
- no canonical posting service;
- no VAT calculation or payment/allocation logic;
- no migration adapter or source connector;
- no frontend/UI changes;
- no workflow/dependency/infrastructure changes;
- no deployment or publishing configuration.

The exact source files and one or more protected integration points must be
listed in the separately approved implementation brief. This package does not
select them or modify them.

### DEPENDENCIES

Required conceptual dependencies:

- DEC-01 governance hierarchy;
- DEC-05 capability and approval model;
- DEC-21 tenant isolation;
- #39 source-freshness/posting-safety contract;
- safety-rule ownership record, preserving Principal and Tenant Guard;
- #40 canonical accounting foundation's server-side authority boundary; and
- existing authenticated principal/membership source.

Not required for this first task:

- BL-06 implementation;
- BL-07 implementation;
- migration source/cohort;
- historical data;
- canonical journal schema;
- VAT workflow implementation;
- payment/allocation/refund workflows;
- production deployment; or
- RLS adoption.

### ACCOUNTING RISKS

This task does not post accounting, but an unsafe guard would create future
accounting risk by allowing an unauthorised principal to reach consequential
commands.

Required mitigations:

- fail closed on missing or uncertain membership;
- derive company scope server-side;
- prevent cross-company resource access;
- do not treat the guard as sufficient for future posting;
- preserve explicit downstream gates for source freshness, period,
  configuration, VAT, mappings, domain state, idempotency, invariants, and
  audit; and
- add a no-accounting-side-effect test for every path in the task scope.

### SECURITY RISKS

Primary risks:

- fail-open behavior when membership lookup fails;
- stale membership cache after deactivation;
- trusting a client-supplied company or role;
- checking the user but not the target resource;
- background jobs running without explicit company context;
- support/break-glass behavior bypassing ordinary audit and scope; and
- information leakage through cross-company errors.

Required mitigations:

- authoritative server-side membership lookup or a documented invalidation
  mechanism;
- fail-closed error handling;
- explicit company/resource ownership checks;
- explicit job principal and company context;
- no unrestricted superuser path;
- business-language authorization errors without cross-company disclosure; and
- security review of support, recovery, export, document, and AI context even
  if those paths are not fully implemented by this task.

### ACCEPTANCE CRITERIA

The future task is acceptable only when:

1. a principal with active membership can pass the guard for the matching
   company/resource scope;
2. a missing membership is rejected;
3. an inactive/deactivated membership is rejected immediately according to the
   authoritative membership semantics;
4. a company mismatch is rejected even when the principal is active in another
   company;
5. a client-supplied role or company cannot grant access;
6. a missing, malformed, ambiguous, or failed membership lookup cannot grant
   access;
7. a background job must carry explicit company scope and principal context;
8. the guard cannot be bypassed through a generic protected write path selected
   for this task;
9. authorization results are deterministic and suitable for audit/correlation;
10. errors do not reveal another company's records or membership;
11. the task creates no journal, payment, allocation, VAT, migration, or other
    accounting effect;
12. the task changes no schema or migration;
13. tests cover all required negative cases; and
14. the implementation review confirms that BL-06, BL-07, #39, #40, and #41
    remain separate future work.

### TESTS REQUIRED

Minimum tests before acceptance:

#### Unit tests

- active membership and matching company passes;
- missing membership fails;
- inactive membership fails;
- malformed principal/company context fails;
- client role/company claims cannot override server context;
- resource ownership mismatch fails;
- membership lookup failure fails closed;
- ambiguous membership state fails closed;
- deterministic authorization result and error classification; and
- no accounting-effect result is possible from the guard.

#### Integration tests

- protected server action uses the guard;
- authenticated user in Company A cannot access Company B;
- deactivation is observed before the next protected action;
- protected request with stale or absent company context is rejected;
- background job without explicit company context is rejected;
- background job with another company's context is rejected; and
- generic or alternate route cannot bypass the selected guard integration.

#### Concurrency and revocation tests

- access is rejected after membership deactivation according to the approved
  consistency boundary;
- concurrent authorization and deactivation do not grant access after the
  authoritative revocation point;
- cache invalidation or refresh behavior cannot leave a fail-open window; and
- lookup timeout/error cannot become success.

#### Permission and isolation tests

- every relevant membership state is tested;
- company/resource ownership is tested independently from user identity;
- support/break-glass paths are denied or explicitly scoped and auditable;
- document, export, job, and AI context are not broadened by this guard; and
- error responses do not expose cross-company existence.

#### Accounting-safety regression tests

Even though the task has no accounting write, tests must prove:

- no journal is created;
- no journal line is created;
- no payment/allocation/refund/VAT state changes;
- no migration/staging/cutover state changes;
- no accounting data is changed for denied requests; and
- future posting paths cannot treat this guard as a replacement for #39/#40
  final validation.

### ROLLBACK / RECOVERY CONSIDERATIONS

This first task should have a low-risk code rollback:

- no schema migration;
- no data migration;
- no canonical accounting writes;
- no production data rewrite;
- no deployment or publishing in this approval package; and
- no change to accounting authority.

If the guard causes an unexpected denial or compatibility regression, revert the
approved code change or disable only the narrowly selected integration through
the approved release process. Do not weaken the guard with a fail-open fallback.

If membership data or auth configuration is found to be inconsistent, stop the
affected work and preserve the evidence for review. Do not repair it by granting
temporary unrestricted access.

### REQUIRED REVIEWERS

- Product owner;
- security reviewer;
- architecture reviewer;
- API/server owner;
- identity/authentication owner;
- tenant-isolation reviewer; and
- testing/quality reviewer.

An accounting reviewer should confirm that the task creates no accounting
authority or side effect and that later BL-06/BL-07 gates remain intact.

### REQUIRED APPROVALS

Before execution:

1. explicit user approval of **BL-01-FI** as the first implementation task;
2. approval of the task brief, scope, exclusions, and expected file areas;
3. security and tenant-isolation approval;
4. architecture/API approval;
5. confirmation that no schema, migration, accounting, UI, workflow,
   dependency, infrastructure, deployment, or publishing work is included; and
6. confirmation that this approval does not unblock BL-06 or BL-07.

Governance approval for DEC-01 through DEC-22 is not a substitute for any of
these approvals.

## 4. Implementation boundary

### The first task must not touch

The recommended first task must not touch:

- historical data;
- migration or migration adapters;
- source extraction or transformation;
- source snapshots or cutover;
- production accounting data;
- canonical journals or journal lines;
- journal posting, correction, reversal, or immutability behavior;
- Chart of Accounts implementation;
- periods, financial years, close, reopen, or numbering;
- configuration-version implementation;
- control-account mappings;
- VAT calculation, VAT returns, or VAT locking;
- invoices, bills, payments, allocations, credits, prepayments, refunds, or
  reconciliation accounting;
- reporting authority;
- broad UI or frontend role controls;
- deployment or publishing;
- workflow definitions;
- new dependencies or infrastructure;
- RLS rollout;
- BL-06/BL-07 functionality;
- #39 source-freshness persistence;
- #40 canonical accounting persistence; or
- #41 migration-pilot execution.

### What it may establish

Only the server-side active-membership/company-scope prerequisite and its tests
may be established. The guard is a prerequisite, not a complete accounting
authority and not permission to post.

## 5. Schema determination

### Decision for the recommended first task

**The first task should avoid schema changes.**

The task only needs to evaluate existing authoritative membership/company
information and return a server-side authorization decision. It must not add
tables, columns, indexes, constraints, audit records, accounting structures,
migration records, or relationship models.

### If implementation discovers a schema requirement

If the task cannot satisfy its narrow contract without a schema change:

1. stop the affected work;
2. document the exact conceptual structure required;
3. explain the migration, retention, recovery, tenant, and accounting impact;
4. do not modify the schema;
5. return to approval for a separately scoped schema task.

No schema requirement is silently absorbed into BL-01-FI.

## 6. Source freshness and #39 use

The first task uses #39 as a boundary and dependency, not as a reason to create
another source-freshness task.

### What this task does

- preserves the Principal and Tenant Guard ownership boundary;
- provides trusted company/principal context for future final revalidation;
- prevents a missing or stale membership context from granting protected access;
- carries an authorization/correlation result suitable for later command
  envelopes; and
- ensures that a future consequential command cannot assume browser or job
  context is authority.

### What this task does not do

- no source revision/hash/snapshot implementation;
- no source adapter;
- no migration freshness logic;
- no queue/retry freshness;
- no final accounting revalidation;
- no period/configuration/VAT freshness check; and
- no consequential accounting persistence.

The later posting implementation must still execute the complete #39 final
revalidation sequence immediately before persistence. BL-01-FI must not be
described as implementing #39 in full.

## 7. Accounting safety invariant matrix

The first task has no accounting write. It must enforce its own narrow
authorization invariant and must preserve all downstream accounting gates.

| Invariant | BL-01-FI treatment |
|---|---|
| Balanced journals | Not implemented here. No journal may be created. BL-06 must enforce debit/credit balance before any post. |
| Immutable posted history | Not implemented here. No posted history may be written or edited. BL-06 must enforce append-only history and linked corrections. |
| No duplicate economic effect | No accounting effect exists, so the task must prove zero effect. BL-06/#39 must later enforce durable economic-effect idempotency. |
| Company scope | Enforced here: company is server-resolved, resource ownership is checked, and mismatch fails closed. |
| Capability | Not implemented as a posting capability here. The task must not claim active membership alone authorises accounting; future commands require DEC-05 capability and approval checks. |
| Period validity | Not implemented here. No period state is changed or used to post. BL-07/#39 must later resolve and validate it. |
| Configuration version | Not implemented here. No accounting configuration is selected or changed. BL-07/#39 must later resolve effective-dated context. |
| Control-account mapping | Not implemented here. No account or mapping is changed. BL-07/#40 must later validate DEC-10 mappings. |
| VAT authority | Not implemented here. No VAT calculation or effect occurs. Future accounting must use DEC-03 only. |
| Audit evidence | Authorization/correlation must remain observable through existing facilities; no new audit schema is permitted. Consequential audit must later commit atomically with accounting. |
| Atomicity | The guard decision must not create partial state. Future accounting must include journal, links, idempotency, domain state, and required audit in one authoritative transaction. |
| Source freshness | No source effect occurs here. Future consequential actions must use #39 final revalidation; this task must not bypass it. |

### Accounting stop rule

If any change required for BL-01-FI would create or alter a consequential
accounting effect, implementation must stop and return for a new task scope and
approval.

## 8. Test and acceptance gate

The first implementation task cannot be accepted merely because a happy-path
membership check passes. Acceptance requires:

- all unit, integration, concurrency, permission, isolation, failure, and
  accounting-no-side-effect tests above;
- evidence that the selected protected paths all use the same server-side
  decision;
- evidence that deactivation and company mismatch fail closed;
- evidence that no client role/company claim is trusted;
- evidence that background jobs carry explicit company context;
- evidence that no schema/data/accounting surface changed;
- security and architecture review sign-off; and
- explicit confirmation that BL-06/BL-07 remain blocked.

## 9. Approval gate

### Required decision before execution

The user must explicitly approve the exact task brief for:

> **BL-01-FI — Complete server-side active-membership and company-scope
> enforcement**

Approval must include:

- the exact scope;
- the exact exclusions;
- the reviewed file/area list;
- the no-schema-change determination;
- the test plan;
- the rollback plan;
- the named reviewers; and
- confirmation that no accounting, migration, deployment, or publishing work is
  included.

### Governance distinction

**APPROVED GOVERNANCE ≠ IMPLEMENTATION AUTHORISATION**

DEC-01 through DEC-22 being approved establishes constraints. It does not
approve BL-01-FI, BL-06, BL-07, schema changes, code changes, migration,
deployment, or publishing.

This package recommends BL-01-FI but does not approve it or execute it.

## 10. Remaining planning items

The following may safely remain open after approval of this package and while
the narrow first task is reviewed or implemented:

- historical migration source/cohort selection;
- migration extraction, transformation, cutover, and legacy retirement;
- migration adapter implementation;
- source-specific provenance storage;
- full export implementation;
- backup/recovery implementation and provider selection;
- full RLS rollout;
- canonical journal schema;
- BL-06 posting implementation;
- BL-07 chart/period/configuration implementation;
- payment/allocation workflow implementation;
- refund implementation;
- full reconciliation accounting effects;
- full VAT workflow implementation;
- broad UI and responsive work;
- queue/provider/deployment choices;
- exact AI integration;
- report migration to journal authority;
- physical audit-event storage;
- final source-freshness provider/hash details; and
- post-cutover comparison duration and materiality thresholds.

### Items that do remain gates for consequential accounting

The following are not required to implement BL-01-FI, but must be resolved
before any consequential accounting task:

- complete #39 final revalidation implementation treatment;
- #40 canonical journal and invariant design;
- BL-06/BL-07 implementation approval;
- physical schema/data contracts;
- capability and approval enforcement;
- period/configuration/control mapping;
- DEC-03 VAT authority integration;
- idempotency/concurrency/atomicity;
- audit evidence;
- recovery/no-replay;
- accounting and tenant-isolation tests; and
- explicit migration/cutover approvals for any migration effect.

## 11. Final verdict

**READY FOR FIRST IMPLEMENTATION TASK APPROVAL**

The planning package is ready for the user to decide whether to approve the
single recommended first task, **BL-01-FI**. It is not approved by this
document and must not be executed without explicit user approval.

No BL-06, BL-07, migration, schema, accounting, deployment, or publishing work
is authorised.

## 12. Final verification

- DEC-01 through DEC-22 remain APPROVED.
- No DEC-23 exists.
- BL-06 remains BLOCKED.
- BL-07 remains BLOCKED.
- #39 remains planning/design only.
- #40 remains planning/design only.
- #41 remains planning/design only.
- Safety-rule ownership remains planning/design only.
- No application code changed.
- No schema changed.
- No migration occurred.
- No accounting implementation occurred.
- No deployment occurred.
- No publishing occurred.
- No source was extracted or transformed.
- No canonical journal was created.
- No accounting authority changed.
- No implementation task was created or executed.

STOP. This package recommends one future task for explicit approval; it does
not approve or execute that task.