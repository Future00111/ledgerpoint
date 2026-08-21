# Ledgerly Technical Architecture

**Authority level:** 4 — beneath the PRD / Product Scope and above feature
specifications and the Master Backlog  
**Status:** Living governance document established by Decision 1 on 2026-08-21  
**Accounting-core design status:** **APPROVED — DEC-04 architecture only**
**Implementation authority:** None

## Purpose

This document defines the mandatory technical constraints and decision structure
needed to satisfy the Manifesto, Product Principles, and PRD/Product Scope. It
adopts the DEC-04 accounting-core foundation but does not authorise any
implementation work.

The [BL-06 / BL-07 accounting-core architecture review](ledgerly-accounting-core-architecture-review.md)
is the approved accounting-core foundation through
[DEC-04](ledgerly-dec-04-accounting-core-adoption-review.md). Its approved
architectural invariants constrain future specifications. DEC-05 separately
approves the capability model recorded in the [DEC-05 Capability and Approval
Matrix Review](ledgerly-dec-05-capability-approval-review.md). Physical schema,
API/UI design, migration execution, and policy choices reserved to DEC-06
through DEC-22 are not approved.

## Approved accounting-core foundation

Future specifications must preserve the DEC-04 architectural invariants:

- canonical normalized append-only journals;
- server-side transactional double-entry posting;
- integer minor-unit money with explicit currency;
- source linkage, source/version context, and company-scoped idempotency;
- immutable posted journals with linked reversals/corrections;
- separate payment, allocation, and bank-evidence concepts;
- DEC-03's deterministic VAT service through a traceable adapter;
- journal-authoritative reporting with rebuildable projections;
- company-scoped server-side capability and audit boundaries; and
- additive, evidence-based compatibility and migration.

DEC-04, DEC-05, DEC-06, DEC-07, DEC-08, and DEC-09 are
architecture/product/accounting-policy approvals only. They do not approve an
implementation task or resolve any DEC-17 through DEC-22 policy.

The [DEC-10 Control-Account Mapping Policy Review](ledgerly-dec-10-control-account-mapping-policy-review.md)
records an approved control-account policy only. It does not authorise
implementation or resolve any DEC-17 through DEC-22 policy.

The [DEC-11 Configuration Versioning and Effective Dating
Review](ledgerly-dec-11-configuration-versioning-review.md) records an
approved configuration-versioning policy only. It does not authorise
implementation or resolve any DEC-17 through DEC-22 policy.

The [DEC-12 Payment, Allocation and Settlement Policy
Review](ledgerly-dec-12-payment-allocation-settlement-policy-review.md)
records an approved payment/allocation/settlement policy only. It does not
authorise implementation or resolve DEC-17 through DEC-22 policy.

The [DEC-13 Overpayments, Unapplied Cash and Excess Payment Policy
Review](ledgerly-dec-13-overpayments-unapplied-cash-policy-review.md) records
an approved overpayment and party-balance policy only. It does not authorise
implementation or resolve DEC-17 through DEC-22 policy.

The [DEC-14 Unapplied Cash Workflow Policy
Review](ledgerly-dec-14-unapplied-cash-workflow-policy-review.md) records an
approved workflow policy only. It does not authorise
implementation or resolve DEC-17 through DEC-22 policy.

The [DEC-15 Refund Policy Review](ledgerly-dec-15-refund-policy-review.md)
records an approved refund policy only. It does not
authorise implementation or resolve DEC-17 through DEC-22 policy.

The [DEC-16 Payment-on-Account Launch Scope
Review](ledgerly-dec-16-payment-on-account-launch-scope-review.md) records a
approved product/accounting launch-scope policy only. It does not authorise
implementation or resolve DEC-17 through DEC-22 policy.

## Architecture obligations derived from governance

Any future technical design must uphold the following constraints:

### Accounting authority

- Accounting outcomes must be deterministic and enforced server-side.
- Accounting records must be accurate, traceable, and auditable.
- Posted history must not be silently altered; corrections must preserve an
  intelligible audit trail.
- Reporting must ultimately derive from authoritative posted accounting records,
  not browser state or unverified operational evidence.
- Financial periods require controlled status, posting restrictions, controlled
  reopening, and an audit trail.

### AI and automation

- Rules must precede AI where a deterministic answer exists.
- AI may assist and prepare drafts, but it is not the accounting authority.
- Consequential financial, VAT, locked-record, deletion, and external-send
  effects require the approved control, authentication, and audit boundary.
- Automation must remain explainable and must not create silent financial
  decisions.

### Trust, safety, and tenant separation

- Every company-scoped record and mutation requires appropriate tenant scoping
  and permission checks.
- Customers must receive business-language outcomes rather than technical
  internals or raw error data.
- Architecture must preserve the ability to explain financial outcomes,
  recommendations, and failures.

### Product quality

- Design must support responsive, accessible, performant workflows with clear
  loading, empty, success, and error states.
- Major business objects must be capable of supporting the Workspace and Ask
  requirements where applicable.
- Technical shortcuts must not create dead ends, duplicate authority, or weaken
  a future feature's ability to meet the Definition of Done.

## Current-state baseline

The existing application, API, database schema, and services are evidence of the
current implementation, not architectural authority. The accounting-core review
records material gaps in the current state, including the absence of canonical
posting, normalized journal lines, authoritative payment/allocation records,
period controls, and journal-authoritative reporting.

No current implementation detail should be treated as an approved target design
merely because it exists today.

## Architecture decisions still required

DEC-05 is approved separately. The following remain **REQUIRES USER DECISION**
before BL-06 or BL-07 can be approved for implementation:

1. Chart template, control-account mappings, and effective-dated configuration
   policy. The [DEC-09 Chart of Accounts and Default Account Policy
   Review](ledgerly-dec-09-chart-of-accounts-policy-review.md) records the
   chart recommendation but remains unresolved.
2. Source revision/freshness rules, including VAT evidence.
3. Overpayment, unapplied cash, refund, and payment-on-account treatment.
4. Audit retention, deletion/anonymisation, and export policy.
5. Backup/recovery objectives and tenant-isolation/RLS policy.
6. Historical JSON journal validation, compatibility, migration cohort, and
   cutover policy.

The detailed options, recommendations, implications, and dependencies are
recorded in the [pre-implementation decision pack](ledgerly-accounting-core-decision-pack.md).

## Required design records before accounting-core implementation

Before implementation can begin, the approved architecture must identify, at a
minimum:

- authoritative source types and their posting boundary;
- record immutability, corrections, audit, and idempotency rules;
- money, tax, source freshness, and reporting-authority contracts;
- payment, allocation, bank-evidence, and reconciliation relationships;
- financial-year, period, chart, control-account, and configuration controls;
- tenant scoping, permissions, retention, export, backup/recovery, and
  observability requirements; and
- legacy-data validation, migration, compatibility, and cutover controls.

This list is a governance checkpoint, not an approved implementation design.

## Relationship to specifications and backlog

Feature specifications and Master Backlog items must conform to this document.
They may propose detail, but cannot override its constraints or resolve an open
architecture decision. An approved implementation task is still required before
any code, schema, migration, UI, workflow, deployment, or publishing activity.

## Amendments

This is a living document. Any amendment requires an explicit, documented
decision that identifies consequences for:

- existing implementation;
- accounting data;
- database/schema;
- migrations;
- backwards compatibility;
- dependent features; and
- Master Backlog items.

Where an amendment changes accounting authority, security boundaries, data
contracts, or migration assumptions, the affected product decisions and
accounting-core decision-pack entries must be updated before any implementation
task is approved.