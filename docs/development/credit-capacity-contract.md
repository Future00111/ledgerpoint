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
