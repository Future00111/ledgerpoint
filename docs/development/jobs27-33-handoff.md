# Jobs27–33 — candidate handoff, not launch approval

Original batch base: `e45b38b3bd6c354723de593c9935ed186d81e221`.
Original cumulative prerequisite: `2212b74816f2f4d9913bb611a58668a8ae5c5094`.
Branch: `replit/candidate-jobs27-33`. Final head/tree are bound by the external
manifest and RESUME; earlier frozen exports and the full chain are preserved.
No authoritative queue, coordinator lease, parent requirement or live demo changed.

## Scope, dependency and disposition

These implement the existing banking BL-12, payment BL-09 and regression BL-23
requirements within the original 92-item catalogue, not a replacement backlog.
Per-job patches/manifests enumerate exact paths; only the isolated candidate was edited.

| Job/scenario | Implemented | Verified | Separate review | Remaining work |
|---|---|---|---|---|
|27 accumulated banking defects|Unicode duplicate canonicalization; explicit unkeyable-history hold|Actual PG direct-SQL race, whitespace matrix, null/zero/NaN history; current-role denial|AI reviewer `job27-candidate-review`: FAIL on e45b38b; PASS on fd99e9c fixes|Malformed legacy rows still require explicit history repair; no silent skipping|
|28 recovery interface|Verified outcome closes stale match form before context refresh|Unit test and native browser denied GET, restored access, reload, no second POST|Author verification; prior review identified warning|Real-auth/full-shell acceptance separate|
|29 reviewed match correction|Append-only whole-receipt unmatch, actor/reason/DB effective time, recovery and active capacities|Customer/supplier PG concurrency, rollback, conflict, stale review, isolation, immutability; native review/cancel/confirm/lost-response recovery|Contract reviewed by AI; implementation needs independent final review|No bank-to-ledger reassignment or partial editing of an individual receipt|
|30 reversal after correction|Existing reversal guard counts active matches only|Active remainder blocks reversal; cash reversal/retry/recovery/historical cash; document debt restored after explicit native unallocation; browser reversal and one journal|Author tests; final independent review pending|All existing allocation/refund/period guards remain|
|31 existing posted refunds|Match refund event's own verified journal, opposite direction, GBP only|Both sides PG; partial/capacity/direction/retry; browser £40+£20 matching to one £60 refund with lost response|Author tests; final independent review pending|No fees, FX, transfers or reversal-event matching|
|32 real sign-in/full app|Preparation preserved, no auth changes|Fresh management status: managed Clerk, dashboard access authorized; not a test login|Blocked, not accepted|Approved separate full-app origin and authorized Clerk test session needed|
|33 consolidated acceptance/export|Source/history, patches, manifests, migration/setup order, evidence and resume|961 source/UI,31 migration,326 PG; build/typecheck; populated/encrypted restore|This is author consolidation, not independent sign-off|Codex independent review and controlled integration tomorrow|

## Contracts and file boundaries

27 extends import service/SQL authority, registry/installer and regression tests.
New `bank-import-canonical-history.review.sql` preserves prior migrations, wraps
the old reviewed command privately, aligns SQL normalization with ECMAScript trim,
and fails closed on unkeyable legacy history. Ordinary API receives an actionable
409; no history is erased. Reviewer identity and full reports are retained.

28 touches only native bank-statement component/model/test. Pending state is not
discarded on denied/unknown lookup. Only a verified receipt closes a stale form
and reloads context; this callback submits no operation.

29 adds `bankCorrections.ts`, native routes, correction UI/model/API/tests and
`bank-match-corrections.review.sql`. A match means the existing composite
`(company_id,request_id)` receipt. Correcting a £70 receipt releases exactly £70,
not all other matches of its payment. Correction records have their own request
identity and a unique target-receipt constraint. Current authority and company
locking precede canonical-intent replay. Reviews bind current capacities and
evidence; different correction requests for a corrected receipt conflict.
Original evidence is immutable; a shared active-match view drives capacities and
the reversal guard. Actor comes from auth; effective time comes from the database.
No backdating, amount editing, cash movement or journal deletion is provided.

**Explicit conservative decision:** correction releases matched capacity only.
Historical bank-to-ledger assignment still uses all original receipts/openings.
It is not filtered to active matches. Reassignment is separately unsupported,
because implicitly releasing it could change historical cash classification.

30 changes the existing payment reversal guard to the same active-match view,
plus tests/guidance. It does not rebuild payment, allocation or refund engines.
An allocated payment still needs explicit native unallocation before reversal.
Tests prove invoice/bill outstanding returns to £120 and cash to £0 without
relaxing that guard. A payment with refunds retains its original restrictions.

31 extends native payment matching projections to posted `refund` events with
their own journal/effect/source hash, event kind and cash direction verified.
The original payment's journal is not substituted. Frontend eligibility uses
server direction and advertises refund support only when explicitly returned.
Fee-posting rules or external feeds were not introduced.

## Evidence and actual identities

- Job27 code/fix review: `fd99e9ca28878c3c43274ec79839b5d39b04c883`.
- Job28 code: `ff13023` (full identities in manifest).
- Job29 code: `336c602`; Job30 guard: `bb242d6`; Job31 code: `fab75fd`.
- Combined source/UI/migration/build/typecheck source:
  `6049b7dc5425b17846a0058ccaa95f6aa7805082`.
- Final PG/restore source:
  `98bf40e05da4f9af01cd2a83e5182f05bce7ea1a`.
  Later changes from the combined build affect only regression fixtures/docs,
  not the application runtime. Exact provenance is not flattened into a false
  claim that every check ran after the final documentation commit.
- Restore: 53 tables / 15,367 rows, equal fingerprints, encrypted separate-cluster
  recovery. Native receipts checked before/after: opening, import, match,
  correction, refund match and reversal following corrected matches.
- Existing queue/scheduler-owner and concurrent claim regressions are included
  in the source runner. No autonomous workers were enabled.

The additional outstanding-balance test initially used £100 *including* VAT
while trying to allocate £120. The existing guard correctly rejected it.
The fixture now explicitly creates/asserts £120 gross. Failed logs/cleanup
remain retained; expectations and financial guards were not weakened.

## Browser evidence, kept separate from authentication acceptance

The loopback fixture uses actual native components/services and fresh PostgreSQL,
but injected synthetic identity and a limited shell. It is not Clerk, a customer
deployment, an accountant sign-off, or public/HMRC qualification.

First fixture: import £120, partial match £70, commit then simulated response loss,
synthetic denied lookup after reload, remaining-£50 review blocked, real recovery
closes stale form. Cancelled unmatch review preserves the receipt; confirmation
then response loss/reload recovers one correction. History retains actor/reason/
time and original journal. Next, the existing Payments UI posts one balanced
£120 reversal and recovers its lost response. Four journal lines total; cash £0.
The £120 statement stays unmatched intentionally: no reversal statement is
invented or imported automatically.

Second fresh fixture (first already cleaned): native refund £60 from a £120
receipt; refund journal debits customer credit and credits bank £60. Imported
£60 outflow matches that refund in £40 and £20 parts, recovering the final lost
response without duplication. Two journals/four lines, cash £60. This verifies
the supplied refund line, not a complete bank statement containing the original
£120 deposit. No full-statement balance reconciliation is falsely claimed.

Known remaining UI observations:
- Revisiting Payments may show a stale “outcome not yet confirmed” banner for
  a recorded operation; native status check clears it, with no duplicate write.
  This is distinct from the bank-match warning fixed in28; resolve/verify it
  before release rather than relabelling it accepted.
- The journal's `/reports?tab=gl` link had no route in the limited test fixture;
  `/accounting/reports` worked. Full-app navigation remains a Job32 acceptance
  check, not a confirmed production routing defect.

## Reproducible isolated setup and migration order

Use the existing installed toolchain/dependencies. Never run the app's demo dev
launcher or supply ambient DATABASE_URL to these commands.

```sh
node tools/development/check.mjs
node --test tools/development/migrations/registry.test.mjs
PORT=5179 BASE_PATH=/ pnpm run build
pnpm --filter @workspace/api-server run typecheck
env -i PATH="$PATH" HOME="/home/runner/workspace/.local/share/ledgerly/four-day-20261105/home" LANG=C LC_ALL=C pnpm_config_verify_deps_before_run=false node tools/accounting-flow/test.mjs
```

Run the long disposable runner in a background shell, preserving its complete
logs and cleanup/restore receipts. It owns its fresh socket/database and removes
them. Never reuse a demo DB or bypass its identity checks.

Authoritative migration order is the exported registry. This batch appends:
`bank-import-review-authority` → `bank-import-canonical-history` →
`bank-match-corrections`, with all earlier dependencies intact. Use the existing
fresh-schema installer; no manual grants or existing-database migration here.
Browser launch copies only change the schema import to an absolute local path
and evidence directory; both copies are exported and refuse evidence reuse.

## Codex tomorrow — exact next actions, no new work queue

1. Verify archive SHA256SUMS, final head/tree, full bundle, per-job chronology and
   original/cumulative bases. Preserve frozen exports and the 92-item catalogue.
2. Independently review the new correction/reversal/refund paths and migration
   permissions, including retained bank assignment, semantic replay, active-match
   concurrency and historic reports. AI Job27 fix approval does not cover all
   new implementation or replace human/accountant review.
3. Establish only the missing authorized Job32 origin/session; follow the
   existing real-auth preparation. Verify full-shell navigation, company switch,
   expiry and denied access, and the payment-outcome banner. No auth bypass.
4. Prepare controlled integration only after that review and explicit applicable
   authorization. This export does not authorize push, merge, live migration,
   demo refresh, deployment, provider connection, HMRC filing or real data.

All owned disposable resources are stopped/removed. No next batch starts here.
