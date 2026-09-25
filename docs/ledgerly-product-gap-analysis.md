# Ledgerly Complete Product Gap Analysis

## 1. Executive summary

Ledgerly has a substantial technical foundation but is not a complete accounting product.

| Measure | Assessment |
|---|---:|
| Technical foundation | Approximately 60% |
| Product completeness | Approximately 40% |
| Release readiness | Approximately 20% |
| Phase 5–6 AI/reconciliation scope | Approximately 70% |

The percentage estimates are workflow-weighted judgements, not counts of routes, tables, or components. A page, endpoint, table, or passing test does not make a product workflow complete.

The strongest existing path is:

```text
Authenticated user
→ active company
→ bank transaction analysis
→ deterministic/AI review
→ explicit reconciliation approval
→ updated source balance/status
```

The main product gap is that the workflow frequently stops before:

- authoritative double-entry posting;
- payment allocation and statements;
- period control;
- complete VAT source freshness;
- financial reporting;
- document/email delivery;
- complete collections;
- user-facing Ask actions;
- mobile and frontend regression coverage.

## 2. Product authority

The Ledgerly Manifesto defines the product as a calm, modern, trustworthy accounting operating system for small and medium-sized businesses. It establishes:

- accounting accuracy and auditability first;
- AI as an assistant, never a silent financial decision-maker;
- rules before AI;
- explanations before automation;
- user control at every financial boundary;
- Ask as a universal access layer;
- no exposed technical details;
- no dead ends;
- no feature considered complete until it makes running a business easier.

The Workspace Framework requires every major business object to provide a consistent workspace containing, where relevant:

- summary;
- related records;
- timeline;
- activity;
- documents;
- AI insights;
- tasks;
- automation;
- contextual Ask.

The Definition of Done requires:

- functional controls;
- no placeholder behaviour;
- Ask integration;
- responsive desktop/tablet/mobile support;
- loading, empty, success, and error states;
- accessibility;
- performance;
- no technical errors or internal identifiers;
- automated test coverage.

## 3. Status definitions

- **A — Fully implemented:** end-to-end for the limited verified scope.
- **A* — Fully implemented within a phase contract:** complete for the explicit Phase 5–6 contract but not necessarily for the broader product.
- **B — Partially implemented:** meaningful workflow exists but stops before the intended product outcome.
- **C — UI exists, backend/workflow incomplete:** visible capability overstates actual completion.
- **D — Backend exists, UI/workflow incomplete:** service or schema exists without a complete user journey.
- **E — Placeholder/mock/demo:** intentionally stubbed, coming soon, or disconnected legacy functionality.
- **F — Missing/deferred:** absent from the active product or awaiting a product decision.

## 4. Module completion

| Module | Completion | Finding |
|---|---:|---|
| Authentication/onboarding | 60% | Clerk sign-in/sign-out and protected routes work; onboarding is partial. |
| Company management | 60% | Company CRUD and selection exist; inactive-member access is unsafe. |
| Users and permissions | 35% | Coarse roles exist; capability enforcement is incomplete. |
| Dashboard | 55% | Widgets exist; authoritative metrics and complete drill-downs are not proven. |
| Customers/suppliers | 55% | Basic CRUD exists; complete workspaces and statements are incomplete. |
| Sales/purchases | 45% | Forms and registers exist; posting, allocation, and downstream journals are incomplete. |
| Banking/reconciliation | 60% | CSV import and reconciliation foundation is strong; accounting effects are incomplete. |
| Accounting core | 30% | Chart and manual journals exist; canonical posting and periods are missing. |
| VAT | 55% | Deterministic standard invoice-basis foundation exists; stale approval is a blocker. |
| AR/AP/collections | 40% | Analysis and balances exist; formal ledgers, aging, statements, and sending are incomplete. |
| Reporting | 25% | Report surface and exports exist; authoritative statements are not complete. |
| Documents/integrations | 25% | Entities and screens exist; storage, extraction, email, and delivery are incomplete. |
| AI Accountant/Ask | 50% | Review/task/recommendation foundation exists; contextual action coverage is incomplete. |
| Automation/notifications | 35% | Analysis and settings exist; safe execution, scheduling, and notification infrastructure is incomplete. |
| UX/mobile/quality | 45% | Desktop navigation works; frontend tests and complete responsive validation are missing. |
| Production readiness | 20% | Dependency health is good; critical authorization and financial-integrity blockers remain. |

## 5. Fully implemented or phase-scoped complete capabilities

The following capabilities are complete enough for their limited current scope:

1. Clerk authentication basics, including sign-in, sign-out, protected routes, and session termination.
2. Basic customer and supplier CRUD.
3. Manual bank-account and transaction records.
4. CSV import baseline: mapping, preview, duplicate detection, and persistence.
5. Phase 5–6 deterministic reconciliation matching, including partial and multi-document scenarios.
6. Phase 5–6 explicit individual and batch approval controls.
7. Transfer and recurring-pattern detection.
8. Standard invoice-basis VAT calculation baseline.
9. VAT return records, audit records, and conditional locking foundation.
10. AI task/review/analysis persistence.
11. Approval-first AI safety boundary.
12. Active dependency vulnerability scans with no active Quill dependency.

These are not equivalent to a release-ready accounting product.

## 6. Partially implemented features

- Company onboarding, member lifecycle, and permissions.
- Dashboard metrics and drill-downs.
- Customer, supplier, and contact workflows.
- Sales invoices and purchase bills.
- Sales and supplier credit notes.
- Payments and payment allocation.
- Customer and supplier balances.
- Bank accounts, transaction management, categorisation, transfers, and recurring transactions.
- Chart of accounts and accounting configuration.
- VAT configuration, calculations, returns, evidence, review, and approval.
- Accounts receivable, accounts payable, and collections.
- General ledger and manual journals.
- Reports, exports, and document generation.
- AI Accountant, Ask, explanations, tasks, and approvals.
- Automation settings, import analysis, and review queues.
- Audit/activity history.
- Search/filtering, error handling, loading states, and responsive UX.

## 7. Missing or scope-gated features

The following are absent or require an explicit product decision:

- Separate unified Contacts module.
- Products/services/items catalogue.
- Quotes/estimates.
- Purchase orders.
- General accounting adjustments.
- Financial periods and years.
- Authoritative P&L.
- Authoritative Balance Sheet.
- Authoritative Trial Balance.
- Formal aged creditors.
- Formal AR/AP ledgers and statements.
- Cashflow/cash-position reporting.
- Full transaction categorisation-to-ledger workflow.
- Transfer-pairing workflow.
- Recurring templates and scheduling.
- Universal fuzzy search and saved filters.
- General task assignment.
- Full notification system.
- Durable document storage and review workflow.
- Email capture, delivery, and delivery audit.
- Open Banking/live feeds.
- Direct payment providers.
- Wider VAT schemes and MTD filing unless approved.
- Frontend end-to-end regression suite.
- Production deployment verification and operational controls.

## 8. Placeholder, mock, or disconnected functionality

1. Open Banking is marked as coming soon.
2. Notifications are marked as coming soon.
3. Legacy OAuth consent is unavailable/disconnected.
4. Legacy Base44 authentication helpers are no-ops; Clerk is authoritative.
5. Generic integration helpers for AI, extraction, email, upload, and image generation are stubs or return empty results.
6. Document upload/storage is not a verified provider-backed workflow.
7. Email delivery is not a verified provider-backed workflow.
8. AI Copilot replacement is marked as coming soon.
9. Legacy password-reset pages redirect to Clerk rather than providing an independent Ledgerly flow.

## 9. Critical release blockers

### Critical

1. Inactive memberships can retain company-management access because company-management routes do not consistently require active membership.
2. Generic SalesInvoice and PurchaseBill CRUD accepts client-controlled subtotal, VAT, total, amount-paid, and balance fields.
3. VAT approval can lock a stale persisted calculation without a final live-source freshness check.

### High

1. Non-`read_only` roles receive broadly equivalent write capability.
2. Generic entity writes lack per-entity schemas and field allowlists.
3. Company update and member-role APIs accept arbitrary fields/role strings.
4. The UI exposes mutation controls to read-only users even where the server later rejects them.
5. Application-only tenant isolation has no database RLS defence-in-depth.
6. No authoritative posting engine connects operational records to journals and reports.

### Medium

1. No rate limiting or endpoint timeout controls were found for important authenticated AI/function routes.
2. Several AI inputs lack schema validation.
3. Raw error messages may expose implementation details.
4. Generic filters support limited operators and silently ignore unsupported operators.
5. Frontend route, permission, responsive, and error-state coverage is absent.
6. Production configuration cannot be verified because there is no deployment.

## 10. Broken or incomplete workflows

1. Company member deactivation → access removal stops because inactive membership checks are incomplete.
2. Member invitation → role capability enforcement stops at coarse role assignment.
3. Invoice creation → posting → payment → journal → report stops before authoritative journals and reports.
4. Bill creation → posting → payment → journal → report stops before AP/cost/cash journals.
5. Credit note creation → allocation → balance/VAT/journal is incomplete.
6. Bank transaction → categorisation → journal → cash report stops at suggestion/review.
7. Transfer detection → account pairing → inter-account journal is incomplete.
8. Recurrence detection → schedule → draft → approval is incomplete.
9. VAT calculation → source change → approval can use stale evidence.
10. Document capture → extraction → reviewed draft → posting depends on incomplete/stubbed integrations.
11. Overdue invoice → reminder draft → send → delivery → follow-up stops before verified sending.
12. Journal posting → period close → P&L/Balance Sheet/Trial Balance cannot complete.
13. Ask question → source explanation → safe action is only partially implemented.
14. Desktop workflow → mobile completion is not comprehensively validated.

## 11. Product conclusion

Ledgerly has a strong foundation for the AI Accountant, reconciliation, VAT, and company-scoped API architecture. The next product milestone is not another isolated screen. It is an authoritative accounting and permission boundary that makes financial values, journals, VAT evidence, reports, and approvals trustworthy.