# Proposed draft PR — TR-01 C2 identity status

**Review artifact only; do not merge, dispatch or enable.** The connector
could not create the branch or PR; **Codex later created
[draft PR #10](https://github.com/Future00111/ledgerpoint/pull/10) through
GitHub UI** on `review/tr01-c2-identity-status` at
`a3e486b666c0a3a90a9a6907f45326a60430807f`. On 2026-09-29 the connector reported repository
`push: true`, but its first Git Data write (`createBlob`) returned HTTP 403
`Resource not accessible by integration`. No expanded permission was requested
and no further write was attempted.

- Base: current remote `main` at
  `94cbb98f36a61d2cdb954745a2dff4a1fbfe754c`.
- Exact four-file patch:
  `docs/governance/drafts/ledgerly-tr01-c2-identity-status-review.patch`
  (SHA-256 `be91bc6d9c0efe7b2a1e763d91d292af1c8b75fc60d6d82f6eb86b7a136d5718`).
  Checked with `git apply --check` in a clean detached worktree at that base.
- Historical proposed branch name in this fallback document:
  `review/tr01-c2-identity-status-20260929`; **actual PR #10 branch** is
  `review/tr01-c2-identity-status`. This file is not an authoritative
  readback of PR title/body.

## Proposed PR body

### Review only — no activation

Adds a protected-main manual status-producer proposal, narrowly scoped
publisher, 15 no-network tests, and concise operational gates. The C2 ref is
**not published**. This draft must not be merged or dispatched without separate
approval. It does not change rulesets, permissions, Environment settings,
immutable C/C2 or production, and does not establish TI-03 qualification.

The publisher requires successful pinned-C2 non-DB validation and an exact
independently approved main workflow SHA, then checks the remote C2 ref,
sole parent and tree before posting to the exact C2 SHA. The proposed SHA
variable must be verified at **Environment level**: repository/organisation
fallback can impersonate it. The owner directly observed no Environment
variables or secrets, reviewer Future00111, self-review prevention off,
admin bypass on and main-only protected-branch display. The connector's
separate HTTP 403 on variable read does not contradict that direct UI report.

Before any activation, separately decide and verify the independent reviewer
policy, exact SHA pin, required-status publisher `integration_id` where
supported, creation-only ruleset sequence, exact C2 publication and
C2-eligible Environment binding. Do not use the C-only exception. The
included operational notes contain the stop conditions.

## Proposed diff (exactly four additions)

```text
.github/workflows/ledgerly-tr01-c2-identity-status.yml
scripts/ci/ledgerly-tr01-c2-identity-status.mjs
scripts/ci/ledgerly-tr01-c2-identity-status.test.mjs
docs/governance/ledgerly-tr01-c2-identity-status-operations.md
```

Patch generation and validation were local only. A separate UI-created draft
PR now exists; merging, dispatching or changing controls remain distinct
unauthorised actions.