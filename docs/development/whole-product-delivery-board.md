# Whole-product delivery board

Source baseline: `d4182922ef5e1a7e942a941fe6dbd15d7715a960` on
`dev/w03-draft-invoice-slice`. Reviewed 30 October 2026. This board implements
the owner's instruction to accelerate the whole product, with capture and
credit recovery as one priority. It supplements the active product plan; it
does not replace accounting decisions or frozen qualification evidence.

**Goal:** give small-business owners and sole traders time back through reliable
accounting and fewer manual steps. Track owner minutes per document, correction
rate, unresolved exceptions, recovered credits and time to close the books.
Feature count and AI-generated output alone are not success measures.

## Current parallel wave — capture and recovery

Starting point: `a51625554d68385068d65a2156a3b9f5230f2333`, draft PR 27,
with 245 current-source checks and 36 disposable PostgreSQL tests passing in
run `41096073217`. This is development evidence for that commit only.
Supplier line claims, all four draft editing paths, percentage/fixed discounts,
and linked later-discount credits are already implemented on this branch.

The owner authorised the next parallel implementation wave. This table is the
current assignment; historical baseline descriptions below remain context.

| Workstream | Isolated implementation ownership | Contract and integration gate |
| --- | --- | --- |
| Capture | `codex/intake-persistence`: `B/services/documentIntake/**`, new `B/routes/documentIntake.ts`; narrow lease to extract the existing transactional draft save. `codex/intake-workspace-ui`: `F/features/documentIntake/**`, `F/api/documentIntake.mjs`, `Documents.jsx` and capture-only form/source attachment changes. | Verified original bytes, company-local deduplication, source review and atomic native draft creation. No OCR/email provider is connected. Root owns migration, router registration and real PostgreSQL tests. |
| Payments | `codex/payment-recovery`: `Payments.jsx`, `F/features/paymentRecovery/**`; narrow backend lease for payment-context capability metadata only. | Keep the same reviewed event ID/body/token after an unknown response. Read-only status lookup and exact retry use existing protected payment commands. No new ledger or cash calculation. |
| VAT review | `codex/vat-workings-review`: `VatWorkingsPanel.jsx`, `F/features/vatPreparation/**`, bounded `VATReturns.jsx` integration. | One canonical report snapshot, signed source VAT, document/journal trace and safe CSV. Root exposes already-calculated source VAT; no filing or claim of a complete nine-box return. |
| Corrections and quality | Read-only accounting/security subagent; coordinator owns contracts, shared schema, integration and regression suite. | Define append-only posted corrections and shared as-of projections before exposing financial edits. Review capture permissions, evidence, atomicity and retry semantics independently. |

Capture persistence uses two additive reviewed tables: immutable
`document_intake_sources` with a one-time same-company document link, and
append-only `document_intake_audit`. Uploads are PDF/JPEG/PNG, at most 5 MiB,
and downloaded as authenticated attachments. A server review binds the exact
normalised envelope, file identity, source revision, money and accounting
context. Creation requires explicit source/supplier/tax acknowledgements and
the source revision. The native draft, compatibility projection, source link
and audit commit in one transaction. Exact retries return the same document,
including after subsequent editing/posting, while always rechecking authority.

Execution: implement disjoint modules in parallel; integrate reviewed backend
contracts and coordinator schema first, then the three interfaces. Run all
current-source checks, full build/typecheck and the disposable database suite
on the combined commit. Refresh only the previously authorised isolated
synthetic demonstration after those checks pass, preserving existing records.
No merge, deployment, provider connection or production data changes are part
of this wave. Combined local source validation passed: 306 unit/scenario/client/
rendered-UI tests, no failures or skips, plus full workspace typecheck/build.
The added database cases cover capture deduplication, authority, exact review,
concurrent retry, source evidence, immutable audit and injected transaction
rollback. Exact-commit PostgreSQL/CI results and demo preservation evidence
belong in PR 27; local checks alone do not establish those results.
The reviewed next accounting contract is
[posted document corrections](posted-document-corrections.md).

## What exists and what remains

“Implemented” below means source and relevant tests exist, not that this commit
has passed production qualification. Baseline and combined-branch checks must
be recorded separately by the coordinator.

Paths beginning `F/` mean `artifacts/ledgerly/src/`; `B/` means
`artifacts/api-server/src/`.

| Area | Source-backed state | Next deliverable and acceptance |
| --- | --- | --- |
| Identity, companies, roles | Clerk sign-in and authorised company selection; `F/lib/useCompany.jsx`, `B/middlewares/companyScope.ts`; native services independently check company membership and capabilities. | Company changes immediately clear old financial views and pending reviews; denied and cross-company mutations cause no writes. Preserve finite draft/posting role differences. |
| Customers and suppliers | Existing active routes and entity clients: `F/pages/Customers.jsx`, `Suppliers.jsx`, `B/routes/entities.ts`. | Keep existing contact/history functions; test archived contacts, duplicate-name selection and links to statements without losing company scope. |
| Invoices, bills and credits | Native create/edit/reopen/post flows in `F/pages/AccountingDocumentForm.jsx`, `AccountingDocumentList.jsx`; `B/services/accountingDocuments/{documents,posting}.ts`. Posted originals are immutable. Credits preserve original tax evidence. | Regression journeys across all four kinds; clear draft/posting/partial-settlement states. Later support valid supplier-credit cases beyond the current `offset_outstanding` boundary through a separately reviewed accounting design. |
| Payments and statements | Native receipt/payment, later allocation, unallocation, refund and reversal; `B/services/accountingDocuments/{payments,settlement}.ts`, `F/pages/{Payments,Statements}.jsx`. | Current slice fixes stale payment review state after a company switch and payment event deep links. Next test unknown response/retry recovery, role-based controls and clear operational histories. No duplicate cash movements. |
| Chart, ledger and reports | Protected native chart; canonical GL, trial balance, P&L, balance sheet, VAT workings, balances, ageing and CSV; `B/services/accountingDocuments/{chart,reports}.ts`, `F/pages/AccountingReports.jsx`, `F/components/accounting/ProfitLossReport.jsx`. | Preserve category/account/document drilldowns and exports. Remove misleading legacy write entry points; add a dedicated native manual-journal workflow only behind coordinator-approved posting contracts. |
| Banking and reconciliation | Bank account/transaction/reconciliation UI and legacy matching exist. `B/services/accountingDocuments/settlement.ts::assertLegacySettlementAllowed` deliberately blocks matching native documents. `F/pages/BankAccounts.jsx` says Open Banking is coming soon. | Native bank match review must call protected payment/allocation commands and retain a stable bank transaction identity. Duplicate/replayed imports and partial/split matches must not post twice. Provider selection/connection is a later explicit step. |
| Invoice and credit capture | `F/api/integrations.js` explicitly reports upload, OCR and email unavailable; `F/pages/EmailCapture.jsx` still targets unavailable legacy functions. | Safe intake evidence and validation foundation first; then connected upload/photo/email, field evidence, supplier/tax review, cross-channel deduplication and native draft creation. Never describe a provider stub as a working inbox. |
| Awaiting supplier credits | New workstream in progress; baseline has no native line-level claim workflow. Native source uses line indices and `original_line_refs`, not part-number identifiers. | Select posted bill items/partial quantity; capture return/part/job references separately; expected/received/remaining values with partial matches and audit. A claim never changes bill balance or ledger; old credits cannot satisfy new claims accidentally. |
| VAT preparation | Canonical workings are in `B/services/accountingDocuments/reports.ts`. `F/pages/{VATReturns,VATReturnDetail}.jsx` use AI VAT preparation from `B/services/ai-accountant/vat.ts`, which reads legacy document projections. Approval explicitly does not submit to HMRC. | One canonical period snapshot feeds preparation, adjustments and traceable boxes; resolve exceptions and prove reconciliation before filing work. Filing later requires consent, idempotency, receipt/status evidence and recovery. |
| Self Assessment / MTD Income Tax | Product target in active plan; no dedicated active application route or full filing journey in `F/App.jsx`. | Specify supported taxpayer/income cases and effective-dated calculation fixtures; implement reviewed computations and obligations UI, then separately authorised sandbox provider integration. Do not infer compliance from labels. |
| Corporation Tax, CT600 and accounts | Product target; no dedicated active computation/accounts/filing route. Chart labels such as “Corporation Tax” are not an implemented tax engine. | Define supported entity/accounting periods, adjustments and computation evidence. Select specialist engine/provider versus direct implementation; contract fixtures and accountant review precede filing. |
| Payroll | Product target; no active payroll/payslip/RTI application route. Categorising a bank payment as payroll is not payroll calculation. | Assess maintained engine/provider; define employment inputs and exact PAYE/NI, statutory pay, pension and RTI cases. Implement synthetic calculation and correction tests before any payroll action. |
| AI assistance | Inbox/tasks/reviews/recommendations and server AI services exist; `F/pages/AIAccountant*.jsx`, `B/routes/aiAccountant.ts`, `B/services/ai-accountant/`. Some generic AI integration paths are unavailable. | Evidence-linked suggestions and exception triage across existing workflows. Bound tools and permissions; no AI-written SQL, unsupported tax decisions or independent financial posting. Validate stale/fabricated evidence and prompt injection. |
| Settings, notifications, audit and operations | Navigation preserves existing routes and marks several features soon. Financial audit records exist; a general audit-view route is not exposed. | Use real capability/status evidence for UI claims, build audit review/export, backup/restore drill and current-commit CI. The current slice corrects `NotificationsWidget.jsx` to distinguish a recorded VAT status from verified HMRC acknowledgement. A future success claim requires actual receipt evidence. |

## Four workstreams, one coordinator

The coordinator is the sole architecture/integration owner. Writing agents use
isolated Git worktrees; each task has exact file ownership, contract version,
acceptance criteria and a commit. Read-only subagents review diffs, accounting
invariants, security and test gaps. A worktree does not isolate databases,
ports, credentials or queues: every database test needs its own disposable
target with a positive identity check and no ambient production credentials.

| Stream | Ownership and first tasks | Interfaces and dependencies |
| --- | --- | --- |
| 1. Daily accounting and usability | Task-specific leases on existing invoice/bill/payment/statement/report pages and their non-authoritative UI helpers. Current agent: `Payments.jsx`, new `paymentRequestScope.mjs` and tests. Preserve contact, reporting and existing navigation journeys. | Existing native accounting clients; money stays integer minor-unit strings. New authoritative calculations, journals or settlement changes require coordinator review. |
| 2. Capture, credits and AI | New `B/services/documentIntake/**`, `B/services/creditTracking/domain*`, `F/features/creditRecovery/**`, `F/api/creditRecovery.mjs`; split into isolated agent tasks with disjoint paths. | Intake produces untrusted evidence and reviewed draft candidates, not postings. Credit tracking reads immutable original/credit lines; coordinator owns claim persistence/API and explicit receipt confirmation. External provider work follows the evidence contract. |
| 3. Banking, VAT, tax and payroll | Start with source-backed contracts and acceptance fixtures, then lease new `features/banking`, `features/vatPreparation`, tax/payroll modules. Do not independently rewrite existing `ai-accountant/vat.ts` or matching sinks. | Banking depends on native payment commands; VAT depends on canonical period snapshots. Tax/payroll depend on supported-case specifications and maintained rules/engine decisions. Regulated/external connections remain separate authorised steps. |
| 4. Security, quality and operations | Targeted legacy boundary hardening and test gaps; current hardening agent owns `B/routes/functions.ts` and `F/pages/GeneralLedger.jsx` only by coordinator delegation. Later CI/recovery tasks receive their own paths. | Current-commit tests, role/tenant/audit/atomicity checks and regression review gate every stream. Changes to CI policy, runtime authority or deployment stay with coordinator. |

Coordinator-owned shared files: `lib/db/**`, `lib/api-spec/**`, generated API
packages, `B/services/accounting/**`, authoritative
`B/services/accountingDocuments/**` and `financialDrafts/**`, auth/membership,
shared route registration, `F/App.jsx`, `F/lib/useCompany.jsx`,
`F/components/layout/navConfig.js`, shared UI primitives and manifests/lockfiles.
Other agents propose shared changes before editing. A targeted lease does not
grant general ownership over the rest of a shared module.

The native pnpm workspace uses React, TypeScript, Express, PostgreSQL/Drizzle,
Clerk and generated API packages. The canonical schema includes posting effects,
journal entries/lines/relations and accounting audit events. Reviewed SQL
overlays additionally define document sources/configuration/periods/audit,
payment events/configuration/audit and account presentation/chart audit.
`tools/accounting-flow/schema.mjs` is the isolated provisioning reference;
schema push alone is not proof all overlays and immutable guards were installed.
Do not create another ledger or independently add competing shared models.

## Execution order and integration

1. Pin the development HEAD, inspect branch instructions and run a clean
   baseline. Keep frozen qualification branches and evidence unchanged.
2. In parallel, deliver credit/intake foundation, repair existing payment UI
   state, retire legacy financial bypasses and maintain this whole-product
   board. Coordinator integrates only reviewed changes on its development
   branch and provisions additive schema only in disposable test databases.
3. After contracts and combined tests pass, connect the first real document
   provider and native bank matching in separate slices. Meanwhile the tax
   stream can define supported cases and test fixtures without touching shared
   accounting authority.
4. Bridge VAT preparation to canonical evidence before filing integration.
   Deliver tax/payroll by supported case with accounting review and deterministic
   tests; no broad “compliance complete” claim from a partial implementation.
5. Integrate one commit at a time, inspect complete diffs, run focused checks
   and combined regression journeys. Revert code changes when needed; correct
   posted financial history with immutable supported events, never data resets.
   No automatic merge, deployment, production-data change or external filing.

## Required acceptance gates

- Double entry: every canonical journal balances; source, ledger, statements,
  P&L, balance sheet and VAT reconcile after invoices, bills, credits, partial
  payments, refunds and reversals. Drafts and claims alone cause no posting.
- Exact money/VAT: string/BigInt calculations, bounded decimal input, inclusive
  and exclusive prices, line rounding, fractional quantities, large values,
  20%/5%/0%, exempt versus no-VAT, original credit evidence, partial and cumulative
  limits. Extend cases before supporting another scheme or jurisdiction.
- Atomicity and replay: inject failure between writes; journal, projections
  and audit roll back together. Concurrent retries, credits and allocations
  cannot duplicate effects or over-settle.
- Permissions/audit: unauthenticated, inactive/unknown/read-only roles,
  cross-company IDs and forged payloads fail safely; server-derived actor,
  company, revision and evidence are audited. UI hiding is not enforcement.
- Customer journeys: create/edit/save/reopen/post all four document kinds;
  payment review and company switching; statement/P&L drilldown and export;
  mobile/keyboard forms; honest empty, loading, provider-unavailable and retry
  states. Preserve existing menu destinations.
- Existing commands: `pnpm run typecheck`, `pnpm run build`, frontend `node:test`
  suites, invoice contract tests and `node tools/accounting-flow/test.mjs` on its
  disposable database. Do not run the legacy VAT integration test against an
  ambient `DATABASE_URL`. Record exact commit and outcomes, not old pass counts.

Current slice adds five focused payment-request tests for delayed old success
and failure, company changes, refresh races, immutable reviewed amounts and
request identity, and payment-event links, plus two VAT notification tests.
Whole-branch build, accounting
regression and real-browser acceptance remain coordinator integration gates.
