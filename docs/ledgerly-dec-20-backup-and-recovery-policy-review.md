# DEC-20 — Backup and Recovery Policy

**Decision:** DEC-20 — Backup and recovery objectives
**Scope:** Backup and recovery policy
**Status:** **APPROVED — product/operational resilience policy only**
**Review date:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting, security,
reliability, privacy, and architecture review
**Implementation authority:** None

> This records an approved product/operational resilience policy. It does not
> approve DEC-21 through DEC-22, and it does not authorise an implementation task, code, schema,
> migration, accounting logic, UI, workflow, dependency, deployment,
> infrastructure configuration, or publishing work.

## 1. Exact registered question

The Current Decision Register defines DEC-20 as:

> **Backup and recovery objectives:** Set recovery point objective, recovery
> time objective, backup retention, restore-test frequency, and
> regional/operational recovery needs.

The registered options are:

1. provider defaults;
2. managed daily backups or point-in-time recovery; or
3. managed backups plus tested restore and regional recovery.

The registered recommendation is:

> Encrypted managed backups, point-in-time recovery where available,
> documented retention, explicit RPO/RTO, and tested restores.

This review records that policy without authorising its implementation.

## 2. Purpose and core principles

Backups are a resilience mechanism for restoring service and data
availability. They are not:

- an accounting authority;
- a user-facing export;
- a substitute for canonical accounting;
- a migration strategy;
- a legal archive by default; or
- a mechanism for rewriting accounting history.

Every backup and recovery policy must:

- protect authoritative accounting and evidence;
- distinguish authoritative data from derived or rebuildable data;
- define realistic RPO and RTO targets;
- support recovery from corruption, accidental change, infrastructure failure,
  and regional or security incidents;
- preserve DEC-04 immutability and the ordering of accounting events;
- respect DEC-17 retention and DEC-18 disposal;
- remain distinct from DEC-19 exports;
- use company-scoped recovery access;
- provide tested, auditable recovery procedures; and
- leave room for DEC-21 tenant isolation and DEC-22 migration policy.

Recovery is for restoring an authorised historical system state or service
availability. If an accounting error exists, use the approved correction or
reversal process rather than restoring an older state to erase it.

## 3. Constraints from DEC-01 through DEC-19

### Already decided

- **DEC-01:** Governance follows the approved hierarchy and no policy record
  authorises implementation by itself.
- **DEC-02 and DEC-03:** The initial product is UK/GBP-oriented, with
  source-linked VAT preparation and no direct HMRC submission.
- **DEC-04:** Canonical accounting is balanced, server-generated,
  source-linked, idempotent, append-only, immutable, and corrected through
  controlled reversals or replacement entries.
- **DEC-05:** Capabilities are company-scoped and enforced server-side.
  High-risk recovery authority cannot rely on a frontend or arbitrary role
  string.
- **DEC-06 through DEC-08:** Financial years, accounting periods, closed
  periods, and reporting-only year-end must remain historically meaningful.
- **DEC-09 and DEC-10:** Stable account identities and protected control
  mappings must survive recovery with their historical interpretation.
- **DEC-11:** Effective-dated configuration and resolved posting context must
  remain available to explain historical journals.
- **DEC-12 through DEC-15:** Payment, allocation, settlement, credits,
  prepayments, unapplied cash, refunds, VAT, and reconciliation evidence must
  remain distinct and non-duplicating.
- **DEC-16:** Payment-on-account is not a separate launch accounting model.
- **DEC-17:** Authoritative evidence is retained for company life plus the
  applicable legal/regulatory period, with separate data classes.
- **DEC-18:** Disposal is controlled and class-based; canonical accounting
  cannot be mutated, legal holds override disposal, and archived or disposed
  state must not be silently bypassed.
- **DEC-19:** Exports are authorised copies, not backups or accounting
  authority, and must remain company-scoped and auditable.

### Consequences for recovery

Recovery must preserve, or explicitly account for, the relationship between:

- source evidence and posted journals;
- journal order and idempotency;
- financial year and accounting period;
- current and historical configuration;
- payments, allocations, settlement, credits, prepayments, refunds, VAT, and
  reconciliation;
- approvals, corrections, and audit history; and
- retention, disposal, and legal-hold state.

A database byte-level restore is not sufficient if it produces duplicate
posting, missing journal lines, broken audit relationships, stale
configuration, or cross-company exposure.

## 4. Backup scope

### Authoritative data that must be protected

Backups must cover, where present:

- canonical journal headers and lines;
- source links and source versions;
- invoices, bills, credit notes, and their accounting relationships;
- payments, allocations, settlement evidence, customer credits, supplier
  prepayments, and refunds;
- bank evidence and reconciliation decisions;
- VAT evidence and relevant calculation inputs;
- approvals, corrections, reversals, and audit events;
- chart of accounts and control mappings;
- effective-dated accounting configuration;
- financial years, periods, close/reopen state, and document numbering;
- customers, suppliers, company settings, and business records required to
  interpret accounting;
- authoritative accounting documents and object-storage metadata;
- retention classes, disposal state, redaction/anonymisation markers, and
  legal-hold state; and
- system configuration required to restore a compatible service and interpret
  the data.

### Derived or rebuildable data

The policy need not treat every cache or presentation layer as authoritative.
Derived data may be rebuilt from protected sources when the rebuild is
deterministic and verified, including where appropriate:

- report caches;
- search indexes;
- temporary export packages;
- transient queues whose source event remains protected;
- denormalised read models; and
- non-authoritative analytics aggregates.

Rebuildable data must not be excluded if its loss would prevent recovery
within the approved RTO or would make a deterministic rebuild impossible.

### Documents and object storage

Documents that form authoritative accounting evidence require backup or
equivalent durable protection. Document metadata, checksums, relationships,
retention state, and disposal markers must be recoverable with the document
state they describe.

Object-storage backup must not be assumed merely because a database row
contains a document reference.

## 5. Approved backup model

Use a layered approach:

1. **Managed encrypted database snapshots:** scheduled full or provider
   equivalent snapshots for complete recovery points.
2. **Incremental or differential protection:** used where supported to reduce
   backup windows and recovery-point gaps.
3. **Transaction-log/WAL capture:** continuous or frequent log protection where
   available, enabling point-in-time recovery.
4. **Document/object-storage protection:** versioning, durable copies, or an
   equivalent managed mechanism for authoritative documents and metadata.
5. **Configuration and recovery metadata protection:** preserve the
   information needed to select a compatible restore target and validate
   accounting integrity.
6. **Separate administrative boundary:** backup access and credentials are
   separate from ordinary application access.

Provider defaults may be a starting mechanism but are not a complete policy.
The selected service must document coverage, retention, encryption, restore
limits, region behaviour, verification, and failure escalation.

## 6. Recovery objectives

RPO and RTO are targets for planning and service measurement, not a promise
that every incident will meet them.

### Approved target objectives

#### Tier 1 — Canonical accounting and critical control data

Includes journals, posting state, periods, configuration, approvals, audit
relationships, and data required to prevent duplicate or missing accounting.

Target objective:

- **RPO:** no more than one hour under normal managed-service operation, with
  a tighter target considered only if supported by verified infrastructure.
- **RTO:** service or scoped recovery available within four hours after the
  recovery decision, subject to incident scope and validation.

#### Tier 2 — Operational records and reconciliation data

Includes invoices, bills, payments, allocations, credits, prepayments,
refunds, bank evidence, reconciliation, parties, and operational metadata.

Target objective:

- **RPO:** no more than four hours;
- **RTO:** within eight hours for a scoped recovery after the recovery
  decision.

Operational data that affects canonical accounting should be treated as Tier 1
for the relevant relationship.

#### Tier 3 — Authoritative documents

Includes invoices, bills, receipts, credit notes, and supporting documents
required for accounting, VAT, reconciliation, or audit.

Target objective:

- **RPO:** no more than twenty-four hours where object-storage constraints
  require a different tier;
- **RTO:** within twenty-four hours, or within the stricter target of the
  related accounting recovery.

#### Tier 4 — Derived and rebuildable data

Target objective:

- best effort within twenty-four hours;
- no independent RPO where deterministic rebuild from protected sources is
  verified; and
- no effect on accounting correctness or retention obligations.

These are approved policy targets, subject to operational validation against
the selected provider, product availability objective, company size, document
volume, and operating model. They are not guaranteed service-level
commitments.

## 7. Point-in-time recovery

Support point-in-time recovery where the managed data service supports it and
where it is operationally appropriate. It is valuable for:

- accidental destructive changes;
- corruption;
- failed deployments or data jobs;
- infrastructure failures;
- integrity incidents; and
- recovery to a known state before a harmful event.

Point-in-time recovery must:

- identify the requested recovery point and reason;
- restore into a separate recovery environment by default;
- preserve journal ordering, idempotency, periods, configuration, and audit
  relationships;
- validate the recovered state before any controlled promotion;
- never silently overwrite live accounting; and
- never become a normal accounting correction mechanism.

The recovered state is an authorised historical system state for incident
recovery. If it differs from live state, the discrepancy must be investigated,
recorded, and resolved through controlled accounting or operational procedures.

## 8. Restoration model

Use two restoration paths:

### Scoped recovery

Restore the affected company or bounded data scope into an isolated recovery
environment where technically safe. Validate:

- company scope;
- journal balance and ordering;
- source and correction relationships;
- periods and configuration;
- payment/allocation/settlement relationships;
- VAT and reconciliation evidence;
- retention, disposal, and legal-hold state; and
- document availability and checksums.

### Whole-service recovery

Use for infrastructure, region, storage, or security incidents affecting
multiple companies or the service itself. Restore the service to a controlled
environment, validate tenant boundaries and canonical data, then promote
through an authorised incident process.

### No silent live overwrite

Restoring over live production without a recovery assessment and approval is
not permitted. If a controlled promotion is necessary, record:

- the recovery point;
- affected companies and systems;
- the reason;
- validation results;
- discrepancies;
- approval and capability;
- promotion time; and
- follow-up correction or reconciliation actions.

## 9. Accounting immutability and discrepancy handling

Backups must preserve:

- immutable posted journals;
- source links and source versions;
- approvals;
- reversals and corrections;
- VAT and reconciliation history;
- payment, allocation, credit, prepayment, settlement, and refund evidence;
- financial-year and accounting-period assignment; and
- closed-period meaning.

Recovery must not be used to:

- delete posted journals;
- rewrite history;
- alter historical VAT;
- change AR/AP history;
- change financial-year assignment;
- reopen or reinterpret a closed period; or
- erase an accounting error.

If recovered data and live data disagree:

1. freeze or constrain affected consequential actions;
2. preserve both the recovery evidence and live evidence;
3. compare canonical journals and source versions;
4. identify duplicate, missing, or out-of-order events;
5. record an incident and reconciliation result;
6. use approved reversal, correction, or replacement entries where accounting
   action is required; and
7. obtain the necessary DEC-05 capability and approval.

Do not silently choose whichever database state produces the most convenient
balance.

## 10. Retention, disposal, and legal holds

Backup retention is distinct from production-data retention. It should be
long enough to support the approved RPO/RTO and recovery scenarios, but it
must not automatically become an indefinite accounting archive.

Approved retention principles:

- document backup schedules and expiry by backup tier;
- retain at least one verified recovery path for each period required by the
  approved operational policy;
- ensure backup expiry cannot remove the only available copy before
  authoritative retention obligations are satisfied;
- apply DEC-18 disposal state when restored data is made available;
- do not use a backup to recreate data legitimately disposed of under DEC-18;
- handle legal holds explicitly when they affect recovery or restoration; and
- keep backup retention, production retention, export availability, and legal
  hold state distinguishable.

A backup may contain an older representation of personal data after a
production anonymisation or deletion. The detailed propagation, expiry, and
restore treatment requires an approved operational policy and must not be
assumed to be solved by silently mutating immutable backup media.

## 11. Security

The policy requires these minimum controls:

- encryption at rest;
- encryption in transit;
- separate backup credentials and administrative access;
- least-privilege, server-side recovery authority;
- separation of backup administration from ordinary application operation;
- protected key management and key-rotation procedures;
- immutable or WORM protection where appropriate for recovery integrity;
- integrity checks, checksums, and tamper detection;
- restricted recovery environments;
- secure handling of restored personal and financial data;
- no credentials or secrets in backup exports or ordinary user downloads; and
- incident response for backup access or recovery misuse.

Backup encryption must not make recovery impossible. Key availability,
rotation, escrow, and emergency access require documented operational
ownership.

## 12. Company scope and tenant isolation

DEC-21 owns detailed tenant-isolation policy. DEC-20 nevertheless requires:

- recovery requests to identify the company or service scope;
- scoped restores to prevent data from being exposed to another company;
- whole-service restores to validate tenant boundaries before access is
  reopened;
- recovery operators to receive only the minimum necessary access;
- restored files and environments to retain company labels and controls; and
- audit events to identify the company scope and any multi-company recovery.

System-level backups may contain multiple companies where the provider
requires it, but that does not grant an operator or user unrestricted access
to every company's recovered data.

## 13. Exports and portability

DEC-19 exports and DEC-20 backups serve different purposes:

- an **export** is an authorised, user-facing copy or representation;
- a **backup** is protected resilience infrastructure.

Do not use exports as the primary backup mechanism. Do not expose raw backups
as ordinary exports. Do not describe a successful export as proof that
recovery is possible.

An export may support a user-led migration or review, while a backup supports
service recovery. Neither changes the authority of canonical journals.

## 14. Migration and cutover

DEC-22 owns migration and cutover policy. DEC-20 should support migration
safety without deciding migration authority:

- create a verified pre-cutover recovery point;
- preserve legacy evidence before transformation;
- record the checkpoint, time, scope, and validation result;
- define a rollback point before a consequential cutover;
- test restoration of the checkpoint in an isolated environment;
- ensure recovery does not overwrite the source of truth without DEC-22
  authority; and
- preserve gaps, mismatches, and missing evidence rather than hiding them.

No recovery checkpoint should be treated as approval to migrate, cut over, or
retire a legacy system.

## 15. Disaster-recovery scenarios

### Database corruption or integrity failure

Use point-in-time or snapshot recovery into isolation, validate accounting
invariants and source relationships, and reconcile before promotion.

### Accidental destructive change

Use the nearest safe recovery point or scoped restoration, preserve evidence of
the destructive action, and do not turn recovery into a deletion-history
rewrite.

### Infrastructure or storage failure

Use managed restore and infrastructure rebuild from protected configuration,
then validate documents, journals, audit, and company boundaries.

### Region or provider failure

Use a documented regional recovery option where the selected service supports
it. The fallback target, data currency, and expected RPO/RTO must be known.

### Security incident

Treat backups as potentially sensitive. Isolate compromised credentials,
preserve forensic evidence, select a trusted recovery point, rotate access,
and validate restored data before reopening consequential operations.

### Deployment or data-job failure

Use point-in-time recovery only when it is safer than a controlled correction.
Preserve the deployment/job evidence and identify any records created after
the recovery point that require reconciliation.

## 16. Backup verification and recovery testing

The policy expects:

- automated success and integrity verification for every backup cycle;
- periodic checksum, completeness, and readability checks;
- a documented restore test at least quarterly for representative company
  data;
- an annual whole-service or regional recovery exercise where the selected
  infrastructure supports it;
- testing of authoritative documents and object storage, not only database
  rows;
- validation of journals, balances, periods, configuration, audit, retention,
  disposal, and company scope after restore;
- recorded test results, failures, corrective actions, and retest outcomes;
  and
- testing of recovery procedures by someone other than the person who created
  the backup where practical.

A green backup job without a verified restore is not sufficient evidence of
recoverability.

## 17. Failure handling and escalation

When a backup, verification, or recovery fails:

- record the failure and affected scope;
- alert the responsible operational owner;
- determine whether the approved RPO/RTO is at risk;
- protect the last known good recovery point;
- retry only under bounded and auditable rules;
- use an alternate backup or recovery path where available;
- escalate before the recovery objective is missed;
- identify affected companies without exposing unrelated data; and
- record the final outcome and follow-up action.

If point-in-time recovery is unavailable, do not claim the target was met.
Use the nearest verified recovery point, identify the gap, and reconcile
affected accounting and operational activity explicitly.

## 18. Audit requirements

Retain immutable audit evidence for:

- backup creation and completion;
- backup coverage and retention class;
- verification and integrity checks;
- failed backups and escalations;
- restore-test execution and result;
- recovery-point selection;
- recovery initiation, approval, and execution;
- scoped or whole-service restoration;
- promotion or controlled overwrite, if ever authorised;
- backup expiry or deletion;
- legal holds affecting backup lifecycle;
- restored disposal/redaction/anonymisation state;
- recovery discrepancies and reconciliation; and
- disaster-recovery exercises.

Each consequential event should identify actor or service, company scope,
backup/recovery scope, timestamp, reason, recovery point, result, affected
policy, and resulting state. Audit evidence must remain protected under
DEC-17 and DEC-18.

## 19. Permissions and user experience

Use DEC-05 server-side capabilities:

- normal users may see company-level backup health or recovery readiness
  appropriate to their authority;
- viewing detailed backup contents is restricted;
- initiating a high-risk recovery requires elevated capability;
- approving recovery uses appropriate separation of duties;
- performing restoration is restricted to specialised operational authority;
- overriding normal recovery controls requires exceptional authority,
  approval, and audit; and
- no recovery operation bypasses company scope or audit requirements.

Ordinary users should see clear health, incident, and recovery-status
messages, not provider credentials, topology, raw backup identifiers, or
infrastructure internals. Recovery incidents should explain whether data may
be stale and what user actions are temporarily restricted.

## 20. Options

### Option A — Provider defaults

- **Accounting:** May not protect journal ordering, source links, periods, or
  idempotency to the required standard.
- **Data/schema:** Minimal policy work but unknown coverage and restore
  semantics.
- **Migration:** Weak checkpoint and rollback evidence.
- **Reporting:** Risk of incomplete reports after recovery.
- **Security/privacy:** Provider controls may be insufficiently understood;
  access and region boundaries may be unclear.
- **Operations:** Lowest planning burden but poor visibility and escalation.
- **UX:** Simple until an incident exposes missing guarantees.
- **Compatibility:** Provider changes may silently alter recovery behaviour.
- **Future flexibility:** Difficult to compare or improve targets.

### Option B — Managed daily backups or point-in-time recovery

- **Accounting:** Better protection, but coverage and restore tests may still
  be incomplete.
- **Data/schema:** Requires documented scope, retention, and recovery metadata.
- **Migration:** Provides useful checkpoints but may not support regional
  recovery or full-service drills.
- **Reporting:** More predictable than provider defaults.
- **Security/privacy:** Managed encryption and access controls can be reviewed,
  but backup copies remain sensitive.
- **Operations:** Moderate burden with limited resilience depth.
- **UX:** Clearer health and incident messaging.
- **Compatibility:** Depends on provider-specific capabilities.
- **Future flexibility:** Can evolve into tested multi-tier recovery.

### Option C — Managed, encrypted, tested recovery with explicit objectives

- **Accounting:** Best protects canonical history, ordering, immutability,
  source relationships, and discrepancy handling.
- **Data/schema:** Requires explicit coverage, backup classes, recovery
  metadata, and validation.
- **Migration:** Supports verified pre-cutover checkpoints without deciding
  migration authority.
- **Reporting:** Preserves report consistency after validated recovery.
- **Security/privacy:** Supports encryption, separate credentials,
  administrative separation, holds, and controlled restored-data access.
- **Operations:** Highest preparation and testing burden, but measurable
  recovery readiness and escalation.
- **UX:** Simple status and incident experience backed by reliable procedures.
- **Compatibility:** Requires documented provider and contract assumptions,
  but avoids silent dependence on defaults.
- **Future flexibility:** Supports regional recovery, improved objectives,
  additional tiers, and new markets.

### Option D — User exports as the recovery mechanism

- **Accounting:** Risks incomplete relationships, stale data, and loss of
  authoritative recovery context.
- **Data/schema:** Places backup semantics into export contracts and user
  workflows.
- **Migration:** Confuses portability with rollback and recovery authority.
- **Reporting:** Cannot reliably restore service or internal state.
- **Security/privacy:** Broad user-visible copies expand exposure.
- **Operations:** No dependable infrastructure recovery path.
- **UX:** Misleadingly simple and burdensome during an incident.
- **Compatibility:** Depends on report and export formats rather than
  recoverable system state.
- **Future flexibility:** Blocks robust disaster recovery.

## 21. APPROVED POLICY

Approve **Option C: managed, encrypted, tested recovery with explicit
objectives**:

1. Protect canonical accounting, operational records, authoritative documents,
   configuration, audit, retention/disposal state, and recovery metadata.
2. Use managed encrypted snapshots plus incremental or differential protection,
   transaction-log/WAL capture and point-in-time recovery where available.
3. Set and measure approved tiered targets:
   - Tier 1 accounting/control data: RPO no more than one hour and RTO within
     four hours;
   - Tier 2 operational data: RPO no more than four hours and RTO within eight
     hours;
   - Tier 3 authoritative documents: RPO no more than twenty-four hours and
     RTO within twenty-four hours, or the stricter related accounting target;
   - Tier 4 rebuildable data: best effort, rebuilt from protected sources.
4. Restore into an isolated recovery environment by default; never silently
   overwrite live accounting.
5. Validate journal balance, ordering, idempotency, source links, periods,
   configuration, VAT, payment/allocation/settlement, audit, document, hold,
   disposal, and company-scope integrity before promotion.
6. Keep backup retention separate from production retention, while ensuring
   backup expiry cannot remove the only required copy and restored state
   respects DEC-17 and DEC-18.
7. Use encryption, separate credentials, administrative separation,
   integrity verification, restricted recovery access, and company-scoped
   server-side capabilities.
8. Verify every backup cycle and conduct at least quarterly representative
   restore tests plus an annual whole-service or regional exercise where
   supported.
9. Record immutable audit evidence for backup, verification, retention,
   expiry, legal holds, restore tests, recovery, discrepancies, and recovery
   decisions.
10. Keep exports separate from backups and retain DEC-21 and DEC-22 within
    their registered boundaries.

The RPO/RTO values above are approved policy targets, not an implementation
commitment or guaranteed service-level commitment. They require operational
validation before implementation.

This policy is approved as a product/operational resilience policy only.

## 22. Decision boundaries

### Already decided

DEC-01 through DEC-19, including immutable canonical accounting, server-side
capabilities, effective-dated configuration, source-linked VAT and
reconciliation, payment/allocation/settlement history, class-based retention,
controlled disposal, and exports as distinct user-facing representations.

### Approved policy

Managed encrypted backups with layered snapshots and log/PITR capability where
available, explicit tiered RPO/RTO, isolated validated restoration, separate
backup retention, strong security, company-scoped recovery, and tested
procedures.

### Requires user decision

Managed encrypted backups with layered snapshots and log/PITR capability where
available, explicit target RPO/RTO, isolated validated restoration, separate
backup retention, appropriate security, company-scoped recovery, and tested
procedures, as set out in section 21.

### Deliberately left open

- provider and region selection;
- exact backup schedules and backup-retention durations;
- exact RPO/RTO commitments after operational validation;
- multi-region or cross-region recovery design;
- detailed key management and credential operations;
- detailed backup propagation for DEC-18 disposal;
- export policy under DEC-19;
- tenant-isolation architecture under DEC-21;
- migration and cutover under DEC-22;
- source freshness/posting safety; and
- implementation details, schema, APIs, UI, tests, dependencies, deployment,
  infrastructure configuration, and publishing.

### What DEC-20 approval locks in

- backups are resilience infrastructure, not exports or accounting authority;
- authoritative accounting and evidence receive protected backup coverage;
- derived data may be rebuilt only where deterministic recovery is verified;
- explicit, measurable RPO/RTO targets apply by data criticality;
- point-in-time recovery and isolated validation are preferred where available;
- recovery cannot silently rewrite live accounting;
- backup retention is distinct from production retention but cannot undermine
  DEC-17 obligations or DEC-18 disposal;
- recovery access is encrypted, company-scoped, server-side,
  capability-controlled, and audited; and
- backup and restore readiness is verified through documented tests.

### What remains changeable

Provider, region, schedules, exact retention durations, exact RPO/RTO
commitments, storage tiers, key-management design, restore tooling, regional
recovery, document backup strategy, operational staffing, migration
checkpoints, and implementation design.

## 23. Important principle

Recovery is for restoring service and data availability.

It is not an accounting correction mechanism. If an accounting error exists,
use the approved correction or reversal process; do not restore an old state
merely to erase the error.

## 24. Decision readiness

DEC-20 was explicitly approved on 2026-08-21. The approval is a
product/operational resilience policy only. Until the applicable remaining
decisions are approved or amended:

- DEC-21 and DEC-22 remain untouched and unresolved;
- BL-06 and BL-07 remain **BLOCKED**;
- no backup, recovery, infrastructure, schema, migration, accounting,
  deployment, or publishing implementation may begin; and
- no implementation task is authorised.

**DEC-01 through DEC-20:** **APPROVED**
**DEC-21 and DEC-22:** **REQUIRE USER DECISION**
**BL-06 / BL-07:** **BLOCKED**
**Application code changed by this review:** **NO**
**Database or migrations changed by this review:** **NO**