# Posted document corrections — coordinated contract and bounded implementation

The current batch implements invoice/bill quantity and unit-price corrections
against the A1 validated history contract. It requires the additive overlay in
a newly created disposable database and exact integrated regression evidence.
No existing demo/production migration is automatic. Draft editing and linked
later-discount credits on uncorrected originals remain separate workflows.

## Accounting model

Keep a stable document ID so existing partial-payment allocations remain
attached. Keep the original document source and journal immutable. Append
amendment snapshots and, when money changes, a balanced **difference journal**
between the prior effective posting and the proposed posting.

`correctCanonicalJournal()` adds a journal; it does not replace or reverse the
original. Passing replacement totals would double-count. Its current account
locking also requires the first correction slice to retain the original
account mappings. Document settlement and VAT projections must consume the
same amendment history before financial edits can be exposed.

## Current supported slice and remaining cases

| Case | Supported proposal | First-slice blockers |
| --- | --- | --- |
| Posted invoice/bill | Price/quantity changes, including after partial payment; same line order, tax codes, party, currency, number and accounts. | Total below applied payments; any draft or posted child credit; active return claims; changed party/tax point/accounts/discount terms; unknown correction/reversal history; zero aggregate money change; newly nonzero account absent from the original journal. |
| Posted credit — deferred | Future amount change against the same original and original line references. | Needs shared credit-capacity and receipt-correction contract; no edit command enabled. |
| Metadata — deferred | Future versioned reference, notes and due date. | Requires separate nonfinancial revision semantics; no metadata edit command enabled. |

Retain the existing separate linked-credit workflow for later commercial
discounts. A price correction is not automatically a discount. Keep metadata
versions separate from financial-evidence revisions so a note change does not
invalidate a credit's original tax evidence.

## Shared contract and ownership

The coordinator owns the schema, canonical transaction wrapper and one shared
`documentEvents/asOf` projection. No independent UI or feature agent may
implement competing settlement or tax projections.

- `GET /accounting-documents/:id/correction-context`: capabilities, versions,
  immutable original, current amounts, dependent records and precise blockers.
- `POST /accounting-documents/:id/corrections/review` with `If-Match`: reason,
  effective date and proposed fields; server returns before/after net, VAT,
  gross, remaining balance, journal differences and a review token.
- `POST /accounting-documents/:id/corrections`: exact reviewed intent/token and
  stable request UUID. Recheck authority, version, dependencies, period and
  arithmetic under locks; commit all effects atomically.
- `GET /accounting-documents/:id/corrections`: immutable history.

Additive `accounting_document_amendments` contains company/document
identity, revision chain, request ID/hash, actor, reason, effective date,
before/after financial snapshots, signed net/VAT/gross differences and an
mandatory difference journal ID. The companion `accounting_document_amendment_heads`
provides an independently checked current head. Enforce unique request identity and one successor per
revision; deny update/delete/truncate. Preserve document numbering.

The wrapper replay identity binds company, actor, reason, date, expected
revision and normalised proposal. Canonical correction fingerprints alone do
not bind all these fields. An accepted retry returns its original outcome
before recalculating changed state, while rechecking current permissions.

## Integration and runtime boundary

- Both new tables absent: baseline document operations remain available, correction
  context explicitly reports setup unavailable. Partial schema fails closed.
- The installer refuses a nonempty database when the overlay is requested.
  Only the fresh disposable test runner opts in. Existing demo refresh does not.
- Reads validate every amendment, canonical relation, journal, audit record and
  final head before applying a historical cutoff. Reports use dated signed
  movements; payment allocations use corrected capacity and cannot predate the
  latest correction. Original posting retries still use immutable source state.
- Corrected documents cannot yet accept new credits, later discount credits or
  return claims. Existing cancelled-claim history remains visible. The UI states
  this restriction before confirmation and removes incompatible choices.
- Unknown-response recovery retains the exact request in page memory only.
  Durable reload recovery is D3; leaving the page requires checking history.

## Execution order

1. Coordinator implements and tests the common as-of projection. Consume it
   in settlement/payment reviews, compatibility balances, statements/ageing,
   reports/VAT, credit limits/original evidence and return-claim eligibility.
2. Coordinator implements reviewed delta calculation and atomic correction
   command, amendment/audit persistence and replay rules.
3. In parallel, isolated worktrees build the correction UI against the frozen
   contract and synthetic fixtures, plus independent security/test review.
4. Integrate only after full current-source and disposable PostgreSQL checks;
   then demonstrate on preserved synthetic records. No production migration,
   provider connection, merge or deployment is authorised by this document.

Historical reports before the effective date retain original values. Later
reports include the signed movement on the correction date; never overwrite
historical financial totals. Require an open correction period and initially
reject a date preceding the latest related financial activity.

## Required regression cases

- £120 invoice, £50 payment, correction to £108: £58 due, unchanged cash and
  payment history. Credit correction effects remain a later acceptance gate.
- Mixed 20%/5%/0% VAT, inclusive/exclusive input, discounts and penny boundaries;
  balanced journals and exact integer money throughout.
- Future metadata-only changes must preserve financial evidence, journals and VAT;
  this command rejects them until the separate version contract is implemented.
- Multiple corrections, historical cutoffs and report/ledger reconciliation.
- Stale reviews after payments, credits, claims, setup, period or membership
  changes; concurrent corrections and correction/payment races.
- Same-request recovery and changed actor/reason/body conflicts.
- Injected failure after journal insertion rolls back amendments, compatibility
  projections and audits; tenant isolation, role denial and immutability.

This contract needs no changes to existing production data. Detailed supported
tax cases and external filing corrections remain separately governed.
