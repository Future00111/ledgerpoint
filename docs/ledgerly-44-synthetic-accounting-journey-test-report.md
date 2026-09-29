# Synthetic accounting journey: isolation and test result

**Snapshot:** 2026-09-29. **Complete end-to-end journey: NOT RUN / BLOCKED.**
No company, invoice, approval, payment, journal, report or fixture was
created in any database. No production/HeliumDB/existing-tenant data, real
payment, external message or schema push was touched.

## First functional break in the requested journey

1. Company creation is implemented at
   `artifacts/api-server/src/routes/companies.ts` (POST company plus owner
   membership). The invoice form creates a `SalesInvoice` via generic,
   company-scoped entity CRUD (`src/pages/InvoiceForm.jsx:118-150`).
2. **First missing accounting dependency:** immediately after invoice save,
   that form invokes `generateSalesInvoiceJournals`, but no matching backend
   function is implemented. The form catches and logs the failure, then
   navigates onward (`InvoiceForm.jsx:152-154`). The later
   `postSalesInvoice` route verifies company/write access and only changes
   `salesInvoices.status` to `posted`; it does **not** call canonical posting
   or create journal entries
   (`artifacts/api-server/src/routes/functions.ts:590-613`). Thus a green
   invoice/approval UI path could falsely suggest accounting was posted.
3. `updatePaymentStatus` updates amount paid, balance and status under a
   document row lock, not ledger entries (`functions.ts:225-291`).
   `artifacts/api-server/src/services/accounting/canonicalPosting.ts` has
   real guarded posting code, but this journey is not wired to it.
4. `artifacts/ledgerly/src/pages/Reports.jsx:32-50` loads **legacy**
   `JournalEntry` entities and calls
   `artifacts/ledgerly/src/lib/reportCalculations.js:18-47`; it does not
   query canonical journal tables. A canonical service-level posting would
   therefore not complete the requested invoice-to-report journey either.

Implementing this connection needs an independently reviewed accounting
write path with company authority, source snapshots/revisions, balanced
lines, account/period checks, idempotency and the frozen canonical controls;
do not turn a status update into a silent ledger write or bypass the
protected source-freshness boundary.

## Isolation preflight, not a database qualification

The historical TI-03 report says Replit Docker container-local `exec`
previously failed. On this date a **new throwaway container, without starting
PostgreSQL**, was launched from an already-local image with
`--network none`, `--read-only`, no published ports and a temporary `/tmp`;
inspection returned `NetworkMode=none` and `{}` ports, and `docker exec`
successfully ran a harmless command. It was removed on shell exit.
This updates only a narrow container-exec observation. It does **not** prove
fresh PostgreSQL provisioning, protected-run identity, a distinct postgres
administrator and `ledgerly_api` test role, schema/RS-01 guards, empty
baseline, nonce binding, safe external routing, concurrency or cleanup
evidence. The normal local disposable runner can snapshot the shared
development database; it was deliberately **not run**.

An actual isolated journey would require the complete approved fresh
disposable PostgreSQL setup with verified new database/roles, no inherited
`DATABASE_URL` or production route, blocked external traffic, all source
and run bindings, guard/ACL checks and guaranteed cleanup. Candidate TI-03
qualification also requires the separately authorised protected GitHub run.
Even if that infrastructure is available, the missing approval-to-ledger
and ledger-to-report integrations above still prevent an honest complete
business journey.

## What actually ran (no DB or external network)

On workspace `audit/replit-2026-09-25` at `bf81705a359f25be290f5146cf4f15cfd016b7a3`,
not on immutable C2:

| Command / check | Result | Scope |
| --- | --- | --- |
| `pnpm --filter @workspace/api-server run test:matcher` | 10 passed | Pure matching/allocation scenarios |
| `pnpm --filter @workspace/api-server run test:collections` | 3 passed | Pure overdue/paid invoice analysis |
| `pnpm --filter @workspace/api-server run test:vat` | 25 passed | Pure VAT policy scenarios |
| Inline `calculateReport` synthetic legacy journal fixture | passed | P&L net £100; trial balance debit=credit=£200; in-memory only |
| Draft C2 identity-status tests | 15 passed | Mocked GitHub API/status contract, separately documented in `docs/ledgerly-44-tr-01-c2-status-readiness.md` |

The report fixture supplied journal rows **directly** to a pure function; it
did not derive them from a company/invoice/payment API or canonical posting.
None of these checks is an end-to-end journey, database-backed canonical
posting result, accepted TI-03 evidence or a production release signal.

**Resume gate:** first design and review the invoice/approval-to-canonical
and canonical-to-report boundaries, then establish the full disposable test
context. Only then execute a synthetic end-to-end scenario, inspect ledger
and report effects, and prove cleanup without weakening roles or triggers.