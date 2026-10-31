# Native bank import and reconciliation contract

P06-00, contract baseline `a64c6c31a3b3e0b5093c89b4c00889d0c382b0f5`;
status-independence fixture added after integrated baseline `854c4c5`.
This is an implementation interface for P06-01 onward. It does not enable bank
feeds, posting, durable import replay or unqualified currencies. Calculations
remain native. Existing protected payments and canonical journals remain the
only authority for settlement; a bank row is source evidence, not a payment.

## Immutable source identity

Every source belongs to an authorised `(company_id, bank_account_id)` pair.
Check current membership/capability on preview, import, recovery and confirmation.
Reject a bank account from another company even if its UUID is valid. Persist the
account's currency and source provider/format version with the evidence. The
currently qualified protected payment path is GBP; keep other currencies
unavailable for posting until their explicit ledger contract is qualified.

For files, retain the exact uploaded bytes' SHA-256, parser version, explicit
column mapping/date format, immutable statement/import ID and source row ordinal.
The imported observation identity is `(company, account, file_sha256, row_ordinal)`.
A scoped command request UUID plus normalized-intent hash identifies an import
attempt. Repeating that UUID and hash recovers its original receipt; changed
mapping, selections or intent with the same UUID conflicts. A new request for an
already imported observation must resolve existing provenance, never insert a
second transaction. Identical rows at different ordinals can be legitimate and
must not be discarded. The file hash and row are provenance, not proof that two
observations on different statements are different bank movements.

A provider transaction ID may identify a movement only within its documented
account/provider namespace and stability guarantees. Preserve raw provider ID,
revision and pending/booked relationships. Never manufacture cross-provider
identity or infer cancellation solely from a missing feed row. Across overlapping
or differently formatted statements, matching date/amount/reference/description
is only a duplicate candidate. Show both sources for explicit review; retain both
observations and the reviewed link to one movement. Without a stable external ID,
never silently delete or merge equal-valued transactions. Reversing a mistaken
link appends an audit event; original import receipts stay immutable.

## Money, dates and review

Canonical money is a bounded integer-minor-unit string; arithmetic uses BigInt.
Preserve currency exponent explicitly. For the current GBP bank storage boundary,
accept up to `999999999999` pence. Validate at server ingress; the current frontend
numeric compatibility adapter is not an authoritative financial parser. One of
money-in/money-out must be positive, the other zero. Preserve a missing statement
balance as unknown, not zero. Reject exponent notation, nonfinite values,
fractional pennies and ambiguous separators rather than silently rounding.

Store booking date and value date separately when supplied. Parse the declared
format strictly into a real ISO calendar date; do not guess day/month order or
shift date-only values through local timezones. Preserve original date text.
Source dates do not override an open posting period or payment chronology guard.
A proposed posting date and any divergence from bank date must be reviewed.

Review binds the immutable source, bank account and currency, amount, current
source revision, selected targets, target financial revisions, allocation vector,
fee treatment, account mappings, operation kind and proposed posting date. Recheck
all these under the protected transaction's locks. A refreshed preview must be
confirmed again after any change. Suggestions and match status grant no posting
authority. A credit note match must not become a cash payment or double-count a
credit already reflected by the document event projection.

## Splits, fees and reversals

A split uses explicit child identities under one reviewed operation. Allocations
must be positive, have unique targets and sum exactly; never allocate beyond the
current open amount or across companies, parties or currencies. Mixed-party
receipts require separately reviewed child payment intents; until atomic parent
support exists, reject them rather than calling several payment endpoints and
claiming atomicity. A statement link to an already posted payment consumes only
its matching capacity and creates no second cash journal.

Fees are explicit accounting lines with separately selected eligible accounts
and tax evidence. Never infer fee VAT from the difference. For a £97 net customer
receipt settling £100: bank debit 9700, reviewed fee expense debit 300, receivables
credit 10000. This balances but is **not supported by today's payment endpoint**,
whose cash amount is also the maximum allocation. Keep the compound command
unavailable until a reviewed atomic fee/payment implementation exists. Reject a
silent £3 write-off or changing the source bank amount to £100.

A reversal appends a new operation linked to the original payment and journals;
it never deletes a source row, allocation or prior status history. Preserve the
original bank and pool account mappings. Existing payment reversal requires the
full original amount unapplied and no prior refund: unallocate first through the
protected operation. A bank-feed reversal signal alone cannot reverse payment
or credit evidence. Distinguish reversing a reconciliation link (no cash effect)
from posting a genuine reversing bank movement (reviewed accounting effect).

## Atomicity and recovery

Use the persistence contracts' company-scoped request identity and outcome model.
Lock the source movement/reconciliation revision and relevant payment/document
state in the shared stable order. Insert source link, canonical payment/allocation
journal, immutable outcome and audit in one transaction when financial effects
are requested. Pure import records source observations only. Every failure before
commit leaves financial rows and links unchanged. Database uniqueness must
protect movement consumption and request identity under concurrent confirmation.

A timeout means unknown. Recover by the original operation ID and immutable
intent after current authorization checks; never regenerate the request ID or
repost based on an absent UI row. A confirmed original result can be returned
without repeating its effect. Changed-body replay conflicts. Do not infer failure
from delayed visibility. Current page-memory payment recovery provides only
same-page retry; P03-01 must add durable reload/re-login recovery before that
capability is claimed. Imported/matched/reconciled labels never enter document
balance calculations: document/payment events and their historical cutoff do.

## Acceptance fixtures and qualification boundary

| Synthetic fixture | Required result |
| --- | --- |
| D1 gross 12000, posted credits 1000, applied payments 2000; bank row changes unmatched to matched | D1 open remains 9000; no new payment, journal or allocation |
| Two identical £50 rows at distinct source ordinals | Two observations survive; duplicate warning does not delete either |
| Same file and row imported twice, including concurrent requests | One observation/movement identity; original receipt recovered or explicit conflict |
| Same dates/amounts on overlapping statements with no provider identity | Review candidate only; no automatic merge or accounting effect |
| £120 receipt split to D1=7000, D2=5000, same company/party | Total 12000, balanced protected payment; 7000+5001 rejects without writes |
| £97 receipt plus explicit £3 fee settling £100 | Balanced compound journal described above; unavailable until atomic fee support is implemented |
| Lost payment response after commit | Retry keeps original ID, exact amount, allocations and review token; no second journal |
| Reversal requested after allocation/refund | Existing guards reject until applicable reviewed recovery; original evidence unchanged |
| Removed member or company switched before retry | Denial/no stale application; original operation retained for authorised recovery |

Existing executable evidence to rerun on the exact candidate:

* `node --test artifacts/ledgerly/src/features/bankImport/model.test.mjs`
  checks strict money/date parsing, duplicate warnings, scope and receipt guards.
* `node --test artifacts/ledgerly/src/features/paymentRecovery/model.test.mjs`
  checks unknown-outcome retry preserves the original ID/body/token, permission
  boundaries and stale asynchronous responses. It proves page-memory behavior.
* `tools/accounting-flow/test.mjs` in the isolated PostgreSQL workflow runs
  `accountingDocuments/integration.test.ts`, including rejection of old bank
  matching as a way to settle protected documents. That test verifies the bank
  status stays `unmatched` and the document projection stays unchanged after
  rejection. The added `bank status and matching metadata cannot settle documents
  or duplicate recovered payment commands` fixture directly changes synthetic bank
  labels through admin-only setup: a £120 customer invoice or supplier bill, £10
  credit and £20 payment remain £90 open through matched/reconciled/unmatched
  labels. Full report and stored-document snapshots, journal/payment counts, and
  original-command replay/changed-intent rejection must remain unchanged.
  The W06 payment fixture sends two identical reviewed payment POSTs with
  `Promise.all` and expects one posted/one duplicate result. This is evidence for
  the existing payment endpoint, not forced database-lock overlap or the new
  native bank command.

P06-00 remains pending until this added fixture executes in isolated PostgreSQL
and coordinator review accepts the exact candidate plus payment-recovery evidence. These existing fixtures do not prove future durable import identities,
split/fee commands or cross-statement matching. Add their concurrency, stale-review,
partial-schema, rollback, historical-cutoff, tenant and removed-member fixtures
with their implementations. Contract acceptance requires coordinator review and
matching-commit isolated CI evidence for the existing settlement boundary;
P06-01–05 remain implementation work, not completed by this document.
