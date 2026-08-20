# Ledgerly Phase A–J Product Roadmap

This roadmap is preserved from the product gap analysis. It is a planning document only. It does not authorize implementation.

## Roadmap principles

- Phase order follows accounting and security dependencies, not screen order.
- No phase is complete because its pages or endpoints exist.
- Every phase must meet the Ledgerly Definition of Done.
- Every financial phase must produce correct journal, VAT, reporting, and audit consequences.
- AI and automation remain approval-first.
- Unresolved product decisions must be settled before the affected phase starts.

## Phase A — Critical foundation

### Scope

- Active-membership enforcement.
- Company and tenant isolation.
- Role and capability matrix.
- Entity-specific input schemas and field allowlists.
- Server-authoritative invoice/bill monetary calculations.
- Protected financial write boundary.
- VAT approval source-freshness validation.
- Typed business errors.
- Rate limiting/timeouts for sensitive endpoints.

### Dependencies

None. This phase is a prerequisite for all later accounting work.

### Relative complexity

**Large**

### Must be complete before Phase B

- Inactive members cannot access company data or management routes.
- Roles are allowlisted and capability-checked server-side.
- Generic CRUD cannot mutate protected accounting fields.
- Client-supplied totals cannot determine financial outcomes.
- Approval checks permissions and current source state atomically.

### Required testing

- Authenticated HTTP role matrix.
- Inactive-member access tests.
- Cross-company isolation tests.
- Crafted financial-total tests.
- Unknown-field and invalid-type tests.
- Concurrent approval/freshness tests.
- Rate-limit and timeout tests.

## Phase B — Core accounting functionality

### Scope

- Chart of accounts.
- Accounting configuration.
- Double-entry journal model.
- Journal lines and source links.
- Posting service.
- Reversals and corrections.
- Financial periods and fiscal years.
- Open/closed period controls.
- Audit linkage.

### Dependencies

Phase A.

### Relative complexity

**Large**

### Must be complete before Phase C

- Every posted source transaction creates a balanced journal.
- Posted records are immutable.
- Reversals and corrections are explicit.
- Closed periods reject normal posting.
- Account and tax configuration is validated.

### Required testing

- Debit/credit balancing.
- Idempotent posting.
- Duplicate-post prevention.
- Reversal and correction tests.
- Period close/reopen tests.
- Account/tax validation tests.
- Source-to-journal audit tests.

## Phase C — Sales, purchases, payments, and balances

### Scope

- Sales invoice lifecycle.
- Purchase bill lifecycle.
- Credit-note lifecycle.
- Payment recording.
- Payment allocation.
- Partial payments.
- Split payments.
- Overpayments/unapplied cash.
- Customer and supplier balances.
- AR/AP ledgers.
- Customer and supplier statements.

### Dependencies

Phases A–B.

### Relative complexity

**Large**

### Must be complete before Phase D

- Create → validate → approve → post → pay → report works for invoices and bills.
- Credit notes correctly reverse and allocate.
- Balances derive from allocations and journals.
- Statements reconcile to source transactions.

### Required testing

- Full invoice browser workflow.
- Full bill browser workflow.
- Partial/split/overpayment tests.
- Credit-note allocation tests.
- Customer/supplier statement tests.
- Journal and VAT consequences.
- Permission and closed-period tests.

## Phase D — Banking and reconciliation

### Scope

- Bank account management.
- CSV import and correction.
- Duplicate handling.
- Manual transaction management.
- Categorisation-to-ledger.
- Transfer pairing.
- Recurring transaction templates.
- Reconciliation matching.
- Partial and multi-document matching.
- Bank/cash effects.

### Dependencies

Phases A–C.

### Relative complexity

**Large**

### Must be complete before Phase E

- Every approved bank outcome becomes a correct journal or linked payment.
- Transfers do not affect income, expenses, or VAT.
- Imports are idempotent and auditable.
- Reconciliation approvals revalidate source freshness.
- Unmatched transactions have a clear review path.

### Required testing

- CSV mapping and malformed-file tests.
- Duplicate/import replay tests.
- Match confidence and explanation tests.
- Multi-document and partial-payment tests.
- Transfer invariants.
- Categorisation journal tests.
- Browser approval flows.

## Phase E — VAT

### Scope

- VAT profile and scheme configuration.
- Tax rules.
- VAT calculations.
- VAT evidence.
- VAT adjustments.
- Return boxes.
- Review workflow.
- Approval and locking.
- Evidence drill-down.
- Export or filing workflow.

### Dependencies

Phases A–D, plus VAT scheme decisions.

### Relative complexity

**Medium to Large**

### Must be complete before Phase F

- VAT uses authoritative posted evidence.
- Approval cannot lock stale data.
- Supported schemes are explicit.
- Every return box drills down to evidence.
- Export/filing status is auditable.

### Required testing

- VAT calculation fixtures.
- Scheme-specific tests for every supported scheme.
- Source mutation/freshness tests.
- Adjustment tests.
- Locking and revision tests.
- Evidence and export parity.
- Permission/concurrency tests.

## Phase F — Reporting

### Scope

- Profit & Loss.
- Balance Sheet.
- Trial Balance.
- General Ledger.
- AR/AP reports.
- Aged debtors.
- Aged creditors.
- Customer statements.
- Supplier statements.
- VAT reports.
- Cash and cashflow reports.
- Management reports.

### Dependencies

Phases B–E and financial periods.

### Relative complexity

**Large**

### Must be complete before Phase G

- Reports use posted journals and controlled period boundaries.
- Report totals reconcile to source data.
- Every major number drills down to the source.
- Exports match on-screen reports.

### Required testing

- Golden accounting datasets.
- Statement reconciliation.
- Period boundary tests.
- Comparative-period tests.
- Drill-down integrity.
- Export parity.
- Permission tests.

## Phase G — AI Accountant

### Scope

- Source-linked AI explanations.
- Task queue.
- Reviews.
- Recommendations.
- Confidence and evidence.
- Ask search/navigation.
- Ask business questions.
- Draft actions.
- Explicit approval actions.
- Approval freshness.

### Dependencies

Phases A–F.

### Relative complexity

**Large**

### Must be complete before Phase H

- AI can read all approved data within company and role scope.
- AI explains evidence and uncertainty.
- AI never silently posts, submits VAT, deletes history, or sends communications.
- All financial AI actions use explicit approval and audit.

### Required testing

- Intent and answer fixtures.
- No-invention tests.
- Tenant isolation.
- Permission tests.
- Prompt/context boundary tests.
- Approval/freshness tests.
- Browser task/review flows.

## Phase H — Automation

### Scope

- Import-triggered analysis.
- Scheduled recurring drafts.
- Collections reminders.
- Notifications.
- Automation rules.
- Retry and dead-letter handling.
- Idempotency.
- Observability.
- Approved communication execution.

### Dependencies

Phases A–G and provider decisions.

### Relative complexity

**Large**

### Must be complete before Phase I

- Automations are opt-in and explainable.
- Financial and external effects require approved policy.
- Runs are idempotent.
- Failures are visible and recoverable.
- Every run is audited.

### Required testing

- Scheduler tests.
- Idempotency/replay tests.
- Retry/dead-letter tests.
- Approval tests.
- Notification preference tests.
- External-provider failure tests.

## Phase I — UX and product polish

### Scope

- Workspace consistency.
- Universal search.
- Reliable filters.
- Mobile/tablet workflows.
- Accessibility.
- Error, loading, empty, and success states.
- Performance.
- Frontend regression suite.
- Clickability and interaction audit.

### Dependencies

Stable workflows from Phases A–H.

### Relative complexity

**Medium**

### Must be complete before Phase J

- Critical workflows work on supported viewports.
- No dead controls or placeholder actions remain.
- Every major Workspace follows the shared shell.
- Ask integration exists across major modules.
- Browser tests protect the release paths.

### Required testing

- Playwright desktop/tablet/mobile journeys.
- Keyboard and focus checks.
- Accessibility checks.
- Error-state and recovery checks.
- Performance checks.
- Clickability audit.

## Phase J — Production readiness

### Scope

- Production deployment configuration.
- Environment and secret verification.
- Origin/CORS configuration.
- Production schema promotion.
- Backups and recovery.
- Monitoring and alerting.
- Rate limits and timeouts.
- Security scanning.
- Financial-invariant regression suite.
- Final release audit.

### Dependencies

Phases A–I.

### Relative complexity

**Medium**

### Release gate

Publishing is permitted only when:

- No critical or high security/financial findings remain.
- Production configuration is verified.
- Production schema is reviewed.
- Backups/recovery are tested.
- End-to-end browser workflows pass.
- Accounting, VAT, reconciliation, and permission invariants pass.
- No placeholder functionality remains in launch scope.