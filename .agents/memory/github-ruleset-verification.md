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