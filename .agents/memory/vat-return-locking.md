---
name: VAT return locking
description: Concurrency and audit invariants for VAT return approval and recalculation.
---
Approval, recalculation, and their corresponding audit event must use the same database transaction as the conditional `locked = false` return update.

**Why:** Two reviewers can load the same draft at once. A conditional update ensures only the first applicable state transition wins, while one transaction prevents a successful mutation from becoming unauditable if its audit insert fails.

**How to apply:** Keep company scope and the unlocked predicate in every return mutation. Treat a zero-row update as a conflict, and never write a success audit event after the mutation transaction has already committed.