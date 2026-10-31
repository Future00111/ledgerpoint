# Persistence contracts for approved development

Contract revision 1; source reviewed: `83ec61812c53d47a14cf1c7bb5d288f5829e2df2`.
This is the P03-00 interface for P03-01–04 and dependent workers. The coordinator
must review it before acceptance. The companion `lib/db/schema-change-registry.json`
is a design inventory, **not an executable migration registry or proof of an
installed schema**. No existing database is changed by either file.

## Existing authority and additive tables

Keep `accounting_document_sources`, canonical journals, payment events, intake
sources and their audit rows authoritative. Do not replace their identities or
copy their financial effects into a second ledger. Existing correction tables
are `accounting_document_amendments` and `accounting_document_amendment_heads`;
the original posted source/journal stays immutable. Amendments and advancing
heads are committed in the same transaction as the correction journal, relation,
posting effect and audit. Their current migration has tenant-qualified foreign
keys and restricted grants; retain these when extending the schema.

Reserve the following additive structures for the named implementation tasks:

| Task | Tables | Required relationship |
| --- | --- | --- |
| P03-01 | `operation_commands`, `operation_outcomes` | One immutable request per company/kind/request ID; at most one terminal outcome per command. Existing protected financial service owns the effect. |
| P03-02 | `durable_jobs`, `durable_job_attempts`, `durable_outbox` | One logical job per command/recipe/source identity, append-only attempt evidence, separately fenced delivery lease. |
| P03-03 | `schema_migrations` | Unique migration ID, immutable SHA-256 and prerequisite IDs; applied row written only in the same transaction as successful DDL/control verification. |
| P09/P10/P11 | `filing_submissions`, `filing_attempts`, `filing_receipts` | One approved frozen payload per filing identity; immutable attempts/receipts linked to it. These names reserve an interface, not filing eligibility or authority. |

New schema SQL must be separately reviewed and tested before use. Do not infer
that these tables exist. An absent feature schema makes its writes unavailable;
a partial or incompatible schema fails closed before any financial or external
effect. Read-only access to unaffected original evidence remains available only
where the existing service explicitly supports that fallback.

## Shared identifiers and replay

* `company_id` is the existing company UUID. Every new tenant-owned primary or
  external reference is checked together with `company_id`; use composite foreign
  keys/unique constraints where another company's UUID could otherwise resolve.
* `request_id` is an immutable client UUID for one intended command. Server
  `operation_id` is a UUID scoped by company and command kind. Unique
  `(company_id, operation_kind, request_id)` maps retries to the original command;
  a different normalized request hash for that key is a conflict, never overwrite.
  Preserve existing correction identity `document-correction:<document_id>:<request_id>`
  and existing payment/intake idempotency keys; adapters reference them instead
  of inventing another posting effect for an old request.
* Store normalized payload SHA-256, contract version, actor identity and reviewed
  source/configuration revision. Authentication and capability checks run again
  on submission **and recovery**. Knowledge of a UUID or an old approval does not
  authorize a removed member or another company to read its result.
* `job_id` identifies one logical job; `attempt_id` identifies a single execution.
  Preserve `document-intake.extraction-job.v1` and its source hash, recipe
  fingerprint, request ID and monotonic revision. A JSON database round trip must
  pass an explicit persistence validator; it cannot be cast into the current
  WeakSet-verified in-memory job object. Lease token plus expected revision fences
  stale completion; expired leases alone cannot validate an old completion.
* `filing_id` identifies one approved company/tax regime/period/payload revision.
  `submission_attempt_id` is distinct from the stable business idempotency key.
  Receipt/provider references are evidence, not command identity or authorization.
  A payload amendment creates a new version linked to its predecessor; never
  rewrite an accepted payload. Do not claim external exactly-once delivery where
  the actual HMRC interface lacks that guarantee.

## Atomicity and unknown outcomes

Acquire the command uniqueness/row lock and recheck source revisions inside the
protected transaction. A successful financial effect, terminal outcome and audit
commit together; rollback leaves none of them committed. A duplicate same-hash
request returns the original result, including after reload or session change.
Never retry an unknown payment/correction outcome with a newly generated key.

Persist an outbox row in that transaction when an authorized external operation is
needed. Network calls occur after commit, outside the financial transaction.
Delivery may repeat: consumers deduplicate by the original identity and completion
requires a matching lease/revision. A timeout after external acceptance is an
`unknown` outcome requiring the actual interface's status/receipt recovery;
it is not evidence of failure or permission to resubmit. Cancellation must fence
future attempts and retain completed/unknown evidence. Jobs prepare reviewable
results; a completed OCR or tax job never posts, pays, files or admits a user.

Exact money remains validated integer-pence strings/BigInt in calculations and
exact database types; no floating point, inferred VAT, or client-authoritative
balances. Effective dates, original revisions, rule versions and source hashes
are retained so historical cutoffs remain reproducible. Store no secrets in job
payloads, diagnostic errors or the queue. Browser storage carries no financial
payload or provider credential; authorization stays on the server.

## Version and migration gate

Each feature declares required migration IDs/checksums and contract versions.
The P03-03 runner must validate actual tables, columns, tenant keys, constraints,
ALWAYS immutable triggers, ownership and grants against the reviewed manifest;
a version row or `CREATE TABLE IF NOT EXISTS` alone cannot attest a schema.
Reject unknown/checksum-mismatched histories and unsupported newer versions.
Runtime startup checks compatibility and reports unavailable features; it never
runs DDL, repairs a partial schema or silently upgrades a business.

Use one explicit migrator and a transaction-scoped migration lock. Apply only
reviewed dependency order. Runtime remains `ledgerly_api` without superuser,
createdb, createrole, replication, bypassrls or canonical-owner membership.
Runtime cannot update/delete/truncate historical journals, audits, receipts or
terminal command evidence. Preserve the canonical owner's NOLOGIN separation.
Rollback/forward-fix plans preserve original evidence and test failures at each
write boundary. Existing-business execution remains an owner-gated action;
this contract only authorizes fresh disposable rehearsal code.

## Verification matrix and present evidence

`tools/accounting-flow/test.mjs` creates a new private Unix-socket PostgreSQL
cluster and synthetic database; it does not use ambient `DATABASE_URL`.
`installSchema(..., {includeAmendments:true})` rejects a nonempty public schema,
checks restricted role flags and canonical ALWAYS triggers. Its restore drill
compares rows plus schema controls, owners and grants and verifies runtime limits.

Existing `amendmentsMath.test.ts` checks both one-table-only amendment schemas
fail with `CORRECTION_SCHEMA_INCOMPLETE` and absent schema preserves originals;
this is a query-mocked unit test, **not a real PostgreSQL migration rehearsal**.
`corrections.integration.test.ts` exercises atomic rollback, immutable SQL
boundaries, head succession and tenant foreign keys in the disposable runner.
Record new exact-commit CI evidence before treating these as this revision's result.

P03-03 must implement executable disposable negative controls for: each missing
required table/column/key/trigger; wrong grants/owner; altered migration checksum;
unknown/newer version; interrupted DDL; failed validation before version commit;
and restored incompatible state. Each must prove zero committed financial writes,
no automatic repair, unchanged original rows and safe error output. Also test
same-hash concurrent replay, changed-hash replay conflict, stale job completion,
and lost response after commit under P03-01/02. The missing real-database partial
schema matrix is explicitly outstanding, so this contract alone does not prove
migration readiness or complete P03-03.


### Disposable amendment-schema matrix (implementation awaiting exact-source CI)

`tools/development/migrations/partial-schema.test.mjs` is now wired into the
existing private Unix-socket accounting runner. It checks seven cases: each
one-table-only amendment schema; complete absence with original-only projection;
a missing lookup column; failed transactional DDL; complete-schema reads under
`ledgerly_api`; and repeated overlay installation refusing a nonempty schema.
It verifies database/user/socket/data-directory identity before alterations,
checks restricted runtime flags and owner separation, rolls test alterations
back, and compares the full database fingerprint (rows, guards, constraints,
indexes, functions, owners and grants). It consumes no ambient connection URL.

These tests preserve the existing correction behavior; they do not install a
production schema gate. The missing-column case currently fails at SQL read
with `42703`, not a typed compatibility error. Checksum/version validation,
individual missing constraints/triggers, wrong ownership/grants, and full
existing-business migration rehearsal remain P03-03 work. Passing syntax and
bundle checks locally is not PostgreSQL evidence: P03-00 acceptance requires
this exact candidate's isolated CI result and coordinator contract review.

## Connected implementation handoff, 31 October 2026

The P03-00 contract is already accepted; do not treat old dependency notes as an
unresolved owner decision. P03-01 now owns the existing payment service, mounted
accounting route/client, recovery tests and disposable schema installer while
claimed. Start with recovery of the existing protected payment request identity:
commit outcome with its existing financial effect, recover after a new client
session, deny removed membership/cross-company reads and changed-intent replay.
Other operation families remain explicit unfinished scope, not implied support.

P03-02 now owns intake contract rehydration, service/router, worker tests and
bounded runtime lifecycle plus disposable schema wiring while claimed. Validate
persisted shape/history, source revision/hash and current membership before
re-branding jobs. Never JSON-cast WeakSet-authorized values. Commit job transition,
audit and outbox together; CAS on tenant-qualified job revision and lease token.
Preserve held transport capacity until actual closure. First acceptance scenario:
enqueue synthetic intake → new repository process → claim → crash → fenced retry
→ reject old completion → exactly one review-required result, no automatic draft.
Include cancellation, revoked membership and other-tenant negative controls.
Keep unconfigured OCR unavailable; synthetic transport tests grant no provider
connection authority. P03-04 owns restore-drill.mjs to connect encrypted new-cluster
recovery to the actual populated accounting/capture fixture before runner cleanup.

These exact-file extensions overlap deliberately with financial/migration tasks;
the scheduler must serialize them, not remove conflicts or dependencies. All
workers stopped before the reviewed catalogue migration. Parent acceptance and
all original priorities are unchanged. Full upgrade, durable multi-operation and
production recovery qualification remain outstanding.
