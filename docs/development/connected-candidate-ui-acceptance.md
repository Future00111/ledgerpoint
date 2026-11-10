# Job 6 — connected candidate UI reliability

Parent scope: P01-03/P01-04 candidate lifecycle and P03-01 recovery.
Base: c66dfc75a77930bfa7b2848e8761cd7a37c9f294 (Job 5).
Depends on the UNREVIEWED compensation/Jobs 1–5 candidate chain.
Shared source remained 6ebee0fd204b1d9434fd349f6d0c850d57a3e0bc;
coordinator revision 268 was read only. No lease or acceptance claimed.

## Implemented

- Definitively rejected correction POSTs clear their URL recovery locator and
  stale context before offering a fresh context read. If locator cleanup fails,
  remain fenced as unknown rather than permitting another operation.
- Correction review rejects substituted line quantities/prices even when
  request identity, reason and date match.
- Successful correction UI waits for Close, clears the locator, then refreshes
  the parent once. It no longer refreshes/remounts with an active recovery URL.
- Company changes create a separate compensation review session; old selections,
  request, review and recovery result cannot leak into another company.
  Aborted context responses cannot populate the new session.
- Correction guidance now distinguishes supported ordinary credits within
  remaining line capacity from unavailable conditional replacement terms,
  corrected-bill return tracking and correction after linked credits.

No server financial writer, allocation/refund engine, schema, grant, authentication
mechanism or public conditional execution gate changed.

## Executable connected acceptance

The existing disposable runner hosts real native routes on loopback with an
explicit synthetic identity header. The new browser harness mounts the actual
DocumentCorrections component and native accounting client. No demo origin,
iframe, shared database, real Clerk session or external provider is used.

For both sales invoice and purchase bill:

1. Native original £100 + £20 VAT = £120.
2. Review £90 + £18 VAT = £108; confirmation requires acknowledgement.
3. Editing a reviewed input removes the reviewed result; Close/reopen does not
   revive it.
4. A stale revision and a denied actor at commit return native rejection:
   locator removed, stale form removed, fresh context required.
5. Explicitly confirm once, let the native server commit, discard the response.
   Unknown offers no fresh post or dismissal.
6. Actually reload the browser URL; recover the same receipt read-only.
   Close clears locator and refreshes exactly once.
7. Switch the same mounted component to a foreign company; no prior form,
   amounts or commit control survive. Read-only role can see history but cannot
   review/post.
8. Database checks prove exactly one amendment/journal/effect, original
   source/money/revision/journal unchanged, foreign company unchanged and
   balanced reports. This is a real synthetic commit, not mocked accounting.

Existing compensation browser coverage was extended to company switch/read-only
state; review, cash reversal review, changed-input invalidation, cancel and unknown
lookup retain no-write public behavior. Both public rejection gates remain closed.
Existing server revocation/race/replay/cross-company tests remain in the runner.
The compensation company-switch response alone is a synthetic client fixture;
native compensation review/recovery uses real routes.

## Evidence and provenance

Final executable source: 9b80f2825bd4ef17f19e821ef5251f1ebd8f1527.
277/277 disposable runner cases, zero failures/skips. Run
002f1f9e-14a5-4a25-b734-7aa809e7d738, started 2026-11-06T15:20:20.540Z.
Restore: 44 tables, 12479 rows, fingerprint
e5b50376e93eb69d8a3730a252de32fc5c34dd04ae6cb78f16a2fac8c8c30c71
matched; separate encrypted recovery and cleanup passed.

853/853 current-source tests passed on the same product code (before the final
test-only assertion scoping fix). Final full build/typecheck passed on 9b80f28.
The initial full build omitted required mockup PORT/BASE_PATH; rerun supplied
PORT=5179 BASE_PATH=/ without changing configuration. Vite chunk advisory remains.

First exploratory runner failed a harness assertion that searched body text,
including inline JavaScript. Final assertions search rendered root text.
The first run overlapped a later compensation test edit and is NOT exact-head
acceptance; its failure log and successful cleanup receipt are retained.
Final run was clean, fixed-source, with no concurrent source changes.

Commands, from isolated source, using existing dependencies:

```sh
env -i PATH="$PATH" HOME="/home/runner/workspace/.local/share/ledgerly/four-day-20261105/home" LANG=C LC_ALL=C pnpm_config_verify_deps_before_run=false node tools/accounting-flow/test.mjs
env -i PATH="$PATH" HOME="/home/runner/workspace/.local/share/ledgerly/four-day-20261105/home" LANG=C LC_ALL=C pnpm_config_verify_deps_before_run=false node tools/development/check.mjs
env -i PATH="$PATH" HOME="/home/runner/workspace/.local/share/ledgerly/four-day-20261105/home" LANG=C LC_ALL=C PORT=5179 BASE_PATH=/ pnpm_config_verify_deps_before_run=false pnpm run build
```

## Still pending

Independent integration review and real Clerk/customer acceptance are not supplied
by these local tests. This is not exhaustive browser acceptance of the whole
product, financial qualification, launch approval or public conditional activation.
Recovery still needs the retained URL/request locator; otherwise consult history.
Job 3 replacement terms remain unimplemented despite approved policy. Jobs 7–8
remain the existing next backlog, not a new queue. No unattended continuation.
