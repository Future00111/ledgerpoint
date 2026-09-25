# TR-01 GitHub Environment reviewer semantics — approved correction

**Status:** APPROVED — DESIGN / GOVERNANCE ONLY; CONFIGURATION NOT AUTHORIZED
**Candidate C:** `d292f3a64c6253e022b40de8cf055f3e722ff1ea`  
**Scope:** Reviewer and environment-availability semantics only. This proposal
does not configure GitHub, authorize qualification, amend C, or change the
workflow, runtime, accounting system, or protected accounting-core boundary.

## 1. Correction to the approved qualification contract

The statement in the implementation approval package §9 that “At least two
required environment reviewers must approve the qualification deployment”
must **not** be treated as a GitHub-enforced two-approval control. GitHub lets
an environment list up to six required users or teams, but **one** listed
reviewer approval is sufficient to release a waiting deployment. The
**Prevent self-review** option, when available and enabled, excludes the run
initiator from approving their own deployment. Listing two reviewers is not
equivalent to requiring two approvals.

This correction was subsequently explicitly approved as design/governance only
and is reflected in the implementation approval package §9. It does not
authorize Environment configuration or qualification.

## 2. Corrected candidate qualification gates

1. Preserve the exact protected, immutable candidate branch
   `refs/heads/tr01/implementation-identity-candidate` at exact C. Retain
   the approved branch rules, reviews, no-force-push/no-deletion restrictions,
   and removal of the one-time bootstrap bypass before qualification.
2. Invoke the qualification workflow **only** by `workflow_dispatch` on that
   exact protected ref; require protected-ref confirmation and exact
   `GITHUB_SHA=C` and checkout `HEAD=C`. Do not use a mutable branch tip as a
   substitute for C.
3. Use GitHub Environment `ledgerly-canonical`. Where the feature is
   available, configure required reviewers and enable **Prevent self-review**.
   Require at least **one** GitHub Environment approval from a listed reviewer
   other than the person who initiated the run. Never describe this as
   two GitHub Environment approvals or permit an unrecorded administrator or
   automation bypass.
4. Repository administration alone binds the non-secret Environment variable
   `LEDGERLY_APPROVED_CANDIDATE_SHA` to exact full C:
   `d292f3a64c6253e022b40de8cf055f3e722ff1ea`.
   The workflow must not be able to alter the value. Confirm the variable is
   exposed to the environment job and that workflow, checkout, protected ref,
   and environment identities all equal C before qualification.
5. If two distinct human approvals remain policy, obtain the **second** as
   a separate **pre-dispatch governance/evidence gate** over exact C, the
   protected ref, the workflow to be dispatched, and the environment binding.
   Record the reviewer identity, decision, C, ref, binding, timestamp, and
   review artifact outside C. This reviewer must be distinct from the
   dispatch initiator and the intended Environment approver. The authorized
   dispatcher must check and retain that record before dispatch. This is a
   human process gate, **not** a second native Environment approval or an
   automatically enforced workflow check. Any retained two-person requirement
   must explicitly approve this separation and its evidence procedure.

This reviewer correction does not add or change an Environment deployment-branch
policy. The approved protected candidate branch and exact-ref workflow checks
remain required; any additional Environment branch policy must be reviewed
separately, including its effect on later activated-mode access from `main`.

The candidate PostgreSQL qualification, evidence, isolation, security, and
cleanup requirements remain unchanged. This correction grants no permission
to contact production or HeliumDB, configure GitHub now, or run Phase A.

## 3. Availability and fallback decision

At proposal drafting, read-only public GitHub repository metadata reported
`Future00111/ledgerpoint` as **public**. GitHub documents required Environment
reviewers, deployment-branch restrictions, and Environment variables for
public repositories on current plans (legacy plans are an exception). The
public account/repository API does **not** expose the owner's actual plan;
availability for this repository was therefore **eligible by documented
visibility, not yet proven in live settings**. The subsequent read-only
Environment capability finding is recorded in the approval record. Before
configuration or dispatch, repository administration must still read back
the effective settings; this correction did not change them.

If native required reviewers or Prevent self-review cannot be enforced,
**do not claim a native approval or dispatch under the current contract**.
The smallest truthful alternative for separate explicit approval is an
out-of-band, pre-dispatch governance gate: two distinct human approvals
recorded against exact C, ref, workflow, and Environment binding, with the
dispatcher distinct from both approvers and a repository administrator
checking the record before dispatch. Keep the exact protected branch,
`workflow_dispatch` identity checks, Environment and exact C variable,
disposable PostgreSQL qualification, and all evidence/security/cleanup gates.
Document clearly that GitHub will **not** automatically block a run for lack
of these external approvals. If automatic independent approval is required
as a non-negotiable qualification control, or this alternative is not
explicitly approved, qualification remains **blocked**; do not silently
substitute a wait timer, a reviewer list without an enforceable approval, or
ordinary branch reviews.

## 4. Approval boundary and sources

Explicit governance approval was granted for replacing the conflicting
sentence in the existing implementation approval package, but separate
configuration approval remains required before any GitHub Environment
changes or candidate qualification. C is still a
candidate, not an authoritative implementation identity. Final identity
approval, governance activation, activated qualification, and Phase A remain
separate later gates.

GitHub documentation consulted:

- [Deployments and environments: Required reviewers, Prevent self-review,
  deployment branches, and plan availability](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [Managing environments for deployment: public-repository availability and
  reviewer setup](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)