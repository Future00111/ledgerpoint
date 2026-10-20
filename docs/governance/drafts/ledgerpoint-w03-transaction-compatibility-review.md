# W03 transaction, compatibility and implementation review

**Proposed design and future acceptance tests only.**
See the [package index](ledgerpoint-w03-contract-review-package.md) for decisions.

## 1. Transaction protocol and race semantics

Existing scope middleware is useful for early rejection; it is **not** the
final authorization proof. Existing canonicalPosting already locks company/
membership and validates accounting capability. Reuse its invariants without
altering its posting contract or claiming that draft saves post journals.

Proposed financial/membership mutation protocol:

1. Parse bounded JSON, reject duplicate/unknown fields and malformed version/
   IDs/decimals without side effects. Authenticate server-side. Resolve path
   company; reject conflicting context. Preliminary reads are advisory only.
2. Begin one database transaction; set bounded lock/statement timeouts.
   Lock the company row first (`FOR UPDATE`), verify active company context.
   **All** relevant financial, membership/grant, configuration/reference and
   protected lifecycle writers must participate in the reviewed lock/version
   protocol. Audit every bypass surface before adopting this guarantee.
3. Lock actor/target active membership rows, duplicate rows and grant authority
   in stable key order. Re-evaluate exact role/capability/grant against the
   operation. Unknown/inactive/conflicting state denies. Never trust a request
   cache or client role. Membership mutations check last-active-Owner while
   holding the shared company lock.
4. Lock all target draft rows sorted by kind/ID (not input index). Lock or
   transactionally version-check party/tax/configuration/reference authority
   with mutations participating in the same protocol. `FOR KEY SHARE` alone
   does not protect mutable active/eligibility fields; use suitable share/
   update locks or checked immutable versions. Re-read after locking.
5. Verify existing target company, **actual** draft/unposted/unissued/
   unapproved/unallocated/unmatched state, and authoritative journal/relation/
   settlement evidence—not merely a caller-controlled status string.
   W04/W05 provider context not yet available => fail closed, not assume no
   posting evidence. Check supplied conditional revision against the locked
   effective source and tax/config context. Validate old and new scope.
6. Resolve tax through the authoritative deterministic adapter. Compute exact
   money from validated source; bound every line/aggregate. All batch elements
   validate before persistence. Concurrent duplicate numbers must serialize
   under company lock or an approved unique constraint; a frontend filter is
   not uniqueness. Normalize uniqueness policy explicitly (proposed trim,
   case-sensitive; no case-fold alias without review).
7. Persist allowed draft fields, source/tax context, server-derived projections
   and new revision; persist business audit **in the same transaction**.
   Delete preserves immutable deletion evidence and cannot orphan accounting/
   source relations. Audit failure aborts all writes. Return nothing successful
   before commit. Roll back on conflicts/timeouts; no silent partial bulk.
8. Respond with server view, ETag and correlation ID. Remove sensitive context
   from safe errors; internal logs follow approved retention and avoid document
   bodies/credentials. No new durable AI state is written on denied requests.

Proposed audit event minimum: event ID, transaction/request correlation,
trusted company/actor, delegated actor if AI, operation/capability, target,
before/after source revision hashes, role/grant/config/tax authority revisions,
reason where required, result and UTC server time. Never accept these fields
from the draft payload. Do not insert draft events into immutable canonical
journal audit tables unless their approved event/schema contract permits it.
**Durable draft/membership audit and grant storage is a design approval
dependency**; absent a suitable current store, stop/rescope physical schema.
No schema change is authorized by this document.

### Concurrent revocation: precise guarantee

Company serialization defines the order, not browser click time:
- Revocation commits first: any later writer rechecks and fails; no stale grant
  saved from an earlier middleware read can authorize it.
- Draft write acquired company lock first: it may complete under the authority
  that was current in that serialized transaction; revocation waits, then
  prevents subsequent writes. Do not claim cancellation of already committed
  work or retroactive authority changes.
- Membership/grant change, last-Owner transitions, posted-state transition,
  reference deactivation or configuration update cannot interleave a
  check-then-write gap if **all** relevant writers use the protocol.
- External identity/session revocation cannot be made atomic by PostgreSQL
  locks. Validate current auth at request entry; separate identity integration
  policy is needed for stronger in-flight guarantees.

### Revisions without inventing a schema migration

Proposed strong ETag is a server digest of contract version + target/company
+ server-owned modification timestamp + canonical full source/tax/context/
state authority. Opaque quoted string; `If-Match` must contain exactly one
strong ETag, no wildcard or weak form. Missing =>428, mismatch =>409, never
last-write-wins. Bulk carries the same token in its explicit `revision`.

Current tables have `updated_at` but no dedicated reviewed draft revision/
grant store. A possible schema-preserving design requires every source
mutation to advance timestamp strictly (including same-value edits), with
adequate database precision and timestamp+content binding; prove ABA and
all-writer coverage, not assume timestamp uniqueness. If existing source
history/authority cannot provide a reliable token or retain tax/audit context,
propose a version store/migration separately. Do not silently serialize only
the new route while old generic paths remain writable.
Create responses and repeated requests are not automatically deduplicated.

## 2. Direct current-source findings

Baseline file hashes live in the package receipt; static inspection, not a new
HTTP exploit or database test:

| File/boundary | Observed behavior | Proposed compatibility/enforcement consequence |
| --- | --- | --- |
| `routes/entities.ts` | `WRITE_BLOCKED_ROLES` contains read_only; broad create/update spreads; bulk update continues on missing/unauthorized records | Replace financial and CompanyUser authority paths with shared explicit service/denial; preserve nonfinancial CRUD and existing bank protections |
| `routes/companies.ts` | owner-managed membership with unchecked supplied role; add defaults member, invite staff; self-remove exists | Finite exact roles, mandatory role, narrow grants, last-Owner invariant, strict fields/audit/transaction |
| `middlewares/companyScope.ts` | active membership query; duplicate conflict resolution; company-context rejection | Preserve; move consequential final decision into transaction, not delete existing scope guards |
| `services/accounting/canonicalPosting.ts` | finite owner/accountant accounting capabilities; company/membership locks; integer-minor-unit validation | Reference only. Draft presets do not extend posting or change canonical authority |
| `lib/db/src/schema/index.ts` | role text, is_active; invoices/bills JSON line_items and NUMERIC(12,2) totals; no dedicated draft revision/grant columns | Do not repurpose numeric totals as client input; storage/version/audit gaps must be explicitly resolved |
| `services/ai-accountant/vat.ts`, `vatMath.ts` | standard/invoice basis guards; nominal0/5/20; source evidence and integer-pence box sums | Reuse VAT authority, not bank rate or UI parseFloat; proposed line calculator needs accounting acceptance |
| `api/base44Client.js` | reexports entity client, not itself the main CRUD serializer | Change actual `api/entities.js` boundary when approved; shim-only patch is insufficient |
| `api/entities.js` | generic create/update/bulk stringify arbitrary payload; errors built from raw response text | Finite financial dispatch adapter and structured safe errors without breaking other entities |
| `InvoiceForm.jsx`, `BillForm.jsx` | send form/company/names, derived totals, amount_paid/status; invoke generated-journal functions after save | Current payload must fail strict endpoint. Save-draft path must not silently issue/settle/post; remove/guard these calls in an approved client change |
| invoice/bill line-item components | numeric UI input, parseFloat/client VAT calculation; invoice exposes exempt/no_vat | Keep original decimal strings; previews nonauthoritative; server view wins; unsupported treatments visibly blocked, not mapped to0 |

## 3. Explicit legacy adapter and rollout proposal

**No permissive legacy server mode.** An adapter is explicit reviewed projection
of supported client intent, not permission to send forged totals and ignore
them server-side.

1. Preserve original quantity/price decimal strings in the form; do not convert
   float back to text and claim lossless four-decimal recovery. Old persisted
   JSON numeric sources need reviewed read-normalization: exact decimal storage
   representation, approved precision, otherwise visible edit/re-entry hold.
   Never round >4-decimal legacy input silently.
2. Supported draft-save client builds the exact body from allowed source
   fields only. It does not spread form state or accept arbitrary unknown
   request keys. Remove editable status/paid inputs from the draft save, or
   display them read-only with a separate not-yet-enabled lifecycle action.
   A caller who sends those keys directly still receives422.
3. Legacy `company_id` selects the authenticated path context at the finite
   client adapter boundary; it is not sent as body authority. Customer/
   supplier names are server-derived display values; fetched record identity
   must belong to that company. Pass dates/numbers/reference/notes only.
4. Legacy `quantity`/`unit_price` map only from preserved valid strings.
   `vat_rate` needs an explicit reviewed mapping to an eligible server tax
   code for company/date/document kind. 0%, exempt and no_vat do not share a
   mapping by numeric coincidence. Bill `category`/line categories currently
   exist: initially block unsupported edits or propose classification fields
   separately; do not silently drop them and announce full compatibility.
5. Current `amount/vat_amount/line_total` and top-level totals/settlement/
   timestamps are excluded from an intentional new-client source DTO.
   Warnings/migration notes distinguish expected local preview fields from
   unknown application fields. Server rejects them if they reach the API.
6. Adapt server pence strings into legacy **read-only two-decimal strings**
   `subtotal,vat_total,total`, with explicit source-to-display mapping of
   `source.line_items` and resolved tax display. Do not Number-coerce money
   for authoritative calculations. Existing views sometimes use arithmetic/
   parseFloat/reduce: enumerate consumers and test before claiming compatibility.
7. Store ETag per loaded/saved record in the client state, supply on update/
   delete; never fetch-and-overwrite automatically on409. Show reload/compare
   action. For bulk preserve input indexes and committed:false semantics.
   Uncertain create/bulk response does not trigger automatic resend.
8. `entities.js` adapter routes only SalesInvoice/PurchaseBill draft mutations
   to reviewed namespace; other entities retain behavior unless separately
   scoped. Parse safe error envelope into Error with `.message,.status,.code,
   .requestId,.issues,.failures`; do not expose raw response HTML/SQL.
   Existing filter/get/list stay compatible through reviewed response
   projection, not a second authority.
9. Gate unsupported legacy issued/posted/payment editing with visible typed
   errors, not draft recreation. Preserve posted projections and existing
   settlement/history untouched. No startup rewrite or data conversion.

This is **not** a claim that a base44Client.js-only patch can preserve current
forms. Approval must include narrow InvoiceForm/BillForm, entities.js and line
components changes, plus their affected read/display consumers if needed.
Full UI redesign, payments/issuing/posting providers and journal-generation
enablement remain outside W03. The exact frontend dependency inventory is an
implementation-entry task, not permission for broad refactoring.

## 4. Scoped implementation sequence — only after separate authorization

| Stage | Proposed files | Entry/exit boundary |
| --- | --- | --- |
| A: freeze reviewed contracts | this package/decision record; later service contract tests | Lee + security/accounting review as applicable; W01 capacity, exact base and storage choices resolved |
| B: pure capabilities/parser | new `services/access/` and `services/financialDrafts/` modules + colocated unit tests | Exhaustive deny matrix/decimal/bounds/field schemas; no route initially enabled |
| C: transaction adapters | focused companies/entities routes and companyScope helper; new draft service/audit adapter | Shared locks/revisions, all bypass inventory, atomic audit; storage absent => stop for separate schema approval |
| D: narrow client compatibility | `api/entities.js`, optional shim, invoice/bill forms/line components and tests | Exact source DTO, ETag/errors, unsupported lifecycle blocked; no cosmetic redesign |
| E: verified guarded rollout | approved HTTP/concurrency fixtures and retained source-bound result | Disposable synthetic DB only if authorized; rollback/cleanup; acceptance evidence by test level and exact commit |

Read-only unchanged references: canonicalPosting/kernel tests, database schema,
VAT/reconciliation/posting source-provider boundaries. Any required change to
these, persisted grants/audit or unique constraints requires explicit rescope/
schema authority—not an unnoticed expansion of this ticket. W04/W05 supply
provider/lifecycle context; W06 payments, W07 banking, W08 VAT-return redesign
are separate. W03 cannot emulate their missing authority with permissive stubs.

Lee remains acceptance owner. Security reviewer TBD and accounting review for
rounding/treatments remain dependencies. Replit/Codex build ownership and
5/8/13 focused-day effort are proposals, not assignments or dates.
W01 must confirm capacity/reviewer availability; W02 G7 is accepted, not
re-requested. No implementation starts from this preparation document.

## 5. Meaningful future acceptance tests, by level

All rows below are **required proposed implementation tests, not run here**.

| Level / ID | Required proof | Failure oracle |
| --- | --- | --- |
| Unit U01 | Every exact role × draft/member/AI op, active flag, Manager old/new scope, Admin target/self/Owner restrictions | Exhaustive expected allow/deny matrix, unknown/null/case/duplicate fail closed |
| Unit U02 | Strict create/patch/delete/bulk union, duplicate keys, nested unknowns, prototype keys, dates, lengths, content bounds | Exact safe issue code/path; no coercion/extra field accepted |
| Unit U03 | Golden arithmetic plus randomly generated exact-rational/Decimal cross-check; 4-digit bounds, ties, sum rounding, zero/negative/discount/rejects | Exact pence strings, no floats, no overflow/clipping; accounting-approved fixture identity |
| Unit U04 | VAT catalogue eligibility/date/kind/nonregistered/expiry/unavailable, purchased recovery evidence | Unsupported treatment/code cannot become rate0 or independent second VAT answer |
| Unit U05 | Explicit legacy role/tax/source mapping and client projection/error parsing | member/staff/exempt/no_vat unknown mappings held; numbers not silently upgraded to exact strings |
| Unit U06 | Revision canonicalization/ABA/context versions; safe/truncated/indexed errors | No wildcard/weak revision accepted; deterministic nonreflective error output |
| HTTP H01 | Real authenticated route create/edit/delete as each preset and AI persistence, denied actor variants | Status/code + persisted readback; no auth exception masking as200 |
| HTTP H02 | Financial **and CompanyUser** generic/PUT/PATCH/bulk/function bypass paths; injected tenant/actor/audit/journal/status/totals | Rejected, no forbidden or cross-company mutation; bank/VAT protected regressions preserved |
| HTTP H03 | Valid invoice/bill source → server totals → ETag/readback; duplicate numbers, posted/issued/allocated/matched targets | Draft saves remain drafts; no journal/payment/issue side effects; inaccessible/missing same safe404 |
| HTTP H04 | Mixed valid/invalid bulk, audit failure, malformed JSON, auth/global errors, duplicate target and size limit | 0 business mutations/audits on failure; indexed errors, committed:false; input order stable |
| HTTP H05 | Existing forms/shim integration, valid decimal text, ETag conflict, safe error/uncertain-save display | No raw error leak, float precision loss, automatic resubmit or generate-journal-on-draft-save |
| Concurrency C01 | Two real connections, authority barrier: revocation wins and writer wins order | Actual overlap/locks measured; revoked later writer fails; no stale-cache permit |
| Concurrency C02 | Two Owner removals/demotions/deactivations/self-leaves; grant/membership racing writes | Company still has >=1 distinct active Owner, rejected transaction/audit absent |
| Concurrency C03 | Same ETag simultaneous edits, post/delete race, reference/tax deactivation race | Exactly one applicable edit or valid serialized result, loser409/denied; no posted mutation |
| Concurrency C04 | Same-number create/update, overlapping mixed bulk, lock timeout/audit injected failure | No duplicates/partial writes, bounded lock error, no hidden retry or lost update |
| Regression R01 | Existing canonical immutability/capability, reconciliation, VAT authority/locking, AI write guards and companyScope tests | No relaxed protected route or audit/database identity behavior |

Unit/schema mocks cannot replace authenticated HTTP persistence or overlapping
two-connection tests. A screenshot cannot prove database authority.
Future reports must list exact command/source, actual pass/fail/skip, whether
DB was synthetic disposable, rollback isolation, cleanup and remaining limits.
No production DB or removal of immutable DELETE protections for teardown.

## 6. Checks actually performed in this preparation

Only offline evidence/document/decimal fixture checks, Git diff hygiene and
source/concurrent-record preservation checks. No application typecheck,
application regression, HTTP/browser or database concurrency test run: source
is unchanged and no implementation exists to test. The machine-readable check
report states exact counts and prevents labelling fixtures as runtime proof.
