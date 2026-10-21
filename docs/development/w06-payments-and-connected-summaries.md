# Payments and connected summaries — 21 October 2026

This delivery implements the financial-summary portion of W09/W11 and the core
W06 payment/settlement journeys in the native React and Express app. It does not
complete every item under those work packages or qualify a public release.

## Working journeys

- Financial dashboard widgets and customer/supplier profiles read canonical
  posted reports. Drafts are listed separately and never count as receivables,
  payables, revenue or expenses.
- Record a customer receipt or supplier payment, allocate it partially or fully
  across posted documents, and retain excess as customer credit or supplier
  prepayment. Later allocation reclassifies that balance without posting cash
  again. Undo allocations, record refunds, or reverse an entirely unallocated,
  unrefunded payment through additional immutable events.
- Every event has a server-calculated review, explicit confirmation, stable
  request ID, company/role/period checks and a canonical journal. Concurrent
  attempts cannot overallocate the same document. Changed reviewed state fails
  safely; an identical retry does not duplicate money.
- Invoice/bill lists and details show derived settlement and remaining amounts.
  Statements show opening/closing balances and linked document/payment history.
  Statements and ledger reports have exact-decimal CSV exports.
- Payment bank and unapplied-control accounts remain separate from current and
  historical document control accounts. Existing events retain captured account
  IDs when later setup changes. Paid amounts reduce credit-note availability.

## Development evidence

The disposable PostgreSQL suite passes 13 integration cases covering the four
document types, accounting controls, settlement, refunds, later allocations,
unallocation, reversal, historical reports, concurrency, rollback, authorization
and mapping changes. Client/API checks pass 9 cases; statement/export logic passes
2 cases. API and frontend typechecks and the frontend build pass. The existing
large-bundle warning remains.

ChatGPT-assisted browser walkthrough, using synthetic data only:

| Example | Verified result |
| --- | --- |
| Existing accounting company | Dashboard revenue £110, profit £70, customer balance £132, supplier balance £48; customer profile and statement agree. Existing records were preserved. |
| New W06 company | Invoice £120 and bill £60 created through native services. |
| Customer receipt £150, allocated £120 | Invoice settled; £30 unapplied credit. |
| Customer refund £10 | Credit £20; separate posted journal. |
| Supplier payment £80, allocated £60 | Bill settled; £20 prepayment. |
| Supplier refund £5 | Prepayment £15; separate posted journal. |
| Resulting dashboard | Posted cash £65; customer/supplier outstanding £0; profit £50; net VAT £10. |
| Invoice detail and customer statement | Settled invoice with £0 remaining; statement retains £20 unapplied credit and source-linked journals. |

Browser download completion could not be confirmed because the browser download
event timed out. CSV calculation/escaping is covered by the focused logic tests;
do not describe the download itself as browser-verified. Later allocation,
unallocation and full reversal are integration-tested, not separately exercised
through the signed-in browser in this walkthrough.

This is development verification, not independent accountant acceptance or HMRC
qualification. Recording a payment does not initiate a bank transfer. Bank-feed
import/reconciliation, provider connections, email delivery, filing and payroll
remain separate work. VAT coverage remains the existing supported standard
invoice-basis scheme; no cash-scheme tax behavior was added.

## Isolated setup

Use the existing setup in `isolated-invoice-demo.md`. On that fixed Unix-socket
development database only, run `node tools/accounting-flow/upgrade-payments.mjs`.
It verifies database/role/socket identity and fingerprints existing documents,
journals, lines and accounts before committing the additive payment schema.
No external or production database migration is authorized by this helper.

To create a separate W06 sample, bundle `tools/accounting-flow/payment-demo.ts`
with the API workspace's esbuild (CJS, external `pg` and `@clerk/express`). Run the
bundle with `NODE_ENV=development`, `W03_INVOICE_DEMO_MODE=1` and the API workspace
node_modules on `NODE_PATH`; pass an existing invoice ID from the intended
synthetic accounting company as its sole argument. The helper verifies the fixed
database and uses that company's sole active owner. It refuses to reset an
existing W06 sample. The fixture only seeds the separate sample and never alters
the earlier company's records.

The active delivery plan remains `docs/ledgerly-active-product-plan.md`.
