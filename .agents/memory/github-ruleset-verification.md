---
name: GitHub ruleset verification
description: Interpreting protected branch status when GitHub uses repository rulesets rather than classic branch protection.
---

For qualification governance, do not infer approved review or CI-status requirements merely from GitHub's `protected: true` branch flag. Check effective branch rules and inspect the exact matching ruleset's rules, conditions, bypass actors, and enforcement state.

**Why:** A branch may show `protected: true` through a ruleset that enforces only update, deletion, and non-fast-forward restrictions. The classic branch protection endpoint may return 404 despite that active ruleset, while required review and validation-status rules remain absent.

**How to apply:** Before weakening any adjacent Environment gate, compare live effective rules with every approved branch requirement; treat missing reviews or required checks as a configuration hold rather than assuming the protected flag covers them.

Repository `permissions.admin: true` in a GitHub read response does not establish that the connected integration can create or change rulesets.

**Why:** An active, healthy GitHub connection could read rules and report an admin repository role, yet a ruleset-creation request returned `403 Resource not accessible by integration`. GitHub's ruleset-write endpoint requires repository Administration write permission for the integration itself; account role and app installation permissions are distinct.

**How to apply:** Treat that response as a permission block, verify read-only that no rule was created, and do not retry with a token or reauthorize solely on a generic 403. Check the connection's authorization context; only request reconnection if a matching OAuth permission can actually be granted.

Repository metadata `permissions.push: true` also does not establish that a
connected GitHub App can write Git Data objects for a review branch.

**Why:** The same connected repository can report `push: true` while the
first Git blob creation returns `403 Resource not accessible by integration`.
Repository user role and installation-granted Contents write scope are
different authorities.

**How to apply:** On a permission-denied first write, stop; do not request
expanded scopes by default or infer branch/PR creation. Save an exact local
review patch against a verified base instead.

An Environment UI displaying only existing main under "protected branches
only" is not an explicit main-only allowlist.

**Why:** Read-only API evidence distinguished the dynamic protected-branch
mode from selected branch policies while the candidate ref did not yet exist.
The UI display alone could not establish candidate eligibility or denial.

**How to apply:** Read the actual deployment branch policy; preserve the
reviewer gate, verify candidate eligibility after authorised publication,
and inventory shared workflow consumers before changing Environment controls.

Successful authenticated GitHub CLI reads do not prove Git HTTPS push has a
working credential-helper connection.

**Why:** Existing CLI authentication permitted administration readback while
a non-interactive normal Git push failed to obtain a password. The connector
also timed out independently while direct public HTTPS reads succeeded.

**How to apply:** Diagnose these transports separately without exposing
credentials or expanding scopes. After any failed/timed-out push, read back
the target ref before considering a retry; leave authentication repair to
the owner unless explicitly authorised.

When explicitly authorised to reuse the existing authenticated CLI for a
single Git operation, a command-scoped empty credential helper followed by
`!gh auth git-credential` avoids persistent Git configuration changes.

**Why:** This reused the already-authorised account when the default Git
helper could not supply a credential, without login or token extraction.

**How to apply:** Verify non-secret account/repository metadata first; bound
the command, never force/bypass, and read back the remote outcome. Do not use
this pattern to expand authentication or permissions.

Commit-status REST records may expose only a bot creator, not an app ID or
run URL; a bot user ID is not a required-check integration ID.

**Why:** An Actions-published status had neither source field while the
corresponding exact run's check records exposed the GitHub Actions app.

**How to apply:** Combine pinned workflow/token provenance, run and approval
history, status readback and observed app metadata. Pin the required check
source and verify effective enforcement/status association; never treat an
Any-source rule or matching bot name alone as trusted provenance.

Ruleset-derived `protected:true` does not by itself establish Environment
admission under protected-branches-only.

**Why:** After candidate publication, REST reported the ruleset-protected
branch as protected while classic protection was absent and fresh Environment
UI explicitly admitted main only.

**How to apply:** Treat fresh post-publication Environment eligibility
evidence as controlling; stop rather than assume admission. Any exact
selected-branch correction needs owner confirmation of the shared-Environment
impact, preserving required owner review and unrelated main controls.