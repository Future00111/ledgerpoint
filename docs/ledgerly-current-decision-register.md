# Ledgerly Current Decision Register

**Purpose:** Clean approval list for accounting-core implementation  
**Reviewed sources:** Ledgerly Manifesto; Product Principles; PRD / Product
Scope; Technical Architecture; BL-06 / BL-07 Accounting Core Architecture
Review; BL-06 / BL-07 Accounting Core Decision Pack; Master Backlog  
**Register status:** Decisions 1–5 approved; DEC-06 through DEC-22 require
explicit approval
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
- **Decision boundary:** DEC-05 was separately approved as the capability
  model. DEC-06 through DEC-22 remain separate unresolved decisions. DEC-04
  selects no period, chart, control-account, payment-treatment, retention, RLS,
  migration-cohort, cutover, schema, API, or implementation policy reserved to
  those decisions.
- **Accounting implications:** Establishes the canonical journal, posting,
  payment, allocation, source, audit, VAT-adapter, and reporting authority
  contracts; the remaining policy decisions refine how those contracts operate.
- **Data/schema implications:** Establishes the logical normalized journal,
  idempotency, source-link, and protected mutation boundaries without approving
  physical schema or migration work.
- **Migration implications:** Establishes additive adapters, validation,
  dual-read comparison, and controlled cutover as the architecture; DEC-22
  still decides the cohort, sequencing, rollback, and authority retirement.
- **Backlog implications:** Direct prerequisite for BL-06 and BL-07 and
  dependency for BL-08, BL-09, BL-13, BL-14, BL-15, and BL-17.
- **Implementation limit:** Architecture approval does not authorise an
  implementation task, code, schema, migration, UI, workflow, dependency,
  deployment, or publishing change. BL-06 and BL-07 remain blocked.
- **Dependency:** DEC-02 and DEC-03; the applicable remaining decisions below
  must still be resolved before implementation approval.
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
- **Dependencies:** DEC-04 and applicable DEC-06 through DEC-22 decisions.
- **Implementation limit:** DEC-05 does not authorise an implementation task,
  code, schema, migration, UI, workflow, dependency, deployment, or publishing.
  BL-06 and BL-07 remain blocked.
- **Amendment rule:** Future capabilities or role-preset changes must be
  recorded through the Living Product Decisions process and must not weaken
  approved accounting safety boundaries.

### DEC-06 — Financial-year start and change policy

- **Status:** REQUIRES USER DECISION
- **Decision review:** [DEC-06 Financial-Year Policy
  Review](ledgerly-dec-06-financial-year-policy-review.md).
- **Decision:** Define the financial-year start, whether companies may change it,
  and how a change behaves after accounting records exist.
- **Options available:** (a) fixed calendar year; (b) configurable company
  start; or (c) UK statutory/company-year import.
- **Replit's recommendation:** Use a company-configurable start with a launch
  default, while preserving established period boundaries after posting.
- **Why it is recommended:** It supports real businesses without allowing
  historical accounting boundaries to move silently.
- **Accounting implications:** Every journal must resolve to one financial year;
  boundary changes require controlled review and may affect reports and VAT.
- **Data/schema implications:** Requires fiscal-year boundaries and links from
  periods and postings to the applicable year.
- **Migration implications:** Historical records need deterministic date
  assignment; missing or ambiguous dates require review.
- **Backlog implications:** Gates BL-07 and BL-17 and affects BL-06, BL-08,
  BL-13, and BL-15.
- **Dependency:** DEC-04 and DEC-05.

### DEC-07 — Period frequency, creation, close, and reopen

- **Status:** REQUIRES USER DECISION
- **Decision:** Define period frequency, generation, close conditions, normal
  posting restrictions, reopening authority, and reopening conditions.
- **Options available:** (a) monthly periods; (b) quarterly periods; or (c)
  configurable monthly, quarterly, or custom periods.
- **Replit's recommendation:** Contiguous monthly periods, privileged close,
  closed-period rejection, and elevated, reasoned, audited reopening.
- **Why it is recommended:** It provides predictable reporting and control
  without allowing closed history to be changed casually.
- **Accounting implications:** Determines posting dates, correction/reversal
  behavior, VAT cutoffs, and period-based reports.
- **Data/schema implications:** Requires fiscal years, periods, status,
  close/reopen actor, timestamps, reasons, and posting-period links.
- **Migration implications:** Historical records must be assigned to periods;
  existing closed-range data must not be silently reposted.
- **Backlog implications:** Gates BL-06, BL-07, BL-15, BL-17, and BL-24.
- **Dependency:** DEC-05 and DEC-06.

### DEC-08 — Year-end treatment

- **Status:** REQUIRES USER DECISION
- **Decision:** Decide whether year-end is a reporting boundary only or creates
  explicit closing entries.
- **Options available:** (a) automatic retained-earnings journal; (b) explicit
  approved closing journal; or (c) reporting-only treatment initially.
- **Replit's recommendation:** Use reporting-only boundaries initially and do
  not create automatic closing journals.
- **Why it is recommended:** It avoids inventing unsupported historical entries
  and keeps year-end effects reviewable until a complete closing model exists.
- **Accounting implications:** Determines treatment of P&L, retained earnings,
  balance-sheet carry-forward, reopening, and year-end corrections.
- **Data/schema implications:** If closing entries are approved, they require an
  explicit source type, idempotency key, period link, and audit record.
- **Migration implications:** Historical closing entries must not be
  reconstructed where evidence is missing.
- **Backlog implications:** Gates BL-06, BL-07, and BL-17.
- **Dependency:** DEC-06 and DEC-07, plus the adopted architecture in DEC-04.

### DEC-09 — Default chart of accounts and template

- **Status:** REQUIRES USER DECISION
- **Decision:** Approve the default UK small-business chart, account types,
  subtypes, protected accounts, and company customization rules.
- **Options available:** (a) minimal Ledgerly chart; (b) versioned UK template;
  or (c) user-created chart only.
- **Replit's recommendation:** A versioned UK template copied into each company,
  customizable only within controlled accounting constraints.
- **Why it is recommended:** It gives small businesses a useful starting point
  while preserving repeatable posting and reporting behavior.
- **Accounting implications:** Establishes stable account classifications and
  control/reporting roles; referenced accounts should deactivate rather than be
  deleted.
- **Data/schema implications:** Requires company-scoped accounts, codes,
  types/subtypes, active/protected states, and validation rules.
- **Migration implications:** Legacy accounts need explicit mapping; name-only
  guesses remain review items.
- **Backlog implications:** Gates BL-06, BL-07, BL-15, BL-17, and dependent
  source-posting work.
- **Dependency:** DEC-02, DEC-03, DEC-04, and DEC-05.

### DEC-10 — Mandatory control-account mappings

- **Status:** REQUIRES USER DECISION
- **Decision:** Define mandatory mappings for AR, AP, output/input VAT, bank/cash,
  revenue, expense, equity, and other required control accounts, including
  remapping rules.
- **Options available:** (a) one global hard-coded set; (b) required
  company-level configuration; or (c) arbitrary account selection per posting.
- **Replit's recommendation:** Company-scoped required mappings with
  effective-dated changes and controlled future-only effect.
- **Why it is recommended:** It prevents client input or mutable configuration
  from silently changing posted accounting outcomes.
- **Accounting implications:** Determines debit/credit destinations, VAT
  classification, control-account integrity, and report grouping.
- **Data/schema implications:** Requires typed mapping records, effective dates,
  posting configuration snapshots, and audit evidence for changes.
- **Migration implications:** Existing categories and account references need
  reviewed mapping; unresolved history must remain visible as legacy.
- **Backlog implications:** Gates BL-06, BL-07, BL-08, BL-09, BL-13, BL-15, and
  BL-17.
- **Dependency:** DEC-09 and DEC-03.

### DEC-11 — Account and configuration versioning

- **Status:** REQUIRES USER DECISION
- **Decision:** Decide how chart, tax, control mappings, and posting
  configuration change over time.
- **Options available:** (a) mutable current configuration; (b) immutable
  snapshots with a current pointer; or (c) effective-dated versions.
- **Replit's recommendation:** Immutable effective-dated versions, with the
  selected version recorded on each posting.
- **Why it is recommended:** Historical accounting remains reproducible when
  configuration changes later.
- **Accounting implications:** Prevents retroactive remapping of posted
  entries; corrections use explicit replacement or reversal behavior.
- **Data/schema implications:** Requires version records, effective dates,
  audit, validity checks, and posting references to the applied version.
- **Migration implications:** Legacy records need a known version where
  possible, or an explicit legacy/unknown marker.
- **Backlog implications:** Gates BL-06, BL-07, BL-08, BL-13, BL-15, and BL-17.
- **Dependency:** DEC-09 and DEC-10.

## Source and payment decisions

### DEC-12 — Invoice, bill, and VAT source freshness

- **Status:** REQUIRES USER DECISION
- **Decision:** Define how source revisions, hashes, VAT results, and stale
  approval attempts are detected and handled.
- **Options available:** (a) trust post-time values; (b) revision/hash checks;
  (c) approval-to-post locking; or (d) revision checks combined with short
  transactional locks.
- **Replit's recommendation:** Revision/hash checks with transactional locking;
  reject stale approvals and require recalculation.
- **Why it is recommended:** It binds accounting and VAT effects to the source
  the user actually approved.
- **Accounting implications:** Posted entries retain the exact source basis;
  later edits require correction or replacement rather than mutation.
- **Data/schema implications:** Requires source revision/hash, VAT result/version,
  durable snapshot, idempotency, and audit contracts.
- **Migration implications:** Older sources need a baseline or explicit
  unknown-version state; incomplete history must not be invented.
- **Backlog implications:** Gates BL-04, BL-05, BL-06, BL-08, and BL-15.
- **Dependency:** DEC-04 and DEC-05; it must be resolved before source posting.

### DEC-13 — Customer overpayments and supplier prepayments

- **Status:** REQUIRES USER DECISION
- **Decision:** Define how amounts exceeding an invoice or bill are retained,
  allocated, refunded, and presented.
- **Options available:** (a) cap or discard the remainder; (b) retain the
  remainder as a distinct state; or (c) force a refund.
- **Replit's recommendation:** Retain a distinct unapplied remainder, normally
  represented as a customer credit liability or supplier prepayment asset.
- **Why it is recommended:** It preserves received cash and prevents balances
  from being falsified by forced allocation.
- **Accounting implications:** Separates payment total, allocations, open
  balance, unapplied amount, refund, and VAT effects.
- **Data/schema implications:** Requires payment/allocation states, configured
  accounts, journal links, and audit events.
- **Migration implications:** Existing capped paid/balance fields cannot safely
  reconstruct the remainder without evidence.
- **Backlog implications:** Gates BL-09, BL-10, BL-14, and BL-16 and informs
  BL-06/BL-07 control design.
- **Dependency:** DEC-04, DEC-09, DEC-10, and DEC-12.

### DEC-14 — First-class unapplied cash

- **Status:** REQUIRES USER DECISION
- **Decision:** Decide whether unapplied cash is a first-class payment/subledger
  state and how it is subsequently allocated or refunded.
- **Options available:** (a) metadata flag only; (b) dedicated account/subledger
  state; or (c) immediate allocation.
- **Replit's recommendation:** First-class payment/subledger state; do not force
  allocation when evidence is insufficient.
- **Why it is recommended:** It maintains traceability and avoids assigning cash
  to the wrong customer, supplier, or document.
- **Accounting implications:** Cash posts once while allocation, refund, and
  open-item effects remain distinct and reconcilable.
- **Data/schema implications:** Requires explicit remainder, allocation,
  reversal, status, and journal relationships.
- **Migration implications:** Unmatched historical bank matches need reviewed
  classification rather than arbitrary attachment.
- **Backlog implications:** Gates BL-09, BL-14, BL-16, and BL-17.
- **Dependency:** DEC-13 and DEC-10.

### DEC-15 — Refund workflow and scope

- **Status:** REQUIRES USER DECISION
- **Decision:** Define eligible refund sources, linkage requirements, payment
  reversal behavior, VAT effects, and approval controls.
- **Options available:** (a) standalone refunds; (b) refunds require a linked
  credit note or return source; or (c) standalone refunds only against
  unapplied balances.
- **Replit's recommendation:** Use a linked customer/supplier credit or return
  source, with a separate controlled payment reversal.
- **Why it is recommended:** It preserves the reason and accounting lineage for
  money leaving or returning to the business.
- **Accounting implications:** Determines direction, bank/cash effects,
  allocation reversal, VAT treatment, correction, and audit.
- **Data/schema implications:** Requires refund sources, links to payments and
  reversals, approval state, and idempotency.
- **Migration implications:** Existing bank rows linked to credits need
  validation before being treated as refunds.
- **Backlog implications:** Gates BL-10, BL-14, BL-16, and payment workflows.
- **Dependency:** DEC-13, DEC-14, DEC-03, and DEC-12.

### DEC-16 — Payment-on-account scope

- **Status:** REQUIRES USER DECISION
- **Decision:** Decide whether customer and/or supplier payment-on-account is
  supported and how it differs from unapplied cash.
- **Options available:** (a) reject payments without a source; (b) customer
  payment-on-account only; or (c) customer and supplier payment-on-account.
- **Replit's recommendation:** Explicit unapplied state, with customer credit
  and supplier prepayment treated distinctly.
- **Why it is recommended:** It avoids overstating settlement and keeps future
  allocation or refund decisions auditable.
- **Accounting implications:** Payment, allocation, open-item, refund, and
  statement balances remain separate.
- **Data/schema implications:** Requires state, later allocation/refund/reversal,
  and customer/supplier treatment fields.
- **Migration implications:** Unmatched bank rows need approved classification;
  old paid totals cannot be assumed to represent on-account amounts.
- **Backlog implications:** Gates BL-09, BL-14, and BL-16.
- **Dependency:** DEC-13, DEC-14, and DEC-15.

## Retention, export, recovery, and tenant decisions

### DEC-17 — Audit retention period

- **Status:** REQUIRES USER DECISION
- **Decision:** Define retention duration and classification for posted journals,
  source links, approvals, reversals, VAT, reconciliation, AI actions,
  documents, and personal data.
- **Options available:** (a) retain for the company life; (b) use a defined
  legal period; or (c) retain accounting evidence indefinitely while applying a
  separate policy to personal data, documents, and AI records.
- **Replit's recommendation:** Retain posted accounting evidence and its audit
  trail for the company life plus the applicable legal period, with separate
  classifications for personal, document, and AI data.
- **Why it is recommended:** Financial history must remain reconstructable while
  allowing privacy and retention rules to differ by data type.
- **Accounting implications:** Posted journals, approvals, source links, and
  corrections cannot be casually removed.
- **Data/schema implications:** Requires retention classes, legal-hold state,
  actor/timestamp evidence, and durable audit relationships.
- **Migration implications:** Historical records need classification; missing
  audit evidence remains visible rather than fabricated.
- **Backlog implications:** Gates BL-18, BL-19, BL-21, BL-24, and BL-25.
- **Dependency:** DEC-02, DEC-04, DEC-05, and DEC-18.

### DEC-18 — Deletion and anonymisation policy

- **Status:** REQUIRES USER DECISION
- **Decision:** Define what may be physically deleted, anonymised, archived, or
  retained, especially for posted accounting and audit records.
- **Options available:** (a) physical deletion; (b) no accounting/audit deletion
  with controlled personal-data redaction; or (c) archive all records.
- **Replit's recommendation:** Never delete posted accounting or audit evidence;
  allow controlled draft deletion and narrowly governed personal-data
  redaction.
- **Why it is recommended:** Deletion must not become an alternative way to
  correct history or make balances unreproducible.
- **Accounting implications:** Corrections remain reversals, credit notes, or
  replacement entries; original evidence remains traceable.
- **Data/schema implications:** Requires immutable records, redaction markers,
  archive state, referential safety, and legal-hold handling.
- **Migration implications:** Historical deletion gaps must be recorded as gaps,
  not concealed during migration.
- **Backlog implications:** Gates BL-10, BL-18, BL-19, BL-21, and BL-24.
- **Dependency:** DEC-17 and DEC-05.

### DEC-19 — Export formats, scope, and permissions

- **Status:** REQUIRES USER DECISION
- **Decision:** Define accounting, audit, report, document, and data export
  formats, scope, access authority, and versioning.
- **Options available:** (a) CSV/PDF; (b) CSV plus machine-readable JSON; or
  (c) a full archive including documents and audit evidence.
- **Replit's recommendation:** Company-scoped CSV plus versioned machine JSON for
  canonical accounting/audit data, with human-readable reports separately.
- **Why it is recommended:** It supports both operational use and durable
  system-to-system/accounting evidence without conflating report layouts with
  canonical data.
- **Accounting implications:** Export totals must reconcile to posted journals
  and expose source/audit links appropriate to the user's authority.
- **Data/schema implications:** Export contracts become versioned compatibility
  interfaces and export events must be audited.
- **Migration implications:** Legacy formats must be labelled as legacy and not
  treated as canonical output.
- **Backlog implications:** Gates BL-17, BL-18, BL-23, and BL-24.
- **Dependency:** DEC-04, DEC-05, DEC-17, and DEC-18.

### DEC-20 — Backup and recovery objectives

- **Status:** REQUIRES USER DECISION
- **Decision:** Set recovery point objective, recovery time objective, backup
  retention, restore-test frequency, and regional/operational recovery needs.
- **Options available:** (a) provider defaults; (b) managed daily backups or
  point-in-time recovery; or (c) managed backups plus tested restore and
  regional recovery.
- **Replit's recommendation:** Encrypted managed backups, point-in-time
  recovery where available, documented retention, explicit RPO/RTO, and tested
  restores.
- **Why it is recommended:** Recovery must preserve accounting ordering,
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

- **Status:** REQUIRES USER DECISION
- **Decision:** Decide the required combination of server-side company scoping,
  permission enforcement, and database-level row-level security.
- **Options available:** (a) application scoping only; (b) RLS for accounting
  tables; or (c) RLS for all company-scoped tables.
- **Replit's recommendation:** Mandatory authenticated server-side company
  scoping, with tested RLS evaluated as defence-in-depth rather than assumed
  universally.
- **Why it is recommended:** It preserves compatibility with the current
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

- **Status:** REQUIRES USER DECISION
- **Decision:** Define supported legacy shapes and sources, migration cohort,
  sequencing, validation, cutover, rollback, and backwards-compatibility
  policy.
- **Options available:** (a) destructive replacement; (b) additive canonical
  tables with adapters and controlled cutover; or (c) permanent dual
  authorities.
- **Replit's recommendation:** Validated additive adapters with a controlled
  cohort/source cutover, dual-read comparison, visible ambiguity, and rollback
  checkpoints. Canonical posted journals become the sole reporting authority
  after cutover.
- **Why it is recommended:** It protects existing evidence while allowing the
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

Recommendations in this register are not approvals. BL-06 and BL-07 remain
**BLOCKED** until the required decisions are explicitly approved or amended,
recorded in the Living Product Decisions Register, and reflected in the
Technical Architecture, PRD/Product Scope, and affected backlog dependencies.

No application code, database schema, migrations, UI, workflows, dependencies,
deployment, or publishing changes are authorised by this register.