# TR-01 solo-operator development qualification — proposed governance exception

**Status:** DESIGN / GOVERNANCE PROPOSAL — EXPLICIT APPROVAL REQUIRED
**Scope:** Candidate-mode **development / disposable PostgreSQL** qualification
only. No GitHub configuration, qualification, workflow dispatch, production or
HeliumDB contact, Phase A, or executable/accounting/runtime change is authorized
by this proposal.

## Decision requested

The live repository currently has one active operator/collaborator. The
existing approved qualification contract requires (1) an independent GitHub
Environment reviewer and (2) a distinct second human pre-dispatch reviewer.
Neither can be truthfully supplied by a single owner. The previously approved
independent implementation/security review remains valid evidence but is not
a second person approving the future dispatch or its future Environment
binding.

For **candidate development qualification only**, propose replacing **both**
human gates with a recorded single-owner pre-dispatch governance attestation.
This is an explicit reduction in human separation of duties, **not** an
equivalent GitHub protection or a claim of independent human approval. Until
this exception is explicitly approved, the two existing human gates remain
in force and configuration/qualification remain blocked.

## Proposed candidate-only control

The sole authorized project operator must record and sign a non-secret
attestation **before** initiating the run, outside immutable candidate C.
It must identify the attesting/dispatching actor, decision to authorize this
specific **development** qualification, timestamp, evidence location, and:

1. Full immutable candidate `C =
   d292f3a64c6253e022b40de8cf055f3e722ff1ea`; remote and local
   `refs/heads/tr01/implementation-identity-candidate` tips equal C.
2. Freshly verified candidate branch protection: updates restricted,
   deletion restricted, force pushes blocked, protected-ref status true,
   and no remaining one-time branch-creation bypass. Preserve the approved
   branch review rules unchanged: two approving reviews of exact C, stale
   approval dismissal, resolved review conversations, and the
   identity-recovery validation status. The development exception does not
   waive these candidate branch protections or retroactively substitute the
   owner's attestation for branch review.
3. Exact `ledgerly-canonical` Environment variable
   `LEDGERLY_APPROVED_CANDIDATE_SHA=C` verified by read-back; it is a
   non-secret Environment variable set under repository administration,
   not a caller input, secret, or value alterable by workflow code.
4. Exact workflow identity: `workflow_dispatch` only, workflow source and
   implementation checkout `HEAD=C` in candidate mode, expected workflow path,
   `GITHUB_SHA=C`, `GITHUB_REF` equal to the exact candidate ref, and
   `GITHUB_REF_PROTECTED=true`. Record the workflow-source digest and
   current protection/variable check evidence before dispatch; the running
   workflow must still enforce its own existing fail-closed identity checks.
5. Exact candidate-only Environment deployment-ref restriction verified by
   read-back. GitHub's branch pattern may use the unprefixed branch name
   `tr01/implementation-identity-candidate`; it must match **only** the
   required `refs/heads/tr01/implementation-identity-candidate`, not `main`,
   other branches, tags, or arbitrary refs. Confirm the live matching
   semantics rather than assuming an unrestricted or merely
   protected-branches policy is equivalent.
6. No production or HeliumDB credentials/secrets available to this job from
   the Environment, repository, or organization; no customer data or route to
   those systems. Record names/presence checks only, never secret values.
7. The already approved independent implementation/security review is
   identified as **pre-candidate review**, not as a human pre-dispatch or
   GitHub Environment approval. Retain the implementation package §§6 and 10
   acceptance criteria in full: schema v2 is the only accepted qualification
   evidence version; reject v1, legacy/mixed identities, missing/extra or
   mismatched fields, wrong digest domain, wrong mode/ref/SHA, false ancestry,
   and dirty checkouts. Require fresh disposable PostgreSQL, the database
   security/role/ACL/ownership/trigger checks, canonical posting and
   concurrency evidence, all approved negative controls, and fail-closed
   cleanup binding with verified logical, physical, and credential removal.
   Success cannot be presumed from the attestation or earlier review.

The attestation is a **manual governance gate**. GitHub will not independently
verify its contents or block a deployment for a missing attestation if the
Environment reviewer rule is removed. Do not describe it as dual control,
independent approval, or automated enforcement. The dispatcher must refuse
to dispatch if any check is missing, stale, ambiguous, or failing. Retain the
attestation and read-only evidence with the qualification record; evidence
must not change C.

Only **if this exception receives explicit governance approval and live
configuration is separately authorized** may the `ledgerly-canonical`
required-reviewer rule be omitted for candidate development qualification,
because only the initiator is eligible today. Under that future configuration,
**Prevent self-review is not applicable** when no required-reviewer gate exists;
do not leave a one-person required-reviewer gate that either blocks the run or
is misrepresented as independent review. The Environment, exact C variable,
candidate-only deployment-ref restriction, protected branch, and workflow
identity checks remain required. A separate configuration read-back is
necessary; this proposal itself is not permission to change the live
Environment.

## Boundaries and stop conditions

- This exception does not apply to production, HeliumDB, 48-B,
  protected-main activated qualification, final identity approval, governance
  activation, or Phase A. It creates no precedent for weakening future
  production separation-of-duties or cutover gates.
- The candidate remains a candidate. No branch-history rewriting, expanded
  workflow permissions, modified accounting core, or production access is
  permitted.
- If GitHub cannot enforce the exact protected candidate ref and
  candidate-only Environment deployment restriction, or if C binding,
  no-production/HeliumDB checks, attestation, any database-backed test, or
  cleanup is unproven, **stop**. Do not replace missing evidence with a
  self-review claim or the older implementation/security review.
- Changing the future Environment for activated-mode `main` access is a
  separate approval decision; do not broaden the candidate-only restriction
  under this proposal.

After independent read-only review, explicit governance approval is needed
before amending the currently approved two-human qualification contract.
Separate GitHub configuration approval, a completed pre-dispatch attestation,
and later qualification authorization are still required before dispatch.