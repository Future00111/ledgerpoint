# TR-01 C2 identity-status readiness — producer merged, qualification pending

**Status (2026-10-01):** exact C2 published; validation status/source pinning
and qualification still pending. Earlier merge-only snapshots below are historical;
unavailable independent C2 human reviewers are **no longer a blocker for
development candidate qualification** under the
[actual owner-only approval](governance/ledgerly-tr01-c2-owner-only-qualification-approval.md).
Separately, the owner reports verified Codex GitHub UI progress: the user
authorised [PR #10](https://github.com/Future00111/ledgerpoint/pull/10) merge
and the resulting Environment source pin. PR #10 was marked ready and
**merged normally, without bypass, on 2026-10-01**, then shown merged/closed,
at merge commit `87a4ff7d44be9bc21296e9623db16924488f76ae`.
Codex added and read back the exact Environment-level
`TR01_C2_APPROVED_WORKFLOW_SHA=87a4ff7d44be9bc21296e9623db16924488f76ae`
in `ledgerly-canonical`; reviewer, self-review and branch controls were
unchanged. This is owner-reported verified UI evidence, not a fresh connector
readback. No workflow dispatch, C2 publication or qualification occurred at
that merge/source-pin stage; subsequent C2 publication is recorded below.
This update is documentation-only; immutable C/C2 remain unchanged.

## Verified facts and authority

**Identity workflow run (2026-10-01):** preflight confirmed protected exact
main, Environment source pin, exact remote C2, unchanged owner gate, no
Environment secrets, and reviewed workflow/publisher source. Dispatched
`ledgerly-tr01-c2-identity-status.yml` once on main, no inputs:
[run 36875835097](https://github.com/Future00111/ledgerpoint/actions/runs/36875835097),
attempt 1. `validate` passed; `identity` is waiting for Future00111's normal
release of `ledgerly-canonical`. Agent did not release or bypass it.
Actual C2 status/trusted issuer readback and source pinning remain pending;
no qualification dispatch occurred.

**Successful publication (2026-10-01):** verified authenticated account
Future00111/repository Future00111/ledgerpoint and all preflight conditions,
then made one normal non-force exact-C2 push using the existing `gh` helper
for that command only. Exit 0, new branch; no persistent configuration,
login, token extraction, access expansion or bypass. Authenticated readback:
`refs/heads/tr01/implementation-identity-successor-c2` =
`3ab9edc28b4922ad82e68afb7b049d69514f91e1`, exact tree
`365303e152430560b828c88165dd8f4d03f2a4fc`, sole parent
`d292f3a64c6253e022b40de8cf055f3e722ff1ea`; C/main unchanged.
Ruleset/effective rules confirm active exact scope, empty bypass, immutable
restrictions and required status with strict/create-exemption true. “Any source”
remains bootstrap only: obtain actual validation status and observe/pin trusted
issuer before qualification. No workflow dispatched.

**Historical failed publication attempt (2026-10-01):** bounded public GitHub reads and
the existing authenticated GitHub CLI now confirm exact local C2 identity,
remote C2 absence, unchanged C and main, and active ruleset `24197692` with
exact scope, empty bypass, all three immutable restrictions, required
`tr01/c2-identity-validation`, strict policy and creation exemption enabled.
The connector still times out after 30 seconds; direct HTTPS and CLI work.
One normal non-force exact-C2 Git HTTPS push was attempted with a 30-second
limit and failed immediately (exit 128): `fatal: unable to get password from user`.
No authentication changes or retries were made. Post-attempt authenticated
readback confirms remote C2 remains absent (404) and effective rules intact.
Owner/Codex must repair the existing Git credential-helper connection before
retrying publication; CLI authentication alone does not authenticate Git push.
No workflows dispatched. The status source remains unpinned bootstrap only,
not established provenance; trusted issuer observation/pinning still precedes qualification.

**Historical superseded publication preflight (2026-10-01, before confirmed UI save):**
local C2 SHA/tree/sole parent match the exact identities below; fresh GitHub
ref reads confirm C unchanged at `d292f3a64c6253e022b40de8cf055f3e722ff1ea`,
main at `87a4ff7d44be9bc21296e9623db16924488f76ae`, and remote C2 absent (404).
However, both ruleset `24197692` readback (including cache-bypassed confirmation)
and effective C2 rules show only `deletion`, `non_fast_forward`, `update`.
Active exact scope and empty bypass list are preserved, but the reported
required-status rule, strict policy and creation-only exemption are **not
observed**. API `updated_at` remains `2026-09-29T18:58:13.676+01:00`.
Publication was **not attempted** because that pre-publication gate failed;
this was not a Git credential/write denial. Codex must reconcile/save the
intended rule and obtain matching effective-rule readback before publication.
No workflow was dispatched; trusted issuer observation/pinning still precedes
qualification, and an eventual “Any source” bootstrap is not provenance.

- Exact C2: `3ab9edc28b4922ad82e68afb7b049d69514f91e1`, tree
  `365303e152430560b828c88165dd8f4d03f2a4fc`, direct parent C
  `d292f3a64c6253e022b40de8cf055f3e722ff1ea`. Local object inspection
  showed six reviewed path changes. Remote C2 ref was absent at the read-only
  GitHub check.
- At the earlier pre-publication readback, active exact-C2 ruleset 24197692
  had update, deletion and non-fast-forward rules with no bypass actors but
  no required status. The later amendment and successful protected creation
  are now readback complete as recorded above.
- The C2 commit contains only the manual, protected
  `.github/workflows/ledgerly-canonical-postgresql.yml`. It cannot be amended
  with a second workflow and must not be dispatched merely to manufacture a
  *pre-dispatch* status. A separate workflow run on main has a check attached
  to main, **not** automatically to the C2 commit it checks out.
- The approved C2 implementation package §4.2 requires a status gate as part
  of pre-publication protection; §4.3 requires the real C2 status to pass and
  be enforced before qualification. The original implementation-recovery
  package §§8–10 requires two approving branch reviews (unless an approved
  replacement applies), a distinct listed Environment reviewer and a separate
  second-human pre-dispatch review. C-only solo-operator exceptions do not
  extend to C2 (C2 design record, "Gates retained"). Those older records had
  no C2 exception. The new **2026-10-01 actual C2-specific owner decision**
  replaces unavailable independent human reviews for development candidate
  qualification only; owner exact-commit confirmation and each concrete run
  approval remain required. It supplies no independent review, signed run
  attestation or specific dispatch approval.
- The GitHub connector returned HTTP 403 when asked to read Environment
  variables; that response alone did not establish their contents. Separately,
  on 2026-09-29 the owner directly inspected GitHub's
  `/Future00111/ledgerpoint/settings/environments/20664477675/edit` UI and
  reported **no Environment variables and no secrets**, reviewer
  `Future00111`, self-review prevention **off**, admin bypass **on**, and the
  protected-branches policy displaying **main only**. This is owner-reported
  direct UI evidence, not a connector read-back. There is no configured
  Environment SHA pin in that historical UI evidence.
  **2026-10-01 API correction:** Environment required reviewer Future00111,
  self-review prevention off and admin bypass on were read back; branch mode
  is `{protected_branches:true, custom_branch_policies:false}`, not an
  explicit main-only list. Remote C2 is still absent, so C2 eligibility is
  not yet demonstrated. The earlier variable read returned 403; the later
  Codex UI source-pin readback above supersedes the unknown source-pin state,
  but does not establish `LEDGERLY_APPROVED_CANDIDATE_SHA`. Exact C2 ruleset
  restrictions were active and unchanged at that readback. Main was protected
  at pre-merge `94cbb98f36a61d2cdb954745a2dff4a1fbfe754c`; full classic
  main protection read returned 403. The later reported merge is recorded
  above; no fresh API lookup was performed for this documentation update.

## Producer merged; local draft copies and historical checks

The adjacent local files under `docs/governance/drafts/` remain non-executing
draft copies. The corresponding producer changes were merged to main through
PR #10 as reported above, **not to immutable C2**:

- `ledgerly-tr01-c2-identity-status.workflow.yml` — merged protected-main
  manual workflow. A read-only job checks out pinned C2 with no persisted
  credentials and runs a frozen script-disabled install, syntax, TypeScript
  and focused pure C2 tests. A dependent publisher job uses the **existing**
  `ledgerly-canonical` Environment reviewer gate and has narrowly scoped
  `contents: read` / `statuses: write`; the test job cannot publish a status.
  Neither job runs database-backed qualification or invokes C2's workflow.
  The publisher job and script both require successful validation; the script
  additionally requires GitHub's workflow and dispatch SHAs to equal a
  separately approved SHA supplied at reviewer release. An empty or mismatched
  effective pin fails closed; code cannot distinguish an Environment value
  from an inherited repository/organisation value. The 2026-09-29 owner UI
  showed no pin; the later authorised Codex UI readback records the exact
  merged source pin above. Candidate-pin readback remains outstanding.
- `ledgerly-tr01-c2-identity-status.mjs` — fail-closed publisher: requires
  protected main manual execution from the exact reviewed workflow in the
  exact repository; fetches the exact
  C2 ref and Git commit over the GitHub API; checks SHA, sole parent and tree;
  rechecks ref; posts `success` only to the **exact C2 SHA** under
  `tr01/c2-identity-validation`. The publisher's GitHub token is supplied
  only by the future reviewed Actions job; no token was obtained here.
- `ledgerly-tr01-c2-identity-status.test.mjs` — pure mocked-response tests for
  the correct SHA and rejection of missing/changed refs, parent/tree/commit
  mismatches, untrusted invocations, unapproved source/dependency, API failure
  and a mismatched status
  response. They make no network or
  database calls. The identity status means *C2 identity and non-DB checks
  passed*, **not** TI-03 PostgreSQL qualification or human approval.

An independent draft review caught an incorrect assumption that GitHub's
status-creation response echoes the target SHA. The draft now validates
HTTP 201 plus returned state/context; the exact target SHA is fixed in the
POST path and must be independently read back before qualification. That
review identified source-pin and Environment-release gates, not defects solved
by a passing mock test. The source pin is now UI-readback complete; actual
run approval/release and status-source verification remain outstanding.

The owner-reported authorised PR #10 merge installs the producer **on main**,
with its publisher script at
`scripts/ci/ledgerly-tr01-c2-identity-status.mjs` and workflow at
`.github/workflows/ledgerly-tr01-c2-identity-status.yml`. No C2 source change
is implied. The workflow's own check
will still target main; its explicit commit-status API call targets exact C2.
The main workflow's exact source SHA and GitHub reviewer release must be
recorded with the eventual status.

For review, the exact four-file fallback patch against remote main
`94cbb98f36a61d2cdb954745a2dff4a1fbfe754c` is saved as
`docs/governance/drafts/ledgerly-tr01-c2-identity-status-review.patch`, with
a proposed PR body in `ledgerly-tr01-c2-identity-status-proposed-pr.md`.
`git apply --check` passed on a clean detached worktree at that base. A
connector-backed draft PR attempt first failed at Git Data
`createBlob`, returned HTTP 403 `Resource not accessible by integration`.
No new permissions were requested. **Subsequently Codex created draft PR #10
through GitHub UI** at branch `review/tr01-c2-identity-status`, head
`a3e486b666c0a3a90a9a6907f45326a60430807f`. Read-only API verified it
was then open/unmerged with the expected base and four added files/348 additions/
zero deletions, zero checks/statuses and zero deployments for the PR head.
The remote added files match the local drafts in substance (terminal blank
line differs). Nothing was merged or dispatched in that earlier preparation.
The subsequent authorised normal merge/source-pin UI readback is recorded
above; no dispatch followed. The connector failure and earlier draft state
are historical, not current merge blockers.
See `docs/governance/drafts/ledgerly-tr01-c2-qualification-operator-runbook.md`
for separate source/C2 pins, C2 preflight limits and acceptance steps.

## Exact ruleset amendment proposed for separate approval

Preserve ruleset 24197692's exact ref scope, `active` state, three existing
rules and empty bypass list. Add **one** rule (GitHub REST ruleset rule shape):

```json
{
  "type": "required_status_checks",
  "parameters": {
    "do_not_enforce_on_create": true,
    "strict_required_status_checks_policy": true,
    "required_status_checks": [
      { "context": "tr01/c2-identity-validation" }
    ]
  }
}
```

GitHub documents `do_not_enforce_on_create` as allowing initial branch
creation when a required check would otherwise prohibit it. This is an
explicit **creation-only** exception, not an administrator bypass, an update
waiver or a fabricated passing status. Do not assume actual push success;
read back effective rules and stop if creation fails. Documentation:
<https://docs.github.com/en/rest/repos/rules#create-a-repository-ruleset>
(`required_status_checks` parameters). The status endpoint and semantics:
<https://docs.github.com/en/rest/commits/statuses#create-a-commit-status>.

For protection against a different authorised status writer spoofing the
same context, pin the rule's `integration_id` to the **observed, verified
publisher GitHub App** if supported for this commit-status source. Do not
guess an ID. Before dispatch, read back the successful status, its C2 SHA,
context, issuer/integration and the effective required-check source. If the
source cannot be constrained and independently verified, stop for a security
decision; a context name alone is not proof of provenance. The draft does
not change GitHub permissions or rules.

`TR01_C2_APPROVED_WORKFLOW_SHA` is now recorded by Codex UI readback as an
**Environment-level variable** at the authorised merge commit
`87a4ff7d44be9bc21296e9623db16924488f76ae`. GitHub's `vars`
context can fall back to a repository or organisation variable when the
Environment value is absent: the script **cannot prove variable provenance**.
Verify the actual Environment-level value and exclude lower-precedence
substitutes before dispatch. An approved SHA alone
does not prove independent reviewer release; Environment variables remain
mutable by authorised administrators. Preserve the human approval and
status-source read-back gates.

## Dependency-ordered procedure; all live steps require separate approval

1. **Completed merge/source-pin prerequisite:** owner-authorised normal
   PR #10 merge at `87a4ff7d44be9bc21296e9623db16924488f76ae` and exact
   Environment source-pin readback. Before a separately authorised status
   run, recheck workflow/dispatch SHA equality to this pin and preserve the
   existing reviewer gate. No actual status, run approval/release or passing
   hosted validation follows from merge alone.
2. Authorise the exact ruleset amendment above **before** C2 publication,
   preserving all existing restrictions and no bypass. Verify effective
   conditions, status parameters and create-only exemption. Separately
   decide source-pinning procedure as described above.
3. Under a fresh applicable exact-publication go-ahead, reverify C2 local
   SHA/tree/parent and absent remote ref; make only a normal non-force push
   to `refs/heads/tr01/implementation-identity-successor-c2`. Verify remote
   exact C2, unchanged C and main, and ruleset. If rejected, **stop**;
   do not bypass, drop the status rule or rewrite a commit.
4. Dispatch only the *new main identity-validation workflow* after its
   source is reviewed, with a distinct listed Environment reviewer approval
   and no unrecorded bypass. Inspect test logs and the **actual** C2 status.
   A green Actions job on main without the explicit C2 status is not enough.
   Complete/pin the required-check source and verify effective enforcement.
5. For development candidate qualification, use the actual C2 owner-only
   replacement instead of seeking unavailable independent humans. Retain
   Future00111 as required Environment reviewer, self-review prevention off
   and normal owner release; no bypassed release is acceptable evidence.
   Review/authorise the runbook's minimal configuration diff, verify the
   Environment-level exact C2 pin and branch eligibility, then record owner
   exact-C2 confirmation and approval of the specific run. Do not fabricate
   an attestation. The main producer merge/source pin is complete, but its
   concrete dispatch and Environment release remain separately gated;
   do not weaken shared main controls or inherit C-only exceptions.
6. Only then run the unchanged C2 TI-03 workflow on its protected C2 ref
   with disposable PostgreSQL, accepted schema-v2 evidence, its SHA-256,
   negative controls and cleanup. Passing qualification still requires
   separate final implementation-identity approval; it does not activate
   main, production or Phase A.

**Current blockers:** no actual source-verified C2 validation status exists;
trusted publisher issuer still requires observation/pinning. Exact C2 publication
and the required status rule are now readback complete. Candidate Environment
pin/eligibility and individual run
approval/release remain outstanding. PR #10 merge and source-pin UI readback
are complete, not qualification. The unavailable-reviewer
 blocker is resolved **only for C2 development candidate qualification**.
 Qualification was **not** performed. Older package statements that C2 is
not created are stale; its *subsequent gates* remain mandatory.