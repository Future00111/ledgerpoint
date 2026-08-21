# Ledgerly Living Product Decisions Register

**Product working names:** Ledgerly / Ledgerpoint  
**Register status:** Living governance record  
**Date established:** 2026-08-21

## Purpose and governing rule

This register records the current product direction without treating every decision
as permanent. A decision may be changed, deferred, or revisited, but the change
must be explicitly recorded before implementation changes direction.

The Ledgerly Manifesto remains the highest-level authority. This register does
not authorise implementation by itself:

- The Master Backlog determines implementation priority.
- An approved implementation task is still required before code changes.
- An unresolved decision is a dependency, not permission for the coding agent to
  choose an answer.
- Existing code is evidence of the current implementation, not authority over
  approved product requirements.

## Authority hierarchy

Use this order when documents or implementation disagree:

1. Ledgerly Manifesto
2. Product Principles
3. PRD / Product Scope
4. Technical Architecture
5. Feature Specifications / Master Backlog

Decision 1 established the Product Principles, PRD/Product Scope, and Technical
Architecture as living governance documents. This register records decisions and
their status but cannot override those documents or silently resolve an open
decision. Existing code, product analysis, and feature matrices are evidence,
not higher authority.

## Decision statuses

- **APPROVED** — current intended product decision.
- **PROVISIONAL** — current direction deliberately allowed to change.
- **DEFERRED** — a decision is needed eventually, but not yet.
- **OPEN** — no decision has been made.
- **FUTURE** — explicitly outside the current scope, but potentially relevant later.
- **REVISIT** — a previous decision must be reassessed at a specified stage.
- **REQUIRES USER DECISION** — an unresolved decision awaiting explicit
  approval or amendment.

`LOCKED` is not a valid permanent status.

## Current decisions

### DEC-02 — Final launch PRD / Product Scope

- **Status:** APPROVED
- **Current decision/direction:** Ledgerly's initial product scope is
  authoritative core accounting, UK accounting and VAT preparation, invoices,
  bills, payments, banking, reconciliation, and reporting. The initial
  market/currency direction is UK/GBP.
- **Reason:** The accounting foundation needs a deliberate and bounded launch
  surface before canonical posting and configuration design can be approved.
- **Impact:** Initial accounting-core work must support only the approved source
  types and tax treatments. Additional product capabilities are not part of the
  initial accounting-core implementation unless separately approved.
- **Dependencies:** Decision 1, Product Principles, PRD/Product Scope, and
  DEC-03; subsequent accounting-core decisions remain unresolved.
- **What it affects:** Accounting sources, posting boundaries, VAT, payments,
  banking, reconciliation, reporting, migration cohort, and affected backlog
  dependencies.
- **Revisit:** When an additional market, currency, capability, or changed
  launch scope is explicitly proposed through the Living Product Decisions
  process.
- **Change authority:** Product owner/stakeholder through an explicit documented
  decision. The amendment must identify consequences for existing
  implementation, accounting data, database/schema, migrations, backwards
  compatibility, dependent features, and Master Backlog items.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-06, BL-07, BL-08, BL-09, BL-12, BL-13, BL-14, BL-15,
  BL-17, BL-25
- **Related architecture:** The accounting foundation must avoid unnecessary
  UK/GBP hard-coding so later markets, currencies, and capabilities do not
  require a fundamental redesign. This decision does not approve DEC-03 or any
  subsequent architecture decision.

### DEC-03 — VAT schemes, adjustments, and MTD/HMRC scope

- **Status:** APPROVED
- **Current decision/direction:** DEC-03 approves S1 + A + H1 for the initial
  launch: UK Standard VAT Scheme on invoice basis; controlled source-linked and
  return-level corrections; and supported VAT-return preparation/export without
  direct HMRC submission.
- **Approved controls:** Each correction must have an explicit reason, evidence,
  appropriate VAT-box mapping, reviewer/approver information, and an audit
  trail. Free-form VAT-box overrides are prohibited. Returns require
  box-by-box evidence and source drill-down, review, approval, locking, and
  export audit records. They must be labelled prepared/exported unless a
  verified HMRC submission receipt exists.
- **Future scope:** Cash Accounting, Flat Rate, Annual Accounting, Retail,
  margin, agricultural/sector-specific schemes, partial exemption, Capital
  Goods, import/postponed-import VAT, broad reverse charge, bad-debt
  relief/recovery, specialist adjustments, direct HMRC submission,
  authorisation/account workflows, obligations, and HMRC
  receipts/rejections/retries are not approved for the initial launch.
- **Reason:** The current deterministic foundation supports a bounded standard
  scheme. Special schemes, specialist adjustments, and direct filing each need
  separate accounting, evidence, security, reporting, and compliance rules.
- **Impact:** Launch onboarding must identify unsupported schemes or treatments
  rather than silently defaulting them to Standard VAT. VAT exports must be
  described as prepared/exported unless a verified external filing receipt
  exists.
- **Dependencies:** DEC-02, approved DEC-04, DEC-05, period/chart/configuration
  decisions, payment/refund decisions, and historical migration policy.
- **What it affects:** VAT profiles, tax rules, invoices, bills, credit notes,
  payments, returns, corrections, reports, exports, HMRC integrations, AI
  boundaries, permissions, audit, and migration.
- **Revisit:** When a new scheme/treatment is proposed or when HMRC/regulatory
  requirements change. Any amendment must use the Living Product Decisions
  process and identify accounting, data, migration, compatibility, reporting,
  dependency, and backlog consequences before implementation changes direction.
- **Change authority:** Product owner/stakeholder with accounting and
  regulatory review; implementation cannot expand this approved scope without
  an explicit amendment.
- **Date recorded:** 2026-08-21
- **Related review:** [DEC-03 VAT Scope
  Review](ledgerly-dec-03-vat-scope-review.md)
- **Related backlog:** BL-04, BL-05, BL-06, BL-07, BL-08, BL-10, BL-12, BL-13,
  BL-15, BL-17, BL-18, BL-23, BL-24, BL-25
- **Related architecture:** Existing deterministic VAT and accounting-core
  review remain the evidence base. DEC-04 separately records architecture
  adoption; no implementation decision is made here.

### DEC-04 — Accounting-core architecture adoption

- **Status:** APPROVED — architecture only
- **Current decision/direction:** Option A is approved. The BL-06 / BL-07
  Accounting Core Architecture Review is the accounting-core foundation within
  the Technical Architecture, subject to the targeted amendments and deliberate
  non-locks in the [DEC-04 adoption review](ledgerly-dec-04-accounting-core-adoption-review.md).
- **Approved architecture:** Canonical normalized append-only journals;
  server-side transactional double-entry posting; integer minor-unit monetary
  representation with explicit currency; source linkage, source/version
  context, and company-scoped idempotency; immutable journals with linked
  reversals/corrections; separate payment, allocation, and bank-evidence
  concepts; DEC-03's deterministic VAT service through a traceable adapter;
  journal-authoritative reporting with rebuildable projections; company-scoped
  server-side capability/audit boundaries; and additive, evidence-based
  compatibility and migration architecture.
- **Deliberate non-locks:** DEC-05, DEC-06, DEC-07, DEC-08, DEC-09, and DEC-10 were
  separately approved as the capability model, financial-year policy,
  accounting-period policy, reporting-only year-end policy, Chart of Accounts
  and Default Account Policy, and Control-Account Mapping Policy. DEC-11
  through DEC-22 remain unresolved. DEC-04 does not select active
  control-account mappings,
  configuration versioning, source-freshness, payment/refund treatment,
  retention, deletion, export, backup/recovery, RLS, historical migration
  cohort, cutover, or rollback policy.
- **Reason:** The architecture supplies a safe, authoritative accounting
  foundation while preserving explicit product-owner decisions for policies
  that affect operations, compliance, access, and migration.
- **Impact:** Future specifications must conform to this accounting authority;
  current implementation remains evidence, not an approved target.
- **Dependencies:** DEC-02 and DEC-03. The applicable DEC-08 through DEC-22
  decisions remain required before implementation approval.
- **What it affects:** Accounting sources, journals, payments, allocations,
  banking, VAT, reports, permissions, audit, compatibility, migration, and
  related backlog dependencies.
- **Revisit:** When an explicit accounting authority, safety invariant, data
  contract, compatibility, or migration assumption needs to change.
- **Change authority:** Product owner/stakeholder with accounting, security,
  and architecture review. An amendment must identify effects on accounting
  data, database/schema, migrations, backwards compatibility, reporting,
  security/audit, dependent features, and Master Backlog items before
  implementation direction changes.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-06, BL-07, BL-08, BL-09, BL-13, BL-14, BL-15, BL-17,
  BL-23, BL-24, BL-25
- **Implementation limit:** This approval does not authorise code, schema,
  migrations, UI, workflows, dependencies, deployment, publishing, or an
  implementation task. BL-06 and BL-07 remain blocked.

### DEC-05 — Accounting capability and approval matrix

- **Status:** APPROVED — product/architecture decision only
- **Current decision/direction:** Option B is approved: company-scoped
  server-side capabilities with conservative OWNER, ADMIN, ACCOUNTANT, MANAGER,
  and READ-ONLY role presets for viewing, drafting, approving, posting,
  reversing/correcting, closing/reopening periods, editing the chart, changing
  accounting configuration, and persisting AI/accounting actions.
- **Decision review:** [DEC-05 Capability and Approval Matrix
  Review](ledgerly-dec-05-capability-approval-review.md).
- **Approved principles:** Capabilities, not role names alone, are authoritative
  for consequential permissions. Every consequential operation is authorised
  server-side in the active company context, with active company membership.
  Permission checks cannot rely solely on browser/UI controls, client-supplied
  roles, arbitrary role strings, or hidden frontend controls.
- **Role presets:** OWNER has broad authority subject to safety, immutability,
  and audit controls. ADMIN has no default posting, reversal/correction, or
  period-reopen authority and requires explicit auditable grants. ACCOUNTANT
  has normal accounting and posting authority; controlled consequential
  corrections require reason and audit evidence. MANAGER has scoped operational
  access and no default posting, reversal/correction, or period-reopen
  authority. READ-ONLY has no mutation path.
- **Safety and AI boundary:** No role may edit or delete a posted journal.
  AI recommendations do not create authority; AI-assisted persistence requires
  the equivalent manual action's server-side capability.
- **Audit and migration:** Consequential operations retain applicable actor,
  company, capability, target, source, reason, approval, result, request
  context, and audit evidence. Existing broad roles map conservatively, with
  ambiguous authority becoming a visible review exception.
- **Dependencies:** DEC-04 and the applicable DEC-06 through DEC-22 decisions.
- **Impact:** The approved model defines the server-side permission, approval,
  audit, migration, compatibility, reporting-access, and backlog boundaries for
  consequential accounting actions.
- **Change authority:** Product owner/stakeholder with accounting and security
  review through the Living Product Decisions process. Future capabilities or
  role-preset changes must not weaken approved accounting safety boundaries.
- **Implementation limit:** This approval authorises architecture/product
  direction only. It does not authorise code, schema, migration, UI, workflow,
  dependency, deployment, publishing, or an implementation task. BL-06 and
  BL-07 remain blocked.

### DEC-06 — Financial-year start and change policy

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-06 Financial-Year Policy
  Review](ledgerly-dec-06-financial-year-policy-review.md).
- **Current decision/direction:** New UK-focused companies default to 1 April
  through 31 March. A company may select another valid recurring start during
  setup or before its first canonical posted accounting record.
- **Approved identity and history boundary:** Financial-year identity is
  explicit and company-scoped, distinct from document dates, transaction dates,
  VAT periods, tax years, and bank dates. First and partial first years are
  supported. Historical financial-year assignment relies on available source
  evidence and must not invent accounting facts.
- **Approved change boundary:** After canonical posting exists, ordinary
  company configuration cannot retrospectively change the start or silently
  reclassify posted records. A future transition must be separately designed,
  approved, privileged, and fully audited.
- **Reporting and permission boundary:** Reports rely on the DEC-04 canonical
  accounting model. Financial-year configuration is consequential accounting
  configuration under DEC-05 active membership, company scope, server-side
  capability checks, privileged authority, and audit.
- **Dependencies:** DEC-04, DEC-05, and approved DEC-07 period policy. DEC-08
  year-end policy remains a separate unresolved decision.
- **Change authority:** Product owner/stakeholder with accounting, security,
  and architecture review through the Living Product Decisions process.
- **Implementation limit:** DEC-06 does not authorise code, schema, migration,
  UI, workflow, dependency, deployment, publishing, or an implementation task.
  BL-06 and BL-07 remain blocked.

### DEC-07 — Accounting-period policy, creation, close, and reopen

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-07 Accounting-Period Policy
  Review](ledgerly-dec-07-accounting-period-policy-review.md).
- **Current decision/direction:** Use contiguous monthly periods anchored to
  approved DEC-06 financial years. Generate known periods automatically,
  including future periods before they become active for posting, and use only
  `OPEN` and `CLOSED` states.
- **Approved posting and close boundary:** Assign canonical postings
  server-side from validated posting date; do not permit arbitrary client period
  selection or silent reassignment. Closed periods block ordinary posting with
  no direct bypass. Period creation, close, and reopen require DEC-05
  capability, company scope, active membership, validation, authority, and
  audit. Reopen requires elevated capability and a mandatory reason, with
  separate approval where segregation of duties requires it.
- **Approved warning and integrity boundary:** Drafts, unallocated payments,
  unreconciled bank evidence, and ordinary VAT timetable differences are
  visible close warnings, while accounting or VAT integrity failures can block
  close. Period configuration cannot rewrite posted history, and migration must
  not invent periods, close events, journals, dates, or accounting facts.
- **Boundary:** DEC-07 does not resolve year-end closing journals, retained
  earnings, or other DEC-08 treatment. Periods remain distinct from VAT
  periods, tax years, bank ranges, calendar months, and financial-year identity.
- **Implementation limit:** DEC-07 is an approved policy only. It does not
  authorise code, schema, migration, UI, workflow, dependency, deployment,
  publishing, or an implementation task. BL-06 and BL-07 remain blocked.

### DEC-08 — Year-end treatment and financial-year transition

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-08 Year-End Treatment and Financial-Year
  Transition Review](ledgerly-dec-08-year-end-treatment-review.md).
- **Approved direction:** Use reporting-only year-end treatment at launch with
  no automatic closing journal, retained-earnings transfer, or artificial
  year-end posting. Financial-year boundaries affect authoritative reporting
  and presentation without mutating canonical journal history.
- **Approved completion/authority boundary:** All DEC-07 periods in the
  financial year must be closed before year-end review/completion. Completion is
  a derived condition plus an auditable event, not a separate accounting-period
  state. It requires DEC-05 active membership, company scope, server-side
  capability enforcement, appropriate authority, and audit evidence.
- **Approved reporting/correction boundary:** Temporary-account P&L and
  current/prior-year results derive from canonical records; permanent assets,
  liabilities, and equity continue across years. Corrections use controlled
  reopen, explicit reversal/correction, or approved later-period adjustment,
  never history rewriting or silent reassignment.
- **Boundary:** DEC-03 remains the sole VAT authority. Migration must not
  invent closing journals, retained-earnings postings, approvals, year-end
  events, dates, or accounting facts. Explicit year-end journals remain a
  separately approved future policy.
- **Implementation limit:** DEC-08 is an approved policy only. It does not
  authorise code, schema, migration, UI, workflow, dependency, deployment,
  publishing, or an implementation task. BL-06 and BL-07 remain blocked.

### DEC-09 — Chart of Accounts and Default Account Policy

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-09 Chart of Accounts and Default Account Policy
  Review](ledgerly-dec-09-chart-of-accounts-policy-review.md).
- **Current decision/direction:** Adopt a versioned UK small-business Chart of
  Accounts template copied into each company. The authoritative primary types
  are Asset, Liability, Equity, Revenue, Cost of Sales, and Expense. Accounts
  use stable identity and explicit classification; company-scoped four-digit
  codes and names are presentation/configuration attributes, not accounting
  logic.
- **Approved lifecycle and reporting policy:** Availability uses only `ACTIVE`
  and `INACTIVE`; historical is derived from references and system is a
  protection role. Referenced accounts cannot be physically deleted, primary
  type or meaning-changing classification changes are prohibited after use, and
  account merging is not supported at launch. Reports use canonical journals,
  stable account identities, and explicit classifications rather than names,
  code ranges, or frontend inference.
- **Approved protection boundary:** AR, AP, bank/cash, VAT, VAT settlement, and
  applicable posted retained-results/equity accounts may be protected
  system-account candidates. DEC-09 does not select their active control
  mappings or any invoice, bill, payment, or VAT posting mappings.
- **Boundary:** DEC-03 VAT, DEC-04 canonical journals, DEC-05 capabilities,
  DEC-06/DEC-07 periods, and DEC-08 reporting-only year-end remain
  authoritative. DEC-10 decides active control-account mappings, and DEC-11
  decides configuration versioning.
- **Implementation limit:** This approved policy does not
  authorise code, schema, migration, UI, workflow, dependency, deployment,
  publishing, or an implementation task. BL-06 and BL-07 remain blocked.

### DEC-10 — Control-Account Mappings

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-10 Control-Account Mapping Policy
  Review](ledgerly-dec-10-control-account-mapping-policy-review.md).
- **Current decision/direction:** Use one protected company-scoped AR account,
  one protected company-scoped AP account, a protected accounting account for
  each bank/cash location, one protected Output VAT account, and one protected
  Input VAT account. VAT settlement is protected only where an approved
  VAT-return settlement workflow requires it.
- **Approved ordinary-account boundary:** Revenue, Cost of Sales, ordinary
  Expense, ordinary Asset, and general Equity accounts remain validated
  configurable selections rather than universal control accounts. Retained
  earnings is not a launch default control account.
- **Approved change and history boundary:** Mapping changes are prospective
  only, company-scoped, server-side capability-gated under DEC-05, validated,
  reasoned where required, and audited. Historical postings retain their
  resolved account identity and are never reinterpreted.
- **Boundary:** DEC-03 remains the sole VAT authority. DEC-04 journals retain
  resolved stable account IDs; later mappings cannot reinterpret history.
  DEC-11 establishes the complete versioning/effective-dating policy, and
  DEC-12 through DEC-16 decide source freshness and payment/refund edge cases.
- **Implementation limit:** This approved policy does not
  authorise code, schema, migration, UI, workflow, dependency, deployment,
  publishing, or an implementation task. BL-06 and BL-07 remain blocked.

### DEC-11 — Configuration Versioning and Effective Dating

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-11 Configuration Versioning and Effective Dating
  Review](ledgerly-dec-11-configuration-versioning-review.md).
- **Current decision/direction:** Use immutable, company-scoped,
  effective-dated versions for material accounting configuration. Select one
  approved version by canonical posting date and preserve its identity and
  resolved account IDs with every canonical posting.
- **Approved boundaries:** Effective ranges cannot overlap or contain an
  unexplained gap. Future-dated changes are the normal path. Ordinary
  backdating over posted journals or closed periods is prohibited, while a
  tightly controlled pre-posting correction may be allowed when no dependent
  posting exists. Cosmetic account name/code changes remain outside accounting
  versioning unless they change material accounting meaning.
- **Approved history and authority boundary:** Later versions never rewrite
  posted journals, historical VAT, AR/AP balances, financial-year assignment,
  or reporting meaning. Material changes require DEC-05 capability,
  validation, proportionate approval, reason, and immutable audit evidence.
- **Boundary:** DEC-10's prospective-only mapping principle remains
  authoritative. DEC-03 VAT evidence, DEC-04 journals, DEC-06/DEC-07
   identities, DEC-08 year-end, and DEC-09 account identity remain unchanged.
   DEC-12 establishes payment/allocation/settlement; DEC-13 through DEC-16
   retain the remaining payment-edge-case authority, and DEC-22 retains
   migration/cutover authority.
- **Implementation limit:** This approved policy does not
  authorise code, schema, migration, UI, workflow, dependency, deployment,
  publishing, or an implementation task. BL-06 and BL-07 remain blocked.

### DEC-12 — Payment, Allocation and Settlement Policy

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-12 Payment, Allocation and Settlement Policy
  Review](ledgerly-dec-12-payment-allocation-settlement-policy-review.md).
- **Current decision/direction:** Keep payment evidence, payment accounting,
  allocation, and derived document settlement distinct.
- **Approved policy:** Post an accounting payment once through the canonical
  journal; use many-to-many, append-only allocation events to explain
  settlement; derive settlement status; and link bank evidence idempotently
  without creating duplicate accounting.
- **Boundary:** DEC-13 through DEC-16 retain authority over overpayments,
  first-class unapplied cash, refunds, and payment-on-account. Source freshness
  remains a separate unresolved posting-safety dependency and is neither
  decided nor reassigned by this review.
- **Implementation limit:** This approved policy does not
  authorise code, schema, migration, UI, workflow, dependency, deployment,
  publishing, or an implementation task. BL-06 and BL-07 remain blocked.

### DEC-13 — Overpayments, Unapplied Cash and Excess Payment Policy

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-13 Overpayments, Unapplied Cash and Excess Payment
  Policy Review](ledgerly-dec-13-overpayments-unapplied-cash-policy-review.md).
- **Approved policy:** Never discard or cap excess money. Customer excess should be
  represented as a customer-credit/receipt-on-account liability and supplier
  excess as a supplier-prepayment/receivable asset. Known-party payments may
  exist before allocation; allocation cannot exceed payment remainder or
  document open amount.
- **Approved accounting boundary:** Direct cash is posted once. Later allocation from a
  customer credit or supplier prepayment uses controlled canonical
  reclassification; moving a direct payment between eligible documents does
  not repost cash or AR/AP. Settlement remains derived under DEC-12.
- **Decision boundary:** DEC-14 retains detailed first-class unapplied-cash
  workflow, DEC-15 retains refund policy, and DEC-16 retains user-facing
  payment-on-account launch scope. Source freshness remains separate and
  unresolved.
- **Implementation limit:** This approved policy does not authorise code,
  schema, migration, UI, workflow, dependency, deployment, publishing, or an
  implementation task. BL-06 and BL-07 remain blocked.

### DEC-14 — Unapplied Cash Workflow Policy

- **Status:** APPROVED — product/accounting workflow policy only
- **Decision review:** [DEC-14 Unapplied Cash Workflow
  Policy Review](ledgerly-dec-14-unapplied-cash-workflow-policy-review.md).
- **Approved policy:** Users identify, review, manage,
  and allocate unapplied customer and supplier cash without conflating bank
  evidence, accounting payment, allocation, or settlement.
- **Approved workflow:** Use a dedicated unapplied-cash workspace with contextual
  customer, supplier, invoice, bill, payment, and reconciliation entry points;
  deterministic eligibility and suggestions; explicit user confirmation; and
  no silent automatic allocation at launch.
- **Boundary:** DEC-13 accounting representation and DEC-12 settlement remain
  authoritative. DEC-15 retains refund policy, DEC-16 retains payment-on-
  account scope, and DEC-22 retains migration/cutover authority.
- **Implementation limit:** This approved policy does not authorise code,
  schema, migration, UI, workflow, dependency, deployment, publishing, or an
  implementation task. BL-06 and BL-07 remain blocked.

### DEC-15 — Refund Policy

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-15 Refund Policy
  Review](ledgerly-dec-15-refund-policy-review.md).
- **Approved policy:** Controlled customer refunds and
  supplier refund receipts use approved party balances without conflating them
  with payment reversals, allocation reversals, credit notes, or bank evidence.
- **Approved workflow:** Support refunds only from available customer-credit or
  supplier-prepayment balances; require explicit request, elevated approval,
  amount limits, canonical bank/cash journals, reconciliation, and immutable
  correction history. Do not enable silent automatic refund execution at launch.
- **Boundary:** DEC-03 retains VAT authority, DEC-14 retains unapplied-cash
  workflow authority, DEC-16 retains payment-on-account scope, and DEC-22
  retains migration/cutover authority.
- **Implementation limit:** This approved policy does not authorise code,
  schema, migration, UI, workflow, dependency, deployment, publishing, or an
  implementation task. BL-06 and BL-07 remain blocked.

### DEC-16 — Payment-on-Account Launch Scope

- **Status:** APPROVED — product/accounting launch-scope policy only
- **Decision review:** [DEC-16 Payment-on-Account Launch Scope
  Review](ledgerly-dec-16-payment-on-account-launch-scope-review.md).
- **Approved policy:** Ledgerly will not expose a separate payment-on-account
  feature, workflow, navigation item, accounting object, or journal type at
  launch. Users will use known-party payments, DEC-13 customer credits and
  supplier prepayments, DEC-14 unapplied cash, explicit allocation, and DEC-15
  controlled refunds.
- **Approved product principle:** Do not introduce an additional user-facing
  state merely because the underlying accounting concept exists. Keep launch
  language simple, clear, understandable, accounting-correct, and consistent.
- **Future boundary:** This does not permanently prohibit a future deliberate
  payment-on-account classification over the existing accounting model.
- **Implementation limit:** This approved policy does not authorise code,
  schema, migration, UI, workflow, dependency, deployment, publishing, or an
  implementation task. BL-06 and BL-07 remain blocked.

### DEC-17 — Audit Retention Period

- **Status:** APPROVED — product/governance policy only
- **Decision review:** [DEC-17 Audit Retention Period
  Review](ledgerly-dec-17-audit-retention-period-review.md).
- **Approved policy:** Retain authoritative accounting evidence and the audit
  trail required to explain it for the company life plus the applicable legal
  or regulatory period. Apply explicit, proportionate classes to personal
  data, documents, and AI actions/outputs.
- **Controls:** Use documented triggers, auditable legal holds, company-scoped
  server-side enforcement, immutable retention audit evidence, and controlled,
  audited policy changes. Retention must never rewrite accounting history.
- **Boundary:** DEC-18 retains deletion and anonymisation policy, DEC-19
  export, DEC-20 backup/recovery, DEC-21 tenant isolation, and DEC-22
  migration/cutover policy. Source freshness remains separate.
- **Implementation limit:** This approved policy does not authorise code,
  schema, migration, UI, workflow, dependency, deployment, publishing, or an
  implementation task. BL-06 and BL-07 remain blocked.

### DEC-18 — Deletion and Anonymisation Policy

- **Status:** APPROVED — product/governance/data-lifecycle policy only
- **Decision review:** [DEC-18 Deletion, Anonymisation, Archival and Redaction
  Policy Review](ledgerly-dec-18-data-disposal-policy-review.md).
- **Approved policy:** Use controlled, class-based disposal: never mutate or
  dispose of canonical accounting and required audit evidence in a way that
  changes meaning or breaks traceability; allow tightly governed deletion of
  eligible drafts and non-authoritative data, and proportionate personal-data
  minimisation, anonymisation, pseudonymisation, redaction, and archival.
- **Controls:** Retention expiry is eligibility only. Legal holds override
  disposal. Consequential actions remain company-scoped, server-side,
  capability-controlled, and immutably audited. Archival is distinct from
  deletion.
- **Boundary:** DEC-19 retains export policy, DEC-20 backup/recovery, DEC-21
  tenant isolation, and DEC-22 migration/cutover. Source freshness remains
  separate.
- **Implementation limit:** This approved policy does not authorise code,
  schema, migration, UI, workflow, dependency, deployment, publishing, or an
  implementation task. BL-06 and BL-07 remain blocked.

### DEC-19 — Export Policy

- **Status:** REQUIRES USER DECISION
- **Decision review:** [DEC-19 Export Policy
  Review](ledgerly-dec-19-export-policy-review.md).
- **Current decision/direction:** Decide accounting, audit, report, document,
  and data export formats, scope, access authority, and versioning.
- **Recommendation:** Support company-scoped CSV plus versioned
  machine-readable JSON for canonical accounting/audit data, with
  human-readable PDF and CSV reports separately. Use bounded operational,
  document, configuration, and specialised audit exports—not an unbounded full
  company archive by default at launch.
- **Boundary:** DEC-20 retains backup/recovery, DEC-21 tenant isolation, and
  DEC-22 migration/cutover. Source freshness remains separate.
- **Implementation limit:** This unresolved decision does not authorise code,
  schema, migration, UI, workflow, dependency, deployment, publishing, or an
  implementation task. BL-06 and BL-07 remain blocked.

### PD-01 — Product name

- **Status:** OPEN
- **Current decision/direction:** The final product name is undecided. Current
  candidates include Ledgerly and Ledgerpoint. Do not broadly rename the
  application or make architecture dependent on either name.
- **Reason:** The working name and final brand have not been separately decided.
- **Impact:** Branding, URLs, copy, domain configuration, and broad application
  naming remain subject to a later brand decision.
- **Dependencies:** Final brand/positioning decision.
- **What it affects:** Product copy, visual identity, documentation, URLs, and
  release communications.
- **Revisit:** Before public launch or broad rebranding.
- **Change authority:** Product owner/stakeholder through an explicit register
  update; technical consequences require architecture review.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-11, BL-25
- **Related architecture:** None; architecture must remain name-neutral.

### PD-02 — Launch market

- **Status:** APPROVED — component of DEC-02.
- **Current decision/direction:** The initial launch market direction is UK
  small and medium-sized businesses.
- **Reason:** DEC-02 establishes the UK launch scope for the initial accounting
  foundation.
- **Impact:** UK terminology, tax assumptions, compliance scope, and launch
  workflows are the initial product baseline.
- **Dependencies:** DEC-02, applicable tax/regulatory requirements, and DEC-03.
- **What it affects:** VAT, banking, reporting, currency, filing, copy, and
  onboarding.
- **Revisit:** When launch strategy or supported jurisdictions change.
- **Change authority:** Product owner/stakeholder; regulatory and architecture
  review required for affected tax or data changes.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-15, BL-25
- **Related architecture:** Active Technical Architecture; future market
  expansion remains subject to an explicit decision.

### PD-03 — Launch currency

- **Status:** APPROVED — component of DEC-02.
- **Current decision/direction:** GBP (£) is the initial launch currency. Avoid
  needless architectural barriers to future multi-currency support. Do not
  implement full multi-currency without separate approval.
- **Reason:** DEC-02 establishes the UK/GBP launch direction while requiring
  reasonable future extensibility.
- **Impact:** Monetary display, storage, validation, reports, and integrations
  use GBP initially.
- **Dependencies:** DEC-02 and a future multi-currency decision.
- **What it affects:** Documents, payments, journals, VAT, banking, reports, and
  exports.
- **Revisit:** Before entering a non-GBP market or adding foreign-currency
  workflows.
- **Change authority:** Product owner/stakeholder with accounting and
  architecture review.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-04, BL-09, BL-15, BL-25
- **Related architecture:** Active Technical Architecture; future
  multi-currency scope remains subject to an explicit decision.

### PD-04 — Quotes / estimates

- **Status:** PROVISIONAL
- **Current decision/direction:** Quotes/estimates are intended product scope
  with the lifecycle: quote → acceptance → invoice → payment →
  reconciliation → accounting. Detailed scope is not yet fixed.
- **Reason:** A complete sales workflow should connect accepted commercial
  proposals to authoritative accounting records.
- **Impact:** Quote status, source snapshots, conversion, audit, and document
  generation will need defined rules.
- **Dependencies:** Product scope, invoice lifecycle, canonical posting engine,
  and customer/contact model.
- **What it affects:** Sales, invoices, documents, reporting, AI, and
  notifications.
- **Revisit:** Before implementation of quotes or the next sales-scope review.
- **Change authority:** Product owner/stakeholder; accounting and architecture
  review before lifecycle changes.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-08, BL-11, BL-18, BL-25
- **Related architecture:** Active Technical Architecture; lifecycle design
  remains **REQUIRES USER DECISION**.

### PD-05 — Purchase orders

- **Status:** PROVISIONAL
- **Current decision/direction:** Purchase orders are intended product scope
  with the lifecycle: purchase order → bill → payment → accounting. Detailed
  scope is not yet fixed.
- **Reason:** A complete purchasing workflow should connect commitments to
  payable and accounting records without posting prematurely.
- **Impact:** PO status, bill conversion, source snapshots, approvals, and audit
  rules must be defined.
- **Dependencies:** Product scope, bill lifecycle, canonical posting engine, and
  supplier/contact model.
- **What it affects:** Purchases, bills, suppliers, documents, reporting, and
  approvals.
- **Revisit:** Before implementation of purchase orders or the next purchasing
  scope review.
- **Change authority:** Product owner/stakeholder; accounting and architecture
  review before lifecycle changes.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-08, BL-11, BL-18, BL-25
- **Related architecture:** Active Technical Architecture; lifecycle design
  remains **REQUIRES USER DECISION**.

### PD-06 — Products / services / items

- **Status:** PROVISIONAL
- **Current decision/direction:** Support reusable products, services, or items.
  Potential fields include description, price, VAT treatment, nominal/account
  mapping, optional SKU/reference, and active/inactive status.
- **Reason:** Reusable catalogue data can reduce repeated entry while preserving
  controlled accounting defaults.
- **Impact:** Item values must be snapshotted onto accounting documents; changing
  an item later must not rewrite posted history.
- **Dependencies:** Product scope, VAT rules, chart of accounts, invoice/bill
  calculation authority, and contacts.
- **What it affects:** Invoices, bills, quotes, purchase orders, VAT, reporting,
  and AI recommendations.
- **Revisit:** Before item-catalogue implementation and when inventory scope is
  considered.
- **Change authority:** Product owner/stakeholder; accounting and architecture
  review for posting or VAT effects.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-04, BL-08, BL-11, BL-15
- **Related architecture:** Active Technical Architecture; scope and design
  remain **REQUIRES USER DECISION**.

### PD-07 — Contacts

- **Status:** PROVISIONAL
- **Current decision/direction:** Use an underlying Contacts model capable of
  supporting customer and supplier relationships without unnecessary duplication.
  Detailed entity design remains an architecture decision.
- **Reason:** A shared relationship model can reduce inconsistent party data.
- **Impact:** Customer/supplier views, roles, addresses, statements, documents,
  and duplicate handling depend on the final model.
- **Dependencies:** Product scope, entity validation, permissions, and
  architecture.
- **What it affects:** Customers, suppliers, invoices, bills, payments,
  collections, search, and reporting.
- **Revisit:** Before contacts are expanded beyond the current limited scope.
- **Change authority:** Product owner/stakeholder for behaviour; architecture
  owner for entity design.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-03, BL-09, BL-11, BL-16
- **Related architecture:** Active Technical Architecture; model and scope
  remain **REQUIRES USER DECISION**.

### PD-08 — VAT

- **Status:** PROVISIONAL
- **Current decision/direction:** UK accounting and VAT preparation are in the
  approved initial scope under DEC-02. The VAT engine must remain
  deterministic, authoritative, and auditable. Supported schemes, adjustments,
  exports, and MTD/HMRC filing remain unresolved under DEC-03.
- **Reason:** VAT is a consequential accounting responsibility and cannot be
  delegated to opaque or silent automation.
- **Impact:** VAT evidence, schemes, calculations, returns, locks, approvals,
  corrections, and reports must have traceable authority.
- **Dependencies:** DEC-02, DEC-03, canonical posting engine, document source
  authority, and product scope.
- **What it affects:** Invoices, bills, payments, reconciliation, VAT returns,
  reports, filing, AI, and audit.
- **Revisit:** When DEC-03 is decided, when schemes change, or when regulatory
  requirements change.
- **Change authority:** Product owner/stakeholder with accounting and
  regulatory review; implementation cannot weaken deterministic authority.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-04, BL-05, BL-06, BL-08, BL-15, BL-19
- **Related architecture:** Active Technical Architecture; scheme and filing
  design remain **REQUIRES USER DECISION**.

### PD-09 — MTD / HMRC

- **Status:** PROVISIONAL
- **Current decision/direction:** MTD/HMRC VAT filing is intended to be
  supported, but VAT calculation and accounting authority must be completed
  first. HMRC access and submission must use controlled authentication and
  auditable flows.
- **Reason:** Filing must be based on trusted accounting evidence and explicit
  control, not on an incomplete VAT foundation.
- **Impact:** Filing status, authorisation, submission records, error handling,
  and audit evidence will require a defined lifecycle.
- **Dependencies:** PD-08, supported schemes, HMRC requirements, and provider
  or authentication decisions.
- **What it affects:** VAT returns, settings, permissions, notifications, audit,
  and production operations.
- **Revisit:** After VAT authority and launch filing scope are approved.
- **Change authority:** Product owner/stakeholder with accounting, regulatory,
  security, and architecture review.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-15, BL-24, BL-25
- **Related architecture:** Active Technical Architecture; filing scope and
  design remain **REQUIRES USER DECISION**.

### PD-10 — Banking

- **Status:** PROVISIONAL
- **Current decision/direction:** Support reliable CSV/manual imports, bank
  transaction processing, categorisation, transfers, recurring transactions,
  and reconciliation. Live Open Banking is intended, but the provider is not
  yet decided.
- **Reason:** Reliable manual banking must not be blocked by provider selection,
  while live feeds remain a future/launch consideration.
- **Impact:** Import idempotency, transfer treatment, bank-account controls,
  matching, recurring automation, and provider abstraction are required.
- **Dependencies:** Canonical posting engine, accounting configuration, provider
  decision, and reconciliation rules.
- **What it affects:** Banking, reconciliation, payments, journals, VAT,
  automation, and reports.
- **Revisit:** At launch-scope approval and before selecting an Open Banking
  provider.
- **Change authority:** Product owner/stakeholder; security, compliance,
  accounting, and architecture review for provider or posting changes.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-06, BL-12, BL-13, BL-14, BL-25
- **Related architecture:** Active Technical Architecture; provider and
  live-feed decisions remain **REQUIRES USER DECISION**.

### PD-11 — Email

- **Status:** PROVISIONAL
- **Current decision/direction:** Email should eventually support invoices,
  statements, payment reminders, collections communication, and important
  notifications. The provider is not selected. External communications must
  be auditable.
- **Reason:** Communication is useful to the accounting workflow but has
  consequential external effects.
- **Impact:** Sending requires approval boundaries, delivery/failure states,
  retries, templates, preferences, and audit records.
- **Dependencies:** Notification policy, collections scope, provider decision,
  permissions, and document generation.
- **What it affects:** Documents, collections, notifications, automation, audit,
  and AI actions.
- **Revisit:** Before any external email implementation or provider commitment.
- **Change authority:** Product owner/stakeholder; security, privacy,
  architecture, and communications review.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-16, BL-18, BL-21, BL-25
- **Related architecture:** Active Technical Architecture; provider and
  lifecycle decisions remain **REQUIRES USER DECISION**.

### PD-12 — Documents / OCR

- **Status:** PROVISIONAL
- **Current decision/direction:** Support the eventual workflow upload →
  extraction/OCR → review → approval → accounting record. Storage and OCR
  provider choices remain open/deferred.
- **Reason:** Documents can provide useful evidence, but extracted data must not
  become accounting truth without review and approval.
- **Impact:** Durable company-scoped storage, extraction confidence, source
  evidence, review states, retention, and accounting handoff are required.
- **Dependencies:** Provider decisions, document retention policy, invoice/bill
  authority, permissions, and audit.
- **What it affects:** Invoices, bills, VAT, AI, documents, storage, and
  notifications.
- **Revisit:** Before OCR, inbound document capture, or provider selection.
- **Change authority:** Product owner/stakeholder; security, privacy,
  accounting, and architecture review.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-08, BL-15, BL-18, BL-19, BL-25
- **Related architecture:** Active Technical Architecture; provider, storage,
  and lifecycle decisions remain **REQUIRES USER DECISION**.

### PD-13 — Payments

- **Status:** PROVISIONAL
- **Current decision/direction:** Payment recording and allocation are core
  accounting capabilities. Support manual payments, partial payments, multiple
  allocations, overpayments, underpayments, unapplied cash, and
  customer/supplier statements. Payment collection or card-processing
  integration is future unless separately approved.
- **Reason:** Recording and allocating received or made money is distinct from
  collecting money through a provider.
- **Impact:** Payment allocation, balances, cash, statements, journals, and
  reconciliation must remain authoritative and auditable.
- **Dependencies:** Canonical posting engine, invoice/bill lifecycle, banking,
  and party model.
- **What it affects:** Sales, purchases, banking, reconciliation, collections,
  statements, VAT, and reporting.
- **Revisit:** At payment-provider scope review or before collection features.
- **Change authority:** Product owner/stakeholder with accounting, security, and
  architecture review.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-06, BL-08, BL-09, BL-14, BL-16
- **Related architecture:** Active Technical Architecture; payment treatment
  remains **REQUIRES USER DECISION**.

### PD-14 — Payroll

- **Status:** FUTURE
- **Current decision/direction:** Payroll is outside the immediate core
  accounting build and must not be built without separate approval.
- **Reason:** It introduces a distinct compliance and product domain.
- **Impact:** Payroll integrations, ledgers, permissions, reporting, and
  compliance are not launch assumptions.
- **Dependencies:** Separate product-scope and regulatory decision.
- **What it affects:** Roadmap, integrations, reporting, permissions, and
  support obligations.
- **Revisit:** Only through an explicit future-scope review.
- **Change authority:** Product owner/stakeholder through an explicit decision;
  legal, compliance, and architecture review required.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-25
- **Related architecture:** None until separately scoped.

### PD-15 — Inventory

- **Status:** FUTURE
- **Current decision/direction:** Full inventory management is outside the
  immediate core accounting build. Products/services may exist without
  inventory management.
- **Reason:** Catalogue items and inventory control are different scopes.
- **Impact:** No stock ledger, valuation, movements, or inventory accounting
  should be assumed by current product work.
- **Dependencies:** Separate product-scope, valuation, and accounting decision.
- **What it affects:** Products, purchasing, sales, reporting, and integrations.
- **Revisit:** Only after authoritative accounting and a separate inventory
  scope decision.
- **Change authority:** Product owner/stakeholder with accounting and
  architecture review.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-06, BL-11, BL-25
- **Related architecture:** None until separately scoped.

### PD-16 — Fixed assets

- **Status:** FUTURE
- **Current decision/direction:** Full fixed-asset functionality is future scope
  unless separately approved.
- **Reason:** Asset registers, depreciation, disposals, and tax treatment need
  dedicated accounting rules.
- **Impact:** No fixed-asset lifecycle or depreciation behaviour is part of the
  immediate core product assumption.
- **Dependencies:** Separate accounting, tax, reporting, and product-scope
  decision.
- **What it affects:** Journals, reports, periods, tax, and permissions.
- **Revisit:** Only through an explicit future-scope review.
- **Change authority:** Product owner/stakeholder with accounting, tax, and
  architecture review.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-06, BL-07, BL-17, BL-25
- **Related architecture:** None until separately scoped.

### PD-17 — Expenses

- **Status:** PROVISIONAL
- **Current decision/direction:** Basic business-expense functionality is
  intended. Advanced expense-management features remain future scope.
- **Reason:** Basic expense recording supports the core accounting product
  without committing to a full expense-management suite.
- **Impact:** Expense evidence, VAT treatment, approval, payment, and posting
  rules need a defined initial scope.
- **Dependencies:** Canonical posting engine, VAT rules, documents, permissions,
  and product scope.
- **What it affects:** Purchases, bills, documents, VAT, payments, reports, and
  AI.
- **Revisit:** Before implementing expense workflows and when advanced
  functionality is proposed.
- **Change authority:** Product owner/stakeholder with accounting and
  architecture review.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-06, BL-08, BL-15, BL-25
- **Related architecture:** Active Technical Architecture; launch scope and
  treatment remain **REQUIRES USER DECISION**.

### PD-18 — Budgeting / forecasting

- **Status:** FUTURE
- **Current decision/direction:** Budgeting and forecasting should be
  considered after authoritative accounting and reporting exist.
- **Reason:** Forecasts must be grounded in trusted posted evidence and clear
  assumptions.
- **Impact:** No budget or forecast commitments, controls, or reports are
  assumed in the immediate core build.
- **Dependencies:** Canonical posting engine, authoritative reports, and
  separate product-scope decision.
- **What it affects:** Reporting, dashboard, AI, exports, and future planning
  workflows.
- **Revisit:** After the accounting and reporting foundation is complete.
- **Change authority:** Product owner/stakeholder with accounting, product, and
  architecture review.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-17, BL-19, BL-25
- **Related architecture:** None until separately scoped.

### PD-19 — Accounting periods

- **Status:** APPROVED
- **Current decision/direction:** The product requires financial years,
  accounting periods, open/closed status, controlled reopening, posting
  restrictions, and an audit trail. Exact implementation remains a technical
  architecture decision.
- **Reason:** Accounting authority requires controlled period boundaries and
  prevents unauthorised changes to closed history.
- **Impact:** Posting, corrections, reports, VAT, permissions, and audit must
  respect period state.
- **Dependencies:** Canonical posting engine, chart/configuration, permissions,
  and correction policy.
- **What it affects:** Journals, invoices, bills, payments, VAT, reports,
  reversals, and audit.
- **Revisit:** When the technical architecture or close/reopen policy is
  explicitly refined.
- **Change authority:** Product owner/stakeholder may change the product
  requirement explicitly; accounting and architecture review required.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-06, BL-07, BL-10, BL-17, BL-24
- **Related architecture:** Active Technical Architecture; exact period policy
  remains **REQUIRES USER DECISION**.

### PD-20 — AI boundaries

- **Status:** APPROVED
- **Current decision/direction:** The Manifesto is authoritative. AI may
  analyse, explain, recommend, classify, identify anomalies, prepare drafts,
  and assist with repetitive work. AI must not silently make irreversible
  financial decisions, post consequential accounting transactions without the
  required control, submit VAT returns without approval/control, delete
  accounting records, modify locked records, or send consequential external
  financial communications without approval/control.
- **Reason:** AI must remain an assistant within explicit accounting and human
  control boundaries.
- **Impact:** Rules precede automation, suggestions require explanations, and
  consequential actions require explicit authenticated approval and audit.
- **Dependencies:** Manifesto, permissions, canonical posting, VAT authority,
  audit, and notification policy.
- **What it affects:** AI Accountant, reconciliation, VAT, automation, posting,
  communications, and every consequential workflow.
- **Revisit:** Only through an explicit product-governance review that remains
  consistent with the Manifesto.
- **Change authority:** Product owner/stakeholder and Manifesto-level governance;
  implementation convenience cannot weaken this decision.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-05, BL-06, BL-14, BL-15, BL-19, BL-21
- **Related architecture:** Active Technical Architecture; approved AI
  boundaries remain binding.

### PD-21 — Notifications

- **Status:** PROVISIONAL
- **Current decision/direction:** Support in-app notifications and important
  email notifications initially. Additional channels may be considered later.
- **Reason:** Users need visible operational follow-up without committing to
  every communication channel at launch.
- **Impact:** Preferences, severity, delivery state, retries, escalation, and
  external-send approval need explicit rules.
- **Dependencies:** Email provider, notification policy, permissions,
  collections, automation, and audit.
- **What it affects:** Tasks, VAT, collections, documents, AI, automation, and
  settings.
- **Revisit:** Before implementing additional channels or consequential sends.
- **Change authority:** Product owner/stakeholder with security, privacy, and
  architecture review.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-18, BL-21, BL-22, BL-25
- **Related architecture:** Active Technical Architecture; delivery policy
  remains **REQUIRES USER DECISION**.

### PD-22 — Audit / retention

- **Status:** PROVISIONAL
- **Current decision/direction:** Consequential accounting and AI actions must
  be auditable, including accounting actions, approvals, reversals/corrections,
  VAT, reconciliation, AI recommendations, consequential AI actions, and
  external communications. Exact retention, deletion, and export policy remains
  to be defined.
- **Reason:** Financial trust requires traceability while legal and operational
  retention requirements still need a precise policy.
- **Impact:** Audit records, actor identity, timestamps, source evidence,
  immutable history, retention, deletion, and export must be designed together.
- **Dependencies:** Product scope, legal/regulatory requirements, documents,
  permissions, and architecture.
- **What it affects:** Every consequential workflow, documents, reports,
  settings, and production operations.
- **Revisit:** Before launch and when retention or deletion requirements become
  specific.
- **Change authority:** Product owner/stakeholder with accounting, legal,
  privacy, security, and architecture review.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-10, BL-14, BL-18, BL-19, BL-21, BL-24
- **Related architecture:** Active Technical Architecture; retention,
  deletion, and export policy remain **REQUIRES USER DECISION**.

### PD-23 — Tenant security / RLS

- **Status:** PROVISIONAL
- **Current decision/direction:** The primary security boundary is
  authentication, authorization, and server-side company/tenant scoping.
  Database-level RLS may be considered as defence-in-depth where appropriate.
  Do not introduce RLS solely because it is theoretically stronger if it
  conflicts with the existing architecture without a clear benefit.
- **Reason:** Tenant isolation must be reliable, while the layered security
  design should be evaluated against the actual architecture and operations.
- **Impact:** Membership checks, role capabilities, query scoping, mutation
  boundaries, audit, testing, and possible database policy design are affected.
- **Dependencies:** Identity, role/capability matrix, database architecture,
  production operations, and threat assessment.
- **What it affects:** All company-scoped data and every authenticated workflow.
- **Revisit:** Before release readiness and whenever the security architecture
  materially changes.
- **Change authority:** Product owner/stakeholder with security, architecture,
  and operations review.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-01, BL-02, BL-03, BL-24, BL-25
- **Related architecture:** Active Technical Architecture; RLS policy remains
  **REQUIRES USER DECISION**.

### PD-24 — Governance hierarchy and living authority documents

- **Status:** APPROVED
- **Current decision/direction:** The Ledgerly governance hierarchy is:
  1. Ledgerly Manifesto.
  2. Product Principles.
  3. PRD / Product Scope.
  4. Technical Architecture.
  5. Feature Specifications / Master Backlog.
  The Manifesto remains unchanged and is the highest authority. The Product
  Principles, PRD/Product Scope, and Technical Architecture are living
  governance documents; they do not make unresolved decisions permanent or
  silently authorise implementation.
- **Reason:** Ledgerly requires a clear authority chain from product purpose to
  individual implementation work, while preserving explicit review of unresolved
  product and accounting-core decisions.
- **Impact:** Feature specifications, backlog items, implementation tasks,
  product decisions, and existing code must conform to the higher documents.
  Product analysis, feature matrices, implementation tasks, and code remain
  supporting evidence or execution controls rather than authority over the
  hierarchy.
- **Dependencies:** Manifesto, Product Principles, PRD/Product Scope, Technical
  Architecture, Master Backlog, and the accounting-core decision pack.
- **What it affects:** All product decisions, accounting design, migrations,
  feature specifications, implementation prioritisation, release readiness, and
  governance review.
- **Revisit:** Whenever an explicit governance amendment is proposed.
- **Change authority:** Product owner/stakeholder through an explicit documented
  decision. The decision must identify consequences for existing
  implementation, accounting data, database/schema, migrations, backwards
  compatibility, dependent features, and Master Backlog items.
- **Date recorded:** 2026-08-21
- **Related backlog:** BL-25, BL-26
- **Related architecture:** Active Technical Architecture; the accounting-core
  design remains **REQUIRES USER DECISION**.

## Explicitly open decisions

These are not silently resolved by the provisional directions above:

- Final product name: Ledgerly or Ledgerpoint.
- Final launch definition, including supported countries and tax regimes.
- Open Banking provider and whether live feeds are required at launch.
- Email provider and inbound email requirements.
- OCR provider and document-storage provider.
- Payment collection/card-processing provider and scope.
- Detailed quote and estimate lifecycle.
- Detailed purchase-order lifecycle.
- Detailed item and Contacts entity design.
- Supported VAT schemes and exact MTD/HMRC filing scope.
- Detailed notification channels, preferences, retries, and escalation.
- Audit, document retention, deletion, and export policy.
- Exact Owner/Admin/Accountant/Manager/Read-only capability matrix.
- Detailed AI and automation execution boundaries where the Manifesto does not
  already decide the issue.
- Production monitoring, backups, recovery, and RLS policy.

## Deferred and future decisions

The following do not need to be decided for every immediate core-accounting
task:

- Final product name until branding or public launch work.
- Open Banking, email, OCR, document-storage, and payment providers until the
  relevant integration is approved.
- Detailed quotes, purchase orders, item catalogue, notification channels,
  and advanced expense scope until their implementation is prioritised.
- Full multi-currency until a non-GBP requirement is approved.
- Payroll, inventory, fixed assets, and budgeting/forecasting until separately
  scoped after the authoritative accounting foundation.

## Decision-change process

When changing an existing decision:

1. Identify the existing decision ID.
2. Explain why it is being reconsidered.
3. Assess affected architecture, features, backlog items, and migrations.
4. Record the new decision and status.
5. Update affected governance documentation.
6. Identify required rework or migration.
7. Only then create or approve implementation work.

The coding agent must never change product direction silently through code.

## Implementation rule

This register describes product direction; it is not an implementation queue.
The Master Backlog determines priority, and an implementation task must be
explicitly approved before code changes begin. If a task depends on an OPEN,
DEFERRED, or unresolved decision, the dependency must be reported instead of
being decided by the coding agent.