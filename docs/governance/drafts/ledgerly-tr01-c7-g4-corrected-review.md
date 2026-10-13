# C7 G4 corrected protection package — AI review only

**Outcome:** exact-input and preservation review passed; offline checks passed.
**G4 remains INCOMPLETE; G5–G7 remain PENDING.**
No configuration is installed by this review. No server-acceptance, independent
human-review, authenticated browser inspection or activation claim is made.
Any further live attempt requires new owner approval of the exact corrected
window and closure bytes, followed by fresh drift checks.

## Exact reviewed input and provenance

Attached file: `c7-g4-personal-repository-correction-review_1791909699903.zip`.
SHA-256: `01af5bac886abf9aae580249cc931ce86d10f0f9ff6cc82f0da64a50b0002e8b`.
ZIP CRC passed; all 18 manifest member hashes passed; 19 unique members,
including the manifest, with no unmanifested members or unsafe extraction paths.

The embedded original approved ZIP is byte-exact SHA-256
`b7d0c84cbcf8f73a43691ae242ec84f494b97757b4c37b59fa55e1a0a6eeccaa`.
The embedded original window body equals the retained failed request bytes in
`ledgerly-tr01-c7-g4-application/window-main-protection.json`.
The original closure body equals the original approved ZIP closure member:
it was never dispatched and must not be described as a second HTTP failure.
Record commit `ab5963aaf4c107aa2b089f7c97a7826c1731d518` exists locally.
The retained failure archive is still SHA-256
`d378f8f433c7feef04ad3963ed191d88d555015fca73f190fb7537792097dd71`.
Original approval, original package, failed requests and tracked historical
evidence were not edited.

The corrected input's statement that raw failure receipts were unavailable
describes its author's preparation limits. This AI review closes that provenance
gap using the actual local failure receipt and exact failed bytes; the input
itself remains unchanged.

## Exact payload hashes and sole differences

| Body | Original SHA-256 | Corrected SHA-256 |
| --- | --- | --- |
| Window | `602ec1a83e6bbea44c1e2145e4e3f87d466f33b80934d1c2e772ad9e44d809d0` | `d96d829a3df69c397b032fe1a1eb308d9f98fada72efcb8495a9e17c18b354e6` |
| Closure | `76cf123a7a8eac3225251239e48500f0b870e480f428513f4755b3b524402618` | `fc4d8f277df504e9fff50a2e9bb30a52d4fe22fd25cff3013d78a4bfb9724e7c` |

Both original bodies are 611 bytes; both corrected bodies are 509 bytes.
Full structural comparison confirms the sole change in each is deletion of:

```json
"bypass_pull_request_allowances": {"users": [], "teams": [], "apps": []}
```

under `required_pull_request_reviews`. Exact byte diffs are included.
No other value changes: administrator enforcement true, non-null mandatory-PR
object, stale-review dismissal true, code-owner/last-push approval false,
conversation resolution true, window review count zero, closure count two,
status checks null, push restrictions null, linear history false, force pushes
false, deletion false, branch creation blocking false, lock false, fork syncing
false.

The actual provider failure was HTTP 422:
`Only organization repositories can have users and team restrictions`.
It does not identify a property. Removing the optional empty bypass object is
the smallest proposed correction and a plausible diagnosis, not a proven
property-level cause. Neither local checks nor schema inspection establishes
GitHub's acceptance of either corrected body.

## Offline verification

Reviewed supplied Python scripts before execution: local JSON/argparse/unittest
only; no network, credentials, subprocess or mutation operations.

- `python3 test_owner_type_compatibility.py`: **10/10 passed**, zero skipped.
- `python3 owner_type_compatibility.py --owner-type User
  payloads/window-main-protection.json payloads/closure-main-protection.json`:
  exit zero, both error arrays empty.
- Independent comparisons bind fixtures to the exact retained failed window
  and approved closure, and prove sole-field removal and all preserved values.

The validator is a conservative offline owner-type lint, not a complete
GitHub schema/semantics implementation. Its organization case means “not
flagged by these personal-owner rules,” not server-valid. Its pass on
`restrictions:null` is not a server experiment.

Historical six image-dependent local tests remain skipped in their original
receipt; this review does not relabel or rerun them. The retained original
package documents the existing exact-C7 identity run 38283941466 attempt 1,
whose offline suite passed 7/7 with zero skips, covering those six cases.
That evidence does not qualify A or a future merge commit. Existing development
qualification 38284785813 attempt 1 remains exact-C7 only. No new hosted run.

## Fresh GitHub state

Bounded authenticated `gh` GETs and one read-only GraphQL query observed
2026-10-13 **16:45:31–16:45:44 UTC**. These are observation times, not a
transactional snapshot or a later action-time guarantee.

All **20 reviewed comparisons/checks passed** against the corrected package's
snapshot:

- Owner `Future00111`, user ID 318002590; repository owner type `User`.
- PR #26 OPEN and draft; A
  `ead19106aaad76d604e8595337b5ab2fddda68d0`; B/main
  `0da401737f35d68b9404982baad7405fe997636a`.
- A tree `bf7c91fac7fe09d8458a327dd79464ea1a3973ad`; ordered parents B then
  C7 `787d76decfa345e3c1104231e08d5ab00bc90259`.
- Merge commits true; squash false; rebase false; auto-merge false.
  Already-applied merge-only settings retained; **no repository PATCH replay**.
- Main classic protection unchanged: administrator enforcement true, mandatory
  PR policy absent, conversation-resolution enforcement false. Main effective
  rules unchanged.
- Every Environment variable/pin unchanged, including candidate C7 and C7
  producer B; earlier producer pins unchanged.
- Frozen C/C2/C3/C4/C5/C6/C7 refs, detailed rulesets and effective rules unchanged.
  No bypass actors in their active rulesets; update/delete/force blocks retained;
  C2–C7 strict status checks sourced to integration 15368 and initial-create
  exemptions retained. Original C has no added status requirement.
- Environment `ledgerly-canonical` ID 20664477675: required owner reviewer,
  `prevent_self_review=false`, custom admission exactly branch `main` and branch
  `tr01/implementation-identity-successor-c7`, no tags/wildcards.
  `can_admins_bypass=true` remains an existing capability; its use is forbidden.
- Collaborator inventory and repository variables unchanged; repository and
  Environment secret-name inventories unchanged (zero); no secret values read.

Native rule `BPR_kwDOT7mVms4E6Id6`, pattern `main`, currently shows
`requiresApprovingReviews=false`, `requiredApprovingReviewCount=null`,
`isAdminEnforced=true`, conversation resolution false, and PR bypass
`totalCount=0` with no next page. Current zero actors does **not** prove the
proposed window policy is installed.

## Requirements for any separately approved configuration attempt

No executable write runner is included or authorized here. Proposed request:
one PUT to `/repos/Future00111/ledgerpoint/branches/main/protection` using
`payloads/window-main-protection.json`, with API version `2022-11-28` and JSON
Accept header. **No repository PATCH.**

Before a later call: approve both exact revised bodies and closure plan;
revalidate input/body hashes, owner, PR A/B/state, main, all controls and pins,
merge-only settings, and native zero-bypass state. Stop on drift, new required
checks/actors or changed controls; never erase additions with stale nulls.
Only the exact separately approved call may then occur. On error, stop,
retain raw status/body, and do not modify/retry or automatically close.

After a successful response, independently GET main protection and repository
settings and issue the included native GraphQL query:

1. REST mandatory PR object non-null, count 0, stale dismissal true,
   code-owner and last-push false; admin enforcement and conversation true.
   Every remaining field preserved, including no force/deletion.
2. Native unique exact `main` rule, complete rule pagination, administrator
   enforcement true, `requiresApprovingReviews=true`, count 0, stale dismissal
   true, conversation resolution true, code-owner/last-push false,
   `restrictsPushes=false`, `restrictsReviewDismissals=false`.
3. Native `bypassPullRequestAllowances(first:100).totalCount` must equal **0**;
   allowance pagination must have no next page. Null, missing, unauthorized or
   errored allowance readback is a stop—not equivalent to zero. The complete
   main-rule inventory and effective rules must still match, with no new
   bypass-capable rule or policy. If the rule ID changes, stop and reconcile;
   do not silently accept a different rule.
4. Recheck all preserved controls, pins, frozen refs and Environment gate.
   Retain raw write response plus independent REST/native readbacks.
5. Actual authenticated GitHub UI inspection remains a requirement before
   proceeding to G5, unless separately revised by the owner. This AI review has
   not inspected that UI. Native readback is not mislabeled browser evidence.

An omitted REST bypass field proves nothing. The native zero allowance count,
complete inventory and enforced-admin policy are the required actor proof;
they do not remove the Environment's separate retained bypass capability.

## Closure/restoration plan — proposed, NOT applied

Corrected closure is one separate PUT to the same endpoint, hash
`fc4d8f277df504e9fff50a2e9bb30a52d4fe22fd25cff3013d78a4bfb9724e7c`.
Renewed approval must cover these changed bytes, trigger conditions
(completion, failure, revocation, expiry or unapproved drift), and
stop-on-error handling. The earlier approved closure does not authorize a
modified body. No closure is attempted during this review.

At a separately authorized closure time, freshly compare controls and avoid
overwriting added checks/actors with stale values. Read back REST and native
count **2** and every other strengthened window field, enforced admins,
conversation resolution, zero bypass actors and merge-only settings.
Preserve candidate pins, frozen rules/refs and Environment gate. Retain receipts.
With only the owner collaborator, future owner-authored PRs cannot satisfy two
eligible approvals; the owner's earlier acceptance of this consequence remains
recorded. No reduction back to the old no-PR/no-conversation policy is approved.
If closure fails, hold, report and preserve evidence; no automatic weaker rollback.

## Review limitations and retained diagnostics

An initial authenticated account GET timed out at 30 seconds; its log is retained.
A bounded connectivity GET then succeeded and the full read-only capture completed.
The first comparison script omitted `sha` metadata from effective-rule rows and
flagged a mismatch; actual rule bodies were identical. Offline reconciliation
joined SHAs from the same captured ref responses and passed all seven exact rows.
Original failed-comparison receipt/log and corrected result are both retained;
the corrected script is supplied. No live write failure or actual control drift
occurred in this review.

The input's previous checks, this review's tests and this review's GitHub reads
are separate receipts. No live acceptance claim, new approval, PR readiness,
merge, dispatch, Environment release, migration, deployment, production/Helium
access or Phase A is authorized or performed.
