# Ledgerly Master Backlog

This is the complete backlog derived from the read-only product gap analysis. It is a planning record, not implementation authorization.

## Priority definitions

- **P0:** Required before further accounting feature expansion or any release consideration.
- **P1:** Required for the defined core UK small-business accounting product.
- **P2:** Important product completeness work after core authority is stable.
- **P3:** Scope-gated, optional, or future work; requires a product decision.

## Governance authority

This backlog is a level-5 planning document. It does not override higher-level
product or technical authority.

When documents conflict, use this order:

1. Ledgerly Manifesto
2. Product Principles
3. PRD / Product Scope
4. Technical Architecture
5. Feature Specifications / This Master Backlog

The active repository contains the Product Principles, PRD/Product Scope, and
Technical Architecture established by Decision 1, alongside the Manifesto, Core
Maxims, Design System, Definition of Done, Product Development Workflow, and
Workspace Framework. The new governance documents are living records: a
recommendation or unresolved entry in them is not implementation permission.

The [Living Product Decisions Register](ledgerly-product-decisions.md) records
current product direction without replacing higher-level authority. An agent may
recommend backlog work or identify conflicts, but must not select roadmap scope
autonomously or silently change a recorded decision. An item requires an
approved implementation task before code changes begin.

## Backlog

| ID | Module | Feature | Current status | What needs to be built | Priority | Dependencies | Complexity | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| BL-01 | Identity/security | Active membership enforcement | Unsafe partial | Require `is_active` membership for every company and company-management action; immediate access revocation on deactivation. | P0 | None | Medium | Deactivated members cannot read, write, invite, manage, export, or approve anything in the company. |
| BL-02 | Permissions | Role/capability contract | Unsafe partial | Define approved roles, capability matrix, role validation, permission middleware, and UI capability state. | P0 | BL-01 | Medium | Every action has an explicit required capability; arbitrary role strings are rejected; UI and API agree. |
| BL-03 | API integrity | Per-entity write contracts | Unsafe partial | Replace generic mass assignment for protected entities with typed schemas, allowlists, range validation, and domain services. | P0 | BL-01/02 | Large | Unknown/unsafe fields, invalid types, cross-company IDs, and protected fields are rejected consistently. |
| BL-04 | Financial authority | Authoritative invoice/bill calculations | Unsafe partial | Calculate line totals, VAT, paid/balance amounts, and statuses server-side; remove client authority over money. | P0 | BL-03 | Large | Crafted request totals cannot alter accounting outcomes; all monetary invariants hold. |
| BL-05 | VAT | Fresh source validation on approval | Unsafe partial | Recalculate or verify source versions atomically before VAT approval/locking. | P0 | BL-04 | Medium | A source change between calculation and approval prevents approval until recalculated. |
| BL-06 | Accounting core | Canonical posting engine | Missing / blocked | Create source-linked, balanced, immutable journal entries and controlled reversals/corrections, conforming to the [DEC-04-approved accounting-core foundation](ledgerly-dec-04-accounting-core-adoption-review.md), approved DEC-05 capability model, approved DEC-06 financial-year policy, approved DEC-07 accounting-period policy, approved DEC-08 reporting-only year-end policy, approved DEC-09 chart policy, approved DEC-10 control-account policy, approved DEC-11 configuration-versioning policy, approved DEC-12 payment/allocation/settlement policy, approved DEC-13 overpayment/party-balance policy, approved DEC-14 unapplied-cash workflow policy, approved DEC-15 refund policy, approved DEC-16 payment-on-account launch scope, approved DEC-17 audit retention policy, approved DEC-18 data-disposal policy, approved DEC-19 export policy, and approved DEC-20 backup/recovery policy. No implementation may begin until the applicable remaining decisions are approved and an implementation task is explicitly authorised. | P0 | BL-03/04, DEC-04, DEC-05, DEC-06, DEC-07, DEC-08, DEC-09, DEC-10, DEC-11, DEC-12, DEC-13, DEC-14, DEC-15, DEC-16, DEC-17, DEC-18, DEC-19, DEC-20, applicable DEC-21–DEC-22 decisions, approved implementation task | Large | Every posted operational source creates balanced debits/credits with an audit link and idempotency protection. |
| BL-07 | Accounting core | Chart, defaults, periods, and accounting configuration | Partial/missing / blocked | Add controlled account types/defaults, fiscal years, periods, close/reopen policy, document numbering, and posting controls, conforming to the [DEC-04-approved accounting-core foundation](ledgerly-dec-04-accounting-core-adoption-review.md), approved DEC-05 capability model, approved DEC-06 financial-year policy, approved DEC-07 accounting-period policy, approved DEC-08 reporting-only year-end policy, approved DEC-09 chart policy, approved DEC-10 control-account policy, approved DEC-11 configuration-versioning policy, approved DEC-12 payment/allocation/settlement policy, approved DEC-13 overpayment/party-balance policy, approved DEC-14 unapplied-cash workflow policy, approved DEC-15 refund policy, approved DEC-16 payment-on-account launch scope, approved DEC-17 audit retention policy, approved DEC-18 data-disposal policy, approved DEC-19 export policy, and approved DEC-20 backup/recovery policy. No implementation may begin until the applicable remaining decisions are approved and an implementation task is explicitly authorised. | P0 | BL-06, DEC-04, DEC-05, DEC-06, DEC-07, DEC-08, DEC-09, DEC-10, DEC-11, DEC-12, DEC-13, DEC-14, DEC-15, DEC-16, DEC-17, DEC-18, DEC-19, DEC-20, applicable DEC-21–DEC-22 decisions, approved implementation task | Large | Closed periods reject normal posting; account/tax defaults are validated and reports use period boundaries. |
| BL-08 | Sales/purchases | Invoice and bill lifecycle | Partial | Complete draft → validate → approve → post → issue → reverse/correct lifecycle linked to journals and VAT. | P0 | BL-04/06/07 | Large | Invoices and bills create correct AR/AP/revenue/cost/VAT entries and cannot be mutated after posting. |
| BL-09 | Payments | Payment allocation and statements | Partial | Add manual payment records, allocations, unapplied cash, partial/split/overpayment handling, customer/supplier statements. | P0 | BL-06/08 | Large | Payment allocation creates cash/AR/AP effects; statements reconcile to journals and source records. |
| BL-10 | Credit notes | Posting and allocation lifecycle | Partial | Add approved credit-note posting, invoice/bill allocation, VAT reversal, refund/credit handling, audit. | P1 | BL-06/08/09 | Large | Credit notes accurately reduce target balances, VAT evidence, and journals without editing posted history. |
| BL-11 | Party data | Contacts, items, quotes, and purchase-order scope | Missing/scope-gated | Approve scope, then build unified contacts, item catalogue, quote-to-invoice, and PO-to-bill flows only where chosen. | P2/P3 | Product decision, BL-08 | Large | Each approved module has defined lifecycle, source snapshots, accounting effects, and Workspace support. |
| BL-12 | Banking | Import resilience and bank-account controls | Partial | Harden CSV mapping, correction, duplicate recovery, audit, balances, and decide live-feed launch scope. | P1 | BL-03/07 | Medium | Imports are idempotent, recoverable, traceable, and correctly assigned to bank accounts. |
| BL-13 | Banking | Categorisation, transfers, and recurrence | Partial | Create category-to-ledger posting, transfer pairing, recurring templates, schedules, approval controls, and audit. | P0 | BL-06/07/12 | Large | Every approved outcome produces correct journals; transfers are excluded from income/expense/VAT; recurring runs are idempotent. |
| BL-14 | Reconciliation | Complete accounting effects and UX | Phase-scoped complete | Link approved matches to authoritative payment allocations/journals, expand rationale, and cover browser flows. | P0 | BL-06/09/13 | Large | Single/batch approvals update source, allocation, journal, cash, VAT, and audit atomically with freshness checks. |
| BL-15 | VAT | Evidence, schemes, and filing/export | Partial | Complete evidence drill-down/export, adjustments, approved scheme support, and filing/export lifecycle. | P1 | BL-05/06/07/08/13 | Large | VAT boxes reconcile to posted evidence; every supported scheme is tested; filing/export is auditable. |
| BL-16 | AR/AP/collections | AR, AP, aging, and controlled collections | Partial | Build formal receivable/payable ledgers, aging, customer/supplier statements, approved reminder sending and follow-up. | P1 | BL-08/09/10/18 | Large | Aging and statements reconcile to allocations/journals; no reminder is sent without authorised approval and delivery audit. |
| BL-17 | Reporting | Financial statements and management reporting | Missing/partial | Build P&L, Balance Sheet, Trial Balance, General Ledger drill-down, cash reports, management reports, export parity. | P0 | BL-06/07/09/13/15 | Large | All report totals derive from posted journals, use controlled periods, drill down to source, and match exports. |
| BL-18 | Documents/email | Durable document and communication lifecycle | Placeholder/partial | Choose storage, OCR, email, and inbound-mail providers; implement upload, review, generation, delivery, retry, audit. | P1 | Product decisions, BL-02/08 | Large | Documents are durable and company-scoped; every external send is approved, delivered/failed visibly, and audited. |
| BL-19 | AI Accountant | Source-linked explanations and action completion | Partial | Expand explanation evidence, task lifecycle, safe handoffs, contextual actions, and all approval boundaries. | P1 | BL-06–17 | Large | Every recommendation identifies source evidence, confidence, uncertainty, permitted action, approval, and audit. |
| BL-20 | Ask/search | Universal search and contextual Ask | Partial | Add fuzzy/grouped search, saved filters, navigation, record opening, context-aware answers, and safe draft actions. | P1 | Stable entities/workspaces, BL-19 | Large | Ask/search can find, open, explain, and safely initiate approved actions for every core module. |
| BL-21 | Automation | Schedules, notifications, and operational reliability | Partial/placeholder | Add trigger model, scheduling, idempotency, retries, dead letters, notifications, and automation observability. | P2 | BL-13/16/18/19 | Large | Automation is opt-in, role-aware, idempotent, recoverable, auditable, and approval-bound for financial/external effects. |
| BL-22 | Workspaces/UX | Workspaces, errors, loading, empty states, and mobile | Partial | Complete major Workspaces, role-aware controls, business-language errors, responsive layouts, accessibility. | P1 | Stable core workflows | Medium | Every major object follows the Workspace/DoD standard across desktop, tablet, and mobile. |
| BL-23 | Quality | Frontend/API regression coverage | Missing/partial | Add end-to-end UI, role, financial-invariant, responsive, error-state, and export parity suites. | P0 | Incrementally from BL-01 onward | Large | Release suite catches permission, posting, VAT, reconciliation, form, mobile, and error regressions. |
| BL-24 | Production controls | Deployment, operations, and defence-in-depth | Missing | Verify production configuration, schema promotion, backups/recovery, monitoring, logs, limits, and RLS decision. | P0 before publish | BL-01–23 | Medium | Production review has no critical/high findings and recovery/observability have been verified. |
| BL-25 | Scope governance | Product decision register and launch definition | Partial/Open | Maintain the [Living Product Decisions Register](ledgerly-product-decisions.md), then resolve the decisions needed for the approved launch scope before affected build phases start. | P0 | Stakeholder decision | Medium | The register records each decision with status, impact, dependencies, revisit point, and change authority; launch scope, future scope, provider choices, tax/currency model, and AI boundaries are explicitly approved where required. |
| BL-26 | Product governance | Feature completion governance | Partial | Apply the full Manifesto authority hierarchy, Workspace, Ask, Design System, and Definition of Done gates to every backlog delivery. | P1 | BL-25 | Medium | No feature is marked complete without higher-authority review, end-to-end workflow, accounting effects, tests, responsive UX, and Ask review. |

## Backlog-to-feature-matrix traceability

Every matrix feature is covered below. `A*` denotes an existing phase-scoped capability that still has a completion backlog where it depends on authoritative accounting effects.

| Matrix features | Backlog coverage |
|---|---|
| 1–3: authentication, companies, permissions | BL-01, BL-02, BL-25, BL-26 |
| 4: dashboard | BL-17, BL-20, BL-22, BL-26 |
| 5–7: customers, suppliers, contacts | BL-09, BL-11, BL-16, BL-22 |
| 8–13: invoices, credits, quotes, bills, POs, items | BL-04, BL-08, BL-10, BL-11 |
| 14–20: banking, import, transactions, categorisation, reconciliation, transfers, recurrence | BL-12, BL-13, BL-14 |
| 21–22: chart and accounting configuration | BL-06, BL-07 |
| 23–27: VAT configuration, calculations, returns, locks, evidence | BL-05, BL-07, BL-15 |
| 28–33: collections, payments, balances, AR, AP | BL-09, BL-16, BL-18 |
| 34–36: journals, adjustments, periods | BL-06, BL-07 |
| 37–46: accounting/management reports, statements, aging, cash reporting | BL-16, BL-17 |
| 47–50: search, filters, exports, document generation | BL-18, BL-20, BL-22 |
| 51–59: AI Accountant, task queue, explanations, approvals, AI/bank/reconciliation/recurring automation | BL-13, BL-14, BL-19, BL-21 |
| 60–65: notifications, tasks, audit, activity, company/user settings | BL-02, BL-18, BL-21, BL-22, BL-24 |
| 66–70: import/export, errors, empty/loading states, mobile | BL-12, BL-17, BL-20, BL-22, BL-23 |

## Scope-decision items

DEC-02 approves the initial UK/GBP accounting-core scope. DEC-03 approves
Standard VAT on invoice basis, controlled corrections, and VAT
preparation/export without direct HMRC submission. Neither decision approves a
backlog item or the decisions below. The following must remain decisions rather
than assumed backlog implementation:

1. Ledgerly versus Ledgerpoint product name (see the Living Product Decisions Register).
2. Additional market, country/tax-regime, and currency support beyond the
   approved initial UK/GBP direction.
3. Quotes/estimates.
4. Purchase orders.
5. Products/services/items.
6. Separate Contacts model.
7. Additional VAT schemes, specialist adjustments, and direct MTD/HMRC filing
   beyond the approved DEC-03 scope.
8. Open Banking provider and launch requirement.
9. Email delivery and inbound-capture provider.
10. Document storage and OCR provider.
11. Payment-provider scope.
12. Payroll, inventory, fixed assets, expenses, budgets, and forecasting scope.
13. Accounting-period/close/reopen policy.
14. Role/capability matrix.
15. AI and automation execution boundaries.
16. Notification channels, preferences, retry, and escalation policy.
17. Audit/document retention and deletion/export policy.
18. Production monitoring, backup, recovery, and RLS policy.

## Completion check

- Backlog items: **26**
- Feature-matrix areas represented: **70 of 70**
- Critical release blockers represented: **all identified blockers**
- Scope-gated/optional features represented: **all identified decision areas**

No backlog item in this document should be implemented until the product scope and next task are approved.