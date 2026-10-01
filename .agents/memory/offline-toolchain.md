---
name: Offline qualification toolchains
description: Build-time Corepack activation must be verified for the final runtime user before isolating the test network.
---

Build-time package-manager activation does not prove that the final
unprivileged container user can invoke that manager offline.

**Why:** A protected hosted qualification built its image successfully but
Corepack attempted a latest-version registry lookup during private-network
bootstrap, failing DNS before database schema push. Preparation had occurred
during image build while execution used the final unprivileged user.

**How to apply:** Validate pinned version resolution and the actual bootstrap
CLI as the final runtime user with networking disabled and a read-only
filesystem before database bootstrap. Verify a missing cache fails closed
rather than selecting/downloading a replacement.
Keep toolchain preparation outside the isolated database phase; do not open
the database/test network to solve package-manager resolution.