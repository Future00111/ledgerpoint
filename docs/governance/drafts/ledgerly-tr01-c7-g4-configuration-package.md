# Exact PR #26 — proposed G4 configuration package

**PROPOSED FOR REVIEW; NOT APPROVED OR APPLIED. G4–G7 remain PENDING.**
Prepared by Replit Agent as AI assistance, not independent-human approval.
This package does not change PR #26, main, any candidate or any live control.

## 1. Binding and authority

| Identity | Exact value |
| --- | --- |
| Repository / draft PR | `Future00111/ledgerpoint`, [#26](https://github.com/Future00111/ledgerpoint/pull/26) |
| A, current draft head | `ead19106aaad76d604e8595337b5ab2fddda68d0` |
| B, current main and first A parent | `0da401737f35d68b9404982baad7405fe997636a` |
| C7, implementation and second A parent | `787d76decfa345e3c1104231e08d5ab00bc90259` |
| A / intended ordinary merge tree | `bf7c91fac7fe09d8458a327dd79464ea1a3973ad` |
| A workflow SHA-256 | `ad06da35f4269fbbf46e1fd4ccabf6082d309963e39b577e17ac948c546afc20` |
| G1 approved proposal revision | `4f5e87d6bfb6c3a468c947903a23d3beedf7a676` |

G1's five human-review substitutions and G2's development-only C7 designation
are recorded separately. G3 prepared A; it did not authorize configuration,
merge, dispatch or acceptance of an activated result. Only a later explicit
G4 approval of this exact package may authorize its configuration/closure plan.
G5 still requires exact A/B/tree acceptance and one ordinary merge; G6/G7
remain separate decisions. No historical independent-human approval is
relabelled, and no new independent-human approval is claimed.

Read-only observations recorded on **2026-10-13 at 13:52:32 UTC** establish
PR OPEN/draft at A, main at B, and controls identical to the retained G3
snapshot. Observations are not atomic and expire if a bound value changes.
Fresh comparison is mandatory immediately before any authorized operation.

## 2. Current versus proposed settings

The complete readback, all seven frozen rulesets/effective candidate rules,
Environment policies and pins are in
[current-settings.json](ledgerly-tr01-c7-g4-configuration/current-settings.json).

| Setting | Current | Proposed owner-only window | Closure |
| --- | --- | --- | --- |
| Required PR policy | Absent; not a zero-review mandatory-PR policy | Non-null required-PR policy, **0** approving reviews | Keep mandatory PR; **2** approving reviews |
| Dismiss stale native approvals | Not configured | `true` | `true` |
| Code-owner / last-push approval | Not configured | `false` / `false` | Retain `false` / `false`; two native approvals are separately required |
| PR bypass users/teams/apps | No PR policy | Empty lists | Empty lists |
| Administrator enforcement | `true` | `true` | `true` |
| Conversation resolution | `false` | `true` | `true` |
| Required status checks | None | None; do not fabricate a context | Preserve actual approved checks |
| Merge / squash / rebase | `true` / `true` / `true` | `true` / `false` / `false` | Keep merge-only |
| Auto-merge | `false` | `false` | `false` |
| Force pushes / deletion | `false` / `false` | Unchanged | Unchanged |
| Linear history / branch lock | `false` / `false` | Unchanged; merge commit must remain possible | Unchanged |
| Required signatures | `false` | Unchanged; no signature endpoint writes | Unchanged |
| Delete branch after merge / update-branch UI | `false` / `false` | Unchanged | Unchanged |
| Environment reviewer | User `Future00111`, ID `318002590` | **Unchanged; required** | Unchanged |
| Environment `prevent_self_review` | `false` | Unchanged; normal owner release under the bounded exception | No new activated owner-only release authorized |
| Environment `can_admins_bypass` | `true` | **Unchanged capability; bypass use forbidden** | Unchanged; no further exception use |
| Environment branch policy | Custom selected branches | Unchanged | Unchanged |
| Candidate/producer pins; frozen protections | See below | No writes | No writes |

The current main effective-rules endpoint returns `[]`: classic protection
still applies. Do not use that empty result or `protected:true` as proof of
the new mandatory-PR policy.

The Environment permits administrator bypass as a native capability today.
This package **does not claim to disable it**. Its required reviewer remains,
and only the normal owner review/release path may be used under G6. The public
REST Environment update schema and live GraphQL `UpdateEnvironmentInput`
do not expose that flag as a supported write field. No invented
`can_admins_bypass` payload or undocumented API is proposed. Removing the
capability through supported owner UI would need a separately reviewed,
explicit configuration action. This is a retained risk, not an Environment
approval waiver.

## 3. Exact proposed API operations — inert, not executed

Common headers: `Accept: application/vnd.github+json` and
`X-GitHub-Api-Version: 2022-11-28`. Reuse only the existing authorized actor,
freshly verified as `Future00111`; do not extract or request credentials.
Read-level `permissions.admin=true` is not proof of the credential's write
scope. A permission error is a stop, not authority to expand permissions.

The following sequence begins only after specific G4 approval and a fresh
exact-snapshot comparison. Prohibit other main writes throughout setup/window.

| Order | Method and endpoint | Exact JSON body | Expected result |
| --- | --- | --- | --- |
| 1 | `PATCH /repos/Future00111/ledgerpoint` | [window-repository-settings.json](ledgerly-tr01-c7-g4-configuration/window-repository-settings.json) | HTTP 200; merge on, squash/rebase/auto-merge off |
| 2 | `PUT /repos/Future00111/ledgerpoint/branches/main/protection` | [window-main-protection.json](ledgerly-tr01-c7-g4-configuration/window-main-protection.json) | HTTP 200; mandatory PR, zero native approvals, administrator enforcement, conversation resolution, empty PR bypass |
| Later closure only | `PUT /repos/Future00111/ledgerpoint/branches/main/protection` | [closure-main-protection.json](ledgerly-tr01-c7-g4-configuration/closure-main-protection.json) | HTTP 200; required approving count 2, all strengthened safeguards retained |

Read back after each operation; do not continue after any error or mismatch.
No configuration operation marks the PR ready or merges it. No Environment,
variable, admission, ruleset, ref, required-signature, status or workflow-run
write is included. Exact action descriptors and a future-G5-only merge
reference are in
[actions-and-verification.json](ledgerly-tr01-c7-g4-configuration/actions-and-verification.json).

`required_pull_request_reviews` must be an **object**, not `null`.
The documented approval count supports zero. Zero avoids the impossible
author-approves-own-PR requirement; it does not turn an owner comment into a
native approving review. Organization-only dismissal/push restrictions are
not included for this user-owned repository. Existing absent status checks
are represented as `null`; any newly observed required check invalidates the
prepared payload until it is preserved in a freshly reviewed package.

## 4. Ordinary PR enforcement and its limits

After authorized configuration, native enforcement must require PRs even for
administrators, with no PR bypass actors; merge-only repository settings deny
squash/rebase. Conversation resolution remains a native blocker. Required
checks, if any are later approved, cannot be bypassed. No direct/local main
push, force push, `--admin`, ruleset bypass, synthetic status, queue/auto-merge
or alternative merge route is permitted.

**Expected verification, not a claim of applied enforcement:**

1. `GET /repos/Future00111/ledgerpoint/branches/main/protection` must return
   non-null required-PR reviews with count **0**, stale dismissal `true`,
   code-owner/last-push requirements `false`, all bypass arrays empty,
   administrator enforcement `true`, conversation resolution `true`, and
   every other captured protection unchanged.
2. In main's native protection UI, verify **Require a pull request before
   merging** enabled, **Require approvals** disabled, administrator coverage
   enabled, bypass allowances empty, and conversation resolution enabled.
   If the provider does not enforce/read back that combination, stop for a new
   decision. Do not probe it by pushing to main.
3. Repository GET must show merge `true`, squash/rebase/auto-merge `false`;
   branch-deletion/update settings must remain unchanged.
4. PR #26 must still be OPEN/draft at exact A against exact B and unmerged.
   Fresh review-thread/changes-requested/conflict checks remain necessary at
   G5; presently there are zero reviews and zero review threads.
   `mergeable=MERGEABLE` or `mergeStateStatus=CLEAN` is not approval or proof
   that the draft may be merged.
5. A currently has **zero check runs and zero commit statuses**. The combined
   status API's `pending` with an empty list is not a fabricated pending
   required check, nor evidence that CI passed. Retained local receipts,
   exact source review and the historical C7 evidence remain distinct.

Native policy applies to **all** PRs targeting main, not only #26.
Exact-A/B acceptance, the owner-only window, stale attestation invalidation,
the one-merge limit and the one-dispatch limit are **manual governance
restrictions**, not native per-PR or single-use capabilities.
The owner must prohibit unrelated main writes and record separate G5
acceptance of A, B, the ten-path diff and intended tree.

Only after G5 authorization may the draft be made ready and ordinarily merged.
The future REST merge body is exactly
`{"sha":"ead19106aaad76d604e8595337b5ab2fddda68d0","merge_method":"merge"}`.
It atomically matches the head, **not B**. There is no claimed base-SHA
compare-and-swap: quiesce concurrent main writes and reread B immediately
before the merge. If B has advanced, stop without merging.
Afterward require actual main=G, `G^1=B`, `G^2=A`, the reviewed tree and C7
ancestry. A mismatch stops all downstream work and retains evidence; do not
rewrite main or describe a post-merge mismatch as a prevented race.

## 5. Preserved candidate and Environment invariants

Environment `ledgerly-canonical` ID **20664477675** must remain:

- Required reviewer User `Future00111` / **318002590**, self-review prevention
  `false`, existing administrator-bypass capability `true` but never used.
- `deployment_branch_policy={"protected_branches":false,"custom_branch_policies":true}`.
- Exactly policy **61652671** = branch `main`, and policy **61652697** =
  branch `tr01/implementation-identity-successor-c7`.
- No tags, wildcards, new branches, reviewer removal or custom-policy changes.
- `LEDGERLY_APPROVED_CANDIDATE_SHA=787d76decfa345e3c1104231e08d5ab00bc90259`.
- Historical producer pins unchanged:
  C2 `87a4ff7d44be9bc21296e9623db16924488f76ae`;
  C3 `65f3453c29f1eb1057bc66edc0cc7de508e87c2d`;
  C4 `af028bb647fbbdb81509539969b21a859e708f34`;
  C5 `82e122115b99a6c206b5bd07743331398cae6bbe`;
  C6 `fdb4e2af7168e52dafde04d003f498ed76489206`;
  C7 `0da401737f35d68b9404982baad7405fe997636a`.
  The C7 producer pin is **not** replaced with A or future G.

All seven frozen refs/SHAs and ruleset conditions remain exact, active and
without bypass actors. Original C retains its existing update/deletion/
non-fast-forward blocks; C2–C7 additionally retain strict identity checks from
GitHub Actions integration **15368**, including their initial-create
exemptions. Do not invent an identity-status rule on original C or normalize
historical protections. See the complete snapshot and
[frozen-invariants-summary.json](ledgerly-tr01-c7-g4-configuration/frozen-invariants-summary.json).

Repository and Environment secret **names/counts only** currently show zero;
repository variables show zero and the seven Environment variables are the
recorded SHA pins. This readback is not a future G6 credential-exclusion
attestation. That fresh preflight and actual normal Environment review for
the eventual run URL remain separately required. No production/Helium access,
qualification, deployment or Phase A is authorized.

## 6. Validation receipts and the six skipped tests

The original G3 receipt is preserved byte-exact, not edited to remove skips.
It records pinned minimal host installation/module resolution, workflow
parsing/safety, binding/schema and identity/acceptance regression passes,
29 producer cases, and actual A/C7 source attribution: one positive and five
rejecting cases. The full ten-path blob/mode/hash inventory and all other
B-exact blobs/modes/absences remain recorded. This is local validation on
NixOS/Node 24.13.0, not hosted activated qualification.

The local offline suite was **1 passed, 6 skipped**, because no Docker test
image was supplied. Each skipped case has now been reconciled against the
**existing** C7 identity validation run
[38283941466 attempt 1](https://github.com/Future00111/ledgerpoint/actions/runs/38283941466),
validate job **114927672255**, produced from pinned B with exact C7 checkout.
Its retrieved raw log reports **7 passed, 0 failed, 0 skipped**:

| Local skipped image case | Historical exact-C7 validate-job result |
| --- | --- |
| Pinned pnpm/bootstrap CLI as node, read-only and offline | PASS, test 2 |
| Empty runtime cache fails closed without replacement fetch | PASS, test 3 |
| Actual sanitized child compiles source and runs nested pnpm/node tests offline | PASS, test 4 |
| Missing fixed module root rejects without dependency fallback | PASS, test 5 |
| Actual sanitized nested invocation with missing cache fails without registry access | PASS, test 6 |
| Missing read-only cache rejects the real nested invocation | PASS, test 7 |

Receipt hashes, source hashes, exact log lines and local logs are retained in
the accompanying `receipts/` directory; the downloadable package also
includes the unmodified 70,617-byte historical job log. Raw log SHA-256:
`b7dc437a65f9572174d5e077e908401cb4c52a13f9d103ef9db46ed3ba7bfe4c`.

Historical coverage supplements unchanged C7 implementation/image inputs;
it does **not** change the local SKIP results, demonstrate a new A/G-hosted
run, or claim identical image-instance IDs across runs. The existing six
accounting tests, 18 negative controls and five cleanup results belong to
candidate qualification **38284785813 attempt 1**, not A or future G.
No new qualification or identity dispatch occurred.

## 7. Restoration, failure handling and remaining gates

The proposed normal closure is **two native approving reviews**, stale
dismissal/conversation resolution/admin enforcement retained, empty bypass
lists and merge-only settings retained. This restores the approved normal
human review policy, **not the weaker observed pre-window null PR policy**.
With one current collaborator it blocks future owner-authored PRs until
eligible independent reviewers are separately approved. The owner must
understand this repository-wide consequence before approving the plan.

Completion, failure, revocation, an unapproved A/B/control change, scope
expansion or expiry ends the exception's authority. The expressly approved
G4 changes and later authorized G5 transition B→G are not unapproved drift.
A failed activated run consumes its
single dispatch: no retry is allowed. Close further owner-only use immediately;
apply the exact closure payload only under approval of this specific closure
plan, and read back count 2 plus every preserved invariant. Keep merge-only,
immutable/status and Environment safeguards; do not revert them to weaker
defaults. Pins, admissions, Environment reviewer and frozen rules receive no
restoration writes.

Before closure, recheck main at B if no merge occurred, or at recorded G
after the authorized merge, and compare the live controls with the approved
window plus any expressly approved later differences. In particular, if
required checks have been added, do not apply this package's `null` status
field over them: stop for a revised, approved preservation/closure payload.
Never use a stale snapshot to overwrite unrelated changes.

If setup partially fails, stop before G5/G6, preserve redacted request/body,
HTTP result, timestamp and before/after snapshots, and retain already
strengthened settings. No automatic retry, rollback or credential expansion.
Any inability to install/read back the approved closure is a **configuration
hold**: no further merge, dispatch or normal/bypass release under this
exception. Record it for an explicit owner decision.

[prior-main-protection-reference.json](ledgerly-tr01-c7-g4-configuration/prior-main-protection-reference.json)
records the exact weak historical policy for comparison only. Applying it
would remove strengthened PR/conversation safeguards and is **not** authorized
by this restoration plan. Likewise, restoring squash/rebase is not proposed.

Closure cannot revoke GitHub's native ability to dispatch an existing main
workflow or the retained Environment bypass capability. Refuse further
activated owner-only dispatch/release as governance policy; do not claim a
native single-use token, expiry timer or automatic revocation mechanism.
Any further activated run needs a new, separately approved process.

**G4 configuration and closure approval, G5 exact merge acceptance,
G6 one activated development dispatch/normal release and G7 result acceptance
remain pending. Review of this package applies nothing.**
