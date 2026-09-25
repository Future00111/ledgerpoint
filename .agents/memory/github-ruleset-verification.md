---
name: GitHub ruleset verification
description: Interpreting protected branch status when GitHub uses repository rulesets rather than classic branch protection.
---

For qualification governance, do not infer approved review or CI-status requirements merely from GitHub's `protected: true` branch flag. Check effective branch rules and inspect the exact matching ruleset's rules, conditions, bypass actors, and enforcement state.

**Why:** A branch may show `protected: true` through a ruleset that enforces only update, deletion, and non-fast-forward restrictions. The classic branch protection endpoint may return 404 despite that active ruleset, while required review and validation-status rules remain absent.

**How to apply:** Before weakening any adjacent Environment gate, compare live effective rules with every approved branch requirement; treat missing reviews or required checks as a configuration hold rather than assuming the protected flag covers them.