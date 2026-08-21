# DEC-04 Accounting-Core Architecture Adoption Review

**Decision:** DEC-04 — Accounting-core architecture adoption  
**Status:** **APPROVED**
**Review date:** 2026-08-21  
**Decision recorded:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting, security,
and architecture review  
**Implementation authority:** None

> This is a decision pack, not an implementation plan. No recommendation below
> authorises code, schema, migration, UI, workflow, dependency, deployment, or
> publishing work.

## 1. Decision question

Should the existing
[BL-06 / BL-07 Accounting Core Architecture Review](ledgerly-accounting-core-architecture-review.md)
become the accounting-core foundation within the level-4 Technical Architecture,
with targeted amendments that preserve the unresolved decisions below?

The realistic choice is not whether Ledgerly needs an authoritative accounting
core. DEC-01, DEC-02, DEC-03, the Manifesto, and the existing technical review
already establish that the current mixed model is not sufficient as the long-term
accounting authority. The decision is how much of the proposed design to adopt
now, and which policies must remain separately amendable.

## 2. Authority and review labels

### ALREADY DECIDED

The following are already established by higher authority or explicit decisions:

- The Manifesto remains the highest product authority.
- The authority hierarchy is Manifesto → Product Principles → PRD/Product
  Scope → Technical Architecture → Feature Specifications/Master Backlog.
- DEC-02 approves the initial UK/GBP product direction and authoritative core
  accounting, including invoices, bills, payments, banking, reconciliation,
  reporting, and VAT preparation.
- DEC-03 approves Standard VAT on invoice basis, controlled source-linked and
  return-level corrections, and VAT preparation/export without direct HMRC
  submission.
- Accounting authority must be deterministic and server-side.
- AI and browser workflows are not allowed to create accounting effects outside
  the approved posting and approval boundary.
- Bank imports are evidence, not automatic accounting authority.
- Bank-feed VAT metadata is advisory and never drives VAT return boxes.
- Posted accounting history must be immutable; corrections are additive,
  linked, and auditable.
- Reports must ultimately derive from authoritative posted journals.
- No recommendation in this review authorises implementation.
- BL-06 and BL-07 remain blocked until the required decisions are approved and
  recorded.

The existing architecture review is approved as the accounting-core foundation
within the Technical Architecture, subject to the approved invariants and
deliberate non-locks recorded in this decision. Its implementation details
remain proposals until separately specified and authorised.

### APPROVED ADOPTION

Lee approved Option A: adopt the architecture review as the canonical
accounting-core chapter within the existing Technical Architecture, with the
targeted amendments and open decision boundaries in this document.

This approval locks the accounting authority and safety invariants, not every
product policy, account list, role assignment, period calendar, API shape, or
migration cohort.

### APPROVED DECISION BOUNDARY

DEC-04 approves:

1. Option A and the architectural invariants that become the accounting-core
   foundation;
2. the targeted amendments, explicit non-locks, and compatibility/migration
   boundary in this review;
3. DEC-03 as the authoritative deterministic VAT service through a traceable
   adapter; and
4. the requirement that DEC-05 through DEC-22 remain separate decisions.

DEC-05 was subsequently approved through its own decision record. DEC-06
through DEC-22 remain unresolved.

DEC-04 does not approve implementation, an implementation task, or any policy
reserved to a subsequent decision.

## 3. Adoption options

### Option A — Adopt as the accounting-core foundation with targeted amendments

**Status:** **APPROVED.**

Use the existing architecture review as the accounting-core chapter within the
Technical Architecture. Approve the authority, integrity, source, reporting,
security, and compatibility invariants. Keep financial policy, capability
matrix, chart defaults, operational policy, migration cohort, retention, and RLS
as separate decisions.

**Rationale:** This addresses the current JSON-journal, client-authority,
missing-period, missing-allocation, and non-authoritative-reporting risks without
requiring a destructive replacement or prematurely deciding every policy.

**Consequences:**

- **Accounting:** Establishes one canonical posting authority and an immutable
  double-entry history.
- **Data/schema:** Requires a normalized logical model and protected boundaries,
  while leaving physical names and migration sequencing amendable.
- **Migration:** Favors additive adapters, validation, comparison, and
  controlled cutover rather than destructive replacement.
- **Reporting:** Establishes posted journals as the report authority and
  rebuildable projections as performance aids only.
- **Compatibility:** Existing Base44-shaped/legacy APIs remain compatibility
  surfaces during transition, not a second permanent accounting authority.
- **Security/audit:** Every mutation is company-scoped, capability-checked,
  idempotent, atomic, and auditable.
- **Backlog:** Directly constrains BL-06/07 and provides the foundation for
  BL-04/05/08/09/10/13/14/15/17/19/23/24.
- **Risk:** The boundary between architecture approval and later policy
  decisions must be maintained carefully.
- **Hard to change later:** Canonical journal authority, immutable posted
  history, source-linked posting, and the meaning of existing posted records.

### Option B — Keep the architecture review as a separate technical document

**Description:** Do not adopt it into the Technical Architecture. Treat it as a
standalone proposal that future feature specifications may reference.

**Recommendation:** **NOT RECOMMENDED.**

**Consequences:**

- **Accounting:** There is no single approved target for the canonical posting
  boundary; feature work could continue to interpret authority differently.
- **Data/schema:** The level-4 architecture remains silent on the normalized
  journal, payment, period, and source contracts.
- **Migration:** Adapters and cutover remain recommendations with no approved
  architectural destination.
- **Reporting:** The requirement for journal-authoritative reporting remains
  vulnerable to local source-based implementations.
- **Compatibility:** Existing APIs may continue to behave as de facto authority,
  increasing divergence and future migration cost.
- **Security/audit:** Generic writes and broad roles remain architectural gaps
  rather than explicit constraints.
- **Backlog:** BL-06/07 remain blocked, but dependent work has no approved
  contract to design against.
- **Risk:** The project accumulates parallel interpretations and reopens
  already-reviewed accounting fundamentals.
- **Hard to change later:** More consumers would depend on the current mixed
  model, making later canonicalisation more disruptive.

### Option C — Reject the review and commission a different architecture

**Description:** Reject the proposed accounting-core design and commission a
new architecture before adoption.

**Recommendation:** **NOT RECOMMENDED unless a material accounting, regulatory,
security, or compatibility flaw is found in the review.**

**Consequences:**

- **Accounting:** The current authority gap remains until a replacement is
  designed and approved.
- **Data/schema:** A second design must still solve normalized journals,
  double-entry, immutability, payments, periods, VAT, and reporting authority.
- **Migration:** Existing migration analysis and adapters would need to be
  re-evaluated, delaying validated historical handling.
- **Reporting:** Existing non-authoritative reporting paths remain in place
  longer.
- **Compatibility:** Existing clients receive no safer canonical boundary.
- **Security/audit:** Current generic journal mutation and coarse authority
  remain unresolved.
- **Backlog:** BL-06/07 and every dependent accounting item are delayed.
- **Risk:** Rework and decision fatigue without a demonstrated benefit.
- **Hard to change later:** Rejecting the review creates a new architecture
  commitment, even if the replacement eventually converges on the same model.

## 4. Recommended architecture and what it locks in

The following are the recommended architectural invariants for Option A.
They are the parts that should become stable enough for later specifications to
depend on.

### 4.1 Canonical accounting authority

**Recommended:** A transactional, normalized, append-only posting core:

```text
validated source
  -> server-side calculation and VAT result
  -> posting command
  -> source/version/idempotency validation
  -> period/account/permission validation
  -> journal header + journal lines
  -> audit and source linkage
  -> rebuildable projections
  -> journal-authoritative reports
```

**Options:**

1. Continue treating invoices, bills, bank rows, or browser state as authority.
2. Maintain multiple co-equal accounting authorities.
3. Use one canonical posting core with operational sources and projections
   around it.

**Recommendation:** Option 3.

**Why:** It is the only option that supports accurate double-entry,
reconciliation, VAT evidence, correction history, and report parity without
making every source module independently responsible for accounting truth.

**Consequences:**

- **Accounting:** Source modules provide validated facts; the posting service
  determines the accounting effect.
- **Data/schema:** Source records, posting sources, journals, and projections
  have distinct responsibilities.
- **Migration:** Current source and compatibility records can remain while
  authority transfers by validated company/source cohort.
- **Reporting:** Operational data may support workflow views but not final
  financial totals.
- **Compatibility:** Existing reads can be adapted; generic journal writes must
  eventually be protected or retired.
- **Security/audit:** Posting is a protected command, not generic CRUD.
- **Backlog:** BL-06 is the authority boundary; BL-17 depends on it.
- **Risk:** Temporary dual representations require parity monitoring.
- **Hard to change:** The definition of canonical authority and the meaning of
  a posted journal.

### 4.2 Normalized append-only journals

**Recommended:** One journal header with two or more normalized journal lines.
Posted headers and lines are immutable. A posted journal is never deleted or
edited, including after reversal.

**Options:**

1. Keep JSON journal lines.
2. Store flat journal rows without a header/line relationship.
3. Use normalized headers and lines as the canonical posted model.

**Recommendation:** Option 3.

**Consequences:**

- **Accounting:** Supports explicit balanced transactions, line-level tax and
  source evidence, and linked reversals.
- **Data/schema:** Requires header/line foreign keys, company-safe
  relationships, one-sided debit/credit checks, and immutable status
  enforcement.
- **Migration:** Existing JSON journals require validation and may remain
  legacy if incomplete or ambiguous.
- **Reporting:** Trial balance, ledger, P&L, balance sheet, VAT, AR/AP, and bank
  reports can query one authority.
- **Compatibility:** Existing flat/JSON reads need adapters; their shapes are
  not canonical.
- **Security/audit:** Posted mutations must be rejected at the service and
  database boundary where practical; corrections create audit-linked entries.
- **Backlog:** BL-06, BL-07, BL-17, BL-23, BL-24.
- **Risk:** More relational structure and migration work.
- **Hard to change:** Journal meaning, posted immutability, and line-level
  accounting semantics.

### 4.3 Canonical posting transaction and double-entry enforcement

**Recommended:** A server-side posting command validates the complete source
snapshot, accounts, period, VAT result, permissions, company scope, and balance
inside one database transaction.

**Options:**

1. Accept client-prepared journal lines after superficial validation.
2. Balance journals in application/browser code and store the result.
3. Recalculate and validate server-side, then atomically persist the complete
   balanced journal.

**Recommendation:** Option 3.

**Minimum invariants:**

- total debit equals total credit;
- debit and credit amounts are non-negative;
- one line cannot contain both debit and credit;
- a posted journal has a positive total;
- all lines share company and currency;
- all accounts are valid and active for the posting;
- the journal resolves to exactly one valid period;
- source version and VAT result are fresh enough for approval;
- retries are idempotent.

**Consequences:**

- **Accounting:** Prevents unbalanced, stale, duplicated, or cross-company
  postings.
- **Data/schema:** Requires transactional foreign keys, checks, unique
  idempotency, source revisions, and posting status.
- **Migration:** Backfilled records must pass the same validation or remain
  legacy/exception records.
- **Reporting:** Every report can rely on balanced posted entries.
- **Compatibility:** Browser previews and old totals remain advisory or
  transitional projections.
- **Security/audit:** Actor, capability, source version, request identity, and
  approval are persisted with the posting.
- **Backlog:** BL-03/04/05/06/08/13/14/15/19/23.
- **Risk:** Strict validation exposes current data inconsistencies that must be
  handled visibly.
- **Hard to change:** The posting contract, balance rules, and retry semantics.

### 4.4 Money and currency representation

**Recommended:** Canonical monetary values use integer minor units with explicit
currency code. For the initial launch, GBP/pence is the supported direction,
but the contract remains currency-aware.

**Options:**

1. Continue using mixed numeric/string/JSON values.
2. Use floating-point application values.
3. Use decimal values without one shared posting and rounding contract.
4. Use integer minor units plus explicit currency and precision policy.

**Recommendation:** Option 4.

**Consequences:**

- **Accounting:** Deterministic balancing and VAT rounding.
- **Data/schema:** New canonical amounts need integer fields, currency codes,
  precision rules, and adapters for current numeric fields.
- **Migration:** Existing values require explicit conversion and validation;
  they must not be silently reinterpreted.
- **Reporting:** Report and export calculations use one defined monetary model.
- **Compatibility:** Existing display values may remain projections during
  transition.
- **Security/audit:** Server-side conversion and validation reduce tampering and
  unexplained residuals.
- **Backlog:** BL-04/06/07/08/09/13/15/17.
- **Risk:** Currency precision, residual, and rounding policy details remain
  open and must not be invented by the architecture.
- **Hard to change:** Amount representation after canonical journals exist.

### 4.5 Source linkage and company-scoped idempotency

**Recommended:** Every posting has a typed company-scoped source, source
version, posting kind, and unique idempotency key.

**Options:**

1. Deduplicate in memory or at the caller.
2. Use timestamps, references, or free-text descriptions.
3. Enforce source/posting-kind/idempotency uniqueness at the database boundary
   and return the existing result for safe retries.

**Recommendation:** Option 3.

**Consequences:**

- **Accounting:** API retries, imports, workers, reconciliation, and AI
  hand-offs cannot silently duplicate journals.
- **Data/schema:** Requires posting-source records or equivalent typed
  relationships, source revisions, unique constraints, and correction keys.
- **Migration:** Backfill and compatibility adapters require stable source
  identity and explicit handling for missing identity.
- **Reporting:** Each posted amount can be traced to one source and posting
  result.
- **Compatibility:** Legacy source IDs can be retained through adapters without
  making legacy fields the accounting authority.
- **Security/audit:** Idempotency and actor/request identity support
  non-repudiation and incident investigation.
- **Backlog:** BL-03/05/06/08/09/12/13/14/15/19/23/24.
- **Risk:** Existing sources may not have sufficient revision or identity
  information.
- **Hard to change:** Duplicate definitions and source identity once external
  workflows depend on them.

### 4.6 Corrections, reversals, payments, allocations, and bank evidence

**Recommended:** Keep posted journals immutable. Use linked reversal,
replacement, credit-note, payment-reversal, and controlled period-correction
postings. Model payment, payment allocation, and bank transaction as separate
entities.

**Options:**

1. Mutate source balances and posted rows in place.
2. Treat every bank row as a payment and use invoice/bill paid fields as
   authority.
3. Use separate settlement/evidence entities and append linked accounting
   effects through the canonical posting service.

**Recommendation:** Option 3.

**Consequences:**

- **Accounting:** Partial payments, split allocations, overpayments, unapplied
  cash, refunds, transfers, and reconciliation can be represented without
  double-posting.
- **Data/schema:** Requires payments, allocations, reversal relationships,
  bank-evidence links, open-item references, and source/projection distinctions.
- **Migration:** Current amount-paid/balance fields and reconciliation links
  become compatibility projections until validated canonical records exist.
- **Reporting:** AR/AP, cash, aged balances, and reconciliation reports agree
  with posted journals and allocations.
- **Compatibility:** Existing reconciliation can retain its matcher and
  approval rationale while calling the canonical boundary later.
- **Security/audit:** Reversals and corrections require reason, capability,
  actor, source, and immutable audit records.
- **Backlog:** BL-06/08/09/10/12/13/14/15/16/17/19.
- **Risk:** Payment and allocation policy remains partly open under DEC-12–16.
- **Hard to change:** Whether a payment, allocation, and bank row are distinct
  concepts, and whether a posting can be reversed.

### 4.7 Periods, chart, control accounts, and configuration

**Recommended architecture boundary:** The core must have explicit fiscal-year,
period, chart, control-account, and configuration concepts, with validation,
audit, and effective-date support. DEC-04 should not select the final values or
policies.

**Options:**

1. Keep dates, accounts, mappings, and settings as loosely related fields.
2. Hard-code one UK chart and period policy into posting logic.
3. Provide explicit company-scoped entities and policy interfaces, with the
   final policy decisions made separately.

**Recommendation:** Option 3.

**Consequences:**

- **Accounting:** Postings resolve to a valid period and mapped account; closed
  periods and invalid mappings can be rejected.
- **Data/schema:** Requires logical fiscal-year, period, account, mapping, and
  configuration relationships; exact columns and version semantics remain
  subject to DEC-06–11.
- **Migration:** Historical dates and account names require deterministic
  mapping or visible exception handling.
- **Reporting:** Reports can use controlled period boundaries and stable account
  classifications.
- **Compatibility:** Existing company/VAT settings can be adapted into the
  future accounting configuration without making them canonical prematurely.
- **Security/audit:** Configuration and period changes are privileged and
  auditable; exact capability assignment remains DEC-05.
- **Backlog:** BL-06/07/08/13/15/17/24.
- **Risk:** Approving architecture without the later policies could be
  mistaken for approval of monthly periods, default accounts, or automatic
  year-end journals.
- **Hard to change:** Period identity, account classification, control-account
  meaning, and configuration effective dates after postings rely on them.

### 4.8 Deterministic VAT integration

**Recommended:** The posting layer consumes the deterministic VAT result
approved by DEC-03 through a versioned, freshness-checked adapter. It does not
introduce a second VAT calculation engine.

**Options:**

1. Recalculate VAT independently inside posting.
2. Use bank-feed VAT metadata or report calculations.
3. Consume the authoritative VAT service result and trace it into journal lines.

**Recommendation:** Option 3.

**Consequences:**

- **Accounting:** Output/input VAT postings use the approved DEC-03 Standard
  VAT/invoice-basis result.
- **Data/schema:** Requires tax-code/rate/treatment, source-line evidence,
  result version, freshness, and journal-line traceability.
- **Migration:** Historical VAT returns and unsupported/special treatment
  records remain visible; they are not silently recalculated.
- **Reporting:** VAT boxes reconcile to tax-coded posted lines and evidence.
- **Compatibility:** Existing VAT services remain reusable; the adapter becomes
  the posting boundary.
- **Security/audit:** VAT approvals and corrections use explicit authority and
  immutable evidence.
- **Backlog:** BL-05/06/08/10/14/15/17/23.
- **Risk:** Source freshness and adjustment details remain dependent on later
  decisions and the approved DEC-03 boundary.
- **Hard to change:** The source of VAT authority and historical return meaning.

### 4.9 Journal-authoritative reporting

**Recommended:** Server-side reporting reads posted journals and lines. Balance
projections are optional, rebuildable performance aids and never independent
financial truth.

**Options:**

1. Continue calculating reports from source documents and browser state.
2. Maintain separate report totals/materialized summaries as authority.
3. Use posted journals as authority with rebuildable projections and
   source/evidence drill-down.

**Recommendation:** Option 3.

**Consequences:**

- **Accounting:** Reports reflect posted accounting effects, not unposted
  workflow records or bank evidence.
- **Data/schema:** Requires report query contracts, journal/account indexes,
  optional projection rebuilds, and source drill-down relationships.
- **Migration:** Legacy reports need dual-read comparison before cutover;
  differences must be investigated rather than hidden.
- **Reporting:** Trial balance, ledger, P&L, balance sheet, VAT, AR/AP, cash,
  and aged reports share one authority.
- **Compatibility:** Existing frontend calculators become adapters/clients, not
  authorities.
- **Security/audit:** Report access remains company-scoped and report results
  can trace to journals, sources, actor, and corrections.
- **Backlog:** BL-06/07/09/13/15/17/19/20/23.
- **Risk:** Initial reports may expose current source-to-journal differences
  during migration.
- **Hard to change:** Report definitions and the meaning of published
  historical totals.

### 4.10 Capability-based security, tenant isolation, and audit

**Recommended architecture boundary:** Every accounting entity and mutation is
company-scoped, server-authorised, and auditable. The system uses capabilities
for operations such as post, reverse, close, reopen, edit chart, and change
configuration. DEC-05 decides the exact role/capability matrix.

**Options:**

1. Broad role-based writes and UI-only restrictions.
2. Server-side capabilities with role presets.
3. Fully custom per-company permissions at launch.

**Recommendation:** Adopt the capability mechanism in DEC-04; reserve the
exact mapping for DEC-05. Option 2 is the recommended DEC-05 direction, but it
is **not approved by DEC-04**.

**Consequences:**

- **Accounting:** Consequential operations have explicit authority and
  segregation boundaries.
- **Data/schema:** Requires company-safe relationships, membership checks,
  capability evaluation, actor/audit fields, and protected mutation paths.
- **Migration:** Existing broad roles require conservative mapping; deactivated
  membership must lose access immediately.
- **Reporting:** Reports and exports inherit company scope and permission
  checks.
- **Compatibility:** Existing routes may need protected adapters; generic
  journal/chart mutation cannot remain an authority bypass.
- **Security/audit:** Server-side checks are mandatory; audit captures actor,
  reason, source, approval, and request identity.
- **Backlog:** BL-01/02/03/06/07/19/23/24.
- **Risk:** A mechanism without the DEC-05 matrix could be inconsistently
  applied; RLS remains a separate decision.
- **Hard to change:** Capability names and operation boundaries once clients,
  audit, and role mappings depend on them.

### 4.11 Additive compatibility with Base44-shaped and legacy data

**Recommended:** Introduce the canonical model alongside current tables and
compatibility APIs. Validate legacy JSON journals and denormalized balances;
backfill only evidenced, balanced records; use controlled company/source
cutovers; never maintain two co-equal accounting authorities.

**Options:**

1. Destructively replace the current schema.
2. Automatically reconstruct all history.
3. Permanently maintain dual accounting authorities.
4. Additive migration with adapters, validation, comparison, and controlled
   cutover.

**Recommendation:** Option 4.

**Consequences:**

- **Accounting:** Canonical history is created only from validated evidence;
  unknown history is not invented.
- **Data/schema:** New canonical entities coexist temporarily with source and
  compatibility fields; provenance and migration state are required.
- **Migration:** Cohort, sequencing, validation, rollback checkpoints,
  dual-read comparison, and cutover remain DEC-22 decisions.
- **Reporting:** Legacy and canonical outputs can be compared before authority
  changes.
- **Compatibility:** Base44-shaped endpoints and current UI contracts can be
  preserved through adapters while the authority changes safely.
- **Security/audit:** Migration actions are company-scoped, idempotent,
  auditable, and reversible before cutover.
- **Backlog:** BL-03/04/06/07/08/09/12/14/15/17/23/24/25.
- **Risk:** Temporary duplication and parity monitoring increase operational
  complexity.
- **Hard to change:** The cutover authority, provenance rules, and meaning of
  historical records once reports and users depend on them.

## 5. Decisions deliberately left open

DEC-04 must not silently resolve these decisions:

- **DEC-05:** Exact capability matrix, roles, segregation of duties, and
  approval requirements.
- **DEC-06:** Financial-year start, company changes, and historical boundary
  policy.
- **DEC-07:** Period frequency, generation, close conditions, reopen authority,
  and reopening conditions.
- **DEC-08:** Reporting-only year-end versus explicit approved closing journals.
- **DEC-09:** Default UK chart, account types/subtypes, protected accounts, and
  company customization.
- **DEC-10:** Mandatory AR/AP, bank/cash, input/output VAT, and other
  control-account mappings.
- **DEC-11:** Effective-dated chart/configuration versioning details.
- **DEC-12–DEC-16:** Overpayments, unapplied cash, refunds, payment-on-account,
  and payment allocation policy.
- **DEC-17–DEC-21:** Retention, deletion/anonymisation, export, backup/recovery,
  and RLS/tenant-isolation policy.
- **DEC-22:** Historical migration cohort, compatibility contract, cutover,
  rollback, and legacy authority retirement.

Also left open by DEC-04:

- physical table names, exact API routes, service names, and framework choices;
- exact fiscal/calendar, chart, and permission values;
- specialist VAT scope beyond approved DEC-03;
- provider choices and direct HMRC integration;
- final product name and future markets/currencies;
- implementation sequencing and task selection.

## 6. What DEC-04 would actually lock in

DEC-04 approves the following architectural principles:

1. Normalized append-only journal headers and lines are the canonical posted
   accounting model.
2. Canonical postings are created through server-side transactional commands.
3. Double-entry balance and company/account/currency/period invariants are
   enforced before posting.
4. Canonical money uses integer minor units with explicit currency policy.
5. Every posting has source linkage, source/version context, and company-scoped
   idempotency.
6. Posted journals are immutable; reversals and corrections append linked
   journals.
7. Payments, allocations, and bank evidence are distinct concepts.
8. The DEC-03 deterministic VAT service remains authoritative through a
   traceable adapter.
9. Reports ultimately derive from posted journals; projections are rebuildable.
10. Accounting mutations are company-scoped, server-authorised, and auditable.
11. Legacy migration is additive, evidence-based, adapter-supported, and
    controlled; no destructive replacement or invented history.

These are architectural contracts, not approval of schema migrations or
implementation tasks.

## 7. Risks and difficult-to-change commitments

### Critical risks

- Generic journal writes remain a bypass if protected boundaries are not
  eventually enforced.
- Current invoice/bill totals, status fields, and reconciliation mutations may
  diverge from canonical postings.
- Historical JSON journals may be unbalanced, incomplete, or unreliable.
- VAT return results may change at cutover unless old and new authority are
  compared explicitly.

### High risks

- Exact permissions are unresolved and could permit the wrong user to post,
  reverse, close, or reopen.
- Period, year-end, chart, and control-account policies may constrain the
  logical architecture if chosen carelessly.
- Legacy compatibility adapters could become a permanent second authority.
- Tenant isolation, foreign keys, uniqueness, and RLS policy are not yet
  fully decided.

### Commitments that are difficult to change later

- What constitutes a posted journal and whether it can be edited or deleted.
- Whether reports are authoritative from journals or operational sources.
- Money representation and rounding semantics.
- Source identity and idempotency semantics.
- Whether payments and allocations are separate entities.
- Historical provenance and which records are considered canonical after
  cutover.

### Commitments intentionally kept changeable

- Account catalog and default mappings.
- Period frequency and close/reopen policy.
- Roles and exact capability grants.
- Physical schema naming and API shape.
- Provider integrations and direct HMRC filing.
- Migration cohort and cutover schedule.

## 8. Implementation consequences of DEC-04 approval

Approval permits the architecture to constrain future specifications; it does
not permit implementation to start. Before any code or schema work, the project
still needs:

1. explicit DEC-09–DEC-22 decisions where they affect the selected design;
2. an approved implementation task for BL-06/BL-07;
3. additive schema and compatibility design;
4. source freshness, period, chart, account, and capability contracts;
5. migration and rollback criteria;
6. test and parity strategy;
7. production security, backup, recovery, tenant-isolation, and observability
   decisions.

The affected backlog would include BL-01 through BL-05, BL-06–BL-10,
BL-12–BL-17, BL-19, BL-23–BL-26. This is a dependency consequence, not task
creation or implementation approval.

## 9. Recorded approval

Lee approved the following:

> Approve Option A: adopt the existing BL-06/BL-07 Accounting Core
> Architecture Review as the accounting-core foundation within the Technical
> Architecture, with the invariants and deliberate non-locks listed in this
> DEC-04 review. Keep DEC-05 through DEC-22 as separate unresolved decisions,
> keep BL-06 and BL-07 blocked, and do not treat this approval as
> implementation authorisation.

**Amendment path:** DEC-04 remains amendable through an explicit documented
decision by the product owner/stakeholder with accounting, security, and
architecture review. An amendment must identify accounting, data/schema,
migration, reporting, compatibility, security/audit, dependency, and backlog
consequences before any implementation direction changes.

**Later decision status:** DEC-05 was approved separately as the capability
model. This historical DEC-04 approval record does not keep DEC-05 unresolved.

## 10. Decision summary

| Item | Decision-only conclusion |
|---|---|
| **DEC-04 status** | **APPROVED — architecture only** |
| **Approved architecture** | Option A: adopt the existing review as the accounting-core foundation within the Technical Architecture, with targeted amendments |
| **Actually locked by approval** | Canonical normalized append-only journals; atomic server-side double-entry posting; integer minor units; source-linked company-scoped idempotency; immutable corrections; separate payments/allocations/bank evidence; deterministic VAT adapter; journal-authoritative reporting; capability/company/audit boundaries; additive compatibility |
| **Deliberately left open** | DEC-10 through DEC-22 policies, exact control-account mappings, role-preset refinements, retention/RLS, migration cohort/cutover, API/schema names, providers, and implementation sequencing |
| **Dependencies** | DEC-06, DEC-07, DEC-08, approved DEC-09, and DEC-10 through DEC-22 as applicable; BL-01–05, BL-06–10, BL-12–17, BL-19, BL-23–26 |
| **Implementation consequence** | Architecture constrains future specifications; no implementation, migration, or task is authorised by this review |
| **Next approvals required** | The applicable DEC-10 through DEC-22 decisions, then an approved implementation task |

**DEC-04 status:** **APPROVED — architecture only**
**DEC-05:** **APPROVED — separate capability-model decision**
**DEC-06:** **APPROVED — separate financial-year-policy decision**
**DEC-07:** **APPROVED — separate accounting-period-policy decision**
**DEC-08:** **APPROVED — separate reporting-only-year-end-policy decision**
**DEC-09:** **APPROVED — separate Chart of Accounts and Default Account Policy**
**DEC-10 through DEC-22:** **REMAIN UNRESOLVED AND UNAPPROVED**
**BL-06 / BL-07:** **BLOCKED**  
**Application-path changes:** **NONE**