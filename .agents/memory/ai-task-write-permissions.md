---
name: AI task write permissions
description: Permission rule for persisted AI analysis and task-review operations.
---

Manual AI analysis, task review, and task decisions must require a write-capable company role whenever they persist task, reconciliation-analysis, or activity records. Read-only members may only read task summaries, lists, and details.

**Why:** A refresh may look like a read action, but it synchronizes findings and analysis history. Letting a read-only member invoke it bypasses the accounting workspace's write boundary.

**How to apply:** Treat every endpoint that runs persisted analysis or changes review state as a write operation and use the same company-role guard as other protected accounting actions.