# TR-01 solo-operator candidate branch reviews — proposed development exception

**Status:** DESIGN / GOVERNANCE PROPOSAL — EXPLICIT APPROVAL REQUIRED
**Scope:** Exact immutable candidate C, development-only qualification on fresh
disposable PostgreSQL. This document authorizes no GitHub configuration,
workflow dispatch, qualification, Phase A, production, or HeliumDB contact.

## Decision requested

The approved implementation package §8 requires two approving reviews of
exact C, stale-approval dismissal, resolved review conversations, and the
identity-recovery validation status as candidate branch rules. The later
approved solo-operator Environment exception **explicitly preserves** those
branch-review rules; it replaces only the independent Environment approval and
the separate second-human pre-dispatch review. The live exact-ref GitHub
ruleset currently enforces deletion, non-fast-forward, and update restrictions,
but has neither a pull-request review rule nor the required validation status.
`protected: true` is not evidence that either missing rule exists.

With only one active project operator, two independent GitHub pull-request
approvals cannot be obtained honestly. **Propose**, for development
qualification of this already published C alone, replacing the branch's
two-approval, stale-approval-dismissal, and resolved-conversations **GitHub PR
gate** with a recorded single-owner review attestation and the existing
immutable-ref controls. This is an additional, distinct reduction in
separation of duties: the previously approved Environment exception did not
approve it. Do not describe the owner record or the prior independent
implementation/security review as two GitHub reviews, resolved GitHub review
conversations, or independent human approval of C.

The required **identity-recovery validation status is not waived**. It must
be identified unambiguously, produced for exact C, and enforced by the
matching GitHub ruleset with a verified read-back before any qualification
dispatch. If the approved status cannot be identified, produced, or enforced
without altering C, stop and seek a separate decision. This proposal does not
authorize inventing a replacement status, bypassing the check, or treating an
earlier validation run as the required GitHub status.

## Proposed substitute for the PR review gate

Before each candidate-development dispatch, the authorized owner must sign
and retain a timestamped, non-secret attestation outside C, together with
read-only evidence. It supplements the pre-dispatch attestation already
required by the approved Environment exception and may be recorded in the
same artifact if every distinct assertion remains explicit. It must:

1. Identify the actor, full
   `C=d292f3a64c6253e022b40de8cf055f3e722ff1ea`, exact protected
   `refs/heads/tr01/implementation-identity-candidate`, proposed
   development-only run, decision, timestamp, and evidence location. Verify
   both local and remote ref tips still equal C, and record the exact ruleset
   and its current active enforcement state.
2. Confirm the immutable C content and workflow-source digests against the
   approved inventory and independent review evidence. The implementation
   package §8's separate independent review of **exact C** remains a gate:
   locate and verify its record; if it does not exist or is not tied to C,
   stop. The earlier pre-candidate implementation/security review alone
   cannot fill that gate, and this exception does not waive it.
3. Recheck that update and deletion restrictions, the non-fast-forward /
   force-push prohibition, administrator coverage, and absence of a remaining
   branch-creation bypass still hold for this exact ref. No direct push,
   rewrite, merge, new commit, tag substitution, or branch switch is
   authorized. A changed tip invalidates this exception for the run.
4. Confirm the exact-C identity-recovery validation status is successful,
   required by the active matching ruleset, and verified by read-back. Record
   the check identity and result without treating a green unrelated check as
   equivalent. A missing, stale, pending, or failing result is a stop.
5. Review and record any unresolved findings or conversations in the
   independent review evidence; refuse dispatch if a material issue is open.
   This is a **manual review of evidence**, not GitHub-enforced conversation
   resolution or approval dismissal. Recheck C, protection, validation
   status, and evidence freshness immediately before dispatch rather than
   claiming GitHub will dismiss stale attestations.

The owner cannot self-certify independent review or infer that an immutable
branch alone proves security. GitHub will not block dispatch because a manual
attestation is missing. The dispatcher must stop if any required evidence is
absent, inconsistent, or stale. Keep the signed record with qualification
evidence, outside the immutable candidate.

## Unchanged boundaries and authorization sequence

- The existing exact-ref ruleset's update, deletion, non-fast-forward, and
  no-bypass controls remain. Only the named GitHub PR review mechanics are
  proposed for exception; **the required validation status remains a GitHub
  gate**. Ruleset and status configuration need a separate explicit
  authorization and read-only post-change verification.
- The approved development-only Environment exception still requires
  `ledgerly-canonical`, exact
  `LEDGERLY_APPROVED_CANDIDATE_SHA=C`, candidate-only deployment-ref
  restriction, exact `workflow_dispatch`/`GITHUB_SHA=C`/
  `GITHUB_REF_PROTECTED=true` identity, owner pre-dispatch attestation,
  schema-v2 evidence, full disposable PostgreSQL qualification, negative
  controls, and fail-closed logical/physical/credential cleanup. Its
  previously authorized live Environment configuration remains **on hold**
  until this separate branch-review question is resolved; approval of this
  proposal would not itself change live GitHub settings or start a run.
- There is no production or HeliumDB credential, data, route, or contact
  permission. This exception cannot be used for activated `main`, final
  identity approval, governance activation, 48-B, Stage 3, Phase A, or
  production release/migration. Future independent-human requirements are
  not amended.

Only a later **explicit governance approval** may amend the branch-review
clauses in the approved implementation package and Environment exception.
Separate authorization to change the live ruleset, successful read-back of
all retained gates, a completed pre-dispatch attestation, and later
qualification authorization are required before dispatch. Until then, the
configuration hold and existing branch-review requirement remain operative.