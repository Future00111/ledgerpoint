---
name: Offline qualification toolchains
description: Verify offline resolution for the final user and the actual sanitized nested invocation, not just top-level image commands.
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

Every sanitized child-process boundary is a separate toolchain-environment
boundary; success in the top-level image environment is insufficient.

**Why:** A later qualification passed the image's final-user offline smoke,
then its real nested pnpm invocation attempted latest-version resolution
because the launcher discarded the prepared-cache/offline settings.

**How to apply:** Exercise the actual launcher's sanitized environment and
process executor with the real compilation/test command. Include missing-cache
rejection in that same nested path, not only a parallel top-level smoke. Keep
toolchain settings explicitly allowlisted; do not inherit arbitrary parent
credentials to repair resolution.

Fresh-runner diagnostics must explicitly prepare every digest-pinned image
dependency before the isolated phase, not assume a developer's warm cache.

**Why:** A supported hosted replay verified candidate/image bytes but never
started its database fixture because the fixture's intentional pull-never
policy found no cached PostgreSQL image. The local warm cache had hidden this
precondition.

**How to apply:** Prepare and verify pinned dependency images outside the
private database network, retain pull-never inside isolation, and distinguish
preparation failure from database binding or accounting failure.