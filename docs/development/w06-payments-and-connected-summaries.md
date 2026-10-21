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

The initial browser download observer timed out. The owner's screenshot supplied
on 21 October subsequently confirmed that the customer statement downloaded and
opened in a spreadsheet, with invoice £120 settled and £20 credit remaining.
It also exposed apostrophe-prefixed negative amounts. The CSV writer now leaves
plain signed decimal amounts numeric while still escaping formula-like text.
Three focused export/statement tests cover this correction; the revised file has
not yet been independently reopened in the owner's spreadsheet. Later allocation,
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

## Invoice and bill settlement workflow — 21 October 2026

Built around the existing native posting engine and W06 payments:

- Invoice/bill lists offer search, awaiting-payment, partial, overdue and settled
  views, with original amount, cash allocated, credit notes and remaining balance.
- Document detail shows the same balances and source-linked payment/credit history.
  Credit-only reductions are labelled partially/fully credited; the original
  document remains posted and its amounts are preserved.
- Create credit note preselects the original. Quantity and credit unit amount are
  editable within original limits; tax basis/rate and posting accounts are retained.
  Server-side cumulative net/VAT/gross and outstanding-balance caps still apply.
- Record payment opens the existing protected review flow with the party,
  document and remaining amount prefilled. It does not instruct a bank transfer.
- Native posting updates compatibility balance fields in the same transaction.
  These fields are derived read models; canonical sources/events/journals remain
  authoritative. Unallocation restores the corresponding amount due.
- Old bank reconciliation rejects native documents before any write. Native
  bank-statement matching is **not implemented** by this delivery; preventing
  an unjournalled balance change is not equivalent to completing reconciliation.

Evidence: 14 disposable database integration cases pass, including the new
£60 document/£10 credit case for both sales and purchases, later cash and credits,
unallocation, final settlement and the old-reconciliation guard. API/frontend
typechecks and builds pass. Database cleanup is verified by the runner receipt.
Signed-in ChatGPT-assisted preview inspection confirmed both £60/£0/£10/£50
document screens, credit links, preselected editable credit amount, list status
and a payment dialog prefilled with £50. No extra payment was submitted in that
walkthrough. This is development evidence, not independent accounting acceptance.

`credit-demo.ts` uses the same guarded setup/owner argument as `payment-demo.ts`
and creates a separate **Synthetic Credits — TEST DATA, not business records**
company. `refresh-settlement-demo.mjs` refreshes only derived compatibility
balances in the fixed isolated database; it rejects unexplained legacy payments
or bank links and verifies unchanged source/journal/payment/account fingerprints.
Existing seven invoice/bill projections were refreshed; original records remain.

The initial preview used a separate checkout because Replit had an older,
unstaged `productionAuthority.ts` edit. On 2026-10-21, with the user's approval,
the original file and patch were backed up under
`.git/repair-backups/authority-20261021/` and the current committed version was
restored. This restores the shared `calculateTaxLine` export, VAT-inclusive
pricing, penny rounding and price-basis evidence without a new calculation
implementation. The main Replit workspace now passes the API typecheck/build,
all 14 accounting-flow cases and all 16 invoice integration cases. The normal
API workflow was restarted on its configured port **8080**, replacing the
temporary process. A fresh signed-in preview load confirmed the existing
synthetic invoice still shows £60 original, £10 credit and £50 due.

A subsequent Replit workspace restart left the fixed `/tmp/ledgerly-w03-invoice-demo`
database directory missing and the API offline. No demo database backup was found
in the workspace. The repaired source remains intact; the successful build and
preview checks above precede that restart. Existing records were not recreated
or replaced. Demo recovery or explicit recreation in persistent storage is
required before the current preview can run again.
