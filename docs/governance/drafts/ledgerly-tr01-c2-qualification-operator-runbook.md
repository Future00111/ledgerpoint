# TR-01 C2 qualification — operator runbook (review draft)

**Control diff not applied; no dispatch authorised.** Updated: 2026-10-01.
The [actual C2 owner-only approval](../ledgerly-tr01-c2-owner-only-qualification-approval.md)
replaces unavailable independent humans for development candidate qualification
only, not main/status-producer approval. Immutable C2 is
`3ab9edc28b4922ad82e68afb7b049d69514f91e1` (tree
`365303e152430560b828c88165dd8f4d03f2a4fc`, sole parent C
`d292f3a64c6253e022b40de8cf055f3e722ff1ea`). PR
[#10](https://github.com/Future00111/ledgerpoint/pull/10) is **draft,
unmerged**, head `a3e486b666c0a3a90a9a6907f45326a60430807f`, base
`94cbb98f36a61d2cdb954745a2dff4a1fbfe754c`. Read-only GitHub API
showed four additions/348 lines, zero checks/statuses and zero deployments
for that head in the earlier readback. PR head/draft state and remote C2
absence were reconfirmed on 2026-10-01. These observations are not a passing
status; the linked decision is actual bounded governance approval, not a run
attestation.

## Two distinct pins; neither is configured in the owner's UI evidence

| Purpose | Exact name and value | Where used |
| --- | --- | --- |
| Status producer **source** | `TR01_C2_APPROVED_WORKFLOW_SHA` = exact independently reviewed **merged main workflow commit**; unknown until approved merge, **not** PR head and **not** C2 | Proposed main workflow reads `vars.TR01_C2_APPROVED_WORKFLOW_SHA`, passes it as `TR01_APPROVED_WORKFLOW_SHA`; publisher compares to GitHub-provided `GITHUB_WORKFLOW_SHA` and `GITHUB_SHA`. |
| TI-03 **implementation candidate** | `LEDGERLY_APPROVED_CANDIDATE_SHA` = exact C2 `3ab9edc28b4922ad82e68afb7b049d69514f91e1` after separate approval/readback | Immutable C2 workflow reads `vars.LEDGERLY_APPROVED_CANDIDATE_SHA`; its runner demands a full SHA **even in candidate mode**. This must never be replaced by the status producer's main SHA. |

Both are proposed **Environment-level variables** in `ledgerly-canonical`;
the owner reported **no variables and no secrets** on 2026-09-29.
The 2026-10-01 variable read still returned HTTP 403: current values are
unknown, not verified absent. GitHub `vars` can inherit repo/org values:
verify each Environment-level value and exclude inherited substitutes.
Neither pin is a secret or evidence of reviewer approval by itself. Do not
ask for values in chat; inspect approved non-secret configuration in GitHub.

## Dependency-ordered gates (stop at the first unmet gate)

1. **Review source; no merge authorised here.** The separate main review
   path must review exact PR #10 diff/source; owner verifies the exact C2
   Git object under the bounded replacement. PR #10's check count is zero: its
   diff and passing local tests are not protected-main CI. Obtain the
   separately required protected-main merge approval and exact resulting
   source SHA. No self-review, administrator bypass or C-only exception is
   implied by a draft PR. Keep immutable C/C2 and main unchanged until
   separately authorised.
2. **Agree protective sequencing.** Owner approves and verifies the
   exact-C2 ruleset addition before publication: retain update/deletion/
   non-fast-forward rules and empty bypass list; add required status
   `tr01/c2-identity-validation`, strict policy and
   `do_not_enforce_on_create: true`. Initial-creation exemption is **not**
   status success or a general bypass. Source restriction requires an
   *observed* trusted publisher integration ID where GitHub supports it;
   never guess one or treat a matching context as provenance. If first
   observation must follow status publication, explicitly authorise and
   read back the subsequent `integration_id` pin before qualification.
3. **Use the actual C2 owner-only replacement.** The linked 2026-10-01
   decision replaces unavailable independent C2 human reviews; that is no
   longer a blocker for candidate development qualification. Preserve
   automated checks, immutable controls, owner confirmation of exact C2,
   per-run approval, isolation and cleanup. Retain the existing listed owner
   Environment reviewer and normal release; do not claim an independent
   review or manufacture an attestation. Configuration changes still need
   approval/readback as specified in the diff below. The main/status-producer
   review path is outside this replacement.
4. **Publish exact C2 only with a fresh, specific go-ahead.** Recheck local
   SHA/tree/parent, remote C2 absence, unchanged C/main and effective rules.
   Use a normal non-force creation at
   `refs/heads/tr01/implementation-identity-successor-c2`; read back exact
   ref/rules. On rejection, stop rather than bypass or weaken protection.
5. **Produce and verify identity status separately.** After the reviewed
   workflow is actually merged to protected main, verify the exact main SHA
   in the **Environment-level** `TR01_C2_APPROVED_WORKFLOW_SHA`, no inherited
   substitute, and independent reviewer release; then obtain separate
   authority to dispatch only the main identity-validation workflow on
   `refs/heads/main`. It has no manual inputs. Its `validate` job runs
   non-DB C2 checks without `statuses: write`; dependent `identity` must
   see `needs.validate.result == success` and posts only to exact C2.
   Read back run/attempt, source SHA, dependency logs, actual C2 commit
   status (SHA, context, `success`, issuer/integration), and effective
   source-pinned required rule. A green main check or local test is not
   a C2 status. **Do not proceed if source provenance is unresolved.**
6. **Separately authorise C2 candidate TI-03 dispatch.** Set/read back
   Environment-level `LEDGERLY_APPROVED_CANDIDATE_SHA` = exact C2, C2-eligible
   protected-branch eligibility, exact-C2 owner confirmation, approval of
   this concrete run and normal owner Environment release.
   In immutable C2, dispatch `.github/workflows/ledgerly-canonical-postgresql.yml`
   on **protected C2** (not main) with **no workflow_dispatch inputs**.
   C2 supplies `LEDGERLY_IDENTITY_MODE=candidate`,
   `LEDGERLY_IMPLEMENTATION_SOURCE_SHA=github.sha`,
   `LEDGERLY_WORKFLOW_ROOT=github.workspace`, `CI=true` and
   `DOCKER_BUILDKIT=1`. Runner independently requires GitHub Actions,
   `workflow_dispatch`, exact workflow name/ref/job, protected C2 ref,
   full candidate pin and workflow/implementation SHA equality. Parent
   `DATABASE_URL`, `REPLIT_*` and PostgreSQL target overrides must be
   absent. Do not replace with workspace DB, HeliumDB or production.
7. **Accept evidence, not a green badge.** Capture Actions run URL/ID,
   attempt, actual owner approval/release and exact C2 checkout, then the
   `ledgerly-ti-03-<run_id>-<attempt>` artifact. Verify emitted
   `LEDGERLY_TI03_EVIDENCE {path,sha256}` against the downloaded
   `docs/governance/evidence/ledgerly-44-ti-03-<runId>.json`. Accept only
   schema-v2 `result: passed` with source-tree/digest and CI identity
   bindings, pinned PostgreSQL/Node image digests, isolated private DB and
   `ledgerly_api` role, bootstrap guards, all required negative controls,
   concurrency/privilege denial, all cleanup booleans true and isolation
   evidence including no HeliumDB/production contact. The C2 runner's
   `validateEvidenceContract` is the full source of truth; an upload can
   also contain **failure evidence**, which is not qualification.
   Owner reviews/verifies cleanup and reads back unchanged protected refs;
   do not describe this as independent human review.
   Even accepted candidate evidence needs distinct final C2 identity
   approval; it does not activate main or Phase A.

## Non-DB preflight and unverified hosted-runner assumptions

- PR #10 proposes `ubuntu-24.04`, then `corepack enable`,
  `corepack prepare pnpm@10.26.1 --activate`, full
  `pnpm install --frozen-lockfile --ignore-scripts`, syntax checks,
  `pnpm run typecheck:libs`, `pnpm run typecheck`, and the pure C2
  runner test. All named scripts and paths exist in immutable C2.
  Root `typecheck:libs` is `tsc --build`; root `typecheck` runs it and
  recursively invokes artifact and scripts package typechecks, whose
  package scripts exist. Its root has **no** `packageManager` field, so the explicit Corepack
  prepare command selects pnpm; the lockfile is v9. The second typecheck
  repeats `typecheck:libs`, not a missing-script failure.
- The published [Ubuntu 24.04 runner-image
  README](https://github.com/actions/runner-images/blob/main/images/ubuntu/Ubuntu2404-Readme.md)
  (image version `20260920.314.1` at inspection) lists
  Node 22.23.2 and 24.21.0 (default software list names 22.23.2).
  [Node 22.23.2 documentation](https://nodejs.org/download/release/v22.23.2/docs/api/corepack.html)
  says Corepack is distributed before v25.
  **This does not prove the actual selected hosted runner has a usable
  Corepack binary, signing keys or network registry access**, or pin
  its host Node version. Check `node --version`,
  `command -v corepack`, `corepack --version`, and the exact activated
  `pnpm --version` in a separately authorised run; stop on missing/wrong
  versions. The actual TI-03 test container separately pins
  Node 24.13.0 by image digest. No hosted-runner install/typecheck was run
  in this preparation.
- Local no-network checks: both C2 JavaScript entrypoints passed
  `node --check`; C2's pure identity/acceptance test file passed in a
  detached C2 worktree with existing local dependencies; the PR proposal's
  15 mocked publisher tests passed. The worktree initially lacked
  package-local `pg` resolution until existing package `node_modules`
  was linked for the *test harness*; this was not a C2 code fix or an
  installed dependency. No Docker, database, production or hosted runner
  was used. No definite executable defect was established in PR #10;
  host Corepack/package installation and TypeScript success remain
  **unverified**, not assumed.

## Smallest proposed control diff — Codex review/execution handoff

**Read-only API snapshot: 2026-10-01; nothing applied.** GitHub returned
Environment `ledgerly-canonical` ID `20664477675`, required reviewer
`Future00111` (User ID `318002590`), `prevent_self_review: false`,
`can_admins_bypass: true`, and
`deployment_branch_policy: {protected_branches: true, custom_branch_policies: false}`.
Thus the earlier UI display of main was **not an explicit main-only allowlist**.
Custom-policy listing returned 404 under this mode; variables returned 403.
Remote main is `94cbb98f36a61d2cdb954745a2dff4a1fbfe754c`, `protected: true`;
effective main ruleset rules were empty and classic protection read returned
403. Do not infer complete main protection or permission to change it.

The remote main Git tree/blobs show canonical PostgreSQL qualification uses
this Environment but **does not read `LEDGERLY_APPROVED_CANDIDATE_SHA`**.
Corepack diagnostics uses a different Environment. PR #10's future identity
publisher would also share `ledgerly-canonical`. Immutable C2 hardcodes that
Environment: a dedicated new Environment cannot be substituted without
changing C2, which is forbidden. Re-inventory consumers before execution;
if main has changed to consume the candidate pin/activated C2, stop and
obtain a separate main-impact decision rather than treating this as activation.

| Control | Before (observed unless qualified) | Proposed after / precise action |
| --- | --- | --- |
| Required Environment reviewer | `Future00111` | **Unchanged.** Owner releases each approved C2 job normally; never delete this gate. |
| Prevent self-review | `false` | **Unchanged.** Owner-initiated owner release is supported; it is explicitly not independent review. Do not turn it on and create an impossible solo gate. |
| Admin bypass | `true` | **Unchanged for minimal shared diff; do not use bypass.** A global disable would affect all consumers and needs a separate decision; this is not an enforced non-bypass guarantee. Reject/record any bypassed run rather than accept it as normal owner release. |
| Environment branch mode | Protected branches only | **Prefer unchanged**, verify C2 job eligibility after authorised exact publication. Ruleset protection and earlier UI display alone do not prove Environment eligibility. Conditional fallback below only after owner configuration approval. |
| Environment candidate variable | Current read denied; 2026-09-29 owner UI said absent | Set/read back `LEDGERLY_APPROVED_CANDIDATE_SHA=3ab9edc28b4922ad82e68afb7b049d69514f91e1` at **Environment level** after approved configuration. Do not overwrite an unexpected existing value without resolving it. No repository/org pin, secrets or global token permissions added. |
| Status workflow pin | Current read denied; proposed only | **Not part of candidate-only diff.** `TR01_C2_APPROVED_WORKFLOW_SHA` and publisher activation require separate protected-main/source approval. |
| C2 ruleset `24197692` | Active; exact C2 ref; `deletion`, `non_fast_forward`, `update`; `bypass_actors: []` | Preserve all of these; add only the existing readiness report's `required_status_checks` rule for `tr01/c2-identity-validation`, strict policy, creation-only exemption. Verify/pin observed trusted publisher integration before TI-03. Do not invent an integration ID or status. |
| C/main workflows, C ruleset, main protection | Existing configuration | **Unchanged.** No review waiver or approval of main merge/status writes follows from the C2 decision. |

**Conditional branch-policy fallback, not a default change:** if protected-only
does not admit C2, propose the following exact selected-branch policy, retaining
main admission and all reviewer/bypass settings. GitHub does not offer an
Environment policy scoped to one workflow; this affects the shared Environment.
Recheck current consumers/eligible refs first. If narrowing other protected
branches would disrupt unrelated work, stop for a separate impact decision.
Do not broaden to all branches or use a wildcard.

```json
{
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
```

Then create/read back exactly two branch-policy entries (no tag entries):
`{"name":"main","type":"branch"}` and
`{"name":"tr01/implementation-identity-successor-c2","type":"branch"}`.
Use Environment update `PUT /repos/Future00111/ledgerpoint/environments/ledgerly-canonical`
and policy creation `POST .../environments/ledgerly-canonical/deployment-branch-policies`
**only if separately authorised**; preserve reviewer `{type:"User",id:318002590}`
and `prevent_self_review:false` on any full UI/API update.
Custom patterns alone do not enforce protection: retain C2's exact active
immutable ruleset and the workflow's `github.ref_protected` check. Main's own
workflow protection checks and existing protection remain unchanged.
References: [reviewer/self-review and branch modes](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments),
[Environment update](https://docs.github.com/en/rest/deployments/environments#create-or-update-an-environment),
[branch policies](https://docs.github.com/en/rest/deployments/branch-policies).

## Remaining dependencies and next step

Codex should review this diff and request the **specific configuration/publication
go-ahead**, not additional independent C2 reviewers. PR #10 review/merge,
main publisher `statuses: write`, its source pin and dispatch remain separate
decisions; do not apply the C2 human exception to that main workflow. After
authorised protection/publication, obtain a real source-verified C2 status,
verify Environment-level pin and C2 eligibility, then obtain owner exact-C2
confirmation and approval of the **specific TI-03 run**. Record its real
normal Environment release and evidence afterwards. Hosted preflight,
schema-v2 qualification, SHA-256, isolation and cleanup remain unproven.
No signed attestation or run approval is supplied by this document.