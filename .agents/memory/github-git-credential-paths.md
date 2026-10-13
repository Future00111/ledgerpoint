---
name: GitHub CLI and Git credential paths
description: Authenticated CLI reads and default HTTPS Git pushes can select different credentials.
---

Do not infer that the default HTTPS Git push credential is usable merely
because authenticated GitHub CLI API reads succeed. Prefer the existing CLI's
credential path for a bounded, normally authorized push when the default
transport fails authentication; keep any helper override command-local.

**Why:** The default normal Git push failed authentication while CLI API reads
worked. Using the CLI Git credential helper for the same ordinary push
succeeded without rotating credentials or altering stored Git configuration.

**How to apply:** Preserve the approved exact refspec and normal non-force
semantics. Never print or extract tokens, silently grant write permissions,
change persistent credential settings, or substitute an API ref write for a
requested normal Git push. A helper-selection retry is not a protection bypass.
