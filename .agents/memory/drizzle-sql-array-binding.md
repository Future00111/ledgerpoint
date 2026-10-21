---
name: SQL array binding across the canonical transaction bridge
description: Distinguish PostgreSQL array parameters from Drizzle SQL chunk arrays.
---

Bind PostgreSQL array parameters explicitly as SQL parameters when adapting
parameterized pg queries into a Drizzle transaction. Direct template
interpolation of an array can be expanded as SQL chunks rather than bound as
one PostgreSQL array value.

**Why:** Real authority queries using ANY(uuid[]) failed before reaching any
posting because the adapted array became a record expression. Plain pg tests
alone do not exercise this boundary.

**How to apply:** Keep integration checks on the actual transaction bridge,
including array-valued account validation and authenticated context reads.
Qualify ORDER BY expressions when selecting both a table's original date
columns and formatted projections with identical output names.
