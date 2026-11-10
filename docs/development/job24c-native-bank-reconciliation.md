# Job24C — native statement import and existing-payment matching

Development candidate, 10 November 2026. Incremental base:
`5fd6fc6cfd8b9a6cac993854c0e82fa81f353d89`. Local isolated branch only.
No integration acceptance, push, deployment, provider or live-demo changes.

## Connected workflow

Normal Bank Transactions opens the native statement workspace. It supports CSV
mapping using the existing parser, manual rows, exact-penny validation, explicit
server preview, cancellation, duplicate warnings and confirmation. Maximum 500
rows / 500 reference characters. Exact duplicate date/description/reference/
amount rows in the same bank or batch block the reviewed native import.

Imported rows are evidence, not accounting postings. Native statements display
unmatched, partially matched and matched amounts from immutable match receipts.
The user selects an existing native customer receipt (money in) or supplier
payment (money out), reviews the proposed amount and confirms. Partial matches
can consume a payment over multiple statement rows, or consume one statement
over multiple payments, subject to both remaining capacities. Neither action
creates another payment, allocation or journal.

The normal UI preserves legacy history separately, excludes native imported rows
from the legacy mutable-status view, and routes legacy Add/Import navigation back
to native statements. Historical legacy action implementations are not deleted
or presented as newly qualified. Database triggers reject any legacy mutation of
native imported rows, rolling back a transactional legacy action rather than
letting it reinterpret new statement evidence as another financial event.

## Authority and recovery

- Existing Clerk-authenticated company router, active single membership and write
  roles; cross-company identifiers never become authority.
- Company serialization, locked bank/setup, fresh capacity and exact reviewed
  evidence hash at commit. Native payment source hash, journal/effect identity
  and bank cash line are verified before matching.
- Bank ledger comes from its opening or previous match evidence, otherwise the
  reviewed current payment-bank setup. A ledger already assigned to a different
  bank's evidence is rejected. Changing current setup cannot silently remap
  historical matches.
- One immutable match receipt per company/request, with actor, timestamp,
  original payment journal, intent and evidence hash. Same-intent retry returns
  the prior receipt; conflicting intent is rejected. Receipt rollback is atomic.
- GET recovery does not replay. Company-scoped session storage retains the exact
  pending request; unavailable storage blocks submission. Unknown responses hold
  new commands until recovery; explicit same-request retry is available.
- Migration `bank-statement-matches.review.sql` adds only match receipts and
  imported-evidence guards. The existing restricted SQL owner answers native
  provenance checks without granting runtime table reads of private import
  receipts. Runtime receives SELECT/INSERT on matches, not mutation history
  permissions. No journal/payment table authority was expanded.

## Evidence

### Focused and combined checks

- 948 source/UI checks, zero failures/skips.
- 31 migration-registry checks, zero failures/skips.
- 314 disposable PostgreSQL checks, zero failures/skips at
  `f5f8653bf5b3263edf0b99cdd442e1491d44ebda`.
- Full build/typecheck passed at
  `b888751a5a512b10ffded9d9de01f400bd85f6dc`.
- Final frontend build passed at
  `c57294c4971595347a3cfc0a18dc6392d0cb59e6`; this last change only routes legacy
  Add/Import navigation to the native workspace.
- Populated restore: 51 tables / 14,802 rows, source/restored fingerprints equal.
  Separate-cluster encrypted recovery, restricted-role checks and cleanup pass.
- All owned temporary database/browser resources stopped and removed. No existing
  database was used; no ambient credentials or production contact.

Actual PostgreSQL cases include invalid rows, preview without writes, duplicates,
concurrent identical retry, conflicting requests, partial and completed matches,
foreign/read-only/revoked access, wrong direction, stale remaining capacity,
injected receipt failure/rollback, recovery and immutable source rows. Financial
journal/line/payment snapshots are unchanged by matching. Native invoice £120
and its existing allocated receipt retain cash £120 and zero outstanding.

The first run failed a new test assertion that expected a settled invoice to
disappear from `open_items`. The report correctly retains its history with
`open_minor=0`; the assertion was corrected, not the financial implementation.
Its log and successful cleanup receipt remain under `failed-initial`.
An initial TypeScript number/bigint mismatch was also fixed before final checks.

### AI-assisted loopback browser walkthrough

At `f5f8653...`, the normal native components and APIs were exercised in a fresh
disposable fixture using test identity transport, NOT Clerk or human approval.
The fixture does not include production CSS; no full-shell visual qualification
or prohibited Replit preview-origin inspection is claimed.

1. CSV preview canceled: no statement rows.
2. Same CSV confirmed: one £120 unmatched statement.
3. Duplicate preview: flagged and confirmation blocked; no duplicate row.
4. £70 match reviewed/canceled: no match written.
5. Real £70 confirmation returned HTTP200, then a one-shot browser fetch wrapper
   discarded that response. Reload recovered exactly one match without resending.
6. Remaining £50 explicitly matched. Full reload shows £120 matched / £0
   unexplained, both receipts pointing to the original journal.
7. Linked original journal and General Ledger still contain only two lines:
   Dr bank £120 / Cr customer unapplied cash £120. The browser fixture's receipt
   was deliberately unallocated; no claim is made that matching allocates an
   invoice. The separate PostgreSQL case covers an already-allocated receipt.

Statement `08a7f830-235c-4500-b28b-268922d073ba`; original payment
`63d9d9c0-b8a4-4950-b773-9cfdfa149d22`; original journal
`014e98f1-764e-4719-9e9e-38c3eb4e1882`. Synthetic fixture now disposed.
Statement £120 minus recorded cash £120 gives £0 difference in this example.
This is derived from the displayed evidence, not a separate closing-balance
reconciliation widget or a universal bank-statement completeness claim.

## Supported boundary and remaining work

- GBP original native customer receipts/supplier payments only. Refunds,
  reversals, transfers, fees, foreign currency and provider/bank-feed connections
  are not added; unsupported lines remain unexplained, never auto-posted.
- Record a missing payment through the existing Payments journey first.
- Confirmed match undo/remapping and import deletion are not available. Cancel
  applies to unconfirmed reviews; immutable history is preserved.
- Exact-content duplicate detection is not fuzzy duplicate detection. Legitimate
  identical repeated statement rows have no override in this candidate.
- Existing legacy functions are retained for legacy records, not accepted as a
  native migration/reconciliation alternative. The earlier `/bank-imports`
  persistence command still has its original command-idempotency contract;
  the new customer-facing reviewed import uses `/bank-statements/imports`.
- No context pagination or full-scale production performance qualification.
- Real Clerk/full-shell browser acceptance remains pending under the existing
  Job23 constraint.

Next authorised stages remain Job25 adversarial review and Job26 consolidated
acceptance/export. Do not add a competing queue, invent additional jobs, or
automatically accept parent requirements.
