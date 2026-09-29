# TR-01 C2 qualification — operator runbook (review draft)

**Not authority to act.** Snapshot: 2026-09-29. Immutable C2 is
`3ab9edc28b4922ad82e68afb7b049d69514f91e1` (tree
`365303e152430560b828c88165dd8f4d03f2a4fc`, sole parent C
`d292f3a64c6253e022b40de8cf055f3e722ff1ea`). PR
[#10](https://github.com/Future00111/ledgerpoint/pull/10) is **draft,
unmerged**, head `a3e486b666c0a3a90a9a6907f45326a60430807f`, base
`94cbb98f36a61d2cdb954745a2dff4a1fbfe754c`. Read-only GitHub API
showed four additions/348 lines, zero checks/statuses and zero deployments
for that head. Remote C2 remains absent. These are observations, **not
human approvals or a passing status**.

## Two distinct pins; neither is configured in the owner's UI evidence

| Purpose | Exact name and value | Where used |
| --- | --- | --- |
| Status producer **source** | `TR01_C2_APPROVED_WORKFLOW_SHA` = exact independently reviewed **merged main workflow commit**; unknown until approved merge, **not** PR head and **not** C2 | Proposed main workflow reads `vars.TR01_C2_APPROVED_WORKFLOW_SHA`, passes it as `TR01_APPROVED_WORKFLOW_SHA`; publisher compares to GitHub-provided `GITHUB_WORKFLOW_SHA` and `GITHUB_SHA`. |
| TI-03 **implementation candidate** | `LEDGERLY_APPROVED_CANDIDATE_SHA` = exact C2 `3ab9edc28b4922ad82e68afb7b049d69514f91e1` after separate approval/readback | Immutable C2 workflow reads `vars.LEDGERLY_APPROVED_CANDIDATE_SHA`; its runner demands a full SHA **even in candidate mode**. This must never be replaced by the status producer's main SHA. |

Both are proposed **Environment-level variables** in `ledgerly-canonical`;
the owner directly reported that the Environment has **no variables and no
secrets**. The connector's HTTP 403 for a variable read was not evidence of
their contents. GitHub `vars` can inherit repo/org values: independently
verify each Environment-level value and exclude inherited substitutes.
Neither pin is a secret or evidence of reviewer approval by itself. Do not
ask for values in chat; inspect approved non-secret configuration in GitHub.

## Dependency-ordered gates (stop at the first unmet gate)

1. **Review source; no merge authorised here.** Independently review exact
   PR #10 diff/source and C2 Git object. PR #10's check count is zero: its
   diff and passing local tests are not protected-main CI. Obtain the
   separately required protected-main merge approval and exact resulting
   source SHA. No self-review, administrator bypass or C-only exception is
   implied by a draft PR. Keep immutable C/C2 and main unchanged until
   separately authorised.
2. **Agree protective sequencing.** Independently approve and verify the
   exact-C2 ruleset addition before publication: retain update/deletion/
   non-fast-forward rules and empty bypass list; add required status
   `tr01/c2-identity-validation`, strict policy and
   `do_not_enforce_on_create: true`. Initial-creation exemption is **not**
   status success or a general bypass. Source restriction requires an
   *observed* trusted publisher integration ID where GitHub supports it;
   never guess one or treat a matching context as provenance. If first
   observation must follow status publication, explicitly authorise and
   read back the subsequent `integration_id` pin before qualification.
3. **Prepare human/Environment gates.** Original C2 governance calls for
   two fresh branch approvals where applicable (or an expressly approved
   C2 replacement), resolved conversations/stale dismissal, a distinct
   listed Environment reviewer, and a separate second-human pre-dispatch
   review distinct from initiator and Environment approver. Record fresh
   exact-C2 owner attestation. Owner's GitHub UI showed reviewer
   `Future00111`, self-review prevention off, admin bypass on, and protected
   branches displaying **main only**. Correct/verify independent release
   and C2 branch eligibility **only with separate authorisation**. No
   approval or correction is recorded by this runbook.
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
   protected-branch policy, distinct reviewer and pre-dispatch attestation.
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
   attempt, reviewer release and exact C2 checkout, then the
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
   Independently verify cleanup and read back unchanged protected refs.
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

## Minimum owner decisions/information still missing

No credentials are needed. The owner must independently supply or approve:
the **separate** review/merge and activation decisions; a workable set of
distinct C2 branch, Environment and pre-dispatch human reviewers (or an
express C2-specific governance replacement); the exact reviewed merged
main workflow SHA when one exists; and the separately approved C2 pin,
Environment-level values/eligible branch policy and ruleset sequencing.
The trusted status publisher integration ID must be *observed and verified*
from GitHub, not supplied by guesswork. Until these facts and approvals are
recorded, **do not dispatch either workflow**.