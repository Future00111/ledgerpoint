# First coordinated development slice

Baseline: `d4182922ef5e1a7e942a941fe6dbd15d7715a960` on
`dev/w03-draft-invoice-slice`, 30 October 2026. The default `main` branch is
the historical Base44 application and is not the integration target.

The owner authorised parallel implementation and explicitly included the
whole product. The [delivery board](whole-product-delivery-board.md) covers
existing accounting, banking, VAT, tax, payroll, AI, security and operations.
The goal is dependable accounting with less owner administration, measured
in time saved and corrections avoided.

## Team and ownership

Five implementation agents worked in independent Git worktrees. The coordinator
reviewed their changes and alone edited shared schema, route registration,
navigation, integration contracts and test infrastructure.

| Agent | Owned work | First result |
| --- | --- | --- |
| Document intake | `services/documentIntake/**` | Bounded content evidence, extraction candidate validation and native draft review contract; 21 pure tests. No provider connected. |
| Credit recovery | `services/creditTracking/domain*`; subsequently delegated `accountingDocuments/integration.test.ts` | Original-line expected values, precise progress/matching, domain tests and disposable API regression cases. |
| Capture/review interface | `features/creditRecovery/**`, `api/creditRecovery*` | Bill-line selection, partial quantities, return/part/job references, supplier tracker, match review and receipt history. |
| Accounting hardening | Delegated `routes/functions.ts`, bootstrap boundary/tests and `pages/GeneralLedger.jsx` | Retired unsafe legacy chart insertion and misleading legacy journal write controls; retained journal history. |
| Product readiness | Delegated `pages/Payments.jsx`, payment scope helpers, VAT notification helper/widget, delivery board | Company-scoped async payment review, event deep links and honest VAT status notifications. |

No agent independently changes shared financial models or source contracts.
Worktree ownership does not grant permission to change databases, connect
providers, merge or deploy.

## Credit tracking contract

All endpoints use the native authenticated company URL and server-derived actor.
Reads require active membership. Create, receive and cancel require the existing
draft-management capability (owner, administrator or accountant). This does not
grant posting capability. Read-only users can inspect the tracker.

Base: `/api/companies/:companyId/credit-claims`.

| Operation | Contract |
| --- | --- |
| GET list | Optional `bill_id`; returns `{data:{can_manage,claims}}`. Each claim includes original identity, original-line snapshot, expected/received/remaining money, receipt history and incoming candidates. |
| POST create | `{request_id,bill_id,bill_revision,reason,return_reference,returned_on,expected_by,lines:[{original_line_ref,quantity,part_reference,job_reference}]}`. Returns `{data:{ids}}`. All selected lines succeed atomically or none do. |
| POST `/:id/receipts` | `{request_id,credit_id,credit_revision,credit_line_ref}` plus quoted claim revision in `If-Match`. Returns `{data:{claim_id,revision}}`. |
| POST `/:id/cancel` | `{request_id}` plus quoted claim revision. Only claims with no receipt history can be cancelled; cancellation retains the original record and audit. |

Quantities and all money remain strings. Expected money uses the posted bill's
unit price, price basis and original VAT evidence, never an AI estimate or the
current default VAT rate. Part and surcharge lines retain distinct identities.
Tracking works on paid bills too and never changes balances, journals or VAT.

The coordinator-owned additive `credit-tracking.review.sql` defines operational
claims, immutable receipt records and an immutable command/audit log. Commands
are company-scoped and idempotent, with their actor and request hash. Company,
membership and source locks follow the native workflow order. Receipt confirmation
checks current canonical journal identity and reversal history. Listing uses a
consistent read snapshot. Runtime grants prohibit rewriting receipt/audit history
and original claim financial fields.

Existing posted credits are snapshotted when a claim is created and excluded
from its new-credit suggestions. Draft credits can be highlighted, but only an
explicitly confirmed, current posted credit contributes to received totals.
Reversed receipts stop contributing and flag review. Shortfalls remain open;
net/VAT or quantity overages flag review rather than silently closing the claim.

## Scope limits

- One non-cancelled tracker per original bill line. Later additional returns on
  an already tracked line need an amendment/claim-cycle design; they cannot be
  represented as duplicate claims in this slice.
- Receipt confirmations are immutable; correction/reallocation UI is a later
  audited workflow. Do not repair these records with database edits.
- Only native linked supplier credit notes with original-line references are
  matched. A credit spanning several original bills needs a later accounting
  contract. Legacy unlinked records are not inferred as matches.
- Native credit posting still supports `offset_outstanding`. Recording a claim
  for a fully paid bill is supported; posting the eventual refund/prepayment
  credit requires extending the existing accounting workflow separately.
- Real upload, OCR, mailbox collection and draft persistence are not provided by
  the new intake helpers. No background email scan or supplier message is sent.
- This is a development candidate. Existing Replit samples and all shared or
  production databases are unchanged. A missing reviewed schema returns 503.
  No automatic migration runs during normal existing-demo startup.

## Verification and integration

Use Node 24 and pnpm 10.26.1 (matching existing qualification tooling), with the
unchanged lockfile and supply-chain settings. `pnpm run build` includes the full
workspace typecheck. `node tools/development/check.mjs` runs isolated unit,
permission, precision, intake, existing API/UI and rendered-component tests.
It strips ambient credentials and supplies no usable database connection.

`node tools/accounting-flow/test.mjs` provisions a fresh PostgreSQL instance on a
private Unix socket, verifies the database and runtime role, installs all reviewed
overlays, runs real accounting API tests, then stops and removes the instance.
It covers the existing double-entry, VAT, precision, payment, permission, audit,
atomicity and report journeys, plus the new tracking regression cases.

The new `LedgerPoint development regression` PR workflow checks the current PR
source with read-only repository permissions and no production secrets. It is
separate from the frozen C7 qualification workflows and does not replace their
evidence or modify branch protections. It performs no merge, deployment or filing.

Local verification on 30 October: full build/typecheck passed and 194 unit,
scenario and UI tests passed. Native PostgreSQL execution cannot run in the
local root-only UID namespace, so the database suite must pass in isolated CI.
Read the PR's current-commit result before acceptance; the historical baseline
test record is not evidence for these changes. Authenticated browser acceptance
in a separately prepared synthetic environment is still required before merge.
