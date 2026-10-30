# Ledgerly product completion plan

Updated 30 October 2026. This is the execution backlog beneath the
[active product plan](../ledgerly-active-product-plan.md), not a replacement
for accounting decisions or a declaration of release readiness. Repository:
LedgerPoint; the application currently uses Ledgerly branding.

The goal is dependable accounting that gives small-business owners and sole
traders their time back. The primary journey is **receive a supplier document →
review exceptions → prepare once → recover any credit → reconcile the result**.
The product also needs complete daily accounting, the planned tax and payroll
coverage, accessible presentation and dependable operations.

## Verified starting point

Baseline `2513ed919b404a3597d84eb152cb73d7775c5f02` passed 462 source
checks and 48 disposable PostgreSQL tests (510 total), full typecheck/build,
an actual isolated backup/restore drill and cleanup in
[run 41122722695](https://github.com/Future00111/ledgerpoint/actions/runs/41122722695).
The preserved isolated demo was confirmed at that source. These results qualify
that baseline only; the following integrated batch requires its own exact-head
CI evidence. They do not establish visual acceptance or production readiness.

| Area | Source-backed implementation | Remaining boundary |
| --- | --- | --- |
| Architecture | React/TypeScript frontend, Express API, PostgreSQL/Drizzle, Clerk; native company-scoped clients and canonical journal posting. | Keep one ledger and one authoritative calculation path. Some older entity/function screens still need explicit capability and behaviour review. |
| Documents and discounts | Four native document kinds; draft create/edit/reopen/post; percentage/fixed draft discounts; later linked-discount credits, including after partial payment. | Bounded posted invoice/bill corrections are implemented in the current batch, gated on the new disposable-only overlay and integrated tests. Posted credit/metadata edits remain deferred. Excess discounts/credits and conditional discount cases need defined workflows. |
| Payments and reports | Receipts/payments, allocations, refunds/reversals, statements; canonical GL, trial balance, P&L, balance sheet, ageing and source/journal drilldowns. | Unknown-response payment recovery is page-memory only. Native bank matching is explicitly blocked from the legacy settlement path. |
| Capture | Native PDF/JPEG/PNG uploads, immutable originals, company-local deduplication, authenticated downloads and atomic reviewed draft conversion. | OCR and email are not connected. Uploads still require manual field entry. File signature checks are not malware scanning or a safe document parser. |
| Awaiting credits | Select original posted bill lines/partial quantities; preserve part, return and job references; expected/received/remaining values and explicit posted-credit confirmation. | One noncancelled tracker per original line. Further return cycles and receipt corrections need audited contracts; matching suggestions must not imply receipt. |
| VAT | Canonical workings for boxes 1, 4, 5, 6 and 7 with source trace and exact exports. | Not a complete nine-box filing implementation. Historical statuses are not verified HMRC receipts. |
| SA/MTD, CT/CT600, payroll | Required by the active product plan. | No complete dedicated calculation/filing routes in the current application. Supported-case rules and independently verified in-house engine fixtures remain prerequisites. |
| Operations | Protected financial audit records, isolated tests, development persistence and a local demo backup command. | Current batch adds audit review/export. Off-site restore/recovery qualification and the public-release support package remain open. |

Evidence: `artifacts/ledgerly/src/App.jsx`; `B/services/accountingDocuments/`;
`B/services/financialDrafts/`; `B/services/documentIntake/README.md`;
`B/services/creditTracking/{domain,service}.ts`; `F/features/paymentRecovery/model.mjs`;
`F/pages/BankAccounts.jsx`; `tools/accounting-flow/persistent-demo.mjs`.
Hereafter **F** = `artifacts/ledgerly/src`, **B** = `artifacts/api-server/src`.

## Team and delivery rules

The accepted interface direction is a professional accounting workspace with
clear everyday actions and optional guidance. Preserve familiar terminology,
searchable tables, detailed money/VAT/payment information, filters, batch
actions and direct expert tools. Explanations should help a new user without
requiring an experienced user to complete a wizard or switch product modes.
Automation should remove repeated entry and surface exceptions; it must not
hide financial evidence or silently exercise posting authority.

The owner superseded the fixed four-stream structure on 30 October 2026. Use
**up to six interchangeable workers plus one coordinator** in the current
seven-slot host, drawing from the shared [18-priority queue](work-backlog.json).
Follow the [queue operating instructions](../../tools/development/work-queue/README.md).
Each claim has temporary file ownership; no agent owns a permanent area.
Read-only review can use any free worker slot. The table below records the
previous batch and is historical assignment evidence, not current staffing. A1/B1, onboarding, membership hardening and D1 are
integrated in the verified baseline. The next batch uses separate
`codex/next-*` worktrees from that baseline.

### Current batch: leased files and acceptance

| Owner | Exclusive implementation files | Interface and acceptance |
| --- | --- | --- |
| A — daily accounting | New `B/services/accountingDocuments/{amendments,amendmentsMath,corrections,documentJournal}*`; narrow leases on documents, posting, payments, settlement, reports and the credit-tracking corrected-original guard. | A2 retains original source/journal, posts balanced differences, validates the complete immutable chain/head, preserves payments and dated reports/VAT. Invoice/bill quantity/price only; any child credit, active claim, unknown history, zero financial change or amount below payment blocks. |
| B — capture and recovery | New `B/services/documentIntake/extraction/worker*` and fixtures; bounded existing README. | B2 partial: executable in-process worker with atomic leases, global capacity, bounded/rehashed inputs and timed authority checks; cancellation/timeout fences results but capacity is released only after transport closes. No durable store, safe OS parser, OCR provider or automatic draft extraction. |
| C — tax and payroll | New `B/services/accountingDocuments/vatCoverage*`, `F/features/vatPreparation/**`. | C1 reconciles existing five-box figures to signed journal movements, including corrections. Boxes 2/3/8/9 are unsupported with null amounts, never invented zeroes. Filing remains blocked. Accounting owner alone wires the additive report field. |
| D — product reliability | New `B/services/auditReview/**`, `B/routes/auditReview.ts`, `F/features/auditReview/**`, `F/api/auditReview.mjs`, `F/pages/AuditHistory.jsx`. | D2 scoped read-only event review, precise stable pagination, verified source/journal links, bounded safe CSV; active unambiguous owner/admin/accountant only. Real correction and payment trace tests. No schema or financial write path. |
| Coordinator | New amendment SQL overlay; correction routes/client/UI; original document and report links; shared app/navigation; test runners and this plan. | Approve shared contracts before dependent work, review all diffs, integrate and run full source/build/real disposable PostgreSQL/restore regression. Existing demo data stays intact. |

The additive amendment/head tables are installed only when explicitly selected
for a **new empty disposable database**. Existing databases are not migrated
by startup or demo refresh. Both tables absent retains existing behaviour and
shows correction setup unavailable; a partial schema or inconsistent history
fails closed. Corrected originals cannot yet receive new credits, later
discount credits or return-credit claims; UI explains this before posting and
removes incompatible creation choices. This is a bounded slice, not completion
of all correction cases.

The earlier restore rehearsal validates an archive inside a fresh disposable
cluster, not cluster-role recreation, off-site backup or production recovery.
External identity lifecycle reconciliation and all release gates remain open.

Each task receives one branch/worktree, exact file lease, dependency, acceptance
examples and a small reviewable commit. Do not have multiple agents rewrite the
same page or shared service. Keep one active implementation task per owner;
submit for independent integration review, then automatically claim the next
safe ready task. Retain the submitted file lease until review accepts it.
Cross-session work resumes from the durable repository checkpoint; hosted
scheduled runs are bounded resumptions, not a continuously running local daemon.

The coordinator owns `lib/db/**`, `lib/api-spec/**`, generated packages,
`B/services/accounting/**`, canonical money/posting/settlement interfaces,
auth/membership, shared router registration, `F/App.jsx`, `F/lib/useCompany.jsx`,
shared navigation/design primitives, manifests and lockfiles. A written narrow
lease can delegate implementation, but schema and core-interface proposals
must be approved by the coordinator before code depends on them. Worktrees do
not isolate databases, ports, queues or credentials.

The coordinator reviews each complete diff, integrates small commits, runs the
combined regression and refreshes the tested demo. Passing an agent's own
checks is **review-ready**, not done. Avoid a new planning document when an
existing contract is sufficient to implement the next slice.

## Execution sequence

1. **M0 — finish the visible redesign now.** Integrate the four current UI
   streams, check all existing routes, build and run accounting regression,
   then update the isolated demo from the exact tested commit. Desktop/mobile
   and owner acceptance remain a separate gate; do not describe source tests
   as screenshots or visual verification.
2. **M1 — unblock independent work in priority order.** Complete the
   A1/B1, onboarding, security and D1 baseline, then integrate the current
   A2/B2-partial/C1/D2 batch above. C2 remains a bounded rule-research task. Freeze only
   shared contracts that block dependent implementation.
3. **M2 — complete the daily automation loop.** Ship reviewed corrections,
   extraction into drafts, credit recovery, durable retry recovery and native
   bank import/matching. Email/provider connections follow their explicit
   connection and privacy decisions. Do not postpone independent adapters,
   fixtures or review UI while waiting for a provider.
4. **M3 — complete supported tax journeys.** Build and validate VAT filing
   recovery, SA/MTD and CT computations against approved supported-case fixtures.
   Rule research and in-house engine implementation can run during M1/M2; live connections
   and filing do not start merely because a page exists.
5. **M4 — complete payroll and cross-product operations.** Deliver in-house
   calculations and direct RTI/necessary pension interfaces, corrections and recovery; complete access,
   observability, restore, migration and support exercises.
6. **M5 — controlled pilot, then release decision.** A separately scoped pilot
   does not shrink the final tax/payroll scope. Release requires evidence for
   every supported case and operating gate below plus explicit deployment
   authority. No release date is inferred from parallel agent count.

The critical dependency chains are below; independent rows can advance together.

| Track | Build order |
| --- | --- |
| Correct posted documents | A1 shared projection, then A2 atomic command, then A3 user review; A4 remains a separately bounded extension. |
| Automate capture | B1 contract/fixtures and B2 worker isolation, then B3 reviewed drafts; B4 adds authorised email ingestion; B5 adds evidence-linked credit suggestions. |
| Reconcile banking | A5 native import/match contract, then A6 connected workspace; provider feeds remain optional until authorised. |
| Tax and payroll | C1 VAT evidence and C2 supported rules precede C3/C4/C5; C6 in-house payroll contract and fixture work can run independently, with implementation after its own rule/contract gate. |
| Reliability | D1 restore, D2 audit and D4 journey checks can start independently; D3 depends on shared recovery identity; D5/D6 harden the integrated product before D7 release evidence. |

## Task queue and integration dependencies

New paths below are **proposed modules**, not claims that features exist.
“Contract gate” means coordinator agreement, not another generic owner approval
for already-authorised reversible development. Provider connection, purchases,
real filing and production actions retain separate authority requirements.

| ID / state | Deliverable and exact file area | Dependency / contract | Acceptance before integration |
| --- | --- | --- | --- |
| A1 — implemented foundation; integration gate below | Shared as-of event projection and fixtures: proposed `B/services/accountingDocuments/documentEvents.ts`, adjacent tests; read consumers in `settlement.ts`, `reports.ts`, `posting.ts` and credit tracking. | Coordinator lease; follow `posted-document-corrections.md`. | Historical cutoff retains original values; later cutoff applies signed differences once; existing settlement compatibility is tested. No edit command or consumer switch enabled. A2 must switch cash/credit caps/reports together. |
| A2 — after A1 | Atomic correction review/commit/history: proposed `accountingDocuments/corrections.ts`, route lease, coordinator-owned amendment overlay in `lib/db/migrations/`. | Stable original ID, immutable amendments, balanced difference journals and replay identity; all consumers switched together. | £120 invoice, £50 paid, corrected to £108 leaves £58 due and unchanged cash; VAT/period/stale/concurrency/rollback/audit cases pass. Reject unsupported dependent claims/credits. |
| A3 — after A2 | Correction review UI in proposed `F/features/documentCorrections/**`; narrow `AccountingDocumentForm.jsx`/`PostedDocument.jsx` integration. | Frozen context/review/commit/history contract; explicit reason/date and before/after values. | Invoice/bill and supported credit correction journeys; permission denial; identical retry; original history and partial payments visible. |
| A4 — contract gate | Credit-balance/refund and return-cycle extensions: task leases on `accountingDocuments/{posting,payments,settlement}.ts`, `creditTracking/**`, affected UI. | Decide excess credit allocation/refund and claim receipt-correction model; coordinator owns shared events. | No over-settlement, duplicated refund or reused credit line; original VAT and receipt history remain traceable. Implement separately from A2's bounded slice. |
| A5 — ready contract/fixtures | Native bank import and matching: proposed `B/services/bankReconciliation/**`, `F/features/bankReconciliation/**`; later leases on `BankTransactions.jsx`/`Reconciliation.jsx`. | Stable company/bank/source transaction identity, pending match review, protected payment/allocation command. No legacy balance write. | Re-import, duplicates, split/partial match, fees, unmatched items, reversal and ambiguous response tests; a match cannot post twice. Coordinator reviews additive persistence before integration. |
| A6 — after A5 | Bank workspace replaces supported legacy matching entry points; optional provider adapter behind explicit connection. | Same reviewed native command; statement provenance and reconciled-period policy. | Statement balance, payments and ledger reconcile; duplicate bank-feed/import events remain one effect; disconnect retains evidence. |
| B1 — implemented foundation; integration gate below | Provider-neutral extraction jobs and adapters under proposed `B/services/documentIntake/extraction/**`; fixtures alongside existing `intake.test.ts`. | Existing immutable source hash and transcript/candidate citation contract. | Synthetic malformed/ambiguous/mixed-VAT/credit cases, duplicate job delivery, cancellation, bounded retries and evidence mismatch. Extracted text cannot execute instructions or select posting authority. |
| B2 — contract gate | Sandboxed extraction worker, malware/parser limits and credential/retention boundaries; reviewed job persistence overlay. | Provider/engine assessment, allowable data destination and retention decision; coordinator approves worker and schema. | Limits for bytes/pages/time, unsupported/encrypted files, isolation, redacted logs and tenant access; provider failure preserves original and manual route. No live connection implied. |
| B3 — after B1/B2 | Field-evidence review and suggested native envelope in `F/features/documentIntake/**`; exact adapter in `F/api/documentIntake.mjs`. | Server-normalised proposal with source/page/offset evidence; explicit supplier/tax confirmation; current review token. | File queue opens draft directly; corrections invalidate stale review; line/total mismatches surface; one source becomes at most one native draft; no automatic posting. |
| B4 — contract gate | Email intake adapter under proposed `B/services/documentIntake/email/**`; new native `EmailCapture.jsx` and `EmailRules.jsx` integration. | Approved mailbox scope/provider, attachment provenance, authenticated delivery, idempotent message/attachment identity and revocation. | Replay, forwarded duplicates, same file via photo/email, spoofed sender hints, unsupported attachments and revoked access; reviewable inbox entries only. |
| B5 — after B3 | Credit matching suggestions and exception triage in `creditTracking/**` and `F/features/creditRecovery/**`, with separate service/UI leases. | Existing original bill/line links and untrusted extraction evidence; use protected candidate checks. | Wrong supplier, repeated part number, partial quantity, earlier credit and commercial discount cannot auto-satisfy a claim; confirmed matches alone count as received. |
| C1 — implemented; integrated regression gate | Canonical VAT coverage/reconciliation fixtures in `B/services/accountingDocuments/reports*.test.ts`, `F/features/vatPreparation/**`. | Existing five-box snapshot and source VAT; exact boundaries stated. | Source VAT reconciles to boxes; unsupported cases/boxes are visible blockers, not zeroes or fabricated filing readiness. |
| C2 — contract gate | Effective-dated tax supported-case fixtures under proposed `B/services/tax/fixtures/**`, with a machine-readable case/status registry. | Accountant-reviewed supported schemes/entities/income cases, rule sources/version and in-house calculation contract. Research current official rules when implementing, rather than embedding rates from memory. | Each supported input has a deterministic expected result and provenance; unsupported input fails explicitly; yearly/version changes do not rewrite past results. |
| C3 — after C1/C2 | VAT submission package, consent/review, receipts/status and recovery: proposed `B/services/tax/vat/**`, `F/features/tax/vat/**`. | Reviewed complete return model, adjustment/amendment rules and separately authorised sandbox provider access. | Duplicate submit/timeout/status recovery, immutable submitted snapshot, receipt verification, role/tenant audit and amendment tests. “Submitted” requires provider evidence. |
| C4 — after C2 | SA/MTD calculation and obligation package: proposed `B/services/tax/income/**`, `F/features/tax/income/**`. | Approved supported taxpayer/income matrix, accounting-to-tax mappings and in-house engine contract. | Synthetic computations, period boundaries, adjustments, review/replay and obligations/receipt lifecycle per supported case. No compliance claim from scaffolding. |
| C5 — after C2 | CT/CT600/accounts package: proposed `B/services/tax/corporation/**`, `F/features/tax/corporation/**`. | Supported entity/period and adjustment matrix; accounts taxonomy, in-house computation and direct filing/review contracts. | Accounting-to-tax reconciliation, period/rounding fixtures, accounts package consistency and submission/recovery evidence. |
| C6 — in-house contract/fixtures; implementation gated | In-house payroll engine and fixture harness: proposed `B/services/payroll/**`, `F/features/payroll/**`. | Implement calculations in-house; define and verify supported employment, statutory pay, pension and direct RTI cases. | Gross-to-net/PAYE/NI and pension fixtures, period corrections, payslips, RTI requests/receipts, duplicate/retry, permissions and privacy. No provider purchase/connection by this task. |
| D1 — implemented drill; integration gate below | Isolated backup/restore drill in proposed `tools/accounting-flow/restore-drill.mjs` with fixtures. | Extend documented demo backup patterns; positively identify fresh disposable source/restore targets. | Restore into a different disposable database, compare journals/source/audit/capture hashes and counts; prove restricted runtime and cleanup. Never restore over owner/shared data. |
| D2 — implemented; integrated regression gate | Audit review/export: proposed `B/services/auditReview/**`, `F/features/auditReview/**`; coordinator route/navigation lease. | Company/role-scoped read projection of existing audit histories; cursor pagination and export bounds. | Create/edit/review/post/payment/correction actors and reasons trace to source; no financial write path; cross-company denial and safe CSV. |
| D3 — contract gate | Durable operation recovery for payment/capture/correction under proposed `B/services/operationRecovery/**`, targeted UI clients. | Retain minimal server-side attempt identity and outcome, tied to company/actor; no financial payload/token copied into browser storage. | Reload/company-switch/relogin and concurrent retry find the same outcome, current permission rechecked, no double posting and no false failure from an empty lookup. |
| D4 — ready per feature | Accessibility/customer/contact/onboarding regressions and useful error recovery in task-leased `F/pages/Customers.jsx`, `Suppliers.jsx`, `Settings.jsx`, `SetupWizard.jsx`, shared layouts. | Preserve existing routes and real capabilities; use the shared design system. | Keyboard/phone/desktop journeys, long content/empty/loading/error states, archived/duplicate-name contacts and no stale company display or export. |
| D5 — after integrated journeys | Threat model, upload/AI boundary tests, dependency/secret checks, bounded jobs/observability and migration rehearsal; `tools/development/**` and narrowly leased services. | Coordinator owns policy, manifests, CI and deployment settings; no silent permission expansion. | Auth/tenant/rate/input limits, malicious document instructions, stale evidence, redacted diagnostics and failed-job recovery; required checks stay enabled. |
| D6 — ready after UI integration | Frontend performance: route-level lazy loading under coordinator lease for `F/App.jsx`; optional PDF/export loading in `F/lib/reportExports.js`, `F/pages/InvoiceDetail.jsx` and task-leased dashboard widgets. | Preserve route/auth/error boundaries and export behaviour; benchmark the exact integrated build first. The current large entry-chunk warning is existing evidence, not a claimed new regression. | Record entry/route chunk sizes and measured navigation/load results; verify direct links, sign-in, company switch, failed chunk retry and exports. No fake percentage speedup or skipped route checks. |
| D7 — release gate | Support runbooks, export/import reconciliation, restore evidence, monitoring, pilot checklist and release receipt in `docs/operations/` (proposed). | All supported product cases and operational exercises complete; explicit pilot/deployment authority. | Recoverable incidents demonstrated, data exit/export works, acceptance issues resolved, exact deployed commit/migrations verified at release. No deployment performed by this plan. |

## Interfaces that keep parallel work safe

| Boundary | Required invariant |
| --- | --- |
| Capture → accounting | Extraction returns a proposal and evidence, never authoritative totals or a posting. The native review normalises the envelope and returns money, revision and fingerprint; conversion requires the existing three acknowledgements and commits source link/draft/audit together. |
| Corrections → all projections | One shared as-of document-event projection feeds settlement, reports, VAT, credit limits and claim eligibility. Stable original IDs keep partial-payment allocations attached. The journal records a balanced difference, not replacement totals. |
| Bank matching → payments | A stable bank transaction identity and exact reviewed command drive native payment/allocation. A bank status alone cannot change a bill/invoice balance. Unknown outcomes are queried/retried with the same identity. |
| Credit suggestions → receipts | Candidate evidence is separate from explicit confirmation. Match supplier, original bill/line, revision, capacity and active posted credit; a suggestion or draft is never a received credit. |
| Tax/payroll → filing | Deterministic, versioned computation produces a reviewable immutable package. Explicit authority precedes submission; verified receipt/status controls success. Repeated delivery cannot create a second consequential action. |
| Every module → UI | Company, capability and revision come from the server. Money remains integer minor-unit strings. Delayed old-company/old-period responses cannot appear in the current view or export. |

## Definition of done and owner acceptance

Every task's handoff includes commit/tree, changed files, contract changes,
focused tests, known limits and a synthetic walkthrough. The coordinator runs
the existing current-source checker, full workspace typecheck/build and required
disposable PostgreSQL suite against the combined exact head. New financial
logic always gets meaningful automated tests; cosmetic changes do not need
tests that merely repeat CSS class names.

Required accounting gates: double-entry integrity; exact inclusive/exclusive
VAT and discounts, supported 20%/5%/0% and exempt/no-VAT distinctions; original
credit evidence and cumulative caps; precise large/decimal values; atomic
journal/projection/audit rollback; replay and concurrency; roles, inactive
membership and tenant isolation; immutable audit and historical cutoffs.
Independent review checks these invariants before financial changes integrate.

The following are **acceptance goals, not measured claims**:

- Reach the document inbox in one navigation action from the daily workspace.
- Open draft preparation directly from a queued/uploaded file; do not make the
  owner search for it or enter source metadata again.
- Select awaiting-credit lines on the original bill without retyping invoice,
  description, quantity, prices or VAT; allow only additional return references
  and a partial return quantity to be entered.
- Follow report → account/category → document → journal without losing period
  or company context. Payments/credits remain separate and understandable.
- Preserve every existing feature route and saved custom dashboard. Planned
  and unavailable services remain clearly identified.
- Complete phone, desktop and keyboard journeys with realistic long supplier
  names and multiline documents; confirm appearance on the actual running
  demo before accepting the visual work.

Use a fixed synthetic acceptance pack: mixed-VAT invoice/bill, photo and PDF
of the same bill, credit with repeated part descriptions, partial return,
partial credit, partially paid invoice with later discount/correction, duplicate
bank import, unknown payment response and empty/second-company cases. Record
owner actions, manually retyped fields, elapsed review time, correction rate,
unresolved exceptions and time to find an outstanding credit. Baseline these
before claiming a time saving; compare each later wave on the same pack.

Measure delivery by integrated, tested and demonstrated journeys, elapsed
work-to-demo time, review wait, escaped regressions and rework. More agent output
or commits alone are not acceleration. Keep small contracts and patches so the
coordinator's review queue does not become the bottleneck.

Preview-origin access is currently restricted by automatic approval review.
Do not bypass it through another browser, iframe or indirect capture. Complete
source/test work, verify the demo's running source through authorised checks,
and explicitly keep visual acceptance pending until permitted. No production
data changes, production migrations, provider connections, filing, merge,
publication or deployment are authorised by this plan.
