# TR-01 C2 identity-status preparation (draft, not applied)

**Status:** blocked before publication and qualification. Codex created
[draft PR #10](https://github.com/Future00111/ledgerpoint/pull/10) in GitHub
UI for review; it is **unmerged**. No workflow dispatch, C2 publication,
main merge, permission/ruleset/Environment change or production operation
was made by this preparation. Immutable C and C2 remain unchanged.

## Verified facts and authority

- Exact C2: `3ab9edc28b4922ad82e68afb7b049d69514f91e1`, tree
  `365303e152430560b828c88165dd8f4d03f2a4fc`, direct parent C
  `d292f3a64c6253e022b40de8cf055f3e722ff1ea`. Local object inspection
  showed six reviewed path changes. Remote C2 ref was absent at the read-only
  GitHub check.
- Active exact-C2 GitHub ruleset 24197692 has update, deletion and
  non-fast-forward rules with no bypass actors. Its effective rules **do not**
  require a validation status; its lack of a `creation` rule does not prove
  that a later, amended ruleset will permit an initial push.
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
  extend to C2 (C2 design record, "Gates retained"). There is **no** C2
  exception or qualification authorisation in these records.
- The GitHub connector returned HTTP 403 when asked to read Environment
  variables; that response alone did not establish their contents. Separately,
  on 2026-09-29 the owner directly inspected GitHub's
  `/Future00111/ledgerpoint/settings/environments/20664477675/edit` UI and
  reported **no Environment variables and no secrets**, reviewer
  `Future00111`, self-review prevention **off**, admin bypass **on**, and the
  protected-branches policy displaying **main only**. This is owner-reported
  direct UI evidence, not a connector read-back. There is no configured
  Environment SHA pin; C2 is not shown eligible under that branch policy.
  None of these settings was changed here.

## Review-only, non-executing draft

The adjacent local files under `docs/governance/drafts/` remain non-executing
drafts. The corresponding four files now also exist on PR #10's separate
review branch, **not on protected main or C2**:

- `ledgerly-tr01-c2-identity-status.workflow.yml` — proposed new protected-main
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
  from an inherited repository/organisation value. No Environment pin exists
  today.
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
review confirmed the status-source pin and Environment reviewer controls
remain **live blockers**, not defects solved by a passing mock test.

The proposed workflow must be independently reviewed and merged **to protected
main**, with its publisher script installed at
`scripts/ci/ledgerly-tr01-c2-identity-status.mjs` and workflow at
`.github/workflows/ledgerly-tr01-c2-identity-status.yml`. These are proposed
destination paths, not changes to main or to C2. The workflow's own check
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
is open/unmerged with the expected base and four added files/348 additions/
zero deletions, zero checks/statuses and zero deployments for the PR head.
The remote added files match the local drafts in substance (terminal blank
line differs). Nothing was merged or dispatched. The connector's earlier
permission failure is historical, not evidence that the PR is absent.
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

The proposed `TR01_C2_APPROVED_WORKFLOW_SHA` is a **future Environment
variable**, not an existing setting. Set it to the independently reviewed
exact main commit only after a separate authorised decision. GitHub's `vars`
context can fall back to a repository or organisation variable when the
Environment value is absent: the script **cannot prove variable provenance**.
Verify the actual Environment-level value and exclude lower-precedence
substitutes before dispatch. An approved SHA alone
does not prove independent reviewer release; Environment variables remain
mutable by authorised administrators. Preserve the human approval and
status-source read-back gates.

## Dependency-ordered procedure; all live steps require separate approval

1. Approve the protected-main validation code and its narrowly scoped
   `statuses: write` job, with independent review of the exact new main
   workflow/script SHA. The draft PR itself does not approve its eventual
   merge or pin. Preserve C/C2, existing candidate workflow and
   Environment reviewer gate. Do **not** grant write permission to a job
   executing C2 tests.
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
5. Before any PostgreSQL qualification, obtain explicit C2 governance
   decisions implementing the original human-review requirements: two fresh
   branch approvals where applicable, stale-review dismissal and resolved
   conversations, a listed Environment reviewer other than initiator with
   self-review prevented, and a separate second-human pre-dispatch review
    distinct from initiator and Environment approver. The displayed
    one-reviewer, self-review, administrator bypass and main-only branch
    settings need separately authorised correction/verification; do not
    silently substitute C's exception. Independently configure and read back
    the Environment's exact C2 SHA and C2-eligible branch policy for the
    candidate run, record a fresh exact-C2 owner attestation, then seek separate
   candidate qualification authorisation.
6. Only then run the unchanged C2 TI-03 workflow on its protected C2 ref
   with disposable PostgreSQL, accepted schema-v2 evidence, its SHA-256,
   negative controls and cleanup. Passing qualification still requires
   separate final implementation-identity approval; it does not activate
   main, production or Phase A.

**Current blocker:** a trusted check producer is only a tested draft, the
 required rule is absent, remote C2 is absent, the owner's UI inspection shows
 no Environment SHA pin and a main-only branch policy, and C2-specific human
 governance is unresolved. Publication and
qualification were **not** performed. Older package statements that C2 is
not created are stale; its *subsequent gates* remain mandatory.