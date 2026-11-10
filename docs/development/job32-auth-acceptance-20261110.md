# Job32 isolated authentication acceptance — 2026-11-10

## Result and scope

The automated development authentication checks passed after two narrowly scoped
frontend repairs. This is AI-assisted browser evidence using real development
Clerk sessions and the actual full application/API, not independent human,
accountant, production, financial-posting or statutory acceptance.

Preserved baseline: `bfa37c454c99b3dcd9fe871139c9c4e025abb5a3`.
Tested product head: `5685b8c` on `replit/job32-auth-preparation`.
Only the separately approved `/job32-auth/` path and official Clerk transport
were used. Sign-in used the supported programmatic Clerk helper: entering
passwords, verification codes or completing an interactive SSO form was not tested.

## Passed checks

- Real Clerk session: protected companies request succeeds; anonymous requests
  fail with 401. No test identity headers or authentication bypass middleware.
- A/B company selection and reload; each company displays its own customer.
- Hold a genuine authorized A response, switch to B, release A unchanged:
  B retains only its customer after the repair.
- Read-only C can download its own source but cannot upload, create accounting
  documents, post payments or invoke bank corrections (403 capability denial).
- Foreign source under C and inactive D access return 404 JSON, not file bytes.
- Revoke A while its Clerk session remains valid: subsequent reads, writes and
  download fail with 404; reload removes A/D and displays authorized B/C only.
- A genuinely expired Clerk token, held only in browser memory, fails company
  reads, source downloads and accounting writes with 401; no file bytes returned.
- Sign-out denies protected requests. A second identity without memberships
  sees no companies or prior actor data. Final normal sidebar sign-out stays
  within the approved prefix and its protected companies request returns 401.
- Seven focused Node regressions, frontend typecheck and Vite build pass.

## Repairs and retained failures

Customers now owns its directory/forms in a company-keyed component lifetime.
Previously, a late authorized response for A could replace B's directory.
Authentication navigation respects the configured base path, including the
actual sidebar caller and Clerk fallback redirects. Fixing the shared helper
alone initially missed the sidebar's separate hardcoded-root sign-out.

Failed receipts are retained. Initial inactive-membership 404 and invalid payment
input 422 were test-expectation/input issues, not authorization defects.
An attempted compiled-entry alias caused React/module hosting errors; a clean
canonical build and fresh browser context resolved them. Fixture hashes were
verified across clean test-service restarts. Expiry was subsequently checked
before navigation, because navigating had destroyed the first in-memory token.

## Isolation and cleanup

Only freshly created `ledgerly_job32_auth_test` databases on owned private
`/tmp/ledgerly-job32-auth-*` sockets were used. Four synthetic companies, two
customers and two small synthetic source files exercised the actual APIs.
No financial posting was performed. Canonical journal entries, lines, relations,
conditional-discount journal origins and legacy journal entries all counted zero.
Runtime role has no superuser, createdb, createrole or bypass-RLS attributes.

The temporary API and PostgreSQL instances stopped and their owned clusters were
removed. All four routed cleanup receipts confirm this. The original artifact
configuration was compared for drift and restored; existing services were not
restarted. Development test identity records created by the supported Clerk
helper are not claimed to have been deleted.

Existing demo databases were never accessed. The preserved baseline stayed clean.
No integration/main changes, push, merge, deployment or provider-setting change.
The isolated candidate still needs the existing independent review/integration
process; this evidence does not qualify the banking batch for sale or production.

## Evidence

Retained under `.local/share/ledgerly/job32-auth-20261110/`:
`routed-evidence/`, `routed-v2-evidence/`, `routed-v3-evidence/`,
`routed-v4-evidence/`. These contain per-run source identities, successful and
failed browser receipts, fixture-restoration fingerprints, build/test receipts,
restricted-role/zero-journal readback and cleanup receipts.
The review archive includes these receipts, this report, a binary Git patch and
an exact source/tree/file-hash manifest. It excludes credentials, login URLs,
database dumps, generated bundles and uploaded test-file bytes.
