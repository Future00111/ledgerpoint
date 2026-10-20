---
name: API HTTP test bundling
description: Build constraint for the API's HTTP integration tests that import the Express application.
---
The API HTTP integration test must bundle as CommonJS and leave Pino's runtime packages external.

**Why:** Pino loads its worker through CommonJS runtime resolution. An ESM bundle with a synthetic require bridge causes ambiguous-module errors, while a fully bundled CommonJS test looks for the worker beside the generated test file.

**How to apply:** When adding app-level HTTP tests, keep the dedicated test command's CommonJS format and its Pino, Pino HTTP, Pino Pretty, and thread-stream externals. Run the named integration test after changing its imports or build flags.

Node `--import` test preloads also execute in Pino worker threads. Guard any preload `process.chdir()` with `isMainThread`.

**Why:** A pure scenario suite passed its individual assertions but still failed after completion because an inherited preload tried to change directory inside a logging worker.

**How to apply:** Use explicit entry paths and establish the scenario test's source-root working directory only in the main thread. Do not suppress worker errors to make the suite pass.