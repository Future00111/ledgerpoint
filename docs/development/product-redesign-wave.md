# Product redesign and parallel delivery

Owner feedback on 30 October 2026: the previous usability wave still looks old
and delivery needs to be faster. The current verified source and isolated demo
are `41d3eed`; 405 checks passed. This wave changes the screen composition and
information hierarchy. It is not another spacing-only pass.

## Shared direction

Light navigation, warm neutral canvas, white panels, dark readable text and a
restrained green accent. Strong page headings, one obvious primary action,
compact work queues and optional details. Keep Ledgerly branding and existing
dependencies. Use `workspace-hero`, `workspace-panel`, `workspace-panel-header`,
`workspace-section-title`, `workspace-kicker` and `workspace-segmented` from the
coordinator's CSS. Existing PageHeader/EmptyState props remain unchanged.

No invented balances, AI completion claims, connected-provider badges or fake
charts. Money comes from existing server evidence. Draft/post/payment/credit
review and confirmation boundaries remain explicit.

## Active implementation ownership

F means artifacts/ledgerly/src. Each implementation uses an isolated Git worktree.

| Agent | Exclusive ownership | Deliverable and acceptance |
| --- | --- | --- |
| Home/navigation | F/components/layout/**; F/pages/Dashboard.jsx; F/features/workspaceNavigation/**; presentation-only CustomDashboard.jsx | New Today composition, strong upload action, real next-task counts, quieter balances; light grouped navigation, every prior route preserved; actual role gates and accessible mobile sheet retained. Explicit coordinator lease for navConfig.js. |
| Capture/documents | F/features/documentIntake/** except native models/hooks; F/pages/AccountingDocumentForm.jsx, AccountingDocumentList.jsx, Documents.jsx; F/components/accounting/PostedDocument.jsx | Real drag/drop and photo/file choice, compact source queue, clear steps and stronger document editor/list layout; existing envelopes, source identity, original-line index and three review acknowledgements unchanged. No inline untrusted PDF/HTML preview. |
| Credit recovery | F/features/creditRecovery/** presentation only | Dense useful recovery queue with supplier, original bill/item, expected/received/remaining and explicit match review. Search/status filters and partial receipts retained; models, hooks and protected API unchanged. |
| Payments/reports | F/pages/Payments.jsx, Statements.jsx, AccountingReports.jsx, AccountingJournal.jsx, ReportLibrary.jsx; F/features/paymentWorkspace/** and reporting/** presentation; ProfitLossReport.jsx | Coherent payments and report workspace, accessible history/detail disclosure, exact figures and exports, company/date guards and recovery intent retained. No new money calculations. |

Coordinator owns shared CSS/primitives, architecture, schemas, APIs, permissions,
integration, complete regression and demo refresh. Separate read-only review
checks accounting/security regressions. A planning agent owns only
`product-completion-plan.md`: source-backed remaining product tasks, dependencies,
file ownership, tests and release gates. Agents must ask the coordinator before
crossing file boundaries; no independent shared schema/core interface changes.

Coordinator granted capture a narrow additional presentation lease on
`F/features/documentDiscounts/DocumentLineFields.jsx` to make desktop lines
compact while retaining mobile labels, field handlers, credit restrictions and
original line indices. Financial models remain outside this lease.

## Integration order and done criteria

1. Commit shared visual direction and freeze interfaces; start four disjoint streams.
2. Review commits individually; integrate shell first, then capture, recovery and
   reporting. Run focused tests for actual new behaviour, then full source checks,
   workspace build and exact-head disposable PostgreSQL regression.
3. Update draft PR only after code review. Refresh the authorised isolated demo
   only from the tested exact source. Preserve every existing record and check the
   running version. No production writes, merge, deployment or publication.
4. Verify desktop/mobile/keyboard journeys and owner acceptance before marking
   visual work complete. Preview-origin access is currently blocked by automatic
   review; do not bypass via another browser, iframe or indirect capture. Source
   and server-render tests are not visual acceptance. Report this gap honestly.
5. Execute the dependency-ordered completion plan. Parallelise independent modules,
   never competing edits to ledger authority. A task is done when integrated,
   tested on its exact commit and demonstrated, not merely when an agent finishes.

Product success: fewer owner actions and minutes per source document, fewer
corrections, recovered supplier credits and a quicker close. Measure the real
journey; do not invent a time saving or a release date.

## Integrated handoff

The four implementation streams are integrated: light everyday navigation and
Today workspace; drag/drop/photo capture and document editor; compact credit
recovery with expandable match review; redesigned report discovery, P&L,
payments and statements. No backend, schema, API or authoritative financial
model changed in this wave. The full workspace build/typecheck and all 387
current-source checks passed locally with zero failures/skips. Exact-commit
database/CI and demo receipts are recorded on draft PR 27. Browser visual
acceptance is still pending and is not implied by those checks.

The dependency-ordered follow-up is [product-completion-plan.md](product-completion-plan.md):
24 tasks across daily accounting, capture/recovery, tax/payroll and reliability.
