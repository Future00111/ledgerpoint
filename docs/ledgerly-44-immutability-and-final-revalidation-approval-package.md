# #44 Canonical Posting Safety Enforcement — Implementation Approval Package

**Status:** PLANNING / REVIEW ONLY — NO IMPLEMENTATION AUTHORISED  
**Proposed task:** `#44 — Canonical Posting Safety Enforcement`  
**Identifier status:** Proposed identifier only; no project task has been created  
**Governance baseline:** DEC-01 through DEC-22 APPROVED  
**BL-06 / BL-07:** Remain blocked  
**DEC-23:** Not created and not required  
**Related work:** `#40-CF-01 — Canonical Posting Foundation` was previously
approved as a bounded implementation slice, but its completion gate remains
open because persistence-level immutability and authoritative final
revalidation have not been demonstrated.
**Decision requested:** Explicit approval of this narrowly scoped enforcement
task, including the engineering choices identified in this package

> This document prepares an implementation approval package only. It does not
> approve, create, or execute #44. It does not change application code, schema,
> migrations, workflows, dependencies, infrastructure, deployment, publishing,
> production data, or project-task state.

## 1. Executive recommendation

Approve `#44 — Canonical Posting Safety Enforcement` only as the bounded
follow-on required to close the two unresolved safety gates from the #40
implementation review:

1. guarantee that posted canonical journal headers and lines cannot be edited
   or deleted;
2. guarantee that source, authority, period, configuration, mapping, and
   account state remain valid through the final accounting commit.

The task must also close the directly related correction/reversal concurrency
and command-validation gaps. It must not become a new accounting workflow or
reopen the blocked BL-06 / BL-07 product work.

The recommendation is **not** to mark #40 complete based on application
convention alone. Excluding canonical tables from generic CRUD is useful
defence-in-depth, but it does not prove that future server code or a direct
database write cannot alter posted accounting.

## 2. Why this package is required

The current canonical foundation has additive journal, line, effect, relation,
and audit structures plus a protected service boundary. Its development
fixtures demonstrate balanced posting, company scope, idempotency, rollback,
concurrency, reversal, and correction behavior.

The implementation review identified two material gaps:

- **Immutability is not persistence-enforced.** The current schema has no
  database-level protection against updates or deletes to posted headers and
  lines. The service has no supported edit path, but absence of an edit path is
  not an immutability guarantee.
- **Final freshness is not concurrency-enforced.** A provider read inside a
  transaction is not enough unless the authoritative provider participates in
  an effective lock or conditional-version check that remains valid through
  commit. Otherwise source approval, membership, period state, configuration,
  mapping, or account eligibility may change after validation.

These gaps are safety-contract gaps, not polish or test-coverage preferences.
Implementation must stop if the approved scope does not permit mechanisms that
can actually provide the guarantees.

## 3. Authority and classification

The following labels are normative for this package:

- **APPROVED GOVERNANCE POLICY** — binding policy already approved by
  DEC-01–DEC-22;
- **ACCOUNTING INVARIANT** — a condition that must hold for canonical
  accounting;
- **REQUIRED IMPLEMENTATION BEHAVIOUR** — behavior required to satisfy the
  approved policy and invariants;
- **PROPOSED ENGINEERING DESIGN** — a candidate design for #44;
- **ENGINEERING CHOICE REQUIRING APPROVAL** — a material technical choice that
  must be accepted before execution;
- **DEFERRED** — intentionally excluded from #44.

Approval of this package would approve only the explicitly bounded
implementation task after the decision gates below are accepted. It would not
approve a general migration, database replacement, new tenant architecture, or
downstream accounting workflow.

## 4. Governance basis

### 4.1 Approved constraints

| Decision | Constraint on #44 |
|---|---|
| DEC-01 | Stop if the enforcement design conflicts with approved governance or cannot provide the stated guarantee. |
| DEC-04 | Preserve normalized, balanced, append-only, source-linked, idempotent, atomic journals with linked additive corrections. |
| DEC-05 | Preserve authenticated identity, active membership, company scope, server-side capability evaluation, approval requirements, and audit. |
| DEC-06 | Do not allow a posting-date financial year to be silently rebased. |
| DEC-07 | Ordinary posting cannot bypass a closed period. |
| DEC-09–DEC-11 | Account identity, classification, protected mappings, and material configuration must remain company-scoped and versioned. |
| DEC-17–DEC-20 | Preserve audit meaning, retention, bounded recovery, and no-replay behavior. |
| DEC-21 | Enforce company isolation across canonical records, references, authority, and evidence. |
| DEC-22 | Do not migrate, reinterpret, backfill, or cut over historical accounting. |

### 4.2 Source-freshness ownership

Source freshness remains a cross-cutting implementation-level posting-safety
contract derived from DEC-01–DEC-22. It is not assigned to DEC-12 and does not
create DEC-23.

The final implementation must not treat a provider read, browser page, AI
recommendation, queue payload, draft, or approval record as current merely
because it was previously captured.

## 5. Proposed task

### 5.1 Objective

Implement only the enforcement needed to make the existing canonical posting
boundary safe under direct mutation attempts and concurrent authoritative-state
changes.

The resulting boundary must either:

- commit a valid canonical effect whose immutability and final context
  guarantees hold through commit; or
- commit no accounting effect and return an explicit rejected, stale, conflict,
  or retry-safe outcome.

### 5.2 Exact scope

#### A. Persistence-level posted-journal immutability

The implementation must ensure:

- a posted canonical journal header cannot be updated or deleted;
- lines belonging to a posted journal cannot be updated or deleted;
- a posted journal cannot be made mutable by changing status or ownership;
- adding a correction or reversal remains insert-only and linked;
- attempted direct updates/deletes fail deterministically;
- failed mutation attempts do not damage the journal, lines, effect identity, or
  audit evidence.

**Proposed engineering design:** use a persistence-level mechanism that rejects
mutations at the database boundary, with the canonical service remaining the
only supported writer for new accounting effects. A database trigger or an
equivalent database-enforced write policy is the recommended candidate because
the current application has one shared database role and no separate
least-privilege writer role.

**Engineering choice requiring approval:** whether the permitted implementation
scope allows the required database-level DDL/schema migration mechanism. If it
does not, #44 must not claim completion because application-level convention
cannot prove this invariant.

#### B. Authoritative final-revalidation contract

The implementation must replace best-effort provider reads with an explicit
provider contract that supports one of the following equivalent guarantees:

- an authoritative row or resource lock held through the accounting
  transaction; or
- an authoritative version/concurrency token checked conditionally as part of
  the same commit boundary.

The final operation must revalidate, at minimum:

- source ownership and source revision/evidence identity;
- material source status and approval context where applicable;
- active user membership or validated job authority;
- requested and resolved company identity;
- posting date, financial year, and accounting period;
- period open/closed state;
- material configuration version and effective-date selection;
- protected mapping and account eligibility context;
- command identity and economic-effect identity.

The provider interface must make it impossible for the canonical service to
silently downgrade a required lock/version assertion into an ordinary read.
Missing, ambiguous, unsupported, or failed revalidation must fail closed.

#### C. Linked correction/reversal serialization

The implementation must:

- lock or conditionally validate the original journal before linking a
  correction or reversal;
- preserve the original header and lines;
- create only additive balanced linked journals;
- prevent a second reversal of the same original unless the approved command
  semantics explicitly permit it;
- keep correction and reversal identities company-scoped and idempotent;
- return the original result for a safe retry rather than creating a second
  linked journal.

The package does not choose whether this is enforced through a unique partial
constraint, an original-journal lock, or both. The chosen mechanism must be
recorded during implementation review and tested under concurrency.

#### D. Shared command validation

Posting, correction, and reversal commands must share the same fail-closed
validation rules for:

- non-empty source/economic-effect/idempotency identities;
- valid ISO posting dates;
- supported currency and integer non-negative minor units;
- balanced one-sided lines with at least two lines;
- company-owned active eligible accounts;
- valid open period and financial year;
- matching configuration version;
- required capability and active membership/job authority;
- reason, source/evidence context, and target identity for corrections and
  reversals.

Validation errors must be deterministic business outcomes rather than
accidental database errors.

#### E. Durable uncertain-outcome recovery

The implementation must preserve enough durable effect identity and result
state that a client can safely query or retry after an uncertain network or
process outcome without creating a second journal.

An uncertain or failed attempt must never be treated as a successful accounting
effect unless the journal, effect identity, and required audit evidence were
committed atomically.

Rejected, stale, and conflict outcomes may use the existing approved audit or
operational evidence boundary, but they must not create accounting effects.

#### F. Adversarial evidence

Add tests for the bounded behavior, including:

- direct update and delete attempts against posted headers and lines;
- attempted status, company, ownership, and line mutation;
- source revision and evidence-hash races;
- membership revocation and role/capability changes before commit;
- period closure and configuration-version changes before commit;
- account deactivation or company reassignment before commit;
- stale or missing source/context tokens;
- invalid dates, amounts, currencies, zero totals, and unbalanced journals;
- malformed, inactive, conflicting, and insufficient authorization;
- duplicate post, correction, and reversal identities;
- concurrent reversal/correction attempts against one original;
- line-write and audit-write failure rollback;
- uncertain-result lookup/retry;
- Company A / Company B isolation for every canonical entity and reference.

Tests must use controlled fixtures only and must not introduce invoice, bill,
payment, bank, VAT-return, or reconciliation workflows.

## 6. Proposed engineering choices requiring explicit approval

The following are implementation choices, not governance policy:

1. **Persistence enforcement mechanism.** Recommended: database-enforced
   mutation rejection for posted records, with insert-only correction/reversal
   paths.
2. **Final freshness primitive.** Recommended: provider-owned transactional
   lock or conditional version assertion, selected per authoritative storage
   capability. An ordinary read is not an acceptable fallback.
3. **Original-journal serialization.** Recommended: lock or equivalent
   conditional check plus a database uniqueness guarantee for the approved
   reversal policy.
4. **Uncertain-result representation.** The existing durable effect record may
   be extended only as needed to distinguish pending, posted, and recoverable
   outcomes; no accounting effect may be inferred from a client timeout.
5. **Schema-change application.** Any required database-level enforcement must
   use the project-approved development schema-change path and must not be
   applied to production by the agent. Production changes remain part of the
   Publish flow.

No choice above authorizes provider selection, queue selection, deployment,
publishing, RLS, or a new tenant-isolation architecture.

## 7. Explicit exclusions

The task must not include:

- invoice, bill, payment, allocation, settlement, refund, credit, or
  prepayment workflows;
- bank import, categorisation, transfer pairing, or reconciliation;
- VAT calculation, VAT-return workflow, HMRC submission, or a second VAT
  engine;
- chart-of-accounts administration or period/configuration product UI;
- historical migration, backfill, reinterpretation, cutover, or legacy
  `journal_entries` mutation;
- universal RLS or replacement of the completed BL-01-FI guard;
- broad generic-CRUD cleanup unrelated to protecting canonical records;
- reporting, projections, exports, frontend UI, or user-facing workflow work;
- provider, queue, worker, scheduler, backup, or deployment selection;
- production schema changes, publishing, rollout, or production data changes.

The existing legacy JSON `journal_entries` records remain compatibility records.
They are not made canonical by #44.

## 8. Dependencies and stop conditions

### Dependencies

- The approved #40 canonical tables and posting boundary remain the starting
  point.
- The BL-01-FI Principal and Tenant Guard remains the only membership/company
  authorization boundary.
- Authoritative source, period, configuration, mapping, and account providers
  must expose the lock or conditional-version contract before production
  posting can be enabled.
- The project must approve the persistence-level enforcement mechanism if it is
  outside the currently permitted schema-change scope.

### Stop conditions

Implementation must stop and report if:

- database-level immutability cannot be permitted or guaranteed;
- any required authoritative provider lacks a lock/version contract;
- final freshness cannot remain valid through commit;
- a provider can return ambiguous company, period, configuration, mapping, or
  account ownership;
- correction/reversal concurrency cannot be serialized or constrained;
- atomic journal/effect/audit persistence cannot be guaranteed;
- company isolation depends on caller-supplied context alone;
- implementation would require a new governance decision or broaden a blocked
  backlog item;
- the proposed mechanism would mutate, migrate, delete, reinterpret, or
  backfill legacy accounting data.

## 9. Rollback and recovery boundary

Rollback means reverting the implementation change or disabling the canonical
posting command before any production rollout. It does not mean deleting
canonical journals or undoing posted accounting rows.

An accounting correction or reversal is the only approved way to change the
economic effect of a posted journal. It must be additive, linked, authorized,
freshness-validated, and auditable.

No production migration, deployment, backup change, or data rollback is
authorized by this package.

## 10. Approval gates

Before implementation begins, the user must explicitly accept:

1. the exact scope and exclusions in this package;
2. a persistence-level immutability mechanism strong enough to prevent direct
   posted-journal mutation;
3. an authoritative lock or conditional-version final-revalidation contract;
4. the selected original-journal correction/reversal concurrency policy;
5. the fail-closed treatment of missing providers and uncertain outcomes;
6. the adversarial test and Company A/B isolation evidence required below.

Approval must not be inferred from reviewing this document, the earlier #40
approval, a task-list state, or an implementation attempt.

## 11. Definition of done

The bounded #44 task is complete only when:

- posted canonical headers and lines cannot be directly updated or deleted;
- the canonical service has no alternate mutation path for posted records;
- final source, authority, period, configuration, mapping, and account checks
  use an authoritative lock or commit-valid conditional version;
- posting, correction, and reversal commands share complete fail-closed
  validation;
- concurrent linked operations are serialized or rejected according to the
  approved policy;
- safe retries and uncertain outcomes resolve to the original exact result;
- successful journal, lines, effect identity, linked relationship, and audit
  evidence commit atomically;
- failed or stale attempts create no accounting effect;
- authorization and Company A/B isolation tests pass;
- legacy JSON journal data remains untouched;
- no excluded workflow, UI, migration, deployment, or production change was
  introduced;
- type checks, focused tests, production build, runtime health, and diff
  validation pass;
- the final implementation review documents deviations and explicitly states
  what was not delivered.

## 12. Decision record template

**Decision:** `PENDING — DO NOT IMPLEMENT`

**Approved task:** `#44 — Canonical Posting Safety Enforcement`

**Approved scope:**  
`PENDING — confirm the exact scope and exclusions above.`

**Persistence immutability mechanism:**  
`PENDING — approve or reject the proposed database-enforced mechanism.`

**Final freshness mechanism:**  
`PENDING — approve the lock/conditional-version contract.`

**Linked correction/reversal policy:**  
`PENDING — approve serialization and duplicate-reversal behavior.`

**Production status:**  
`No production deployment, publishing, migration, or production data change is
authorized by this package.`
