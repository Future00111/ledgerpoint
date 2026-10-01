# TR-01 C2 identity status — review-only activation notes

This PR proposes a protected-`main`, manual status producer. A **draft PR is
not approval to merge or dispatch**. Do not put these files on immutable C or
C2. It runs pinned C2 non-DB checks, then requests a separate Environment
release before posting one commit status to exact C2. It neither runs TI-03
PostgreSQL qualification nor approves candidate identity. The validation job
has no status-write permission; the publisher job alone has `statuses: write`.

## Required decisions before any live run

1. Independently review the exact merged workflow **commit SHA** and its
   publisher. `GITHUB_WORKFLOW_SHA` and `GITHUB_SHA` must match that exact
   reviewed commit on protected main. The publisher also requires
   `needs.validate.result == success`, the `identity` job, first attempt and
   manual protected-main dispatch. It posts only after twice reading exact C2
   ref plus its reviewed sole parent and tree. It fails closed without the
   matching effective SHA. The script cannot prove where that value came from.
2. With separate approval, put that exact 40-character SHA in the
   `ledgerly-canonical` **Environment-level** variable
   `TR01_C2_APPROVED_WORKFLOW_SHA` and read it back in GitHub UI before
   dispatch. GitHub `vars` may otherwise fall back to repo/org values: exclude
   substitutes and record who approved any change; a matching inherited
   value is **not** safe source pinning. The owner reported on
   2026-09-29 that this Environment has **no variables or secrets**, reviewer
   `Future00111`, self-review prevention off, admin bypass on and protected
   branch display main only. A connector 403 on variables did *not* establish
   their contents. Verify distinct reviewer approval, prevent self-review
   and address bypass under C2 governance; never use the C-only exception.
3. Separately approve the C2 ruleset amendment **before** C2 publication:
   keep its existing update/deletion/non-fast-forward restrictions and empty
   bypass list; add `required_status_checks` for
   `tr01/c2-identity-validation`, strict mode and
   `do_not_enforce_on_create: true`. Confirm effective rules read-back.
   Restrict `integration_id` to the **observed verified status publisher**
   if GitHub supports this status source; do not guess or treat a context
   alone as provenance. If it cannot be pinned and independently verified,
   stop for a security decision. A main Actions check is not the C2 status.
4. Only after separately authorised exact C2 normal publication, an
   approved main workflow dispatch and an independent Environment release,
   read back the C2 SHA, status context, state, issuer/integration, source
   SHA, validation result and effective required-check rule. A green job
   without a real C2 status is insufficient. C2 TI-03 qualification further
   requires C2-eligible branch policy, exact C2 Environment SHA, original
   human review gates and separate dispatch authorisation.

No workflow dispatch, ruleset, Environment, branch-protection or C2 change is
part of this review proposal.
