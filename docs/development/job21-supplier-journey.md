# Job21 — supplier journey, native acceptance and targeted UI fixes

Base:49bff02e2f69841f4c2dd75020eed68d4b76817e, branch replit/four-day-job21.
Browser/runtime source:3fc902e2b0aaa55ea2b29f7403fc7b9856e96bc3.
Post-fix source/UI/build check source:515997582c09c169d6158fa6aaebaa483d5f2f02.
Final delivery adds this record and an offline receipt verifier.

## Native journey

The existing test-only harness now mounts actual Suppliers, Statements and supplier
credit pages, plus the actual protected native entity router. All financial
requests reach real native services and a newly installed disposable PostgreSQL
database. Company selection/authentication are synthetic, NOT Clerk. The fixture
reuses its internal Job20 names but creates a different private cluster/company
and writes evidence only to job21-evidence. No prior fixture or demo is reused.
This is unstyled component acceptance, not full-app-shell or supplier-creation
acceptance: supplier/company/configuration were seeded setup.

AI browser walkthrough:

| Step | Evidence/result |
|---|---|
| Native supplier page, new bill, save/reload | JOB21-BILL-001,57420e6e-748e-41a3-9584-0cf82995a111;100net/20VAT/120gross |
| Explicit posting | Expense100 + inputVAT20 = payable120 |
| Reviewed correction | Original retained; current120net/24VAT/144gross; delta journal24; reason/effective date retained |
| Partial payment40 | Allocated40; outstanding104 |
| Linked credit | JOB21-CREDIT-001,705e1631-9671-4c6f-81fe-bf9efdfb3863;20net/4VAT/24gross, offset; outstanding80 |
| Payment94 | Allocated80, supplier prepayment14, final bill balance0 |
| Statements and reports | Bank−134, expense100, inputVAT20, payable0, prepayment14 |

Five source-linked balanced journals,14lines; debit/credit movements302/302.
Opening bank was zero, so the negative bank is expected synthetic bookkeeping,
not a bank transfer. Recovery used the same request; no duplicate payment or
correction was submitted. Bill and original/correction journals remain distinct.
The final native report is independently checked by
`node tools/accounting-flow/verify-supplier-browser.mjs ../job21-evidence/browser`.

## Findings and fixes

1. Payment recovery/refresh could leave a form mounted while payment context was
   cleared; its party list then dereferenced null context. The browser retained
   only a CompanyPayments error warning, not the exception stack. Source
   inspection established this concrete crash path, consistent with the symptom.
   The form now waits for refreshed permissions/context without losing its
   request identity; failures expose the existing retry. It never submits.
   Added regression for the pending-context guard.
2. Correction success refreshed the parent only when the editor was closed;
   the parent totals could remain stale. Confirmed posted outcome now closes
   the editor, clears its recovery locator, then refreshes once. Unknown outcomes
   do not trigger this path. The browser saw the original stale behavior; this
   fix has source/build validation, not a second financial browser posting.
3. Statement original/correction rows share a document ID. Both responsive lists
   used that ID as their React key, generating the two retained warnings.
   Keys now include journal identity. Added executable component-element regression
   proving distinct mobile and desktop keys for the same bill.

The initial outcome panel can legitimately be uncertain while an event is
recorded; the read-only status check resolved it. No retry guard was weakened.
Browser report/failure descriptions are retained unchanged. Exact browser HTTP
status logs/exception stacks were not captured, so none are claimed.

## Checks and boundaries

921 source/UI/specification checks passed, zero failures/skips; full build and
typecheck passed (bundle-size warning retained). Native PostgreSQL journey and
offline journal/report assertions passed. Both API/PG processes stopped and the
owned cluster directory was removed. Post-fix browser acceptance remains for
the next supported journey; do not relabel the earlier walkthrough as post-fix.
No backend financial/migration change: the Job20 disposable/restore evidence
remains source-specific; the next combined run belongs to Job26.

Jobs22–26 remain: broader customer/supplier credit/correction recovery matrix,
real Clerk where authorised, opening balances/bank reconciliation, adversarial
review and final combined validation/export. Unsupported flows and statutory
qualification remain gated. No independent or launch acceptance is claimed.

Prior exports/branches unchanged. No existing DB, live demo, queue/lease,
provider, push, merge, public activation, deployment or filing was touched.
Incremental ZIP includes exact source identities, patch/bundle, browser report
and native report, cleanup, checks and RESUME. Screenshot IDs are retained;
hosted screenshot image bytes are not embedded in the ZIP.
