# Ledgerpoint BL-06 / BL-07 Pre-Implementation Decision Pack

**Scope:** Pre-implementation product, accounting, and architecture decisions  
**Prepared:** 2026-08-21  
**Applies to:** BL-06 Canonical Posting Engine; BL-07 Chart, Defaults, Periods and Accounting Configuration  
**Decision status:** PROPOSALS FOR EXPLICIT REVIEW  
**Implementation status:** BLOCKED

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

## 1. Product Principles

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Restore or author the Product Principles document
  referenced by the Manifesto and workflow.
- **Options:**
  1. Restore the missing source document.
  2. Author a new Product Principles document and explicitly adopt it.
  3. Continue with only the Manifesto and treat the lower-level principles as
     intentionally absent.
- **Recommendation:** Restore or author one canonical Product Principles
  document before BL-06/BL-07 implementation. Do not infer it from code,
  backlog items, or this decision pack.
- **Accounting/data consequences:** The principles will constrain choices such
  as explainability, control, simplicity, correction, and reporting authority.
  They should not directly define table names or implementation details.
- **Migration consequences:** None immediately. Future migrations must be
  checked against the adopted principles.
- **Dependencies:** Manifesto, PRD/Product Scope, Technical Architecture,
  BL-25, BL-26.
- **Explicit product decision:** Confirm whether an existing source should be
  restored or whether a new Product Principles document should be created.

## 2. PRD / Product Scope

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Confirm the launch scope around UK SMBs, GBP, VAT,
  invoices, bills, payments, banking, reporting, quotes, purchase orders,
  products/items, expenses, and filing.
- **Options:**
  1. Adopt the current provisional direction as the launch scope.
  2. Narrow launch to authoritative core accounting, VAT preparation,
     invoices/bills, payments, banking, reconciliation, and reporting.
  3. Expand launch scope before accounting-core implementation.
- **Recommendation:** Narrow implementation scope to the authoritative
  accounting foundation and the already supported UK/GBP direction. Keep
  quotes, purchase orders, full item catalogue, Open Banking, provider
  integrations, payroll, inventory, fixed assets, and forecasting outside the
  first accounting-core build unless separately approved.
- **Accounting/data consequences:** The posting engine must support only
  explicitly approved source types and tax treatments. Unsupported sources
  must not create speculative journals.
- **Migration consequences:** Scope changes can alter which existing records
  are eligible for backfill or canonical posting.
- **Dependencies:** Product Principles, launch market/currency decisions,
  VAT/MTD scope, BL-25, BL-11, BL-15.
- **Explicit product decision:** Approve the launch scope and confirm which
  provisional product areas are in or out before implementation.

## 3. Technical Architecture

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide whether the accepted accounting-core review
  becomes the basis for an approved Technical Architecture document.
- **Options:**
  1. Adopt the review with targeted amendments.
  2. Create a separate Technical Architecture document and use the review as
     its accounting-core chapter.
  3. Reject the proposed architecture and commission a different design.
- **Recommendation:** Use
  `docs/ledgerly-accounting-core-architecture-review.md` as the accounting
  foundation for a canonical Technical Architecture document, after resolving
  this pack. Keep the architecture additive, normalized, append-only,
  server-side, company-scoped, and compatible with the existing VAT service.
- **Accounting/data consequences:** The architecture determines canonical
  journal, period, account, payment, allocation, source, audit, and reporting
  contracts. It must not permit browser-created journal lines or generic
  mutation of posted history.
- **Migration consequences:** The accepted additive/adapter approach remains
  the safest route for current JSON journals, source totals, and clients.
- **Dependencies:** Missing Product Principles and PRD/Product Scope,
  decision pack, BL-06, BL-07.
- **Explicit product decision:** Approve the review as the accounting-core
  basis, or specify required architectural changes.

## 4. Owner / Admin / Accountant / Manager / Read-only capabilities

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Approve the capability matrix. Role names alone must
  not decide accounting authority.
- **Options:**
  1. Broad role-based writes.
  2. Capability-based permissions with role presets.
  3. Per-company custom permissions at launch.
- **Recommendation:** Use capability-based server-side permissions with
  conservative role presets:

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

  `Read-only` must have no mutation path. No role may edit a posted journal.
  Admin defaults must not silently grant posting, reversal, or period-reopen
  authority.
- **Accounting/data consequences:** Every mutation needs a named capability,
  actor, company, and audit event. Role changes must take effect immediately
  for future actions.
- **Migration consequences:** Existing broad non-`read_only` access must be
  mapped conservatively; some users may lose accounting capabilities until
  explicitly granted.
- **Dependencies:** Active membership enforcement, role validation, audit,
  BL-01, BL-02, BL-19, BL-24.
- **Explicit product decision:** Approve the proposed presets and identify
  which capabilities, if any, should differ.

## 5. Financial-year policy

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide how a company chooses its financial year and
  whether it may change the start date after posting.
- **Options:**
  1. Fixed calendar year for every company.
  2. Company-configurable start month/day with a launch default.
  3. UK statutory/company-year import only.
- **Recommendation:** Use a company-configurable financial-year start with a
  simple launch default, while preserving the selected boundaries once
  postings exist. Do not equate the financial year automatically with the tax
  year or VAT return cycle.
- **Accounting/data consequences:** Every period and journal must resolve to
  exactly one financial year. Changing the year boundary after posting must
  create an explicit migration/review path rather than rewrite history.
- **Migration consequences:** Existing records need a deterministic financial
  year assignment based on posting date. Ambiguous or missing dates require
  review, not automatic invention.
- **Dependencies:** PD-02/PD-03, period model, posting date policy, reporting,
  BL-07, BL-17.
- **Explicit product decision:** Confirm the launch default and whether the
  financial-year start is changeable after the first posting.

## 6. Accounting-period creation, closing, and reopening

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide period frequency, automatic creation, close
  checks, and reopen controls.
- **Options:**
  1. Monthly periods generated from each financial year.
  2. Quarterly periods only.
  3. Company-configurable monthly/quarterly/custom periods.
- **Recommendation:** Generate contiguous monthly periods from the approved
  financial year, with no gaps or overlaps. Permit a privileged close action
  after checks, reject normal posting into closed periods, and permit reopen
  only with elevated capability, reason, fresh checks, and an audit event.
  Custom period frequencies should wait unless launch scope requires them.
- **Accounting/data consequences:** Posting date, period ID, close state,
  report boundaries, VAT evidence, and correction rules become explicit.
  Reopening changes period availability, not historical journal contents.
- **Migration consequences:** Historical records need period assignment;
  records in a closed historical range cannot be silently reposted.
- **Dependencies:** Financial-year policy, permissions, audit, posting service,
  VAT periods, BL-06, BL-07.
- **Explicit product decision:** Approve monthly periods, close prerequisites,
  and who can reopen them.

## 7. Year-end treatment

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide whether year-end creates an explicit closing
  journal or uses reporting-only year boundaries initially.
- **Options:**
  1. Automatic closing journal to retained earnings.
  2. Explicit user-approved closing journal.
  3. No closing journal initially; reports apply year boundaries and retain
     posted history unchanged.
- **Recommendation:** Do not create an automatic year-end journal in the first
  core build. Use explicit period/report boundaries and preserve history.
  Add an explicit, approved closing journal only when accounting policy and
  retained-earnings treatment are defined.
- **Accounting/data consequences:** P&L, balance sheet, retained earnings,
  reopening, and year-end reports must agree. No year-end process may delete or
  rewrite prior journals.
- **Migration consequences:** Historical year-end balances must not be
  reconstructed without evidence. Legacy closing entries should be classified
  and validated.
- **Dependencies:** Financial-year policy, periods, chart defaults, reporting,
  correction policy, BL-06, BL-07, BL-17.
- **Explicit product decision:** Choose reporting-only initial treatment or
  require an explicit closing-journal workflow at launch.

## 8. Default UK small-business chart of accounts

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide the initial chart template, account taxonomy,
  customisation limits, and versioning.
- **Options:**
  1. Minimal Ledgerly-owned chart.
  2. A versioned UK small-business template copied into each company.
  3. User-created chart only.
- **Recommendation:** Provide a versioned UK small-business template copied
  into each company, with company-level names/codes and optional accounts.
  Protect required control accounts and preserve any account referenced by
  posted history. Avoid implying that payroll, inventory, fixed assets, or
  corporation tax are supported merely because optional template accounts
  exist.
- **Accounting/data consequences:** Account type, subtype, reporting class,
  control role, active state, and company code must be stable and validated.
  Account deactivation replaces deletion after posting references exist.
- **Migration consequences:** Existing accounts map by explicit code/name
  review. A guess based only on account name must be marked for review.
- **Dependencies:** Product scope, reporting, VAT, permissions, configuration
  versioning, BL-07, BL-17.
- **Explicit product decision:** Approve the template approach and provide or
  review the launch account list.

## 9. Control-account mappings

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide mandatory control accounts and how companies may
  remap them.
- **Options:**
  1. Hard-code one global set.
  2. Require company configuration for AR, AP, VAT, bank/cash, revenue, and
     expense defaults.
  3. Allow arbitrary account selection for every posting.
- **Recommendation:** Require company-scoped mappings for Accounts
  Receivable, Accounts Payable, output VAT, input VAT, bank/cash, default
  revenue, default expense, and equity/capital. Validate mappings by account
  type and preserve an effective-dated configuration snapshot on each posting.
- **Accounting/data consequences:** A mapping change affects future postings
  only. Existing journals retain their original account IDs. Control-account
  changes require capability, reason, and audit.
- **Migration consequences:** Existing categories and account references need
  a reviewed mapping. Unmapped historical categories remain legacy or require
  explicit correction.
- **Dependencies:** Chart template, VAT, invoice/bill posting, bank posting,
  permissions, BL-06, BL-07.
- **Explicit product decision:** Approve the mandatory mapping list and whether
  each company may use multiple control accounts.

## 10. Account configuration and versioning

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide whether chart/default configuration is mutable,
  versioned, or effective-dated.
- **Options:**
  1. Mutable current configuration.
  2. Immutable version snapshots with a current pointer.
  3. Effective-dated configuration versions.
- **Recommendation:** Use immutable, effective-dated configuration versions.
  A new version applies to future postings; each posting stores the version
  used. Editing a configuration creates a new version and audit event.
- **Accounting/data consequences:** Reproducibility improves: a journal can
  explain which account/tax mapping was used. Retroactive remapping is
  prohibited without a correction workflow.
- **Migration consequences:** Existing records need a legacy configuration
  marker where no reliable version exists.
- **Dependencies:** Chart, control mappings, VAT rules, periods, audit,
  BL-06/BL-07.
- **Explicit product decision:** Approve effective-dated versioning and decide
  whether users may edit account codes after an account is referenced.

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

## 12. Overpayments

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide where customer and supplier overpayments reside
  when they exceed open invoice/bill balances.
- **Options:**
  1. Cap at the source balance and discard the remainder.
  2. Keep the remainder as unapplied customer credit or supplier prepayment.
  3. Force immediate refund.
- **Recommendation:** Never discard or silently cap money. Keep a distinct
  unapplied remainder: a customer overpayment is normally a customer credit/
  receipt-on-account liability until allocated or refunded; a supplier
  overpayment is normally a supplier prepayment asset until allocated or
  recovered. Exact legal/accounting treatment needs confirmation.
- **Accounting/data consequences:** Payment total, allocation total, open item
  balance, unapplied amount, and refund must be separate. Statements must show
  the remainder.
- **Migration consequences:** Current capped `amount_paid` behaviour cannot
  safely reconstruct prior overpayments; only evidenced differences may be
  backfilled.
- **Dependencies:** Payment/allocation model, chart control accounts,
  statements, refunds, BL-09, BL-16.
- **Explicit product decision:** Approve the customer-credit and
  supplier-prepayment treatment, including whether both are launch scope.

## 13. Unapplied cash

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide whether unapplied cash is a first-class open item
  and which account treatment applies.
- **Options:**
  1. Hold only as a payment metadata flag.
  2. Hold in a dedicated unapplied-cash account/subledger.
  3. Immediately allocate to a selected invoice/bill.
- **Recommendation:** Make unapplied cash a first-class payment state and
  subledger item. Do not force allocation. Use configured customer-credit or
  supplier-prepayment accounts, with explicit allocation and reversal actions.
- **Accounting/data consequences:** Cash remains posted once, while allocation
  status and open-item statements remain independently traceable.
- **Migration consequences:** Existing bank matches with no source allocation
  need classification; they must not be retroactively attached to arbitrary
  documents.
- **Dependencies:** Overpayments, payment allocations, refunds, chart
  mappings, reconciliation, BL-09, BL-14.
- **Explicit product decision:** Approve first-class unapplied cash and the
  launch account treatment.

## 14. Refunds

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide customer and supplier refund workflows and
  whether a refund requires a credit note or approved return source.
- **Options:**
  1. Allow standalone refunds.
  2. Require a linked credit note/return source.
  3. Support standalone refunds only to an unapplied balance.
- **Recommendation:** Require an explicit linked source for customer refunds
  that reverse sales/VAT, normally a sales credit note; require an explicit
  linked source for supplier refunds, normally a supplier credit note. A
  payment reversal/refund must be a separate controlled payment posting, never
  an edit to the original journal.
- **Accounting/data consequences:** Refunds need direction, bank/cash account,
  date, amount, source, allocation reversal, tax treatment, and audit.
- **Migration consequences:** Existing bank rows linked to credit notes need
  source validation before any canonical refund posting.
- **Dependencies:** Credit notes, payments, VAT, bank/reconciliation,
  reversal service, BL-10, BL-14.
- **Explicit product decision:** Approve whether standalone refund workflows
  are allowed and which refund cases are launch scope.

## 15. Payment-on-account

- **Status:** REQUIRES USER DECISION
- **Decision needed:** Decide whether users can record payment before an
  invoice/bill exists or before allocation is known.
- **Options:**
  1. Reject payments without an open source.
  2. Support customer payment-on-account.
  3. Support both customer and supplier payment-on-account.
- **Recommendation:** Support payment-on-account as an explicit unapplied
  payment state, not as a fake invoice or bill. Permit later allocation,
  refund, and reversal with full audit. Supplier prepayments should be
  separately labelled from customer credit.
- **Accounting/data consequences:** Payment posting and allocation remain
  distinct. Statements must expose on-account balances and avoid overstating
  settled invoices.
- **Migration consequences:** Existing unmatched bank transactions should not
  be automatically converted into payment-on-account without user-approved
  classification.
- **Dependencies:** Unapplied cash, overpayments, refunds, statements,
  bank/reconciliation, BL-09, BL-16.
- **Explicit product decision:** Approve customer, supplier, or both
  payment-on-account workflows for launch.

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

Before implementation, Lee must explicitly approve or amend:

1. Restoration/creation of Product Principles.
2. The launch PRD/Product Scope.
3. Adoption or amendment of the accounting-core architecture review.
4. The capability matrix.
5. Financial-year start and change policy.
6. Monthly period generation and close/reopen rules.
7. Year-end reporting-only versus explicit closing journal.
8. Default UK chart template and account list.
9. Mandatory control-account mappings.
10. Effective-dated account/configuration versioning.
11. Source revision/hash and VAT freshness semantics.
12. Customer overpayment and supplier prepayment treatment.
13. First-class unapplied cash.
14. Refund requirements and launch scope.
15. Customer/supplier payment-on-account scope.
16. Audit retention periods.
17. Deletion/anonymisation policy.
18. Export formats, scope, and permissions.
19. Backup RPO/RTO and restore-test requirements.
20. Application scoping versus RLS policy.
21. Historical migration cohort/cutover policy.

No item above should be marked approved merely because this pack recommends an
option.

## 24. Recommended implementation order after approval

This order is conditional and must not start until the required decisions are
explicitly approved:

1. Restore or author Product Principles, PRD/Product Scope, and the approved
   Technical Architecture.
2. Record Lee's decisions in the Living Product Decisions Register.
3. Finalise the capability matrix and active-membership enforcement.
4. Finalise money, source freshness, status, period, and correction policies.
5. Define the versioned chart template, control mappings, and configuration
   model.
6. Design additive schema constraints and compatibility adapters.
7. Implement and test BL-07 period, chart, default, and configuration
   primitives.
8. Implement and test BL-06 normalized journals, server-side balance checks,
   source posting, and idempotency.
9. Protect generic CRUD and remove direct posted-journal mutation bypasses.
10. Integrate invoice/bill posting with authoritative source and VAT checks.
11. Add payments, allocations, unapplied cash, overpayments, refunds, and
    payment reversals.
12. Connect bank classification, transfers, and reconciliation without
    double-posting.
13. Expose server-side journal-authoritative reporting and compare legacy
    outputs.
14. Validate historical migration candidates and run a controlled cutover.
15. Complete restore tests, security checks, end-to-end tests, and release
    review before any publication.

## 25. Remaining blockers to BL-06 / BL-07

Implementation remains **BLOCKED** by:

- absence of approved Product Principles, PRD/Product Scope, and Technical
  Architecture documents;
- unresolved capability matrix and elevated accounting permissions;
- unresolved financial-year, period, and year-end policy;
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

**DECISION PACK:** READY FOR LEE'S REVIEW  
**BL-06 / BL-07 IMPLEMENTATION:** BLOCKED  
**APPLICATION CODE CHANGED:** NO  
**DATABASE OR MIGRATIONS CHANGED:** NO  
**UI, DEPENDENCIES, WORKFLOWS, OR DEPLOYMENT CHANGED:** NO  