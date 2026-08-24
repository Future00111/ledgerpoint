# Ledgerly Current Decision Register

**Purpose:** Clean approval list for accounting-core implementation  
**Reviewed sources:** Ledgerly Manifesto; Product Principles; PRD / Product
Scope; Technical Architecture; BL-06 / BL-07 Accounting Core Architecture
Review; BL-06 / BL-07 Accounting Core Decision Pack; Master Backlog; [Implementation
Readiness Review](ledgerly-implementation-readiness-review.md)
; [Implementation Brief](ledgerly-implementation-brief.md); [Source-Freshness
and Posting-Safety Contract](ledgerly-source-freshness-posting-safety-contract.md);
[Safety-Rule Ownership Record](ledgerly-safety-rule-ownership-record.md);
[Historical Accounting Migration Pilot
Plan](ledgerly-historical-accounting-migration-pilot-plan.md);
[First Implementation Approval
Package](ledgerly-first-implementation-approval-package.md)
**Register status:** Decisions 1–22 approved; DEC-22 is a migration/cutover
policy approval only
**Implementation gate:** BL-06 and BL-07 remain **BLOCKED**

## How to use this register

- **APPROVED** means the decision is explicitly accepted and may constrain
  future work.
- **RECOMMENDED** means Replit's proposed option only; it is not approval.
- **REQUIRES USER DECISION** means Lee must approve, reject, or amend it before
  the affected accounting-core work can begin.

The implications below describe why each decision matters. They are not
permission to implement. The current product name and provider choices are not
listed as separate accounting-core gates; they remain open in the Product
Decisions Register and become gating if the selected scope makes them relevant
to the accounting core.

## Foundational decisions

### DEC-01 — Governance document hierarchy

- **Status:** APPROVED
- **Decision:** Manifesto → Product Principles → PRD / Product Scope →
  Technical Architecture → Feature Specifications / Master Backlog.
- **Options available:** The approved hierarchy is the current option; it may
  only be changed through an explicit documented amendment.
- **Replit's recommendation:** Retain the approved hierarchy.
- **Why it is recommended:** It separates purpose, principles, scope,
  technical design, and implementation work without allowing code or backlog
  pressure to override higher authority.
- **Accounting implications:** None directly; accounting decisions must be
  resolved under the hierarchy.
- **Data/schema implications:** None directly; approved architecture must still
  define the accounting data contracts.
- **Migration implications:** Any future amendment must document migration and
  backwards-compatibility consequences.
- **Backlog implications:** The Master Backlog remains planning authority at
  level 5, but it does not authorise BL-06 or BL-07.
- **Dependency:** None. This decision is already approved.

### DEC-02 — Final launch PRD / Product Scope

- **Status:** APPROVED
- **Decision:** Ledgerly's initial product scope is authoritative core
  accounting, UK accounting and VAT preparation, invoices, bills, payments,
  banking, reconciliation, and reporting. The initial market/currency direction
  is UK/GBP.
- **Options available:** The approved initial-scope option is the focused
  accounting foundation above. Additional markets, currencies, and capabilities
  may be proposed later through the Product Decisions and governance process.
- **Replit's recommendation:** Implement only the approved initial scope in the
  first accounting-core work, while keeping the architecture extensible and
  avoiding unnecessary UK/GBP hard-coding.
- **Why it is recommended:** It gives the accounting foundation a clear,
  deliberately bounded posting surface while preserving a safe path to future
  markets, currencies, and capabilities.
- **Accounting implications:** Only the approved initial source types and
  accounting/tax treatments may create accounting effects. Additional sources
  must not post until separately approved.
- **Data/schema implications:** Currency, tax, source, posting, and reporting
  contracts must support the initial UK/GBP scope without making UK/GBP an
  irreversible structural assumption.
- **Migration implications:** Initial migration and canonical backfill are
  limited to the approved scope; future-market or future-capability records
  require a later approved compatibility decision.
- **Backlog implications:** Constrains BL-06, BL-07, BL-08, BL-09, BL-12,
  BL-13, BL-14, BL-15, BL-17, and BL-25. It does not approve any of them.
- **Dependency:** Product Principles and Decisions 1–3 (approved). Subsequent
  accounting-core decisions remain required.

### DEC-03 — VAT schemes, adjustments, and MTD/HMRC scope

- **Status:** APPROVED
- **Decision:** Approve S1 + A + H1 for the initial launch:
  - **S1:** UK Standard VAT Scheme using invoice-basis accounting.
  - **A:** Controlled, source-linked and return-level corrections only.
  - **H1:** Supported VAT-return preparation and auditable export/hand-off,
    without direct HMRC submission.
- **Decision review:** [DEC-03 VAT Scope
  Review](ledgerly-dec-03-vat-scope-review.md).
- **Approved scope:** Corrections require an explicit reason, evidence,
  appropriate VAT-box mapping, reviewer/approver information, and an audit
  trail. Free-form VAT-box overrides are prohibited. Ledgerly prepares
  supported VAT returns with box-by-box evidence and source drill-down, review,
  approval, locking, and export audit records. It provides human-readable and
  structured export/hand-off. A return must be labelled prepared/exported, not
  filed, unless there is a verified HMRC submission receipt.
- **Future scope, not approved for initial launch:** Cash Accounting, Flat
  Rate, Annual Accounting, Retail, margin, agricultural/sector-specific,
  partial-exemption, Capital Goods, import/postponed-import VAT, broad domestic
  or international reverse-charge coverage, bad-debt relief/recovery,
  specialist adjustments, direct HMRC submission, HMRC authorisation/account
  workflows, obligations, and HMRC receipts/rejections/retries.
- **Why approved:** VAT must remain explainable and authoritative;
  unsupported scheme logic must not be approximated by the posting engine, and
  an export must not be represented as an HMRC filing.
- **Accounting implications:** Determines tax account behavior, VAT evidence,
  return boxes, adjustments, payment timing, and whether filing creates
  consequential external actions.
- **Data/schema implications:** Determines tax-rule versions, source evidence,
  VAT snapshots, return structures, adjustment relationships, export/filing
  state, and audit records.
- **Migration implications:** Historical VAT records require scheme-aware
  classification; unsupported or ambiguous history must remain visible and must
  not be silently recalculated as Standard VAT.
- **Backlog implications:** Gates BL-05, BL-06, BL-07, BL-08, BL-15, BL-17, and
  BL-18, BL-23, BL-24, and BL-25. This remains a dependency statement, not
  implementation approval.
- **Dependency:** DEC-02. This approved scope constrains DEC-04 and subsequent
  decisions; it does not approve them.
- **Amendment rule:** DEC-03 may be amended only through the Living Product
  Decisions process. An amendment must document effects on accounting data,
  schema, migration, backwards compatibility, reporting, dependent features,
  and backlog items before implementation direction changes.

### DEC-04 — Accounting-core architecture adoption

- **Status:** APPROVED — architecture only
- **Decision:** Option A is approved. The BL-06 / BL-07 Accounting Core
  Architecture Review becomes the accounting-core foundation within the
  Technical Architecture, with the targeted amendments and deliberate
  non-locks recorded in the [DEC-04 adoption review](ledgerly-dec-04-accounting-core-adoption-review.md).
- **Approved architecture:** Canonical normalized append-only journals;
  server-side transactional double-entry posting; integer minor-unit money with
  explicit currency; source linkage, source/version context, and
  company-scoped idempotency; immutable posted journals with linked
  reversals/corrections; separate payments, allocations, and bank evidence;
  DEC-03's deterministic VAT service through a traceable adapter;
  journal-authoritative reporting with rebuildable projections; company-scoped
  server-side capability/audit boundaries; and additive, evidence-based
  compatibility and migration.
- **Decision boundary:** DEC-05 and DEC-06 were separately approved as the
  capability model and financial-year policy. DEC-07 through DEC-22 are
  separately governed decisions. DEC-04 selects no period, chart,
  control-account, payment-treatment, retention, RLS, migration-cohort,
  cutover, schema, API, or implementation policy reserved to those decisions.
- **Accounting implications:** Establishes the canonical journal, posting,
  payment, allocation, source, audit, VAT-adapter, and reporting authority
  contracts; the remaining policy decisions refine how those contracts operate.
- **Data/schema implications:** Establishes the logical normalized journal,
  idempotency, source-link, and protected mutation boundaries without approving
  physical schema or migration work.
- **Migration implications:** Establishes additive adapters, validation,
  dual-read comparison, and controlled cutover as the architecture; DEC-22
  approves the cohort, sequencing, rollback, and authority-retirement policy.
- **Backlog implications:** Direct prerequisite for BL-06 and BL-07 and
  dependency for BL-08, BL-09, BL-13, BL-14, BL-15, and BL-17.
- **Implementation limit:** Architecture approval does not authorise an
  implementation task, code, schema, migration, UI, workflow, dependency,
  deployment, or publishing change. BL-06 and BL-07 remain blocked.
- **Dependency:** DEC-02 and DEC-03; implementation planning and explicit
  implementation approval remain required before implementation.
- **Amendment rule:** DEC-04 may be amended only through an explicit documented
  decision that identifies accounting, data/schema, migration, reporting,
  compatibility, security/audit, dependency, and backlog consequences before
  implementation direction changes.

## Authority, period, and chart decisions

### DEC-05 — Accounting capability and approval matrix

- **Status:** APPROVED — product/architecture decision only
- **Decision review:** [DEC-05 Capability and Approval Matrix
  Review](ledgerly-dec-05-capability-approval-review.md).
- **Decision:** Option B is approved: server-side capabilities with
  conservative OWNER, ADMIN, ACCOUNTANT, MANAGER, and READ-ONLY role presets.
- **Approved principles:** Capabilities, not role names alone, authorise
  consequential accounting actions; every operation is checked server-side in
  the active company context; membership is active and company-scoped; checks
  cannot rely solely on browser/UI controls, client-supplied roles, arbitrary
  role strings, or hidden controls; posted journals cannot be edited or
  deleted; and AI persistence requires the equivalent manual capability.
- **Role boundary:** OWNER has broad authority subject to safety, immutability,
  and audit controls. ADMIN has no default posting, reversal/correction, or
  period-reopen authority. ACCOUNTANT has normal accounting and posting
  authority, with reasoned/audited controlled corrections. MANAGER has scoped
  operational access and no default posting, reversal/correction, or reopen
  authority. READ-ONLY has no mutation path.
- **Audit and migration:** Consequential operations retain applicable actor,
  company, capability, target, source, reason, approval, result, request
  context, and audit evidence. Existing broad roles map conservatively, and
  ambiguous authority becomes a visible review exception.
- **Accounting implications:** Controls consequential mutations and preserves
  explicit actor, approval, correction, immutability, and audit boundaries.
- **Data/schema implications:** Requires validated capability identifiers,
  active membership and company scoping, protected mutation contracts, and
  authorization evidence.
- **Migration implications:** Existing broad roles require conservative mapping;
  permission changes apply to future actions while historical audit retains its
  original authority context.
- **Backlog implications:** Defines the intended BL-02 role/capability
  contract and the permission boundary for BL-01, BL-03, BL-06, BL-07, BL-19,
  and BL-24. This does not approve any implementation item.
- **Dependencies:** DEC-04, DEC-06, approved DEC-09, and applicable DEC-10
  through DEC-22 decisions.
- **Implementation limit:** DEC-05 does not authorise an implementation task,
  code, schema, migration, UI, workflow, dependency, deployment, or publishing.
  BL-06 and BL-07 remain blocked.
- **Amendment rule:** Future capabilities or role-preset changes must be
  recorded through the Living Product Decisions process and must not weaken
  approved accounting safety boundaries.

### DEC-06 — Financial-year start and change policy

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-06 Financial-Year Policy
  Review](ledgerly-dec-06-financial-year-policy-review.md).
- **Decision:** Approve the recommended company-configurable recurring
  financial-year start with a launch default and an after-posting freeze.
- **Approved policy:** New UK-focused companies default to 1 April through
  31 March, but may choose another valid recurring start during setup or before
  the first canonical posted accounting record. Financial-year identity is
  explicitly company-scoped and distinct from document dates, transaction
  dates, VAT periods, tax years, and bank dates.
- **Approved safety boundary:** Once canonical posted records exist, ordinary
  configuration must not change the start retrospectively or silently
  reclassify posted records. Any future transition must be separately designed,
  approved, privileged, and fully audited.
- **Approved historical/reporting boundary:** Partial first years and normal
  recurring years are supported. Historical assignment uses source evidence and
  must not invent accounting data. Reporting relies on the DEC-04 canonical
  accounting model.
- **Approved permission boundary:** Financial-year configuration is
  consequential accounting configuration subject to DEC-05 active membership,
  company scope, server-side capability checks, privileged authority, and
  audit.
- **Future flexibility:** The policy does not permanently restrict different
  starts, additional markets, currencies, or international accounting
  requirements.
- **Accounting implications:** Every journal must resolve to one financial year;
  boundary changes require controlled review and may affect reports, but must
  not silently alter posted accounting history or VAT evidence.
- **Data/schema implications:** Requires fiscal-year boundaries and links from
  periods and postings to the applicable year.
- **Migration implications:** Historical records need deterministic date
  assignment; missing or ambiguous dates require review.
- **Backlog implications:** Gates BL-07 and BL-17 and affects BL-06, BL-08,
  BL-13, and BL-15.
- **Dependency:** DEC-04, DEC-05, and approved DEC-08 year-end policy.
- **Implementation limit:** DEC-06 is a product/accounting-policy approval
  only. It does not authorise code, schema, migration, UI, workflow,
  dependency, deployment, publishing, or an implementation task. BL-06 and
  BL-07 remain blocked.
- **Amendment rule:** Future changes must use the Living Product Decisions
  process and must preserve historical identity, auditability, and the
  DEC-05 capability boundary.

### DEC-07 — Period frequency, creation, close, and reopen

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-07 Accounting-Period Policy
  Review](ledgerly-dec-07-accounting-period-policy-review.md).
- **Decision:** Contiguous monthly accounting periods anchored to each
  company's approved DEC-06 financial year.
- **Approved creation and state:** Known periods are generated automatically,
  including future periods before they become active for posting. The
  authoritative lifecycle uses only `OPEN` and `CLOSED`.
- **Approved posting boundary:** The server assigns a canonical posting to
  exactly one period from the validated posting date. The client cannot choose
  an arbitrary period, and the system cannot silently move a posting to another
  period.
- **Approved closed-period boundary:** Closed periods prevent ordinary posting
  with no direct bypass. Corrections use controlled privileged reopening or an
  appropriately approved adjustment in a later open period.
- **Approved close/reopen boundary:** Period creation, close, and reopen use
  DEC-05 active-membership, company-scope, server-side capability, authority,
  validation, reason, approval where required, and audit controls. Drafts,
  unallocated payments, unreconciled bank evidence, and ordinary VAT timetable
  differences are visible warnings rather than automatic blockers; genuine
  accounting or VAT integrity failures can block close.
- **Approved integrity boundary:** Period configuration must never silently
  rewrite or reclassify posted accounting history. Reporting remains based on
  the DEC-04 canonical accounting model, and historical migration uses
  evidence without inventing periods or accounting facts.
- **Accounting implications:** Determines posting dates, correction/reversal
  behavior, VAT cutoffs, and period-based reports.
- **Data/schema implications:** Requires fiscal years, periods, status,
  close/reopen actor, timestamps, reasons, and posting-period links.
- **Migration implications:** Historical records must be assigned to periods
  using available evidence; ambiguous information remains an explicit
  migration limitation.
- **Backlog implications:** Gates BL-06, BL-07, BL-15, BL-17, and BL-24.
- **Dependency:** DEC-05, DEC-06, and approved DEC-08 year-end policy.
- **Implementation limit:** DEC-07 is a product/accounting-policy approval
  only. It does not authorise code, schema, migration, UI, workflow,
  dependency, deployment, publishing, or an implementation task. BL-06 and
  BL-07 remain blocked.
- **Amendment rule:** Future changes must use the Living Product Decisions
  process and preserve DEC-04 immutability, DEC-05 capability, audit, and
  historical-reporting boundaries.

### DEC-08 — Year-end treatment

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-08 Year-End Treatment and Financial-Year
  Transition Review](ledgerly-dec-08-year-end-treatment-review.md).
- **Decision:** Use reporting-only year-end treatment at launch.
- **Approved year-end method:** Financial-year boundaries affect reporting and
  financial-year presentation without mutating canonical journal history. Do
  not automatically create closing journals, retained-earnings transfer
  journals, or artificial year-end postings.
- **Approved account/reporting boundary:** Revenue, cost of sales, and expenses
  are temporary for financial-year reporting. Assets, liabilities, and equity
  continue across years. Current/prior-year results and any accumulated-results
  or retained-earnings presentation derive authoritatively from canonical
  records and remain traceable; reports do not manufacture journals.
- **Approved completion boundary:** All DEC-07 periods in a financial year must
  be closed before year-end review/completion. Completion is a derived condition
  plus an auditable review/completion event, not a separate overlapping
  accounting-period state.
- **Approved validation and authority boundary:** Drafts, unallocated payments,
  unreconciled banking, and ordinary VAT timetable differences are visible
  warnings unless another policy later decides otherwise. Accounting or VAT
  integrity failures can block completion. Year-end actions require DEC-05
  active membership, company scope, server-side capability enforcement,
  appropriate authority, and audit evidence.
- **Approved correction and VAT boundary:** Post-year-end errors use controlled
  period reopen, explicit correction/reversal, or an approved later-period
  adjustment. They must not rewrite history, silently change dates or financial
  years, or overwrite balances. DEC-03 remains the sole VAT authority.
- **Approved migration/future boundary:** Migration must not invent closing
  journals, retained-earnings postings, approvals, year-end events, dates, or
  accounting facts. Explicit closing/retained-earnings journals remain possible
  only through a later approved decision and normal canonical posting controls.
- **Accounting implications:** Determines treatment of P&L, retained earnings,
  balance-sheet carry-forward, reopening, and year-end corrections.
- **Data/schema implications:** If closing entries are approved, they require an
  explicit source type, idempotency key, period link, and audit record.
- **Migration implications:** Historical closing entries must not be
  reconstructed where evidence is missing.
- **Backlog implications:** Gates BL-06, BL-07, and BL-17.
- **Dependency:** DEC-04, DEC-05, DEC-06, and DEC-07; DEC-09 onward remains
  separate.
- **Implementation limit:** DEC-08 is a product/accounting-policy approval
  only. It does not authorise code, schema, migration, UI, workflow,
  dependency, deployment, publishing, or an implementation task. BL-06 and
  BL-07 remain blocked.
- **Amendment rule:** Future changes must use the Living Product Decisions
  process and preserve DEC-03 VAT authority, DEC-04 immutable journals, DEC-05
  capability/audit controls, and DEC-06/DEC-07 identities.

### DEC-09 — Default chart of accounts and template

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-09 Chart of Accounts and Default Account Policy
  Review](ledgerly-dec-09-chart-of-accounts-policy-review.md).
- **Decision:** Adopt the versioned UK small-business Chart of Accounts
  template, copied into each company and limited to the concise, practical
  launch chart described in the review.
- **Approved taxonomy and identity:** The authoritative primary types are Asset,
  Liability, Equity, Revenue, Cost of Sales, and Expense. Accounts have stable
  identities independent of names, codes, and display labels; explicit
  classification and approved mappings determine accounting meaning.
- **Approved codes and lifecycle:** Codes are company-scoped four-digit
  presentation/configuration attributes. Availability uses only `ACTIVE` and
  `INACTIVE`; historical is derived from references and system is a protection
  role. Referenced accounts deactivate rather than delete, and account merging
  is not supported at launch.
- **Approved protection and reporting boundary:** Protected system-account
  candidates may include AR, AP, bank/cash, VAT, VAT settlement, and applicable
  posted retained-results/equity accounts. Reporting derives from stable
  account identity, explicit classification, and canonical journals—not names,
  code ranges, or frontend logic.
- **Control-mapping boundary:** DEC-09 does not select active control-account
  mappings or invoice, bill, payment, or VAT posting mappings; those remain
  DEC-10 decisions.
- **Migration implications:** Historical mapping is evidence-based. Ambiguous
  accounts remain explicit migration exceptions and historic account references
  are never invented, deleted, or rewritten.
- **Backlog implications:** Gates BL-06, BL-07, BL-15, BL-17, and dependent
  source-posting work.
- **Dependency:** DEC-02, DEC-03, DEC-04, and DEC-05.
- **Implementation limit:** DEC-09 is a product/accounting-policy approval
  only. It does not authorise code, schema, migration, UI, workflow,
  dependency, deployment, publishing, or an implementation task. BL-06 and
  BL-07 remain blocked.

### DEC-10 — Mandatory control-account mappings

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-10 Control-Account Mapping Policy
  Review](ledgerly-dec-10-control-account-mapping-policy-review.md).
- **Decision:** Approve protected, company-scoped mappings for one AR account,
  one AP account, each accounting bank/cash location, one Output VAT account,
  and one Input VAT account. VAT settlement is protected only where an
  approved VAT-return settlement workflow requires it.
- **Approved ordinary-account boundary:** Revenue, Cost of Sales, ordinary
  Expenses, ordinary Assets, and general Equity remain validated configurable
  selections rather than universal control accounts. Retained earnings is not
  a launch default control account, and no automatic retained-earnings
  postings are created.
- **Approved change and history boundary:** Mapping changes are prospective
  only, company-scoped, server-side capability-gated under DEC-05, validated,
  reasoned where required, and audited. Historical journals retain their
  resolved account identity and are never rewritten or reinterpreted.
- **Approved evidence boundary:** Bank-feed evidence remains distinct from
  accounting bank/cash accounts and journals. Reports resolve historical
  accounting from the canonical journal and posting-time account identity,
  not current mappings.
- **Versioning boundary:** DEC-11 remains responsible for the complete
  configuration-versioning and effective-dating mechanism.
- **Accounting implications:** Determines debit/credit destinations, VAT
  classification, control-account integrity, and report grouping.
- **Data/schema implications:** Requires typed mapping records, effective dates,
  posting configuration snapshots, and audit evidence for changes.
- **Migration implications:** Existing categories and account references need
  reviewed mapping; unresolved history must remain visible as legacy.
- **Backlog implications:** Gates BL-06, BL-07, BL-08, BL-09, BL-13, BL-15, and
  BL-17.
- **Dependency:** DEC-09 and DEC-03.
- **Implementation limit:** DEC-10 is a product/accounting-policy approval
  only. It does not authorise code, schema, migration, UI, workflow,
  dependency, deployment, publishing, or an implementation task. BL-06 and
  BL-07 remain blocked.

### DEC-11 — Account and configuration versioning

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-11 Configuration Versioning and Effective Dating
  Review](ledgerly-dec-11-configuration-versioning-review.md).
- **Decision:** Use immutable, company-scoped, effective-dated versions for
  material accounting configuration that can affect future canonical postings.
  Resolve the applicable version from the validated canonical posting date and
  preserve the version identity and resolved account IDs on each posting.
- **Approved boundaries:** Effective ranges cannot overlap or contain an
  unexplained gap where configuration is required. Future-dated changes are
  the normal path; ordinary backdating over posted journals or closed periods
  is prohibited. Cosmetic account name/code changes do not require a new
  accounting version unless they change material accounting meaning.
- **Approved history and authority boundary:** Later versions never rewrite
  posted journals, historical VAT, AR/AP balances, financial-year assignment,
  or reporting meaning. Material changes use DEC-05 capabilities, validation,
  appropriate approval, reason, and immutable audit evidence.
- **Deliberate non-lock:** DEC-11 does not decide payment edge cases, retention,
  export, backup/recovery, RLS, migration/cutover, or other DEC-12 through
  DEC-22 policies.
- **Accounting implications:** Prevents retroactive remapping of posted
  entries; corrections use explicit replacement or reversal behavior.
- **Data/schema implications:** Requires version records, effective dates,
  audit, validity checks, and posting references to the applied version.
- **Migration implications:** Legacy records need a known version where
  possible, or an explicit legacy/unknown marker.
- **Backlog implications:** Gates BL-06, BL-07, BL-08, BL-13, BL-15, and BL-17.
- **Dependency:** DEC-09 and DEC-10.
- **Implementation limit:** DEC-11 is a product/accounting-policy approval
  only. It does not authorise code, schema, migration, UI, workflow,
  dependency, deployment, publishing, or an implementation task. BL-06 and
  BL-07 remain blocked.

## Source and payment decisions

### DEC-12 — Payment, Allocation and Settlement Policy

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-12 Payment, Allocation and Settlement Policy
  Review](ledgerly-dec-12-payment-allocation-settlement-policy-review.md).
- **Decision:** Keep payment evidence, accounting payment, allocation, and
  derived document settlement as distinct concepts. Use a standalone canonical
  payment event that posts
  money exactly once, many-to-many allocation records, and settlement status
  derived from authoritative open-item/allocation data. Allocation changes are
  append-only reversal/supersession events and do not create duplicate cash or
  AR/AP journals.
- **Approved policy:** Direct customer payments are Bank/Cash to AR; direct
  supplier payments are AP to Bank/Cash. Allocation does not duplicate
  accounting, settlement is derived, bank evidence is not itself a payment,
  and historical payment journals and allocation history remain immutable.
- **Boundary:** Do not over-allocate documents or discard excess money.
  Customer/supplier overpayment treatment, first-class unapplied cash, refund
  workflow, and payment-on-account scope remain DEC-13 through DEC-16.
  Source freshness remains a separate unresolved posting-safety dependency;
  this review neither decides nor reassigns it.
- **Accounting implications:** Direct customer payments are Bank/Cash to AR;
  direct supplier payments are AP to Bank/Cash. Bank evidence links to payment
  accounting idempotently and is never itself a payment journal.
- **Data/schema implications:** Requires payment, allocation, open-item,
  canonical-journal, evidence, configuration, idempotency, and immutable audit
  relationships when implementation is separately authorised.
- **Migration implications:** Historical payment/settlement relationships are
  migrated only from evidence; ambiguity is a DEC-22 exception.
- **Backlog implications:** Informs BL-06, BL-07, BL-09, BL-10, BL-14, and
  BL-16; implementation remains blocked pending applicable later decisions and
  an explicitly authorised task.
- **Dependency:** DEC-03 through DEC-11; DEC-13 through DEC-16 build on it.

### DEC-13 — Overpayments, Unapplied Cash and Excess Payment Policy

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-13 Overpayments, Unapplied Cash and Excess Payment
  Policy Review](ledgerly-dec-13-overpayments-unapplied-cash-policy-review.md).
- **Decision:** Retain customer excess as a distinct
  customer-credit/receipt-on-account liability and supplier excess as a
  supplier-prepayment/receivable asset, with valid allocations and balances
  kept separate.
- **Approved policy:** Never discard or cap excess money. Permit a known-party
  payment before allocation, prevent allocation beyond the payment remainder
  or document open amount, and use controlled canonical reclassification when
  an approved party balance later moves to AR/AP.
- **Boundary:** DEC-14 retains authority over detailed first-class unapplied
  cash workflow, DEC-15 over refunds, and DEC-16 over user-facing
  payment-on-account launch scope. Bank evidence is not automatically a
  payment, and unmatched evidence is not automatically a party credit.
- **Accounting implications:** Customer excess is a liability; supplier excess
  is an asset. Statements and aging must distinguish these balances from AR/AP
  open items.
- **Migration implications:** Historical excess, credit, prepayment, and
  allocation states require evidence; ambiguity is a DEC-22 exception.
- **Backlog implications:** Informs BL-06, BL-07, BL-09, BL-10, BL-14,
  and BL-16; all remain blocked pending applicable later decisions and an
  explicitly authorised task.
- **Dependency:** DEC-04, DEC-09, DEC-10, DEC-11, and DEC-12.

### DEC-14 — Unapplied Cash Workflow Policy

- **Status:** APPROVED — product/accounting workflow policy only
- **Decision review:** [DEC-14 Unapplied Cash Workflow Policy
  Review](ledgerly-dec-14-unapplied-cash-workflow-policy-review.md).
- **Approved policy:** Define the detailed user workflow for identifying, reviewing,
  managing, and allocating unapplied customer and supplier cash.
- **Options available:** (a) metadata flag only; (b) dedicated account/subledger
  state; or (c) immediate allocation.
- **Approved workflow:** Use a dedicated unapplied-cash workspace with
  contextual entry points, deterministic suggestions, and explicit user
  confirmation. Do not silently auto-allocate at launch.
- **Why it is recommended:** It maintains traceability and avoids assigning cash
  to the wrong customer, supplier, or document.
- **Accounting implications:** Cash posts once while allocation, settlement,
  customer-credit/supplier-prepayment effects, and bank evidence remain
  distinct and reconcilable under DEC-12 and DEC-13.
- **Data/schema implications:** Requires explicit remainder, allocation,
  reversal, workflow status, suggestion, and journal relationships.
- **Migration implications:** Unmatched historical bank matches need reviewed
  classification rather than arbitrary attachment.
- **Boundary:** DEC-15 retains refunds and DEC-16 retains user-facing
  payment-on-account scope. Source freshness remains separate; DEC-22 governs
  migration/cutover policy.
- **Backlog implications:** Gates BL-09, BL-14, BL-16, and BL-17.
- **Dependency:** DEC-13 and DEC-10.

### DEC-15 — Refund workflow and scope

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-15 Refund Policy
  Review](ledgerly-dec-15-refund-policy-review.md).
- **Approved policy:** Define eligible refund sources, accounting treatment, payment
  reversal boundaries, VAT effects, approval controls, and launch scope.
- **Options available:** (a) standalone refunds; (b) refunds require a linked
  credit note or return source; or (c) standalone refunds only against
  unapplied balances.
- **Approved workflow:** Use controlled customer refunds from available
  customer credits and supplier refund receipts against available supplier
  prepayments, with separate payment and allocation reversal mechanisms.
- **Why it is approved:** It preserves the reason and accounting lineage for
  money leaving or returning to the business.
- **Accounting implications:** Customer refunds debit customer-credit liability
  and credit bank/cash; supplier refund receipts debit bank/cash and credit
  supplier-prepayment asset. Credit notes, payment reversals, and allocation
  reversals remain separate canonical paths.
- **Data/schema implications:** Requires refund sources, links to payments and
  reversals, approval state, and idempotency.
- **Migration implications:** Existing bank rows linked to credits need
  validation before being treated as refunds.
- **Boundary:** DEC-16 retains payment-on-account scope; DEC-22 retains
  migration authority. Source freshness remains separate.
- **Backlog implications:** Gates BL-10, BL-14, BL-16, and payment workflows.
- **Dependency:** DEC-13, DEC-14, DEC-03, and DEC-12.

### DEC-16 — Payment-on-account scope

- **Status:** APPROVED — product/accounting launch-scope policy only
- **Decision review:** [DEC-16 Payment-on-Account Launch Scope
  Review](ledgerly-dec-16-payment-on-account-launch-scope-review.md).
- **Decision review:** [DEC-16 Payment-on-Account Launch Scope
  Review](ledgerly-dec-16-payment-on-account-launch-scope-review.md).
- **Approved policy:** Do not expose a separate user-facing payment-on-account
  feature, workflow, navigation item, accounting object, or journal type at
  launch. Use known-party payments, DEC-13 customer credits and supplier
  prepayments, DEC-14 unapplied cash, explicit allocation, and DEC-15 refunds.
- **Options available:** (a) reject payments without a source; (b) customer
  payment-on-account only; or (c) customer and supplier payment-on-account.
- **Why it is approved:** It avoids an ambiguous extra label and preserves
  accounting correctness, clear user language, and auditable allocation and
  refund decisions.
- **Accounting implications:** Payment, allocation, open-item, refund, and
  statement balances remain separate.
- **Data/schema implications:** The approved launch scope reuses approved
  payment, party-balance, allocation, refund, and audit concepts; a later
  explicit classification would require additional intent and history fields.
- **Migration implications:** Unmatched bank rows need approved classification;
  old paid totals cannot be assumed to represent on-account amounts.
- **Boundary:** DEC-22 migration/cutover policy is approved.
  Source freshness remains separate.
- **Backlog implications:** Gates BL-09, BL-14, and BL-16.
- **Dependency:** DEC-13, DEC-14, and DEC-15.

## Retention, export, recovery, and tenant decisions

### DEC-17 — Audit retention period

- **Status:** APPROVED — product/governance policy only
- **Decision review:** [DEC-17 Audit Retention Period
  Review](ledgerly-dec-17-audit-retention-period-review.md).
- **Approved policy:** Use class-based retention. Retain posted journals and
  authoritative evidence required to explain them for the company life plus the
  applicable legal/regulatory retention period. Apply separate proportionate
  classes to personal data, documents, and AI actions/outputs.
- **Options available:** (a) retain for the company life; (b) use a defined
  legal period; or (c) retain accounting evidence indefinitely while applying a
  separate policy to personal data, documents, and AI records.
- **Why it is approved:** Financial history must remain reconstructable while
  allowing privacy and retention rules to differ by data type.
- **Accounting implications:** Posted journals, approvals, source links, and
  corrections cannot be casually removed.
- **Data/schema implications:** Requires retention classes, explicit triggers,
  legal-hold state,
  actor/timestamp evidence, and durable audit relationships.
- **Migration implications:** Historical records need classification; missing
  audit evidence remains visible rather than fabricated.
- **Boundary:** DEC-18 remains responsible for deletion, anonymisation,
  archival, redaction, destruction, and subject-access-related handling.
  DEC-21 and DEC-22 retain their own policy boundaries. Source freshness
  remains separate.
- **Backlog implications:** Gates BL-18, BL-19, BL-21, BL-24, and BL-25.
- **Dependency:** DEC-02, DEC-04, DEC-05, and DEC-18.

### DEC-18 — Deletion and anonymisation policy

- **Status:** APPROVED — product/governance/data-lifecycle policy only
- **Decision review:** [DEC-18 Deletion, Anonymisation, Archival and Redaction
  Policy Review](ledgerly-dec-18-data-disposal-policy-review.md).
- **Approved policy:** Use controlled, class-based disposal after the applicable
  DEC-17 retention requirement. Expiry creates eligibility only; it never
  automatically deletes data. Preserve canonical accounting and required audit
  evidence, permit eligible non-authoritative disposal only after dependency and
  hold checks, and apply proportionate personal-data treatment where lawful.
- **Options available:** (a) physical deletion; (b) no accounting/audit deletion
  with controlled personal-data redaction; or (c) archive all records.
- **Why it is approved:** Deletion must not become an alternative way to
  correct history or make balances unreproducible.
- **Accounting implications:** Corrections remain reversals, credit notes, or
  replacement entries; original evidence remains traceable.
- **Data/schema implications:** Requires immutable records, redaction markers,
  archive state, referential safety, and legal-hold handling.
- **Migration implications:** Historical deletion gaps must be recorded as gaps,
  not concealed during migration.
- **Boundary:** DEC-19 retains export policy, DEC-20 backup/recovery, DEC-21
  tenant isolation, and DEC-22 migration/cutover. Source freshness remains
  separate.
- **Backlog implications:** Gates BL-10, BL-18, BL-19, BL-21, and BL-24.
- **Dependency:** DEC-17 and DEC-05.

### DEC-19 — Export formats, scope, and permissions

- **Status:** APPROVED — product/data-export policy only
- **Decision review:** [DEC-19 Export Policy
  Review](ledgerly-dec-19-export-policy-review.md).
- **Decision review:** [DEC-19 Export Policy
  Review](ledgerly-dec-19-export-policy-review.md).
- **Approved policy:** Support company-scoped PDF and CSV human-readable
  reports; company-scoped CSV and versioned JSON for canonical accounting and
  audit data; bounded operational CSV exports; specialised audit exports;
  bounded document downloads/bundles; and interpretation-safe configuration
  extracts.
- Do not provide an unrestricted full-company database/archive export as a
  default launch feature.
- **Options available:** (a) CSV/PDF; (b) CSV plus machine-readable JSON; or
  (c) a full archive including documents and audit evidence.
- **Why it is approved:** It supports both operational use and durable
  system-to-system/accounting evidence without conflating report layouts with
  canonical data.
- **Accounting implications:** Export totals must reconcile to posted journals
  and expose source/audit links appropriate to the user's authority.
- **Data/schema implications:** Export contracts become versioned compatibility
  interfaces and export events must be audited.
- **Migration implications:** Legacy formats must be labelled as legacy and not
  treated as canonical output.
- **Boundary:** DEC-20 retains backup/recovery, DEC-21 tenant isolation, and
  DEC-22 migration/cutover. Source freshness remains separate.
- **Backlog implications:** Gates BL-17, BL-18, BL-23, and BL-24.
- **Dependency:** DEC-04, DEC-05, DEC-17, and DEC-18.

### DEC-20 — Backup and recovery objectives

- **Status:** APPROVED — product/operational resilience policy only
- **Decision review:** [DEC-20 Backup and Recovery Policy
  Review](ledgerly-dec-20-backup-and-recovery-policy-review.md).
- **Decision review:** [DEC-20 Backup and Recovery Policy
  Review](ledgerly-dec-20-backup-and-recovery-policy-review.md).
- **Approved policy:** Use encrypted managed backups, point-in-time recovery
  where available, documented backup retention, explicit target RPO/RTO,
  isolated validated restoration, and tested recovery procedures.
- **Options available:** (a) provider defaults; (b) managed daily backups or
  point-in-time recovery; or (c) managed backups plus tested restore and
  regional recovery.
- **Why it is approved:** Recovery must preserve accounting ordering,
  immutability, source links, periods, and idempotency rather than merely
  restore database bytes.
- **Accounting implications:** Prevents duplicate posting, missing journal
  lines, broken audit chains, and inconsistent period state after recovery.
- **Data/schema implications:** Requires backup coverage for canonical and
  evidence data, restore validation, and operational recovery metadata.
- **Migration implications:** A verified checkpoint is required before schema or
  company cutovers; rollback criteria must be explicit.
- **Backlog implications:** Gates BL-24 and release readiness for BL-06/BL-07.
- **Dependency:** DEC-04, DEC-07, DEC-11, DEC-17, and DEC-21.

### DEC-21 — Tenant isolation and RLS

- **Status:** APPROVED — security/product architecture policy only
- **Decision review:** [DEC-21 Tenant Isolation Policy
  Review](ledgerly-dec-21-tenant-isolation-policy-review.md).
- **Approved policy:** Require authenticated, server-side company scoping and
  DEC-05 membership/capability checks for every company-owned access path.
  Treat tested RLS as defence-in-depth, especially for high-risk accounting
  tables, without assuming universal RLS before compatibility is validated.
- **Options available:** (a) application scoping only; (b) RLS for accounting
  tables; or (c) RLS for all company-scoped tables.
- **Replit's recommendation:** Mandatory authenticated server-side company
  scoping, with tested RLS evaluated as defence-in-depth rather than assumed
  universally.
- **Why it is approved:** It preserves compatibility with the current
  architecture while requiring reliable tenant isolation at every route and
  mutation boundary.
- **Accounting implications:** Every entity, report, posting, approval, and
  audit event must remain company-safe.
- **Data/schema implications:** Requires company-safe foreign keys and
  predicates; RLS would also affect workers, pooling, migrations, admin, and
  recovery operations.
- **Migration implications:** Policy tests, rollout sequencing, and restore
  validation are required before tenant-scoped cutover.
- **Backlog implications:** Gates BL-01, BL-02, BL-03, BL-06, BL-07, and BL-24.
- **Dependency:** DEC-05, DEC-20, and the security/operations review.

## Migration decision

### DEC-22 — Historical accounting-data compatibility and cutover

- **Status:** APPROVED — migration/cutover policy only
- **Decision review:** [DEC-22 Migration and Cutover Policy
  Review](ledgerly-dec-22-migration-and-cutover-policy-review.md).
- **Approved policy:** Use validated additive adapters with controlled
  cohort/source cutover, bounded dual-read comparison, explicit migration
  exceptions, and recovery checkpoints. Canonical posted journals become the
  sole reporting and accounting authority after validated cutover; legacy
  systems remain read-only evidence or bounded comparison sources.
- **Why it is approved:** It protects existing evidence while allowing the
  product to move from JSON journals and denormalized balances to authoritative
  accounting records.
- **Accounting implications:** Determines opening balances, historical
  authority, source links, continuity, auditability, and when legacy values
  stop driving reports.
- **Data/schema implications:** Requires canonical-to-legacy mappings, source
  identifiers, provenance, opening-balance handling, validation, idempotency,
  and migration status.
- **Migration implications:** This is the migration policy itself: cohort,
  sequencing, balanced/evidenced backfill, comparison, cutover, rollback, and
  compatibility must be explicit.
- **Backlog implications:** Gates BL-03, BL-04, BL-05, BL-06, BL-07, BL-08,
  BL-09, BL-12, BL-14, BL-15, BL-17, BL-23, BL-24, and BL-25.
- **Implementation boundary:** This approval does not authorise migration or
  cutover execution, production-data transformation, schema changes, scripts,
  adapters, UI, accounting implementation, infrastructure changes, deployment,
  publishing, or an implementation task. Those require separate planning and
  explicit approval.
- **Dependency:** All preceding decisions.

## Approval order and current gate

The logical approval order is:

1. DEC-01 — Governance hierarchy (**APPROVED**).
2. DEC-02 — Final launch PRD / Product Scope (**APPROVED**).
3. DEC-03 — VAT schemes and filing scope (**APPROVED: S1 + A + H1**).
4. DEC-04 — Accounting-core architecture adoption.
5. DEC-05 — Capability and approval matrix.
6. DEC-06 through DEC-11 — Financial years, periods, year-end, chart,
   mappings, and versioning.
7. DEC-12 through DEC-16 — Source freshness, payments, allocations, refunds,
   and payment-on-account.
8. DEC-17 through DEC-21 — Retention, deletion, export, recovery, and tenant
   isolation.
9. DEC-22 — Historical compatibility and cutover.

DEC-01 through DEC-22 are approved policy decisions. BL-06 and BL-07 remain
**BLOCKED** until implementation planning and the required implementation
approvals are completed. Source freshness remains a separate unresolved
posting-safety dependency.

No application code, database schema, migrations, UI, workflows, dependencies,
deployment, or publishing changes are authorised by this register.