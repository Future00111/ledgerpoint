---
name: TS project references staleness
description: New exports from lib/db aren't visible to api-server typecheck until lib/db declarations are rebuilt
---
The api-server tsconfig uses TypeScript project references to lib/db. After adding exports to lib/db/src/schema, `tsc --noEmit` in api-server reports "no exported member" until the referenced project's declarations are rebuilt.

**Why:** Project references resolve against emitted .d.ts, not source.

**How to apply:** Run `pnpm exec tsc -b lib/db` (or `tsc -b artifacts/api-server`, which builds references) after schema changes, before typechecking dependents.
