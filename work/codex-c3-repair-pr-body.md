The C3 forged-binding probe fails before reaching PostgreSQL because the runtime runner hashes the CI coordinator as the orchestrator source. This patch hashes sourceFiles.canonicalCoordinator instead, preserving the private-binding verifier and all fail-closed checks.

Exact review commit: 9d50d4e86696fd18eb7f877c9edfaba710b3572e; sole parent: C3 1c26be19295902a38e1939b56ff99ae9a195d3de. This draft compares against the ordinary review branch at exact C3. It must not be merged into the frozen C3 branch or treated as qualification.

Validation: the identity/acceptance validator suite and Git whitespace checks passed again in the restored checkout. The retained repair report records 5/5 disposable PostgreSQL binding regressions passing. The separate Drizzle SQLSTATE 42830 bootstrap error remains unresolved, and full canonical posting/concurrency qualification has not passed.

Scope: one-line runtime correction, manual disposable binding regression fixture, and repair report. No Environment pins/admissions, protections, workflow dispatch or production/Helium access changed.
