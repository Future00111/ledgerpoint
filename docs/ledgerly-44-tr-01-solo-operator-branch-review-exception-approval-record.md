# TR-01 solo-operator candidate branch review — approval and execution hold

**Decision date:** 2026-09-25
**Source:** `attached_assets/Pasted-TR-01-SOLO-OPERATOR-BRANCH-REVIEW-EXCEPTION-EXPLICIT-GO_1790345388982.txt`
**Approved proposal:** `docs/ledgerly-44-tr-01-solo-operator-branch-review-exception-proposal.md`
**Status:** DEVELOPMENT-ONLY GOVERNANCE EXCEPTION APPROVED; LIVE CONFIGURATION
NOT COMPLETED; EXACT-C INDEPENDENT REVIEW FAILED; QUALIFICATION BLOCKED

The owner expressly approved replacing the candidate branch's two GitHub PR
approvals, stale-review dismissal, and conversation-resolution requirement
with a recorded owner attestation for development qualification of immutable
candidate `C=d292f3a64c6253e022b40de8cf055f3e722ff1ea` only. The
attachment separately authorized configuring the amended solo-operator
GitHub controls and required verification before stopping; it did **not**
authorize qualification dispatch, Phase A, a changed candidate, or weakening
the required validation status or independent exact-C implementation/security
review. It is not a pre-dispatch owner attestation.

## Read-only gate verification before configuration

- Remote `refs/heads/tr01/implementation-identity-candidate` still pointed to
  exact C. Its active matching ruleset had no bypass actors and enforced
  update, deletion, and non-fast-forward restrictions. It did **not** require
  the identity-recovery validation status.
- GitHub's commit-status API for C returned `pending` with no individual
  statuses. The check-runs API returned zero check runs for C. Thus
  **REQUIRED VALIDATION STATUS: ABSENT / NOT PASS**. No check was invented,
  posted, or treated as equivalent to the approved identity-recovery status.
- A fresh independent read-only implementation/security review of **exact C**
  returned **FAIL** against implementation-package §6's wrong-digest-domain
  rejection requirement. In C's evidence schema, `binding.sourceDigests` is
  permitted but not required; the passed-evidence acceptance validator checks
  identity agreement without checking workflow digest attribution to S and
  implementation digest attribution to C. This permits missing or
  misattributed digest evidence to pass that acceptance check. The run
  producer computes digests from their intended source trees, but that does
  not fulfill the required rejection of malformed passed evidence. The
  existing focused tests do not establish wrong-domain passed-evidence
  rejection. This review was of code and governance evidence, **not** a
  PostgreSQL qualification or a human GitHub PR approval.
- `ledgerly-canonical` still had its original required reviewer and
  protected-branches deployment policy; its
  `LEDGERLY_APPROVED_CANDIDATE_SHA` Environment variable was absent. Those
  GitHub settings were read only.

The approved exception does not waive either failed gate. C must remain
immutable: do not silently repair or replace it, fabricate a validation
status, or use an older pre-candidate review as a PASS for exact C. The
approved proposals require a separate decision if validation cannot be
established without changing C, and a new candidate identity/review process
for any code correction. **No live GitHub configuration write or qualification
dispatch was made.** Do not report `TR-01 SOLO-OPERATOR CANDIDATE CONTROLS
CONFIGURED`. Production and HeliumDB contact remain prohibited.