---
name: Evidence provenance trust
description: Keep the authority for expected evidence hashes tied to authenticated runner identity, not test-injected caller inputs.
---

An evidence validator may accept a trusted digest context only when the
context is minted from its own authenticated execution checkout and
runtime identity. A private brand on the context prevents plain-object
forgery but does not establish provenance if the public factory accepts
caller-selected roots or identity variables.

**Why:** An independent security review found that a branded context
could still be minted from attacker-controlled but self-consistent
local Git roots and an invented protected-run environment. The ordinary
qualification call was rooted correctly, but the exported acceptance
boundary was broader than that call.

**How to apply:** Keep production trust builders pinned to their module's
checkout and actual runner environment. To test distinct source roles
without exposing a production injection seam, run the same validator
code inside isolated local fixture checkouts; separately assert that
unbranded or aliased evidence maps cannot be accepted. A digest value
alone cannot prove physical origin when two roles use identical bytes.