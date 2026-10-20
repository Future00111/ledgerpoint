# W03 — roles, write contracts and server-money authority

## Contract preparation addendum — 2026-10-20

Detailed [W03 contract/review package](ledgerpoint-w03-contract-review-package.md)
is saved for review, with exact baseline/source evidence, role/member rules,
draft request/response/error/bulk contracts, worked money cases, transaction/
revocation design, client compatibility gaps and unit/HTTP/concurrency tests.
**Direction/preparation only; implementation remains unapproved.**
Lee is acceptance owner; security reviewer TBD; W01 capacity/reviewer
availability is unconfirmed.

G7 is now **ACCEPTED**, as recorded in
[the preserved owner acceptance](ledgerly-tr01-c7-g7-acceptance/owner-acceptance.md).
Do not replay G7. The older G5–G7-pending/workspace-inspection text below
remains the original proposal history; the new package uses current baseline
`f968280e99efe34573ce80c339540f89a622d0c0` plus exact dirty-record hashes.
No additional closure, production, Phase A or implementation authority is
inferred. Monetary rounding/tax details and physical grant/audit/revision
storage remain review decisions, not approved accounting policy.

**SCOPED IMPLEMENTATION-TICKET PROPOSAL ONLY — NOT APPROVED OR STARTED.**
No runtime/schema/workflow change, migration, production access or Phase A.
Proposed build owners Replit + Codex; proposed acceptance owners Lee + security
reviewer TBD; workbook effort 5/8/13 focused days is uncalibrated, not a promise.

## Goal and dependencies

Close the workbook B03 role/input-authority gap without weakening canonical
posting, reconciliation or tenant boundaries. Unknown roles/fields, revoked
and cross-company access, and crafted totals must fail explicitly. Valid draft
invoice/bill inputs receive deterministic server-calculated money and typed,
safe errors; posting/settlement remains a protected operation, not generic CRUD.

Workbook execution dependency is **W02 (separately accepted G5–G7 development
activation/closure)**; W01 scope/capacity/reviewer confirmation also remains
pending. This ticket may be prepared now but implementation requires an exact
workspace/base, explicit owner approval and approved detailed contracts below.
W04/W05 consume its draft contracts; they supply production-capable context/
source providers and invoice/bill posting, which W03 must not pretend to enable.

## Current workspace inspection, not assumed workbook labels

Inspected at workspace source HEAD
`7bea71feb97e6d58753907f3a67cb76c9718389d`; only records changed during preparation.
Source-file hashes are retained in the preparation evidence.

- `artifacts/api-server/src/middlewares/companyScope.ts`: active membership and
  duplicate-conflict failure handling exist. Preserve them; “no company access
  guard” would be a stale finding. Ordinary reads alone do not bind authority
  through a consequential write transaction.
- `artifacts/api-server/src/routes/companies.ts`: add-member, change-role and
  invite paths accept caller role strings after owner checks without a finite
  role allowlist. Add-member defaults `member`, invite defaults `staff`; these
  legacy labels must not silently gain approved privileges.
- `artifacts/api-server/src/routes/entities.ts`: broad create/update/bulk
  payload persistence, primarily excluding `read_only`; update deletes `id` but
  otherwise spreads input. Tenant reassignment and several bank-reconciliation
  fields are protected already. Bulk update may silently skip unauthorized
  records, so partial-result semantics need an explicit contract.
- `lib/db/src/schema/index.ts`: membership role is text; invoices/bills retain
  JSON line items and legacy numeric-money totals. Sales fields include
  `subtotal`, `vat_total`, `total`, `amount_paid`, `balance_due`. These are not
  an approved caller-authority contract.
- `artifacts/api-server/src/services/accounting/canonicalPosting.ts` already
  has finite accounting capabilities, locked company/membership validation and
  strict integer-minor-unit journal validation. Do not replace it with generic
  CRUD or imply no server accounting boundary exists.
- `artifacts/ledgerly/src/api/base44Client.js` is the compatibility client
  boundary; preserve its consumers with contract tests rather than an unrelated
  UI rewrite. Typed response/error changes need compatibility evidence.

These are static source findings, not a new authenticated HTTP exploit,
database test, migration or accounting-journal execution.

## Approved policy and proposed implementation contract

Authority: approved **DEC-05 Option B**, DEC-04/DEC-03 accounting/money/VAT
boundaries, approved source/write decisions, and safety-rule ownership.
See `docs/ledgerly-dec-05-capability-approval-review.md`,
`docs/ledgerly-accounting-core-architecture-review.md`,
`docs/ledgerly-40-implementation-approval-package.md` and
`docs/ledgerly-safety-rule-ownership-record.md`.

DEC-05's approved starting presets are Owner/Admin/Accountant/Manager/Read-only:
server capabilities in active company scope, not arbitrary role strings.
Owner/Admin/Accountant may create/edit drafts; Manager is **scoped**, Read-only
cannot write. Accounting posting/reversal/correction, period and chart/default
powers remain distinct; configurable/scoped/elevated grants need an explicit
approved mapping. AI persistence inherits the same operation capability.
No role can edit posted journals.

Proposed narrow W03 contract:

1. A finite, versioned role/capability evaluator and operation matrix for
   membership management and supported draft financial writes. Unknown,
   ambiguous legacy `member`/`staff`, null or inactive membership denies
   consequential writes pending explicit migration/mapping review; do not
   invent aliases or broaden defaults. Role changes are authorized, auditable
   and effective for future actions immediately. Last-owner management and
   configurable/scoped grants need a reviewed policy, not an inferred default.
2. Explicit per-entity create/update/delete/bulk field contracts. Supported
   financial draft requests permit validated source inputs and safe metadata,
   not caller-controlled company/actor/audit/journal/posting/settlement state.
   Reject unknown keys and crafted server-derived totals rather than silently
   accepting them. Reject non-draft/posted consequential edits and route
   corrections through existing protected boundaries. Preserve all existing
   bank-reconciliation protections.
3. Server money calculation from validated draft line inputs using GBP pence/
   exact decimal parsing and explicit versioned precision/rounding rules.
   Derive subtotal/VAT/total from supported source evidence; settlement
   `amount_paid`/balance and lifecycle status are not client-editable.
   No binary floating-point money, unexplained balancing residual or implicit
   coercion. Legacy numeric fields require a documented adapter, not silent
   schema reinterpretation. DEC-03 limits VAT to approved standard invoice
   basis; new VAT rules/schemes are out of scope.
4. Active company/membership/capability, draft revision and cross-company
   references are revalidated with a lock or conditional version that remains
   valid through persistence in the same transaction. Earlier request reads
   alone are insufficient. Fail closed on unavailable authoritative context;
   retain audit context and safe business-error codes without raw exceptions.
5. Decide and document all-or-nothing versus explicit indexed failure bulk
   behavior; no hidden skip/success. Proposed financial bulk default is reject/
   atomic failure, subject to exact contract approval and compatibility review.

The broad approved architecture does **not** settle API precision, supported
line inputs, rounding tie/line-versus-document rules, legacy-role mappings,
last-owner policy, bulk semantics or exact capability names. These must be
resolved in the ticket's reviewed contract before implementation; W03 may not
silently decide accounting policy or treat DEC-12 as a source-freshness waiver.

## File boundaries

Allowed proposed implementation surface, subject to later exact approval:

| Existing boundary | Proposed change |
| --- | --- |
| `artifacts/api-server/src/routes/companies.ts` | Validate membership write roles and management contract; typed responses/errors |
| `artifacts/api-server/src/routes/entities.ts` | Apply operation/field contracts and server-derived draft money for approved invoice/bill writes; preserve all other protected writes |
| `artifacts/api-server/src/middlewares/companyScope.ts` and `.test.ts` | Reuse active scope resolution; only focused helper/contract tests if required |
| New `artifacts/api-server/src/services/access/` | Central reviewed role/capability evaluator plus unit tests; no ambient grant fallback |
| New `artifacts/api-server/src/services/financialDrafts/` | Exact-decimal money, schemas, transactional draft-write adapter and tests |
| New focused tests beside routes/services | Authenticated HTTP contracts and typed error/compatibility fixtures |
| `artifacts/ledgerly/src/api/base44Client.js` | Only an approved compatibility adapter if contract migration needs it; no cosmetic UI work |
| Existing governance documents | Exact reviewed contract, role-map exceptions and evidence receipts |

Read-only reference/unchanged boundaries: `lib/db/src/schema/index.ts`,
`canonicalPosting.ts` and its integration tests, protected reconciliation/VAT/
AI write services. Do not change runtime schema, canonical posting or providers
merely to make a draft route pass. If implementation needs a schema migration
or wider protected-route/capability change, stop and rescope for approval.

Explicit exclusions: PR26/source pins/workflows/frozen refs or controls,
G5–G7 execution, production providers/posting enablement, VAT-return approval
redesign (W08), reports (W09), payments/allocations (W06), bank matching (W07),
uploads/providers (W10), broad frontend redesign, migration, deployment,
production/Helium or Phase A.

## Meaningful acceptance tests required before accepting implementation

These are **proposed tests, not tests run this turn**:

1. Authenticated HTTP add-member/change-role/invite rejects unknown, blank,
   null, mixed-case/legacy-ambiguous roles and extra fields; trusted actor and
   company come from authenticated scope. A safe approved role update passes
   and its audit identifies actor/company/old/new authority.
2. Exhaustive approved preset × operation matrix: read-only never writes,
   Manager stays within approved draft scope, Admin configurable permissions
   cannot default to posting/reversal, unknown/system/AI context cannot gain
   authority. AI cannot persist on a view-only capability.
3. Revoked/inactive/duplicate-conflicting membership, cross-company body/query/
   header conflicts and foreign customer/supplier/account references fail
   before persistence. Concurrent role revocation/source revision change has
   deterministic lock/version ordering; no check-then-write authority gap.
4. Create, single update, bulk create/update and delete exercise field contracts.
   Inject totals, settlement/status/journal/audit/tenant fields via each path;
   all reject with no forbidden write and no success-by-skipping.
   An allowed draft metadata/source edit passes; posted edits/deletes fail.
5. Real server-money outputs on valid GBP fixtures: e.g. supported standard
   VAT fixture net £10.00 + £2.00 VAT = £12.00; replay/readback equals exact
   minor-unit results. Test zero/VAT-free inputs only when contract permits.
   Test decimal strings, input precision, large bounds, fractional quantities,
   rounding ties, multi-line/document rounding against approved golden cases.
   Reject NaN/Infinity/exponents/overflow/unsupported precision or currencies
   according to reviewed parser rules, without coercion/concatenation.
6. Transaction failure and mixed bulk failure leave no unauthorized/partial
   money, role or audit write; retry/revision semantics are explicit.
   Typed 400/403/409/422 distinctions, safe error body and correlation IDs are
   verified without leaking SQL, stack traces or cross-company existence.
7. Existing company-scope, reconciliation, AI task write and canonical
   immutability/authorization regressions remain valid; no bypass via generic
   entities/functions/client shim. Client consumption of successful money
   strings and typed errors is exercised.
8. Run service/route typechecks and non-DB regressions first. For authenticated
   HTTP/concurrency persistence tests, a separately approved synthetic disposable
   PostgreSQL channel only, rollback isolation and verified cleanup. Never
   production credentials or destructive teardown of immutable journals.

Acceptance evidence must distinguish pure unit fixtures from real authenticated
HTTP and transactional concurrency tests, list skips/failures, and bind exact
implementation source. No “done” based solely on schemas, mock requests or UI.
