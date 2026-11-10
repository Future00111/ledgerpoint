---
name: Restore fixture isolation
description: Restore preparation must not mutate companies used by balance acceptance.
---

Keep native restore-probe writes separate from financial acceptance companies.

**Why:** Choosing any company with a valid witness by random UUID ordering can
add a probe payment to a compensation fixture and change its expected unapplied
balance. A fresh database alone does not isolate suites within that database.

**How to apply:** Select or create a dedicated probe fixture; explicitly exclude
companies whose compensation or replacement historical balances are asserted.
Preserve the financial assertions rather than changing expected totals to
accommodate cross-test writes.
