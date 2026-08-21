# Ledgerly Technical Architecture

**Authority level:** 4 — beneath the PRD / Product Scope and above feature
specifications and the Master Backlog  
**Status:** Living governance document established by Decision 1 on 2026-08-21  
**Accounting-core design status:** **REQUIRES USER DECISION**  
**Implementation authority:** None

## Purpose

This document defines the mandatory technical constraints and decision structure
needed to satisfy the Manifesto, Product Principles, and PRD/Product Scope. It
does not silently adopt the BL-06/BL-07 architecture review or authorise any
implementation work.

The [BL-06 / BL-07 accounting-core architecture review](ledgerly-accounting-core-architecture-review.md)
remains a design proposal **READY FOR REVIEW**. It may inform this document, but
its proposed schema, posting, migration, and operational choices are not
approved until explicitly recorded as such.

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

The following remain **REQUIRES USER DECISION** before BL-06 or BL-07 can be
approved:

1. Whether to adopt, amend, or replace the accounting-core design proposal.
2. The capability model for posting, reversal/correction, close/reopen, chart,
   and configuration changes.
3. Financial-year, period generation, close/reopen, and year-end policy.
4. Chart template, control-account mappings, and effective-dated configuration
   policy.
5. Source revision/freshness rules, including VAT evidence.
6. Overpayment, unapplied cash, refund, and payment-on-account treatment.
7. Audit retention, deletion/anonymisation, and export policy.
8. Backup/recovery objectives and tenant-isolation/RLS policy.
9. Historical JSON journal validation, compatibility, migration cohort, and
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