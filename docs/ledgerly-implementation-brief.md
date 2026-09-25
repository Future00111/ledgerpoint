# Ledgerly Implementation Brief

**Status:** PLANNING ONLY — NOT APPROVED FOR EXECUTION  
**Governance baseline:** DEC-01 through DEC-22 APPROVED  
**Implementation readiness:** READY TO BEGIN IMPLEMENTATION PLANNING  
**Implementation authority:** None  
**BL-06 / BL-07:** BLOCKED  
**Source freshness / posting safety:** Separately unresolved; proposed contract
below requires explicit review before consequential posting is implemented  
**DEC-23:** Not created and not required by this brief  
**Prepared:** 2026-08-21

**Detailed source-freshness contract:** [Ledgerly Source-Freshness and
Posting-Safety Contract](ledgerly-source-freshness-posting-safety-contract.md)
**Safety-rule ownership record:** [Ledgerly Safety-Rule Ownership
Record](ledgerly-safety-rule-ownership-record.md)
**Migration pilot plan:** [Historical Accounting Migration Pilot
Plan](ledgerly-historical-accounting-migration-pilot-plan.md)
**First implementation approval package:** [Ledgerly First Implementation
Approval Package](ledgerly-first-implementation-approval-package.md)

> This document translates approved governance into a concrete plan for
> separately approved implementation work. It does not implement code, schema,
> migrations, accounting logic, UI, workflows, dependencies, infrastructure,
> deployment, publishing, migration, or cutover. No task in this document is
> approved for execution.

## 1. How to read this brief

Every material statement is classified as one of:

- **APPROVED POLICY** — an approved DEC constraint that implementation must
  respect;
- **IMPLEMENTATION REQUIREMENT** — behavior required to conform to approved
  policy;
- **PROPOSED IMPLEMENTATION** — a candidate technical approach for review;
- **IMPLEMENTATION DETAIL** — a lower-level choice that remains changeable;
- **REQUIRES EXPLICIT APPROVAL** — work or a decision that cannot proceed from
  governance approval alone; or
- **DELIBERATELY LEFT OPEN** — intentionally not locked by this brief.

An approved policy is not an approved implementation. A proposed implementation
is not an approved policy amendment.

## 2. Governance baseline

### Approved policy authorities

| Area | Approved decisions | Implementation consequence |
|---|---|---|
| Authority and scope | DEC-01, DEC-02 | Follow the governance hierarchy and the UK/GBP initial accounting scope; do not broaden launch scope silently. |
| VAT | DEC-03 | Use one deterministic VAT authority; preserve evidence and do not create a migration VAT engine. |
| Accounting architecture | DEC-04 | Use canonical normalized append-only journals, transactional double-entry, source links, idempotency, immutable corrections, and journal-authoritative reporting. |
| Capabilities | DEC-05 | Enforce active membership, company scope, server-side capabilities, approval boundaries, and audit. |
| Years, periods, year-end | DEC-06, DEC-07, DEC-08 | Resolve years and periods from evidence and controlled configuration; no silent closed-period posting or automatic closing journals. |
| Accounts and configuration | DEC-09, DEC-10, DEC-11 | Preserve stable account identity, protected control roles, effective-dated immutable configuration, and posting context. |
| Money movement | DEC-12 through DEC-16 | Keep bank evidence, payments, allocations, settlement, credits, prepayments, unapplied cash, refunds, and on-account scope distinct and non-duplicating. |
| Lifecycle and exports | DEC-17, DEC-18, DEC-19 | Preserve audit/evidence retention, controlled disposal, legal holds, and bounded company-scoped exports. |
| Recovery | DEC-20 | Use managed encrypted backup/recovery targets, checkpoints, tested restore, and defined recovery objectives. |
| Tenant isolation | DEC-21 | Preserve company boundaries across users, records, documents, jobs, exports, recovery, support, and AI context. |
| Migration and cutover | DEC-22 | Use validated additive adapters, controlled cohorts, bounded comparison, visible exceptions, recovery checkpoints, and canonical journals as the sole authority after validated cutover. |

### Already decided

- The Manifesto → Product Principles → PRD/Product Scope → Technical
  Architecture → Feature Specifications/Master Backlog hierarchy remains in
  force.
- Governance approval does not authorise implementation.
- BL-06 and BL-07 remain blocked until separately approved implementation
  planning and tasks are complete.
- DEC-03 is the sole VAT authority.
- Canonical posted journals are the accounting and reporting authority after
  validated migration cutover.
- Legacy systems may remain read-only evidence or bounded comparison sources,
  but not competing post-cutover accounting authorities.
- No DEC-23 is created by this brief.

### Implementation requirement

All implementation briefs and tasks must map their scope to the applicable
DEC-01 through DEC-22 constraints, state explicit exclusions, and identify
accounting, data, security, tenant, recovery, export, audit, and migration
consequences.

### Deliberately left open

This brief does not choose:

- a final physical schema;
- exact API paths, DTO names, or event formats;
- a provider, queue, scheduler, backup vendor, or deployment architecture;
- universal RLS;
- exact source systems, migration cohort membership, or cutover date;
- exact RPO/RTO values;
- final UI layouts;
- a new product scope;
- a new governance decision number; or
- whether source freshness requires an amendment to DEC-12.

## 3. Governance consistency and amendment boundary

### Finding

No accounting-policy contradiction was identified across DEC-01 through
DEC-22. The main consistency risk is duplicated summaries becoming stale,
especially where older documents describe DEC-22 as unresolved. The normative
DEC review and current registers control; summaries must be kept as pointers
and must not silently reinterpret policy.

### Implementation requirement

Use the terms **policy-approved**, **implementation-authorised**, and
**implemented** distinctly in task briefs, code review, audit records, and
release reviews.

### Requires explicit approval

If implementation discovers a genuine policy conflict, stop the affected work,
document the decisions and behavior in conflict, identify the accounting/data/
security/migration impact, and use the amendment path of the owning decision.
Do not resolve a policy conflict by editing code, choosing a lower-level
summary, or creating DEC-23.

## 4. Source freshness and posting safety

Source freshness is the principal unresolved dependency. It concerns whether a
consequential action is still acting on the current identified source and
accounting context, not merely whether a browser page was recently loaded.

### Approved policy

DEC-03, DEC-04, DEC-05, DEC-06 through DEC-12, DEC-21, and DEC-22 already
require deterministic authority, source linkage, capability checks, period and
configuration controls, idempotency, audit, tenant isolation, and evidence-led
migration.

### Proposed implementation contract

The following is a **PROPOSED IMPLEMENTATION** contract for review. It is not
yet an approved source-freshness policy.

#### Source envelope

Every consequential command should carry or resolve a source envelope with:

- company ID and authenticated actor/job identity;
- source type and stable source ID;
- source revision, provider version, ETag, event ID, or deterministic content
  hash;
- source-captured-at and imported-at timestamps where available;
- evidence references and document integrity identifiers;
- the analysis/recommendation snapshot used by the command;
- the configuration-version ID and account/control mapping version used;
- posting date, financial year, accounting period, and period status;
- capability and active-membership evaluation context; and
- an idempotency key for the intended accounting effect.

#### Read and approval

At analysis time, persist the source envelope with the draft, recommendation,
or approval request. At final persistence time, the server must:

1. authenticate the actor or job;
2. validate active membership and company scope;
3. re-read or atomically lock the authoritative source;
4. compare the current source revision/hash/state to the captured envelope;
5. resolve the current posting date, financial year, period, configuration
   version, account mapping, and control mapping;
6. revalidate the capability and approval boundary;
7. revalidate the accounting command and VAT evidence;
8. apply the idempotency boundary;
9. post or reject within one transaction; and
10. record the source, checks, decision, result, and reason in audit evidence.

#### Stale-read detection

Treat a command as stale when any of the following changes after analysis:

- source revision, hash, event identity, or relevant status;
- source deletion, voiding, correction, or ownership;
- company ownership or tenant scope;
- financial-year or period status;
- effective configuration or control-account mapping;
- VAT evidence or applicable source version;
- payment balance, allocation, credit, prepayment, or refund availability;
- actor membership or capability; or
- an earlier idempotent command has already produced the intended effect.

Time age may be an additional signal but must not be the only freshness
authority where a revision or snapshot is available.

#### Sources without native revisions

For a source with no native revision, the proposed fallback is a normalized
evidence hash plus captured source timestamp and extraction context. If a
stable hash cannot be established, consequential automatic posting must be
rejected or routed for explicit human review with a visible migration or
posting exception. A fallback hash must not be presented as proof that the
source was unchanged outside the captured evidence.

#### Conflict handling

When current source data differs from the command:

- do not merge the values silently;
- reject or pause the command with a business-language stale/conflict result;
- preserve the old and current source envelopes;
- require a fresh analysis or authorised correction;
- preserve the reason and actor/job in audit; and
- make the exception visible to the appropriate company user.

#### Queued actions and retries

Queued actions must carry company scope, source envelope, command type,
idempotency key, capability context, and expiry metadata. A queue item should
expire when its source revision changes, its approval window expires, its
period closes, its capability is revoked, or its defined maximum age is
reached.

Retries must revalidate current state rather than replaying the original
decision blindly. A stale retry must produce a new reviewable state, not a
second journal. Dead-lettered consequential actions must remain auditable and
must not be silently discarded.

#### Atomicity

Capability, membership, company, source freshness, period, configuration,
mapping, VAT, idempotency, journal balance, and audit checks should be
completed in the same transactional authority boundary as the accounting
write wherever the underlying storage permits. If a check cannot be
transactionally coupled, the design must document the race and compensating
control before approval.

### Requires explicit approval

Before BL-06, BL-07, payment, reconciliation, bulk approval, refund, VAT
locking, or migration posting work is authorised, accounting, security,
architecture, and product reviewers must approve the final source-freshness
contract. Because DEC-12 explicitly does not assign source freshness, the
owner must separately decide its governance placement and any amendment path.
No DEC-23 is needed.

## 5. BL-06 and BL-07

### BL-06 — Canonical posting engine

**Approved policy:** Build source-linked, balanced, immutable canonical journals
and controlled reversals/corrections under DEC-04 and applicable DEC-05 through
DEC-22 controls.

**Proposed implementation boundary:**

- posting command and transaction boundary;
- journal and line validation;
- money/currency and debit-credit invariants;
- source/version/company idempotency;
- current source and configuration validation;
- immutable posted history;
- linked reversal/replacement corrections;
- audit and actor/capability context; and
- journal-authoritative balances and projections.

**Out of scope for a BL-06-only task:**

- arbitrary generic CRUD for journal lines;
- final UI design;
- migration execution;
- provider selection;
- permanent dual authorities;
- unapproved multi-currency or market expansion; and
- policy changes.

**Current block:** BL-06 remains `Missing / blocked`. Governance approval does
not provide a physical design, source-freshness contract, implementation brief
approval, test evidence, or execution authority.

### BL-07 — Chart, defaults, periods, and accounting configuration

**Approved policy:** Implement stable account identity, protected control
accounts, configuration versions, financial years, contiguous periods, close/
reopen controls, numbering, and posting-date restrictions under DEC-06 through
DEC-11.

**Proposed implementation boundary:**

- account types, classification, stable identity, and lifecycle;
- company chart and default account selection;
- AR, AP, bank/cash, Output VAT, and Input VAT roles;
- effective-dated immutable configuration versions;
- financial-year boundaries;
- contiguous accounting periods with OPEN/CLOSED state;
- server-side posting-date and period resolution;
- controlled close/reopen workflow and audit;
- document numbering; and
- configuration/source context attached to posting.

**Out of scope for a BL-07-only task:**

- changing approved chart or control-account policy;
- silent historical remapping;
- migration execution;
- final UI design;
- universal RLS; and
- implementation of unrelated product modules.

**Current block:** BL-07 remains `Partial/missing / blocked`. It requires
validated technical design, source-freshness interaction, concurrency behavior,
migration treatment, test evidence, and an approved implementation task.

### Dependencies

Both items depend on:

- active membership and server-side capabilities;
- typed protected write contracts;
- server-side money and source/VAT validation;
- the approved DEC-04 through DEC-22 policies;
- the source-freshness contract or approved amendment path;
- accounting/security/architecture review; and
- an explicitly approved, bounded implementation task.

### Required approvals before unblocking

Neither backlog item is unblocked by this brief. Unblocking requires:

1. an approved implementation brief for the scoped task;
2. source-freshness treatment;
3. architecture and data-contract review;
4. accounting invariant and reconciliation plan;
5. security and tenant-isolation review;
6. recovery, rollback, and observability plan;
7. tests and acceptance evidence;
8. explicit user approval of the implementation task; and
9. confirmation that no migration, deployment, or publishing approval is being
   implied.

## 6. Accounting core requirements

### Canonical journals

**APPROVED POLICY:** Canonical journals are normalized, source-linked,
server-generated, integer-minor-unit, balanced, append-only, immutable after
posting, and corrected only through controlled reversals or replacement
entries.

**IMPLEMENTATION REQUIREMENT:**

- no browser or generic CRUD path may author posted journal lines;
- every posting transaction must validate company, source, date, period,
  configuration, account, control, VAT, balance, and idempotency;
- debit and credit totals must balance in the transaction's currency;
- source/version context must be retained;
- a retry must not create a second accounting effect;
- posted history must not be edited or deleted;
- corrections must link to the original and preserve meaning; and
- reports must derive from canonical posted journals or rebuildable projections.

### Minimum primitives

Before dependent accounting features, the design must provide:

1. company-scoped command and capability boundary;
2. stable account and protected control-account identity;
3. immutable effective-dated configuration;
4. financial-year and accounting-period resolution;
5. journal and line balance validation;
6. source/version and idempotency context;
7. posting transaction and audit;
8. reversal/correction relationship;
9. deterministic VAT integration;
10. reporting projection/rebuild boundary; and
11. source-freshness revalidation.

### Corrections and reversals

**APPROVED POLICY:** Corrections must not rewrite posted history.

**IMPLEMENTATION REQUIREMENT:** A correction command must identify the
original, reason, actor/capability, source evidence, affected period and
configuration context, and produce a linked canonical outcome. Post-cutover
migration discrepancies use this path unless a valid controlled recovery
criterion applies.

### Chart and control mappings

**APPROVED POLICY:** Account identity is stable and meaning-based. Protected
AR, AP, bank/cash, Output VAT, and Input VAT roles cannot be silently
reassigned.

**PROPOSED IMPLEMENTATION:** Resolve a versioned company chart and protected
control mapping at posting time, store the resolved IDs and version context on
the journal, and require privileged audited change for future effective dates.

### Financial years, periods, and year-end

**IMPLEMENTATION REQUIREMENT:**

- resolve the financial year and period from company policy and posting date;
- reject ordinary posting to CLOSED periods;
- require a controlled, audited reopen path;
- preserve historical assignment;
- do not invent a period closure or reopen event during migration; and
- treat year-end completion as a reporting-only derived condition under DEC-08,
  not an automatic closing or retained-earnings journal.

## 7. Payments, AR, and AP

### Common requirements

**APPROVED POLICY:** Bank evidence, accounting payment, allocation, settlement,
customer credit, supplier prepayment, refund, and reconciliation are distinct.

**IMPLEMENTATION REQUIREMENT:**

- one economic payment must not produce duplicate cash postings;
- allocation cannot be inferred solely from amount/date coincidence;
- settlement is derived from canonical payment and allocation state;
- a payment may exist before allocation when approved by DEC-13/16;
- every consequential classification is source-freshness checked;
- allocations, reversals, refunds, and corrections are auditable and
  idempotent; and
- bank evidence alone is not accounting authority.

### Canonical journal effects

The following are the planning baseline and remain subject to accounting review
inside each implementation task:

- **Customer payment allocated to an invoice:** debit bank/cash and credit the
  appropriate customer receivable/AR control; allocation links the payment to
  the invoice without posting cash a second time.
- **Supplier payment allocated to a bill:** credit bank/cash and debit the
  appropriate supplier payable/AP control; allocation links the payment to the
  bill without posting cash a second time.
- **Customer excess:** preserve the excess as an approved customer-credit
  liability or unapplied cash state; do not fabricate an invoice allocation.
- **Supplier excess:** preserve the excess as an approved supplier-prepayment
  asset or unapplied cash state; do not fabricate a bill allocation.
- **Customer refund:** debit the approved customer-credit/refundable balance
  and credit bank/cash, with the original payment/credit and approval links.
- **Supplier refund receipt:** debit bank/cash and credit the approved
  supplier-prepayment/refundable balance, with evidence and links.
- **Bank evidence:** records the external cash evidence and reconciliation
  relationship; it must not create a second payment where one exists.
- **Allocation:** changes the relationship between an existing payment,
  credit/prepayment, and open item under its approved domain path; it must not
  duplicate the underlying cash posting.

If a source cannot support the required distinction, retain the evidence and
record a migration or accounting exception rather than inventing a journal.

### Unapplied cash, credits, and prepayments

**IMPLEMENTATION REQUIREMENT:** Provide explicit remainder, eligibility,
approval, allocation, reversal, and audit states. User language must not imply
that an invoice or bill is settled when cash remains unapplied or on account.

### Reconciliation

**PROPOSED IMPLEMENTATION:** A reconciliation command should either link a
freshly validated match to existing accounting or atomically create the one
required payment/posting/link. It should never produce duplicate accounting
because a bank row is matched twice or a retry is replayed.

## 8. VAT

**APPROVED POLICY:** DEC-03 is the sole VAT authority for the approved launch
scope: Standard VAT on invoice basis with supported preparation/export and no
direct HMRC submission.

### Implementation requirements

- invoices, bills, credit notes, and corrections must provide traceable VAT
  evidence;
- the VAT service must use the applicable source and configuration context;
- VAT calculation and consequential approval must revalidate freshness;
- VAT posting must flow through the canonical journal authority;
- VAT periods must align with approved accounting and VAT evidence;
- VAT returns and exports must reconcile to canonical evidence;
- corrections must be controlled and auditable; and
- migration must preserve historical VAT meaning without creating a second VAT
  engine.

### Requires explicit approval

Any new VAT scheme, specialist treatment, direct HMRC filing, or materially
different VAT authority requires product/accounting governance review. It is
not inferred from this brief.

## 9. Configuration and posting resolution

### Required resolution sequence

The proposed canonical posting resolution is:

1. authenticate actor/job and establish company scope;
2. validate active membership and capability;
3. identify the source and current revision/snapshot;
4. determine the authoritative posting date;
5. resolve the company's financial year and accounting period;
6. select the immutable configuration version effective for that date;
7. resolve stable account and protected control mappings;
8. validate VAT and source-specific rules;
9. validate the open-period and approval state;
10. apply idempotency and journal invariants; and
11. persist the journal, links, source context, and audit atomically.

### Approved policy

Historical configuration must not be invented or retroactively replaced by
current configuration. A posting retains the configuration and mapping context
used to create it. Unknown historical configuration becomes an explicit
exception.

### Deliberately left open

The physical representation of configuration versions, account mappings,
period records, and numbering remains an implementation design choice subject
to architecture review.

## 10. Security and tenant isolation

### Implementation requirements

- authentication must precede company-owned access;
- active company membership must be checked server-side;
- capabilities must be checked server-side for every consequential action;
- company ID must be derived from authorised context and cross-checked against
  every resource;
- resource ownership must be validated for invoices, bills, payments, bank
  evidence, documents, exports, audit, migration, and recovery;
- READ-ONLY paths must have no mutation capability;
- privileged posting, reopen, correction, refund, migration, export, recovery,
  and disposal actions must be explicit, capability-controlled, and audited;
- background jobs must carry non-ambient company context;
- support and recovery access must be scoped and auditable;
- AI retrieval and action context must never cross companies;
- notifications must not leak company data or reveal unauthorised state; and
- tenant checks must not be bypassed by imports, batch operations, workers,
  exports, migrations, or administrative tooling.

### RLS candidates

Candidate data classes for RLS feasibility testing include:

- companies and memberships;
- accounts, configuration, financial years, and periods;
- journals, journal lines, payments, allocations, and refunds;
- invoices, bills, parties, bank evidence, and reconciliation;
- documents and document links;
- audit, migration exceptions, retention/disposal, and recovery records; and
- export jobs and generated export metadata.

### RLS compatibility questions

Before adopting universal RLS, the design must answer:

- how connection pooling establishes and clears company context;
- how migrations and backfills set context safely;
- how background workers and retries preserve context;
- how support/admin access is explicitly elevated and audited;
- how exports and document downloads enforce context;
- how isolated recovery restores and validates context;
- how cross-company global reference data is handled; and
- how RLS interacts with the current application/service boundaries.

**DELIBERATELY LEFT OPEN:** Universal RLS is not selected by this brief.
Application-level server-side scoping is mandatory regardless of the RLS
outcome.

## 11. Conceptual data-model impact

This is a conceptual assessment, not a final schema.

| Concept | Classification | Required relationship or behavior |
|---|---|---|
| Company | REQUIRED CONCEPT | Owns all accounting, evidence, configuration, membership, audit, and migration scope. |
| Membership | REQUIRED CONCEPT | Links an authenticated user to a company and active status. |
| Capability | REQUIRED CONCEPT | Represents server-enforced action authority and approval boundary. |
| Account | REQUIRED CONCEPT | Stable company-scoped identity and classification; historical use remains traceable. |
| Control mapping | REQUIRED CONCEPT | Protects AR, AP, bank/cash, Output VAT, and Input VAT roles by company and version. |
| Configuration version | REQUIRED CONCEPT | Immutable, effective-dated company context used by posting. |
| Financial year | REQUIRED CONCEPT | Company-scoped boundary assigned from evidence and posting date. |
| Accounting period | REQUIRED CONCEPT | Contiguous company-scoped period with controlled state. |
| Journal | REQUIRED CONCEPT | Immutable posted accounting header with source, company, period, configuration, and idempotency context. |
| Journal line | REQUIRED CONCEPT | Balanced debit/credit line with stable account and monetary context. |
| Source envelope | PROPOSED STRUCTURE | Source type/ID, revision or snapshot, evidence references, captured context, and freshness state. |
| Invoice / bill | REQUIRED CONCEPT | Source-linked business records whose authoritative totals, VAT, status, and journal links are server-controlled. |
| Payment | REQUIRED CONCEPT | Accounting cash movement distinct from bank evidence and allocation. |
| Allocation | REQUIRED CONCEPT | Many-to-many or otherwise approved relationship between payments/credits/prepayments and open items; no duplicate cash. |
| Settlement | REQUIRED CONCEPT | Derived state from canonical payment and allocation facts. |
| Customer credit | REQUIRED CONCEPT | Distinct liability/excess state with source and refund links. |
| Supplier prepayment | REQUIRED CONCEPT | Distinct asset/excess state with source and refund links. |
| Refund | REQUIRED CONCEPT | Controlled movement with original source, approval, balance, and reversal links. |
| Bank evidence | REQUIRED CONCEPT | External evidence and reconciliation source; not by itself accounting authority. |
| Reconciliation | REQUIRED CONCEPT | Match/review state with evidence, freshness, rationale, and atomic accounting effects. |
| VAT evidence | REQUIRED CONCEPT | Traceable source/configuration context for deterministic VAT calculation and reporting. |
| Audit record | REQUIRED CONCEPT | Immutable actor/company/capability/source/reason/result evidence. |
| Retention/disposal state | REQUIRED CONCEPT | Lifecycle class, legal hold, archival, redaction, anonymisation, and supported disposal state. |
| Migration exception | REQUIRED CONCEPT | Company-scoped uncertainty, conflict, proposed treatment, authority, resolution, and residual risk. |
| Export | REQUIRED CONCEPT | Bounded company-scoped generated representation with permission, version, provenance, and audit. |
| Recovery checkpoint | REQUIRED CONCEPT | Scope, source/target state, recovery point, validation, and rollback boundary. |
| Job execution | PROPOSED STRUCTURE | Company context, capability, source envelope, idempotency, retries, expiry, and audit outcome. |

**IMPLEMENTATION DETAIL:** Names, table layout, indexes, foreign keys, event
formats, ORM models, and storage technology remain open and require separate
architecture approval.

## 12. API and service boundaries

### Proposed shape

Prefer a clear server-side modular/domain-service boundary in the existing
application before considering separate microservices. The following are
logical authorities, not mandatory deployment units:

- **Posting authority:** validates source freshness, period, configuration,
  mapping, VAT, invariants, idempotency, and journal writes.
- **Allocation/settlement authority:** manages payment relationships, balance
  limits, credits, prepayments, settlement derivation, and reversals.
- **Refund authority:** validates refundable balance, approval, amount,
  evidence, cash effect, and reversal links.
- **Configuration authority:** manages accounts, controls, versions, years,
  periods, close/reopen, and numbering.
- **Reporting authority:** reads canonical journals and rebuildable projections;
  it does not create accounting facts.
- **Export authority:** applies DEC-19 bounds, permissions, company scope,
  versioning, audit, and retention state.
- **Document/evidence authority:** stores or links source evidence and
  integrity/provenance metadata without recreating nonexistent documents.
- **Audit authority:** records immutable consequential events and context.
- **Migration authority:** runs non-destructive adapters, mappings, dry runs,
  exceptions, reconciliation, checkpoints, and cutover controls.
- **Recovery authority:** coordinates checkpoint metadata, restore validation,
  and recovery audit without inventing accounting.
- **AI action guard:** retrieves company-scoped evidence, matches capability,
  requires approval, revalidates freshness, and records AI action history.

### Implementation requirements

- protected accounting actions use typed allowlisted commands;
- generic mass assignment cannot write protected accounting fields;
- read models/projections cannot become write authority;
- API responses expose business-language stale, conflict, permission, and
  validation outcomes;
- service boundaries preserve one canonical transaction authority; and
- separate deployment is not required unless scale, isolation, or operations
  justify it through architecture review.

## 13. Background jobs

| Job area | Authority and company-context requirement |
|---|---|
| Reconciliation | Carry company, bank-evidence IDs, source envelopes, matching scope, capability context, idempotency, retry/dead-letter state, and audit. Revalidate before accounting effects. |
| Exports | Carry company, actor capability, export bounds, requested representation, retention state, and audit. Never use another company's worker context. |
| AI processing | Retrieve only company-scoped evidence; record model/action context; mark recommendations stale when source changes; never post without the normal approval/revalidation path. |
| Retention review | Evaluate class and legal hold in company scope; eligibility is not automatic disposal; record decision and audit. |
| Disposal | Require privileged capability, legal-hold check, class-specific authority, evidence, and immutable event; never dispose protected accounting evidence silently. |
| Notifications | Carry company and recipient scope; do not reveal unauthorised financial state; record delivery outcome and external-send authority. |
| Migration | Carry cohort, company, source adapter version, checkpoint, provenance, exception state, idempotency, and cutover authority; never write across company boundaries. |
| Backup/recovery support | Carry recovery scope, checkpoint, actor, reason, validation outcome, and restore audit; preserve ordering and idempotency. |

**PROPOSED IMPLEMENTATION:** Jobs should use explicit envelopes and a durable
state machine rather than ambient request context. Retry behavior must
revalidate, not replay stale accounting decisions.

## 14. Audit requirements

### Approved policy

DEC-17 and DEC-18 require retention and disposal behavior that preserves
authoritative accounting meaning, audit evidence, legal holds, and traceability.
Other approved decisions require consequential authority and evidence to remain
auditable.

### Implementation requirements

Capture immutable audit evidence for:

- journal posting, reversal, correction, and failed posting;
- source freshness checks, stale/conflict outcomes, and final revalidation;
- VAT calculation, approval, lock, correction, and return preparation;
- allocation, settlement, customer-credit, supplier-prepayment, refund, and
  bank-reconciliation changes;
- account, control mapping, configuration, financial-year, period, close, and
  reopen changes;
- membership, capability, privileged-access, and support actions;
- export generation, download, scope, representation, and failure;
- document upload, replacement, linkage, redaction, archival, and disposal;
- migration extraction, mapping, exception, approval, reconciliation, cohort,
  checkpoint, cutover, rollback, and post-cutover correction;
- backup, restore, recovery validation, and recovery failure;
- tenant-isolation violations, blocked cross-company access, and security
  events; and
- AI retrieval, recommendation, approval, revalidation, action, rejection,
  stale-context outcome, and retained prompt/output evidence as allowed by
  retention and privacy policy.

Every consequential record should include company, actor/job, capability,
target, source/version, reason, timestamp, result, correlation/idempotency
identifier, and relevant before/after or rejected state.

## 15. Exports

### Approved policy

DEC-19 supports bounded, company-scoped generated representations, including:

- human-readable PDF reports;
- CSV reports and operational exports;
- versioned machine-readable JSON accounting/audit exports;
- bounded audit packages;
- bounded document bundles; and
- bounded configuration exports.

Exports are representations, never accounting authority.

### Implementation requirements

- enforce company scope and capability server-side;
- generate finite, versioned outputs;
- preserve source/provenance and report period context;
- distinguish accounting, audit, document, configuration, and operational
  representations;
- include retention/disposal/legal-hold behavior where relevant;
- audit request, authorization, generation, download, failure, and expiry;
- prevent export jobs from leaking data through shared worker context; and
- do not default to an unbounded full-company archive.

**DELIBERATELY LEFT OPEN:** Exact file formats, libraries, storage, streaming,
pagination, and export job mechanics.

## 16. Backup and recovery

### Approved policy

DEC-20 requires managed encrypted backups, point-in-time recovery where
available, documented retention, tiered recovery targets, isolated validated
restore, and tested procedures. It does not choose a provider or authorize
infrastructure changes.

### Implementation requirements

- protect canonical journals, source evidence, configuration, periods,
  payments, audit, documents, migration exceptions, and required lifecycle
  state;
- create verified pre-migration and pre-cutover checkpoints;
- record recovery point, scope, source/target state, actor, reason, and
  validation;
- validate isolated restore before relying on a checkpoint;
- preserve journal immutability, order, idempotency, period state, company
  boundaries, and audit on restore;
- prevent a restore from replaying postings twice;
- provide rollback criteria before a migration/cutover operation begins;
- exercise restore at least quarterly and conduct an annual exercise where
  supported by the selected operations plan; and
- define product-risk-based RPO/RTO values during implementation planning.

**DELIBERATELY LEFT OPEN:** Backup vendor, infrastructure topology, exact
retention tiers, RPO/RTO values, and restore tooling.

## 17. Migration and cutover

### Approved policy

DEC-22 approves validated additive adapters, controlled cohorts, bounded
dual-read comparison, visible ambiguity, evidence preservation, formal
exceptions, recovery checkpoints, controlled cutover, and canonical Ledgerly
posted journals as the sole accounting/reporting authority after validated
cutover.

### Proposed migration flow

1. inventory source systems, shapes, companies, evidence, and retention state;
2. define supported sources, mappings, cohort scope, and evidence criteria;
3. preserve source evidence, provenance, source identifiers, and extraction
   context;
4. transform through a versioned additive adapter without destructive
   overwrite;
5. classify each data class as MUST MIGRATE, SHOULD MIGRATE, MAY MIGRATE, DO
   NOT MIGRATE, or MIGRATION EXCEPTION;
6. run a non-writing dry run and mapping review;
7. validate chart, controls, years, periods, configuration, VAT, AR/AP,
   payments, allocations, credits, prepayments, refunds, bank evidence,
   documents, audit, and lifecycle state;
8. reconcile counts, journals, trial balance, Balance Sheet, P&L, AR, AP,
   bank/cash, VAT, controls, periods, documents, and exception materiality;
9. create and validate a DEC-20 recovery checkpoint;
10. freeze or control source activity and perform final extraction;
11. complete final validation, reconciliation, exception review, and authorised
    sign-off;
12. activate Ledgerly for the bounded cohort;
13. make canonical posted journals the sole reporting authority;
14. transition the legacy system to read-only evidence or bounded comparison;
15. monitor and resolve exceptions during a defined post-cutover period; and
16. use canonical corrections/reversals for post-cutover discrepancies unless
    explicit rollback criteria genuinely apply.

### Provenance and exceptions

**IMPLEMENTATION REQUIREMENT:** Every transformed record must remain traceable
to its source and adapter/mapping version. Missing evidence, unsupported
features, conflicting source values, unknown configuration, ambiguous
allocation, and unresolved material differences become company-scoped,
auditable migration exceptions.

### Legacy authority

**APPROVED POLICY:** The legacy system must not remain a silent competing
accounting authority after cutover. It may remain read-only evidence or a
bounded comparison source until retention and audit requirements allow an
approved disposition. Do not destroy it prematurely.

### Rollback boundary

**IMPLEMENTATION REQUIREMENT:**

- before cutover, failed transformation or validation may be abandoned or
  restored to the staged checkpoint;
- during cutover, pause the cohort and preserve source/target evidence;
- after Ledgerly is authoritative, do not use casual rollback to erase
  canonical accounting; use DEC-04 correction/reversal unless controlled
  cutover criteria are satisfied; and
- every recovery or rollback must record scope, checkpoint, authority,
  validation, discrepancy, and reconciliation.

### Requires explicit approval

Migration execution, production backfill, cohort cutover, legacy transition,
and post-cutover authority changes each require an explicitly approved
migration task and cutover decision. This brief does not execute any of them.

## 18. AI

### Approved policy

AI is advisory. It may classify, suggest mappings, detect anomalies,
interpret documents, explain exceptions, and prepare drafts. It must not
invent accounting facts, silently determine authority, bypass deterministic
rules, or approve consequential migration/accounting actions.

### Implementation requirements

- retrieve only company-scoped evidence;
- include source revision/snapshot and retrieval time in context;
- mark recommendations stale when relevant source or configuration changes;
- match the proposed action to the actor's server-side capability;
- require the normal human approval and posting path;
- revalidate current source, period, configuration, mapping, VAT, balance, and
  tenant state immediately before persistence;
- retain action history, evidence links, uncertainty, approval, result, and
  failure;
- apply DEC-17/18 retention and disposal rules to prompts, outputs, and
  document context; and
- prevent model output from becoming a journal, allocation, VAT decision, or
  migration authority by itself.

**DELIBERATELY LEFT OPEN:** Model/provider, retrieval technology, prompt
templates, model routing, and exact prompt/output retention mechanics.

## 19. Testing strategy

Testing is a required deliverable of each approved implementation task.

### Required layers

- unit/property tests for money, currency, VAT, balances, periods,
  effective-date rules, mappings, and allocation limits;
- accounting invariant tests for balanced journals, immutable history,
  corrections, source linkage, idempotency, and one-time cash effects;
- integration tests for posting, configuration, periods, VAT, payments,
  allocations, refunds, reconciliation, exports, audit, and recovery;
- API tests for allowlists, validation, business-language errors, and
  authorization;
- permission tests for every capability, active membership, READ-ONLY,
  privileged operation, approval, and revocation path;
- tenant-isolation and RLS feasibility tests across reads, writes, workers,
  exports, support, recovery, and migrations;
- concurrency tests for stale source, duplicate approval, locks, close/reopen,
  retries, and correction races;
- idempotency tests for commands, payments, bank matches, jobs, and recovery;
- source-freshness tests for revision changes, no-revision sources, queue
  expiry, retry, conflicts, and atomic revalidation;
- AI boundary tests for scoped retrieval, stale context, capability matching,
  human approval, prohibited invention, and audit;
- export tests for scope, permission, bounds, versioning, provenance,
  retention, and parity;
- migration tests for adapter determinism, mapping, provenance, exceptions,
  dry run, reconciliation, checkpoint, cohort pause, cutover, and rollback;
- recovery tests for encrypted backup integrity, isolated restore, RPO/RTO
  evidence, ordering, idempotency, and no replay;
- audit tests for actor/company/capability/reason/source/result and lifecycle;
  and
- regression/E2E/accessibility tests for complete workflows, loading/error/
  empty states, responsive layouts, and existing product behavior.

### Critical acceptance tests

1. A duplicate retry creates no second journal or cash effect.
2. A changed source revision rejects a stale approval and requires fresh
   analysis.
3. A revoked membership or capability prevents posting even if a prior
   recommendation exists.
4. A closed period rejects ordinary posting and cannot be bypassed by a
   worker or import.
5. A posted journal cannot be edited or deleted; a correction is linked and
   auditable.
6. AR/AP, VAT, bank, payment, allocation, credit, prepayment, refund, and
   report totals reconcile to canonical journals.
7. A cross-company source, document, user, job, export, or AI context is
   rejected.
8. A migration dry run preserves provenance, flags ambiguity, and cannot write
   accounting.
9. A cutover checkpoint restores without duplicate posting and preserves
   company scope and audit.
10. An AI or user action cannot persist a consequential effect without final
    server-side revalidation and required approval.

## 20. Implementation phases

All phases are **PLANNING ONLY — NOT APPROVED FOR EXECUTION** until their
separate tasks and gates are approved.

### Phase 0 — Implementation foundation and source freshness

- **Objective:** Convert governance into reviewed, testable contracts.
- **Scope:** Source-freshness contract, task boundaries, invariants, actors,
  capabilities, data contracts, audit, recovery, observability, and test
  strategy.
- **Dependencies:** DEC-01 through DEC-22; current readiness review.
- **Deliverables:** Approved implementation brief for the selected scope,
  freshness decision or amendment path, architecture/accounting/security review
  record, and task acceptance criteria.
- **Acceptance criteria:** No material source-freshness ambiguity remains for
  the selected operation; all boundaries and non-goals are explicit.
- **Risks:** Hidden policy changes, over-broad scope, stale action semantics.
- **Required reviewers:** Product, accounting, architecture, security,
  migration, and operations.
- **Approval gate:** Explicit planning-task approval; no implementation.

### Phase 1 — Company, security, and safe write foundations

- **Objective:** Establish active membership, capabilities, company context,
  typed commands, and server-side monetary/VAT validation.
- **Scope:** BL-01 through BL-05 as separately bounded.
- **Dependencies:** Phase 0.
- **Deliverables:** Reviewed access/write contracts, source validation boundary,
  audit context, and security test evidence.
- **Acceptance criteria:** Unauthorised, inactive, cross-company, stale, and
  malformed commands are rejected consistently.
- **Risks:** Privilege escalation, client authority, missing audit.
- **Required reviewers:** Security, architecture, accounting, product.
- **Approval gate:** Each execution task explicitly approved.

### Phase 2 — Configuration, chart, years, and periods

- **Objective:** Establish BL-07 primitives before dependent posting.
- **Scope:** Accounts, control mappings, configuration versions, financial
  years, periods, close/reopen, and numbering.
- **Dependencies:** Phases 0–1 and DEC-06 through DEC-11.
- **Deliverables:** Technical design, migration/backfill treatment, period and
  mapping tests, and audit behavior.
- **Acceptance criteria:** Correct date/version/period resolution; closed
  periods reject ordinary posting; changes are prospective and auditable.
- **Risks:** Historical remapping, period bypass, overlapping versions.
- **Required reviewers:** Accounting, architecture, security, migration.
- **Approval gate:** BL-07 task and any schema task separately approved.

### Phase 3 — Canonical posting kernel

- **Objective:** Establish BL-06 canonical journal authority.
- **Scope:** Journal/line invariants, source links, idempotency, posting
  transaction, corrections, reversals, audit, and projections boundary.
- **Dependencies:** Phases 0–2 and all applicable approved policies.
- **Deliverables:** Reviewed posting design, invariant tests, concurrency
  evidence, recovery impact, and reporting-authority contract.
- **Acceptance criteria:** Every permitted posting is balanced, source-linked,
  idempotent, immutable after posting, and auditable.
- **Risks:** Duplicate or unbalanced accounting, wrong context, replay.
- **Required reviewers:** Accounting, architecture, security, operations.
- **Approval gate:** BL-06 task and any schema task separately approved.

### Phase 4 — AR/AP, payments, allocation, VAT, and reconciliation

- **Objective:** Connect core workflows without duplicate accounting.
- **Scope:** Explicitly selected invoice, bill, credit note, payment,
  allocation, settlement, credit, prepayment, refund, bank evidence,
  reconciliation, and VAT slices.
- **Dependencies:** Phases 1–3 and source freshness.
- **Deliverables:** Canonical journal effects, workflow contracts, freshness
  tests, reconciliation evidence, and user-facing review states.
- **Acceptance criteria:** Subledgers and VAT reconcile to canonical journals;
  bank evidence and payments remain distinct; duplicate effects are impossible.
- **Risks:** Incorrect AR/AP, VAT, allocations, refunds, and bulk approvals.
- **Required reviewers:** Accounting, product, security, architecture.
- **Approval gate:** Each workflow slice requires an explicit task approval.

### Phase 5 — Reporting, audit, exports, and documents

- **Objective:** Expose trusted journal-authoritative information and evidence.
- **Scope:** Reports/projections, drill-down, PDF/CSV/JSON, audit packages,
  documents, retention/disposal links.
- **Dependencies:** Phases 2–4 and DEC-17 through DEC-19.
- **Deliverables:** Report/export contracts, parity tests, audit/lifecycle
  evidence, and bounded access controls.
- **Acceptance criteria:** Reports and exports derive from canonical facts,
  retain scope/provenance, and cannot become accounting authority.
- **Risks:** Report divergence, export leakage, broken retention/legal hold.
- **Required reviewers:** Accounting, security, privacy, architecture, product.
- **Approval gate:** Task and export/retention review as applicable.

### Phase 6 — Recovery and operational resilience

- **Objective:** Prove safe checkpoint, restore, observability, and recovery.
- **Scope:** Backup tiers, checkpoint metadata, isolated restore, monitoring,
  RPO/RTO evidence, quarterly testing, annual exercise where supported.
- **Dependencies:** Canonical accounting and company/security boundaries.
- **Deliverables:** Recovery design/runbook, restore evidence, audit behavior,
  incident/recovery criteria.
- **Acceptance criteria:** Restore preserves accounting meaning, scope,
  idempotency, period state, and audit without replay.
- **Risks:** Recovery loss, replay, inaccessible evidence, unobserved failure.
- **Required reviewers:** Operations, architecture, accounting, security.
- **Approval gate:** Recovery implementation and production approval separate.

### Phase 7 — Migration preparation

- **Objective:** Prepare a non-destructive, evidence-led migration pilot.
- **Scope:** Source inventory, adapters, mappings, provenance, exceptions,
  dry-run, dual-read comparison, reconciliation, cohort plan, and checkpoint.
- **Dependencies:** Phases 0–6, DEC-22, source freshness, tenant isolation.
- **Deliverables:** Supported-source contract, mapping inventory, dry-run
  output, exception register, reconciliation report, cutover runbook.
- **Acceptance criteria:** No production accounting writes; all ambiguity is
  visible; source and target can be reconciled with provenance.
- **Risks:** Invented history, missing evidence, wrong company, mapping loss.
- **Required reviewers:** Migration, accounting, architecture, security,
  privacy, operations.
- **Approval gate:** Migration-preparation task approved separately.

### Phase 8 — Controlled migration and cutover

- **Objective:** Migrate and cut over an approved bounded cohort safely.
- **Scope:** Final freeze/extraction, validation, reconciliation, exception
  sign-off, checkpoint, activation, legacy read-only transition, monitoring.
- **Dependencies:** Phase 7 acceptance, validated BL-06/07, source freshness,
  recovery, and explicit cutover approval.
- **Deliverables:** Cohort evidence pack, sign-offs, checkpoint, cutover log,
  legacy authority record, post-cutover reconciliation.
- **Acceptance criteria:** No unexplained material difference; canonical
  Ledgerly journals are sole authority; legacy status is explicit; exceptions
  have owners; recovery and correction paths are tested.
- **Risks:** Irreversible discrepancy, competing authority, user disruption.
- **Required reviewers:** Product owner, accounting authority, migration,
  security, architecture, operations, audit.
- **Approval gate:** Explicit migration execution and cutover approvals.

## 21. Planning-only proposed task inventory

The following are planning records only. They are not executable project tasks,
do not unblock BL-06/BL-07, and require separate approval before any execution.

| ID | Status | Purpose | Dependencies | Affected areas | Risk | Acceptance criteria | Required reviewer | Execution approval |
|---|---|---|---|---|---|---|---|---|
| PB-01 | PLANNING ONLY — NOT APPROVED FOR EXECUTION | Define when a consequential action is using current source and accounting context. | DEC-03–DEC-12, DEC-21, readiness review | Source freshness, posting, VAT, reconciliation, jobs | Critical: stale data can corrupt accounting | Revision/snapshot, conflict, queue, retry, membership, capability, period, configuration, mapping, idempotency, and audit rules are documented and tested in design. | Accounting, security, architecture, product | Required |
| PB-02 | PLANNING ONLY — NOT APPROVED FOR EXECUTION | Prepare the safe company-scoped write and capability foundation. | PB-01; BL-01–05 | Membership, capabilities, typed commands, money, VAT | Critical: unauthorised or client-controlled writes | Scope, actors, capabilities, invariants, errors, audit, and test plan are approved. | Security, architecture, accounting | Required |
| PB-03 | PLANNING ONLY — NOT APPROVED FOR EXECUTION | Define the chart, controls, configuration, year, and period implementation plan. | PB-02; DEC-06–DEC-11 | BL-07 | Critical: wrong period or historical remap | Version resolution, close/reopen, mappings, migration impact, schema boundary, and tests are reviewed. | Accounting, architecture, migration | Required |
| PB-04 | PLANNING ONLY — NOT APPROVED FOR EXECUTION | Define the canonical journal posting and correction implementation plan. | PB-02/03; DEC-04 | BL-06 | Critical: duplicate or unbalanced accounting | Posting transaction, idempotency, source context, corrections, audit, recovery, and invariant tests are approved. | Accounting, architecture, security | Required |
| PB-05 | PLANNING ONLY — NOT APPROVED FOR EXECUTION | Define non-duplicating AR/AP, payment, allocation, credit, prepayment, refund, and reconciliation slices. | PB-01/04; DEC-12–DEC-16 | BL-08–BL-16 | High: wrong balances or duplicate cash | Journal effects, approval states, freshness checks, and reconciliation tests are accepted. | Accounting, product, security | Required |
| PB-06 | PLANNING ONLY — NOT APPROVED FOR EXECUTION | Define journal-authoritative reporting, audit, exports, documents, and lifecycle implementation. | PB-04/05; DEC-17–DEC-19 | BL-17/18, reports, exports | High: misleading reports or data leakage | Report/export authority, bounds, provenance, audit, retention, and access tests are accepted. | Accounting, security, privacy, product | Required |
| PB-07 | PLANNING ONLY — NOT APPROVED FOR EXECUTION | Define recovery, restore, observability, and operational acceptance. | PB-04; DEC-20/21 | BL-24, recovery, operations | Critical: unrecoverable or replayed accounting | Checkpoint, restore, RPO/RTO, audit, tenant, incident, and no-replay evidence is approved. | Operations, accounting, security, architecture | Required |
| PB-08 | PLANNING ONLY — NOT APPROVED FOR EXECUTION | Prepare a source-supported migration pilot without writing accounting. | PB-01/03/04/07; DEC-22 | Migration adapters, mappings, exceptions, dry run | Critical: invented history or wrong company | Source inventory, provenance, mapping, exception, reconciliation, and dry-run plan are approved. | Migration, accounting, security, privacy | Required |
| PB-09 | PLANNING ONLY — NOT APPROVED FOR EXECUTION | Plan one bounded cohort migration and controlled cutover. | PB-08; validated BL-06/07 | Migration, cutover, legacy authority | Critical: competing authority or irreversible discrepancy | Cohort, freeze, checkpoint, final validation, sign-off, legacy status, rollback, and post-cutover plan are approved. | Product, accounting, migration, operations | Required |
| PB-10 | PLANNING ONLY — NOT APPROVED FOR EXECUTION | Prepare the release and publishing evidence pack. | PB-01–09; BL-23/24 | Regression, deployment, publishing | High: unsafe release | Critical/high findings addressed; recovery, security, accounting, migration, and regression evidence complete. | Product, accounting, security, operations | Required |

No PB item is an executable task. Any separately proposed project follow-up may
track planning work only and does not change this status, unblock BL-06/BL-07,
or authorise implementation.

## 22. Approval gates

Each gate below is separate from DEC-01 through DEC-22 approval.

| Gate | Required evidence | Approval required |
|---|---|---|
| Architecture | Scope, dependencies, service/data contracts, invariants, changeable choices, and decision mapping | Architecture and product |
| Schema | Conceptual model, migration/backfill impact, constraints, tenant scope, rollback, and tests | Architecture, accounting, security, explicit task owner |
| Accounting | Journal effects, balance/VAT/AR/AP rules, corrections, periods, freshness, reconciliation, and acceptance tests | Accounting authority and product |
| Security | Auth, active membership, capabilities, tenant scope, privileged access, audit, support, jobs, and recovery | Security and architecture |
| RLS | Compatibility assessment, pooling/worker/admin/recovery tests, performance, and fallback behavior | Architecture, security, operations |
| Migration | Source inventory, adapter/mapping, provenance, exception, reconciliation, checkpoint, cohort, rollback, and legacy authority | Migration, accounting, security, product |
| Recovery | Backup/checkpoint, isolated restore, RPO/RTO, no-replay, audit, and exercises | Operations, accounting, security |
| Deployment | Environment/configuration review, migrations, backups, monitoring, rollback, and incident readiness | Operations, architecture, security, product |
| Publishing | Release suite, no critical/high findings, accounting/security sign-off, user-facing readiness, and recovery evidence | Product owner and release reviewers |

No gate passes merely because DEC-01 through DEC-22 are approved.

## 23. Risk register

| Rank | Risk | Control / mitigation | Owner or reviewer |
|---|---|---|---|
| Critical | Accounting corruption from unbalanced or malformed journals | Server-side transaction, line validation, balance invariant, no generic journal CRUD | Accounting / architecture |
| Critical | Duplicate posting from retries, bulk actions, or reconciliation | Company/source/version idempotency, locks, atomic command, retry tests | Accounting / security |
| Critical | Stale data creates incorrect accounting | Source envelope, final revalidation, conflict rejection, queue expiry | Accounting / product |
| Critical | Concurrent period/configuration change | Atomic period/config checks, effective-dated versions, close/reopen lock | Accounting / architecture |
| Critical | Incorrect account/control mapping | Stable identity, protected roles, mapping review, exception state | Accounting / migration |
| Critical | VAT error or second VAT authority | DEC-03 sole service, source evidence, deterministic adapter, VAT reconciliation | Accounting / product |
| High | Incorrect AR/AP, settlement, or allocation | Distinct payment/allocation concepts, derived settlement, balance limits | Accounting |
| High | Tenant leakage | Company context, active membership, capability checks, isolation/RLS tests | Security |
| High | AI context leakage or unauthorised action | Scoped retrieval, capability matching, approval, final revalidation, audit | Security / AI owner |
| High | Export leakage or over-broad representation | Finite company-scoped exports, capability, audit, version/bounds | Security / product |
| Critical | Migration discrepancy or invented history | Evidence preservation, additive adapters, dry run, exceptions, reconciliation | Migration / accounting |
| Critical | Recovery failure or replay | Managed encrypted backup, isolated restore, checkpoints, no-replay tests | Operations |
| High | Audit or retention gap | Immutable audit, class/legal-hold checks, lifecycle tests | Privacy / audit |
| High | Legacy system remains competing authority | Explicit cutover event, read-only legacy state, canonical-only reporting | Product / migration |
| High | Source freshness contract becomes hidden policy | Label proposal, explicit accounting/security review, DEC-12 amendment path | Product / accounting |
| Medium | RLS breaks workers, migrations, support, or recovery | Feasibility tests before adoption; application scoping remains mandatory | Architecture / security |
| Medium | Scope expands into unsupported providers/markets | Explicit in/out scope and product approval gate | Product |

## 24. Open implementation questions

These questions must be answered in the appropriate review before affected
tasks are approved. They are not all new governance decisions.

### Engineering decisions

- Which transaction, locking, idempotency, and retry mechanisms fit the
  existing database/runtime?
- How should source envelopes and immutable audit evidence be serialized?
- How should projections, queues, dead letters, and observability be
  implemented?
- Which API and worker conventions best preserve the authoritative boundaries?

### Architecture decisions

- What physical schema and service boundaries best satisfy the conceptual
  model?
- Which projections are rebuildable and which evidence must be stored?
- How should RLS feasibility be tested and bounded?
- Which deployment and recovery topology supports the approved controls?

### Security decisions

- How are privileged migration, recovery, support, and disposal capabilities
  granted, time-limited, and audited?
- How is company context established and cleared in pooled workers?
- What are the exact export, document, AI, and notification data boundaries?

### Accounting decisions

- What is the approved governance placement for the source-freshness contract,
  given DEC-12's explicit non-assignment, and is an amendment required?
- What materiality and precision treatment is acceptable for each migration
  source?
- Which historical records can be represented canonically versus retained as
  evidence-only exceptions?
- What detailed journal effects apply to any source-specific workflow not
  covered by the approved policies?

### Product decisions

- Which approved launch slices are selected first?
- Which optional providers or capabilities are intentionally excluded?
- What user-facing wording and review experience explains stale/conflict/
  exception states?
- What post-cutover comparison period is appropriate for the selected cohort?

### Migration decisions

- Which source systems and shapes are supported first?
- Which companies form the pilot cohort?
- What evidence and reconciliation thresholds are required?
- What legacy retention and later disposition plan applies?
- What exact event qualifies as a failed cutover versus a post-cutover
  accounting correction?

### Requires explicit approval

No open question may be answered by silently changing DEC-01 through DEC-22,
choosing a new product scope, creating DEC-23, or executing an implementation
task.

## 25. What remains changeable

The following are deliberately not locked by this brief:

- exact schema, table, column, index, and constraint names;
- API paths, DTOs, event formats, and transport;
- internal service/module boundaries;
- ORM, query, transaction, and locking implementation;
- projection/materialization strategy;
- queue, worker, scheduler, and observability technology;
- RLS implementation and breadth after feasibility testing;
- infrastructure and deployment architecture;
- backup vendor and point-in-time recovery technology;
- export libraries and serialization details within DEC-19 bounds;
- migration adapter internals and mapping tools;
- exact pilot cohort and sequencing;
- UI layout, copy detail, and interaction design; and
- AI model/provider and retrieval implementation.

These choices remain constrained by immutable accounting, company isolation,
source provenance, idempotency, period/configuration controls, audit,
retention, recovery, and migration evidence.

## 26. Final planning recommendation

### IMPLEMENTATION PLANNING STATUS

**READY TO BEGIN IMPLEMENTATION PLANNING**

Planning may now define and review the contracts and task scopes above. The
project is **not** ready to begin implementation.

Before any implementation begins:

1. resolve the source-freshness contract or document the DEC-12 amendment path;
2. select a bounded implementation scope;
3. approve the implementation brief for that scope;
4. complete architecture, accounting, security, migration, recovery, and test
   reviews;
5. approve the corresponding implementation task explicitly; and
6. pass the relevant schema, migration, deployment, and publishing gates.

## 27. Final verification

- DEC-01 through DEC-22 remain APPROVED.
- No DEC-23 was created.
- BL-06 and BL-07 remain BLOCKED.
- Source freshness/posting safety is explicitly documented as a proposed
  implementation contract and separately unresolved dependency.
- All proposed task records in this document are `PLANNING ONLY — NOT APPROVED
  FOR EXECUTION`.
- No implementation task was executed.
- No application, schema, migration, accounting, UI, workflow, dependency,
  infrastructure, deployment, or publishing change was made.
- No migration or cutover was executed.

This brief stops at planning. It does not authorise implementation.