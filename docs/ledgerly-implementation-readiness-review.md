# Ledgerly Implementation Readiness Review

**Review date:** 2026-08-21  
**Governance status:** DEC-01 through DEC-22 approved  
**Implementation status:** Not authorised  
**BL-06 / BL-07 status:** BLOCKED  
**Source freshness / posting safety:** Separately unresolved  
**Decision created by this review:** None

> This is an implementation-readiness assessment only. It does not implement
> anything, create an implementation task, unblock BL-06 or BL-07, create
> DEC-23, or authorise code, schema, migration, accounting logic, UI,
> workflows, dependencies, infrastructure, deployment, or publishing.

## 1. Executive assessment

### READY FOR IMPLEMENTATION PLANNING

Ledgerly is ready to move from governance into a separately approved
implementation-planning process because:

- DEC-01 through DEC-22 are recorded as approved policy or architecture
  decisions;
- the approved authority hierarchy and implementation boundary are clear;
- BL-06 and BL-07 have defined scope, dependencies, risks, and acceptance
  expectations;
- the major implementation surface and dependency order can be identified
  without designing the final schema;
- the migration/cutover policy is approved and provides evidence, provenance,
  validation, reconciliation, exception, recovery, and authority-transition
  rules; and
- the remaining source-freshness issue is explicit rather than silently
  filled in.

### NOT READY FOR IMPLEMENTATION

Actual implementation must not begin. The following are still required before
any implementation task can be executed:

- a scoped implementation brief and explicitly approved implementation task;
- a source-freshness/posting-safety contract or an explicit DEC-12 amendment
  if the required policy exceeds the approved boundary;
- architecture and data-contract validation against DEC-01 through DEC-22;
- accounting, security, tenant-isolation, migration, recovery, and testing
  plans;
- agreed task-level in/out scope, actors, capabilities, invariants,
  observability, rollback, and Definition-of-Done evidence; and
- separate approval for schema changes, migration execution, deployment, or
  publishing where applicable.

Governance approval is not implementation approval.

## 2. Authority and consistency baseline

The governing hierarchy remains:

1. Ledgerly Manifesto;
2. Product Principles;
3. PRD / Product Scope;
4. Technical Architecture;
5. Feature Specifications / Master Backlog.

DEC-01 through DEC-22 are the current approved governance authority within that
hierarchy. Their detailed review documents are normative for their respective
policies; summaries in the registers, architecture, PRD, and backlog are
cross-reference and planning records and must not silently broaden or narrow a
decision.

The following boundary is approved and must remain explicit:

- **Policy-approved:** A decision constrains future work.
- **Implementation-authorised:** A separately approved task permits a defined
  implementation scope.
- **Implemented:** Code, schema, migration, or operational change has been
  built, tested, and accepted.

DEC-22 approval locks in the evidence-led additive-adapter migration model,
controlled cohorts, bounded dual-read comparison, explicit exceptions,
validated cutover, canonical journals as the sole authority after cutover,
and controlled recovery/correction boundaries. It does not lock in a physical
schema, API design, adapter technology, cohort list, provider, or execution
date.

### Governance consistency findings

No contradiction in the accounting policies themselves was identified in this
review. The approved decisions are mutually usable when their authority
boundaries are preserved:

- DEC-03 remains the sole VAT authority.
- DEC-04 remains the canonical accounting architecture.
- DEC-05 remains the capability and approval boundary.
- DEC-06 through DEC-08 govern financial years, periods, and reporting-only
  year-end.
- DEC-09 through DEC-11 govern accounts, control mappings, and configuration
  versions.
- DEC-12 through DEC-16 preserve payment, allocation, settlement, credits,
  prepayments, unapplied cash, refunds, and on-account distinctions.
- DEC-17 and DEC-18 govern retention, disposal, legal holds, and evidence
  lifecycle.
- DEC-19 governs bounded exports.
- DEC-20 governs recovery safeguards.
- DEC-21 governs company isolation.
- DEC-22 governs historical compatibility and cutover.

The principal consistency risk is documentation freshness and repeated
summaries, not a policy conflict. A stale summary that says a later decision
is unresolved must be corrected or explicitly marked historical; it must not
be treated as a new governance decision. The appropriate amendment path for a
genuine policy conflict is an amendment to the owning decision and the
affected register/summary documents. It is not a code change or an informal
backlog edit.

## 3. Source freshness and posting safety

### What the dependency means

Source freshness is the assurance that a consequential operation is acting on
the current, identified version of the source evidence and the current
applicable accounting context. It is more specific than a record's
`updated_at` value and is not solved merely by reloading a page.

The implementation must be able to establish, as applicable:

- source identity and company;
- source revision, version, hash, or equivalent snapshot identity;
- source and provider/import timestamps;
- the evidence and configuration version used for analysis;
- the posting date, financial year, and accounting period resolved for the
  operation;
- the current source state at approval/posting time; and
- whether the operation is still valid after concurrent changes.

### Operations that depend on it

Source freshness affects:

- invoice and bill approval and posting;
- VAT calculation, locking, and return preparation;
- payment creation and allocation;
- customer-credit and supplier-prepayment decisions;
- refunds and allocation reversals;
- bank import, categorisation, transfer pairing, and reconciliation;
- single and bulk reconciliation approvals;
- queued or background accounting actions;
- migration extraction, comparison, and cutover;
- reports and exports when they expose a source-derived status; and
- any AI or automation action that proposes a consequential accounting
  change.

### Existing constraints

The requirement is constrained by:

- DEC-03 deterministic VAT authority;
- DEC-04 balanced, immutable, source-linked, idempotent canonical journals;
- DEC-05 server-side capabilities and human approval;
- DEC-06 through DEC-08 date, year, period, and year-end controls;
- DEC-09 and DEC-10 stable accounts and protected control mappings;
- DEC-11 effective-dated configuration and historical posting context;
- DEC-12 through DEC-16 non-duplicating payment and settlement concepts;
- DEC-17 and DEC-18 audit and lifecycle requirements;
- DEC-19 bounded export authority;
- DEC-20 recovery and restore safeguards;
- DEC-21 tenant isolation; and
- DEC-22 evidence-preserving migration and controlled cutover.

### Classification

Source freshness is both:

- an **implementation requirement**, because every posting path needs a
  concrete source-version, revalidation, locking, conflict, retry, and audit
  contract; and
- a **remaining governance gap**, because the current record deliberately
  keeps source freshness separately unresolved rather than choosing the exact
  freshness semantics.

This does not create DEC-23. During implementation planning, the owner must
decide whether the existing DEC-12 boundary is sufficient for the chosen
source types. If it is not sufficient, the approved amendment process must
amend the owning policy before affected implementation is authorised.

### Minimum readiness conditions

Before consequential posting is implemented, the design must define and test:

- the source revision/snapshot contract;
- stale thresholds, if time-based thresholds are appropriate;
- approval-time revalidation;
- conflict and changed-source handling;
- queued-job expiry and retry behavior;
- atomic interaction with period, configuration, and capability checks;
- behavior for sources that have no native revision;
- idempotency boundaries and duplicate prevention;
- audit fields and user-visible explanations; and
- reconciliation behavior when the source changes after a decision.

## 4. BL-06 and BL-07 readiness

### BL-06 — Canonical posting engine

BL-06 is a P0, large accounting-core item. It covers source-linked,
server-generated, balanced, immutable journal entries and controlled
reversals/corrections. Every posted operational source must produce balanced
debits and credits with audit linkage and idempotency protection.

It depends on:

- BL-01 and BL-02 active membership and capability enforcement;
- BL-03 typed, allowlisted domain write contracts;
- BL-04 authoritative invoice/bill calculations;
- BL-05 source/VAT validation;
- DEC-04 through DEC-22 policy and architecture constraints; and
- an explicitly approved implementation task.

BL-06 remains blocked because a policy approval does not supply the task-level
implementation design, source-freshness contract, schema/API decisions,
testing evidence, or operational sign-off required to build a posting engine.

### BL-07 — Chart, defaults, periods, and accounting configuration

BL-07 is a P0, large accounting-core item. It covers controlled account types
and defaults, fiscal years, accounting periods, close/reopen policy, document
numbering, and posting controls. Closed periods must reject ordinary posting;
account and tax defaults must be validated; reports must use period boundaries.

It depends on:

- BL-01 and BL-02 membership and capability enforcement;
- BL-03 typed write contracts;
- DEC-04 through DEC-11 accounting architecture, years, periods, chart,
  control-account, and configuration policies; and
- an explicitly approved implementation task.

BL-07 remains blocked because the approved policies still need a validated
technical design, source-freshness interaction, concurrency behavior,
migration/backfill treatment, and test evidence.

### Evidence required to unblock either item

Before BL-06 or BL-07 can be unblocked, the implementation plan must provide:

- exact in-scope and out-of-scope source types and workflows;
- an implementation brief mapped to every applicable DEC;
- source-freshness/posting-safety treatment;
- conceptual and physical data-contract review;
- capabilities, actors, approval boundaries, and separation of duties;
- transaction, idempotency, concurrency, and correction behavior;
- tenant-isolation and background-job behavior;
- migration/backfill and recovery strategy, if affected;
- accounting invariant and reconciliation test plan;
- observability, audit, failure, retry, and rollback plan;
- API/UI contract and business-language error behavior, if affected;
- accounting, security, architecture, and product review;
- acceptance evidence and Definition-of-Done checks; and
- explicit user approval of the implementation task.

Neither BL-06 nor BL-07 is unblocked by this document.

## 5. Implementation surface

The approved governance implies the following implementation areas. This is an
impact assessment, not a final design.

### Accounting core and journals

- canonical journal and journal-line facts;
- server-side transactional double-entry posting;
- integer minor units and explicit currency;
- source identity, version/snapshot, and company-scoped idempotency;
- immutable posted history;
- linked reversals and corrections;
- journal-derived balances and reporting projections; and
- auditable posting outcomes.

### Chart, configuration, years, and periods

- stable account identity and classification;
- protected AR, AP, bank/cash, Output VAT, and Input VAT mappings;
- effective-dated immutable configuration versions;
- financial-year boundaries;
- contiguous accounting periods;
- server-side posting-date and period resolution;
- controlled close and reopen;
- document numbering; and
- reporting-only year-end completion.

### Source and settlement workflows

- invoices, bills, credit notes, and source evidence;
- payments and bank evidence;
- many-to-many allocations;
- derived settlement;
- customer credits;
- supplier prepayments;
- unapplied cash;
- refunds and reversal relationships;
- bank categorisation and transfer pairing;
- reconciliation and match rationale; and
- freshness-aware approval paths.

### Audit, lifecycle, and exports

- immutable audit records;
- actor, capability, company, reason, and source context;
- retention class and legal-hold state;
- controlled disposal events where supported;
- bounded, company-scoped exports;
- export version and provenance; and
- report/source drill-down.

### Recovery, tenancy, and operations

- managed encrypted backup and recovery controls;
- isolated restore validation;
- recovery points and rollback checkpoints;
- active membership and capability enforcement;
- company context on every request and background job;
- application tenant scoping;
- RLS feasibility and test boundary;
- retry, dead-letter, and idempotency controls;
- monitoring and operational audit; and
- migration and cutover observability.

### Migration and AI

- source inventory and supported-shape contracts;
- versioned additive adapters;
- mapping and control-account contracts;
- provenance and source snapshots;
- migration exceptions;
- dry-run and dual-read comparison;
- cohort validation and reconciliation;
- cutover approval and legacy read-only transition;
- AI suggestions with visible uncertainty; and
- human approval and audit for consequential actions.

## 6. Implementation dependency graph

The following is a logical implementation order, not a replacement for the DEC
numbering or a task plan.

### Foundation

1. Confirm implementation scope, task governance, source-freshness semantics,
   and the required design records.
2. Establish active membership, server-side capabilities, company context,
   audit contract, and protected command boundaries through BL-01/02/03.
3. Establish server-side monetary, invoice/bill, and VAT-source validation
   through BL-04/05.

### Accounting primitives

4. Build and validate BL-07 configuration primitives: chart identity,
   protected mappings, configuration versions, financial years, periods,
   posting-date resolution, close/reopen, and numbering.
5. Build and validate the BL-06 posting kernel: balanced journals, source
   linkage, idempotency, immutable history, corrections, audit, and reporting
   authority.

### Dependent accounting workflows

6. Integrate invoices, bills, and credit notes with canonical posting and VAT.
7. Integrate payments, allocations, customer credits, supplier prepayments,
   unapplied cash, refunds, and statements.
8. Integrate bank evidence, categorisation, transfer pairing, and
   reconciliation with atomic accounting effects and freshness checks.
9. Build journal-authoritative projections, reports, drill-down, and exports.

### Migration and operational promotion

10. Build source adapters, mapping contracts, provenance, exception handling,
    dry-run comparison, and cohort validation.
11. Validate recovery checkpoints, cutover controls, legacy read-only status,
    post-cutover reconciliation, and correction handling.
12. Complete production controls, observability, recovery testing, regression
    evidence, and the release/publishing review.

### Parallelisable work

After the shared authority and security contracts are defined, the following
can proceed in parallel with explicit interfaces:

- audit and observability;
- export/report presentation;
- recovery and restore runbooks;
- tenant-isolation/RLS feasibility testing;
- document/evidence integrity tooling;
- test harnesses and fixtures; and
- adapter prototypes that do not write accounting data.

No parallel stream may bypass the canonical posting, capability, company,
freshness, audit, or recovery boundaries.

### Work blocked by source freshness

Consequential approval, posting, allocation, refund, reconciliation, queued
accounting actions, and migration cutover are blocked until their freshness
contract is defined and tested.

### Work blocked by migration policy

Migration execution, production backfill, cohort cutover, legacy authority
transition, and post-cutover comparison require the DEC-22 implementation plan
and explicit task approval. Adapter prototypes and non-writing mapping
analysis may be planned separately if they preserve evidence and cannot alter
accounting.

## 7. Conceptual data and schema impact

Without selecting physical tables, columns, ORM models, or APIs, the
implementation will likely require concepts for:

- companies and ownership;
- active memberships and capabilities;
- stable accounts and account classifications;
- control-account roles;
- configuration versions and effective dates;
- financial years and accounting periods;
- journal headers and immutable journal lines;
- source identity, source revision/snapshot, and posting context;
- idempotency keys and duplicate boundaries;
- payments, allocations, settlement, bank evidence, and reconciliation;
- customer credits and supplier prepayments;
- refunds and correction/reversal links;
- VAT evidence and deterministic calculation context;
- documents and evidence integrity;
- audit actor, capability, reason, company, and result;
- retention classes, legal holds, and disposal state;
- migration source mappings and migration exceptions;
- export version/provenance;
- recovery checkpoints and restore validation; and
- background-job company context, retry, and outcome.

These concepts must remain company-scoped and source-linked. The final schema
must be selected through an approved architecture and implementation process.
This review does not authorise schema work.

## 8. Accounting safety review

| Failure mode | Required control |
|---|---|
| Unbalanced or malformed journals | Server-side transaction, validated lines, cross-line balance invariant, and no browser-created journal authority |
| Duplicate retries or double posting | Company/source/version idempotency, unique boundaries, retry-safe commands, and one canonical payment posting |
| Stale approval or source change | Source revision/snapshot, approval-time revalidation, atomic lock/recheck, explicit stale/conflict outcome, and audit |
| Wrong year or period | Server-side date resolution, financial-year evidence, OPEN-period check, controlled close/reopen, and no silent re-dating |
| Retroactive configuration remap | Effective-dated immutable configuration and posting context retained on the journal |
| Altered posted history | Append-only canonical journals and linked reversal/correction paths under DEC-04 |
| Wrong account or control mapping | Stable account identity, protected control roles, mapping validation, and exception handling |
| Incorrect VAT | DEC-03 deterministic VAT authority, source-linked evidence, versioned context, and no second migration VAT engine |
| Incorrect AR/AP or settlement | Separate payment, allocation, settlement, credit, prepayment, refund, and bank-evidence concepts |
| Unauthorised allocation or refund | Capability-controlled human approval, balance limits, idempotency, and explicit rationale |
| Duplicate reconciliation accounting | Bank evidence remains distinct; match existing payment or atomically create one payment/posting/link |
| Cross-company accounting | Server-side company scoping, active membership, capability checks, ownership validation, and isolation tests |
| AI or automation bypass | Advisory AI only, deterministic rules first, same approval boundary as manual work, and auditable actions |
| Recovery replay | Tested isolated restore, preserved ordering/idempotency, recovery point records, and no duplicate replay |
| Migration invention | Evidence-first mapping, visible ambiguity, formal exceptions, source provenance, and no fabricated facts |

## 9. Security and tenant readiness

The implementation plan must map the approved controls to every entry point:

- active membership must be checked for every company-owned read, write,
  approval, export, and management action;
- capabilities must be enforced server-side; UI visibility is not authority;
- READ-ONLY access must not mutate;
- ADMIN/MANAGER capability must not silently imply posting, reopening, or
  other reserved powers;
- every background job must carry explicit company context, least privilege,
  idempotency, retry/dead-letter behavior, and audit;
- support, migration, recovery, and administrative paths must use the same
  company-isolation boundary;
- cross-company IDs, documents, users, AI context, and accounting must be
  rejected;
- application scoping is mandatory;
- RLS remains a defence-in-depth implementation choice requiring feasibility
  testing across pooling, migrations, workers, support, exports, and recovery;
- exports must be finite, capability-controlled, company-scoped, and audited;
- migration transfers require encrypted transport, scoped temporary access,
  source-data protection, and separation of duties; and
- restore and migration operations must not bypass tenant isolation.

## 10. Migration readiness

Before DEC-22 migration execution can begin, the implementation plan must
provide:

1. a source inventory and supported legacy-shape list;
2. per-cohort scope and company ownership;
3. versioned adapter and mapping contracts;
4. account, control-account, VAT, period, year, and configuration mapping;
5. source identifiers, snapshots, provenance, and extraction context;
6. treatment for sources without native revisions, including baseline hashes
   or an explicit exception;
7. the MUST / SHOULD / MAY / DO NOT MIGRATE / MIGRATION EXCEPTION
   classification;
8. a formal company-scoped exception workflow;
9. dry-run transformation and bounded dual-read comparison;
10. reconciliation reports covering counts, journals, trial balance, Balance
    Sheet, P&L, AR, AP, bank/cash, VAT, controls, payments, allocations,
    credits, prepayments, refunds, periods, documents, audit, and lifecycle
    state;
11. no unexplained material accounting differences at cutover;
12. verified pre-migration and pre-cutover recovery checkpoints;
13. source freeze, final extraction, final validation, final reconciliation,
    exception review, and explicit cutover approval;
14. canonical Ledgerly authority after cutover and legacy read-only/comparison
    status;
15. post-cutover monitoring, exception ownership, audit review, and accounting
    sign-off; and
16. controlled correction/reversal treatment for discrepancies discovered after
    Ledgerly becomes authoritative.

No migration may execute merely because DEC-22 is approved.

## 11. Testing requirements

Implementation planning must cover, at minimum:

- **Unit/property tests:** money arithmetic, currency/sign rules, VAT
  calculations, balance invariants, period resolution, effective-date
  non-overlap, mapping rules, and allocation limits.
- **Transaction/concurrency tests:** idempotent retries, unique boundaries,
  row locks, stale-source rejection, duplicate approvals, close/reopen races,
  and correction uniqueness.
- **Accounting lifecycle tests:** invoice, bill, credit note, payment,
  allocation, settlement, bank evidence, categorisation, transfer, refund,
  reversal, and correction behavior.
- **Authorization tests:** capability matrix, active membership, READ-ONLY,
  privileged operations, approval separation, and rejected role/capability
  combinations.
- **Tenant-isolation tests:** cross-company identifiers, documents, users,
  jobs, support paths, exports, recovery, AI context, and RLS where adopted.
- **VAT and period tests:** source-linked VAT evidence, current configuration,
  financial-year boundaries, open/closed periods, controlled reopen, and
  reporting-only year-end.
- **Migration tests:** adapter determinism, provenance, mapping, unsupported
  shapes, exceptions, dry-run, dual-read comparison, reconciliation,
  materiality, cohort pause, cutover, rollback boundary, and post-cutover
  correction.
- **Recovery tests:** backup integrity, isolated restore, RPO/RTO evidence,
  ordering, idempotency, and no replayed posting.
- **Audit and retention tests:** actor/company/capability/reason capture,
  immutable history, export audit, retention class, legal hold, disposal
  behavior, and lifecycle uncertainty.
- **Reporting/export tests:** journal-to-projection rebuild, report/source
  drill-down, period presentation, export bounds, versioning, and parity.
- **AI-boundary tests:** evidence links, uncertainty, deterministic-first
  behavior, prohibited invention, capability inheritance, approval, and audit.
- **E2E/regression tests:** complete user workflows, loading/error/empty
  states, accessible responsive UI, API behavior, and regression coverage
  across the existing product.

Testing must be evidence attached to an approved task, not an assumption
derived from policy approval.

## 12. Recommended implementation phases

Every phase below requires a separately approved implementation task before
execution.

### Phase 0 — Planning and contracts

- **Purpose:** Convert approved governance into an executable, reviewable
  implementation plan.
- **Scope:** Source freshness, task boundaries, design records, invariants,
  actors, capabilities, data contracts, observability, recovery, and tests.
- **Dependencies:** DEC-01 through DEC-22; source-freshness determination.
- **Key risks:** Hidden implementation assumptions, unresolved source changes,
  over-broad scope, and accidental policy amendment.
- **Validation:** Architecture, accounting, security, product, and migration
  review of the implementation brief.
- **Approval:** Explicit user approval required.

### Phase 1 — Access and safe write foundations

- **Purpose:** Establish active membership, capabilities, company context,
  typed commands, authoritative monetary calculations, and source/VAT
  revalidation.
- **Scope:** BL-01 through BL-05 as separately scoped.
- **Dependencies:** Phase 0 and DEC-03/04/05/11/12.
- **Key risks:** Client authority, stale approval, privilege escalation, and
  cross-company identifiers.
- **Validation:** Authorization, tenant, transaction, freshness, and audit
  tests.
- **Approval:** Explicit task approval required.

### Phase 2 — BL-07 configuration and temporal foundation

- **Purpose:** Implement account, control, configuration, year, period, close,
  reopen, and numbering primitives.
- **Scope:** BL-07 only unless a task explicitly includes a dependency.
- **Dependencies:** Phases 0–1 and DEC-06 through DEC-11.
- **Key risks:** Wrong period, retroactive remapping, closed-period bypass, and
  configuration overlap.
- **Validation:** Effective-date, period, mapping, close/reopen, and migration
  backfill tests.
- **Approval:** Explicit task approval required.

### Phase 3 — BL-06 canonical posting kernel

- **Purpose:** Make canonical balanced journals and controlled corrections
  authoritative.
- **Scope:** BL-06 posting primitives, source links, idempotency, audit, and
  correction boundaries.
- **Dependencies:** Phases 0–2 and all applicable DEC policies.
- **Key risks:** Unbalanced journals, duplicate posting, altered history, and
  incomplete source context.
- **Validation:** Accounting invariants, concurrency, recovery, audit, and
  journal-authoritative reporting tests.
- **Approval:** Explicit task approval required.

### Phase 4 — Core accounting workflows

- **Purpose:** Connect sales, purchasing, payments, settlement, bank evidence,
  reconciliation, VAT, and reporting to canonical accounting.
- **Scope:** Explicitly selected BL-08 through BL-17 slices.
- **Dependencies:** BL-06/07, source freshness, capabilities, and approved
  workflow contracts.
- **Key risks:** Duplicate cash, incorrect allocations, VAT divergence,
  reconciliation side effects, and report mismatch.
- **Validation:** End-to-end accounting, reconciliation, VAT, export, and
  regression tests.
- **Approval:** Separate task approval for each bounded slice.

### Phase 5 — Migration pilot and controlled cutover

- **Purpose:** Validate DEC-22 on a bounded company/source cohort.
- **Scope:** Non-destructive adapters, dry-run, evidence mapping, exceptions,
  reconciliation, checkpoint, cutover, legacy read-only transition, and
  post-cutover review.
- **Dependencies:** Validated BL-06/07, source freshness, recovery testing,
  tenant isolation, and migration-specific approval.
- **Key risks:** Invented history, incomplete provenance, cross-company leakage,
  authority ambiguity, and irreversible cutover.
- **Validation:** Full DEC-22 reconciliation and accounting sign-off.
- **Approval:** Explicit migration execution and cutover approvals required.

### Phase 6 — Production controls and release

- **Purpose:** Prove operational readiness before deployment or publishing.
- **Scope:** Monitoring, limits, backups, restore, incident handling, audit
  review, regression suite, and release controls.
- **Dependencies:** Prior phases and BL-23/BL-24 evidence.
- **Key risks:** Unobserved failure, unsafe restore, incomplete audit, and
  production configuration drift.
- **Validation:** Production-readiness review with no critical/high unresolved
  findings and verified recovery evidence.
- **Approval:** Separate deployment/publishing approval required.

## 13. Implementation-task governance

No task may be executed merely because a DEC is approved.

An implementation brief must identify:

- exact in-scope and out-of-scope behavior;
- affected companies, source types, actors, capabilities, and roles;
- applicable decisions and explicit non-goals;
- conceptual data contracts and any proposed schema changes;
- API, UI, worker, export, and integration contracts;
- accounting invariants and source-freshness behavior;
- idempotency, concurrency, failure, retry, and correction handling;
- migration, backfill, recovery, and rollback impact;
- tenant isolation, RLS, support, and background-job impact;
- audit, retention, disposal, and export impact;
- observability, metrics, logs, alerts, and user-visible states;
- test plan and acceptance evidence;
- Definition-of-Done checks;
- accounting, architecture, security, product, and migration reviewers; and
- the explicit approval required before execution.

Separate approval is required for:

- physical schema or migration changes;
- production-data transformation;
- migration cohort cutover;
- RLS adoption;
- backup/recovery implementation changes;
- deployment or publishing;
- a change to accounting authority; and
- any policy amendment.

This review does not create or execute an implementation task. Existing
unrelated backlog work, including bulk approval work, does not authorise
BL-06, BL-07, or migration implementation.

## 14. Deliberately changeable implementation choices

The following remain changeable provided they conform to the approved policy:

- physical table, column, index, and constraint names;
- ORM, query, and transaction implementation;
- service/module boundaries;
- API transport, DTO names, and internal event format;
- projection and materialization strategy;
- journal numbering mechanism;
- queue, scheduler, and worker technology;
- RLS breadth after feasibility testing;
- backup vendor and point-in-time recovery implementation;
- export serialization details within approved bounds;
- adapter internals and mapping tooling;
- exact cohort order and pilot size;
- UI layout and interaction details;
- observability platform; and
- future market, currency, and integration extensions.

These choices must not weaken immutable accounting, company scope, source
provenance, idempotency, period controls, auditability, recovery, or migration
evidence.

## 15. Final readiness decision

**READY FOR IMPLEMENTATION PLANNING**

This means a separately approved planning effort may define the implementation
brief, resolve the source-freshness contract or amendment path, validate the
architecture, and prepare scoped tasks.

It does **not** mean:

- READY FOR IMPLEMENTATION;
- BL-06 or BL-07 are unblocked;
- migration or cutover may execute;
- schema or code work may begin;
- deployment or publishing may begin; or
- a future decision may be assumed.

### Outstanding conditions before actual implementation

1. Resolve source-freshness/posting-safety semantics within the approved
   amendment boundary.
2. Produce and review the implementation brief.
3. Validate the design against DEC-01 through DEC-22.
4. Approve bounded implementation tasks.
5. Complete accounting, security, tenant-isolation, migration, recovery, and
   test planning.
6. Retain explicit approval for schema, migration execution, deployment, and
   publishing as separate gates.

## 16. Final verification

- **DEC-01 through DEC-22:** APPROVED.
- **DEC-23:** Not created.
- **BL-06 and BL-07:** Remain BLOCKED.
- **Source freshness:** Explicitly addressed here as a separate unresolved
  posting-safety dependency and implementation gate.
- **Implementation task:** None created or executed.
- **Application/schema/accounting/UI/workflow/dependency/infrastructure files:**
  Not changed.
- **Migration:** Not executed.
- **Deployment:** Not performed.
- **Publishing:** Not performed.

This review is documentation only and stops at implementation readiness
planning.