---
name: Restore role contract
description: New restricted SQL function owners must survive separate-cluster encrypted recovery.
---
When introducing a dedicated SQL function owner, extend the explicit recovery
role contract alongside the migration. Verify its non-login/no-elevation flags
and deny runtime membership; do not use a privileged runtime as a workaround.

**Why:** Native import tests passed while separate-cluster encrypted restore
failed because the new function-owner role did not exist there.

**How to apply:** A same-cluster restore cannot prove role provisioning: PostgreSQL
roles are cluster-wide. Require the separate-cluster recovery test for role changes.
