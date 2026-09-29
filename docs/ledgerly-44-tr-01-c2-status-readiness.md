# TR-01 C2 identity-status preparation (draft, not applied)

**Status:** blocked before publication and qualification; no remote write or runner dispatch
was made by this preparation. Immutable C and C2, protected main, GitHub rules,
and the `ledgerly-canonical` Environment are unchanged.

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
- At the latest read, `ledgerly-canonical` still had one required reviewer,
  `prevent_self_review: false`, `can_admins_bypass: true`, and protected-branches
  deployment policy. The current Environment SHA variable could not be read
  through the connector (HTTP 403); its value is **unknown**. None of these
  settings was changed.

## Review-only, non-executing draft

The adjacent files under `docs/governance/drafts/` are deliberately **not**
installed in executable paths:

- `ledgerly-tr01-c2-identity-status.workflow.yml` — proposed new protected-main
  manual workflow. A read-only job checks out pinned C2 with no persisted
  credentials and runs a frozen script-disabled install, syntax, TypeScript
  and focused pure C2 tests. A dependent publisher job uses the **existing**
  `ledgerly-canonical` Environment reviewer gate and has narrowly scoped
  `contents: read` / `statuses: write`; the test job cannot publish a status.
  Neither job runs database-backed qualification or invokes C2's workflow.
- `ledgerly-tr01-c2-identity-status.mjs` — fail-closed publisher: requires
  protected main manual execution from the exact reviewed workflow in the
  exact repository; fetches the exact
  C2 ref and Git commit over the GitHub API; checks SHA, sole parent and tree;
  rechecks ref; posts `success` only to the **exact C2 SHA** under
  `tr01/c2-identity-validation`. The publisher's GitHub token is supplied
  only by the future reviewed Actions job; no token was obtained here.
- `ledgerly-tr01-c2-identity-status.test.mjs` — pure mocked-response tests for
  the correct SHA and rejection of missing/changed refs, parent/tree/commit
  mismatches, untrusted invocations, API failure and a mismatched status
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

## Dependency-ordered procedure; all live steps require separate approval

1. Approve the protected-main validation code and its narrowly scoped
   `statuses: write` job, with independent review of the exact new main
   workflow/script SHA. Preserve C/C2, existing candidate workflow and
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
   distinct from initiator and Environment approver. The current one-reviewer
   Environment and administrator bypass settings need separately authorised
   correction/verification; do not silently substitute C's exception.
   Independently verify/set the Environment's exact C2 SHA and candidate-ref
   restriction, record a fresh exact-C2 owner attestation, then seek separate
   candidate qualification authorisation.
6. Only then run the unchanged C2 TI-03 workflow on its protected C2 ref
   with disposable PostgreSQL, accepted schema-v2 evidence, its SHA-256,
   negative controls and cleanup. Passing qualification still requires
   separate final implementation-identity approval; it does not activate
   main, production or Phase A.

**Current blocker:** a trusted check producer is only a tested draft, the
required rule is absent, remote C2 is absent, Environment identity cannot be
read, and C2-specific human governance is unresolved. Publication and
qualification were **not** performed. Older package statements that C2 is
not created are stale; its *subsequent gates* remain mandatory.