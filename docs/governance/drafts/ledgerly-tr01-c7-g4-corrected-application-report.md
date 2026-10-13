# Corrected G4 application — API success, authenticated UI pending

**Latest outcome:** one exact corrected main-protection PUT returned HTTP 200.
Independent REST/native readbacks and all 22 preservation/enforcement checks
passed. **G4 UI verification remains pending for Codex; G5–G7 remain pending.**
No actual authenticated browser inspection is claimed.

This execution follows the owner relay recorded in
`../ledgerly-tr01-c7-g4-corrected-configuration-approval.md`; it is owner
authorization, not independent-human review. Original approvals, the original
HTTP 422 request/failure and prior review documents remain unchanged.

## Exact authority and action

- Approved revised review ZIP SHA-256:
  `090b51fd4ad655001db0fa4b725610c1af2b9b326431b446d67e7999c71a79d7`.
- Applied corrected window body SHA-256:
  `d96d829a3df69c397b032fe1a1eb308d9f98fada72efcb8495a9e17c18b354e6`.
- Approved future closure body SHA-256:
  `fc4d8f277df504e9fff50a2e9bb30a52d4fe22fd25cff3013d78a4bfb9724e7c`.
- Owner relay text SHA-256:
  `3d9c43062ffd8828e865898d961e5210719f77c68799bfe35038bc3170358176`.

ZIP CRC and all 35 revised-package manifest hashes verified. Both exact payload
hashes verified before preflight and the window hash again at action time.
The reviewed read-only preflight was run into a separate receipt directory,
without modifying historical evidence.

One `PUT /repos/Future00111/ledgerpoint/branches/main/protection`,
API version `2022-11-28`, using the exact 509-byte corrected window body.
No body edits, PATCH replay, retry, permission expansion or closure.
The consumed-attempt marker prevents rerunning the execution script.

## Fresh preflight and observation times

All 20 preflight checks passed, using the existing authenticated GitHub CLI
owner `Future00111`, ID 318002590, user-owned repository.
Observation window 2026-10-13 **17:26:09–17:26:16 UTC**.
Immediate main-ref, PR A/B/state and main-protection guards also passed.

- PR #26 remained OPEN/draft with A
  `ead19106aaad76d604e8595337b5ab2fddda68d0`.
- B/main remained `0da401737f35d68b9404982baad7405fe997636a`.
- C7 remained `787d76decfa345e3c1104231e08d5ab00bc90259`.
- A tree remained `bf7c91fac7fe09d8458a327dd79464ea1a3973ad`;
  ordered parents B then C7.
- Main protection matched the reviewed pre-state; native main rule had zero
  bypass allowances with complete pagination.
- Merge-only settings, pins, all seven frozen refs/rulesets/effective rules,
  Environment reviewer/admission/gate and other inventories matched.

PUT started **17:26:18.094 UTC**, returned HTTP 200 at **17:26:18.641 UTC**.
Independent readbacks completed **17:26:26.883 UTC**.
These are recording/observation times, not a claim of transactional observation
or the time the owner made the approval decision.

## Verified installed policy

Independent REST GET verified:

- Non-null required PR policy, approving count **0**.
- Dismiss stale reviews true.
- Code-owner and last-push approval false.
- Administrator enforcement true.
- Conversation resolution true.
- Every other main-protection field unchanged, including no force push/deletion
  and unchanged status-check/push-restriction/signature/history settings.

Independent native GraphQL verified unique main rule
`BPR_kwDOT7mVms4E6Id6` with complete rule pagination and unchanged rule inventory:

```json
{
  "pattern": "main",
  "isAdminEnforced": true,
  "requiresApprovingReviews": true,
  "requiredApprovingReviewCount": 0,
  "dismissesStaleReviews": true,
  "requiresCodeOwnerReviews": false,
  "requireLastPushApproval": false,
  "requiresConversationResolution": true,
  "restrictsPushes": false,
  "restrictsReviewDismissals": false,
  "bypassPullRequestAllowances": {
    "totalCount": 0,
    "pageInfo": {"hasNextPage": false}
  }
}
```

Zero native actors, not an omitted REST field, supplies the PR-bypass proof.
The installed count-zero policy requires the ordinary PR path without requiring
an approving review during this narrowly authorized exception window; enforced
admins do not provide an admin bypass. Manual scope remains exact PR #26,
not a technical claim that this policy can admit only that PR.

This is an actual GitHub acceptance/readback result for the corrected window,
unlike the earlier offline compatibility check. It is not acceptance of the
unapplied count-two closure body, authenticated UI proof, G5 authorization or
qualification of A/a future merge commit.

## Preserved invariants — all 22 post-action checks passed

- Repository merge commits true; squash false, rebase false, auto-merge false;
  unrelated settings and ownership unchanged. Successful earlier PATCH was
  **not replayed**.
- Main ref/effective rules, exact A/PR state/tree/parents unchanged.
- Candidate C7 pin and every older/C7 producer pin unchanged (C7 producer B).
- Frozen C/C2/C3/C4/C5/C6/C7 refs, detailed active/no-bypass rulesets and
  effective protections unchanged, including integration-15368 strict identity
  status requirements for C2–C7 and their initial-create exemptions. Original C
  received no new status requirement.
- Environment `ledgerly-canonical` ID 20664477675 unchanged: required owner
  reviewer, `prevent_self_review=false`, custom branch admissions exactly main
  and `tr01/implementation-identity-successor-c7`, no tags/wildcards.
- Environment `can_admins_bypass=true` remains a retained capability; no use
  authorized or performed. It is distinct from main's enforced-admin policy.
- Collaborators, repository variables and repository/Environment secret-name
  inventories unchanged; no secret values read.

## Approved future closure — NOT triggered or applied

The owner approved the corrected closure plan restoring **two approvals** for
its recorded future exception-ending conditions (completion, failure,
revocation, expiry or unapproved drift) with fresh preservation checks.
Setup success alone does not close the window.

At an authorized closure time, recheck exact body hash and current controls;
stop for newly added checks/actors/drift rather than overwrite additions with
stale nulls. Use the exact corrected closure body in a separate approved PUT.
Independently verify REST/native count two, every strengthened field,
administrator/conversation enforcement and zero bypass actors, preserving
merge-only, frozen controls, pins and Environment gate. Retain response and
readbacks. Error means hold/report, not automatic retry or weaker rollback.
Future owner-authored PRs cannot satisfy two eligible reviews with only the
owner collaborator; that accepted consequence remains part of the plan.

## Pending authenticated UI handoff to Codex

Codex must perform a **read-only, authenticated browser inspection** of
GitHub main protection and repository merge settings. Confirm mandatory PR
policy/count zero, stale review dismissal, administrator enforcement,
conversation resolution, no bypass actors and merge-only settings against
these receipts. Retain timestamped UI evidence. Report discrepancies before
any later gate. Do not label REST/GraphQL as UI inspection.

G4 is **API_APPLIED_AND_VERIFIED_UI_PENDING**, not fully verified/completed.
G5–G7 remain pending. No PR readiness, merge, workflow dispatch, Environment
release, runtime change, migration, production/Helium access, deployment, push
or Phase A occurred or is authorized. Exact-C7 historical development
qualification remains exact-C7 only.

## Evidence

Thin durable receipts accompany this report under
`ledgerly-tr01-c7-g4-corrected-application/`; full independent captures and the
single-call script are in the delivered application evidence ZIP. Response
headers are reduced to HTTP status, content type, date, API version and GitHub
request ID; body bytes are retained. No credential values are included.

Local branch records this decision/execution separately from A, C7 and all
frozen candidate branches. No GitHub push was performed.
