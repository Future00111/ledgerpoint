# Ledgerly Historical Accounting Migration Pilot Plan

**Status:** PLANNING / DESIGN ONLY — NOT APPROVED FOR EXECUTION  
**Governance baseline:** DEC-01 through DEC-22 APPROVED  
**Migration policy:** DEC-22 — validated additive adapters and controlled
cohort/source cutover  
**Related design inputs:**

- [Current Decision Register](ledgerly-current-decision-register.md)
- [Implementation Readiness Review](ledgerly-implementation-readiness-review.md)
- [Implementation Brief](ledgerly-implementation-brief.md)
- [Source-Freshness and Posting-Safety Contract](ledgerly-source-freshness-posting-safety-contract.md)
- [Safety-Rule Ownership Record](ledgerly-safety-rule-ownership-record.md)
- [Accounting-Core Architecture Review](ledgerly-accounting-core-architecture-review.md)
- [DEC-22 Migration and Cutover Policy Review](ledgerly-dec-22-migration-and-cutover-policy-review.md)

**BL-06 / BL-07:** BLOCKED  
**DEC-23:** Not created and not required  
**Migration/cutover status:** Not started

> This document is a planning/design package only. It does not extract,
> transform, stage, write, migrate, cut over, reconcile live data, change
> accounting authority, or execute any implementation task. It does not change
> application code, schema, migrations, accounting logic, UI, workflows, APIs,
> workers, dependencies, infrastructure, deployment, or publishing.

## 1. Executive summary

### Objective

Define how Ledgerly could eventually migrate historical accounting data from a
supported legacy source into the canonical Ledgerly accounting model without:

- inventing accounting facts, dates, VAT treatment, mappings, approvals,
  periods, configuration history, provenance, or lifecycle events;
- rewriting or deleting authoritative history;
- creating duplicate payments, journals, VAT effects, or accounting authority;
- allowing a legacy system to remain a competing post-cutover ledger; or
- weakening company, evidence, recovery, audit, or retention boundaries.

### Proposed direction

Use **validated additive adapters plus a controlled company/source cohort**:

```text
Source discovery
  -> immutable source snapshot and evidence inventory
  -> versioned read-only adapter
  -> deterministic staging/transformation
  -> provenance and exception classification
  -> source/transformation/accounting/reporting validation
  -> reconciliation and recovery checkpoint
  -> explicit migration approval
  -> bounded canonicalisation/cutover
  -> canonical Ledgerly authority
  -> legacy read-only evidence or bounded comparison
```

### Core safety conclusion

Only facts supported by authoritative source evidence and the approved
canonical accounting rules may become canonical Ledgerly accounting. Unknown,
ambiguous, conflicting, unsupported, or incomplete history remains an explicit
migration exception or evidence-only record. It is never silently guessed.

## 2. Planning-only status

### Required by approved policy

- DEC-01 through DEC-22 remain approved and unchanged.
- DEC-22 allows planning for validated additive adapters, controlled cohorts,
  bounded comparison, recovery checkpoints, reconciliation, exceptions, and
  cutover.
- Governance approval is not implementation approval.
- BL-06 and BL-07 remain blocked.
- No DEC-23 is created.

### Explicitly not authorised

This plan does not authorise:

- selecting or connecting a production source;
- creating an adapter, schema, migration, worker, API, or UI;
- extracting or transforming data;
- creating canonical journals;
- changing accounting authority;
- selecting a cohort or cutover date for execution;
- approving a migration exception;
- running a dry run against real data;
- creating a recovery checkpoint;
- performing cutover or rollback;
- retiring or deleting legacy evidence;
- adopting RLS;
- deploying or publishing; or
- creating or executing an implementation task.

## 3. Governance constraints

### Approved decision dependencies

| Decision | Migration-pilot constraint |
|---|---|
| DEC-01 | Follow the authority hierarchy. A migration plan cannot override an approved policy or resolve a conflict silently. |
| DEC-02 | Keep the pilot inside the approved UK/GBP-oriented core accounting scope. Unsupported market, currency, or source capability becomes out of scope or an exception. |
| DEC-03 | Use the deterministic supported VAT authority. Historical VAT must come from authoritative source/tax evidence; special or unknown treatment is not silently converted to standard VAT. |
| DEC-04 | Canonical journals are server-generated, balanced, source-linked, immutable after posting, idempotent, and corrected additively. |
| DEC-05 | Migration operators, approvers, support users, and jobs require active membership, company-scoped server-side capabilities, approval, and audit. |
| DEC-06 | Financial-year assignment follows the authoritative posting date and company calendar; it is not invented from a convenient migration batch date. |
| DEC-07 | Period identity and closed-period rules must be preserved. Migration cannot invent closure or bypass a closed period. |
| DEC-08 | Year-end is reporting-only at launch; migration must not create automatic closing or retained-earnings journals. |
| DEC-09 | Stable account identity and classification must be preserved. Names/codes alone are not sufficient historical meaning. |
| DEC-10 | Protected AR, AP, bank/cash, Input VAT, Output VAT, and approved settlement mappings must be validated and traceable. |
| DEC-11 | Material configuration is immutable, effective-dated, company-scoped, resolved by posting date, and retained with canonical postings. |
| DEC-12 | Payment, allocation, and settlement remain distinct; bank evidence and reconciliation do not create duplicate accounting. |
| DEC-13 | Overpayments and unapplied cash remain explicit rather than being silently allocated. |
| DEC-14 | Unapplied-cash workflow state and transitions remain controlled and auditable. |
| DEC-15 | Refunds require evidence, balance, authority, source links, and controlled canonical treatment. |
| DEC-16 | The separate user-facing payment-on-account feature remains outside the approved launch scope. |
| DEC-17 | Retention preserves accounting meaning, source evidence, provenance, and auditability. |
| DEC-18 | Migration cannot recreate legitimately disposed records, bypass legal holds, or use disposal to hide discrepancies. |
| DEC-19 | Migration extraction, source snapshots, and user-facing exports remain distinct; an ordinary export is not a backup or authority. |
| DEC-20 | Recovery checkpoints, isolated restore validation, audit, and no-replay controls are required. |
| DEC-21 | Source, destination, jobs, documents, AI context, support, recovery, and exports remain company-scoped. RLS is defence-in-depth, not yet selected. |
| DEC-22 | Use additive adapters, preserved evidence/provenance, explicit exceptions, validation, reconciliation, controlled cutover, and legacy read-only evidence. |

### Source-freshness dependency

**REQUIRED BY APPROVED POLICY:** Source freshness/posting safety is the
implementation-level contract derived from DEC-01–DEC-22. It is not assigned to
DEC-12, and it does not require DEC-23 merely because it spans multiple
decisions.

**REQUIRED IMPLEMENTATION BEHAVIOR:** Any migration command that can create or
alter canonical accounting must pass the source-freshness and posting-safety
boundary before persistence. The migration adapter cannot treat a stale
snapshot, queue item, approval, or AI suggestion as current authority.

## 4. Migration objectives

### Required by approved policy

The pilot must:

1. preserve original source evidence and provenance;
2. identify what can and cannot be safely represented canonically;
3. preserve company ownership and historical uncertainty;
4. produce balanced, source-linked canonical journals only where evidence and
   approved treatment support them;
5. reconcile source and canonical results before authority changes;
6. make all unsupported, ambiguous, conflicting, or incomplete history visible;
7. establish one bounded canonical authority after cutover; and
8. preserve legacy evidence for the required retention/comparison period.

### Pilot success is not migration volume

**PROPOSED TECHNICAL DESIGN:** The pilot should optimize for evidence quality,
reconciliation confidence, safe exception handling, and recoverability rather
than the number of records canonicalised. A smaller cohort with more complete
provenance is safer than a broad cohort with guessed mappings.

## 5. Supported source assumptions

### Current planning position

No legacy source, source adapter, company cohort, extraction date, or cutover
date is approved by this plan.

The current Ledgerly compatibility model contains Base44-shaped/legacy source
records and workflow evidence, but those records are not automatically a
supported migration source. They must pass the source eligibility gates below.

### Minimum source eligibility

A source is a candidate for a pilot only if it can provide, or a controlled
snapshot can preserve:

- stable source company/tenant identity;
- stable source record identifiers;
- source revision/version, event sequence, or snapshot identity where
  available;
- extraction timestamp and integrity information;
- source relationships among companies, parties, documents, payments,
  allocations, bank evidence, journals, and VAT evidence;
- amounts, currency, dates, status, and line-level evidence relevant to the
  selected scope;
- enough account/tax/configuration context to explain each proposed canonical
  effect;
- document/evidence references and retention/disposal state where applicable;
- a way to detect duplicates and incomplete extraction; and
- an authorised source owner who can confirm source scope and extraction
  rights.

### Unsupported source conditions

The source is not eligible for automatic canonicalisation when it has:

- no stable identity or trustworthy snapshot boundary;
- no company ownership boundary;
- only denormalised balances with no supporting accounting evidence;
- unexplained one-sided or unbalanced journals;
- unknown or unsupported VAT scheme/treatment for the selected records;
- no reliable date, period, or configuration evidence;
- irreversible destructive extraction behavior;
- unresolved cross-company references;
- missing required documents or legally protected evidence; or
- a source revision race that cannot be bounded by a snapshot or review.

Such data may be retained as evidence or an explicit exception if retention and
authority permit. It must not be presented as fully canonicalised history.

### Source support decision

**NOT YET DECIDED:** The first supported source, source shape, company, and
record classes. These require a later source-specific planning review and
explicit migration approval. This plan does not infer them from the current
compatibility schema.

## 6. Source discovery and evidence preservation

### Proposed discovery sequence

1. Identify the source owner, system, environment, tenant, legal entity, and
   permitted extraction scope.
2. Inventory source entities, relationships, revisions, timestamps, status
   values, documents, audit records, configuration, periods, and retention
   flags.
3. Identify which source values are authoritative facts, derived displays,
   cached values, user suggestions, or unsupported metadata.
4. Record extraction capabilities, rate/volume limits, revision semantics,
   deletion behavior, and error behavior.
5. Define an immutable snapshot boundary and integrity check.
6. Sample records without writing to Ledgerly's canonical accounting.
7. classify each record/data class as canonical candidate, evidence-only,
   unsupported, or migration exception.

### Evidence preservation

**REQUIRED BY APPROVED POLICY:** Preserve original source evidence and enough
context to explain every canonical fact or exception.

**PROPOSED TECHNICAL DESIGN:** Preserve:

- the source export/snapshot or an integrity-protected reference;
- source system and tenant/company identity;
- source record ID and relationship IDs;
- source revision/version/event identity;
- extraction time and snapshot identity;
- raw value references where retention permits;
- normalized values used by transformation;
- source adapter and mapping versions;
- validation/reconciliation result;
- exception and approval history; and
- canonical record/journal relationship after an approved migration.

**ENGINEERING CHOICE:** Whether evidence is stored inside Ledgerly, in
controlled object storage, or through an immutable external reference. The
chosen design must preserve company scope, integrity, retention, legal holds,
access audit, and recovery.

## 7. Provenance model

The following is a **PROPOSED TECHNICAL DESIGN**, not a physical schema.

### Provenance envelope

Every migrated canonical candidate and every migration exception should carry:

| Provenance element | Required meaning |
|---|---|
| Source system | System/product and environment from which the record came |
| Source company/tenant | Original ownership scope |
| Destination company | Ledgerly company target; must be explicitly validated |
| Source record ID | Original stable identifier |
| Source relationship IDs | Original document, payment, allocation, party, bank, journal, and evidence links |
| Source revision/version | Native source revision/event identity where available |
| Source snapshot ID | Immutable extraction/snapshot boundary |
| Extraction timestamp | When the source was captured |
| Adapter version | Deterministic transformation implementation identity |
| Mapping version | Reviewed account/configuration/tax mapping identity |
| Cohort ID | Bounded company/source migration group |
| Validation status | Stage-specific result and evidence |
| Exception status | Unresolved/resolved/evidence-only/blocked state |
| Canonical relationship | Ledgerly record/journal/evidence relationship, if approved |
| Authority transition | Pre-cutover, staged, cutover, legacy read-only, or post-cutover status |

### Provenance requirements

- Provenance must be append-only or otherwise tamper-evident.
- A missing provenance element is an exception, not an empty value that implies
  certainty.
- Source IDs must not be replaced by new IDs without retaining the original.
- Mapping and adapter versions must be reproducible or retained as evidence.
- Provenance must remain company-scoped in reads, writes, jobs, exports, AI
  retrieval, support, recovery, and audit.

## 8. Migration cohort strategy

### Proposed pilot cohort

**PROPOSED TECHNICAL DESIGN:** Select one small, controlled company/source
cohort only after source eligibility is proven. Prefer a non-critical or
operationally controlled company/data set where appropriate, with an owner who
can validate source history and accept a temporary comparison process.

The cohort should be:

- small enough for record-level review;
- representative of the supported source shape;
- bounded to an explicit date range and record classes;
- free of known unsupported VAT schemes or clearly isolated from them;
- recoverable and independently restorable;
- supported by a source owner and accounting reviewer; and
- isolated from unrelated companies and migration jobs.

### Cohort states

**PROPOSED TECHNICAL DESIGN:** A cohort may move through:

`PROPOSED -> SOURCE_REVIEW -> SNAPSHOT_READY -> DRY_RUN -> VALIDATED ->
APPROVED_FOR_CUTOVER -> CUTOVER -> MONITORING -> CLOSED`

Any material source, mapping, validation, ownership, recovery, or reconciliation
change returns the cohort to review or blocks it. These are conceptual states,
not an approved schema or workflow.

### Cohort non-goals

The first pilot must not attempt:

- multiple unrelated source systems;
- all companies at once;
- unsupported VAT schemes/treatments;
- records without reliable ownership;
- destructive source cleanup;
- automatic historical reconstruction;
- permanent dual authority; or
- cutover while material exceptions remain unexplained.

## 9. Additive adapter architecture

### Required by approved policy

DEC-22 requires validated additive adapters and preserved compatibility. The
source must not be destructively rewritten to fit Ledgerly.

### Proposed adapter stages

```text
Read-only source connector
  -> snapshot/integrity boundary
  -> source-normalized staging representation
  -> validation/classification
  -> versioned mapping transformation
  -> canonical candidate and exception output
  -> reconciliation/reporting comparison
```

### Adapter rules

- read source data without mutating the source;
- be deterministic for the same source snapshot, adapter, and mapping version;
- preserve raw/source identifiers and relationships;
- produce stable candidate identities and idempotent rerun behavior;
- reject incomplete or contradictory records rather than filling defaults;
- keep evidence-only records distinct from canonical candidates;
- record every transformation and classification decision;
- never write directly to canonical journals;
- use the source-freshness/posting-safety boundary for any consequential
  persistence;
- support dry run and repeatable comparison before execution approval; and
- keep adapter behavior bounded to the approved source/cohort.

### Engineering choices

**ENGINEERING CHOICE:** Programming language, connector protocol, staging
storage, streaming/batch shape, parser, checksum library, and worker
technology. None may weaken evidence, idempotency, company scope, or no-fake-
accounting rules.

## 10. Mapping strategy

### Mapping contract

Every mapping must state:

- source field/meaning and destination concept;
- source evidence supporting the mapping;
- mapping version and reviewer;
- effective date or historical applicability;
- company/cohort scope;
- confidence/classification;
- fallback behavior;
- validation rule;
- exception condition; and
- canonical/evidence-only disposition.

### Chart of Accounts and DEC-10 mappings

**REQUIRED BY APPROVED POLICY:** DEC-09 and DEC-10 govern stable account
identity, classifications, and protected AR, AP, bank/cash, Input VAT, Output
VAT, and applicable VAT-settlement roles.

**REQUIRED BY ACCOUNTING INVARIANT:**

- an account mapping must resolve to a valid company account;
- protected control roles must be eligible for the intended effect;
- mapping by name/code alone is insufficient;
- historical resolved account identity must remain explainable;
- an ambiguous source account becomes an exception; and
- the migration must not silently map unknown history to a convenient default.

**PROPOSED TECHNICAL DESIGN:** Maintain separate mapping decisions for:

1. source account identity to Ledgerly account identity;
2. source control role to DEC-10 protected role;
3. source line classification to ordinary account;
4. source VAT treatment to DEC-03 supported treatment; and
5. source configuration to DEC-11 version context.

**NOT YET DECIDED:** Exact mapping table/record shape, default account
selection, materiality threshold, and reviewer assignment.

### Unmappable records

If a source record cannot be mapped with sufficient evidence:

- preserve the source and reason;
- mark it as evidence-only or migration exception;
- exclude it from canonical accounting totals where it cannot be supported;
- include it in reconciliation and exception materiality;
- do not assign a guessed account, VAT treatment, period, or journal; and
- require an explicit, auditable resolution before any change in disposition.

## 11. Canonical accounting transformation

### Canonical journals and lines

**REQUIRED BY APPROVED POLICY:** Canonical posted journals must be normalized,
source-linked, server-generated, balanced, immutable, idempotent, and
auditable under DEC-04.

**REQUIRED BY ACCOUNTING INVARIANT:** A candidate may become a posted canonical
journal only when:

- all required source facts and provenance are present;
- the intended effect is within approved scope;
- the company, source, date, year, period, configuration, mappings, and VAT
  context are valid;
- the journal has two or more valid lines;
- debit and credit totals balance in minor units and currency;
- no line has both debit and credit;
- all accounts are company-scoped and eligible;
- the economic effect has not already been posted;
- the effect is idempotent and source-linked; and
- successful journal, links, and audit evidence commit atomically.

### Existing source journals

If the source provides journals and lines:

- preserve the original journal/source identity;
- validate line count, account meaning, currency, signs, debit/credit balance,
  date, company, period, VAT, and provenance;
- map only supported and evidenced lines;
- preserve original source totals for comparison;
- do not “repair” an unbalanced source by inventing a suspense, rounding,
  equity, or other line;
- classify unsupported/unbalanced history as an exception or evidence-only; and
- use a canonical correction/reversal only for an approved, evidenced
  post-cutover accounting correction, not to hide a migration mismatch.

### Source documents

Invoices, bills, credit notes, and other source documents may become canonical
business records only where source evidence supports their identity, company,
party, dates, amounts, lines, tax treatment, status, and relationships.

A source status or balance field alone does not prove a canonical journal.
Client-calculated totals, cached balances, and display fields are evidence to
validate, not authority.

### Dates, years, and periods

**REQUIRED BY APPROVED POLICY:** Apply DEC-06 and DEC-07 based on authoritative
source posting/tax dates and the destination company's calendar. Do not assign
the migration execution date as the historical posting date.

**REQUIRED BY ACCOUNTING INVARIANT:**

- every canonical candidate has an evidenced date or an exception;
- financial year is resolved from the canonical posting date and company
  calendar;
- accounting period is resolved and postability is checked;
- unknown or conflicting year/period evidence is not guessed;
- source period closure is preserved as evidence, not invented as a Ledgerly
  closure event; and
- DEC-08 reporting-only year-end does not create closing journals.

### Configuration versions

**REQUIRED BY APPROVED POLICY:** Resolve DEC-11 configuration by the canonical
posting date and retain the configuration context used.

**PROPOSED TECHNICAL DESIGN:**

- use a captured historical source configuration version where reliable;
- otherwise resolve an approved Ledgerly version only when it explains the
  proposed effect and is valid for the historical date;
- retain resolved account IDs, protected mappings, tax context, and version
  evidence with the candidate;
- never present current configuration as historical fact; and
- make unknown configuration history an explicit exception or evidence-only
  disposition.

### Payments, allocations, credits, prepayments, refunds, and bank evidence

**REQUIRED BY APPROVED POLICY:** DEC-12 through DEC-16 keep these concepts
distinct.

Migration must:

- migrate an accounting payment only when source evidence supports the payment,
  direction, amount, currency, date, party, and canonical treatment;
- preserve payment source identity and one-time effect identity;
- preserve explicit source allocations only when their relationships and amounts
  are evidenced;
- not infer allocations from a paid/balance field, date/amount coincidence, or
  bank match alone;
- keep customer credits and supplier prepayments distinct from unapplied cash;
- preserve refunds with original source, balance, authority, and evidence;
- treat bank rows as evidence/reconciliation context, not automatic journals;
- not create a second cash or AR/AP effect for a reconciliation link; and
- keep unsupported payment-on-account behavior outside the approved launch
  scope.

### VAT

**REQUIRED BY APPROVED POLICY:** DEC-03 remains the sole VAT authority.

Migration must:

- preserve source invoice/bill/credit-note VAT evidence and tax-point context;
- validate scheme, basis, treatment, rate, tax code, calculation, and effective
  dates;
- preserve historical VAT return/result evidence where supplied;
- avoid recalculating historical returns silently under today's profile;
- classify unsupported schemes/treatments, unknown rates, and conflicting VAT
  evidence as exceptions;
- never use bank-feed VAT metadata as return authority;
- never let AI select or repair VAT treatment; and
- link any supported VAT journal effect to deterministic evidence and audit.

## 12. Validation and reconciliation framework

Validation is staged. Passing one stage does not imply that the next stage has
passed.

### A. Source-level validation

**REQUIRED BY APPROVED POLICY:** Validate source evidence and provenance before
canonicalisation.

Check:

- snapshot completeness and integrity;
- expected record counts and extraction manifest;
- duplicate source IDs and duplicate economic events;
- referential integrity;
- company/tenant ownership;
- source relationships;
- source consistency across totals, statuses, balances, and lines;
- source revision/snapshot freshness;
- extraction errors, truncation, deletion, and permission gaps;
- document/evidence references; and
- retention/disposal/legal-hold state.

### B. Transformation validation

Check:

- mapping completeness and version;
- source-to-destination identity preservation;
- account classification and DEC-10 role eligibility;
- date and currency validity;
- financial-year and accounting-period resolution;
- DEC-11 configuration context;
- DEC-03 VAT treatment and rule/evidence;
- payment/allocation/credit/prepayment/refund relationship preservation;
- canonical candidate determinism and rerun identity;
- adapter output counts and exception counts; and
- no invented/defaulted values.

### C. Accounting validation

Check:

- every proposed journal has valid source/provenance;
- debits equal credits;
- debit/credit signs and line rules hold;
- journals contain sufficient lines;
- source/effect idempotency holds;
- AR/AP balances and open items reconcile;
- bank/cash balances reconcile to supported evidence;
- VAT balances and tax-coded sources reconcile;
- customer/supplier balances reconcile;
- payment/allocation relationships do not over-allocate;
- financial-year totals reconcile;
- period totals reconcile;
- trial balance or equivalent balances;
- protected control-account balances reconcile; and
- no journal is duplicated or partially persisted.

### D. Reporting validation

Compare:

- historical ledger and journal reports;
- trial balance;
- profit and loss;
- balance sheet;
- AR and AP aging;
- customer and supplier statements;
- payment/allocation/open-item reports;
- bank/cash reports;
- VAT reporting and box drill-down;
- period/year boundaries;
- document and evidence counts; and
- exception and evidence-only reports.

Reports must use canonical Ledgerly journals after cutover. Before cutover,
source/canonical comparison is validation only and does not create dual
authority.

### E. Post-cutover validation

Confirm:

- the approved cohort has a recorded canonical authority transition;
- canonical Ledgerly journals are the sole accounting/reporting authority;
- the legacy source is read-only evidence or bounded comparison only;
- no duplicate journal/payment/reconciliation effect exists;
- source/canonical differences are explained or assigned;
- migration exceptions have owners and states;
- company/tenant scope remains intact;
- audit evidence is complete;
- recovery/checkpoint evidence is retained; and
- monitoring has not identified a material unresolved discrepancy.

## 13. Migration exception model

### Required by approved policy

Unknown, ambiguous, conflicting, incomplete, unsupported, or unverifiable
history must become an explicit, auditable exception.

### Proposed exception contents

An exception should record:

- company/cohort;
- source and source record IDs;
- source snapshot/revision;
- affected data class and economic effect;
- issue category;
- original evidence and missing/conflicting evidence;
- attempted mapping/transformation, if any;
- canonical/evidence-only disposition;
- materiality and affected report totals;
- assigned reviewer/owner;
- status, reason, decision, and timestamps;
- required follow-up evidence;
- approval or rejection;
- linked canonical record/correction if eventually resolved; and
- retention/legal-hold classification.

### Proposed exception states

`NEW -> TRIAGED -> AWAITING_EVIDENCE -> RESOLVED_CANONICAL |
RESOLVED_EVIDENCE_ONLY | BLOCKED | ACCEPTED_WITH_REVIEW`

These labels are a **PROPOSED TECHNICAL DESIGN**, not a locked workflow.
`ACCEPTED_WITH_REVIEW` must never mean that unsupported facts were silently
posted; it means the approved owner accepted a documented residual difference
under the migration gate.

### Exception rules

- No exception may be closed by filling an unsupported value without evidence.
- A material unresolved exception blocks the affected record, report, or cohort
  according to the approved materiality rule.
- Exception counts and values are included in reconciliation.
- Evidence-only records cannot be represented as fully canonical accounting.
- Exceptions survive cutover and remain linked to later corrections or
  evidence, if any.

## 14. Pilot design

### Proposed conservative pilot

The first pilot should be:

- one explicitly approved company and source;
- one bounded historical date range;
- a representative but controlled set of invoices, bills, credits, payments,
  allocations, bank evidence, VAT evidence, journals, documents, and audit
  records as the source permits;
- isolated from production canonical accounting until approval;
- backed by an immutable source snapshot;
- preceded by a DEC-20 recovery checkpoint and restore validation;
- dry-run first, with no canonical persistence;
- reconciled by an accounting reviewer;
- subject to explicit migration and cutover approval; and
- monitored through a defined post-cutover comparison period.

### Pilot environments

**REQUIRED BY APPROVED POLICY:** Recovery, tenant, and evidence boundaries must
be preserved.

**PROPOSED TECHNICAL DESIGN:** Use:

1. a read-only source environment or controlled source snapshot;
2. an isolated staging/transformation environment;
3. an isolated restore/recovery validation environment; and
4. a bounded destination company/cohort context.

No environment may provide an unrestricted superuser path that bypasses
company scope, capability checks, audit, or idempotency.

### Pilot decision points

At each decision point, stop if evidence is insufficient:

1. source eligible;
2. snapshot complete and integral;
3. mapping review complete;
4. dry-run validation passed;
5. accounting/reporting reconciliation passed;
6. exceptions accepted or blocking exceptions resolved;
7. recovery checkpoint validated;
8. migration approval granted;
9. final snapshot/freeze validated;
10. cutover approval granted; and
11. post-cutover validation passed.

## 15. Approval gates

The following are separate future gates. None exists merely because DEC-01–DEC-22
are approved.

| Gate | Required evidence | Required approval |
|---|---|---|
| Source eligibility | Source owner, scope, extraction rights, revision/snapshot capability, company boundary, supported data classes | Product, migration, security, accounting |
| Schema/data design | Conceptual and physical impact, provenance, exceptions, tenant constraints, rollback and retention | Architecture, accounting, security |
| Adapter implementation | Versioned deterministic adapter design, no-write guarantee, idempotency, tests, source contract | Architecture, migration, security; explicit implementation task |
| Mapping | Chart, DEC-10 controls, DEC-11 config, dates/periods, VAT, source-specific mapping and exceptions | Accounting, migration, product |
| Data extraction | Snapshot manifest, integrity, permissions, source freeze/control, evidence retention | Migration owner, source owner, security |
| Data transformation | Deterministic dry run, provenance, candidate/exception counts, no-fake-accounting review | Migration, accounting, security |
| Canonical persistence | BL-06/BL-07 readiness, source freshness, invariants, idempotency, audit, recovery, tenant tests | Product, accounting, architecture, security; explicit task approval |
| Migration execution | Approved cohort, final validation, exception sign-off, checkpoint, runbook, monitoring | Product owner, accounting, migration, operations |
| Cutover | Reconciliation, no material unexplained difference, authority transition, legacy read-only plan | Product owner, accounting, migration, security, operations |
| Recovery/rollback | Restore evidence, no-replay test, rollback boundary and correction plan | Operations, accounting, architecture, security |
| RLS adoption | Compatibility, pooling/worker/admin/recovery tests, fallback controls | Architecture, security, operations |
| Deployment/publishing | Release, production configuration, recovery, audit, security, accounting and migration evidence | Product owner and release reviewers |

## 16. Cutover procedure

This is a **PROPOSED TECHNICAL DESIGN** for a future approved cohort:

1. confirm the cohort and source owner;
2. establish a controlled source freeze or record the source activity boundary;
3. capture and integrity-check the final source snapshot;
4. verify adapter/mapping/configuration versions;
5. run final source, transformation, accounting, reporting, and tenant
   validation;
6. reconcile source and candidate totals;
7. review all material exceptions;
8. create and validate the recovery checkpoint;
9. obtain explicit migration execution approval;
10. persist only approved, evidenced canonical candidates through the
    Consequential Accounting Command Boundary and Canonical Posting Authority;
11. record canonical journal/source/provenance/audit relationships;
12. reconcile post-persistence totals;
13. obtain explicit cutover approval;
14. record Ledgerly as the sole canonical accounting/reporting authority;
15. mark the legacy source read-only or bounded comparison only;
16. monitor the cohort and exceptions; and
17. close the pilot only after post-cutover acceptance criteria pass.

No step permits casual journal deletion, legacy dual posting, or silent source
rewriting.

## 17. Rollback and recovery boundaries

### Before canonical cutover

**REQUIRED BY APPROVED POLICY:** A failed dry run or staged transformation may
be abandoned, corrected, or restored without altering canonical Ledgerly
accounting.

**PROPOSED TECHNICAL DESIGN:** Discard/rebuild only the isolated staging output
after retaining the source snapshot, adapter/mapping versions, logs, and
exception evidence. Do not delete source evidence needed by retention or audit.

### During migration/cutover

If a blocking discrepancy, source race, tenant issue, recovery failure, or
material validation failure appears:

- pause the cohort;
- prevent further canonical persistence;
- preserve source and destination evidence;
- identify the last verified checkpoint;
- reconcile partial work using durable idempotency/effect records;
- restore only through the approved recovery boundary; and
- obtain a new decision before resuming.

### After canonical cutover

**REQUIRED BY APPROVED POLICY:** Do not casually delete or rewrite canonical
journals. A discrepancy follows DEC-04 controlled correction/reversal behavior.

Use post-cutover correction when:

- Ledgerly is already the canonical authority;
- the issue is a valid accounting correction rather than a failed cutover
  boundary;
- the original journal remains immutable;
- the correction/reversal is source-linked, balanced, auditable, and approved;
  and
- reconciliation records the change.

Use a controlled recovery/rollback boundary only when the separately approved
cutover criteria and recovery plan explicitly permit it. Rollback must not be a
mechanism for hiding a post-cutover accounting fact.

### No-replay rule

Recovery must preserve command/effect idempotency and canonical journal
relationships. Re-running a migration step or restoring a checkpoint must not
create a second economic effect.

## 18. Post-cutover validation

### Initial validation

Immediately after a future approved cutover, validate:

- canonical journal count and balance;
- source-to-canonical record counts;
- total debits/credits and trial balance;
- Balance Sheet and P&L;
- AR/AP and party balances;
- payments, allocations, credits, prepayments, refunds;
- bank/cash and reconciliation;
- VAT boxes and evidence;
- year/period boundaries;
- chart/control mappings;
- configuration-version relationships;
- document/evidence/audit counts;
- exception counts and materiality;
- company/tenant scope; and
- idempotency/no-duplicate indicators.

### Monitoring period

**NOT YET DECIDED:** Exact duration and materiality thresholds for post-cutover
monitoring. The selected values require product, accounting, migration, and
operations approval.

During monitoring:

- compare only the bounded agreed data set;
- keep canonical Ledgerly as authority;
- treat the legacy source as read-only evidence/comparison;
- route differences to an exception/correction process;
- do not silently reconcile by changing either authority; and
- record monitoring results and owner decisions.

## 19. Legacy read-only and comparison strategy

### Bounded dual-read

**REQUIRED BY APPROVED POLICY:** DEC-22 permits bounded dual-read comparison for
validation only, not permanent dual authority.

**PROPOSED TECHNICAL DESIGN:** Compare:

- source and canonical record counts;
- journal totals and line balances;
- financial-year and period totals;
- AR/AP/open-item balances;
- payments and allocation relationships;
- bank/cash and reconciliation outcomes;
- VAT evidence, boxes, and tax-coded totals;
- account/control mappings;
- document/evidence/audit links; and
- exception counts, values, and categories.

### Comparison rules

- The comparison set, fields, tolerances, and period must be explicitly
  approved before use.
- A difference is an exception until explained.
- Rounding tolerance must not conceal a material accounting difference.
- Source revisions after the final snapshot must be identified, not compared as
  if they were part of the migrated snapshot.
- Comparison output must not itself write accounting.
- Comparison results must be company-scoped and auditable.

### Legacy authority transition

After validated cutover:

- canonical Ledgerly posted journals are the sole accounting/reporting
  authority;
- the legacy source is read-only evidence or bounded comparison only;
- new accounting must not be posted independently to both systems;
- reports must not silently select the legacy ledger;
- support and exports must label legacy evidence as non-authoritative; and
- any later discrepancy uses canonical correction/reversal or an approved
  recovery boundary.

### Legacy retirement

**NOT YET DECIDED:** Exact retirement/disposal date and mechanism. Retirement is
permitted only after:

- the required retention period;
- audit/legal-hold review;
- evidence and export requirements;
- post-cutover exceptions;
- recovery validation;
- user/accounting sign-off; and
- DEC-18 lifecycle authority.

Retirement must not recreate, erase, or conceal legitimately disposed or
protected source data.

## 20. Tenant isolation and security

### Required by approved policy

DEC-05 and DEC-21 require:

- company-scoped migration jobs;
- source-company ownership validation;
- destination-company ownership validation;
- explicit background-job context;
- cross-company reference prevention;
- audited support/break-glass access;
- isolated recovery environment;
- document and export isolation;
- AI context isolation; and
- application-level server-side scoping regardless of RLS.

### Proposed security controls

- derive destination company from authorised server-side context;
- validate source company and destination company as an allowed pair;
- reject cross-company party, document, account, bank, journal, or evidence
  references;
- require separate capabilities for source review, mapping, approval,
  execution, cutover, recovery, and support;
- make migration jobs carry cohort/company/snapshot/adapter/mapping identity;
- expire migration authority and queue items;
- prevent a global worker or support role from silently bypassing scope;
- isolate staging and recovery data;
- redact cross-company existence from error responses;
- audit all privileged reads, exports, transformations, approvals, writes,
  pauses, restores, and cutover actions; and
- ensure AI retrieval cannot include another company or an unauthorised source.

### RLS

**REQUIRED BY APPROVED POLICY:** DEC-21 treats RLS as defence-in-depth.

**NOT YET DECIDED:** Universal RLS adoption. Before any adoption, test:

- pooled connections and context clearing;
- migration/backfill workers;
- source and destination company scope;
- support/break-glass access;
- recovery restores;
- exports/documents;
- audit access;
- cross-company reference rejection; and
- performance/operational behavior.

Application-level server-side ownership checks remain mandatory if RLS is
adopted.

## 21. AI boundaries

### Allowed assistance

AI may assist with:

- classification suggestions;
- candidate account/mapping suggestions;
- anomaly detection;
- exception explanation;
- evidence summarisation; and
- prioritising human review.

### Prohibited authority

AI must not:

- invent a source fact, date, amount, mapping, VAT treatment, allocation,
  payment, refund, period, configuration, approval, or audit event;
- silently resolve an ambiguous or conflicting record;
- approve a migration or cutover;
- create an authoritative migration decision;
- bypass source validation, DEC-05 capabilities, company scope, or
  source-freshness revalidation;
- write canonical journals directly; or
- become migration or accounting authority.

### Required AI controls

AI context must carry company, source, snapshot/revision, provenance, and
uncertainty. A recommendation becomes stale when relevant source, mapping,
configuration, period, VAT, or authority state changes. Any consequential
action still follows the normal human approval, final revalidation,
idempotency, canonical posting, and audit path.

## 22. Audit and provenance requirements

### Immutable audit evidence

Record audit evidence for:

- source discovery and extraction authorization;
- snapshot creation/integrity;
- adapter and mapping versions;
- source/transformation/accounting/reporting validation;
- exception creation, assignment, resolution, acceptance, and rejection;
- mapping approvals;
- capability/membership/privileged-access changes;
- dry runs and reconciliation;
- recovery checkpoints, restores, pauses, and resumes;
- migration execution and canonical persistence;
- cutover and legacy authority transition;
- post-cutover comparison and corrections;
- exports, documents, and evidence access;
- AI suggestions and consequential actions; and
- disposal/retirement decisions.

### Successful canonical effect

For a successful migrated canonical journal, audit must connect:

- company and actor/job;
- source system/company/record/revision/snapshot;
- adapter/mapping/configuration versions;
- posting date/year/period;
- control mappings and VAT evidence;
- command/effect/idempotency identity;
- validation and reconciliation result;
- approval and cutover authority;
- canonical journal and source relationship; and
- retention/lifecycle classification.

Successful accounting effect and required audit evidence must commit together.
An audit failure must not be converted into a successful unaudited post.

## 23. Retention and disposal

### DEC-17 / DEC-18 requirements

Migration must preserve applicable:

- source evidence;
- provenance;
- canonical journal relationships;
- audit records;
- exception records;
- documents and integrity references;
- retention class;
- legal hold;
- archival state;
- disposal/anonymisation state; and
- export/recovery evidence.

### Prohibited lifecycle behavior

Migration must not:

- recreate legitimately disposed personal or source data;
- bypass a legal hold;
- use canonicalisation to circumvent disposal;
- delete a source record merely because it was migrated;
- drop unresolved exception evidence;
- remove source identifiers from historical canonical relationships; or
- treat an export as a backup or substitute retention authority.

### Disposal gate

Any later source retirement or disposal requires a separate DEC-18-compliant
lifecycle review and approval. It is not part of pilot execution.

## 24. DEC-19 exports and migration inputs

If an export is used during a future migration, label it distinctly as:

1. a user-facing Ledgerly export;
2. a migration extraction;
3. an immutable source snapshot;
4. a canonical migration input; or
5. a validation/comparison output.

An ordinary PDF, CSV, JSON, audit package, or document bundle must not be
treated as a backup, canonical source, or proof of complete history without
source-specific validation.

Migration-related exports must be:

- company-scoped;
- capability-controlled;
- bounded;
- provenance-linked;
- versioned;
- retention-aware; and
- audited.

## 25. DEC-20 recovery requirements

Before any future approved migration execution:

- protect the source snapshot and destination scope;
- create a pre-migration recovery checkpoint;
- validate restore in an isolated environment where applicable;
- record checkpoint identity, scope, time, actor, and integrity;
- prove that restore preserves company scope, journal immutability, period state,
  configuration, audit, provenance, exceptions, and idempotency;
- define pause, recovery, and rollback criteria;
- ensure restore cannot replay a committed migration effect; and
- retain recovery evidence under DEC-17/18.

**NOT YET DECIDED:** Specific backup provider, topology, RPO/RTO, restore
automation, and operational runbook. No infrastructure is selected here.

## 26. Required accounting primitives

The migration pilot depends on the conceptual primitives from #40 being
available and reviewed:

1. company and active membership boundary;
2. DEC-05 capability and approval context;
3. source/provenance envelope;
4. stable accounts and protected control mappings;
5. DEC-11 configuration version;
6. financial year and accounting period;
7. canonical journal and journal lines;
8. balanced double-entry validation;
9. immutable posted history;
10. linked corrections/reversals;
11. payment/allocation/credit/prepayment/refund state;
12. deterministic DEC-03 VAT result;
13. idempotency/economic-effect identity;
14. concurrency and atomic transaction boundary;
15. audit evidence;
16. migration exception and cohort state;
17. recovery checkpoint and no-replay state; and
18. journal-authoritative reporting/reconciliation.

**REQUIRED BY APPROVED POLICY:** The absence of a primitive blocks the relevant
canonicalisation or requires evidence-only handling. The pilot cannot supply a
missing accounting core by inventing behavior.

## 27. Proposed implementation phases

These phases are planning targets, not approvals or executable tasks.

### Phase 0 — Governance and source eligibility

- **Objective:** Confirm the bounded source/cohort question and safety boundary.
- **Scope:** Source owner, supported records, extraction rights, source
  freshness, tenant/security, retention, and no-fake-accounting rules.
- **Dependencies:** DEC-01–DEC-22, #39, #40.
- **Deliverables:** Source eligibility brief, decision map, ownership/capability
  plan, open-question register.
- **Acceptance criteria:** No source/cohort is assumed; unsupported conditions
  and stop criteria are explicit.
- **Risks:** Wrong source authority, hidden legal/tenant issue.
- **Required reviews:** Product, accounting, migration, security, architecture.
- **Approval gate:** Source eligibility and planning approval.

### Phase 1 — Snapshot and evidence design

- **Objective:** Define an integrity-protected, read-only source snapshot.
- **Scope:** Extraction manifest, revisions, evidence, provenance, retention,
  source/company ownership, and integrity checks.
- **Dependencies:** Phase 0, DEC-17/18/19/21/22.
- **Deliverables:** Snapshot contract, evidence inventory, retention/lifecycle
  treatment, no-write extraction design.
- **Acceptance criteria:** Every selected source class has identity, ownership,
  revision/snapshot, extraction, evidence, and disposition rules.
- **Risks:** Incomplete extraction, source mutation, evidence loss.
- **Required reviews:** Migration, security, privacy, accounting, operations.
- **Approval gate:** Extraction design approval; no extraction yet.

### Phase 2 — Adapter and mapping design

- **Objective:** Define deterministic additive transformation without data loss.
- **Scope:** Adapter version, mappings, source relationships, account/control/
  VAT/configuration/date/period rules, exception model.
- **Dependencies:** Phases 0–1, #40 primitives, DEC-03/06–11/22.
- **Deliverables:** Adapter contract, mapping catalogue, provenance design,
  candidate/exception dispositions, deterministic rerun rules.
- **Acceptance criteria:** No unknown value defaults to a historical fact; all
  mappings have evidence, version, reviewer, and exception behavior.
- **Risks:** Incorrect mapping, invented VAT/period/configuration, lost links.
- **Required reviews:** Accounting, migration, architecture, security.
- **Approval gate:** Adapter/mapping implementation approval remains separate.

### Phase 3 — Dry run and validation framework

- **Objective:** Prove source, transformation, accounting, and reporting
  validation without canonical persistence.
- **Scope:** Staging candidates, exceptions, source/transformation/accounting/
  reporting comparisons, test data, reconciliation.
- **Dependencies:** Phases 1–2 and reviewed #40 accounting foundation.
- **Deliverables:** Dry-run report, reconciliation report, exception register,
  test results, unresolved-risk assessment.
- **Acceptance criteria:** No production accounting write; every difference is
  explained, assigned, or blocking.
- **Risks:** False reconciliation, incomplete coverage, hidden duplicates.
- **Required reviews:** Accounting, migration, product, security, operations.
- **Approval gate:** Dry-run approval; no migration execution.

### Phase 4 — Recovery and pilot-readiness

- **Objective:** Prove isolated restore, checkpoint, no-replay, tenant, and
  operational controls.
- **Scope:** DEC-20 checkpoint/restore, audit, observability, pause/resume,
  rollback boundaries, support/break-glass.
- **Dependencies:** Phases 1–3.
- **Deliverables:** Restore evidence, recovery runbook, checkpoint design,
  incident/rollback criteria, monitoring plan.
- **Acceptance criteria:** A restore preserves scope, provenance, exceptions,
  journals, idempotency, audit, and period/configuration meaning.
- **Risks:** Replay, inaccessible evidence, unsafe support access.
- **Required reviews:** Operations, security, accounting, architecture.
- **Approval gate:** Recovery approval; no live migration.

### Phase 5 — Controlled pilot execution design

- **Objective:** Prepare one bounded cohort for separately approved execution.
- **Scope:** Final snapshot, freeze/control, exception sign-off, reconciliation,
  cutover, legacy read-only/comparison, monitoring.
- **Dependencies:** Phases 0–4; validated BL-06/BL-07; source approval.
- **Deliverables:** Pilot runbook, cohort acceptance pack, approval checklist,
  reconciliation thresholds, cutover/rollback plan.
- **Acceptance criteria:** All execution prerequisites are evidenced and
  separately approved; this phase itself performs no migration.
- **Risks:** Over-broad cohort, authority conflict, irreversible discrepancy.
- **Required reviews:** Product, accounting, migration, security, architecture,
  operations.
- **Approval gate:** Migration execution and cutover approvals remain separate.

### Phase 6 — Post-cutover validation and legacy disposition design

- **Objective:** Define completion, monitoring, corrections, and eventual
  evidence retirement conditions.
- **Scope:** Canonical authority confirmation, bounded comparison, exceptions,
  correction/reversal, retention/legal hold, legacy retirement.
- **Dependencies:** Approved cutover and DEC-17/18/20/22.
- **Deliverables:** Post-cutover report, exception closure plan, correction
  policy application, retention/disposition review.
- **Acceptance criteria:** Ledgerly is sole authority, differences are explained,
  legacy remains appropriately read-only, and no premature disposal occurs.
- **Risks:** Permanent dual authority, lost evidence, hidden correction.
- **Required reviews:** Product, accounting, migration, privacy, operations.
- **Approval gate:** Post-cutover acceptance and any later disposal approval.

## 28. Acceptance criteria

The pilot design is complete for review when:

1. the source and cohort are explicitly marked as not yet selected;
2. source eligibility and stop conditions are documented;
3. every canonical candidate has a provenance path back to a source snapshot;
4. every unknown, ambiguous, conflicting, unsupported, or incomplete value has
   an exception/evidence-only disposition;
5. no invented journal, date, VAT treatment, account mapping, allocation,
   payment, refund, period closure, year, configuration, approval, audit event,
   or provenance is permitted;
6. the canonical journal and line invariants from #40 are applied;
7. DEC-03 VAT authority is used without a second migration VAT engine;
8. DEC-10 mappings and DEC-11 configuration versions are evidenced and
   validated;
9. AR/AP/payment/allocation/credit/prepayment/refund/bank/reconciliation
   concepts remain distinct and non-duplicating;
10. source, transformation, accounting, reporting, and post-cutover
    validation stages are defined;
11. reconciliation includes totals, relationships, periods, VAT, evidence,
    exceptions, and tenant scope;
12. a recovery checkpoint and no-replay test are required before execution;
13. cutover establishes canonical Ledgerly authority and legacy read-only/
    bounded comparison only;
14. post-cutover discrepancies use correction/reversal or approved recovery,
    not history rewriting;
15. migration jobs, support, documents, exports, AI, recovery, and RLS
    feasibility preserve DEC-21;
16. retention/disposal/legal-hold requirements are preserved;
17. approval gates exist for schema, adapter, extraction, transformation,
    execution, cutover, recovery, RLS, deployment, and publishing; and
18. no step in this plan is executable without separate approval.

## 29. Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Invented historical accounting | Critical | Evidence-first transformation, explicit exceptions, no defaults for unknown facts, accounting review |
| Unbalanced or malformed canonical journal | Critical | #40 journal invariants, server-side final validation, no partial persistence |
| Duplicate posting or duplicate cash effect | Critical | Economic-effect identity, idempotency, concurrency control, reconciliation |
| Wrong source/company ownership | Critical | Source/destination ownership checks, cohort scope, tenant tests, no global worker |
| Incorrect chart/control mapping | Critical | DEC-09/10 mapping contract, protected-role validation, reviewer and version evidence |
| Incorrect VAT treatment | Critical | DEC-03 sole authority, source/tax evidence, unsupported treatment exception |
| Wrong financial year or period | Critical | Evidence-based date, DEC-06/07 resolution, no invented closure or batch date |
| Stale source snapshot | Critical | Snapshot integrity, source revision, final freshness validation, freeze/control boundary |
| Missing or incomplete extraction | High | Manifest/count/referential checks, extraction exception, source owner sign-off |
| Hidden source duplicate | High | Stable source IDs, economic-effect identity, duplicate detection, reconciliation |
| Permanent dual accounting authority | Critical | Explicit cutover, legacy read-only/comparison state, canonical-only reporting |
| Migration exception concealment | High | Immutable exception history, materiality reporting, named reviewer, no silent closure |
| Recovery replay | Critical | Pre-migration checkpoint, isolated restore, durable idempotency, no-replay test |
| Tenant leakage in jobs/exports/AI | Critical | Explicit company context, resource ownership, capability checks, isolation tests |
| Premature source disposal | High | DEC-17/18 review, legal holds, retention matrix, separate retirement gate |
| AI silently resolves ambiguity | High | Advisory-only AI, human review, source-freshness revalidation, audit |
| False reconciliation from mismatched scopes | High | Same snapshot/date/cohort definitions, field-level comparison, exception materiality |
| Unsupported source shape | High | Eligibility gate, evidence-only disposition, no forced adapter assumptions |
| Cutover disruption | Medium | Small controlled cohort, freeze/control, checkpoint, pause/resume, monitoring |

## 30. Open questions and implementation prerequisites

### Open questions

These are not silently resolved by this plan:

- Which legacy source and source environment are first supported?
- Which company/cohort and date range are appropriate?
- Which source records are authoritative versus derived?
- What native source revision or snapshot mechanism is available?
- What evidence and reconciliation thresholds are required?
- Which historical account/configuration/period/VAT records are sufficiently
  evidenced?
- What exact DEC-11 historical configuration representation is available?
- What source-specific journal/payment/allocation/refund effects are supported?
- What monitoring duration and materiality threshold apply?
- What retention/legal-hold period applies to source evidence and documents?
- What exact recovery provider, RPO/RTO, and restore mechanics are selected?
- What RLS feasibility result is required before adoption?
- What UI/API language presents exceptions and legacy evidence?
- Which engineering decisions belong in the selected task brief versus the
  architecture review?

### Prerequisites before any implementation task

1. #39 source-freshness/posting-safety contract is accepted for the selected
   scope and its logical ownership is preserved.
2. #40 canonical accounting foundation design is accepted for the selected
   scope.
3. Source eligibility, source owner, extraction rights, and cohort are approved.
4. Physical schema/API/adapter/worker design is separately reviewed.
5. BL-06 and BL-07 have the required implementation evidence and explicit
   unblocking approval; this plan does not provide that approval.
6. Accounting effects, VAT treatment, period/year/configuration/mapping behavior,
   and correction/reversal behavior are approved for the source scope.
7. Security, capability, tenant, support, AI, document, export, and recovery
   designs are reviewed.
8. Dry-run, reconciliation, exception, provenance, audit, and recovery tests
   are defined and accepted.
9. Migration execution, schema, adapter, extraction, transformation, cutover,
   RLS, deployment, and publishing gates are separately approved.

## 31. Explicit non-authorisation

This plan does not authorise:

- implementation of an adapter or migration service;
- database or schema changes;
- migrations or data extraction;
- transformation of live or attached source data;
- canonical journal creation;
- accounting, VAT, payment, allocation, refund, period, or configuration
  logic;
- UI, API, workflow, worker, dependency, or infrastructure changes;
- RLS adoption;
- deployment or publishing;
- cutover or legacy retirement;
- execution of #40 or any other implementation task;
- creation of DEC-23; or
- unblocking BL-06 or BL-07.

## 32. Final verification

- DEC-01 through DEC-22 remain APPROVED.
- DEC-03 remains the sole VAT authority.
- DEC-12 remains exclusively Payment, Allocation and Settlement Policy.
- Source freshness/posting safety remains the implementation-level contract
  derived from DEC-01–DEC-22 and is not assigned to DEC-12.
- No DEC-23 exists.
- BL-06 and BL-07 remain BLOCKED.
- #39 remains a planning/design deliverable only.
- #40 remains a planning/design deliverable only.
- #41 is planning/design only.
- No implementation task was created or executed.
- No source data was extracted, transformed, migrated, or canonicalised.
- No application code, schema, migration, accounting logic, UI, workflow,
  dependency, infrastructure, deployment, publishing, or cutover change was
  made.
- No legacy authority was retired or changed.

This document stops at planning/design. It is not migration approval and does
not authorise implementation.