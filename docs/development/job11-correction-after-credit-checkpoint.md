# Job 11 — isolated implementation candidate

## Current status — prior-credit bridge implemented

The internal native credit engine now distinguishes ordinary commercial credits
from discount redemption. The new command is not an HTTP endpoint or a caller
mode flag. Its SQL admission checks the actual source/revision, canonical journal
and posting effect, current capacity, membership, and DB-owned same-top-transaction
journal origin. An ordinary credit does not consume the discount allowance.

Replacement observations now bind the exact prior-credit set and its canonical
financial payloads. Remaining net/VAT/gross capacity uses the existing native
per-line calculation. SQL independently verifies the credited set, line caps,
canonical payload hashes, activity dates and committed journal origins. Historical
observations remain unchanged; fresh admission checks current state. New cash
cannot qualify under stale original terms after an ordinary credit.

Both customer and supplier tests cover £120 minus a £24 ordinary credit, with and
without a correction to £96: explicit £12 replacement terms require fresh £84 or
£60 payment respectively. Redemption closes the balance. Unallocating £10 and
reversing only that discount leaves £22 outstanding, preserving the original and
the £24 credit, with no cash movement. Tests read actual native settlement totals,
not just the preview. Rollback, concurrent identical retries, replay, forged
same-transaction payloads, retroactive receipts and private-function permissions
are exercised. The existing consumption boundary remains permanent.

Prior credits that have themselves been corrected or reversed remain explicitly
unsupported by this observation path; they are not silently reinterpreted.
Existing unsupported downstream reallocation/reversal guards remain in force.
Both public conditional-posting gates remain closed. This is a local native-service
candidate, not public UI, Clerk browser, independent accountant or production
acceptance. No demo or existing database was changed.

Validation receipts and failed-attempt evidence are retained separately in
`job11-prior-credit-evidence` alongside the isolated checkout. The earlier records
below describe prior checkpoints, not current unresolved implementation status.

Final executable validation: `6e9a507fa955abb35b92ee015cf68a5946c2062b`.
301/301 disposable-runner tests, 860/860 source/UI tests and 31/31 registry checks;
zero failures/skips in the final runs. Full build/typecheck passed before the
final test-only error-cause assertion adjustment. Populated restore verified
46 tables / 14,095 rows, encrypted recovery passed, and the runner confirmed its
PostgreSQL process stopped and disposable directory removed. Failed installation
and test-harness attempts, with cleanup receipts, remain preserved.

## Earlier checkpoint — connected corrected-original lifecycle

Conditional originals can now be corrected through the existing correction
service while retaining their original journal's immutable agreement-binding
identity. A corrected original requires explicit replacement terms before fresh
payments can qualify. The replacement observer persists a versioned capacity
snapshot; SQL compares its financial data, revision and journal-origin receipts
to the current document. SQL hashes native canonical payload bytes, never
`jsonb::text`.

Native payment qualification, redemption, rollback/replay and compensation are
connected for corrected originals with no prior credits, for both customer and
supplier documents. The tests correct £120 to £96, replace the discount with £12,
qualify £84 fresh cash, redeem once, and then unallocate £10/reverse the £12 credit
to leave £22 outstanding without changing cash. The original source remains
unchanged and the agreement remains permanently consumed after compensation.

Historical replacement reads use the protected frozen snapshot rather than
recalculating it after its redemption credit. New payment/redemption admission
checks the live context; stale original terms do not qualify. Correction remains
blocked after consumption. Both public conditional-posting gates remain closed.
The new flow is internal native-service/disposable-test evidence, not signed-in
browser, independent accountant, public posting or production acceptance.

**Still incomplete:** conditional replacement agreements involving pre-existing
posted credits. The observer and compensation guards still explicitly reject
that combination. Supporting it requires distinguishing an ordinary commercial
credit from consuming a conditional discount, using the existing protected credit
engine, then validating and retaining the exact credited set in the observation.
Do not remove the prior-credit guards without that path and its acceptance cases.
No new owner policy decision is currently identified.

The additive corrected-observations migration is optional with the amendment
schema in fresh disposable installation. No existing database or live demo was
migrated. Existing owner backlog Jobs 12–14 remain unchanged.

## Historical incremental checkpoints

Base: `97441e99c2bb60d65e9a123258aae14caea495fe`.
Branch: `replit/four-day-job11`. This is not completion of Job 11.

## Confirmed owner rule

Outstanding balances update after corrections; posted credits remain immutable.
An invoice £120 less a £24 credit has £96 outstanding. Correcting the invoice
face value to £100 changes outstanding to £76, not the credit amount.
Do not ask this policy question again.

## Implemented slice

Ordinary invoices and bills can be corrected after posted credits. Review and
commit retain credited amounts, calculate outstanding after credits and allocated
payments, and include the credit evidence in the review token. The existing
company transaction lock still serializes posting, corrections and settlement.

The shared per-line net/VAT/gross capacity check now also validates a proposed
corrected original against its existing posted credits. Corrections cannot
reduce a line below credited amounts or reduce the remaining obligation below
allocated payments. Corrections cannot predate the linked posted credits.
Outstanding compatibility projections update in the existing atomic transaction.
Original source/journals and posted credit records are not overwritten.

Pending credit drafts and active supplier claims still block correction.
Conditional originals remain blocked by their original-binding/journal identity
boundary; no conditional guard was removed to make ordinary correction pass.

New disposable customer and supplier cases exercise immutable credit preservation,
review totals, rollback, correction commit, dated report balances, revision
conflict, credit capacity and payment floors. The existing full-credit fixture
also retained an excess-credit draft: its original draft blocker was correctly
preserved after the first test run exposed that assumption. Failed log and cleanup
receipt are retained in the incremental evidence directory.

## Remaining Job 11 work — do not mark complete

The residual-capacity preparation is implemented in `replacementCapacity.ts`,
using the shared per-line cap check and existing native allocation/tax helpers.
It reads the original through the scoped native query, validates amendment and
credit history, and returns remaining money, a new vector and canonical snapshot
hash covering the current revision and credit identities/evidence. It rejects an
agreement date preceding correction/credit activity. No observation, payment
admission or redemption calls this new preparation service yet.

Unit cases cover both parties, prior credits, corrected values, a depleted line,
mixed VAT, immutable inputs, component over-capacity and invalid line references.
Disposable PostgreSQL cases prepare against actual corrected originals/credits,
check deterministic snapshot hashes, and reject early dates and foreign-company
access. These are preparation tests, not end-to-end replacement qualification.

The remaining binding work must preserve two different identities: the immutable
original posting/consumption identity and the newly agreed residual-capacity
snapshot. The current SQL observer requires the original financial fields and
original line capacities, so simply deleting its equality checks is not a fix.
Introduce a guarded, versioned observation contract that verifies the amendment
head and specific credited set, retains historical snapshots after redemption,
and rejects a changed live context before a new payment/redemption. In particular,
historical reads must not recompute their frozen capacity including the redemption
credit itself. Keep both public gates closed and the permanent original-consumption
key unchanged through that work.

Residual-capacity preparation now also binds the DB-owned original, amendment
and credited-journal origin receipts. A new additive read-only SQL function
rejects missing/foreign-company origins, repeated identities, current-transaction
origins and origins from another cluster. It only returns committed provenance;
it neither creates an observation nor enables redemption. The migration is
registered for the existing fresh disposable installer, not applied to any demo.

Disposable tests exercise rollback before audit completion, unchanged capacity
after rollback, and a changed snapshot after the corrected transaction commits.
The first test attempt reached the earlier incomplete-audit history guard; the
test was changed to probe the origin function at that hook, not weaken history.
A subsequent compensation rollback test exposed an unordered journal array in
the review hash. That query now orders by journal ID; token equality and all
financial freshness fields remain unchanged. Both failure logs are retained.

1. Conditional agreements with prior credits: freeze residual per-line capacity,
   explicitly agreed replacement terms and current settlement context together.
2. Conditional agreements against corrected originals: retain original journal
   identity while binding replacement evidence to the verified amendment head.
3. Corrected supplier return claims are now implemented: create against verified
   amended line evidence and revision, while validating the immutable original
   journal independently. Reject stale revisions and return dates preceding the
   correction. Confirm/list use the verified amendment head; old cancelled
   claims remain historical, not silently rebound. Existing baseline receipt,
   permissions, company lock and duplicate-command controls remain.
4. Credit views now load the native ledger snapshot for the linked original and
   show its current outstanding separately from the unchanged credit amount.
   Loading, malformed balances and failed refreshes do not expose stale totals.
   Corrected bills expose the normal return selector. Automated component tests
   cover £100 corrected total less £24 credit = £76 outstanding and error hiding.
   No live demo or signed-in browser acceptance is claimed.
5. Combined source/migration/build and disposable restore acceptance once the
   remaining Job 11 slices are integrated.

Next executable slice: versioned conditional residual capacity and correction
combinations (items 1–2), followed by combined acceptance. The supplier-claim
PostgreSQL test covers stale revision, pre-correction return date, command replay,
corrected-value receipt, old claim preservation and immutable original revision.
Jobs 12–14 remain in the existing
owner backlog; do not create a competing queue.

No demo, existing database, startup pointer, public posting gate, provider,
authoritative queue, push, merge or deployment changes. Local AI-tested candidate
only; independent review remains required.
