# Job24 — banking boundary repair and remaining native-delivery gap

Base: 880190d0f3af87b17652afb38f1fbdd5c599fedc.
Branch: replit/four-day-job24. No existing database, demo, provider, schema,
grant or live workflow changed. Local synthetic testing only.

## Source findings

- BankAccountForm saves opening_balance/current_balance through native entity
  CRUD. This is metadata, not a balanced authoritative opening journal. It does
  not constitute an opening-balance accounting journey.
- BankImportReview/model already validates statement rows and flags duplicate
  candidates. Equal date/reference/value is not a unique bank transaction:
  rows are retained for explicit review, never silently deleted.
- functions.ts recordBankTransaction(s) is the protected native import path,
  distinct from generic entity creation. It enforces company membership and
  one-sided unmatched/review rows, without caller-supplied financial links.
- Previously that path converted direct caller amounts through Number and
  Math.round: 1.001 could become 1.00. The CSV screen rejected such precision,
  but direct requests did not.
- Fresh reviewed schema.mjs provides bank_transactions SELECT and UPDATE(id)
  only, not INSERT; bank_accounts/bank_automation_settings are not in its core
  fresh-schema table inventory. A successful full bank import journey cannot
  be claimed against that restricted fixture. No grants were expanded.
- Existing native payment engine remains authoritative. Integration case
  "bank status and matching metadata cannot settle documents or duplicate
  recovered payment commands" tests both invoice and bill paths, credit/payment
  history, unchanged reports, same-command replay and conflicting retry.
  Changing a bank label is not evidence of posting or partial reconciliation.

## Implemented

1. Exact bank-import parser: accepts decimal numbers/strings with at most two
   decimal places, checks numeric(12,2) bounds with bigint, rejects booleans,
   objects, exponent strings, negatives and fractional pennies. Never rounds.
2. All batch amounts validate before entering a write transaction. A valid
   first row followed by invalid money causes no partial import.
3. Pure tests, native HTTP injected-store tests and a real disposable PostgreSQL
   HTTP case verify this rejection and zero persisted bank rows in a new company.
4. Importing the function routes exposed eager optional AI provider creation.
   Deferred construction until actual AI use; actual unavailable AI still throws
   AIProviderError. No fake key, completion, provider connection or fallback.
5. Expanded native route imports exposed Pino's bundled-worker path failure.
   Disposable runner now externalizes Pino runtime packages as the existing HTTP
   test guidance requires. Original failures and cleanup receipts are retained.

## Evidence interpretation

Source/UI checks include bank CSV parsing, exact amount previews, invalid-row
batch blocking and same-value duplicate warnings. Build/typecheck checks the
normal application. Native PostgreSQL uses ONLY runner-created disposable
resources and synthetic identities, not Clerk; its import test verifies
rejection/no write, not a successful import or reconciliation.

No new interactive banking browser journey is claimed. Existing native
payment/correction/replay tests are evidence for those engines, not proof of an
unimplemented bank-to-payment adapter. No bank feeds were connected.

## Remaining concrete work

Job24 is partial, not complete:
- Native opening-balance review/post/recovery UI/API, balanced opening journal
  and report/history treatment remain absent. Bank metadata must not stand in
  for that delivery.
- Additive isolated bank-storage/runtime authority provisioning plus native
  import receipt/retry semantics needs a scoped implementation. Do not broadly
  grant generic financial writes or modify the old demo to test it.
- Native bank-to-payment linkage must reuse protected payment commands, with
  partial/duplicate match and reversal acceptance; no second payment engine.
- Then exercise successful import, unmatched/partial/corrected matches and
  reconciled totals through native screens in a fresh synthetic business.

No production/public/statu­tory or independent-human acceptance is implied.
