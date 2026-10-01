# TR-01 C2 qualification — operator runbook (review draft)

**Qualification held: Environment admits main only.** Updated: 2026-10-01.
Current checkpoint supersedes historical pre-publication snapshots below:
exact C2 is published; [run 36875835097](https://github.com/Future00111/ledgerpoint/actions/runs/36875835097)
attempt 1 passed both validate/identity after normal owner release through
Codex (not independent review or production approval). Exact main source pin
is `87a4ff7d44be9bc21296e9623db16924488f76ae`. Effective C2 required check now
pins GitHub Actions integration `15368`; actual successful status `55368040359`
has matching `/in/15368` app avatar and the publisher check identifies that app.
The status endpoint lacks an explicit integration field/required-check
evaluation result; do not claim one was returned.
Environment candidate variable was created through the authorised CLI and
read back exactly as `3ab9edc28b4922ad82e68afb7b049d69514f91e1`.
Owner's fresh post-publication UI says protected-only applies to **one branch,
main only**. C2 is not eligible; branch-policy expansion confirmation is
pending. No qualification dispatched or Environment release performed.
The owner instructed first exact-C2 development qualification through Codex,
then explicitly held dispatch pending this admission issue; no independent
review or signed run attestation is claimed. The correction below is proposed,
not applied.
The [actual C2 owner-only approval](../ledgerly-tr01-c2-owner-only-qualification-approval.md)
replaces unavailable independent humans for development candidate qualification
only, not main/status-producer approval. Immutable C2 is
`3ab9edc28b4922ad82e68afb7b049d69514f91e1` (tree
`365303e152430560b828c88165dd8f4d03f2a4fc`, sole parent C
`d292f3a64c6253e022b40de8cf055f3e722ff1ea`). PR
[#10](https://github.com/Future00111/ledgerpoint/pull/10) was marked ready
and **merged normally without bypass on 2026-10-01**, shown merged/closed,
at `87a4ff7d44be9bc21296e9623db16924488f76ae`, following user authorisation
of merge and resulting source pin. Codex added/read back exact Environment
variable `TR01_C2_APPROVED_WORKFLOW_SHA=87a4ff7d44be9bc21296e9623db16924488f76ae`
in `ledgerly-canonical`. Reviewer, self-review and branch controls were
unchanged. Source: owner's verified Codex GitHub UI report, not a new API
lookup. No workflow dispatch, C2 publication or qualification occurred;
merge/pin completion is not a passing status or run attestation.

## Two distinct pins; both configured and read back

| Purpose | Exact name and value | Where used |
| --- | --- | --- |
| Status producer **source** | `TR01_C2_APPROVED_WORKFLOW_SHA` = `87a4ff7d44be9bc21296e9623db16924488f76ae`; owner-authorised merged main commit and exact Environment UI readback, **not** PR head and **not** C2 | Merged main workflow reads `vars.TR01_C2_APPROVED_WORKFLOW_SHA`, passes it as `TR01_APPROVED_WORKFLOW_SHA`; publisher compares to GitHub-provided `GITHUB_WORKFLOW_SHA` and `GITHUB_SHA`. |
| TI-03 **implementation candidate** | `LEDGERLY_APPROVED_CANDIDATE_SHA` = exact C2 `3ab9edc28b4922ad82e68afb7b049d69514f91e1`; authorised Environment-level creation and exact readback complete | Immutable C2 workflow reads `vars.LEDGERLY_APPROVED_CANDIDATE_SHA`; its runner demands a full SHA **even in candidate mode**. This must never be replaced by the status producer's main SHA. |

Both pins belong at **Environment level** in `ledgerly-canonical`.
The 2026-09-29 empty-variable UI report and earlier 2026-10-01 connector 403
are historical. The later source/candidate readbacks establish both Environment
pins. GitHub `vars` can inherit repo/org values:
verify each Environment-level value and exclude inherited substitutes.
Neither pin is a secret or evidence of reviewer approval by itself. Do not
ask for values in chat; inspect approved non-secret configuration in GitHub.

## Dependency-ordered gates (stop at the first unmet gate)

1. **Merge/source pin completed, not validation.** Record the authorised
   normal merge/source-pin readback above; owner verifies exact C2 under
   the bounded replacement. Before any separately authorised status run,
   verify workflow/dispatch SHA equals the pinned merge commit. Local tests
   and merge are not protected hosted validation or actual C2 status.
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

- The producer merged through PR #10 uses `ubuntu-24.04`, then `corepack enable`,
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

**Earlier read-only API snapshot: 2026-10-01, before reported merge/pin.** GitHub returned
Environment `ledgerly-canonical` ID `20664477675`, required reviewer
`Future00111` (User ID `318002590`), `prevent_self_review: false`,
`can_admins_bypass: true`, and
`deployment_branch_policy: {protected_branches: true, custom_branch_policies: false}`.
Thus the earlier UI display of main was **not an explicit main-only allowlist**.
Custom-policy listing returned 404 under this mode; variables returned 403.
Remote main was `94cbb98f36a61d2cdb954745a2dff4a1fbfe754c`, `protected: true`;
effective main ruleset rules were empty and classic protection read returned
403. Do not infer complete main protection or permission to change it.

The remote main Git tree/blobs show canonical PostgreSQL qualification uses
this Environment but **does not read `LEDGERLY_APPROVED_CANDIDATE_SHA`**.
Corepack diagnostics uses a different Environment. PR #10's now-merged identity
publisher also shares `ledgerly-canonical`. Immutable C2 hardcodes that
Environment: a dedicated new Environment cannot be substituted without
changing C2, which is forbidden. Re-inventory consumers before execution;
if main has changed to consume the candidate pin/activated C2, stop and
obtain a separate main-impact decision rather than treating this as activation.

| Control | Before (observed unless qualified) | Proposed after / precise action |
| --- | --- | --- |
| Required Environment reviewer | `Future00111` | **Unchanged.** Owner releases each approved C2 job normally; never delete this gate. |
| Prevent self-review | `false` | **Unchanged.** Owner-initiated owner release is supported; it is explicitly not independent review. Do not turn it on and create an impossible solo gate. |
| Admin bypass | `true` | **Unchanged for minimal shared diff; do not use bypass.** A global disable would affect all consumers and needs a separate decision; this is not an enforced non-bypass guarantee. Reject/record any bypassed run rather than accept it as normal owner release. |
| Environment branch mode | Protected branches only; **fresh post-publication UI lists main only**, C2 excluded | **Qualification blocked.** Proposed exact selected main/C2 correction below requires owner action-time confirmation; not applied. |
| Environment candidate variable | Initially absent (404) | **Completed:** authorised creation/readback of `LEDGERLY_APPROVED_CANDIDATE_SHA=3ab9edc28b4922ad82e68afb7b049d69514f91e1` at Environment level. No repository/org pin, secrets or global token permissions added. |
| Status workflow pin | Earlier connector read denied; later authorised Codex UI readback complete | **Completed:** `TR01_C2_APPROVED_WORKFLOW_SHA=87a4ff7d44be9bc21296e9623db16924488f76ae` at Environment level. Preserve it; this does not approve dispatch or establish an actual C2 status. |
| C2 ruleset `24197692` | Active exact scope, immutable restrictions and empty bypass; required status strict/create exemption true | **Source pin completed:** effective `tr01/c2-identity-validation` uses `integration_id:15368`; preserve all controls. Existing successful status/run app corroborate source; explicit evaluated-check acceptance is not exposed by the status endpoint. |
| C/main workflows, C ruleset, main protection | Existing configuration | **Unchanged.** No review waiver or approval of main merge/status writes follows from the C2 decision. |

**Required admission correction, proposed only:** fresh live UI confirms
protected-only does not admit C2. Propose the following exact selected-branch policy, retaining
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

Codex must obtain owner action-time confirmation of the exact selected main/C2
admission correction, preserve all unrelated controls, and read back actual C2
eligibility before any dispatch. Publication, successful identity run/normal
owner release, actual C2 status, effective integration `15368` and both
Environment pins are complete. Resolve any stronger source-association
acceptance requirement without inventing API evidence. Prior bounded metadata
checks found zero Environment/repository secrets, but runtime credential
absence, workflow/source digests, isolation, schema-v2 evidence, SHA-256,
negative controls and cleanup still need the full approved contract preflight
and guarded run. Current instruction authorises first exact-C2 development
qualification through Codex conditionally; later instruction holds dispatch
until admission is corrected/confirmed. No qualification run ID, signed
attestation or Environment release is fabricated.