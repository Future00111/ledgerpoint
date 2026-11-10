# Job 17 — native restart and concurrent reference acceptance

Base: 33c4004503f11af16d6edb87d3875588e37b1e70.
Branch: replit/four-day-job17-native.
Native/build tested source: 535fb83d26ec8153da6d64e276dd49e04b604d44.
Source/registry checks: 80035359669378d4f82c9f7207fd2bd495c48811;
the later executable delta changes only the restart test's response typing and
expected non-member status, not production behavior.

## Native restart evidence

For customer and supplier payments, a separate Node API process uses the real
native accounting router and restricted ledgerly_api role against the existing
runner's newly created disposable PostgreSQL cluster. It deliberately destroys
the successful HTTP response only after the native command has committed.
The caller observes a lost reply, while SQL confirms one event/journal identity.

That API process is stopped and a different PID starts a new API/pool against
the same disposable database. A read-only member recovers the exact original
event and journal over HTTP. Anonymous access is rejected; non-member access
returns the native privacy-preserving 404. Foreign-company and absent references
remain unknown. Event/journal counts are unchanged by recovery.

Authentication is the explicitly synthetic test-actor boundary, not Clerk.
The subprocess requires the runner-owned private socket, exact disposable DB URL,
test mode and verified database/user/socket identity before serving. It is not
imported by the production app. Every child is stopped in finally.

## Concurrent tab fix and evidence

One mutable company slot could lose an identity if two tabs both passed the
empty-slot check. Locators now use independent per-event keys. URL references
remain company-scoped and legacy single-reference keys stay readable until
confirmed. Confirming one event deletes only that event's locator.

The controller surfaces any other retained unresolved reference before allowing
another payment. No financial command, amount or review token is reconstructed.
The deterministic test interleaves actual remember calls so both pass the initial
check; both references survive and can be individually confirmed.

An isolated two-tab browser pass on actual Payments.jsx, with seeded locators and
mock HTTP/company hooks, verified each tab's own reference, selective clearing,
the remaining unknown outcome, denial, reload and company switching. It proves
frontend behavior, not simultaneous storage writes or real Clerk/network behavior.
The deterministic race test and native HTTP restart test supply those separate
pieces of evidence. No claim that the browser itself exercised the native DB.

## Final checks

- 17 focused controller/locator tests.
- 893/893 source/UI/scheduler tests; 31/31 migration registry checks.
- Full build/typecheck passed.
- 305/305 fresh disposable-suite tests, zero failures/skips.
- Populated restore: 46 tables, 14,392 rows; encrypted recovery passed.
- Both disposable clusters stopped/directories removed; browser context and
  temporary frontend fixture stopped.

The first native run expected 403 instead of the existing non-member 404; the
build also caught an untyped response in the new test. Both were test defects,
not permission changes. Original failure logs and successful cleanup are retained.

The identified Job17 recovery gaps are now implemented and development-tested.
Real Clerk end-to-end acceptance and cross-feature integrated acceptance still
belong to Job20; this is not independent-human, production or launch qualification.
Job18 empty-company onboarding is next in the owner's sequence.

No live demo, existing DB, schema/grant, provider, queue/lease, public conditional
posting, push, merge or deployment changes. Earlier candidates and exports remain
unchanged. Evidence is in sibling job17-native-evidence.
