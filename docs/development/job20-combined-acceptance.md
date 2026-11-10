# Job 20 — combined development acceptance and export

Incremental base: 7138fa296856d5ddf63629074d6884ae8be92c46.
Full-chain base: 6ebee0fd204b1d9434fd349f6d0c850d57a3e0bc.
Branch: replit/four-day-job20.
Exact executable tested: 8214e561729d5707b82ff5450ba9f56cbae5caf0.
Final delivery adds this record only; it is not independent review or release.

## Combined verification

| Check | Result |
|---|---|
| Current source, UI, scheduler and statutory specification checks | 919 passed, zero failures/skips |
| Migration registry checks | 31 passed |
| Full application build/typecheck | Passed; existing bundle-size warning retained |
| Fresh disposable PostgreSQL acceptance | 308 passed, zero failures/skips |
| Populated restore | 47 tables, 14,538 rows reconciled |
| Encrypted application recovery | Passed; restricted runtime acceptance retained |
| Main and encrypted restore clusters | Stopped, directories removed |
| Separate native browser fixture | API and PostgreSQL stopped, directory removed |

Commands use the established sanitized environment:
`node tools/development/check.mjs`,
`node --test tools/development/migrations/registry.test.mjs`,
`PORT=5179 BASE_PATH=/ pnpm run build`,
`node tools/accounting-flow/test.mjs`.
Logs, source-bound receipts and original failure evidence are preserved in
job20-evidence and the immutable previous exports. Earlier source-specific
results are not silently relabelled as this candidate's tests.

## Actual native browser acceptance

Added an explicitly test-only fixture using the real current
AccountingDocumentForm, Payments, AccountingJournal and AccountingReports,
native API clients and protected native routes against a fresh private database.
No financial response is mocked. Only company selection and test authentication
are substituted; the application shell and styles are not rendered.

The browser test was limited to localhost:58972. No Replit preview/iframe or
external site was opened. It created exactly one ordinary invoice and one
allocated receipt through the customer-facing components:

- JOB20-BROWSER-001, draft UUID f89f63e8-a118-4557-8293-af55e4150df1:
  quantity1 × £100 excluding VAT, £20 VAT, £120 gross; saved and reloaded.
- Explicit in-app posting review created journal
  39c49be7-4237-4eae-8a0f-a02c6d6609f6:
  receivables debit120, revenue credit100, output VAT credit20.
- Explicit payment review/confirmation created event
  61a5edb7-f500-431b-86d2-75afcbf20102, journal
  eee44c14-0404-4270-a6e3-ebdeab5dbedb:
  bank debit120, receivables credit120.
- An initially uncertain payment outcome was resolved by the normal status
  check. The browser did not submit a second payment or change its identity.
- Reports: outstanding0, bank120, revenue/profit100, output/net VAT20.
  Closing snapshot contains exactly five journal lines, movement debit240 and
  credit240, and zero open balance. The native report is retained separately.
- Frontend API responses: 34, all200/201; no page/console errors.
  Anonymous API request returned401. Browser context closed.

This is AI-assisted native functional acceptance with synthetic identity,
not Clerk, independent-human/accountant approval, full-app styling or
whole-product browser coverage. Screenshots are referenced in the tester report;
the ZIP includes its report/metadata, not copies of the hosted screenshot images.

## Coverage and remaining requirements

| Work | Current evidence | Not established |
|---|---|---|
| Compensation/correction/replacement lifecycle inherited through Jobs1–13 and16 | Combined native tests and restored persistent history | Independent acceptance; public conditional posting stays gated |
| Job17 recovery | Native restart tests, current recovery checks, retained two-tab evidence, new browser outcome recovery | Real Clerk/revocation browser matrix |
| Job18 empty-company onboarding | Both native VAT/non-VAT journeys and setup UI checks | Full empty-company click-through in the real signed-in app shell |
| Job19 statutory prerequisite | Executable review specification, all130 official examples, real case denial | Qualified payroll engine, professional review, notice/earnings/combined-loan lifecycle |
| Job20 connected browser | Customer invoice/post/payment/journal/reports | Supplier/credit/correction browser matrix, responsive/visual acceptance, full Clerk flow |

No authored work is promoted to independent acceptance by this export. The
supported-case register remains unchanged and unqualified cases stay blocked.
Tax/payroll engines, statutory filing and the remaining 92-requirement product
backlog are not declared delivered. Historical queue files in the source archive
are context only: NEVER overwrite the authoritative queue or coordinator lease.

## Reproduce safely

Prerequisites: existing project dependencies and installed PostgreSQL binaries,
normal unprivileged development user. No installation or credentials are needed.
The new browser lifecycle command is:
`env -i PATH="$PATH" HOME="<isolated home>" LANG=C LC_ALL=C pnpm_config_verify_deps_before_run=false node tools/accounting-flow/browser-test.mjs`.

It creates only its own /tmp/ledgerly-job20-browser-* cluster, verifies the
private DB identity before schema installation, retains ledgerly_api restrictions,
uses no ambient DB credentials and enables no jobs or providers. Test API auth
requires the fixed synthetic header, and the bundle rejects external fetches.
The fixture seeds setup only, not posted documents/journals.

The output is ../job20-evidence/browser relative to the isolated source. It refuses
to overwrite prior fixture/cleanup evidence. Use a separate clean checkout and
fresh sibling evidence directory for a later run, never delete this evidence.
Creating that output directory's STOP marker closes the API, saves its final
report and removes only its owned disposable cluster; a15-minute deadline also
closes it. Main accounting tests use a separate socket/port and do not reuse it.

## Export

The consolidated review ZIP contains tracked complete source, incremental and
full-chain binary patches, a Git bundle from the shared base, source/file hashes,
current receipts/browser report, prior manifest index and frozen-export checksums.
Patch reconstruction and bundle prerequisites are verified. Prior exports remain
byte-identical. RESUME identifies exact final commit/tree and pending acceptance.

No live demo, original database, existing grants, startup pointer, integration/main branch,
providers, authoritative queue/lease, push, merge, deployment or filing changed.
The isolated branch is clean and local only. The technical handoff is ready for
independent review; full release acceptance remains pending.
