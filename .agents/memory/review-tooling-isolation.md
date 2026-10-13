---
name: Review tooling isolation
description: Keep temporary package tooling and broader test fixtures separate from the minimal host install being validated.
---

Give nested review-tool package directories their own workspace boundary, or
place them outside the application workspace.

**Why:** A temporary parser installation nested under the project discovered
the parent workspace and attempted to reconfigure its dependencies; the
non-interactive removal guard stopped it before removal.

**How to apply:** Do not solve that guard by forcing CI mode against the live
workspace. Establish an isolated tool workspace first and keep application
manifests, lockfiles and installed dependencies untouched.

Validate the actual minimal workflow host installation before adding broader
API dependencies needed only by the review harness.

**Why:** The hosted coordinator requires the root validator, while acceptance
fixtures also import API helpers needing the database driver. A missing driver
in that harness is not evidence that the minimal coordinator install is wrong.

**How to apply:** First prove real candidate-to-host module resolution without
extra links. Supply broader fixture dependencies separately, matching the
immutable API manifest/lockfile; disclose that setup and do not change the
workflow dependency contract just to satisfy the harness.
