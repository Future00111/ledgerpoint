---
name: Optional provider isolation
description: Native financial routes must remain usable without an optional AI provider credential.
---
Keep provider construction deferred until an actual provider operation is requested.
Missing optional credentials must fail explicitly at that operation, not at import
of shared native route modules.

**Why:** Credential-free disposable banking tests exposed an eager AI singleton
that stopped native routes before any financial request could be handled.
Banking must not acquire an unrelated provider dependency merely through imports.

**How to apply:** Preserve credential-free native import tests and explicit
unavailable-provider failures. Never substitute fake-success responses or supply
real provider credentials to ordinary accounting regression runs.
