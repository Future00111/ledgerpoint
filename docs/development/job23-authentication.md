# Job23 — authentication preparation; real-auth acceptance pending

Base: 7889d4ff92c7887f543bcf1b230155d3bfe1861b.
Local branch: replit/four-day-job23. No product or authentication configuration
changed. No demo services or databases accessed. No account/session created,
revoked or impersonated. No credentials read or copied.

## Concrete blocker

The platform's read-only Clerk management check reports managed Clerk and
authorized dashboard access. This does NOT supply a test login or authorize
browser access to the previously excluded preview origin.
There is no separate approved full-application browser origin for this candidate.
The owner's standing restriction forbids browser/iframe access to the existing
preview; this assignment also forbids modifying that live demo. Existing workflow
failure notifications were not treated as permission to restart it.
Do not claim Clerk is misconfigured or credentials invalid: neither was tested.

Smallest next setup decision: authorize a separate disposable full-app test origin
and Clerk development test session (or an owner-driven login there). Do not
remove the restriction on the existing demo implicitly. No broader permissions,
new provider or production settings are needed or requested.

## Source-grounded preparation

- artifacts/ledgerly/src/App.jsx: actual ClerkProvider, SignIn/SignUp, host-derived
  publishable key and optional VITE_CLERK_PROXY_URL; use the real App, not browser-fixture.
- artifacts/ledgerly/src/lib/AuthContext.jsx: useUser/useClerk; signOut redirects.
- artifacts/ledgerly/src/lib/useCompany.jsx: account-scoped selection; clears visible
  companies on identity change; versioned responses reject previous actors;
  switchCompany only admits a company in the authorized list.
- artifacts/api-server/src/app.ts: actual Clerk middleware and proxy, known-origin
  credentialed CORS, protected routes. Do NOT use beforeClerkMiddleware.
- artifacts/api-server/src/middlewares/requireAuth.ts: requires Clerk identity;
  companyScope and operation-specific policies provide separate authorization.
- artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts: /api/__clerk.
  Origin/proxy transport must be verified, not assumed to work on any loopback port.

## Reproducible next setup, after explicit test-origin authorization

1. Preserve this candidate; create a separate clean checkout. Provision ONLY a
   new private synthetic PostgreSQL cluster with the reviewed schema installer,
   restricted runtime role, and identity checks. Do not point it to any demo or
   ambient DATABASE_URL. No demo launcher or old database restoration.
2. Use approved development Clerk settings through secret injection, never copied
   into files/logs. Confirm the separate origin and /api/__clerk proxy work.
   Do not widen CORS globally, substitute auth headers, or alter provider settings.
3. Build API: pnpm --filter @workspace/api-server run build. Run its start script
   with explicitly isolated database/runtime settings and autonomous jobs off.
   Do NOT invoke its dev script blindly: it calls persistent-demo.mjs.
   Start full frontend using pnpm --filter @workspace/ledgerly run dev on a
   separate unused port with the approved origin/API routing.
4. Use actual development Clerk test identities, then bind their verified subject
   IDs to fresh synthetic company memberships only. Two companies and three roles:
   owner, read_only and inactive; never grant memberships in existing companies.
5. Capture source/tree, database identity, origin and non-secret runtime receipts.
   Browser context and owned disposable services must be cleaned up afterward.

## Acceptance checklist (NOT executed here)

- Actual sign-in component/login, reload, sign-out and new anonymous navigation.
  Programmatic Clerk test login alone does not prove interactive sign-in UI.
- Session expiry/revocation of the disposable test session: no old financial
  values shown as current; subsequent protected reads/writes/downloads denied.
  Do not shorten the global Clerk session lifetime.
- Switch A/B and reload; outstanding requests from A must not populate B;
  account switch must not restore the prior actor's company.
- Revoke only the synthetic membership while open: subsequent actions denied,
  old write review cannot post; refresh company list removes access.
- read_only can use authorized read surfaces but cannot draft/post/pay/correct;
  direct requests must enforce the same rule.
- Own-company source download follows its actual capability policy. Anonymous,
  inactive, foreign-company and revoked access must fail without file bytes.
  Do not assume every read_only download is forbidden.
- Retain failed responses, exact status/capability and native records; assert no
  financial write on denied requests. No real business data.

## Independent evidence completed

`node tools/development/check-company-access.mjs`: 37 tests passed, zero failures
or skips. Existing companyScope, companyPolicy, roles, companyRoutes and
companySelection tests cover revocation recheck, inactive/ambiguous membership,
role/owner policy and forged/account-scoped saved selection.
Runner sanitizes child environment, uses an unusable loopback DB target and removes
owned compiler scratch. These are pure/injected-lookup tests, NOT Clerk or database
acceptance. Earlier Job22 native PostgreSQL receipts remain separate evidence.

No full build or broad PostgreSQL rerun was needed: no application source changed.
Real sign-in/out, expiry, full-shell switching and browser download denial remain
pending. Job23 is prepared/blocked, not accepted. Independent Job24 may proceed.
