# Job22 — native credit/correction journeys

## Scope and provenance

Local isolated branch `replit/four-day-job22`, incremental base
`efdb2fa32d6187da9d0446f4f324dc10607f20a3`. No live demo, existing database,
provider, public posting gate, accounting engine or grant changed. No push.
Evidence is in sibling `job22-evidence`; prior packages remain unchanged.

The AI-assisted browser used real native components/routes/services and fresh
disposable PostgreSQL with an explicit synthetic identity, not Clerk or a human
accountant. Initial server source was `f26949978be6e1a02ed32e59f8913c478bd10151`.
The initial customer-credit fixture route incorrectly used customer_credit_note;
the product uses sales_credit_note. The failed report is retained. Browser-only
bundle was rebuilt at `bc56139` with native route/kind; the same database/server
and saved records were retained. No product-route defect is claimed.

## Observed journeys

- Customer: invoice 100+20=120; cancelled correction review wrote nothing;
  explicitly posted correction to120+24=144 updated the parent immediately.
  Receipt144 fully allocated; repeated payment review did not blank the page.
  Posted credit20+4=24 released24 into reusable customer credit, cash unchanged.
  Reloaded invoice settled: paid120, credited24, due0. Statement/reports agreed.
- Supplier: bill100+20=120; payment60; credit20+4=24 left36 due;
  second credit40+8=48 offset36 and released12 into supplier prepayment.
  Both credit reviews were cancelled once before explicit posting. Reloaded
  bill settled: allocated48, credited72, due0. Payment status showed original60,
  allocated48 and unapplied12.
- The bounded 15-minute fixture expired before the final supplier payment
  reload/statement/report UI checks. This is retained as incomplete browser
  evidence, not reported as a successful interactive reload.
- Shutdown's native report proves10 balanced journals/26lines, cash84
  (customer144 less supplier60), receivables/payables0, customer reusable24,
  supplier prepayment12, revenue100, expense40, outputVAT20/inputVAT8.
  Offline verifier checks these exact persisted native report values.

## Fixes and regression findings

The correction panel's sentence that all existing linked credits block correction
was stale. The actual service already supports posted credits with credit-capacity,
payment-floor, historical-date, authority and immutable-journal guards. Draft
credits still block. Corrected the wording and added presentation assertions;
no backend eligibility changes. The browser's initial interpretation of the old
warning is retained and superseded by this source-grounded finding.

First disposable regression run failed two Chromium correction recovery cases:
they expected the old success panel and manual Close callback. Job21 intentionally
closes on confirmed recovery and refreshes the parent immediately. Updated the
test to assert exactly one refresh, cleared locator, closed editor, and reopened
journal history, retaining lost-response, stale/denied, company and role checks.
Original failure log and cleanup receipt remain in `failed-run`.

## Boundaries and remaining evidence

No actual refund/reallocation was performed in the native interactive journey;
reusable balances are not a refund acceptance claim. Neither pre-payment credits
nor every customer/supplier timing permutation was independently browser-tested
here. Existing disposable service and connected correction-browser regressions
cover additional cases; consult exact run logs rather than extrapolating.
Final supplier statement/reload UI, broader credit timing permutations and
refund/reuse UI remain explicit combined-acceptance items for Job26.
Conditional posting remains unavailable; this is not statutory qualification,
real Clerk acceptance, independent-human approval or product launch readiness.
