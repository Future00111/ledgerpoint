# TR-01 C2 owner-only development qualification — actual approval record

**Decision date:** 2026-10-01. **Status:** approved governance replacement,
not a configuration execution approval, merge approval or run attestation.
Recorded outside immutable C/C2 from the owner's direct instruction in this
conversation, reporting the Codex conversation on that date. The Codex
transcript was not independently retrieved; this record is not a signature.

## Actual decision and exact scope

The owner reports confirming **"just me"** and then explicitly saying
**"you have my approval"** to this exact C2-specific proposal:

> Owner approves exact C2 commit and each qualification run; automated
> checks, immutable branch protection, isolation and cleanup evidence remain
> required; owner approval replaces unavailable independent human reviews
> and is explicitly recorded as such; development qualification only, not
> production release.

This replaces the unavailable independent branch/Environment/pre-dispatch
human-review requirements **only for C2 development candidate qualification**.
It is an owner-only replacement, not independent review. The bounded
candidate is C2 `3ab9edc28b4922ad82e68afb7b049d69514f91e1`, tree
`365303e152430560b828c88165dd8f4d03f2a4fc`, sole parent C
`d292f3a64c6253e022b40de8cf055f3e722ff1ea`, at
`refs/heads/tr01/implementation-identity-successor-c2`.
Owner confirmation of the exact candidate and approval of each concrete
run must be recorded before that run; **no specific dispatch, run ID,
signed attestation or GitHub Environment release is recorded here**.

## Retained gates and exclusions

Retain real source-verified automated validation status, immutable
update/deletion/non-fast-forward protection without bypass, protected-ref
and exact-SHA bindings, disposable PostgreSQL isolation, required negative
controls, schema-v2 evidence and SHA-256, cleanup, and owner evidence review.
Preserve a normal human owner Environment release where supported; do not
remove the reviewer gate merely because independent reviewers are unavailable.

Do not inherit older C-only approvals. This decision does **not** authorise
C2 publication, a particular qualification dispatch, PR #10 merge,
`statuses: write` activation or its main workflow/source pin, blanket main
production-control changes, production release, activated-main qualification,
final authoritative identity designation, Phase A or invoice implementation.
The present instruction authorises local documentation and a proposed control
diff only; **no GitHub changes are applied**.

The existing [operator runbook](drafts/ledgerly-tr01-c2-qualification-operator-runbook.md)
contains the single actionable control diff and remaining dependencies.
Readiness reports reference this decision; historical approval packages
remain historical, not silently rewritten or duplicated.