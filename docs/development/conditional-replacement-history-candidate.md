# Replacement agreement history — Job 9 candidate

Base: `7f177bc04eedc5c10c211bf864ffe6d36957f604` (preserved Job 8).
Isolated branch: `replit/four-day-job9`. Local AI-authored candidate, not integrated,
independently accepted, or available for public conditional posting.

## Implemented boundary

The existing original agreement, original-posting transaction binding and immutable
consumption remain untouched. A replacement appends an evidence receipt and history
row through a database-owned function. It requires an observed original, current
company membership with owner/admin/accountant permission, explicit attestation,
a new agreement identity, and the exact current predecessor (null for the first).
Evidence uses the existing native terms parser, evidence capture and hash checks.

The database serializes with the native company lock, rechecks permissions, and
enforces one root and one successor. Request replay returns the same receipt;
changed requests and concurrent stale predecessors reject. Evidence insertion and
history insertion roll back together. The runtime has SELECT, not direct mutation
rights; always-enabled triggers reject history mutation, including privileged
UPDATE/DELETE/TRUNCATE. History records actor, database clock and transaction ID.

An agreement that was consumed cannot be replaced, including after compensation.
Replay of a previously recorded history request is readback, never a reset.
Party identity and company-scoped foreign keys prevent cross-company attachment.

This is history, **not payment qualification**. No replacement amount, threshold or
VAT vector is calculated here. No old payment snapshot is relabelled. Both public
posting rejection gates remain unchanged. In addition, native admission and a
database trigger reject redemption of an original with replacement history until
versioned lifecycle support is implemented. There is no public replacement API or
screen yet; that connected work belongs to Job 12.

## Verification and retained failures

Fresh-disposable PostgreSQL cases cover customer and supplier history, exact replay,
conflicting requests, a two-writer predecessor race, new agreement identity,
foreign party/actor, revoked write role, direct SQL permission rejection, visibility
of uncommitted history, rollback of evidence/history, immutable original binding,
immutable history, partial-schema rejection, and consumed-before/after-compensation
rejection. Existing original-binding, posting, payment, correction and report cases
remain in the unchanged runner. Its loopback browser fixtures use synthetic test
authentication, not Clerk or independent human approval.

The first runner failed closed before schema installation because the explicit
migration-order allowlist had not yet been updated. The second reached the new
cases: SQL guards rejected correctly, but assertions exposed wrapped SQL exceptions
at the service boundary. Known guard failures now map to stable domain codes.
Both failed logs and successful cleanup receipts are retained outside source.
An intermediate successful run precedes the additional superseded-redemption
fence; final evidence is bound to the final executable commit in the export.

The incremental review export contains exact source identities, patch, file hashes,
test totals, build/typecheck output, populated/encrypted restore and cleanup receipts.
Nothing was applied to an existing demo or shared database.

## Remaining sequence

Job 10: add fresh committed replacement observation and agreement-version-specific
payment snapshots, eligibility and redemption using existing accounting engines.
Derive financial context and line vectors natively; do not use history terms as a
caller-supplied financial authority. Supersession must invalidate old review without
making earlier payments retrospectively eligible. Retain permanent consumption.

Job 11: implement prior-credit/corrected-original combinations, correction after
credits and corrected supplier returns with cumulative per-line limits.
Job 12: authenticated native review/history/recovery UI and API.
Job 13: extended lifecycle, historical reports and restored executable acceptance.
Job 14: next eligible statutory calculation prerequisite, then only a supported
bounded deterministic calculation slice. Existing official NI references are not
a calculation engine.

These later jobs remain pending. No new financial-policy decision is requested.
No public activation, queue mutation, push, merge, deployment, provider connection,
demo change or existing-database write is authorized by this candidate.
