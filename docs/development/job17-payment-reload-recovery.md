# Job 17 — payment reload recovery

Base: 84fe9bedb04bfbb6148b9be8e93eb762c9fc725b.
Branch: replit/four-day-job17-reload.
Tested source: f6a721891c1db6fcc6cd5f53ccf7bddc3ee47d24.

## Delivered through normal Payments

The previous controller retained intent only in page memory. The normal page now
saves an opaque event ID scoped to its company before any POST, with a URL locator
as well. Local browser storage contains no amounts, party details, review tokens,
credentials or financial command. Storage failure stops sending.

Reload, returning to the company, or restoring the bookmarked URL recreates a
read-only recovery state. Status reads use the existing authenticated native
operation endpoint. Membership/role checks are not replaced with browser state.
Known results expose the normal journal link; unknown, absent or denied results
remain unresolved and cannot unlock a new payment identity. Exact in-memory
retries still use the same original command. A restored reference cannot retry
without that command. Closing a dialog retains recovery on the normal page.
An unresolved reference can no longer be abandoned to create a replacement.

All payment event kinds use this shared path: payment, allocation, unallocation,
refund and reversal. No server-money calculations, posting services, schemas or
grants changed. Original records and historical balances remain untouched.

## Verification

- 14 focused controller/locator tests passed.
- 890/890 combined source/UI/scheduler checks, 31/31 registry checks.
- Full build/typecheck passed.
- Isolated browser journey on actual Payments.jsx passed: reference survives
  reload, unknown/denied outcomes preserve it, company switch hides/restores the
  correct panel, known outcome shows the normal journal link, and recovery
  produces GET-only traffic. No new payment POST occurred.

The browser used an unstyled loopback fixture with mocked HTTP responses and
synthetic company/ledger hooks, NOT Clerk authentication or native database
acceptance. Reload resets the mock's in-memory known flag; re-enabling that mock
allowed the recorded-outcome assertion. This is not proof of an API-process
restart or persistent accounting effects. The report is retained in the external
evidence directory; screenshots were recorded by the testing session.
Fixture server/browser were stopped.

The initial combined run failed an old button-count assertion expecting the
removed discard control. It was corrected from three disabled buttons to two;
no financial/security guard was removed. Failed log retained.

## Acceptance still outstanding

Native server-restart/populated-database and full signed-in recovery acceptance
must be included in the combined Job20 pass. Broader correction/compensation
behavior remains bounded by its existing native evidence and closed public gates.
This implementation closes the identified payment reload UI gap; it does not
qualify all financial lifecycles or make the product launch-ready.

Browser storage deliberately discarded by the user cannot recreate a lost
locator unless its URL/reference was retained. An unknown event without its
original reviewed command remains read-only; do not infer cancellation or invent
a new request. No live demo, existing DB, queue/lease, provider, public posting,
push, merge or deployment change. Earlier Job17 and Jobs1–16 remain preserved.
