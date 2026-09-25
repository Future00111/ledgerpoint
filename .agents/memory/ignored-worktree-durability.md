---
name: Ignored worktree durability
description: Why a detached commit in an ignored nested worktree needs a persistent local ref.
---

Do not rely on an ignored nested worktree's detached HEAD as the sole
long-term reference to an important local Git commit. Pin the exact
verified object with a local ref when retaining its identity is required.

**Why:** After a workspace checkpoint, an ignored nested worktree's
files and commit object remained, but its `.git` entry disappeared and
Git listed its registration as prunable. Git operations from that
directory then silently resolved to the parent workspace's branch.

**How to apply:** Before trusting worktree-specific status or HEAD,
check that its `.git` entry exists and that `rev-parse --show-toplevel`
points to the expected worktree. For an approved immutable local
candidate, verify its full SHA, tree, and parent using the main
repository's object database and preserve the object with an exact
local-only ref without rewriting or recreating the commit.