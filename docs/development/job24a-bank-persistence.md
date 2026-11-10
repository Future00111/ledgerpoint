# Job24A — protected development bank-import persistence

Base: b3ff500596ff0c3dac347433cf39cef26e7f109c.
Branch: replit/four-day-job24a. Isolated copy only.

## Reviewed security contract and implementation

The existing runtime has bank statement SELECT and UPDATE(id), not INSERT.
Generic writes must not supply financial links or reconciliation state. The new
development migration preserves that boundary: ledgerly_api receives EXECUTE
on two explicit functions, not INSERT/UPDATE access to bank rows or receipts.

The function owner is a dedicated non-login, non-superuser, no-create-role,
no-create-database, no-replication, no-bypass-RLS role. The runtime is not a member.
Search path is fixed to pg_catalog and application tables are schema-qualified.
The owner has only table permissions needed for the command and its locks.
The database assumes the restricted API is trusted to pass the authenticated
Clerk subject, as existing native service boundaries do; these functions are not
a replacement authentication provider.

POST /api/companies/:companyId/bank-imports accepts request_id, bank_account_id
and up to500 rows (date, description, reference, money_in, money_out).
Normal Clerk router authentication and company scope precede the SQL command.
SQL independently locks/checks the company, unique active membership and
active GBP bank account in that company. Only existing non-read-only company
write roles may import. Rows cannot include posting status, document links or
arbitrary columns. Exact pennies, bounded dates/text and one positive side are
validated. Rows enter review; no canonical journal is created.

Receipt intent and rows commit together. Same request/actor/bank/normalized rows
returns the original receipt; changed intent conflicts. Distinct request IDs
remain distinct imports: same-value transactions are not automatically deleted.
Company locking serializes duplicate submissions. An invalid late SQL date
rolls back all earlier rows and the receipt.

GET /api/companies/:companyId/bank-imports/:requestId is read-only recovery.
An absent receipt is unknown, not proof of cancellation. Current membership is
checked on recovery and replay. Receipt records reject update/delete/truncate.
Canonical importer values are returned as decimal strings, not JSON floats.

## Migration and verification

Migration is registered by exact SHA in migration-registry.json and used only by
the guarded empty disposable-schema installer. Fresh fixture bank_accounts are
included for identity checks; no grant allows ordinary runtime bank-account
creation. No existing database was migrated.

Native PostgreSQL test covers successful import, identical and parallel retries,
receipt recovery, changed request, unauthenticated/read-only/cross-company denial,
revocation, invalid late-row rollback, absent direct table INSERT permissions and
zero resulting canonical journals.

The first run exposed a JSON numeric/string contract mismatch; the receipt now
formats decimal fields explicitly. A later encrypted separate-cluster restore
failed because the new function-owner role was absent. Recovery now recreates
and validates this third restricted role, rejects login/elevated flags and any
runtime membership. Both failed runs and their cleanup receipts are retained.

## Remaining stages and limitations

This is the persistence stage, not a bank-to-ledger journey. Existing legacy
import callers have not yet been switched; Job24C must connect the native
receipt/recovery path to normal screens and preserve explicit duplicate review.
No matching, posting, reconciliation, opening journal or new AI operation was
added here. Job24B must reuse canonical posting for explicit reviewed opening
balances; Jobs24C,25,26 remain required. Real Clerk browser acceptance remains
pending under the separate origin restriction. Tests use synthetic identity.

No push, merge, deployment, live workflow change, provider connection, real data,
shared queue change or existing-database access occurred.
