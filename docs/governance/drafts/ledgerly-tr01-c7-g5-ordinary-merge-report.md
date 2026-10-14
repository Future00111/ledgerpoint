# G5 exact PR26 ordinary merge — 2026-10-14

**G5 COMPLETE. G6/G7 remain PENDING. Development-only scope.**

Owner approval was [relayed through Codex](../ledgerly-tr01-c7-g5-owner-merge-approval.md).
This is Replit AI execution/verification under G1, not independent-human review.
No activated qualification or deployment is claimed.

## Exact result

- PR: <https://github.com/Future00111/ledgerpoint/pull/26>, closed/merged, not draft.
- **G / current remote main:** `706dc6a31f85733ba0c251f40b2c09f5a9312269`.
- Commit: <https://github.com/Future00111/ledgerpoint/commit/706dc6a31f85733ba0c251f40b2c09f5a9312269>.
- Ordered parents:
  1. B `0da401737f35d68b9404982baad7405fe997636a`.
  2. A `ead19106aaad76d604e8595337b5ab2fddda68d0`.
- G tree = A tree: `bf7c91fac7fe09d8458a327dd79464ea1a3973ad`.
- C7 remains `787d76decfa345e3c1104231e08d5ab00bc90259`.
- B, A and C7 are ancestors of G. A's ordered parents remain [B,C7].
- Authenticated actor and merge actor: `Future00111`, GitHub user ID 318002590.
- GitHub merged timestamp: **2026-10-14T15:13:26Z**.
- Exact G/B union comparison: **ten permitted paths**, every other B entry,
  blob/mode and absence preserved; **518 outside-inventory union entries**.
- Complete remote recursive G tree was read, not truncated, and equals the
  local immutable A tree entry-for-entry.

GitHub's merged PR record retains `base.sha=B`; remote main independently
reads G. These represent different facts. Neither a PR's historical base field
nor a pre-merge synthetic `merge_commit_sha` is substituted for actual G.

## Action-time evidence and one normal attempt

1. Original planning HEAD/history preserved; separate local branch
   `records-local/tr01-c7-g5-authorized-merge` created from
   `1da03b94b37f88f55f0f96ba0afc1b4013879e96`.
2. Relayed approval recorded before live action in commit
   `04ec3a73f3ace83e05ec5a2af1a88c515c439ea0`.
3. Fresh preflight **2026-10-14T15:12:11.586272–15:12:23.580370 UTC**:
   all **40 checks passed**. G1–G4/proposal bytes, original workbook, actor,
   A/B/tree/parents/ancestry/inventory, reviews/checks and controls verified.
4. One normal `gh pr ready 26 --repo Future00111/ledgerpoint` succeeded;
   response and readback retained. No other PR readiness changed.
5. Repeated full ready-state preflight passed, including unchanged review/
   check evidence and complete native policy. Authenticated actor, exact A,
   main B, open/ready/clean/mergeable state were read immediately before merge.
6. Exactly one normal command succeeded, exit 0, empty stdout/stderr:

   ```text
   gh pr merge 26 --repo Future00111/ledgerpoint --merge \
     --match-head-commit ead19106aaad76d604e8595337b5ab2fddda68d0
   ```

   No admin, force, squash/rebase, auto merge, branch deletion, direct push,
   head/base update or policy relaxation. Exclusive attempt markers were
   persisted before each action. No action retry.
7. Raw PR readback supplied actual G. Complete postmerge control receipts
   and supplemental native/tree/review readback establish the result.
   Final readback completed **2026-10-14T15:14:58.453806 UTC**.

The head guard is not an atomic base lease. No unrelated main write was made
by this agent; external writers cannot be locked by the CLI command. Actual
ordered [B,A] parents and exact A tree demonstrate the expected resulting
topology, without inventing an atomic-base guarantee.

## Preserved checker failure and read-only reconciliation

At **2026-10-14T15:13:38.570299 UTC**, the first postmerge checker stopped:
it incorrectly required merged PR `base.sha=G`. The provider retained reviewed
B in the PR record while main read G. The original script, log, stop receipt
and captured controls remain unchanged.

Offline inspection of those captured receipts proved this was a local
readback-assumption defect, not source/control drift. No GitHub correction or
action retry followed. A separate read-only reconciliation reused the captured
control observations, completed the missing native/review/tree readbacks and
read final PR/main. All **42 reconciliation checks passed**. Historical stopped
evidence is not replaced or silently erased.

Legacy preparation-check keys in copied receipts retain their historical names
(`exactDraftUnmergedPR`, `mainExactB`, `mergeable`), but the retained reconciliation
script explicitly tests merged/not-draft PR, main=G and merged state for those
postmerge predicates. The scripts and raw records make this adaptation auditable.

## Retained controls and assurance limits

G4 mandatory PR/count-zero window, enforced administrators, stale dismissal,
conversation resolution and complete native **zero bypass actors** are preserved.
Merge-only settings remain merge=true, squash/rebase/auto=false.
Frozen C through C7 refs, seven active no-bypass protections/effective rules,
candidate/producer pins, exact main+C7 Environment admission, owner reviewer,
custom policy and all other recorded Environment settings are unchanged.
Existing administrator-bypass capability is not claimed disabled; it was not used.
No browser/UI inspection was attempted or claimed this turn; G4's historical
actual Codex browser addendum remains attributed to Codex.

Reviews, requested reviewers, threads, head checks and head statuses remain
zero. Absence of checks is **not CI success** or independent-human approval.
G3's six image-dependent skips remain skips. No tests were rerun or reclassified.
Existing C7 qualification applies to exact C7, **not G**.
No workflow run exists on G in the retained readback; no dispatch was performed.

## Evidence and next gates

Tracked summaries:
`docs/governance/drafts/ledgerly-tr01-c7-g5-ordinary-merge/`.

Full original approval relay, raw GET/native pages, command responses, consumed
attempt markers, first checker failure, reconciliation receipts/scripts and logs:
`generated-artifacts/ledgerly-c7-g5-authorized-merge/`.
The final ZIP manifest records all hashes and local approval/outcome commits.
Original approvals, failure evidence, workbook/source and runtime/history remain
unchanged; this is a local records commit, not runtime synchronization to main.

**Next gate: separate G6 exact-G/C7 preflight and owner run/release authorization.**
No such authorization is inferred from G5. G7 activated-result acceptance and
the conditionally approved two-approval closure remain separate. Closure was
not triggered or attempted here.

No push, dispatch, Environment release, closure/control change, runtime/schema/
workflow edit, migration, production/Helium access, deployment, publishing or
Phase A occurred. No suggested follow-up implementation was started.
