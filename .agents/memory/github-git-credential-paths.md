---
name: GitHub CLI and Git credential paths
description: Authenticated CLI reads and default HTTPS Git pushes can select different credentials.
---

Do not infer that the default HTTPS Git push credential is usable merely
because the Replit Git panel or GitHub CLI is authenticated. If the repository
has no working helper and the existing GitHub CLI session is authenticated,
scope `gh auth git-credential` to this repository with local Git configuration;
do not change global helpers or account credentials.

**Why:** The Replit Git panel and command-line Git used different auth paths.
The default askpass path rejected authentication, while the existing GitHub
CLI helper succeeded. A repo-local helper fixed fresh CLI fetch and no-change
push without exposing or rotating credentials or changing other projects.

**How to apply:** Inspect only sanitized Git config, confirm the exact origin
and branch, and verify the existing `gh` session without printing its details.
Use a repo-local helper only when needed; then test ordinary fetch and no-change
push from a fresh process and confirm the local and remote heads still match.
Never expose tokens, grant permissions, or substitute an API ref write for Git.
