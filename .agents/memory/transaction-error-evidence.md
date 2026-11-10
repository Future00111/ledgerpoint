---
name: Transaction error evidence
description: Distinguishing database guard rejection from the transaction wrapper's SQL diagnostic.
---
When testing a database guard through the native transaction adapter, check the
underlying PostgreSQL error cause, not only the outer exception message.

**Why:** Direct pg queries expose the guard message, while the Drizzle transaction
adapter can wrap the same rejection in a generic query error. Treating them alike
can falsely report a failed guard when it rejected for exactly the intended reason.

**How to apply:** Assert the specific underlying cause for adapter-driven negative
tests. Keep user-facing diagnostics sanitized; outer errors may contain SQL
parameters. A generic assertion that any exception occurred is not sufficient.
