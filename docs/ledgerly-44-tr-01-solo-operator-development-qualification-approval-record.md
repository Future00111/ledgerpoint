# TR-01 solo-operator development qualification — approval and configuration hold

**Decision date:** 2026-09-25
**Source:** `attached_assets/Pasted-TR-01-SOLO-OPERATOR-DEVELOPMENT-QUALIFICATION-CONTROL-E_1790343115990.txt`
**Approved proposal:** `docs/ledgerly-44-tr-01-solo-operator-development-qualification-proposal.md`
**Status:** DEVELOPMENT-ONLY GOVERNANCE EXCEPTION APPROVED; LIVE CONFIGURATION
NOT COMPLETED; NO QUALIFICATION AUTHORIZED

The owner expressly approved replacing **both** the independent GitHub
Environment approval and separate second-human pre-dispatch review with the
recorded owner attestation for candidate development/disposable PostgreSQL
qualification only. The attachment also authorized live GitHub Environment
configuration followed by read-only verification, but explicitly prohibited
automatic qualification dispatch and Phase A. This approval is not an owner
attestation for a specific future dispatch.

The exact immutable candidate remains
`d292f3a64c6253e022b40de8cf055f3e722ff1ea` on
`refs/heads/tr01/implementation-identity-candidate`. The approved proposal's
other branch-review, workflow identity, Environment SHA/ref restriction,
schema-v2, disposable PostgreSQL, cleanup, and no-production/no-HeliumDB
requirements remain in force. The exception does not apply to 48-B, Stage 3,
production, or any later independent-approval requirement.

## Read-only configuration hold

Before changing the Environment, a read-only GitHub API check of
`Future00111/ledgerpoint` showed the candidate ref at exact C and an active,
exact-ref branch ruleset with deletion, non-fast-forward, and update
restrictions. The ruleset did **not** contain the separately approved
pull-request rule requiring two approving reviews, stale-approval dismissal,
and resolved conversations, or the required identity-recovery validation
status. The branch protection endpoint returned 404 because this branch is
protected by a ruleset, not a classic branch protection rule; the ruleset
itself was inspected. The current `ledgerly-canonical` Environment still has
one required reviewer and protected-branches deployment policy; its approved
candidate SHA Environment variable is absent.

The solo-operator exception expressly preserves those branch review rules.
Removing the Environment reviewer while that independent branch gate is
missing would not produce the approved control state. Therefore **no GitHub
configuration write or workflow dispatch was made**. Do not claim
`TR-01 SOLO-OPERATOR ENVIRONMENT CONFIGURED`. Resolve and verify the missing
branch rules under separate authorization or obtain a further explicit
governance decision before resuming configuration. Preserve immutable C.