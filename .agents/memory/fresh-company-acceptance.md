---
name: Fresh-company acceptance
description: Why seeded financial fixtures cannot establish first-time business setup acceptance.
---

Exercise native setup writes from an empty company, not only accounting against
preseeded charts, contacts and tax rules.

**Why:** Seed inserts bypass audit dependencies and runtime permissions. A
disposable financial fixture could post successfully while native tax-rule
creation failed because the setup audit table was absent.

**How to apply:** Use existing native creation paths, prove the initial company
is empty, retain setup audits and test runtime privilege limits. Include required
existing audit definitions in fresh disposable schema exports rather than
weakening application behavior. Distinguish native-service/HTTP tests from
actual Clerk and browser acceptance.
