# DEC-22 — Historical Accounting-Data Compatibility and Cutover

**Decision:** DEC-22 — Historical accounting-data compatibility and cutover
**Scope:** Migration and cutover policy
**Status:** **APPROVED — migration/cutover policy only**
**Review date:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting, migration,
security, privacy, reliability, tenant-isolation, and architecture review
**Implementation authority:** None

> This records the final approved governance policy. It does not authorise an
> implementation task, code, schema, migration,
> accounting logic, UI, workflow, dependency, infrastructure configuration,
> deployment, publishing, or migration execution.

## 1. Exact registered question

The Current Decision Register defines DEC-22 as:

> **Historical accounting-data compatibility and cutover:** Define supported
> legacy shapes and sources, migration cohort, sequencing, validation,
> cutover, rollback, and backwards-compatibility policy.

The registered options are:

1. destructive replacement;
2. additive canonical tables with adapters and controlled cutover; or
3. permanent dual authorities.

The registered recommendation is:

> Validated additive adapters with a controlled cohort/source cutover,
> dual-read comparison, visible ambiguity, and rollback checkpoints.
> Canonical posted journals become the sole reporting authority after cutover.

This review evaluates that recommendation without approving DEC-22.

## 2. Purpose and governing principle

Migration is a controlled transformation of existing evidence into Ledgerly's
governed accounting model. It is not permission to rewrite history, manufacture
certainty, or make an unvalidated system authoritative.

The migration policy must:

- preserve the meaning of historical accounting wherever evidence permits;
- never invent accounting facts, dates, journals, approvals, VAT treatment,
  configuration, period state, allocations, refunds, or lifecycle events;
- represent uncertainty explicitly;
- preserve source provenance and the relationship between records and
  evidence;
- maintain DEC-04 canonical accounting integrity;
- preserve company boundaries under DEC-21;
- use DEC-20 recovery safeguards without redesigning backup architecture;
- keep DEC-19 exports as representations rather than authorities;
- define when Ledgerly becomes the sole reporting authority;
- provide measurable validation, reconciliation, exceptions, rollback
  checkpoints, and audit evidence; and
- leave implementation details to a separately authorised implementation
  process.

Where evidence exists: **preserve it.**
Where evidence is incomplete: **identify the gap.**
Where evidence conflicts: **reconcile it.**
Where uncertainty remains: **record the exception.**

## 3. Constraints from approved DEC-01 through DEC-21

### Already decided

- **DEC-01:** Governance follows the approved hierarchy. A policy approval
  does not itself authorise implementation.
- **DEC-02 and DEC-03:** The initial product is UK/GBP-oriented, with
  source-linked VAT preparation and no direct HMRC submission.
- **DEC-04:** Canonical accounting is normalized, balanced,
  server-generated, integer-minor-unit, source-linked, idempotent, append-only,
  and immutable. Corrections use controlled reversals or replacement entries.
- **DEC-05:** Capabilities are company-scoped and enforced server-side.
  Consequential migration decisions require appropriate human authority.
- **DEC-06 through DEC-08:** Financial years, contiguous accounting periods,
  closed-period meaning, and reporting-only year-end must be preserved rather
  than inferred or silently recreated.
- **DEC-09:** Chart-of-accounts identity and classification are stable and
  controlled; used accounts are not destructively deleted or merged.
- **DEC-10:** AR, AP, bank/cash, Output VAT, and Input VAT control mappings are
  protected, validated, prospective where changed, and audited.
- **DEC-11:** Material accounting configuration is immutable by version,
  effective-dated, company-scoped, and selected by canonical posting date.
- **DEC-12 through DEC-16:** Payment evidence, accounting payments,
  allocations, settlement, customer credits, supplier prepayments, unapplied
  cash, refunds, and VAT evidence remain distinct and non-duplicating.
- **DEC-17:** Authoritative accounting and required audit evidence have
  company-life and applicable legal/regulatory retention obligations, with
  separate classes for personal data, documents, and AI evidence.
- **DEC-18:** Disposal is controlled and class-based. Legal holds override
  disposal, and migration must not invent deletion, anonymisation, archival,
  redaction, or disposal events.
- **DEC-19:** Exports are bounded, company-scoped, versioned representations,
  not accounting authority or automatic migration authority.
- **DEC-20:** Managed encrypted backup and recovery, isolated restoration,
  recovery targets, and tested restore controls protect migration checkpoints
  without changing accounting meaning.
- **DEC-21:** Every migration operation must preserve company scope,
  membership, capability, ownership, documents, AI context, and support
  boundaries. Ordinary cross-company relationships are prohibited.

### Consequences for DEC-22

Migration must preserve the relationship between:

- legacy records and source evidence;
- source evidence and canonical journals;
- accounts and stable Ledgerly account identity;
- control accounts and VAT meaning;
- financial years, periods, and historical configuration;
- payments, allocations, settlement, credits, prepayments, refunds, and bank
  evidence;
- documents, retention state, disposal state, and legal holds;
- company ownership and user membership; and
- migration decisions, exceptions, approvals, and audit history.

## 4. Migration scope

Each candidate data class must be classified before migration.

### Must migrate

Subject to evidence, company scope, mapping, and validation:

- company identity and ownership;
- the source identifiers and provenance needed for traceability;
- canonical historical journals or an approved representation of their
  historical meaning;
- opening balances where they are supported by reconciled evidence;
- invoices, bills, credit notes, and AR/AP meaning required for the approved
  historical scope;
- payments and payment evidence where the distinction can be preserved;
- allocations, customer credits, supplier prepayments, refunds, bank evidence,
  and reconciliation evidence where supported;
- chart-of-accounts mappings and control-account mappings;
- financial-year and accounting-period evidence;
- VAT records and evidence within DEC-03's authority;
- authoritative source documents required under DEC-17;
- known retention, archival, redaction, anonymisation, disposal, and legal-hold
  state; and
- migration exceptions and approvals.

### Should migrate

Where useful and sufficiently evidenced:

- historical configuration versions and effective dates;
- customer and supplier records needed to explain migrated accounting;
- document relationships and checksums;
- audit history relevant to consequential accounting activity;
- bank and reconciliation detail supporting migrated balances; and
- operational history needed for continuity after cutover.

### May migrate

Only when it has a defined purpose, authority, provenance, and validation
path:

- non-authoritative operational history;
- report-supporting detail that can be deterministically reconciled;
- legacy metadata that improves traceability without changing accounting
  meaning; and
- rebuildable data where migration is more reliable than rebuilding it.

### Do not migrate

- unsupported or unverifiable values as if they were authoritative;
- invented dates, journals, approvals, VAT treatment, configuration,
  allocations, refunds, period closures, or lifecycle events;
- secrets, credentials, or unnecessary personal data;
- cross-company records or relationships;
- raw exports presented as canonical journals without provenance and
  validation;
- caches or derived data whose deterministic rebuild is safer;
- duplicate accounting created only because a source representation is
  unfamiliar; or
- documents or identities that were legitimately disposed of under DEC-18.

### Migration exception

Any required source data that cannot be safely migrated must become an
explicit migration exception. It must not be hidden inside a normal accounting
record or silently discarded.

## 5. Source authority and precedence

Migration must identify the source and authority for every material migrated
fact. No source is automatically authoritative merely because it is a legacy
accounting database or an export.

Recommend the following evidence-led precedence:

1. authoritative source documents and contemporaneous evidence, where
   authentic, complete, and relevant;
2. bank and payment evidence for cash movement and settlement facts;
3. filed or otherwise authoritative VAT records for historical VAT meaning;
4. the legacy accounting system for its recorded journals, balances,
   configuration, approvals, and operational history;
5. reconciled derived reports and exports as representations supporting
   comparison, never as unverified authority; and
6. human explanation or AI suggestion only as contextual evidence or a
   proposed treatment, never as an invented accounting fact.

Where sources disagree:

- preserve the competing source values and provenance;
- determine whether the difference is timing, rounding, presentation,
  transformation, or a genuine conflict;
- obtain an authorised accounting decision where required;
- record the decision and reason; and
- create a migration exception when authority cannot be established.

The migration record must retain the source, extraction context, source
version or timestamp where available, mapping decision, validation outcome,
and unresolved uncertainty.

## 6. Historical accounting representation

Historical migration must preserve, or explicitly qualify:

- journal meaning and direction;
- account identity and classification;
- financial-year assignment;
- accounting-period assignment and known closure state;
- VAT meaning and evidence;
- configuration meaning;
- AR/AP meaning;
- payment and allocation distinctions; and
- source and correction relationships.

If the source contains a historical journal that can be represented under
DEC-04, preserve it with provenance and validation. If it cannot be posted
without inventing facts or violating current controls, preserve the source
evidence and represent the gap as a migration exception rather than
manufacturing a replacement journal.

Historical data must not be silently re-dated into a convenient open period.
Unknown historical configuration must remain unknown unless evidence supports
an explicit version or an authorised approximation labelled as such.

## 7. Chart-of-accounts mapping

Respect DEC-09. Legacy accounts must map by accounting meaning, classification,
usage, and evidence—not by account name or numeric code alone.

Supported mappings may include:

- one-to-one mapping;
- many-to-one mapping where aggregation preserves meaning and is documented;
- historical or inactive account mapping that retains prior identity;
- controlled system-account mapping; and
- an explicit unmappable-account exception.

Do not silently split one legacy account into multiple Ledgerly accounts
without evidence. Do not merge accounts when the merge would lose reporting,
VAT, control, audit, or historical meaning. Used accounts must remain
traceable even if they become inactive after migration.

Mapping decisions should record the legacy identity, target Ledgerly identity,
effective historical scope, rationale, reviewer, and unresolved limitations.

## 8. Control-account mapping

Respect DEC-10. Legacy AR, AP, bank/cash, Output VAT, Input VAT, and VAT
settlement balances must map to compatible Ledgerly protected control-account
roles.

Do not force an incompatible legacy balance into a control account merely to
make a trial balance appear to agree. If the source cannot distinguish a
control balance, preserve the source evidence, identify the limitation, and
create an authorised migration exception.

Control-account validation must cover:

- opening and closing balances;
- related subledger totals;
- source documents;
- payment and allocation relationships;
- VAT evidence; and
- subsequent correction or settlement treatment.

## 9. Configuration versioning

Respect DEC-11. Where historical effective dates, account mappings, tax
settings, numbering rules, or other material configuration are known,
preserve their meaning and provenance.

Where configuration history is incomplete:

- do not invent a version or effective date;
- identify which historical values are affected;
- preserve the source representation;
- record an explicit migration exception; and
- prevent the unknown state from being presented as verified Ledgerly
  configuration.

Current configuration must not be retroactively applied to historical
accounting solely because it is convenient for migration.

## 10. Financial years, periods, and year-end

Respect DEC-06, DEC-07, and DEC-08:

- assign records to financial years using available authoritative evidence;
- assign records to accounting periods using posting dates and source
  evidence;
- preserve known closed or reopened state;
- do not invent period closures, reopen events, or year-end completion;
- do not use reporting-only year-end as an automatic closing journal; and
- create an exception when a historical assignment cannot be established.

Migration must not silently move a historical posting across a financial-year
boundary or closed period to fit the target system. Any approved treatment
that differs from the source must preserve the original evidence and explain
the difference.

## 11. VAT

DEC-03 remains the sole VAT authority. Migration must not create a second VAT
engine or infer historical VAT treatment from a convenient default.

Preserve and reconcile, where evidenced:

- VAT transaction meaning;
- VAT periods;
- VAT return values;
- VAT evidence;
- VAT settlement;
- source rates and classifications; and
- historical VAT configuration.

Where a source VAT record conflicts with an invoice, bill, bank record, or
return, retain the conflict, identify the authoritative evidence, and create a
migration exception if it cannot be resolved. VAT preparation after cutover
must remain based on approved canonical evidence and deterministic rules.

## 12. Payments, allocations, credits, prepayments, and refunds

Respect DEC-12 through DEC-16. Preserve the distinction between:

- bank evidence;
- payment evidence;
- accounting payment;
- allocation;
- settlement;
- customer credit;
- supplier prepayment; and
- refund.

Do not invent an allocation because an amount and date appear to match. Do not
convert an unexplained excess into a fabricated invoice settlement. Where
party and payment evidence support it, represent customer credit or supplier
prepayment under DEC-13; otherwise retain unapplied cash or create an
exception under DEC-14.

Refund history must be supported by evidence and remain distinct from the
original payment and credit/prepayment balance. Migration must not duplicate a
payment merely to make a legacy status appear settled.

## 13. Documents and source evidence

Migrate authoritative invoices, bills, receipts, credit notes, and supporting
documents where required to explain the approved historical accounting scope.

Preserve:

- source identity and provenance;
- company ownership;
- document relationships;
- checksums or equivalent integrity evidence;
- document dates and source dates;
- retention, archival, redaction, anonymisation, disposal, and legal-hold
  state where known; and
- links between documents, journals, payments, allocations, VAT, approvals,
  and corrections.

Do not recreate documents that did not exist in the source. Do not invent
historical disposal events. Do not use migration to restore information
legitimately disposed of under DEC-18.

## 14. Retention and disposal history

Respect DEC-17 and DEC-18. Known historical retention classes, legal holds,
deletion, anonymisation, archival, redaction, and disposal events should be
preserved with evidence and provenance.

Where evidence is absent:

- do not invent the event;
- record the missing evidence;
- preserve the current authoritative state where known; and
- create a migration exception for unresolved historical lifecycle meaning.

Migration must not extend retention by silently creating a new authoritative
copy of data that should have been disposed of. It must also not destroy
required accounting evidence to simplify migration.

## 15. Exports and migration source material

Respect DEC-19. A source export may support extraction, comparison, mapping,
or migration preparation, but:

- an export is a representation, not accounting authority;
- a Ledgerly export is not automatically authoritative over the underlying
  source;
- export filters must not remove required provenance or create false
  completeness;
- exported documents and personal data remain subject to their lifecycle
  state; and
- migration must retain sufficient source context to explain what the export
  represented at extraction time.

Do not use a user-facing export as a substitute for a verified migration
checkpoint or DEC-20 backup.

## 16. Backup, recovery, and rollback checkpoints

Respect DEC-20. Before each material extraction, transformation, cohort
cutover, or controlled promotion:

- create a verified recovery checkpoint appropriate to the scope;
- record the source state, target state, time, company scope, and reason;
- validate restoration of the checkpoint where required; and
- define the rollback or recovery decision point before proceeding.

Recovery safeguards do not decide migration authority. A restored checkpoint
must preserve source evidence, canonical accounting, company boundaries,
configuration, audit, and lifecycle state. Restoring an old state must not be
used to erase a post-cutover accounting error.

## 17. Tenant isolation and security

Respect DEC-21. Migration must never:

- merge companies accidentally;
- assign a record to the wrong company;
- move documents or bank evidence across companies;
- merge users or memberships into shared authority;
- use one company's configuration for another;
- leak AI context or migration suggestions across companies; or
- create cross-company relationships to resolve an ambiguous mapping.

Migration is high risk and should use:

- least privilege;
- elevated DEC-05 capability for consequential actions;
- explicit approval;
- separation of duties;
- encrypted transfer;
- temporary, scoped credentials;
- protected source access;
- immutable audit evidence; and
- company-scoped validation and exception handling.

AI may assist with classification, mapping suggestions, anomaly detection,
document interpretation, and exception explanation. AI must not determine
authoritative accounting, invent missing facts, bypass deterministic rules, or
approve consequential migration decisions without the required human authority.

## 18. Validation before cutover

No cohort may cut over until validation is complete, reviewed, and recorded.
Validation should include:

- company counts and ownership;
- journal and journal-line counts;
- trial balance agreement;
- balance-sheet agreement;
- profit-and-loss agreement;
- AR agreement;
- AP agreement;
- bank and cash agreement;
- VAT agreement;
- customer and supplier balances;
- payment, allocation, credit, prepayment, refund, and settlement agreement;
- control-account agreement;
- financial-year and accounting-period agreement;
- chart and configuration mapping;
- document counts, relationships, and integrity;
- audit and approval continuity;
- retention/disposal and legal-hold state; and
- migration-exception counts and materiality.

The default acceptance rule should be **no unexplained material accounting
difference**. Rounding, timing, presentation, unsupported legacy features,
and source-precision differences may be accepted only when documented,
reconciled, approved, and recorded as exceptions where appropriate.

Counts alone are not sufficient. Totals can agree while source links,
allocations, VAT meaning, period state, or company ownership is wrong.

## 19. Reconciliation

Reconcile Ledgerly against authoritative source evidence, not only against a
previous export or transformed intermediate.

Classify each difference as:

- exact match;
- expected presentation or precision difference;
- timing difference with evidence;
- unsupported legacy feature;
- missing evidence;
- mapping difference;
- duplicate or missing record; or
- genuine unexplained discrepancy.

Every unresolved material difference must become an explicit migration
exception with a decision, authority, reason, residual uncertainty, and
post-cutover owner. No unexplained accounting difference may be silently
accepted as a successful migration.

## 20. Migration exceptions

The migration process must maintain a formal, company-scoped exception record
containing, as appropriate:

- company;
- source system and source record;
- extraction and source version;
- issue and missing evidence;
- affected accounting, VAT, document, or lifecycle meaning;
- proposed treatment;
- decision and decision authority;
- reason;
- timestamp;
- approval;
- resolution;
- residual uncertainty;
- post-cutover action; and
- links to supporting evidence.

Exceptions must be auditable, reportable, and distinguishable from ordinary
accounting. An exception cannot silently become a fabricated journal,
allocation, VAT value, period state, or approval.

## 21. Cutover

Recommend a controlled cohort cutover:

1. define the company cohort and scope;
2. freeze or otherwise control source-system activity;
3. take the verified DEC-20 recovery checkpoint;
4. perform the final extraction and transformation;
5. validate mappings, balances, evidence, exceptions, and company scope;
6. complete final reconciliation and obtain authorised sign-off;
7. activate Ledgerly for the cohort;
8. make Ledgerly's canonical posted journals the sole reporting authority;
9. retain the legacy system in an explicitly governed state; and
10. monitor and resolve migration exceptions during the post-cutover period.

After cutover, the legacy system must not silently continue as a competing
accounting authority. Dual-read comparison may continue for a bounded,
audited validation period, but it must not create permanent dual reporting
authority.

## 22. Legacy-system authority

The post-cutover state must be explicit. Depending on evidence and retention
requirements, the legacy system may be:

- read-only historical authority for source evidence;
- a retained evidence source;
- an archived system;
- a bounded comparison source during validation; or
- decommissioned only after approved retention and evidence requirements are
  satisfied.

The legacy system must not be destroyed, rewritten, or made inaccessible
prematurely. Its post-cutover authority must not conflict with Ledgerly's
canonical reporting authority.

## 23. Rollback

Rollback differs before and after Ledgerly becomes authoritative.

### Before cutover

Failed extraction, transformation, mapping, or validation may be abandoned,
re-run, or restored to the pre-migration checkpoint without changing
authoritative Ledgerly accounting.

### During controlled cutover

Pause the cohort, preserve both source and target evidence, use the verified
checkpoint, and require explicit authority to continue, recover, or abandon
the cutover.

### After cutover

Rollback must not be used casually to erase canonical journals, VAT history,
period assignments, or approved activity. A material accounting discrepancy
must use the DEC-04 correction/reversal process. A service or deployment
rollback may be possible if it preserves canonical accounting and audit
meaning.

Any recovery or promotion after cutover must record the recovery point,
affected companies, validation, discrepancy, decision authority, and
reconciliation outcome.

## 24. Post-cutover controls

Recommend a bounded post-cutover period with:

- enhanced reconciliation and monitoring;
- migration-exception review and ownership;
- source and target comparison;
- confirmation of canonical reporting authority;
- legacy read-only access where required;
- audit review;
- user or accountant confirmation;
- accounting sign-off; and
- a recorded decision to end comparison or extend it for a defined reason.

Post-cutover monitoring must not create an indefinite dual-authority model.
New Ledgerly activity must follow approved canonical posting and correction
controls.

## 25. Options

### Option A — Destructive replacement

Replace or transform the legacy data directly into the target model.

- **Accounting completeness:** Potentially simple in the final state, but high
  risk of losing source meaning, provenance, exceptions, and historical
  configuration.
- **Complexity:** Lower apparent infrastructure complexity; high hidden
  reconciliation and recovery complexity.
- **Risk:** Highest risk of irreversible data loss, invented certainty,
  cross-company mistakes, and rewritten history.
- **Auditability:** Weak unless a complete immutable source record is retained
  separately.
- **Migration time:** May appear fast but difficult to validate safely.
- **User experience:** Disruptive if errors are discovered after replacement.
- **Reporting continuity:** Risk of broken historical comparisons and
  unexplained changes.
- **Reconciliation:** Difficult because the source may no longer be available
  in its original state.
- **Rollback:** Dangerous after replacement; may require destructive restore.
- **Legacy dependency:** Reduced quickly, but evidence may be lost.
- **Future flexibility:** Poor for additional source formats and later audit.

### Option B — Validated additive adapters with controlled cutover

Preserve source data, map it into canonical structures through versioned
adapters, compare source and target, migrate controlled cohorts, and make
canonical posted journals the sole reporting authority after cutover.

- **Accounting completeness:** Strongest balance between historical meaning,
  canonical authority, and explicit uncertainty.
- **Complexity:** Moderate to high, with visible mapping, validation, and
  exception work.
- **Risk:** Lower and bounded by cohort checkpoints, source preservation, and
  controlled promotion.
- **Auditability:** Strong; provenance, mappings, approvals, comparisons, and
  exceptions can be retained.
- **Migration time:** Slower than destructive replacement but measurable and
  repeatable.
- **User experience:** Allows controlled cohorts and clearer readiness signals.
- **Reporting continuity:** Supports dual-read comparison without permanent
  dual authority.
- **Reconciliation:** Strong; source and target can be compared before
  authority changes.
- **Rollback:** Safe checkpoints before cutover and controlled recovery after
  cutover without rewriting accounting.
- **Legacy dependency:** Retained temporarily as read-only evidence or
  comparison source.
- **Future flexibility:** Strong for additional source shapes, evidence gaps,
  and future migration cohorts.

### Option C — Permanent dual authorities

Keep the legacy system and Ledgerly as ongoing accounting or reporting
authorities.

- **Accounting completeness:** Ambiguous; duplicate posting and divergent
  balances become likely.
- **Complexity:** Highest ongoing operational and reconciliation burden.
- **Risk:** Persistent risk of conflicting journals, VAT, periods,
  allocations, and corrections.
- **Auditability:** Difficult to establish which system is authoritative.
- **Migration time:** Avoids a single cutover but never completes the
  authority transition.
- **User experience:** Confusing workflows and competing reports.
- **Reporting continuity:** Comparisons may become permanent disputes.
- **Reconciliation:** Continuous rather than bounded.
- **Rollback:** Ambiguous because authority never clearly changes.
- **Legacy dependency:** Permanent and costly.
- **Future flexibility:** Constrains canonical design and future sources.

## 26. Approved policy

DEC-22 approves **Option B: validated additive adapters with controlled
cohort/source cutover**, with these policy requirements:

1. Preserve source data, evidence, provenance, and company ownership before
   transformation.
2. Define supported legacy shapes, source systems, mapping contracts, and
   migration cohorts before migration.
3. Use additive canonical structures and versioned adapters rather than
   destructive replacement.
4. Keep canonical Ledgerly journals as the only reporting authority after
   cutover.
5. Use bounded dual-read comparison for validation only; never establish
   permanent dual authorities.
6. Require pre-migration and pre-cutover DEC-20 recovery checkpoints,
   restoration validation, and explicit rollback criteria.
7. Require accounting, VAT, period, configuration, control-account,
   payment/allocation, document, audit, retention/disposal, and
   company-isolation validation.
8. Require no unexplained material accounting differences before cutover.
9. Make ambiguity and missing evidence visible through formal, auditable
   migration exceptions.
10. Preserve distinctions between evidence, journals, payments, allocations,
    settlement, credits, prepayments, refunds, VAT, and reconciliation.
11. Require elevated authority, approval, separation of duties, encrypted
    transfer, scoped credentials, and immutable migration audit evidence.
12. Keep AI advisory only for classification, mapping suggestions, anomaly
    detection, document interpretation, and exception explanation.
13. Use a controlled cohort freeze, final extraction, final validation,
    authorised sign-off, Ledgerly activation, and bounded post-cutover
    monitoring.
14. Retain the legacy system as read-only evidence or a bounded comparison
    source until retention and audit requirements allow an approved later
    disposition.
15. Resolve post-cutover accounting discrepancies through DEC-04 corrections
    and reversals, not casual rollback or historical rewriting.

This approved policy satisfies DEC-01 through DEC-21 while keeping
source authority, historical uncertainty, accounting integrity, tenant
isolation, backup safeguards, and future migration flexibility explicit.

This is a **policy approval only**, not implementation authority.

## 27. Decision boundaries

### Already decided

DEC-01 through DEC-21, including canonical immutable accounting, company
capabilities, financial-year and period policy, chart and control mappings,
configuration versioning, VAT authority, payment/allocation distinctions,
retention and disposal, bounded exports, backup/recovery policy, and tenant
isolation.

### Recommended

Validated additive adapters with preserved source evidence, controlled cohorts,
dual-read comparison for a bounded validation period, visible migration
exceptions, DEC-20 recovery checkpoints, explicit reconciliation, and
canonical Ledgerly journals as the sole reporting authority after cutover.

### Approved

DEC-22 approves the historical accounting-data compatibility and cutover
policy, including supported sources and shapes, migration scope, source
authority, mapping, validation, reconciliation, exceptions, cohort
sequencing, cutover, rollback, legacy authority, and post-cutover controls.

### Deliberately left open

- exact source systems and supported legacy shapes;
- adapter and mapping implementation;
- migration cohort membership and sequencing;
- exact technical schema, APIs, queues, tooling, and storage;
- operational staffing and sign-off roles;
- exact validation reports and presentation;
- detailed legacy retention and later disposition;
- exact rollback infrastructure and recovery runbooks;
- provider, region, and infrastructure choices;
- future multi-company or intercompany capabilities;
- source freshness/posting safety; and
- implementation tasks, tests, dependencies, deployment, and publishing.

### What DEC-22 approval locks in

- migration is evidence-led transformation, not historical rewriting;
- unsupported or conflicting facts become explicit exceptions;
- source provenance and company ownership are preserved;
- additive adapters and controlled cohorts are preferred over destructive
  replacement;
- canonical Ledgerly journals become the sole reporting authority after
  cutover;
- dual-read comparison is temporary and never permanent dual authority;
- cutover requires recovery checkpoints, validation, reconciliation, approval,
  and explicit rollback criteria;
- post-cutover accounting discrepancies use controlled DEC-04 corrections;
- legacy authority is transitioned explicitly and not destroyed prematurely;
- AI remains advisory and cannot invent or approve accounting facts; and
- tenant isolation, retention, disposal, export, and backup boundaries remain
  in force.

### What remains changeable

Source connectors, supported shapes, adapters, mapping rules, cohort
sequencing, reconciliation tooling, technical schema, exact reports, user
experience, staffing, recovery mechanics, legacy retention duration, and
implementation design.

## 28. Important principle

Migration must never invent accounting history.

Where evidence exists, preserve it. Where evidence is incomplete, identify the
gap. Where evidence conflicts, reconcile it. Where uncertainty remains,
record the exception. Never silently manufacture certainty.

## 29. Final governance boundary

DEC-22 is the final governance decision in this sequence. Its approval
completes the policy layer only. It does not automatically authorise
migration execution, schema changes, adapters, infrastructure work, or
deployment.

After this approval:

- governance is complete;
- implementation planning must begin separately;
- implementation tasks must be explicitly approved;
- architecture must be validated against all approved decisions; and
- migration must be designed, tested, and authorised before execution.

No DEC-23 decision is created by this review.

## 30. Approved policy boundary

DEC-22 is approved. It does not authorise implementation:

- BL-06 and BL-07 remain **BLOCKED**;
- no migration, cutover, schema, accounting, application, UI, workflow,
  dependency, infrastructure, deployment, or publishing implementation may
  begin;
- no implementation task is authorised; and
- source freshness remains separately unresolved unless DEC-22 explicitly
  governs it.

**DEC-01 through DEC-22:** **APPROVED**
**BL-06 / BL-07:** **BLOCKED**
**Application code changed by this approval:** **NO**
**Database or migrations changed by this approval:** **NO**
**DEC-23 created:** **NO**