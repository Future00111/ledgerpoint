---
name: API server build quirks
description: esbuild externals and pg runtime resolution — what breaks and why.
---

# API server build quirks

## pg must be external AND installed
esbuild marks `pg` as external (not bundled). But "external" only means the bundle doesn't inline it — Node still needs to resolve it at runtime. So `pg` must also be installed as a direct dependency of the api-server package.

**Why:** Without the `external` entry → build error. Without the package.json dep → runtime `ERR_MODULE_NOT_FOUND`. Both are required.

**How to apply:** Any native-adjacent package needs both: add to the `external` array in `build.mjs`, AND run `pnpm --filter @workspace/api-server add <pkg>`.

## clerkClient is an instance, not a factory
In `@clerk/express`, `clerkClient` is already an instantiated client object. Call it as `clerkClient.users.getUser(id)`, not `clerkClient().users.getUser(id)`.

## Use @workspace/db, not a custom db.ts
Import the Drizzle client from `@workspace/db`. Creating a new `pg.Pool` in a local `db.ts` introduces a second pg dependency and duplicates connection logic.
