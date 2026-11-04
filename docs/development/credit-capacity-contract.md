# Credit capacity and settlement contract

P01-00 interface decision, based on source `83ec61812c53d47a14cf1c7bb5d288f5829e2df2`.
This specifies the dependent accounting implementation; it does not enable a
new posting command or qualify the current paid-credit workflow. Existing
`documents.assertCreditAvailable` admits only `offset_outstanding` credits and
`settlementAmounts` rejects negative balances. Preserve those guards until the
whole transaction below has matching implementation and integration evidence.

## Separate commercial capacity from settlement capacity

Use the same company-scoped, validated `amendmentHistory`/`documentEvents`
projection as corrections, reports and settlements. Stable identity is
`(company_id, original_document_id, original_line_ref)` plus the original journal
ID, financial context hash and current financial revision. A corrected original
retains all these identities except its revision; it does not become a new sale.

For a reviewed effective date, let integer-pence `G` be the original's effective
gross, `C` its effective posted linked credits, `P` its net applied payment
events, and `O = G - C - P` its outstanding amount. Require all four nonnegative.
A positive new credit `K` must fit commercial capacity `G - C`, irrespective of
cash already received/paid. Additionally, each original line's cumulative
credited net, VAT and gross must fit its corresponding effective amounts and
retain its original tax evidence. A total-only check is insufficient. Mixed VAT
lines cannot borrow each other's capacity. Draft credits reserve no capacity;
posting rechecks every competing draft under the same lock.

The available offset is `A = min(K, O)`. Excess `U = K - A` must not produce a
negative original balance, erase a cash payment, or invent a new cash receipt.
For this linked-credit contract, release exactly `U` from reviewed existing
payment allocations into their original unapplied pools, then post the full
credit `K`, atomically. Result: `P' = P - U`, `C' = C + K`,
`O' = O - A`; total historical cash is unchanged. Because `K <= G - C`, `U <= P`.

The review identifies each original payment ID and unallocation amount; there
is no silent choice at confirmation. Multiple payments use a stable proposed
order `(effective_date, created_at, id)`, oldest first, bounded by each payment's
net allocation to this document. The reviewed allocation vector is part of the
request hash and must still match at commit. Release uses each original
payment's stored pool account, never today's replacement account mapping.
Customer value is an unapplied customer-credit liability; supplier value is
an unapplied supplier-prepayment/recoverable asset. Keep origin and credit
links in the evidence even if presentation calls the latter a supplier credit.
Later allocation or refund is a separate reviewed command against the actual
payment pool. Posting a credit never moves bank cash or sends a refund.

## Exact acceptance examples

All examples use synthetic GBP, standard invoice-basis 20% tax, one original
line `0`, immutable document `D1`/journal `J1` and distinct event/journal IDs.
The symbolic IDs here stand for validated UUIDs in executable fixtures.

| Scenario | Before, in pence | Atomic new evidence | After, in pence |
| --- | --- | --- | --- |
| Unpaid bill; £10 gross credit | G=12000, C=0, P=0, O=12000 | Credit CN1/JCN1: net=833, VAT=167, gross=1000; no unallocation | G=12000, C=1000, P=0, O=11000; part-paid settlement, not cancellation |
| Fully paid bill; £24 credit | G=12000, C=0, P=12000, O=0 | UP1/JUP1 releases 2400 from payment PAY1; CN1/JCN1 credits net=2000, VAT=400, gross=2400 | C=2400, P=9600, O=0; PAY1 unapplied=2400, historical cash paid=12000 |
| Part-paid invoice; credit exceeds open | G=12000, C=0, P=10000, O=2000 | UP1/JUP1 releases 1000 from PAY1; CN1/JCN1 credits net=2500, VAT=500, gross=3000 | C=3000, P=9000, O=0; customer unapplied=1000, historical cash received=10000 |
| Credit above commercial capacity | G=12000, C=2400, P=9600, O=0; proposed K=9700 | Reject before any journal/event insertion | Every balance, revision and event unchanged |
| Corrected original, then credit | D1/J1=12000; amendment AM1/JAM1 makes G=10800; P=5000, C=0, O=5800 | CN1/JCN1 against D1 line 0/current revision: net=1000, VAT=200, gross=1200 | G=10800, C=1200, P=5000, O=4600; D1/J1 and AM1/JAM1 unchanged |

For the fully paid supplier example, the unallocation journal debits the
original supplier pool 2400 and credits payables 2400. The credit journal debits
payables 2400, credits expense 2000 and input VAT 400. Net payables remain zero;
bank is unchanged. For a customer, unallocation debits receivables and credits
the customer pool; the sales credit debits revenue/output VAT and credits
receivables. Every individual journal balances. These are posting directions,
not permission to repurpose accounts or mutate original journals.

## Atomic command and historical evidence

One protected transaction locks company/document/current amendment head,
related credit state, affected payment pools and writable periods in a stable
order shared with payment and correction commands. Re-read active membership,
capability, company/party/currency, source revision, account eligibility, line
capacity, payment allocation vector and review hash under those locks. Fail
closed on unknown or partial schema/history. Enforce unique scoped request
identity and journal/source identities in persistence, not only application code.

Append one parent operation with immutable intent and child credit/unallocation
IDs; preserve the original payment, allocations, source document and journals.
Insert all child events, balanced journals, audit links and compatibility
projections in that transaction. An injected failure after any insert rolls all
of them back. Do not emulate atomicity by making multiple existing HTTP calls.
An exact retry, including after an unknown network outcome, returns the original
committed operation after current authorization checks; changed intent, actor,
reason, date, revision or child vector with the same request ID conflicts.

All child movements share the reviewed effective date. Initially require that
date be in an open period and no earlier than the original posting, latest
financial correction, related credit or affected payment/allocation activity.
A report cut off before this date sees the prior credit and payment allocations;
a report on/after it includes both children. Validate the complete immutable
chain and head before applying cutoffs. Never overwrite old report totals,
backdate an unallocation to original cash, or deduce posting from bank status.
Reports, VAT, statements, ageing, document detail and compatibility fields must
consume this same projection. Metadata edits do not change financial revision.

Keep gross/net/VAT in canonical bounded integer-pence strings and arithmetic in
BigInt. Reuse established line rounding and explicit effective tax rules; do not
resolve unsupported fractional-penny or statutory cases implicitly. Review
shows full credit, applied offset, released amount, remaining balance, resulting
unapplied pools and source links separately. A zero open amount means settled;
it does not mean the original was cancelled, refunded or deleted.

## Dependent implementation gates

P01-01 and related financial tasks must prove these examples, concurrent credits,
credit/payment races, multiple-payment release, stale review, exact replay,
changed-body conflict, cross-company/party denial, role removal, period closure,
partial-schema failure, immutable rows, historical cutoffs and full rollback in
the disposable PostgreSQL runner. Add corrected-original and posted-credit
amendment capacity projections before enabling those combinations. A reduction
of an already applied/refunded credit remains rejected until its explicit
recovery operation can restore all affected balances; never silently reclaim
cash or a downstream allocation. Contract acceptance alone is not completion
of those implementation tasks, migration approval or live UI acceptance.

## Conditional prompt-payment agreement: implementation contract

Coordinator decision for P01-03, 3 November 2026; reviewed source baseline
`126d25b87f76e374c3ed80293356140ace460b85`. This is an engineering
prerequisite, not an enabled feature or a claim of statutory qualification.
Existing later-discount and ordinary-credit flows remain distinct. Conditional
terms must never be reconstructed from a free-text reason or added retrospectively
to a posted original. Preserve current posting guards until the scenarios below
pass against the connected implementation.

The invoice/bill draft may carry optional versioned `conditional_discount` terms:
an agreement ID, explicit agreement date, inclusive payment deadline, fixed gross
discount in integer-pence string, and a server-issued evidence receipt ID. A client URL or typed reference alone
is not evidence. The saved review retains
the original company, party, currency, financial revision, original gross and
per-line net/VAT/gross discount allocation. These terms become immutable with
posting. Absence remains absence for old source hashes. Terms require explicit
prepayment agreement evidence and a deadline on/after agreement and original
issue date; they cannot coexist with an ordinary draft discount. Unknown versions,
extra fields, invalid dates, zero/negative discount or discount at/above original
gross fail closed. A percentage offer must be resolved to a reviewed fixed gross
amount before posting, using the existing deterministic line allocation engine.

For original gross G and promised gross discount D, threshold T = G - D.
Eligibility requires net active native cash allocations to this original of at
least T by the inclusive deadline, and at least T still active at credit commit.
Count only validated payment/allocation events with effective dates on/before the
deadline; subtract their unallocations/reversals, including later reversals known
at review/commit. Unapplied pools, refunds, other credits, bank-import status and
drafts are not qualifying cash. Retain the exact event IDs, journal IDs, amounts,
dates and financial revision in review evidence. Later allocations cannot cure a
missed deadline. Effective-date eligibility is separate from evidence that the
agreement existed before the qualifying payment; neither client timestamps nor
backdated issue dates prove an agreement. Missing evidence prevents admission.

Initial admission requires an uncorrected original and no prior posted linked
credit, including another discount. Existing combinations remain blocked until
their cumulative line-capacity and terms-amendment scenarios are independently
qualified. This is a staged implementation gate, not removal of those cases from
the commercial scope. Exactly one conditional-credit operation may consume an
agreement, with unique `(company_id, original_document_id, agreement_id)` enforced in
persistence under the same original-document lock used by
payment and credit commands. Persist agreement identity and canonical terms hash
in the credit source and parent operation; a duplicate with identical request
returns its original outcome, changed intent conflicts. The credit is exactly D,
using frozen original line tax evidence; it never counts toward T itself.
Ordinary later-discount entry cannot reference, copy or consume a conditional
agreement. While an agreement is bound, ordinary discount posting is blocked
until separately reviewed coexistence rules exist; changing the request route or
reason cannot obtain the promised discount twice. Ordinary genuine returns retain
their commercial scope but combinations remain blocked initially.

Posting remains an explicit reviewed credit operation. No automatic credit,
payment, refund or VAT-return amendment occurs at the deadline. Use the existing
paid-credit transaction when a full payment requires release of excess to its
original payment pool. Recheck membership, terms, event vector, period, revision,
line capacity and exclusive consumption inside that transaction; every effect and
agreement-consumption record rolls back together. Earlier report cutoffs retain
their previous balances and journals.

After discount posting, a reversal/unallocation that would reduce qualifying cash
below T must be rejected until a separately reviewed atomic compensation workflow
exists. That workflow must append an explicit linked discount reversal/correction
and restore outstanding balances without modifying past terms, credits or cash.
It must also resolve any downstream allocation/refund and writable-period effects;
do not silently reclaim a refund or call several independent endpoints. Qualifying
cash above T may be released only to the extent eligibility remains satisfied.
All payment-entry paths must enforce this guard under the common lock; an isolated
credit-only eligibility check is insufficient.


### Trusted evidence and immutable persistence boundary

Before posting the original, an active authorized company member must record the
actual agreement evidence bytes and explicitly attest that both parties agreed
the stated terms. The protected server validates bounded UTF-8 evidence (maximum
64 KiB for this initial native text-evidence path), computes SHA-256 over those
exact bytes and records immutable evidence version, company, actor, party,
currency, canonical terms hash and server-observed timestamp. It returns a
receipt ID; client-provided hashes, timestamps, URLs, dates or opaque references
cannot substitute for stored bytes. Evidence capture is an explicit audited
operation; it neither posts a document nor sends anything to the other party.
This proves what was recorded and when, not independent legal verification of
assent. Uploaded/imported/backdated agreement evidence remains unsupported until
its separate verification and retention path is qualified.

Use an additive reviewed migration with immutable `conditional_discount_evidence`,
`conditional_discount_agreements` and `conditional_discount_redemptions` rows.
Evidence stores exact bytes/hash/version and the server receipt above. Agreement
binding stores the evidence receipt plus company/original/journal/party/currency,
original source/financial hash and revision, canonical terms hash/version, G, D,
deadline and each original line's net/VAT/gross discount vector. Redemptions link
the scoped agreement identity to the existing immutable paid-credit parent
operation and credit document, with a database unique constraint on
`(company_id, original_document_id, agreement_id)`. Composite foreign keys bind
company and original throughout; uniqueness is never only a client request ID.
Reject update/delete/truncate for all three tables and reject direct runtime
mutations outside the protected service. Missing/partial/mismatched schema fails
closed; install only in the disposable runner until separately authorized.
Do not create a second cash, allocation, journal or recovery authority.

The agreement binding and its evidence receipt must be committed before the
creation/commit of every native payment counted toward T, and before its
qualifying allocation. Check trusted server timestamps and committed immutable
payment/journal identities under the shared company/document lock; equal or
ambiguous timestamps fail closed. Client effective dates are not causal proof.
Existing prepaid pools created before the binding do not qualify even if later
allocated before the deadline. The payment effective date AND allocation
effective date must be on/before the deadline, with agreement bound beforehand.
Later-created backdated payments or allocations cannot establish timeliness:
each payment AND each qualifying allocation must have a trusted server-observed
commitment timestamp strictly before 00:00 UTC on the day after the deadline,
in addition to both effective dates being on/before the deadline and the binding
being committed before both events. This is the inclusive UTC date boundary
for the initial date-only contract. The review shows that
UTC cutoff explicitly. No new client-controlled date can change this boundary.

Read evidence bytes and recompute their hash at draft admission, original review
and posting, conditional-credit review/commit and guard validation. Match the
stored canonical terms hash and immutable original identity; replaced bytes,
unknown versions, missing evidence or changed source invalidate review. Bind
terms atomically with original posting; an unposted draft may edit/reselect
terms, but a posted original may never acquire or replace an agreement.
An exact authorized retry returns the existing evidence/binding/redemption;
changed evidence or terms under the same scoped request identity conflicts.

The per-line net, VAT and gross commercial-capacity checks earlier in this
contract remain mandatory. The aggregate G-D threshold does not replace them
or reallocate VAT capacity between lines. Reuse existing exact-pence rounding;
unsupported mixed-tax/fractional combinations fail explicitly, retaining scope.
A source correction, credit correction, payment reversal, unallocation, pool
refund or alternate native write that can change qualifying allocations must
check all affected redeemed agreements in the same transaction and lock order.
A refund of an already released surplus pool does not reduce qualifying active
cash; use the existing guarded pool service and do not duplicate that workflow.

Required both-party scenarios for the first connected implementation:

| Scenario (pence) | Expected result |
| --- | --- |
| G=12000, D=1200; 6000 then 4800 allocated by deadline | Reviewed credit 1200; outstanding zero; cash 10800 |
| Same terms, only 10799 allocated by deadline | Reject conditional credit; outstanding 1201 |
| 10800 allocated on deadline / one day later | Deadline payment qualifies; late payment does not |
| 12000 paid by deadline | Credit 1200 releases 1200 to original pool; cash unchanged; active qualifying cash 10800 |
| 10800 qualifying payment reversed before credit | Reject; no credit, consumption marker or partial journal |
| Credit posted, then reversal below threshold | Reject atomically until compensation workflow is qualified |
| Competing credits or changed terms/request | One immutable consumption only; stale review/conflict has no effects |
| Prior credit/corrected source/missing agreement evidence | Explicit blocked case; ordinary credit path cannot masquerade as conditional |
| Client evidence hash/date only, replaced bytes, foreign receipt or unknown evidence version | Reject before admission or mutation |
| Evidence/binding recorded after payment, prepaid pool, equal timestamp, late-created backdated payment, or predeadline cash allocated late with a backdated allocation | Reject as nonqualifying; no chronology inferred from client dates |
| Same agreement submitted through conditional and ordinary later-discount routes | One consumption at most; ordinary route cannot bypass entitlement checks |
| Mixed VAT line vector exceeds one line while total D fits | Reject; no borrowing another line's net/VAT/gross capacity |
| Failure after evidence binding/redemption insert or concurrent payment release | Entire transaction rolls back; stale reviewed vector cannot commit |

The matching P01-03 catalogue ownership includes the exact connected parser,
review, persistence, posting, payment guard, UI and disposable test paths.
Other tasks keep their existing paths; the scheduler prevents concurrent overlaps.
The coordinator owns schema/financial interfaces and must review the migration
and source hash changes before implementation publication. Keep the original
acceptance and priority; this contract does not accept P01-03.
Parent acceptance additionally requires reversal compensation and remaining
prior-credit/correction combinations, exact-commit PostgreSQL rollback/replay and
historical tests, independent financial review and live browser qualification.

### Next connected implementation and remaining gates

The next queue claim is P01-03. Its first connected implementation is the native
text-evidence path for an uncorrected GBP original with no prior credits: capture
and review the evidence, bind the frozen terms at original posting, admit the
explicit conditional-credit review/commit using the existing paid-credit
transaction, and enforce eligibility-preserving guards on every payment/allocation
mutation. Deliver these together; parsing terms, installing tables or rendering
a form alone must not enable admission. Reuse the existing paid-credit recovery,
excess-pool allocation and refund services. Start by tracing and testing all
qualifying-allocation writers under their existing company lock, then add the
reviewed immutable schema/evidence service and connected native UI/API paths.

Before enabling that slice, independent review must verify the actual migration
checks/permissions, immutable evidence and canonical source hashes, the complete
writer inventory and common lock order, server chronology/deadline vectors,
review/replay conflicts, and both-party examples above. Require focused tests,
combined current-source/typecheck/build checks, exact published-source disposable
PostgreSQL/restore CI including partial-schema, rollback and race scenarios, and
browser review of visible agreement terms/evidence, errors and explicit posting.
No existing/shared database migration or live/demo activation is authorized here.

The initial guard deliberately rejects reversals below T; guarded rejection is
not compensation. P01-03 stays pending until an independently reviewed atomic
compensation operation resolves downstream allocation/refund and open-period
requirements, corrected originals and prior-credit combinations have reviewed
cumulative per-line rules and passing connected tests, and the original full
commercial acceptance (including live browser qualification) is evidenced.
Those remaining financial interfaces require coordinator review before their
implementation; they are explicit next gates, not reasons to duplicate already
implemented ordinary allocation/refund workflows or remove scope.

### Unqualified commitment-witness prerequisite (3 November 2026)

A payment event's `created_at` is its insertion time, not its transaction's commit
clock. It cannot prove that cash committed before the inclusive UTC cutoff. The
unfinished witness candidate therefore observes an already visible native payment
or allocation in a fresh server transaction after the posting transaction has
finished, validates its source/journal/posting-effect identities and records a
server-clock receipt. A receipt created on a late retry stays late. A later
receipt commit does not change the fact that the source was already committed at
the observation clock. Both the payment and its qualifying allocation need this
proof; agreement binding also needs a separately reviewed committed-observation
boundary before either event. No client clock or insertion timestamp substitutes.

This candidate does not enable conditional terms, evidence capture, agreement
binding, conditional-credit admission or redeemed-allocation protection. The
migration is checksum-registered for the fresh disposable installer only. The
optional observer preserves an already committed payment outcome when unavailable;
eligibility must eventually validate the persisted receipt, never its response status.

An ALWAYS AFTER INSERT trigger writes an immutable transaction receipt containing
`pg_current_xact_id()` (the full top-level xid, including savepoint inserts) and
the cluster system identifier. Only its pinned-search-path SECURITY DEFINER
function, owned by the non-runtime canonical owner, may insert this map. The
runtime cannot insert, update, delete or truncate it. No historical backfill is
permitted. A new witness requires matching origin and `pg_xact_status(xid8)`
exactly `committed`; absent, expired/unknown or unavailable status fails closed.
The witness trigger replaces caller clocks with the source insertion clock and a
fresh database observation clock. Existing identity-validated immutable witnesses
are returned before insertion, preserving their historical observation on restore.

Focused service mocks and registry checks run locally. Actual disposable PostgreSQL
cases are wired into `tools/accounting-flow/test.mjs`: parent/unreleased/released
savepoints, concurrent invisibility and postcommit observation, atomic rollback,
first-clock preservation, forged clock replacement, restricted mutations, origin
mismatch and partial schema. Their execution awaits exact-source CI; bundling
these tests is not transaction-visibility evidence. A real cross-cluster restore,
including provisioning the canonical owner's narrow `pg_control_system()` execute
grant in that target, remains unqualified. Same-cluster restore is not that proof.
Deadline crossing, agreement binding and complete admission/redemption/reversal
and connected UI workflows remain pending. No existing/shared database or
production activation is authorized, and all earlier P01-03 acceptance gates remain.

### Bounded evidence and draft preparation candidate (4 November 2026)

The candidate adds native text capture/read and draft receipt selection, editing
and clearing for both parties. Evidence has a scoped request identity and immutable
server hashes/time; the protected database function computes them and checks the
current membership and party. Actor identity still relies on the authenticated
service boundary; the shared database role is not independent proof of assent.
Version 1 terms hash is SHA-256 over UTF-8 JSON of the ordered string array:
version, party type, party ID, currency, agreement ID, agreement date, payment
deadline, gross discount pence. Conditional UUIDs use lowercase canonical text.
Receipt ID is excluded; stored evidence bytes
have their own hash. Absent conditional terms preserve the legacy source hash.

This is preparation, not original-document binding or conditional admission.
Posting a conditional draft explicitly rejects without a journal. Next connect
immutable posting-time source/financial-hash and line-vector binding, committed
binding observation before qualifying payments, redemption and every affected
allocation writer guard, then the native capture/review UI. Existing parent gates
and compensation/prior-credit/correction scope remain unchanged. The new disposable
PostgreSQL scenarios require exact-candidate execution and independent review;
compiled scenarios and focused tests alone do not qualify persistence or the journey.
