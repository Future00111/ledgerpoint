# DEC-21 — Tenant Isolation Policy

**Decision:** DEC-21 — Tenant isolation and RLS
**Scope:** Tenant isolation policy
**Status:** **APPROVED — security/product architecture policy only**
**Review date:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with security, accounting,
privacy, reliability, and architecture review
**Implementation authority:** None

> This records an approved security/product architecture policy. It does not
> approve DEC-22, and it does not authorise an implementation task, code, schema, migration,
> accounting logic, UI, workflow, dependency, infrastructure configuration,
> deployment, or publishing work.

## 1. Exact registered question

The Current Decision Register defines DEC-21 as:

> **Tenant isolation and RLS:** Decide the required combination of server-side
> company scoping, permission enforcement, and database-level row-level
> security.

The registered options are:

1. application scoping only;
2. RLS for accounting tables; or
3. RLS for all company-scoped tables.

The registered recommendation is:

> Mandatory authenticated server-side company scoping, with tested RLS
> evaluated as defence-in-depth rather than assumed universally.

This review records that policy without authorising its implementation.

## 2. Purpose and trust-boundary principle

Company isolation is a fundamental trust boundary. Company A and Company B
must be treated as separate accounting and security domains.

No feature, AI assistant, export, background process, support function, or
recovery mechanism may bypass the boundary merely for convenience.

Tenant isolation must prevent one company's data from being improperly:

- visible to another company;
- used to answer another company's request;
- included in another company's export or backup recovery;
- modified by another company's operation; or
- used to influence another company's accounting, reporting, configuration,
  audit, or AI result.

This review is a policy decision, not a detailed implementation plan. It does
not select a database product, schema, provider, pooling model, API design,
worker runtime, or deployment topology.

## 3. Constraints from DEC-01 through DEC-20

### Already decided

- **DEC-01:** Governance follows the approved hierarchy. A decision record
  does not itself authorise implementation.
- **DEC-02 and DEC-03:** The initial product is UK/GBP-oriented with source-
  linked VAT preparation and no direct HMRC submission.
- **DEC-04:** Canonical accounting is balanced, server-generated,
  source-linked, idempotent, append-only, immutable, and corrected through
  controlled reversals or replacement entries.
- **DEC-05:** Capabilities are company-scoped and enforced server-side.
  Owner, Admin, Accountant, Manager, and Read-only authority must not cross a
  company boundary merely because the same person has authority elsewhere.
- **DEC-06 through DEC-08:** Financial years, accounting periods, closed
  periods, and reporting-only year-end must retain company-specific historical
  meaning.
- **DEC-09 and DEC-10:** Chart identity, control mappings, and account
  lifecycle are company-scoped unless a future approved global reference is
  explicitly non-authoritative.
- **DEC-11:** Material accounting configuration is company-scoped,
  effective-dated, immutable by version, and selected by canonical posting
  date.
- **DEC-12 through DEC-16:** Payments, allocations, settlement, credits,
  prepayments, unapplied cash, refunds, VAT evidence, and reconciliation are
  distinct company-scoped accounting domains.
- **DEC-17:** Retention classes and required audit evidence apply to the
  correct company and cannot be exposed through another company's lifecycle
  view.
- **DEC-18:** Disposal, anonymisation, redaction, archival, and legal holds
  are controlled and must not be bypassed by another company or by a broad
  access path.
- **DEC-19:** Every export is company-scoped, server-generated,
  capability-controlled, auditable, finite, and never accounting authority.
- **DEC-20:** Backup and recovery must preserve strict company isolation,
  including isolated recovery and company-scoped validation.

### Consequences for DEC-21

Tenant isolation must apply consistently to:

- identity and membership;
- active company context;
- capability and resource authority;
- database ownership and relationships;
- service routes and mutations;
- reports and derived data;
- documents and object storage;
- background jobs and notifications;
- AI prompts, retrieval, memory, and action history;
- exports and audit packages;
- backups, restoration, and recovery tests; and
- support, administration, and incident response.

A single frontend selector, route parameter, database predicate, or middleware
layer is not sufficient evidence of a complete policy.

## 4. Company boundary

### Company as the authoritative tenant

A company is the authoritative business and accounting boundary for the
Ledgerly records belonging to that business. Every authoritative company-owned
record must have an unambiguous company owner, whether represented directly or
through an explicitly governed parent relationship.

At launch:

- journals, accounts, invoices, bills, payments, allocations, VAT, bank
  evidence, documents, configuration, audit events, exports, and AI context
  belong to exactly one company;
- a transaction cannot post to two companies;
- a company-specific report cannot include another company's records;
- a company-specific configuration cannot be selected for another company; and
- company ownership cannot be inferred only from a user, URL, browser state,
  document path, or free-text field.

Global non-authoritative reference data may exist where it cannot expose,
mutate, or influence company-owned accounting. The distinction must remain
explicit.

### Users and memberships

A user may belong to multiple companies. Membership is not authority by
itself. Access requires all of:

1. authenticated identity;
2. active membership in the requested company;
3. an explicit active company context; and
4. the DEC-05 capability required for the requested action and resource.

Authority in Company A never implies authority in Company B. Switching active
company must establish a new, validated company context rather than relying
on a client-side value.

Membership removal, suspension, or capability reduction must take effect for
subsequent access and must not leave previously issued access able to bypass
the current boundary.

### Cross-company records

Cross-company accounting, consolidation, group structures, intercompany
transactions, and multi-company reporting are not assumed launch features.
They remain future policy and product decisions. A future approved feature
must define its own controlled relationship rather than weakening ordinary
company isolation.

## 5. Authentication, authorisation, and company context

These are separate controls:

- **Authentication:** establishes which user or service is acting.
- **Membership:** establishes whether the actor belongs to the company.
- **Company context:** establishes which one company the operation addresses.
- **Capability:** establishes what the actor may do in that company.
- **Resource ownership:** establishes whether the requested record belongs to
  that company and is eligible for the action.

Every consequential operation must evaluate the full chain server-side.

The policy must not rely on:

- a hidden field supplied by the browser;
- a route segment without server validation;
- a previously selected company in client state;
- a role name without company membership and capability evaluation;
- an object identifier that does not prove company ownership; or
- a frontend filter to prevent cross-company access.

An actor with a valid session must still be denied if the requested resource
is outside the active company or capability scope.

## 6. Data ownership and relationship principle

Authoritative company-owned data must have explicit, enforceable ownership.
Relationships should not allow an object from Company A to silently reference
or retrieve a protected object from Company B.

The policy should require:

- company ownership for every authoritative company-scoped entity;
- company-safe relationships and references;
- rejection of ambiguous or missing ownership;
- consistent ownership checks on reads, writes, joins, reports, and deletes;
- no ownership change as a side effect of an ordinary update; and
- explicit, separately approved rules for any future shared or global object.

This is a policy expectation, not a prescription for a particular schema. The
implementation must demonstrate the invariant through appropriate constraints,
tests, service checks, and database controls.

## 7. Accounting isolation

Isolation applies to all DEC-04 canonical accounting and related evidence:

- journals and journal lines;
- chart of accounts and control mappings;
- invoices, bills, credit notes, AR, and AP;
- VAT evidence and return preparation;
- financial years and accounting periods;
- payments and payment status;
- allocations and settlement derivation;
- customer credits and supplier prepayments;
- unapplied cash;
- refunds;
- bank evidence and reconciliation;
- approvals, corrections, and audit relationships; and
- reporting derived from canonical journals.

A transaction belonging to one company must never:

- post to another company's accounts;
- consume another company's sequence or configuration;
- allocate against another company's invoice or bill;
- alter another company's VAT or period state;
- appear in another company's report;
- satisfy another company's idempotency key; or
- cause another company's accounting workflow or notification.

Recovery from a tenant-isolation defect must preserve DEC-04 and use explicit
incident and correction procedures. It must not silently rewrite canonical
accounting.

## 8. Configuration isolation

DEC-06, DEC-09, DEC-10, and DEC-11 require isolation of:

- financial-year definitions and boundaries;
- accounting periods and close/reopen state;
- chart-of-accounts identity and lifecycle;
- protected AR, AP, bank/cash, Output VAT, and Input VAT mappings;
- effective-dated configuration versions;
- document numbering and company settings; and
- resolved configuration context used to explain historical postings.

Configuration must never leak across companies through defaults, caches,
templates, reporting, previews, background jobs, or administrative screens.
A configuration copied from one company to another must be an explicit
authorised operation producing new company-owned meaning, not shared mutable
authority.

## 9. Documents and object storage

Company isolation must cover:

- invoices, bills, receipts, and credit notes;
- uploaded documents and source evidence;
- document metadata, checksums, and relationships;
- document previews and downloads;
- document bundles and audit packages; and
- redaction, anonymisation, archival, retention, and disposal state.

A Company A document must not be retrievable through Company B by changing an
identifier, URL, filename, filter, bundle request, or report context.

Document access must validate both company ownership and the actor's
capability. A document storage key or signed download link must not be treated
as an independent authorisation boundary.

## 10. Banking, payments, and reconciliation

DEC-12 through DEC-15 require strict isolation for:

- bank accounts and bank evidence;
- imported transactions and statements;
- payment evidence and accounting payments;
- allocations and settlement;
- unapplied cash;
- customer credits;
- supplier prepayments;
- refunds; and
- reconciliation analyses, matches, approvals, and corrections.

Bank evidence must never become visible to the wrong company. A matching or
allocation operation must prove that all participants belong to the same
company and must not use a cross-company candidate merely because amounts,
dates, names, or references match.

Company isolation must apply equally to manual actions, AI recommendations,
batch approval, imports, asynchronous processing, and recovery.

## 11. Audit, retention, and disposal

Audit history must remain company-scoped and protected. A company must not
access another company's:

- audit events;
- approval or capability history;
- export history;
- privileged-access history;
- recovery events;
- retention or legal-hold state;
- deletion, anonymisation, redaction, archival, or disposal records; or
- security incident evidence except through an explicitly authorised
  cross-company operational process.

DEC-17 and DEC-18 remain authoritative for retention and disposal. Isolation
must not be used to prevent an authorised company lifecycle action, and
disposal must not create a path to expose another company's retained evidence.

Shared operational audit infrastructure may exist, but user-facing and
company-authorised access must enforce the relevant company scope. Privileged
operational access requires separate authority and audit.

## 12. Exports

Every DEC-19 export must be bounded to the requested company. Isolation must
cover:

- human-readable report exports;
- canonical accounting CSV and JSON;
- operational CSV;
- audit packages and manifests;
- document downloads and bundles; and
- configuration extracts.

Filters may narrow a company scope but may never widen it. Export generation,
background packaging, expiry, retry, notification, and download access must
carry the originating company context.

An export request must be rejected if company context is missing, ambiguous,
stale, or inconsistent with the authenticated membership and capability.
Cross-company export is not ordinary export functionality.

## 13. Backups and recovery

DEC-20 requires recovery mechanisms to preserve strict company isolation.
This applies to:

- backup storage and access;
- full and scoped restoration;
- recovery environments;
- point-in-time recovery;
- restore tests; and
- regional or whole-service recovery.

A system-level backup may contain multiple companies where the selected
resilience service requires it, but no user or operator receives unrestricted
access merely because the backup is system-level.

Scoped recovery must identify the company and validate company ownership,
documents, accounting, audit, retention/disposal state, and relationships
before promotion. Whole-service recovery must validate all company boundaries
before access is reopened. DEC-20 remains authoritative for recovery safety;
this review does not redesign backup architecture.

## 14. AI isolation

AI must remain company-scoped at every stage:

- prompt assembly;
- uploaded-document handling;
- accounting context selection;
- retrieval and search;
- memory and conversation context;
- recommendation generation;
- tool calls and proposed actions; and
- AI action, approval, and audit history.

Company A information must never be used to answer a Company B request unless
a future, explicitly approved legitimate cross-company context exists. A
shared model or service does not by itself create a permitted shared data
scope.

AI recommendations must be constrained by the same company and capability
rules as equivalent manual operations. AI cannot use broad retrieval or
background context to bypass DEC-05, DEC-19, or DEC-20 boundaries.

## 15. Background jobs and automation

Scheduled and asynchronous processes must preserve the originating company
scope, including:

- reconciliation and matching;
- import processing;
- export generation;
- notifications;
- AI analysis;
- retention, anonymisation, and disposal;
- report generation; and
- recovery operations.

A job without a valid company context must fail closed or be explicitly
classified as a tightly controlled system operation. It must not infer scope
from stale worker state, a previous job, a global cache, or an arbitrary
record identifier.

Retries, queues, dead-letter handling, logs, metrics, notifications, and
failure reports must not leak one company's data to another.

## 16. Support and administrative access

There must be no unrestricted superuser model that silently bypasses company
boundaries.

If cross-company operational access is ever necessary for support, incident
response, maintenance, recovery, security investigation, or audit:

- authority must be explicit and server-side;
- the reason and affected company scope must be recorded;
- access must be limited to the minimum necessary data and time;
- approval and separation of duties must apply where risk requires it;
- access must be read-only unless a narrowly authorised write is necessary;
- the action must be auditable; and
- the access must not become a user-facing capability in ordinary company
  workflows.

Support tooling, logs, traces, dashboards, backups, and debugging tools are
also data-access surfaces and must be governed accordingly.

## 17. Defence in depth

The policy requires defence in depth across relevant layers:

1. authenticated identity and company membership;
2. explicit active company context;
3. DEC-05 capability and resource authorisation;
4. company ownership and relationship validation;
5. service-layer enforcement for reads and writes;
6. database constraints and tested predicates where appropriate;
7. isolated jobs, caches, documents, exports, AI context, and recovery;
8. audit, monitoring, testing, and incident response.

Database-level RLS may provide valuable defence-in-depth, particularly for
high-risk accounting tables. It must be evaluated and tested against workers,
connection pooling, migrations, administrative access, recovery, and support
operations before being treated as a universal requirement.

The absence of universal RLS must never mean the absence of mandatory
server-side company scoping.

## 18. Failure modes and policy response

The policy must prevent and detect:

- incorrect or stale company context;
- missing or ambiguous company ownership;
- authorisation and membership bugs;
- cross-company joins or references;
- background-job context loss;
- export or document URL leakage;
- cache, search, log, notification, or analytics leakage;
- AI retrieval or memory leakage;
- support or administrative overreach;
- backup or recovery leakage; and
- data exposure caused by failed disposal or anonymisation handling.

A suspected isolation failure must be treated as a security and data-integrity
incident. Preserve evidence, constrain consequential actions, identify the
affected companies, revoke or narrow access as appropriate, notify the
responsible authority, and record remediation without silently altering
canonical accounting.

## 19. Isolation auditability

Immutable audit evidence should cover:

- company membership creation, removal, suspension, and capability changes;
- active-company or delegated-context changes where consequential;
- privileged support or cross-company administrative access;
- recovery access and restoration scope;
- export and sensitive-document access;
- security incidents and isolation failures;
- material AI access or action-context events;
- recovery-test and tenant-isolation validation results; and
- migration or cutover checks that protect company boundaries.

Audit records must themselves be protected, company-scoped for ordinary
access, and available to authorised incident responders without creating a
general cross-company read path.

## 20. Membership, portability, and lifecycle

Users may belong to multiple companies, but:

- active company switching must not carry stale authority or data context;
- removing or suspending membership must deny subsequent company access;
- company closure must not make data visible to another company;
- export rights after membership ends must follow recorded authority and
  retention rules;
- a user account's existence must not merge company data; and
- future group, consolidation, intercompany, or multi-company reporting
  features require explicit policy and authority.

This review does not decide unrelated user lifecycle, company closure,
retention, or migration policy beyond the isolation requirements above.

## 21. Migration boundary

DEC-22 owns migration and cutover policy. DEC-21 requires migration to:

- preserve company ownership;
- prevent accidental company merges;
- reject or quarantine ambiguous ownership;
- preserve source and legacy evidence by company;
- validate company-safe relationships and references;
- ensure migration jobs carry the correct originating company context; and
- never invent a cross-company relationship to make data fit.

No DEC-21 decision authorises a migration, cutover, schema change, or legacy
retirement strategy.

## 22. Options

### Option A — Application scoping only

This means mandatory authenticated server-side company scoping and capability
checks, without a policy requirement for database-level RLS.

- **Accounting integrity:** Can be strong if every route, mutation, join,
  worker, and service boundary is consistently enforced; a missed path is
  high risk.
- **Security:** Centralised policy is easier to understand, but the database
  is less independently defensive.
- **Leakage risk:** Higher blast radius for service-layer defects, cache bugs,
  admin mistakes, and new access paths.
- **Operational complexity:** Lower database and worker complexity; strong
  testing and review discipline is required.
- **Scalability:** Broad compatibility with current and future data access
  patterns.
- **Cost:** Lower direct infrastructure cost.
- **UX:** No inherent user-visible difference.
- **Migration:** Simpler than introducing universal RLS, but ownership and
  policy tests remain mandatory.
- **Backups/exports:** Requires explicit company validation in every recovery
  and generation path.
- **AI:** Requires strict context assembly and retrieval boundaries.
- **Future flexibility:** Easier to add stronger isolation later, but a
  missed control remains a serious risk.

### Option B — RLS for accounting tables

This adds database-level company policy for canonical accounting and selected
high-risk accounting tables while retaining service-layer enforcement
everywhere.

- **Accounting integrity:** Stronger defence for journals, accounts, periods,
  and related accounting data if policies are correct and tested.
- **Security:** Reduces the impact of some service-layer omissions.
- **Leakage risk:** Lower for protected tables, but unprotected documents,
  exports, jobs, AI, and operational tables remain dependent on other
  controls.
- **Operational complexity:** Higher; workers, pooling, migrations, support,
  recovery, and tests must carry correct company context.
- **Scalability:** Good if the protected boundary remains coherent.
- **Cost:** Moderate engineering and operational cost.
- **UX:** No inherent user-visible difference.
- **Migration:** Requires careful rollout and restore validation for
  accounting data.
- **Backups/exports:** Helps protect canonical accounting but does not solve
  object storage or export isolation alone.
- **AI:** Still requires service-level context and retrieval controls.
- **Future flexibility:** Leaves room for broader RLS after evidence and
  operational validation.

### Option C — RLS for all company-scoped tables

This requires database-level RLS across all company-owned records in addition
to mandatory service-layer controls.

- **Accounting integrity:** Strong defence-in-depth if uniformly implemented.
- **Security:** Smallest database-level trust assumption for ordinary access.
- **Leakage risk:** Lower for database reads and writes, but external systems,
  object storage, caches, logs, AI, exports, and support still need controls.
- **Operational complexity:** Highest; every worker, admin path, migration,
  recovery, connection pool, maintenance process, and test must handle RLS
  safely.
- **Scalability:** Potentially strong, but policy complexity can slow new
  features and operational response.
- **Cost:** Highest engineering, testing, support, and incident complexity.
- **UX:** No direct difference, but operational incidents may affect
  availability or support speed.
- **Migration:** Highest migration and rollback risk unless the full lifecycle
  is proven.
- **Backups/exports:** Database protection is stronger, but object storage,
  packages, and recovery environments still require explicit company
  validation.
- **AI:** Does not automatically isolate prompts, model context, or memory.
- **Future flexibility:** Strong database boundary, but may constrain future
  group, consolidation, and system-level operations.

## 23. APPROVED POLICY

Approve a **mandatory layered company-isolation policy**:

1. Require authenticated, server-side company scoping for every company-owned
   read, write, report, export, job, document, AI, and recovery operation.
2. Require DEC-05 membership and capability checks in addition to company
   context; authority in one company never implies authority in another.
3. Require explicit company ownership and company-safe relationships for
   authoritative data, with no ordinary cross-company references.
4. Apply the policy consistently to accounting, configuration, documents,
   banking, reconciliation, audit, retention/disposal, exports, backups,
   recovery, AI, background jobs, notifications, logs, and support tooling.
5. Use defence-in-depth database controls and evaluate tested RLS, especially
   for high-risk accounting tables, without assuming universal RLS until
   worker, pooling, migration, support, and recovery compatibility is proven.
6. Require isolated recovery validation and company-safe export/document
   generation.
7. Require explicit, time-limited, reasoned, audited break-glass access for
   exceptional cross-company operations; do not create an unrestricted
   superuser.
8. Treat isolation defects as security and accounting-integrity incidents.
9. Keep multi-company reporting, consolidation, intercompany accounting, and
   group structures outside launch scope unless separately decided.

This policy follows the registered DEC-21 direction: mandatory
authenticated server-side company scoping, with tested RLS evaluated as
defence-in-depth rather than assumed universally.

This policy is approved as a security/product architecture policy only.

## 24. Decision boundaries

### Already decided

DEC-01 through DEC-20, including server-side capabilities, immutable
canonical accounting, company-scoped exports, controlled disposal, and
company-isolated backup and recovery.

### Approved policy

The mandatory layered company-isolation policy in section 23, with
authenticated server-side company scoping as the non-negotiable baseline and
tested RLS evaluated as defence-in-depth.

### Requires user decision

The mandatory layered company-isolation policy in section 23.

### Deliberately left open

- exact database, schema, RLS, and service architecture;
- which tables receive RLS and when;
- connection pooling, worker, migration, recovery, and support mechanics;
- object-storage, cache, search, logging, and AI-provider controls;
- detailed membership and company-lifecycle policy;
- multi-company reporting, consolidation, group structures, and intercompany
  accounting;
- regional residency and stronger physical isolation;
- DEC-22 migration and cutover strategy;
- source freshness/posting safety; and
- implementation tasks, tests, dependencies, infrastructure configuration,
  deployment, and publishing.

### What approving DEC-21 would lock in

- company is the authoritative accounting and security boundary;
- company-owned authoritative data has explicit ownership;
- every access path requires authenticated server-side company context and
  DEC-05 authority;
- a user's authority in one company never implies authority in another;
- isolation covers records, documents, exports, backups, recovery, AI,
  background jobs, notifications, logs, and support access;
- cross-company administrative access is exceptional, explicit, scoped,
  time-limited, approved where appropriate, and audited;
- tenant-isolation failures are security and accounting-integrity incidents;
- RLS may be used as tested defence-in-depth, without universal RLS being
  assumed unless later evidence supports it; and
- DEC-22 migration must preserve company ownership and cannot invent
  cross-company relationships.

### What remains changeable

The exact database and service architecture, table-level RLS scope, provider
and storage design, worker and pooling approach, support tooling, object
storage, AI controls, regional isolation, future group features, and
implementation sequencing.

### What belongs to DEC-22

Migration and cutover authority, rollout sequencing, legacy-system retirement,
data transformation, migration checkpoints beyond the DEC-20 recovery
boundary, and rollback strategy. DEC-21 only sets the isolation requirements
that migration must satisfy.

## 25. Important principle

Company isolation is a fundamental trust boundary.

No feature, AI assistant, export, background process, support function, or
recovery mechanism may bypass it merely for convenience. Company A and
Company B must be treated as separate accounting and security domains.

## 26. Decision readiness

DEC-21 was explicitly approved on 2026-08-21. The approval is a
security/product architecture policy only. Until the applicable remaining
decision is approved or amended:

- DEC-22 is approved separately as the historical accounting-data compatibility
  and cutover policy;
- BL-06 and BL-07 remain **BLOCKED**;
- no tenant-isolation, database, schema, migration, accounting, UI, workflow,
  dependency, infrastructure, deployment, or publishing implementation may
  begin; and
- no implementation task is authorised.

**DEC-01 through DEC-21:** **APPROVED**
**DEC-22:** **APPROVED — migration/cutover policy only**
**BL-06 / BL-07:** **BLOCKED**
**Application code changed by this review:** **NO**
**Database or migrations changed by this review:** **NO**