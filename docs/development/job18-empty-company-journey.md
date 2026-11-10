# Job 18 — empty-company first accounting journey

Base: ee819fe0e4f0f6a35cfb24178f9d4cbc4714bcad.
Branch: replit/four-day-job18.
Native/registry/final API typecheck source:
2b0214102b4c2741266411345adf40ce774358f2.
Source checks/full app build:
36b969aeb1a758172f2a3384d527c9eaf0ea761d.
The later delta only changes test assertions, audit privilege acceptance and the
fresh disposable installer; application runtime sources are unchanged.

## Implemented and exercised

Normal Business setup now explains the separate payment configuration step,
links directly to Payments and Reports, and explains posting, allocation and the
absence of actual bank movement. No accounts are guessed or preselected.
Existing document-state explanations, native forms and financial engines remain.

Two fresh companies are created through the real company-management router,
not seeded via SQL. Their initial accounts, contacts, periods and tax rules are
asserted empty. The actual onboarding readiness model consumes native contexts.

For Standard invoice-basis VAT and non-VAT:

1. Explicit GB/GBP/VAT profile; native company list returns owner membership.
2. Real owner membership route adds a synthetic read-only member.
3. Native chart API creates each explicitly chosen account; native configuration
   and period APIs save accrual mappings and an open 2026 period.
4. Existing native VAT service creates explicit effective rules with audit.
   Dates before the rule and future rules are excluded from usable choices.
5. Real generic contact routes create a customer and supplier, company scoped.
6. Native document APIs save and reopen an invoice and bill, including manual
   due date and selected tax code. Draft reports have no ledger/open items.
7. Reopened source is posted with revision protection. Actual source-linked
   journals balance; posted editing and read-only posting are denied.
8. Missing payment setup returns exactly PAYMENT_SETUP_REQUIRED/422.
   Explicit, separate bank/customer-credit/supplier-prepayment mappings enable
   native review, recording, same-ID replay and persisted outcome recovery.
9. Reports reconcile, and a read-only member obtains the same final report.
   Foreign membership is denied and anonymous company creation is rejected.

| Final result | Standard VAT | Non-VAT |
|---|---:|---:|
| Invoice net / VAT / gross | £100 / £20 / £120 | £120 / £0 / £120 |
| Bill net / VAT / gross | £50 / £10 / £60 | £60 / £0 / £60 |
| Receipt / supplier payment | £120 / £60 | £120 / £60 |
| Outstanding | £0 | £0 |
| Profit | £50 | £60 |
| Journal lines | 10 | 8 |
| Movement debits / credits | £360 / £360 | £360 / £360 |
| VAT boxes 1 / 4 / 5 | £20 / £10 / £10 | Not applicable |

## Defect found and scope of fix

The first run failed because the fresh disposable installer selected tax rules
but omitted their existing vat_return_audits dependency. Previously seeded tax
rules never exercised that native audit write. The installer now includes the
existing Drizzle table and grants only SELECT/INSERT, explicitly denying
UPDATE/DELETE/TRUNCATE. Acceptance confirms four attributed setup audit rows and
denied mutation privileges. No application schema definition was added, and no
existing database or role was changed.

The failed log and successful failed-run cleanup are retained. A recovery
assertion was also corrected to the existing `recorded` response contract before
the second run. No financial rejection or public conditional-posting gate changed.

## Evidence and limits

- 894 source/UI/scheduler tests passed, including the new setup guidance render.
- 31 migration-registry checks passed.
- Full application build/typecheck passed; final API typecheck passed.
- 308 disposable tests passed, zero failures/skips.
- Populated restore: 47 tables / 14,529 rows. Encrypted recovery passed.
- Both disposable clusters stopped and directories removed. HTTP helpers closed.
- Logs and receipts: sibling job18-evidence.

Commands use the established sanitized environment and existing tools:
`node tools/development/check.mjs`,
`node --test tools/development/migrations/registry.test.mjs`,
`PORT=5179 BASE_PATH=/ pnpm run build`,
`pnpm --filter @workspace/api-server typecheck`,
`node tools/accounting-flow/test.mjs`.

Authentication and identity lookup are explicitly synthetic. Tax-rule creation
calls the existing service directly: its HTTP authorization wrapper is NOT
proved by that call. Other operations use the real mounted native routers.
Frontend evidence is current-component rendering and the actual readiness model
on native contexts, not a browser click-through or real Clerk sign-in.
That combined browser/authentication acceptance remains under Job20.
This is not independent-human/professional acceptance or launch qualification.

No live demo, existing data, authoritative queue/lease, providers, public
activation, push, merge or deployment changes. Earlier candidates are retained.
Next in the owner's sequence: Job19's executable statutory prerequisite.
