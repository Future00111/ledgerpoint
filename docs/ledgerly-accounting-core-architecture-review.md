# Ledgerpoint BL-06 / BL-07 Accounting Core Architecture Review

**Scope:** Architecture and design review only  
**Backlog items:** BL-06 Canonical Posting Engine; BL-07 Chart, Defaults, Periods and Accounting Configuration  
**Review date:** 2026-08-21  
**Architecture status:** READY FOR REVIEW  
**Implementation status:** BLOCKED pending explicit approval and completion of the [pre-implementation decision pack](ledgerly-accounting-core-decision-pack.md)
**Recommended implementation:** BL-06 + BL-07  

> This document is a proposal. It does not authorise code, schema changes,
> migrations, UI work, dependency changes, publishing, or deployment.

## 1. Governing documents and constraints

The Ledgerly Manifesto remains the highest authority. The review was compared
with the active Core Maxims, Design System, Definition of Done, Product
Development Workflow, Workspace Framework, Product Gap Analysis, Feature
Matrix, Master Backlog, Living Product Decisions Register, and the current
accounting-related implementation.

The Product Principles, PRD/Product Scope, and Technical Architecture were
established as living governance documents by Decision 1. Their unresolved
decisions remain explicitly open. This review remains a proposed
accounting-core design, not a replacement for or approval of the Technical
Architecture authority.

The [pre-implementation decision pack](ledgerly-accounting-core-decision-pack.md)
must resolve the review's open product, accounting, permissions, retention,
operations, and migration decisions before BL-06 or BL-07 implementation can
be approved.

The review follows these non-negotiable boundaries:

- Accounting authority remains deterministic and server-side.
- The journal/posting layer, not invoice, bill, bank-feed, or browser state,
  becomes the reporting source of truth.
- Posted accounting history is append-only and corrected through explicit
  reversals, credit notes, or replacement postings.
- VAT continues to use the existing deterministic VAT service; no second VAT
  engine is introduced.
- AI may recommend or prepare drafts, but the accounting engine validates and
  determines the final accounting effect.
- Every accounting entity and mutation is company-scoped and permission-checked.
- No design recommendation below is permission to implement.

## 2. Current accounting architecture

### Current data model

The current schema provides useful source-document and workflow foundations:

- `sales_invoices` and `purchase_bills` store company, party, dates, JSON line
  items, monetary totals, payment totals, balance, and status.
- Sales and supplier credit notes store original-document references, totals,
  status, and applied state.
- `bank_accounts` and `bank_transactions` store bank evidence, one-sided
  money-in/money-out values, status, categorisation, VAT metadata, and
  denormalised reconciliation links.
- `chart_of_accounts` stores a company, code, name, account type/subtype,
  description, and active flag.
- `journal_entries` stores a company, date, description, source fields, JSON
  `lines`, total debit, total credit, and status.
- VAT returns, tax rules, exceptions, adjustments, snapshots, and audits are
  already represented as separate deterministic VAT workflow records.

Evidence: `lib/db/src/schema/index.ts:136-324` and
`lib/db/src/schema/index.ts:326-455`.

### Current services and behaviour

- Invoice and bill posting currently changes the document status to `posted`
  but does not create a canonical journal.
- Payment recording mutates invoice/bill `amount_paid`, `balance_due`, and
  status in integer pence under a row lock. There are no payment or allocation
  entities.
- Reconciliation approval is an authenticated, atomic workflow that locks the
  bank and source rows, validates the company and outstanding balance, updates
  document payment fields, and records AI decision audit data. It does not
  create accounting postings.
- Bank imports create one-sided review evidence and deliberately do not post.
- Transfer handling creates a destination bank evidence row and marks the
  source matched; it does not create a double-entry transfer posting.
- Matching is deterministic and separate from final user approval.
- VAT calculation is deterministic, company-scoped, integer-pence based, and
  treats matched invoices/bills as authoritative over bank-feed VAT metadata.

Evidence: `artifacts/api-server/src/routes/functions.ts:233-299`,
`artifacts/api-server/src/routes/functions.ts:383-558`,
`artifacts/api-server/src/routes/functions.ts:598-717`, and
`artifacts/api-server/src/services/ai-accountant/approval.ts`.

### Current reporting behaviour

The frontend fetches journals, accounts, invoices, bills, and bank rows and
calculates reports locally. The report code expects flat journal rows with
`account_id`, `debit`, and `credit`, while the active schema exposes a journal
header with JSON `lines`. Sales, purchases, aged debtors, aged creditors, and
bank reports read source records directly.

Evidence: `artifacts/ledgerly/src/pages/Reports.jsx`,
`artifacts/ledgerly/src/lib/reportCalculations.js:18-193`, and
`lib/db/src/schema/index.ts:305-324`.

### Current access boundary

Authentication and company membership checks exist on the API routes, and
several protected workflows reject unsafe generic writes. However, generic
CRUD still exposes `JournalEntry` and `ChartOfAccount`, posted-journal
immutability is not enforced, and the role model does not yet expose distinct
posting, reversal, period-close, or chart-edit capabilities.

## 3. Current problems and gaps

The current model is not a safe accounting authority because it lacks:

1. Normalized journal headers and journal lines.
2. A server-side invariant that total debits equal total credits.
3. A posting source and unique idempotency boundary.
4. Accounting periods and closed-period enforcement.
5. Immutable posted records and linked reversals.
6. Payment and payment-allocation entities.
7. A controlled relationship between bank evidence and accounting postings.
8. A canonical VAT-to-journal line contract.
9. A server-side reporting contract based on posted journals.
10. Capability-level authorization for accounting operations.
11. Database-level uniqueness and foreign-key protections sufficient for the
    proposed model.
12. A safe historical migration path from JSON journals and denormalised
    balances.

Specific unsafe or incompatible paths include:

- Generic create, update, and delete operations for journal entries.
- Browser-side journal balancing in the General Ledger.
- Client-controlled invoice/bill totals and JSON line-item values.
- Status-only invoice/bill posting without accounting effects.
- Credit-note application without a linked reversal or reduction journal.
- Reconciliation that changes source balances without creating or linking a
  payment posting.
- Reports that use source documents and bank evidence as financial authority.
- Current generated-journal functions being explicit stubs.

## 4. Proposed canonical accounting architecture

Recommend a **transactional, normalized, append-only posting core**:

```text
Source transaction
  -> source validation and server-side calculation
  -> accounting policy / VAT result
  -> posting command
  -> posting source + idempotency check
  -> open-period and account validation
  -> journal header + journal lines
  -> audit event and source linkage
  -> rebuildable balance/read projections
  -> reporting queries
```

The posting service owns the accounting decision. Source modules provide
validated business facts. AI and the browser may propose inputs, but neither
may create journal lines directly.

### Recommended design choices

- Use normalized `journal_entries` and `journal_lines`, with one header and at
  least two lines per posted transaction.
- Represent money as integer minor units plus an ISO currency code. GBP is the
  current launch direction; the model remains currency-aware.
- Store a typed posting source and an idempotency key on every posting.
- Validate all source records, account ownership, period state, VAT result,
  signs, and balance inside one database transaction.
- Make posted headers and lines immutable. Corrections append linked journals.
- Keep payment, allocation, and bank transaction as separate concepts.
- Treat account balances as derived and rebuildable from posted journal lines.
- Use additive migration and compatibility adapters before retiring current
  fields or generic contracts.

### Accounting authority pipeline

The canonical flow is:

```text
Source transaction
  -> validation
  -> accounting posting command
  -> journal header
  -> journal lines
  -> derived balances
  -> reports
```

Invoices, bills, payment records, bank-feed rows, and frontend state remain
important source or evidence records. They are not the authority for financial
reports after the accounting core is adopted.

## 5. Double-entry model

Every posted journal must contain:

- company ID;
- journal ID and immutable posting status;
- posting date and accounting period ID;
- currency and, if later required, exchange-rate metadata;
- description/memo and reference;
- typed source type and source ID;
- posting batch ID where applicable;
- idempotency key;
- creation and posting timestamps;
- actor/system identity and audit linkage;
- two or more journal lines;
- debit and credit values in minor units;
- account IDs on every line.

Server-side invariants:

```text
sum(journal_lines.debit_minor) = sum(journal_lines.credit_minor)
debit_minor >= 0
credit_minor >= 0
debit_minor and credit_minor are not both positive on one line
total debit > 0 for a posted journal
all lines belong to the same company and currency
all accounts are active and valid for the posting
```

The database should enforce simple non-negative and foreign-key constraints.
The posting service must enforce the complete cross-row balance invariant in
the same transaction before the header becomes posted.

The browser may display a balance preview, but the server recomputes all final
amounts and never trusts browser-supplied totals or journal lines.

## 6. Journal model

### Journal header

Proposed fields:

| Field | Purpose |
|---|---|
| `id` | Immutable journal identity |
| `company_id` | Tenant boundary |
| `journal_number` | Human-readable sequence, if required |
| `status` | `DRAFT`, `POSTED`, or `REVERSED` as applicable |
| `posting_date` | Date controlling period validation |
| `period_id` | Explicit accounting period |
| `currency_code` | Currency of the journal |
| `description` / `reference` | Explanation and source reference |
| `source_type` / `source_id` | Typed originating transaction |
| `posting_batch_id` | Optional batch grouping |
| `idempotency_key` | Retry and duplicate boundary |
| `total_debit_minor` / `total_credit_minor` | Server-computed totals |
| `created_by` / `posted_by` | Actor and approval evidence |
| `created_at` / `posted_at` | Lifecycle timestamps |
| `reversal_of_id` / `reversed_by_id` | Correction relationship |

Only a draft may be edited, and only through a controlled draft service. A
posted header cannot be updated or deleted through generic CRUD.

### Journal lines

Proposed fields:

| Field | Purpose |
|---|---|
| `id` | Line identity |
| `journal_entry_id` | Header relationship |
| `company_id` | Defence-in-depth tenant boundary |
| `line_number` | Stable ordering |
| `account_id` | Canonical chart account |
| `debit_minor` / `credit_minor` | Non-negative minor-unit amounts |
| `currency_code` | Journal currency |
| `tax_code` / `tax_rate` | VAT evidence where applicable |
| `counterparty_type` / `counterparty_id` | Optional AR/AP traceability |
| `source_line_ref` | Optional source line linkage |
| `description` | Line explanation |

Lines are append-only after posting. A posted journal is never physically
deleted, including journals later reversed.

## 7. Chart of accounts model

The existing `chart_of_accounts` table is a starting point, not yet a complete
canonical chart.

### Proposed account model

Each account should support:

- company ownership;
- unique company-scoped account code;
- name and description;
- stable account type: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`,
  `COST_OF_SALES`, `EXPENSE`, or `TAX`;
- reporting subtype/classification;
- optional parent account;
- active/inactive state;
- system/default protection flag;
- control-account role where applicable;
- currency policy where applicable;
- created/updated actor and timestamps.

Recommended uniqueness:

```text
unique(company_id, code)
```

Account codes may be changed only through a controlled configuration action.
An account referenced by posted journals must not be deleted; it may be
deactivated after replacement mappings are established.

### Default UK chart direction

Use a versioned default UK small-business chart as an onboarding template, not
as a globally hard-coded assumption. A company may customise names, codes, and
optional accounts within supported constraints.

The initial mapping should cover at least:

- bank/cash;
- Accounts Receivable;
- Accounts Payable;
- VAT output and input/control accounts;
- revenue;
- cost of sales;
- operating expenses;
- equity/capital;
- retained earnings.

Inventory, payroll, fixed assets, and corporation-tax accounts must not imply
that those future product areas are currently supported.

### Accounting configuration

Keep accounting configuration separate from general company/VAT settings. It
should eventually hold:

- base currency;
- default posting policy;
- AR/AP control accounts;
- bank/cash defaults;
- output/input VAT accounts;
- default revenue and expense mappings;
- rounding policy;
- document numbering policy;
- fiscal-year start;
- period-close policy.

Configuration changes require server-side capability checks and an audit event.

## 8. Control accounts and posting templates

The following are the initial accounting templates. Exact tax treatment remains
subject to the approved Product Scope, VAT scheme, and accounting review.

### Sales invoice

```text
DR Accounts Receivable          gross total
CR Revenue                      net amount, by mapped revenue account
CR Output VAT                   VAT amount, by applicable tax treatment
```

The invoice is a source document. The posting service recomputes the net/VAT/
gross relationship and consumes the authoritative deterministic VAT result.

### Supplier bill

```text
DR Expense or Asset              net amount, by mapped account
DR Input VAT                     recoverable VAT amount
CR Accounts Payable              gross total
```

Whether an amount is expense, asset, or non-recoverable tax must be explicit in
the validated source treatment; a generic category string must not decide it
silently.

### Customer payment

```text
DR Bank or Cash
CR Accounts Receivable
```

The AR credit is represented through allocation records when the payment is
applied to one or more invoices.

### Supplier payment

```text
DR Accounts Payable
CR Bank or Cash
```

### Approved bank categorisation

For a money-out transaction classified as an expense:

```text
DR Expense or Asset
CR Bank or Cash
```

For a money-in transaction classified as income or another supported receipt:

```text
DR Bank or Cash
CR Revenue, liability, equity, or other approved account
```

An imported bank row alone does not create either posting.

### Internal transfer

```text
DR Destination Bank or Cash
CR Source Bank or Cash
```

Transfers do not contribute to income, expense, or VAT. The two bank-evidence
rows may be paired, but the accounting effect is one balanced transfer posting.

## 9. Accounting periods

### Period model

Propose separate fiscal-year and accounting-period entities:

- `fiscal_year`: company, start/end dates, status, and close metadata.
- `accounting_period`: company, fiscal year, start/end dates, sequence,
  status, close/reopen actor and timestamps.

An initial state may be `OPEN`. Normal posting is allowed only when:

- the posting date is valid;
- exactly one company period contains the date;
- the period is open;
- the account and source are valid.

### Close and reopen

Closing a period is a privileged, audited operation that verifies required
checks and marks the period closed. A normal posting into a closed period is
rejected.

Reopening is a separate privileged operation. It returns the period to open
only after recording who reopened it, why, when, and what checks were bypassed
or re-run. It must not silently rewrite prior journals.

### Year-end behaviour

Year-end must not delete, rewrite, or automatically rebalance accounting
history. Initially, the system should carry retained earnings/reporting
behaviour through controlled reporting rules. Any explicit year-end closing
journal should be a separately approved workflow with its own source, period,
idempotency, and audit record.

## 10. Posting lifecycle

### Generic source lifecycle

```text
DRAFT
  -> VALIDATED
  -> APPROVED
  -> POSTED
  -> REVERSED or CORRECTED
```

Not every source needs every state, but the accounting state must be
authoritative and not represented by unrelated booleans.

### Invoice lifecycle

```text
DRAFT
  -> VALIDATE
  -> APPROVE
  -> POST
  -> ISSUE
  -> PAY
  -> ALLOCATE
  -> RECONCILE
```

Only `POST` creates the invoice journal. `ISSUE` may trigger a separately
controlled communication. Payment and allocation create or link settlement
postings. Reconciliation links bank evidence and must not duplicate a payment
posting.

Cancellation before posting is a source-state change with no accounting effect.
After posting, cancellation requires a supported reversal or credit-note
workflow.

### Bill lifecycle

```text
DRAFT
  -> VALIDATE
  -> APPROVE
  -> POST
  -> PAY
  -> ALLOCATE
  -> RECONCILE
```

Only `POST` creates the bill journal. The same immutability and correction rules
apply after posting.

## 11. Reversals and corrections

Corrections append a new journal linked to the original:

```text
Original journal:  DR Expense 100 / CR Bank 100
Reversal journal:  DR Bank 100   / CR Expense 100
Corrected journal: DR ...        / CR ...
```

Proposed correction types:

- full reversal;
- replacement/corrected posting;
- sales or supplier credit note;
- payment reversal;
- duplicate correction;
- period correction through a controlled adjustment or permitted period
  workflow.

Every correction must:

- reference the original journal;
- preserve the original journal and lines;
- be balanced and idempotent;
- validate the target period;
- record actor, reason, source, and approval;
- prevent a second reversal of the same original unless explicitly supported.

Voiding a pre-posting draft is different from reversing a posted journal.

## 12. Payments and allocations

The accounting model must keep these distinct:

```text
Payment
  != Payment allocation
  != Bank transaction
```

### Payment

A payment records a commercial settlement event: company, direction,
counterparty, payment date, amount, currency, bank/cash account, status,
source, and posting relationship.

### Allocation

An allocation applies part or all of a payment to an invoice, bill, credit,
or another supported open item. It records payment ID, target type/ID, amount,
allocation date, and reversal relationship.

One payment may allocate to multiple invoices/bills. One invoice/bill may
receive multiple payments. An unapplied remainder remains explicitly
unapplied. Overpayments and underpayments are represented rather than silently
capped or discarded.

### Accounting effects

The payment journal is created once. Allocation changes the AR/AP subledger
relationship and must have a controlled accounting effect where required,
without posting the same cash movement twice.

Payment reversal appends a linked reversal journal and reverses or reopens
allocations through an audited workflow.

## 13. Bank integration boundary

Bank feeds are evidence, not accounting authority:

```text
Bank feed/import
  -> bank evidence row
  -> deterministic analysis/matching
  -> explicit user approval
  -> payment, transfer, or categorisation posting
```

Import, refresh, retry, or analysis never posts automatically.

### Reconciliation rules

- If a bank transaction matches an existing payment, reconciliation links the
  evidence to that payment and must not create a second journal.
- If no payment exists and the user approves a customer/supplier settlement,
  the accounting service creates the payment and its journal atomically with
  the bank link.
- A bank categorisation creates a posting only after explicit authorised
  approval.
- A transfer creates one balanced inter-bank journal and pairs its evidence.
- Bank-feed VAT metadata remains advisory and never drives VAT return boxes.

## 14. Invoice, bill, and credit-note integration

Source documents remain operational records with their own lifecycle and
display fields. The canonical posting service consumes a validated immutable
posting snapshot:

- source document ID and company;
- source version or revision;
- document date and posting date;
- authoritative server-calculated lines;
- tax/VAT result and evidence;
- mapped account IDs;
- counterparty/control-account relationship.

After posting, edits to document amounts, lines, tax, dates controlling
accounting, or party identity must be rejected or require a controlled
correction/replacement workflow. Display-only fields may be editable only if
they cannot change accounting meaning and the audit policy permits it.

Credit notes post reductions to the original commercial and tax effect through
new journal lines. Applying a credit note must never mutate historical journal
lines directly.

## 15. VAT integration

The existing deterministic VAT service is retained as the VAT calculation and
review authority for its supported scope:

- standard VAT scheme;
- invoice-basis VAT;
- integer-pence calculations;
- source-document evidence;
- bank VAT metadata advisory only;
- explicit exceptions and approval controls.

The posting engine consumes a validated VAT result from that service. It does
not calculate a second competing VAT answer.

### Journal VAT representation

VAT-bearing journal lines should carry enough typed metadata to trace:

```text
journal
  -> journal line
  -> tax code/rate/treatment
  -> source document and source line
  -> VAT calculation/evidence
```

Sales output VAT and purchase input VAT control accounts are posted using the
authoritative result. VAT return reporting must be able to reconcile boxes to
posted tax evidence and source documents.

During transition, the existing VAT overview still reads supported source
documents. The cutover design must define how only posted, valid source
transactions enter the authoritative return calculation; it must not silently
change historical return results.

## 16. Reporting contract

Reports consume a server-side accounting read contract based on posted
journals and lines:

- trial balance by company, period, account, and currency;
- general ledger with journal/source drill-down;
- P&L from revenue, cost-of-sales, and expense lines;
- balance sheet from asset, liability, and equity lines;
- AR/AP subledgers from control-account postings plus allocations;
- VAT from tax-coded posted lines and source evidence;
- bank/cash from bank-control account postings;
- aged debtors/creditors from open-item and allocation data.

Balance projections or materialized summaries may improve performance, but they
must be rebuildable from immutable journal lines and must not become an
independent financial truth.

The current local report calculation layer should eventually become an adapter
or read client for this contract. It must not continue to combine incompatible
flat journal rows and source-document totals as the authoritative financial
result.

## 17. Audit model

Every posting must be traceable:

```text
Report
  -> Journal
  -> Journal lines
  -> Source transaction
  -> Validation and approval
  -> Actor/system action
  -> Timestamp
  -> Reversal/correction relationship
```

Audit events should include:

- company and actor;
- action and target;
- source and journal IDs;
- previous/new lifecycle state;
- approval evidence;
- idempotency key;
- reason or note;
- request/correlation identifier;
- timestamps;
- relevant calculation/version references.

Posted journals and lines are not deleted. Audit records are append-only under
the retention policy to be approved.

## 18. Permissions

Define capabilities rather than relying on the current broad role behaviour:

| Capability | Minimum control |
|---|---|
| View chart, periods, journals | Authenticated company member |
| Create/edit a draft | Accounting write capability |
| Approve source transaction | Approval capability |
| Post accounting transaction | Posting capability |
| Reverse/correct posted journal | Reversal capability plus reason |
| Close period | Period-close capability |
| Reopen period | Elevated period-reopen capability plus reason |
| Edit chart of accounts | Chart-management capability |
| Change accounting defaults | Accounting-configuration capability |
| View recommendations | Read access |
| Persist AI/accounting action | Corresponding write capability |

The exact Owner/Admin/Accountant/Manager/Read-only mapping remains an open
product decision. Server-side checks are mandatory; UI hiding is not a
security boundary. Deactivated memberships must fail every accounting action.

## 19. Company and tenant isolation

Every proposed accounting entity has a `company_id`, and all reads and writes
must derive the company from authenticated membership and the target record.

The following may never cross company boundaries:

- accounts;
- accounting configuration;
- fiscal years and periods;
- posting sources;
- journals and lines;
- payments and allocations;
- bank/cash references;
- balances and reports;
- audit records.

Foreign keys should be company-safe where practical, and service queries must
include explicit company predicates. Database RLS remains a defence-in-depth
decision for architecture review; it must not be introduced without a tested
migration and operational plan.

## 20. Money and rounding model

Recommend integer minor units for all new canonical accounting values:

- `amount_minor` as a signed or non-negative integer according to the field;
- `currency_code` on journals, payments, and monetary source snapshots;
- no floating-point arithmetic in posting or balancing;
- explicit currency precision policy;
- deterministic VAT rounding;
- deterministic line versus document rounding;
- explicit handling of zero-value lines;
- explicit residual/balancing policy.

For GBP, minor units are pence. A journal line should contain either a debit or
credit amount, never a floating-point value or an unexplained balancing
residual. Existing numeric database fields require an adapter during migration;
they should not be silently reinterpreted.

## 21. Date model

Keep these dates distinct:

- document date;
- transaction date;
- payment date;
- posting date;
- VAT period;
- accounting period;
- bank value date;
- created/approved/posted timestamps.

The **posting date** controls accounting-period validation. Source-specific
rules determine its default, but the final date is validated server-side and
must be visible in the approval/audit record. VAT-period inclusion remains
subject to the supported VAT scheme and authoritative VAT service.

## 22. Status model

Use explicit lifecycle states and transition rules:

### Source documents

`DRAFT`, `VALIDATED`, `APPROVED`, `POSTED`, `ISSUED`, `PARTIALLY_PAID`,
`PAID`, `CANCELLED`, `REVERSED`.

### Journals

`DRAFT`, `POSTED`, `REVERSED`.

### Periods

`OPEN`, `CLOSED`.

Reopening is an audited event that changes a period back to `OPEN`; it is not a
silent boolean edit.

### Payments

`DRAFT`, `POSTED`, `PARTIALLY_ALLOCATED`, `ALLOCATED`, `REVERSED`,
`UNAPPLIED`.

The final transition matrix must reject impossible combinations such as a
deleted posted journal, a paid invoice with allocations above its total, or a
posted source without a valid journal.

## 23. Proposed database model

The following is a logical model, not a migration specification.

| Entity | Purpose and key rules |
|---|---|
| `accounting_config` | One company-scoped configuration; versioned/audited; controls defaults and policy. |
| `chart_of_accounts` | Company-scoped accounts; unique code; no deletion after posting reference; supports system/default flags and reporting classification. |
| `fiscal_years` | Company fiscal-year boundaries and close metadata; no overlapping years. |
| `accounting_periods` | Company period boundaries and open/closed state; no overlapping periods; indexed by company/date. |
| `posting_sources` | Typed company-scoped source/version and posting kind; unique idempotency boundary. |
| `posting_batches` | Optional atomic grouping for one user/import/work item; status and audit. |
| `journal_entries` | Immutable posted header with period, source, currency, totals, actor, timestamps, and reversal links. |
| `journal_lines` | Normalized immutable debit/credit lines with account, tax, source-line, and counterparty references. |
| `payments` | Settlement event and one payment posting relationship. |
| `payment_allocations` | Many-to-many application between payments and open source items; amount and reversal rules. |
| `journal_reversals` | Explicit original/reversal relationship, reason, actor, and audit. |
| `account_balance_projections` | Optional rebuildable performance projection; never the authority over journal lines. |
| `accounting_audit_events` | Append-only accounting action history linked to company and target. |

Important constraints and indexes:

- unique company/source/posting-kind idempotency key;
- unique company/account code;
- unique company fiscal-year and period boundaries as appropriate;
- foreign keys from lines to journals and accounts;
- foreign keys from journals to periods and posting sources;
- indexes on company, posting date, period, account, source, and status;
- check constraints for non-negative amounts and one-sided debit/credit lines;
- company predicates or composite references for all cross-entity links.

Existing invoice, bill, bank, VAT, and AI tables remain source/workflow tables
during migration. Their compatibility fields must not be treated as the
canonical ledger once the new core is active.

## 24. Service architecture

Prefer focused server-side services, reusing existing deterministic services:

- `AccountingPostingService` — validates and posts a complete transaction.
- `AccountingValidationService` — company, account, period, source, amount,
  status, and invariant checks.
- `JournalService` — reads journals and enforces posted immutability.
- `PeriodService` — creates, opens, closes, reopens, and audits periods.
- `ChartOfAccountsService` — account lifecycle, defaults, mappings, and
  protected system accounts.
- `AccountingConfigService` — company accounting configuration.
- `PaymentService` — payment state and cash/bank posting.
- `PaymentAllocationService` — split, partial, unapplied, overpayment, and
  reversal handling.
- `ReversalService` — linked correction postings.
- `VATPostingAdapter` — consumes existing deterministic VAT results; does not
  recalculate them.
- `AccountingReportQueryService` — server-side posted-journal reporting
  contract.
- `AccountingAuditService` — append-only audit events.

Existing matching, reconciliation approval, and VAT services should call the
canonical boundary rather than reimplementing accounting effects. The browser
must never directly create journal lines.

## 25. Proposed API contracts

The exact routes remain subject to the approved Technical Architecture. The
logical contract should include:

### Mutations

- `POST /api/accounting/postings`
  - authenticated actor, company derived from source;
  - source type/ID, source version, posting date, idempotency key;
  - server-calculated posting command, not arbitrary journal lines;
  - returns existing result for the same idempotency key.
- `POST /api/accounting/journals/:id/reverse`
  - reason, target posting date, idempotency key;
  - requires reversal capability.
- `POST /api/accounting/periods/:id/close`
- `POST /api/accounting/periods/:id/reopen`
  - both require the relevant capability, reason, and audit.
- `POST /api/accounting/payments`
- `POST /api/accounting/payments/:id/allocations`
- `POST /api/accounting/payments/:id/reverse`

### Reads

- `GET /api/accounting/journals`
- `GET /api/accounting/journals/:id`
- `GET /api/accounting/ledger`
- `GET /api/accounting/accounts/:id/balance`
- `GET /api/accounting/trial-balance`
- `GET /api/accounting/periods`
- `GET /api/accounting/config`

Every mutation must authenticate, authorise, derive company scope, validate
inputs and source freshness, enforce period/account/VAT rules, enforce
idempotency, execute atomically, and create audit information. Generic CRUD
must not expose posted accounting mutations.

## 26. Migration strategy

Do not migrate data as part of this review.

Recommend an additive migration:

1. Create the canonical model alongside current tables.
2. Classify current JSON journals as legacy records until each is validated.
3. Map invoices, bills, credit notes, payments, and bank evidence as sources.
4. Preserve current Base44-shaped entity APIs through adapters.
5. Backfill only records with sufficient evidence and balanced, validated
   accounting treatment.
6. Keep incomplete or ambiguous history visibly legacy; do not invent entries.
7. Introduce dual-read comparisons for reports and balances.
8. Enable canonical posting for a controlled company or source type.
9. Reconcile differences and approve cutover.
10. Retire generic journal writes and legacy authority only after verification.

Existing `amount_paid`, `balance_due`, bank link fields, and VAT snapshots may
remain compatibility projections during transition. Their values must not
silently override canonical postings.

## 27. Compatibility with existing functionality

| Existing area | Future compatibility approach |
|---|---|
| Invoices/bills | Keep source APIs; post through the canonical service; derive payment/balance projections from allocations. |
| Credit notes | Keep source records; create linked reduction/reversal journals. |
| Payments | Introduce payment/allocation records; preserve current display fields as projections during transition. |
| Bank imports | Keep review evidence; create postings only through approved classification/reconciliation. |
| Reconciliation | Preserve deterministic matcher and freshness guards; call payment/posting services on approval. |
| VAT | Keep deterministic `vat.ts`; add a VAT-to-journal adapter and source traceability. |
| Collections | Read authoritative open-item balances and use explicit communication approval. |
| AI Accountant | Explain/recommend/prepare; never decide or write journal lines. |
| Reports | Replace local source mixing with the server-side posted-journal contract. |
| Generic CRUD | Add protected entity policy and remove posted-journal mutation bypasses before cutover. |

## 28. Test strategy

Future implementation must include unit, integration, database, API, and
browser coverage for at least:

1. Balanced journal accepted.
2. Unbalanced journal rejected server-side.
3. Negative or dual-sided line rejected.
4. Duplicate source posting returns/rejects idempotently.
5. API, worker, import, webhook, browser-refresh, and AI retries do not
   duplicate journals.
6. Closed-period posting rejected.
7. Reopen requires elevated permission, reason, and audit.
8. Posted journal cannot be edited.
9. Posted journal cannot be deleted.
10. Reversal creates a linked balanced journal.
11. Second reversal is rejected or explicitly handled.
12. Invoice posting creates AR, revenue, and VAT effects.
13. Bill posting creates expense/asset, VAT, and AP effects.
14. Customer payment creates cash/AR effects.
15. Supplier payment creates AP/cash effects.
16. Partial payment and partial allocation work.
17. Multi-invoice allocation works.
18. Multiple payments to one source work.
19. Overpayment and unapplied cash remain visible.
20. Payment reversal restores open-item state correctly.
21. Transfer creates bank-to-bank accounting without income/expense/VAT.
22. Bank import alone creates no journal.
23. Approved categorisation creates exactly one journal.
24. Reconciliation to an existing payment does not double-post.
25. VAT result is consumed without a second arithmetic engine.
26. VAT lines trace to source evidence.
27. Credit note reduces the correct balances and tax effects.
28. Company isolation holds for every entity and report.
29. Capability checks hold at the API/service boundary.
30. Audit chain includes source, actor, approval, journal, and reversal.
31. GBP rounding and VAT rounding are deterministic.
32. Period boundaries and date distinctions are enforced.
33. Legacy adapter comparisons identify balance/report differences.
34. Report totals equal posted journal totals and drill down to sources.

## 29. Architectural decisions

### ADR-AC-01 — Normalized append-only journals

- **Decision:** Use normalized journal headers and lines as the canonical
  posted accounting model. Posted records are immutable.
- **Reason:** JSON lines and mutable source totals cannot safely enforce
  double-entry, audit, or reporting consistency.
- **Alternatives considered:** Continue using JSON journals; derive reports from
  invoices/bills; replace the current system wholesale.
- **Trade-offs:** More tables and migration work, but stronger constraints,
  queryability, and auditability.
- **Impact:** BL-06, BL-07, reports, VAT, payments, reconciliation, and all
  future posting features.
- **Reversibility:** The additive migration and adapters are reversible before
  canonical cutover; posted canonical history should not be rewritten.

### ADR-AC-02 — Integer minor units for canonical money

- **Decision:** Store and calculate canonical monetary amounts as integer minor
  units with explicit currency.
- **Reason:** Prevent floating-point drift and make balance/rounding rules
  deterministic.
- **Alternatives considered:** Existing numeric strings; floating-point
  application values; decimal values without a common service policy.
- **Trade-offs:** Conversion/adapters and explicit precision handling are
  required.
- **Impact:** All posting, VAT, payment, allocation, and reporting services.
- **Reversibility:** Low after canonical history exists; decide before schema
  implementation.

### ADR-AC-03 — Source-scoped idempotency

- **Decision:** Every posting has a company-scoped source/posting kind and
  unique idempotency key enforced at the database boundary.
- **Reason:** Retries are normal in APIs, imports, workers, webhooks, and AI
  workflows.
- **Alternatives considered:** In-memory dedupe; caller-only checks; timestamps
  or reference strings.
- **Trade-offs:** Source versions and correction semantics must be explicit.
- **Impact:** Every posting mutation and migration adapter.
- **Reversibility:** High before data is posted; difficult after consumers rely
  on keys.

### ADR-AC-04 — Separate payment, allocation, and bank evidence

- **Decision:** Model payment, payment allocation, and bank transaction as
  distinct entities with explicit relationships.
- **Reason:** They have different lifecycles and conflation causes double
  posting, lost unapplied cash, and incorrect balances.
- **Alternatives considered:** Continue mutating invoice/bill paid totals;
  treat every bank row as a payment.
- **Trade-offs:** More explicit workflows and migration complexity.
- **Impact:** Payments, reconciliation, collections, statements, AR/AP.
- **Reversibility:** High before payment cutover; preserve compatibility
  projections during transition.

### ADR-AC-05 — Existing deterministic VAT service remains authoritative

- **Decision:** The posting layer consumes the existing deterministic VAT
  result and adds a traceable journal adapter.
- **Reason:** Two VAT engines would create conflicting tax authority.
- **Alternatives considered:** Recalculate VAT inside posting; use bank-feed
  VAT metadata; calculate VAT from reports.
- **Trade-offs:** The VAT service and posting service need a versioned contract
  and freshness validation.
- **Impact:** VAT returns, invoice/bill posting, credit notes, reconciliation,
  and reporting.
- **Reversibility:** High before VAT journal cutover; never silently change
  historical return results.

### ADR-AC-06 — Additive migration with compatibility adapters

- **Decision:** Introduce the canonical core alongside the current model and
  migrate by validated source type/company.
- **Reason:** Existing clients and historical data cannot safely be replaced
  in one unverified operation.
- **Alternatives considered:** Destructive schema replacement; automatic
  historical reconstruction; permanent dual authority.
- **Trade-offs:** Temporary duplication and comparison work.
- **Impact:** API contracts, reports, schema rollout, operations, and support.
- **Reversibility:** Highest before company/source cutover; define rollback
  checkpoints for each transition.

### ADR-AC-07 — Rebuildable balance projections

- **Decision:** Derive balances from posted journal lines and optionally
  maintain rebuildable projections for performance.
- **Reason:** Reports need speed without creating a second mutable accounting
  truth.
- **Alternatives considered:** Store balances as primary truth; calculate every
  report from operational documents.
- **Trade-offs:** Projection refresh and reconciliation monitoring are needed.
- **Impact:** Trial balance, statements, AR/AP, dashboard, and reports.
- **Reversibility:** High while journal lines remain authoritative.

## 30. Risks

### Critical

- Generic JournalEntry writes remain a bypass until removed or protected.
- Existing invoice/bill totals and statuses may diverge from canonical
  postings unless source validation and projections are carefully controlled.
- Historical JSON journals may not be balanced, complete, or trustworthy.
- Current VAT calculations include active source documents rather than an
  explicitly posted-journal boundary; cutover could alter return results if
  done without comparison.

### High

- Coarse roles could allow posting, reversal, or period operations to the
  wrong users.
- Reports currently have an incompatible journal shape and local calculations.
- Reconciliation currently changes document balances without a canonical
  payment posting.
- Missing foreign keys, uniqueness, and company-safe relationships could
  weaken tenant isolation.
- Period-close and year-end policy is not yet approved.

### Medium

- GBP-only launch decisions may later require multi-currency migration.
- Default chart assumptions may not suit every UK small business.
- Provider and filing decisions can affect source, document, or payment
  integration boundaries.
- Compatibility adapters may temporarily expose two representations and need
  parity monitoring.

## 31. Unresolved questions

These questions must be resolved before the affected implementation task is
approved or must remain explicit dependencies:

1. Where are the approved Product Principles, PRD/Product Scope, and Technical
   Architecture documents?
2. What exact accounting basis, VAT schemes, and launch filing scope are
   supported beyond the current standard invoice-basis service?
3. What is the exact Owner/Admin/Accountant/Manager/Read-only capability matrix?
4. Which user actions require approval separate from posting permission?
5. What is the final fiscal-year start and period calendar policy?
6. Is year-end closing a required launch workflow or a later explicit journal?
7. Which chart accounts and default mappings are mandatory for launch?
8. How are non-recoverable VAT, mixed-rate lines, and unusual treatments
   represented in posting?
9. What is the approved treatment for unapplied cash, overpayments, refunds,
   and payment-on-account?
10. When a bank match finds no payment, should approval create a payment
    automatically within the same controlled workflow?
11. What source version/freshness contract is required for invoice, bill, and
    VAT posting approval?
12. What retention, deletion, export, and legal-hold policy applies to journals
    and audit events?
13. What is the production backup, recovery, monitoring, and RLS position?
14. Which historical periods and records are eligible for validated backfill?
15. What is the exact public product name, given the current Ledgerly/
    Ledgerpoint OPEN decision?

## 32. Recommended implementation order

Do not begin this order without explicit architecture and scope approval plus
completion of the [pre-implementation decision pack](ledgerly-accounting-core-decision-pack.md).

1. Approve or amend this architecture review and restore the missing higher
   authority documents.
2. Approve the accounting capability matrix, source/status transitions, money
   policy, period policy, and launch chart direction.
3. Define canonical schema constraints and compatibility boundaries.
4. Implement and test chart/configuration and period services (BL-07).
5. Implement normalized journal/posting primitives and idempotency (BL-06).
6. Protect generic CRUD and remove direct journal-line mutation paths.
7. Integrate invoice/bill posting with server-side source calculations.
8. Add payment and allocation services, then payment reversals.
9. Add bank classification, transfer, and reconciliation posting boundaries.
10. Add credit-note and VAT journal adapters with freshness checks.
11. Expose server-side reporting queries and compare against legacy reports.
12. Validate historical migration candidates and perform controlled cutover.
13. Retire legacy accounting authority only after parity, audit, and regression
    verification.

## 33. Final architecture decision

**ARCHITECTURE STATUS:** READY FOR REVIEW  
**IMPLEMENTATION STATUS:** BLOCKED — explicit approval and decision pack completion required
**RECOMMENDED IMPLEMENTATION:** BL-06 + BL-07  

This review identifies the recommended canonical accounting foundation and the
current blockers. It does not implement BL-06 or BL-07, modify the database,
change existing accounting logic, alter the UI, install dependencies, or
publish/deploy the application.