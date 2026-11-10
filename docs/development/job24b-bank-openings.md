# Job 24B — reviewed posted bank openings

Development candidate, 10 November 2026. Incremental base:
`1278589ab73958317a0d2f6f5e578fac9e059732`. No push, integration,
live-demo change or production qualification.

## Delivered journey

Normal Bank Accounts now exposes Opening balance. The user explicitly selects
the configured payment bank ledger (active GBP asset), an active equity
balancing account, effective date, amount and positive/overdraft direction.
Review displays server-calculated debit/credit lines; Cancel writes nothing;
Confirm uses the existing canonical posting engine, period/authority locks and
audit. One canonical journal and immutable opening receipt commit together.
Bank metadata is visibly labelled as non-posted and is not used as authority.

The current payment bank mapping is required, so subsequent cash payments and
reports use the same ledger. Payment setup remains the existing native screen.
Initial openings are refused where that bank ledger already has any canonical
activity. Document controls, current/historical party pools, foreign/inactive
accounts, invalid dates and closed periods are rejected.

Receipt uniqueness is company+bank, company+bank-ledger and company+request.
Company serialization, locked source/context and the canonical economic-effect
key prevent concurrent duplicates. Identical retries recover the original;
different requests conflict. GET recovers without posting. Membership and
posting permission are checked again on retries. The browser retains only the
pending intent in company/bank-scoped session storage; storage failure blocks
posting and ambiguous responses offer recovery/exact-request retry, not a new
command. Opening receipts verify canonical journal/effect identity and hashes.

`bank-openings.review.sql` is installed only by the fresh disposable installer.
It adds immutable receipts with SELECT/INSERT runtime privileges and grants
SELECT/UPDATE(id) on bank_accounts for locked reads, not financial-column writes.
No new privileged runtime or SQL owner. UPDATE/DELETE/TRUNCATE of receipts are
unavailable. Prior demos and databases were not accessed or migrated.

## Accounting and historical evidence

Positive £123.45: Dr bank £123.45 / Cr explicitly selected equity £123.45.
Overdraft reverses those sides. Neither creates VAT, income, payment, allocation
or imported statement evidence. Reports use canonical lines and preserve the
historical bank-ledger identity even after a payment configuration change.

The disposable PostgreSQL tests cover anonymous/read-only/foreign/revoked access,
invalid and subledger accounts, invalid/closed dates, stale review, concurrent
identical posts, conflicting retries, recovery, injected rollback, immutability,
overdraft, report cutoffs, subsequent native payment and mapping changes.
The metadata £999 is deliberately left unchanged while the authoritative
opening/report balance is £123.45; a later £10 receipt produces £133.45, with
earlier cutoffs retaining £123.45. Opening equity cannot become a P&L movement.

## Validation provenance

- 931 source/UI checks, zero failures/skips; final full build/typecheck passed
  at `165bcbe594f075f97cc19dcb17733bd139465e55`.
- 31 migration-registry checks passed.
- 312 disposable PostgreSQL checks, zero failures/skips. Runner source
  `ea51ea98de5b251792bcdf637ba714f4828ca1b6`; subsequent change only added
  actionable error wording, metadata wording and a keyboard propagation guard.
- Populated restore: 50 tables / 14,696 rows; equal source/restored fingerprints.
  Separate-cluster encrypted recovery and restricted-runtime checks passed.
  The encrypted recovery receipt records `165bcbe...` because that wording
  commit was created during the runner. Receipts are retained verbatim rather
  than represented as one immutable-source qualification.
- Cleanup receipts confirm temporary PostgreSQL stopped and owned directories
  removed, no ambient credentials or production contact.
- AI-assisted loopback browser walkthrough on `ea51ea9...`: normal Bank Accounts
  → review/cancel → confirm → real two-line journal → reload/recover → normal
  balance sheet, P&L and VAT, including prior-date zero balances. Journal:
  `2c7b6a67-0689-47be-bfc1-e313d092c8f3`, synthetic and now disposed.
  Test identity transport, NOT real Clerk authentication or human/accountant
  approval. Fixture bundles native components without production CSS; this is
  functional browser evidence, not full-shell visual/Clerk acceptance.

Logs, browser report, receipts and exact export identities are in
`../job24b-evidence` relative to this source checkout. Earlier exports untouched.

## Explicit limitations

- Initial GBP bank asset openings balanced against reviewed equity only.
  Receivable/payable, tax, inventory, fixed-asset subledger, multi-currency and
  general migration openings are not delivered. No silently inferred amount,
  account, historical data or full-migration claim.
- Existing ledger activity blocks initial opening. This is not an opening
  amendment/correction workflow. It does not edit prior postings.
- A bank must already exist; this does not repair legacy bank-account creation
  permissions or deliver the import/reconciliation journey.
- One configured payment-bank ledger at a time; not multi-bank payment routing.
- The receipt shows the canonical bank balance through today. The old bank card
  metadata remains separately labelled, not promoted to a ledger balance.
- Real Clerk/full-shell acceptance remains pending under the existing Job23
  constraint. No inspection of the prohibited preview origin occurred.

Next authorised stage is Job24C (native import/reconciliation), then Job25
adversarial review and Job26 consolidated acceptance/export. They are not claimed
complete by this checkpoint; no new queue, release or parent acceptance.
