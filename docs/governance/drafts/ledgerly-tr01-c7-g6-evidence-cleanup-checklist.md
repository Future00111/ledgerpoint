# Proposed G6 activated evidence and cleanup verification checklist

**Future verification requirements only. G6/G7 PENDING.**
No new activated result, artifact hash or successful accounting test is claimed.

## Preserve original new evidence before interpreting it

1. Retain actual run URL/ID, job ID, attempt 1, dispatch/Environment review
   actor and timestamps. Require `workflow_dispatch`, main, exact G, workflow
   ID/path and activated G/C7 source roles. Retain original full logs,
   API/native control observations and normal owner-review evidence.
2. Download the **original new** artifact
   `ledgerly-ti-03-{actual_run_id}-1`, bound to that exact run/attempt. Preserve
   its original ZIP unchanged. Record artifact ID/name/digest metadata and
   local SHA-256 of the ZIP; reject expired/missing/ambiguous artifacts.
3. Inventory every ZIP member: name, uncompressed size, CRC and SHA-256.
   Reject duplicate/unsafe/unexpected members. Uploaded members must originate
   solely from C7's evidence glob, not root G. Require exact C7 schema bytes
   and exactly the new result evidence; retain any failure evidence without
   treating it as passed.
4. Evidence schema is **version 2**, C7 schema SHA-256
   `6ba3d5f595f81e81db238b843c16b667e775384952855482ce9a978775d6ca0f`.
   Strictly validate schema and the coordinator's source-bound acceptance
   contract. Schema alone does not authenticate a passed document.
5. Record original new evidence member SHA-256, original schema member SHA-256,
   new log ZIP SHA-256 and per-member hashes. Later ZIP exports can differ
   in wrapper/member inventory: reconcile by original archive provenance and
   actual member bytes, never silently replace the original archive hash.
   No future ZIP/evidence hash can be supplied before the run exists.

## Exact separate workflow/implementation source contract

- CI and binding: mode `activated`, workflowSourceCommit exact
  G `706dc6a31f85733ba0c251f40b2c09f5a9312269`,
  implementationSourceCommit exact C7 `787d76decfa345e3c1104231e08d5ab00bc90259`.
- Protected `refs/heads/main`; exact repository/workflow/job, actual run ID/
  attempt 1; ancestry and both clean-checkout attestations true. Match those
  assertions to original logs/run metadata/source receipts, not just JSON.
- Root G provides **workflow only** for these source-digest roles.
  C7 provides the execution tree, application schema, Drizzle config, security
  overlay, run-control SQL, coordinator, canonical test sources, lockfile and
  orchestrator. The C7 workflow digest is **not** the G workflow digest.
- Exact expected activated digests are in `expected-source-bindings.json`,
  derived from actual G/C7 fixture reads. All nine non-workflow roles match
  the accepted C7 evidence, while workflow digest must be G's digest
  `ad06da35f4269fbbf46e1fd4ccabf6082d309963e39b577e17ac948c546afc20`.
- Require fresh unique run UUID/nonce/database identity, exact private binding,
  API runtime/session user `ledgerly_api`, admin creator `postgres`, restrictive
  owner/API privilege separation and empty canonical baseline. No reuse of
  a historical run/database/nonce or caller-selected untrusted root/digest.

## Images, accounting, concurrency and security

- Exact PostgreSQL dependency:
  `postgres:16.15-bookworm@sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825`.
- Exact Node base:
  `node:24.13.0-bookworm-slim@sha256:4660b1ca8b28d6d1906fd644abe34b2ed81d15434d26d845ef0aced307cf4b6f`.
- Verify actual image preparation/inspection, PostgreSQL 16.15, Node 24.13.0,
  pnpm 10.26.1 and per-run test image/source manifest bindings.
  No unpinned/latest replacement or external network to repair an offline error.
- All **six actual canonical accounting tests** must pass with no skips:
  1. Empty API-role disposable database binding.
  2. Balanced immutable journal, audit and retry-safe effect.
  3. Fail closed for stale source/closed period/invalid account/company mismatch.
  4. Atomic audit failure, concurrent retries and additive reversal.
  5. SC-01 company-scoped relation identity, uniqueness and atomic rollback.
  6. Owner journal locks without API mutation privileges.
- Require recorded concurrency overlap: two distinct live PostgreSQL backends/
  transactions reach the coordinated barrier, arrivals/release and actual
  overlap proven; final idempotency/atomicity and journal-lock serialization
  must match. Passing sequential retries alone is insufficient.
- All **18 negative controls** must be true, with intended rejection reasons:
  `missingRunBinding`, `forgedRunDatabaseMismatch`, `malformedUri`,
  `targetChangingQuery`, `wrongHost`, `wrongPort`, `wrongDatabase`, `wrongRole`,
  `parentDatabaseUrl`, `replitMarker`, `inheritedPgOverride`, `unpinnedImage`,
  `untrustedEvent`, `unauthorizedWorkflow`, `cleanupBindingMismatch`,
  `evidenceCredentialPattern`, `roleEscalation`, `triggerDisable`.
- Verify roles/ownership/ACLs/constraints/indexes/triggers/functions, ALWAYS
  guards, no escalation/SET ROLE/disable/delete, SC-01 scope and journal lock
  privilege/search-path protections against actual logs/evidence.
- Isolation: parent DB/Replit vars absent, no published ports, internal network,
  test container no socket or external route, non-root/read-only/no-new-
  privileges/no-capability runtime; no production/Helium contact; secret scan
  passed. Container exit success does not establish these assertions by itself.

## Five cleanup flags — all required, including on failure

- `logicalDrop=true`
- `databaseAbsent=true`
- `containerRemoved=true`
- `networkRemoved=true`
- `credentialMaterialRemoved=true`

Bind cleanup to the exact run/UUID/database/nonce; retain actual verification
logs. Cleanup flags for another database/run do not satisfy this run.
Failure/missing cleanup consumes the single attempt, preserves evidence and
requires a hold; it does not authorize a retry, relaxed isolation, live repair,
closure or production access. Document residual cleanup obligations without
running unauthorized cleanup/control operations.

## Historical reference is not a new result

Historical candidate run `38284785813` attempt 1:
original ZIP SHA-256
`a21a4f0de4938876e5b17457d91a16f177d037af4e5ffcbb258194ccb60f83de`,
evidence SHA-256
`bd6df83ad8c0512db825b7afbc0cb29314c9e04ce1fc13bfe10e368d69a3332b`.
Those apply only to exact C7/candidate mode and must **not** become expected
new activated archive/member/run bindings.

Even complete new technical evidence requires separate **G7 owner acceptance**.
Do not infer production readiness, independent-human assurance, closure,
deployment or Phase A from development qualification.
