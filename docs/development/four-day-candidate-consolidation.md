# Job 8 — consolidated candidate verification

This is local candidate evidence, not independent acceptance, integration,
activation, launch qualification or authority to deploy.

## Identities and boundaries

- Reviewed shared source:6ebee0fd204b1d9434fd349f6d0c850d57a3e0bc.
- Frozen compensation dependency:2212b74816f2f4d9913bb611a58668a8ae5c5094.
- Combined tested executable head:05efa4d5a86b72bf3e30e18b974edd19c5d0eb8e.
- Tested tree:955cb653ee60888646663fc5a9a6aefb4e1e8fe2.
- Job8 adds only this report. Final documentation head/tree and patch proofs
  are in the external job8-evidence/manifest.json.
- Shared code head and coordinator revision268 remained unchanged when checked.
  No lease claimed or queue modified.

All seven earlier exports and both frozen compensation exports are retained
byte-for-byte. Full/shared-base and frozen-compensation-base patches are review
artifacts, NOT instructions to apply blindly. The inherited full diff includes
a historical work-state catalogDigest adjustment; the authoritative coordinator
must reconcile it, never overwrite current queue state with this snapshot.
No Job1–8 changes were made to the shared queue.

## Implemented candidate scope

| Job | Delivered | Still bounded |
| --- | --- | --- |
|1|Preserve completed surplus refunds during atomic compensation/unallocation|No refund reclamation or unrelated-document undo|
|2|Atomic full cash reversal with consumed discount|Refund/cross-document/unsupported histories reject|
|3|Ordinary credits against eligible corrected originals, cumulative per-line caps|Replacement conditional terms, correction after credits and corrected supplier return claims remain unfinished|
|4|Statements/ageing/journals/P&L/BS/VAT lifecycle and cutoff reconciliation|Only supported candidate lifecycles|
|5|Persisted correction outcome lookup and retained URL recovery|Unknown is not failure; locator/history needed|
|6|Connected native browser review/cancel/stale/denied/reload/company cases|Synthetic authentication, not real Clerk acceptance|
|7|896 official NI reference rows, reproducible source evidence|4period-zero rows quarantined;892reference-usable; no engine/accountant qualification|
|8|Combined checks, restore, exports and cleanup verification|Independent review/integration still required|

The explicit replacement-terms policy is approved but unimplemented. Do not ask
the policy question again or describe Job3/parent requirements as fully closed.
Public conditional execution rejection gates remain unchanged.

## Combined verification

All checks ran on the tested executable head above without concurrent source
edits, using existing dependencies and a sanitized environment.

- Current-source/scheduler:859/859,0failures,0skips.
- Migration registry and backup/recovery checks:41/41,0failures,0skips.
- Native disposable runner:277/277,0failures,0skips.
- Full build/typecheck passed; existing Vite chunk-size advisory only.
- Actual isolated Chromium tests passed: compensation review-only and
  customer/supplier corrections, with real native endpoints and synthetic auth.
- Populated restore:44tables,12479rows. Source and restored fingerprint:
  22cd001f825a9eda529c1f05c8f47d0203ae40d9447ccd7dad88f274b4d8cfd8.
- Restricted runtime and controls preserved; historical mutation denied;
  compensation restore acceptance passed.
- Encrypted separate-cluster application recovery passed; both cleanup receipts
  confirm PostgreSQL stopped and created directories removed.

Disposable run77c0b16f-4222-46f2-beb1-895b8ef9234e started
2026-11-06T16:42:39.791Z. No ambient database credentials or production contacts.
This verifies the populated test schema, not production/offsite recovery.

## Reproduction

From the isolated source checkout, prefix each command with:

```sh
env -i PATH="$PATH" HOME="/home/runner/workspace/.local/share/ledgerly/four-day-20261105/home" LANG=C LC_ALL=C pnpm_config_verify_deps_before_run=false
```

Commands:

```sh
node tools/development/check.mjs
node --test tools/development/migrations/registry.test.mjs tools/operations/backup-restore/*.test.mjs
node tools/accounting-flow/test.mjs
# Add PORT=5179 BASE_PATH=/ to the sanitized environment for:
pnpm run build
```

No existing demo database, startup, provider, live controls or original workspace
was changed. No push, merge, public publishing, deployment or statutory filing.
All test processes stopped. Final export manifest records clean state, file
hashes, valid Git bundle and scratch-index patch reconstruction to the final tree.

## Next review boundary

Independent review should assess the combined candidate and its migration
requirements before any integration decision. Public activation and real Clerk
acceptance remain separate. Finish the identified Job3 lifecycle work and
tax/payroll prerequisites through the existing backlog, not a competing queue.
No unattended continuation or automatic parent acceptance.
