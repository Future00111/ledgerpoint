# Ledgerpoint BL-06 / BL-07 Pre-Implementation Decision Pack

**Scope:** Pre-implementation product, accounting, and architecture decisions  
**Prepared:** 2026-08-21  
**Applies to:** BL-06 Canonical Posting Engine; BL-07 Chart, Defaults, Periods and Accounting Configuration  
**Decision status:** DEC-01 through DEC-15 APPROVED; DEC-16 through DEC-22
REQUIRE EXPLICIT REVIEW
**Implementation status:** BLOCKED
**Current decision register:** [Ledgerly Current Decision Register](ledgerly-current-decision-register.md)

> This is a decision pack, not an implementation plan authorised for execution.
> It does not approve code, schema changes, migrations, UI changes,
> dependencies, workflows, publishing, or deployment.

## How to read this pack

Each section uses the following labels:

- **ALREADY DECIDED** — supported by existing project governance or the
  accepted design proposal. It is not reopened here unless an explicit change
  is requested.
- **RECOMMENDED** — a proposed option that best fits the Manifesto and current
  product direction. It is not approved merely because it is recommended.
- **REQUIRES USER DECISION** — Lee must explicitly approve, reject, or amend
  the proposal before the affected implementation task can be approved.

No recommendation in this document should be represented as `APPROVED` in the
Living Product Decisions Register until it has been explicitly accepted.

## Recorded approval

### Decision 1 — Governance hierarchy and living authority documents

- **Status:** APPROVED
- **Decision:** The Ledgerly governance hierarchy is:
  1. Ledgerly Manifesto.
  2. Product Principles.
  3. PRD / Product Scope.
  4. Technical Architecture.
  5. Feature Specifications / Master Backlog.
- **Approved outcome:** The Manifesto remains unchanged and is the highest
  authority. The [Product Principles](ledgerly-product-principles.md),
  [PRD / Product Scope](ledgerly-prd-product-scope.md), and [Technical
  Architecture](ledgerly-technical-architecture.md) are established as living
  governance documents based on the Manifesto and existing project
  documentation.
- **Limit:** This approval establishes the hierarchy and documents. It does not
  approve unresolved product scope, accounting-core architecture, schema,
  migration, UI, workflow, deployment, or implementation decisions.
- **Amendment rule:** A future amendment requires an explicit documented
  decision that identifies consequences for existing implementation, accounting
  data, database/schema, migrations, backwards compatibility, dependent
  features, and Master Backlog items.

## 1. Product Principles

- **Status:** APPROVED — governance document established by Decision 1.
- **Approved outcome:** The Product Principles document now translates the
  Manifesto and existing governance into practical decision principles without
  selecting unresolved product scope or technical design.
- **Remaining decision:** No separate creation/restoration decision remains.
  Any future amendment follows the Decision 1 amendment rule.
- **Accounting/data consequences:** The principles will constrain choices such
  as explainability, control, simplicity, correction, and reporting authority.
  They should not directly define table names or implementation details.
- **Migration consequences:** None immediately. Future migrations must be
  checked against the adopted principles.
- **Dependencies:** Manifesto, PRD/Product Scope, Technical Architecture,
  BL-25, BL-26.

## 2. PRD / Product Scope

- **Status:** APPROVED — DEC-02.
- **Decision:** Ledgerly's initial product scope is authoritative core
  accounting, UK accounting and VAT preparation, invoices, bills, payments,
  banking, reconciliation, and reporting. The initial market/currency direction
  is UK/GBP.
- **Scope boundary:** This is a launch-scope decision, not a permanent
  restriction. Additional markets, currencies, and capabilities may be added
  later through the established Product Decisions and governance process.
  Additional capabilities are not part of the initial accounting-core
  implementation unless separately approved.
- **Architecture constraint:** Avoid unnecessarily hard-coding UK/GBP so future
  markets and currencies can be introduced without a fundamental redesign.
- **Accounting/data consequences:** The posting engine must support the
  approved initial source types and tax treatments. Unsupported additional
  sources must not create speculative journals.
- **Migration consequences:** Initial migration and canonical backfill are
  limited to the approved scope; future-market or future-capability records
  require later compatibility decisions.
- **Dependencies:** Product Principles and Decision 1 (approved); DEC-03 and
  subsequent accounting-core decisions remain unresolved.
- **Explicit product decision:** DEC-02 is approved and may be amended only
  through an explicit, documented Living Product Decisions update.

## 3. Technical Architecture

- **Status:** APPROVED — governance document established by Decision 1; DEC-04
  approves the accounting-core architecture foundation.
- **Approved outcome:** Option A adopts
  `docs/ledgerly-accounting-core-architecture-review.md` as the accounting-core
  foundation within the Technical Architecture, with the targeted amendments
  and deliberate non-locks in the [DEC-04 adoption review](ledgerly-dec-04-accounting-core-adoption-review.md).
  The approved invariants are normalized append-only journals, server-side
  transactional double-entry posting, integer minor-unit money with explicit
  currency, source/version/company-scoped idempotency, immutable linked
  corrections, separate settlement/evidence concepts, the DEC-03 VAT adapter,
  journal-authoritative reporting, company-scoped capability/audit boundaries,
  and additive evidence-based compatibility and migration.
- **Decision boundary:** DEC-05, DEC-06, and DEC-07 are separately approved as
  the capability model, financial-year policy, and accounting-period policy.
  DEC-08 is separately approved as the reporting-only year-end policy. DEC-09
  through DEC-22 remain unresolved. These approvals do not approve
  their policy choices, physical schema, migration execution, API/UI changes,
  or an implementation task.
- **Accounting/data consequences:** The architecture determines canonical
  journal, period, account, payment, allocation, source, audit, and reporting
  contracts. It must not permit browser-created journal lines or generic
  mutation of posted history.
- **Migration consequences:** The accepted additive/adapter approach remains
  the safest route for current JSON journals, source totals, and clients.
- **Dependencies:** Approved Product Principles, PRD/Product Scope, DEC-03,
  applicable unresolved decision-pack items, BL-06, and BL-07.
- **Amendment rule:** DEC-04 may change only through an explicit documented
  decision that records accounting, data/schema, migration, reporting,
  compatibility, security/audit, dependency, and backlog consequences before
  implementation direction changes.

## 4. Owner / Admin / Accountant / Manager / Read-only capabilities

- **Status:** APPROVED — DEC-05 Option B, product/architecture decision only
- **Decision review:** [DEC-05 Capability and Approval Matrix
  Review](ledgerly-dec-05-capability-approval-review.md).
- **Approved outcome:** Option B is approved: named capabilities evaluated
  server-side in the active company context, with active company membership and
  conservative OWNER, ADMIN, ACCOUNTANT, MANAGER, and READ-ONLY presets.
- **Approved principles:** Role names alone are not authoritative; permission
  checks cannot rely solely on browser/UI controls, client-supplied roles,
  arbitrary role strings, or hidden frontend controls; no role may edit or
  delete a posted journal; and AI persistence requires the equivalent manual
  action's server-side capability.
- **Approved role boundary:** OWNER has broad authority subject to accounting
  safety, immutability, and audit. ADMIN has no default posting,
  reversal/correction, or period-reopen authority and requires explicit
  auditable grants. ACCOUNTANT has normal accounting and posting authority,
  with reasoned/audited controlled corrections. MANAGER has scoped operational
  access and no default posting, reversal/correction, or reopen authority.
  READ-ONLY has no mutation path.
- **Options:**
  1. Broad role-based writes.
  2. Capability-based permissions with role presets.
  3. Per-company custom permissions at launch.
- **Approved audit and migration boundary:** Consequential operations retain
  applicable actor, company, capability, target, source, reason, approval,
  result, request context, and audit evidence. Existing broad roles map
  conservatively; ambiguous authority becomes a visible review exception.
- **Role-presets detail:** The approved starting direction is:

  | Capability | Owner | Admin | Accountant | Manager | Read-only |
  |---|---:|---:|---:|---:|---:|
  | View accounting data | Yes | Yes | Yes | Yes | Yes |
  | Create/edit drafts | Yes | Yes | Yes | Scoped | No |
  | Approve operational sources | Yes | Configurable | Yes | Scoped | No |
  | Post accounting entries | Yes | Configurable | Yes | No by default | No |
  | Reverse/correct posted entries | Yes | No by default | Yes, with reason | No | No |
  | Close periods | Yes | No by default | Yes, if assigned | No | No |
  | Reopen periods | Yes | No by default | Separate elevated grant | No | No |
  | Edit chart of accounts | Yes | Configurable | Configurable | No | No |
  | Change accounting defaults | Yes | Configurable | Configurable | No | No |
  | View AI recommendations | Yes | Yes | Yes | Yes | Yes |
  | Persist AI/accounting actions | Based on matching write capability | Based on matching write capability | Based on matching write capability | Scoped | No |

   `Read-only` must have no mutation path. No role may edit or delete a posted
   journal.
  Admin defaults must not silently grant posting, reversal, or period-reopen
  authority.
- **Accounting/data consequences:** Every mutation needs a named capability,
  actor, company, and audit event. Role changes must take effect immediately
  for future actions.
- **Migration consequences:** Existing broad non-`read_only` access must be
  mapped conservatively; some users may lose accounting capabilities until
  explicitly granted.
- **Dependencies:** Active membership enforcement, role validation, audit,
  BL-01, BL-02, BL-19, BL-24, DEC-04, and the applicable DEC-06 through
  DEC-22 decisions.
- **Implementation limit:** DEC-05 approval does not authorise code, schema,
  migrations, UI, workflows, dependencies, deployment, publishing, or an
  implementation task. BL-06 and BL-07 remain blocked.
- **Amendment rule:** Future capabilities and role-preset amendments must use
  the Living Product Decisions process and must not weaken approved accounting
  safety boundaries.

## 5. Financial-year policy

- **Status:** APPROVED — DEC-06, product/accounting policy only
- **Decision review:** [DEC-06 Financial-Year Policy
  Review](ledgerly-dec-06-financial-year-policy-review.md).
- **Approved outcome:** New UK-focused companies default to 1 April through
  31 March, while a company may choose another valid recurring start during
  setup or before its first canonical posted accounting record. Financial-year
  identity is explicit and company-scoped, distinct from document dates,
  transaction dates, VAT periods, tax years, and bank dates.
- **Approved change boundary:** Ordinary company configuration cannot
  retrospectively change the start after canonical posting exists or silently
  reclassify posted records. A future transition requires separate design,
  approval, privileged authority, and full audit.
- **Accounting/data consequences:** Every period and journal must resolve to
  exactly one financial year. Changing the year boundary after posting must
  create an explicit migration/review path rather than rewrite history.
- **Migration consequences:** Existing records need a deterministic financial
  year assignment based on posting date. Ambiguous or missing dates require
  review, not automatic invention.
- **Dependencies:** PD-02/PD-03, period model, posting date policy, reporting,
  BL-07, BL-17.
- **Implementation limit:** DEC-06 does not authorise code, schema, migration,
  UI, workflow, dependency, deployment, publishing, or an implementation task.
  BL-06 and BL-07 remain blocked.

## 6. Accounting-period creation, closing, and reopening

- **Status:** APPROVED — DEC-07, product/accounting policy only
- **Decision review:** [DEC-07 Accounting-Period Policy
  Review](ledgerly-dec-07-accounting-period-policy-review.md).
- **Approved outcome:** Use contiguous monthly periods anchored to each
  approved DEC-06 financial year. Generate all known periods automatically,
  including future periods before they become active for posting. Use only
  `OPEN` and `CLOSED` states.
- **Approved posting and close outcome:** Assign periods server-side from the
  validated posting date; reject ordinary posting into closed periods with no
  direct bypass; and use privileged, validated, audited close and elevated,
  reasoned, audited reopen controls under DEC-05.
- **Approved warning outcome:** Drafts, unallocated payments, unreconciled
  bank evidence, and ordinary VAT timetable differences are visible warnings,
  not automatic close blockers. Genuine accounting or VAT integrity failures
  remain capable of blocking close.
- **Accounting/data consequences:** Posting date, period ID, close state,
  report boundaries, VAT evidence, and correction rules become explicit.
  Reopening changes period availability, not historical journal contents.
- **Migration consequences:** Historical records need period assignment;
  records in a closed historical range cannot be silently reposted.
- **Dependencies:** Financial-year policy, permissions, audit, posting service,
  VAT periods, BL-06, BL-07.
- **Implementation limit:** DEC-07 does not authorise code, schema, migration,
  UI, workflow, dependency, deployment, publishing, or an implementation task.
  BL-06 and BL-07 remain blocked.

## 7. Year-end treatment

- **Status:** APPROVED — DEC-08, product/accounting policy only
- **Decision review:** [DEC-08 Year-End Treatment and Financial-Year
  Transition Review](ledgerly-dec-08-year-end-treatment-review.md).
- **Approved outcome:** Use reporting-only year-end treatment at launch. Do not
  automatically create closing journals, retained-earnings transfers, or
  artificial year-end postings. Financial-year boundaries change reporting and
  presentation without mutating canonical history.
- **Approved completion/correction outcome:** All DEC-07 periods must be closed
  before an auditable year-end review/completion event. No separate overlapping
  period state is created. Corrections use controlled reopen, explicit
  correction/reversal, or approved later-period adjustment without rewriting
  history.
- **Approved reporting/migration outcome:** Temporary-account results derive
  from canonical reporting; permanent balances continue. Migration cannot invent
  closing journals, retained-earnings postings, approvals, events, dates, or
  accounting facts. Explicit closing journals require a later approved policy.
- **Accounting/data consequences:** P&L, balance sheet, retained earnings,
  reopening, and year-end reports must agree. No year-end process may delete or
  rewrite prior journals.
- **Migration consequences:** Historical year-end balances must not be
  reconstructed without evidence. Legacy closing entries should be classified
  and validated.
- **Dependencies:** Financial-year policy, periods, chart defaults, reporting,
  correction policy, BL-06, BL-07, BL-17.
- **Implementation limit:** DEC-08 does not authorise code, schema, migration,
  UI, workflow, dependency, deployment, publishing, or an implementation task.
  BL-06 and BL-07 remain blocked.

## 8. Default UK small-business chart of accounts

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-09 Chart of Accounts and Default Account Policy
  Review](ledgerly-dec-09-chart-of-accounts-policy-review.md).
- **Approved decision:** Use the versioned UK small-business template copied to
  each company, with stable identities, controlled lifecycle, protected
  system-account candidates, and no launch account merging.
- **Options:**
  1. Minimal Ledgerly-owned chart.
  2. A versioned UK small-business template copied into each company.
  3. User-created chart only.
- **Approved boundary:** Company-level names/codes and optional accounts are
  permitted within the approved policy. Protect required control-account
  candidates and preserve any account referenced by posted history. Optional
  template accounts do not imply payroll, inventory, fixed-asset, or
  corporation-tax workflow support.
- **Accounting/data consequences:** Account type, subtype, reporting class,
  control role, active state, and company code must be stable and validated.
  Account deactivation replaces deletion after posting references exist.
- **Migration consequences:** Existing accounts map by explicit code/name
  review. A guess based only on account name must be marked for review.
- **Dependencies:** Product scope, reporting, VAT, permissions, configuration
  versioning, BL-07, BL-17.
- **Implementation limit:** DEC-09 does not authorise code, schema, migration,
  UI, workflow, dependency, deployment, publishing, or an implementation task.

## 9. Control-account mappings

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-10 Control-Account Mapping Policy
  Review](ledgerly-dec-10-control-account-mapping-policy-review.md).
- **Approved decision:** Use protected company-scoped mappings for one AR
  account, one AP account, each accounting bank/cash location, one Output VAT
  account, and one Input VAT account. VAT settlement is protected only where an
  approved VAT-return settlement workflow requires it.
- **Options:**
  1. Hard-code one global set.
  2. Require company configuration for AR, AP, VAT, bank/cash, revenue, and
     expense defaults.
  3. Allow arbitrary account selection for every posting.
- **Approved ordinary-account boundary:** Revenue, cost of sales, ordinary
  expense, ordinary asset, and general equity remain validated configurable
  selections rather than universal control accounts. Retained earnings is not
  a launch default control account.
- **Accounting/data consequences:** A mapping change affects future postings
  only. Existing journals retain their original account IDs. Control-account
  changes require DEC-05 capability, validation, reason where required, and
  audit. DEC-11 establishes the complete configuration-versioning policy;
  implementation remains separately blocked.
- **Migration consequences:** Existing categories and account references need
  a reviewed mapping. Unmapped historical categories remain legacy or require
  explicit correction.
- **Dependencies:** Chart template, VAT, invoice/bill posting, bank posting,
  permissions, BL-06, BL-07.
- **Implementation limit:** DEC-10 does not authorise code, schema, migration,
  UI, workflow, dependency, deployment, publishing, or an implementation task.

## 10. Account configuration and versioning

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-11 Configuration Versioning and Effective Dating
  Review](ledgerly-dec-11-configuration-versioning-review.md).
- **Approved decision:** Use immutable company-scoped effective-dated versions
  for material accounting configuration, selected by validated canonical
  posting date.
- **Options:**
  1. Mutable current configuration.
  2. Immutable version snapshots with a current pointer.
  3. Effective-dated configuration versions.
- **Approved boundaries:** A new material configuration creates a new version.
  Effective ranges cannot overlap or contain an unexplained required gap.
  Future-dated changes are normal; ordinary backdating over posted journals or
  closed periods is prohibited. Each posting retains the version used and
  resolved account IDs.
- **Accounting/data consequences:** Reproducibility improves: a journal can
  explain which account/tax mapping was used. Retroactive remapping is
  prohibited without a correction workflow.
- **Migration consequences:** Existing records need a legacy configuration
  marker where no reliable version exists.
- **Dependencies:** Chart, control mappings, VAT rules, periods, audit,
  BL-06/BL-07.
- **Implementation limit:** DEC-11 does not authorise code, schema, migration,
  UI, workflow, dependency, deployment, publishing, or an implementation task.

## 11. Invoice, bill, and VAT source freshness/version rules

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide what makes a source safe to post and what happens
  when it changes between approval, calculation, and posting.
- **Options:**
  1. Trust current values at post time.
  2. Use optimistic source revision/hash checks.
  3. Lock source records from approval through posting.
  4. Combine revision checks with short transactional locks.
- **Recommendation:** Combine a source revision or canonical content hash
  with transactional row locks. The posting command must include the source
  revision, server-recalculate monetary values, validate the current VAT
  result/version, and reject stale approval with a clear recalculate/review
  action. The same rule applies to invoices, bills, credit notes, payments,
  and VAT evidence.
- **Accounting/data consequences:** Posted journals represent an exact source
  snapshot. A later source edit cannot alter the journal; it requires a
  correction or replacement.
- **Migration consequences:** Existing sources without revision metadata need a
  migration baseline hash/version. Historical snapshots may be incomplete and
  must not be invented.
- **Dependencies:** Server-side monetary validation, deterministic VAT,
  periods, idempotency, BL-04, BL-05, BL-06, BL-08, BL-15.
- **Explicit product decision:** Approve stale-source rejection semantics and
  whether every approval creates a durable source snapshot.

### DEC-12 — Payment, Allocation and Settlement Policy

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-12 Payment, Allocation and Settlement Policy
  Review](ledgerly-dec-12-payment-allocation-settlement-policy-review.md).
- **Approved decision:** Keep payment evidence, payment posting, many-to-many
  allocation, and derived settlement distinct. Use a separate canonical
  payment event, append-only
  allocation events, derived settlement status, and idempotent bank-evidence
  links. Do not permit allocation to create duplicate accounting.
- **Deliberate non-lock:** DEC-13 through DEC-16 retain overpayment,
  unapplied-cash, refund, and payment-on-account policy. Source freshness
  remains a separate unresolved posting-safety policy.

## 12. Overpayments

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-13 Overpayments, Unapplied Cash and Excess Payment
  Policy Review](ledgerly-dec-13-overpayments-unapplied-cash-policy-review.md).
- **Approved decision:** Never discard or silently cap money and retain a
  distinct remainder: customer excess is a customer-credit/receipt-on-account
  liability and supplier excess is a supplier-prepayment/receivable asset.
- **Approved accounting boundary:** Payment total, allocation total, open-item
  balance, unapplied amount, and refund remain separate. Later allocation from
  a customer credit or supplier prepayment uses canonical reclassification;
  allocation cannot make an invoice or bill negative.
- **Accounting/data consequences:** Payment total, allocation total, open item
  balance, unapplied amount, and refund must be separate. Statements must show
  the remainder.
- **Migration consequences:** Current capped `amount_paid` behaviour cannot
  safely reconstruct prior overpayments; only evidenced differences may be
  backfilled.
- **Dependencies:** Payment/allocation model, chart control accounts,
  statements, refunds, BL-09, BL-16.
- **Decision boundary:** DEC-14, DEC-15, and DEC-16 retain detailed unapplied
  cash, refund, and payment-on-account workflow and launch-scope decisions.

## 13. Unapplied cash

- **Status:** APPROVED — product/accounting workflow policy only
- **Decision review:** [DEC-14 Unapplied Cash Workflow
  Policy Review](ledgerly-dec-14-unapplied-cash-workflow-policy-review.md).
- **Approved policy:** Define the detailed user workflow for unapplied cash
  identification, review, matching, allocation, reallocation, and reporting.
- **Options:**
  1. Hold only as a payment metadata flag.
  2. Hold in a dedicated unapplied-cash account/subledger.
  3. Immediately allocate to a selected invoice/bill.
- **Approved workflow:** Use a dedicated unapplied-cash workspace with contextual
  entry points, deterministic suggestions, explicit user confirmation, and no
  silent automatic allocation at launch. DEC-13 remains the accounting
  representation authority.
- **Accounting/data consequences:** Cash remains posted once, while allocation
  status and open-item statements remain independently traceable.
- **Migration consequences:** Existing bank matches with no source allocation
  need classification; they must not be retroactively attached to arbitrary
  documents.
- **Dependencies:** Overpayments, payment allocations, refunds, chart
  mappings, reconciliation, BL-09, BL-14.
- **Decision boundary:** DEC-15 retains refund policy and DEC-16 retains
  payment-on-account launch scope. Source freshness remains separate.

## 14. Refunds

- **Status:** APPROVED — product/accounting policy only
- **Decision review:** [DEC-15 Refund Policy
  Review](ledgerly-dec-15-refund-policy-review.md).
- **Approved policy:** Decide customer and supplier refund workflows, approved
  refundable sources, credit-note relationship, approval, failure, and
  correction policy.
- **Options:**
  1. Allow standalone refunds.
  2. Require a linked credit note/return source.
  3. Support standalone refunds only to an unapplied balance.
- **Approved workflow:** Permit controlled customer refunds only from available
  customer credits and supplier refund receipts only against available supplier
  prepayments. Use a credit note when the commercial/VAT correction requires
  one, but do not invent one for a pure overpayment refund. Keep payment and
  allocation reversals as separate controlled paths.
- **Accounting/data consequences:** Refunds need direction, bank/cash account,
  date, amount, source, allocation reversal, tax treatment, and audit.
- **Migration consequences:** Existing bank rows linked to credit notes need
  source validation before any canonical refund posting.
- **Dependencies:** Credit notes, payments, VAT, bank/reconciliation,
  reversal service, BL-10, BL-14.
- **Decision boundary:** DEC-16 retains payment-on-account launch scope and
  DEC-22 retains migration authority. Source freshness remains separate.

## 15. Payment-on-account

- **Status:** REQUIRES USER DECISION
- **Decision review:** [DEC-16 Payment-on-Account Launch Scope
  Review](ledgerly-dec-16-payment-on-account-launch-scope-review.md).
- **Decision needed:** Decide whether user-facing payment-on-account launches
  for customers, suppliers, or both.
- **Options:**
  1. Reject payments without an open source.
  2. Support customer payment-on-account.
  3. Support both customer and supplier payment-on-account.
- **Recommendation:** Do not expose a separate user-facing payment-on-account
  feature at launch. Use DEC-13 customer-credit and supplier-prepayment
  balances through the DEC-14 workflow, with DEC-15 refund treatment.
- **Accounting/data consequences:** Payment posting and allocation remain
  distinct. Statements must expose on-account balances and avoid overstating
  settled invoices.
- **Migration consequences:** Existing unmatched bank transactions should not
  be automatically converted into payment-on-account without user-approved
  classification.
- **Dependencies:** Unapplied cash, overpayments, refunds, statements,
  bank/reconciliation, BL-09, BL-16.
- **Decision boundary:** DEC-17 onward and DEC-22 migration policy remain open.
  Source freshness remains separate.

## 16. Audit retention

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide how long journals, approvals, reversals,
  calculations, communications, and audit events are retained.
- **Options:**
  1. Retain indefinitely for the life of the company.
  2. Retain for a defined legal/compliance period.
  3. Retain accounting history indefinitely but apply separate policy to
     personal/document data.
- **Recommendation:** Retain posted journals, source relationships, approvals,
  reversals, VAT actions, and accounting audit evidence for the life of the
  company plus the applicable legal/compliance period. Keep a separately
  governed policy for personal data, documents, and AI explanation detail.
  This is a product recommendation, not legal advice.
- **Accounting/data consequences:** Posted history and audit evidence cannot be
  casually deleted. Retention metadata and legal holds must be explicit.
- **Migration consequences:** Historical records need retention classification;
  absence of old audit data must be visible rather than fabricated.
- **Dependencies:** Legal/privacy review, deletion policy, export policy,
  documents, audit, BL-18, BL-24.
- **Explicit product decision:** Approve the retention principles and provide
  the required retention periods with appropriate legal review.

## 17. Deletion policy

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide what can be deleted, anonymised, archived, or
  only cancelled.
- **Options:**
  1. Physical deletion of all records on request.
  2. No deletion of accounting/audit records; redact eligible personal data.
  3. Archive everything while retaining operational access.
- **Recommendation:** Never delete posted journals, journal lines, source
  relationships, reversals, payment allocations, or accounting audit events.
  Allow controlled deletion of unposted drafts only when permitted. Use
  anonymisation/redaction for eligible personal data without changing
  accounting meaning, subject to retention and legal-hold rules.
- **Accounting/data consequences:** History remains explainable and balances
  remain reproducible. Deletion cannot be used as a correction mechanism.
- **Migration consequences:** Legacy deletions must be recorded as gaps; the
  migration must not remove evidence to make balances appear consistent.
- **Dependencies:** Audit retention, privacy, legal holds, permissions,
  reversals, BL-10, BL-18, BL-24.
- **Explicit product decision:** Approve the non-deletion rule and define
  eligible draft/personal-data deletion cases.

## 18. Export policy

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide which accounting, audit, source, and document
  exports are required and who may use them.
- **Options:**
  1. Human-readable CSV/PDF only.
  2. CSV plus machine-readable JSON.
  3. Full archive export including documents and audit evidence.
- **Recommendation:** Support company-scoped CSV and machine-readable JSON for
  chart, periods, journals, journal lines, payments, allocations, VAT
  evidence, and audit events. Add human-readable reports separately. Every
  export records actor, filters, date, and completion/failure; sensitive
  document exports require separate permission.
- **Accounting/data consequences:** Export schemas become compatibility
  contracts. Exported totals must reconcile to posted journals.
- **Migration consequences:** Legacy exports may need a clearly labelled
  legacy format rather than being presented as canonical journals.
- **Dependencies:** Reporting contract, audit, permissions, documents,
  production operations, BL-17, BL-18, BL-24.
- **Explicit product decision:** Approve minimum export formats, document
  inclusion, and role access.

## 19. Backup and recovery policy

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide recovery point objective, recovery time objective,
  backup retention, restore testing, and company/customer visibility.
- **Options:**
  1. Provider-default backups.
  2. Managed daily backups with point-in-time recovery.
  3. Managed backups plus tested restore and regional recovery process.
- **Recommendation:** Require managed backups, point-in-time recovery where
  available, encrypted storage, documented retention, and scheduled restore
  tests before publishing. Define RPO/RTO by product risk rather than assuming
  platform defaults.
- **Accounting/data consequences:** Recovery must preserve journal immutability,
  idempotency, audit ordering, source links, and period state. A restore must
  not replay postings twice.
- **Migration consequences:** Take verified backups before each schema or
  company cutover; provide rollback checkpoints for adapters and projections.
- **Dependencies:** Deployment/operations, database architecture, audit,
  idempotency, BL-24.
- **Explicit product decision:** Approve target RPO/RTO and restore-test
  requirements.

## 20. RLS / tenant-isolation policy

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide whether PostgreSQL RLS is required in addition to
  authentication, authorization, and server-side company scoping.
- **Options:**
  1. Application/service scoping only.
  2. RLS for accounting tables only.
  3. RLS across all company-scoped tables.
- **Recommendation:** Keep authenticated server-side company scoping as the
  mandatory primary boundary. Evaluate RLS as defence-in-depth for canonical
  accounting tables after a tested architecture design, including connection
  pooling, migrations, admin operations, background jobs, and recovery. Do not
  add RLS by assertion or as an untested retrofit.
- **Accounting/data consequences:** Every journal, line, account, period,
  payment, allocation, posting, balance, report, and audit record must be
  company-safe regardless of the final RLS decision.
- **Migration consequences:** RLS may affect backfills, support queries,
  workers, exports, and rollback. It must be introduced with policy tests and
  operational runbooks.
- **Dependencies:** Active membership enforcement, capabilities, database
  architecture, threat model, operations, BL-01, BL-02, BL-24.
- **Explicit product decision:** Approve application scoping alone for launch,
  require RLS, or request a separate RLS feasibility review.

## 21. Historical JSON / legacy-data migration and compatibility

- **Status:** ALREADY DECIDED in principle; REQUIRES USER DECISION on cutover
  policy
- **Decision needed:** Decide how and when current JSON journals, source
  totals, bank links, VAT snapshots, and Base44-shaped APIs transition.
- **Options:**
  1. Destructive replacement.
  2. Additive canonical tables with adapters and controlled cutover.
  3. Permanent dual accounting authorities.
- **Recommendation:** Use the accepted additive approach:
  - preserve current source records and client contracts during transition;
  - treat JSON journals as legacy until individually validated;
  - backfill only evidenced, balanced, company-scoped records;
  - keep ambiguous history visibly legacy;
  - compare legacy and canonical reports before cutover;
  - never invent historical entries;
  - retire generic journal mutation only after parity and regression checks.
- **Accounting/data consequences:** Canonical posted journals become the only
  financial reporting authority after cutover. Existing `amount_paid`,
  `balance_due`, bank matched fields, and VAT snapshots become compatibility
  projections or historical evidence, not competing truth.
- **Migration consequences:** This requires a mapping inventory, validation
  report, per-company/source cutover, rollback checkpoint, and explicit
  treatment for incomplete history.
- **Dependencies:** All BL-06/BL-07 decisions, BL-03/04/05/06/07/08/09/12/
  14/15/17/23/24, current API consumers.
- **Explicit product decision:** Approve additive migration and choose whether
  canonical posting is enabled by source type, company cohort, or one launch
  cutover.

## 22. Settled decisions and constraints

The following are already supported by existing governance and the accepted
architecture/design direction:

- The Ledgerly Manifesto is the highest authority.
- The accounting-core review is accepted as a design proposal, but not as
  implementation permission.
- The journal/posting layer is intended to become the authoritative reporting
  source.
- Posted accounting history must be immutable and corrected through linked
  reversals, credit notes, or replacement entries.
- Double-entry balance must be enforced server-side.
- AI must remain an assistant; it cannot silently post, alter locked history,
  submit VAT, delete accounting records, or send consequential external
  financial communications without required control.
- Deterministic VAT remains authoritative; bank-feed VAT metadata is advisory.
- Explicit authenticated approval is the accounting write boundary.
- Read-only users may inspect recommendations but cannot persist accounting
  decisions or analysis actions.
- Imported bank data is evidence and must not post merely because it was
  imported.
- Internal transfers are excluded from income, expense, and VAT treatment.
- Reports must ultimately derive from authoritative posted journals.
- Existing accounting history must not be invented during migration.

These constraints are not invitations to implement BL-06 or BL-07.

## 23. Decisions requiring Lee's explicit approval

DEC-03, DEC-04, DEC-05, DEC-06, and DEC-07 are approved. Before implementation, Lee
must explicitly approve or amend:

1. Year-end reporting-only versus explicit closing journal.
2. Default UK chart template and account list.
3. Mandatory control-account mappings.
4. Effective-dated account/configuration versioning.
5. Source revision/hash and VAT freshness semantics.
6. Customer overpayment and supplier prepayment treatment.
7. First-class unapplied cash.
8. Refund requirements and launch scope.
9. Customer/supplier payment-on-account scope.
10. Audit retention periods.
11. Deletion/anonymisation policy.
12. Export formats, scope, and permissions.
13. Backup RPO/RTO and restore-test requirements.
14. Application scoping versus RLS policy.
15. Historical migration cohort/cutover policy.

No item above should be marked approved merely because this pack recommends an
option.

## 24. Recommended implementation order after approval

This order is conditional and must not start until the required decisions are
explicitly approved:

1. Record Lee's remaining decisions in the Living Product Decisions Register.
2. Finalise the capability matrix and active-membership enforcement.
3. Finalise money, source freshness, status, period, and correction policies.
4. Define the versioned chart template, control mappings, and configuration
   model.
5. Design additive schema constraints and compatibility adapters.
6. Implement and test BL-07 period, chart, default, and configuration
   primitives.
7. Implement and test BL-06 normalized journals, server-side balance checks,
   source posting, and idempotency.
8. Protect generic CRUD and remove direct posted-journal mutation bypasses.
9. Integrate invoice/bill posting with authoritative source and VAT checks.
10. Add payments, allocations, unapplied cash, overpayments, refunds, and
    payment reversals.
11. Connect bank classification, transfers, and reconciliation without
    double-posting.
12. Expose server-side journal-authoritative reporting and compare legacy
    outputs.
13. Validate historical migration candidates and run a controlled cutover.
14. Complete restore tests, security checks, end-to-end tests, and release
    review before any publication.

## 25. Remaining blockers to BL-06 / BL-07

Implementation remains **BLOCKED** by:

- unresolved accounting-core design adoption, subject to the approved DEC-03
  VAT constraints;
- unresolved capability matrix and elevated accounting permissions;
- unresolved chart template and control-account mappings;
- unresolved source freshness/version contract;
- unresolved overpayment, unapplied cash, refund, and payment-on-account
  policy;
- unresolved audit retention, deletion, and export policy;
- unresolved backup/recovery and RLS policy;
- unresolved historical migration and compatibility cutover policy;
- existing unsafe generic journal mutation and non-authoritative reporting
  paths, which must be addressed only under an approved implementation task.

## Final decision-pack status

**DECISION PACK:** DEC-04 THROUGH DEC-08 APPROVALS RECORDED; REMAINING DECISIONS
REQUIRE REVIEW
**DECISION 1:** APPROVED
**DECISION 2:** APPROVED
**DECISION 3:** APPROVED — S1 + A + H1
**DECISION 4:** APPROVED — architecture only
**DECISION 5:** APPROVED — Option B
**DECISION 6:** APPROVED — financial-year policy
**DECISION 7:** APPROVED — accounting-period policy
**DECISION 8:** APPROVED — reporting-only year-end policy
**DECISION 9–22:** UNRESOLVED
**CURRENT DECISION REGISTER:** DEC-04 THROUGH DEC-08 APPROVALS RECORDED
**BL-06 / BL-07 IMPLEMENTATION:** BLOCKED  
**APPLICATION CODE CHANGED:** NO  
**DATABASE OR MIGRATIONS CHANGED:** NO  
**UI, DEPENDENCIES, WORKFLOWS, OR DEPLOYMENT CHANGED:** NO  