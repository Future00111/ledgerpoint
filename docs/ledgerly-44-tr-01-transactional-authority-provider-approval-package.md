# #44-TR-01 Transactional Authority Provider and Final Revalidation — Implementation Approval Package

**Status:** PLANNING / APPROVAL ONLY — NO IMPLEMENTATION AUTHORISED  
**Proposed sub-task:** `#44-TR-01 — Transactional Authority Provider and Final Revalidation`  
**Parent:** `#44 — Canonical Posting Safety Enforcement`  
**Scope:** Development canonical-posting service boundary and its approved disposable-database tests  
**Dependencies:** `#44-SC-01` complete; `#44-RS-01` complete  
**Governance baseline:** DEC-01 through DEC-22 APPROVED  
**Decision requested:** Approval to implement this exact development-only design

> This document is a planning and approval package. It does not modify
> application code, schema, data, roles, privileges, secrets, `DATABASE_URL`,
> workflows, infrastructure, deployment, publishing, production, accounting
> data, or project-task state. It does not create an implementation task.

## 1. Purpose and remaining boundary

The final #44 completion assessment found that the persistence boundary,
relation/economic-effect identity, development role separation, and disposable
canonical test database are in place. It also found that the current posting
service still delegates final authority to ordinary provider reads.

The smallest remaining implementation boundary is therefore:

**Transactional Authority Provider / Final Revalidation**

TR-01 will make every consequential canonical posting, correction, and reversal
use one transaction-aware authority contract. The contract will:

- acquire the approved `SELECT ... FOR UPDATE` locks in one deterministic order;
- re-read and validate authoritative state after those locks and before any
  accounting insert;
- use the same transaction handle for authority, identity, canonical,
  relation, effect, and audit work;
- fail closed when an authority cannot participate in that transaction; and
- provide bounded, non-blind recovery for duplicate, pending, uncertain,
  timeout, and lock-contention outcomes.

TR-01 does not complete BL-06 or BL-07, enable production posting, create
missing accounting product domains, or replace any completed RS-01/SC-01
protection.

## 2. Governing requirements and non-goals

TR-01 implements the already-approved requirements in:

- `docs/ledgerly-44-immutability-and-final-revalidation-approval-package.md`;
- `docs/ledgerly-source-freshness-posting-safety-contract.md`;
- `docs/ledgerly-safety-rule-ownership-record.md`;
- `docs/ledgerly-44-sc-01-canonical-relation-economic-effect-identity-approval-package.md`;
  and
- `docs/ledgerly-44-rs-01-development-database-role-separation-approval-package.md`.

The following remain outside scope:

- new invoice, bill, payment, bank, reconciliation, VAT-return, period,
  financial-year, mapping, or configuration product workflows;
- new product tables or unapproved revision columns;
- historical migration, backfill, reinterpretation, or cutover;
- RLS or a replacement tenant-isolation architecture;
- generic CRUD redesign;
- queue, worker, scheduler, provider-platform, backup, or infrastructure
  selection;
- deployment, publishing, production schema/data/roles/secrets, or production
  posting;
- unblocking BL-06, BL-07, or executing #41; and
- assigning source freshness to DEC-12 or creating DEC-23.

The existing `ledgerly_api` / `ledgerly_canonical_owner` boundary,
`ENABLE ALWAYS` triggers, SC-01 company-scoped relation identity, BL-01-FI
Principal and Tenant Guard, and disposable canonical test database are
mandatory foundations and must not be weakened or replaced.

## 3. Authoritative transaction boundary

### 3.1 Isolation and transaction start

The canonical service will use PostgreSQL `READ COMMITTED` with explicit
row-level locks. `READ COMMITTED` is sufficient only because every
operation-relevant authority is locked and revalidated before the write. The
service must not use an ordinary-read fallback and must not claim that
`READ COMMITTED` alone provides freshness.

The transaction starts at the first service operation:

```text
db.transaction(async transaction => { ... })
```

No source, company, membership, account, period, configuration, mapping, VAT,
balance, or original-journal authority read may be performed before that
transaction and then reused as final authority.

The transaction-local lock policy is:

- `lock_timeout = 2000ms`;
- the existing application statement timeout remains the outer bound;
- lock timeout (`55P03`) and deadlock (`40P01`) abort the transaction; and
- neither timeout nor deadlock is converted into success or an ordinary
  validation failure.

The exact timeout values are operational implementation parameters, not a
permission to wait indefinitely or bypass a lock.

### 3.2 Final revalidation and write sequence

Every ordinary post follows this sequence:

1. Begin the transaction.
2. Establish the authenticated user or explicitly scoped system principal.
3. Resolve the company from server-side source/resource authority.
4. Acquire all authority locks in the order in section 4.
5. Re-read every captured token and operation-relevant value from the locked
   rows.
6. Re-evaluate membership, capability, company ownership, source status,
   posting date, financial year, period, configuration, mapping, VAT, account
   eligibility, source-specific state, and command identity.
7. Build server-generated lines from the locked validated context. The line
   builder is pure and may not perform an ambient database read.
8. Validate balanced minor-unit lines, currency, source links, effect identity,
   and all canonical invariants.
9. Resolve or insert the company-scoped posting effect under its unique
   identities.
10. Insert the canonical header and lines.
11. Insert the SC-01 relation when the operation is a correction or reversal.
12. Insert the success audit event.
13. Finalize the effect only through the approved constrained transition.
14. Commit.

The final revalidation point is after step 5 and immediately before step 9.
No accounting insert is permitted between authority lock acquisition and final
validation. No authority may be unlocked or re-read through another connection
before commit.

### 3.3 Rollback behavior

Any validation failure, authorization conflict, stale token, missing provider,
lock timeout, deadlock, uniqueness conflict, line failure, relation failure,
effect failure, audit failure, or unknown exception rolls back the entire
transaction. A failed operation leaves no journal, line, relation, success
audit, or posted effect.

An authorization or stale outcome may be recorded as bounded rejection
evidence only through an explicitly approved company-scoped path; such evidence
must never be allowed to commit a canonical accounting effect after the main
transaction rolls back.

The commit boundary includes the canonical header, lines, relation, posting
effect result, and success audit. A response is not considered successful until
the commit resolves successfully.

## 4. Ordered `SELECT ... FOR UPDATE` contract

### 4.1 Global lock order

Every canonical command acquires locks in this exact order:

1. resolved company row;
2. source row and normalized source-evidence row;
3. all matching active-membership rows for the actor, sorted by membership ID;
4. all resolved account rows, sorted by account ID;
5. all DEC-10 mapping rows used by the operation, sorted by mapping ID;
6. the selected DEC-11 configuration-version row;
7. the resolved financial-year row;
8. the resolved accounting-period row;
9. source-specific balance/state rows, sorted by stable primary key, where
   applicable;
10. the original canonical journal row for correction or reversal; and
11. the company-scoped posting-effect identity rows.

A provider may acquire multiple rows for one authority, but it must sort them
by stable primary key and may not use caller-supplied order. Providers may not
acquire a later-order lock and then return to an earlier-order authority.

The effect identity is resolved only after authority locks. Unique indexes
remain the database defence-in-depth mechanism for races, not the primary
freshness or original-journal serialization mechanism.

### 4.2 Authority-by-authority contract

| Position | Authority | Required record and lookup | Lock | Values revalidated after lock | Missing/change result |
|---|---|---|---|---|---|
| 1 | Company/resource ownership | Company row by server-resolved company ID, together with the source/resource owner ID | `FOR UPDATE` | Company identity, active state where applicable, source owner, requested-company agreement | `COMPANY_SCOPE_CONFLICT`; absence is authoritative |
| 2 | Source/evidence | Company-owned source row by stable source ID plus normalized evidence row when separate | `FOR UPDATE` on every local authoritative row | Source type/ID, company, status, postability, material fields, revision/event token, evidence hash | `STALE_SOURCE`, `COMPANY_SCOPE_CONFLICT`, or `RETRY_REQUIRED`; absence is authoritative |
| 3 | Human authority | All `company_users` rows matching user and resolved company, sorted by membership ID | `FOR UPDATE` | Membership existence, `is_active`, role, capability, revision/updated value, duplicate-role agreement | `AUTHORIZATION_CONFLICT`; zero rows is authoritative denial |
| 4 | Accounts | Every resolved account row by stable account ID, sorted by ID | `FOR UPDATE` | Account company, active state, eligible classification, currency, revision/updated value | `STALE_CONTEXT` or `ACCOUNT_INVALID`; absence is authoritative |
| 5 | DEC-10 mappings | Protected company mapping row for each role used, sorted by mapping ID | `FOR UPDATE` | Mapping company, role, immutable mapping version, resolved account IDs, effective bounds | `STALE_CONTEXT`; absence is authoritative |
| 6 | DEC-11 configuration | Immutable effective configuration version selected by company and posting date | `FOR UPDATE` | Version identity, company, effective bounds, expected configuration identity | `STALE_CONTEXT`; absence/ambiguity is authoritative failure |
| 7 | Financial year | Company financial-year row containing the final posting date | `FOR UPDATE` | Year identity, company, bounds, version, exactly-one-match result | `STALE_CONTEXT`; absence or ambiguity is authoritative failure |
| 8 | Accounting period | Company period row containing the final posting date | `FOR UPDATE` | Period identity, bounds, company, version, state, postability | `PERIOD_CLOSED` or `STALE_CONTEXT`; absence is authoritative failure |
| 9 | Source-specific state | Payment, allocation, credit, prepayment, refund, reconciliation, or migration state rows, where applicable | `FOR UPDATE` in stable key order | Current balance, settlement/exception state, source version, company, eligibility | `STALE_CONTEXT`, `IDENTITY_CONFLICT`, or `RETRY_REQUIRED`; absence is authoritative when required |
| 10 | Original journal | `canonical_journal_entries.id` for correction/reversal | `FOR UPDATE` | Company, `posted` status, complete header/line identity, unchanged source/effect context | `JOURNAL_NOT_FOUND`, `COMPANY_SCOPE_CONFLICT`, or `CORRECTION_INVALID` |
| 11 | Command identity | Company + idempotency key and company + economic-effect ID | `FOR UPDATE` when rows exist, otherwise atomic insert under unique indexes | Existing command fingerprint, source, operation, effect identity, status, journal/result | `DUPLICATE`, `IDENTITY_CONFLICT`, or `RETRY_REQUIRED` |

An authority provider must expose the table/record identity and captured token
that it locked. It is not sufficient to return a DTO, a browser snapshot, an
AI recommendation, or an ordinary read labelled “current.”

The current workspace does not provide authoritative product tables for every
period, financial-year, DEC-10 mapping, DEC-11 configuration, VAT, or
source-specific workflow. TR-01 must not invent those domains or use unrelated
tables as substitutes. Until an approved provider exposes the required local
row and lock operation, that operation is unsupported and fails closed with
`RETRY_REQUIRED`; production posting remains disabled. Controlled disposable
tests may use an explicit test provider only when that provider performs the
same transaction-aware lock contract against its declared fixture authority.

## 5. Provider interface contract

### 5.1 Required interface shape

The current abstractions `sourceProvider.getCurrent` and
`contextProvider.resolve` are insufficient because they permit an ordinary
unlocked read to be returned as final authority. They will be replaced or
strengthened with explicit transaction-aware operations equivalent to:

```ts
interface TransactionalAuthorityProvider<Input, Locked> {
  lockForPosting(
    input: Input,
    transaction: DatabaseTransaction,
  ): Promise<LockedAuthority<Locked>>;
}

interface LockedAuthority<T> {
  authority: T;
  recordKeys: readonly string[];
  capturedToken: AuthorityToken;
  lockMode: "FOR UPDATE";
  transactionBound: true;
  validateCurrent(input: AuthorityValidationInput): AuthorityValidation;
}
```

The concrete implementation may use different TypeScript names, but it must
preserve these guarantees:

- the active transaction handle is mandatory and cannot be omitted;
- company ID, command identity, and source identity are mandatory inputs;
- expected revision/version/hash is explicit where applicable;
- the result identifies the locked primary keys and lock mode;
- a provider must return a locked current result, not a pre-transaction read;
- the final validator compares expected and current values after lock
  acquisition;
- absence, unsupported authority, weak evidence, and provider failure are
  explicit outcomes; and
- a provider cannot silently downgrade to an ordinary read.

The service must not expose a generic `getCurrent` method on the canonical
posting dependency used for final authority. Any read-only preview/provider
method must be named and typed as non-authoritative and must be unusable by the
canonical write path.

### 5.2 Existing call sites requiring change

The implementation approval must cover:

- `artifacts/api-server/src/services/accounting/canonicalPosting.ts`:
  `CanonicalPostingDependencies`, source/context resolution, membership
  lookup, account/context validation, original-journal lookup, effect
  resolution, retry handling, and error mapping;
- `artifacts/api-server/src/services/accounting/canonicalPosting.integration.test.ts`:
  provider fixtures, synchronization barriers, database assertions, and
  cleanup-free disposable execution;
- any future canonical service caller that supplies a source or posting
  context; callers must provide an envelope and cannot provide authority by
  ambient request state;
- the existing company-scope helper path, which must remain the BL-01-FI
  authorization mechanism but run against locked membership state; and
- the error/result contract used by any future canonical route or job. No
  production route is authorized by this package.

The line builder remains server-side and must receive only the locked,
validated source/context. It may not query a second database connection or
replace a locked value with caller input.

## 6. Source freshness and final revalidation

### 6.1 Captured-versus-current semantics

A command envelope is evidence to compare, never permission to post. The
envelope must bind:

- company and source identity;
- source revision/event sequence or normalized evidence hash;
- material source status and operation-relevant fields;
- posting date and expected financial year/period;
- configuration and mapping identities;
- account identities and eligibility tokens;
- VAT profile/rule/evidence context where applicable;
- source-specific balance/state versions where applicable;
- actor, capability, approval/expiry context where required; and
- command, idempotency, and economic-effect identities.

The locked provider result is compared with that envelope immediately before
the first accounting insert:

- changed source revision/hash/material field -> `STALE_SOURCE`;
- changed source/company owner -> `COMPANY_SCOPE_CONFLICT`;
- changed membership/capability -> `AUTHORIZATION_CONFLICT`;
- changed account/mapping/configuration/year/period/VAT/balance ->
  `STALE_CONTEXT` or the more specific closed/unsupported result;
- changed command meaning under an existing identity -> `IDENTITY_CONFLICT`;
- missing or weak revision/evidence -> `RETRY_REQUIRED` or
  `source_identity_missing`, never an invented revision; and
- unsupported external authority without a conditional/version guarantee ->
  `RETRY_REQUIRED` with no accounting effect.

`sourceStatus` and `isPostable` are both validated. A caller-supplied
postability flag is never authoritative.

### 6.2 Queued and approved actions

Queued, approved, imported, AI-generated, or retried commands must carry their
source/context envelope and expiry metadata. Final posting revalidates the
current source, authority, approval, configuration, mapping, VAT, balance, and
period state. A stale queue item is rejected and requires fresh analysis or
approval; it is never replayed because it was previously approved.

Source freshness remains an implementation-level posting-safety contract. It is
not assigned to DEC-12, and no DEC-23 is created.

## 7. Membership, company, and account authority

The locked source/resource company is authoritative. Caller company input may
agree with it but cannot replace it. Malformed, missing, or conflicting caller
context fails closed before a cross-company read or write.

For a human principal:

- all matching membership rows are locked in stable ID order;
- zero active rows deny the operation;
- conflicting active rows fail closed rather than selecting an arbitrary role;
- the exact capability is evaluated from the locked current role; and
- a role or active-state change before final validation produces
  `AUTHORIZATION_CONFLICT`.

For a system principal:

- company ID is mandatory;
- the exact capability is mandatory;
- an unscoped or globally inherited principal is rejected; and
- the principal identity and capability are retained in audit context.

Every account row used by the line builder is locked and revalidated for
company ownership, existence, active state, eligible classification, and
currency compatibility. Account IDs are sorted before lock acquisition.

## 8. Period, configuration, mapping, VAT, and source-state authority

The final posting date is validated as an actual ISO calendar date and is
resolved against the locked company financial year and accounting period. The
service must reject an absent, ambiguous, outside-bounds, closed, or otherwise
non-postable period. Year-end remains reporting-only; TR-01 must not generate
closing or retained-earnings journals.

The DEC-11 configuration version is selected by company and final posting date,
locked, checked for effective bounds, and compared with the envelope. A
caller-provided configuration ID cannot select an otherwise invalid version.

Every DEC-10 control mapping used by a posting is resolved by its protected
company-scoped mapping row, locked, and checked for immutable version and
resolved account identity. Missing or future-incompatible mappings fail closed.

For VAT-affecting sources, the provider must lock/revalidate the supported VAT
profile, tax rule/effective date, source tax evidence, deterministic
calculation/result, return/lock state, and protected VAT account mapping.
Bank settlement, AI output, or stale analysis cannot replace invoice/source VAT
evidence. If the required VAT authority cannot participate, the operation is
unsupported and does not post.

For payment, allocation, credit, prepayment, refund, reconciliation, or
migration commands, the relevant current balance and state rows are part of the
same lock/write boundary. No over-allocation, duplicate cash effect,
unauthorized refund, or invented migration fact may pass through a generic
canonical command.

## 9. Original-journal serialization

Every correction or reversal locks the original journal at lock-order position
10 before checking relations or inserting an effect. The locked original must
be a complete `posted` journal in the authoritative company.

After the original lock:

1. re-read its company, status, lines, source/effect identity, and immutable
   fields;
2. load existing relations for that original under the same transaction;
3. reject a second reversal deterministically without relying on a raw
   uniqueness exception;
4. allow a correction only when its company-scoped identity is distinct and
   valid;
5. resolve the new effect identity after the original lock;
6. insert the new journal, lines, SC-01 relation, effect, and audit atomically;
   and
7. leave the original header and lines unchanged.

The SC-01 indexes remain defence-in-depth:

- one reversal relation per original;
- one correction/reversal relation per
  `(company_id, original_journal_id, economic_effect_id, relation_type)`; and
- company-scoped idempotency/economic-effect uniqueness.

The service maps a losing second reversal to `IDENTITY_CONFLICT`, not a raw
database error. Same-meaning retries return `DUPLICATE`. Correction-versus-
correction and correction-versus-reversal operations serialize on the original
row and each independently revalidate the current context.

## 10. Idempotency, economic effect, and uncertain outcomes

The identities remain:

- request identity: `(company_id, idempotency_key)`;
- posting identity: `(company_id, economic_effect_id)`;
- correction identity: `(company_id, original_journal_id,
  economic_effect_id, relation_type='correction')`; and
- reversal identity: `(company_id, original_journal_id,
  economic_effect_id, relation_type='reversal')`.

The required behavior is:

| Existing state | Exact same meaning | Changed meaning or identity conflict | Result |
|---|---|---|---|
| No effect row | Continue after all authority locks | N/A | One atomic post |
| `pending` | Do not create a second effect; inspect under identity lock | Do not overwrite identity | `RETRY_REQUIRED` unless the same transaction owns completion |
| `posted` with complete matching result | Return stored journal/effect/totals | Reject changed fingerprint | `DUPLICATE` or `IDENTITY_CONFLICT` |
| `uncertain` | Resolve only through the same company-scoped identities | Never create a second effect | `RETRY_REQUIRED` |
| Transaction rolled back before commit | Full command may be retried with the same identities | Changed command is a conflict | Full final revalidation, then post or reject |
| Commit succeeded but response was lost | Query identity before any replay | Never guess rollback | Stored result / `DUPLICATE` |

The command fingerprint includes source identity/tokens, operation, intended
economic effect, posting date, configuration identity, currency, description,
reference, and server-generated lines. A request or effect identity reused for
different meaning is never treated as a safe retry.

The service must not turn an existing pending or uncertain row into a new
posted effect. The existing RS-01 trigger remains the only authority for
allowed effect transitions. TR-01 may use only the approved `pending → posted`
or `pending → uncertain` transitions and must not add a bypass transition.

### 10.1 Concrete unknown-outcome recovery

After a connection loss or timeout, the caller closes the failed connection and
opens a new transaction. It queries the company-scoped request and economic-
effect identities under lock:

1. matching `posted` effect with complete journal/result -> return that exact
   result;
2. no effect row -> repeat the complete final revalidation sequence with the
   same command identity;
3. `pending` effect -> return `RETRY_REQUIRED` and use controlled resolution;
   never assume it is safe to insert another effect; and
4. `uncertain` effect -> return `RETRY_REQUIRED`, preserve the durable reason,
   and require controlled resolution by the same identities; never blind replay.

A controlled resolver may only inspect the exact company-scoped effect,
canonical journal/effect identity, relation, line, and audit evidence. It may
return a resolved prior outcome or a terminal review-required result; it may
not create a second economic effect or mutate an immutable journal. Any
transition not already permitted by RS-01 is a stop condition, not a reason to
expand the trigger.

## 11. Deadlock and lock-contention policy

The global order in section 4 is mandatory. The service maps PostgreSQL
`55P03` lock timeout and `40P01` deadlock to `RETRY_REQUIRED`, rolls back, and
emits no success audit or canonical effect.

There is no retry inside the same transaction. A caller may make at most three
new attempts using the identical command/effect identities, with bounded
backoff. Every attempt starts a new transaction and repeats all locks and all
final revalidation. A stale, authorization, period, identity, or validation
result is not retried automatically. After the limit, the user-visible result
is a retryable busy/conflict outcome with company-safe audit/log context.

The implementation must test reversed caller input order and concurrent
authority changes to prove that deterministic ordering, not incidental query
order, controls behavior.

## 12. Adversarial acceptance matrix

All tests use the approved disposable-database infrastructure and at least two
independent database connections. Every concurrent test has an explicit
barrier/latch proving both transactions reached the intended point. Each test
records setup, concurrent event, expected result, accounting effect, audit
effect, and final database state.

### 12.1 Transactional authority and freshness

| Scenario | Required result |
|---|---|
| Membership revoked during posting | `AUTHORIZATION_CONFLICT`; no effect |
| Conflicting duplicate membership rows | Fail closed; no arbitrary role |
| Source revision or evidence hash changes | `STALE_SOURCE`; no effect |
| Source/company ownership changes | `COMPANY_SCOPE_CONFLICT`; no cross-company effect |
| Account deactivation or reassignment | `STALE_CONTEXT`; no effect |
| Accounting period closes or bounds change | `PERIOD_CLOSED` or `STALE_CONTEXT`; no effect |
| Financial-year identity/bounds changes | `STALE_CONTEXT`; no effect |
| DEC-11 configuration changes | `STALE_CONTEXT`; no effect |
| DEC-10 mapping changes/removal | `STALE_CONTEXT`; no effect |
| VAT evidence/profile/rule/return state changes | `STALE_CONTEXT` or unsupported result; no effect |
| Current payment/allocation/balance state changes | `STALE_CONTEXT`; no over-allocation |
| Missing authority provider or weak evidence | `RETRY_REQUIRED`; no effect |
| Locked unchanged state | One posted journal, lines, effect, and audit |
| Lock timeout/deadlock | `RETRY_REQUIRED`; full rollback |

### 12.2 Identity and correction/reversal concurrency

| Scenario | Required result |
|---|---|
| Concurrent same-command posting | One `POSTED`, one exact `DUPLICATE` |
| Same economic effect with different command identity | One effect; loser `IDENTITY_CONFLICT` |
| Same reversal identity concurrently | One reversal; loser `DUPLICATE` |
| Different reversal identities concurrently | One reversal; loser deterministic `IDENTITY_CONFLICT` |
| Same correction identity concurrently | One correction; loser `DUPLICATE` |
| Different corrections concurrently | Original-row serialization; each valid distinct effect at most once |
| Correction versus reversal concurrently | Original-row serialization; one valid result per policy and no duplicate link |
| Second reversal after correction | Deterministic policy result; original unchanged |
| Client loses response after commit | Identity lookup returns the exact stored result |
| Pending effect recovery | `RETRY_REQUIRED`; no blind replay |
| Uncertain effect recovery | Same-identity controlled resolution only |

### 12.3 Atomicity, isolation, and validation

The matrix must also include synchronized or injected-failure tests for:

- header, line, effect-insert, effect-finalization, relation, and audit failure;
- final freshness mismatch after every required lock;
- direct header/line/relation/audit/effect mutation resistance;
- status, company, source, actor, and effect identity mutation;
- generic CRUD and alternate server-path attempts;
- invalid date, zero/unequal/negative/fractional/mixed-currency/fewer-than-two
  line commands;
- missing reversal reason and missing correction identity;
- Company A/B source, account, mapping, period, VAT, read, and relation
  references; and
- original-header/line byte-equivalence after correction and reversal.

The existing five-test disposable integration suite is not sufficient by
itself. The implementation approval is conditional on expanding it or adding a
focused companion suite that proves races through commit rather than merely
calling two promises concurrently.

## 13. Existing safety foundation

TR-01 must preserve:

- BL-01-FI Principal and Tenant Guard as the only membership/company
  authorization mechanism;
- SC-01 `economic_effect_id` as the authoritative relation identity;
- `ledgerly_api` runtime and `ledgerly_canonical_owner` ownership separation;
- `ENABLE ALWAYS` immutable and constrained-transition triggers;
- no API direct update/delete/truncate privilege on immutable records; and
- the disposable canonical test database and administrative/test-process
  separation.

No new privilege, role, trigger, RLS policy, migration, or production
configuration is authorized by this package.

## 14. Exact implementation impact

### 14.1 Application/service files

Expected application changes are limited to:

- `artifacts/api-server/src/services/accounting/canonicalPosting.ts`:
  transactional provider types, ordered lock orchestration, post-lock
  revalidation, original-journal locking, deterministic error mapping, and
  identity recovery;
- a narrowly scoped accounting authority-provider module if needed for the
  concrete provider types and lock-order helpers; and
- the existing canonical caller contracts, if any, so commands carry the
  complete expected envelope rather than ambient context.

No browser, AI, generic entity, queue, worker, scheduler, or unrelated
accounting workflow is part of this impact.

### 14.2 Test files and evidence

Expected test changes are limited to:

- `artifacts/api-server/src/services/accounting/canonicalPosting.integration.test.ts`;
- a focused companion integration test only if separating the large matrix
  improves isolation; and
- disposable-run evidence that records lock order, connection identities,
  expected/current tokens, deterministic outcomes, final row counts/hashes,
  and cleanup.

Tests must continue to close pools and use disposable databases. They must not
delete canonical rows from normal development `heliumdb`.

### 14.3 Database/schema and migration impact

**Planned TR-01 impact: no database schema change, migration, role change,
privilege change, RLS change, or DDL is authorized.**

The design uses existing company, membership, account, canonical-journal, and
posting-effect records where they are authoritative. Product authorities that
do not yet exist must be injected only through an explicitly declared provider
contract and must fail closed for unsupported production posting.

If implementation discovers that a new revision column, authority table,
constraint, index beyond an already-approved narrowly scoped lock-supporting
index, trigger, role, privilege, or migration is required, implementation must
stop. That object requires a separate approval package and is not part of
TR-01.

## 15. Production boundary and completion rule

TR-01 is development-only. It does not authorize:

- production posting;
- production schema/data/roles/secrets;
- deployment, publishing, cutover, or migration;
- RLS;
- BL-06 or BL-07;
- #41 execution; or
- any downstream accounting workflow.

Production posting remains disabled until all approved authority providers and
the independent #44 completion assessment demonstrate the required guarantees.

TR-01 completion must not automatically mark #44 or #40-CF-01 complete.
After implementation, TR-01 requires an independent post-implementation
review. Only a later #44 completion assessment may determine whether:

`PASS — #44 COMPLETE / #40-CF-01 MAY BE RECONSIDERED`

BL-06 and BL-07 remain blocked regardless of this package.

## 16. Stop conditions

Implementation must stop and return for approval if any of the following occurs:

- an authoritative record has no stable primary key, revision, version, or
  evidence semantics;
- a provider cannot acquire and retain a lock through the same transaction;
- a source is externally mutable and has no native revision, comparable hash,
  or conditional-read guarantee;
- a required period, financial-year, mapping, configuration, VAT, balance, or
  source authority is missing and a new schema/provider approval would be
  needed;
- the proposed design uses an unrelated table as an invented authority
  substitute;
- the required lock order is non-deterministic or caller-controlled;
- lock timeout/deadlock handling would permit a partial effect or bypass
  revalidation;
- resolving pending/uncertain state would require a non-approved effect
  transition or a second economic effect;
- an unavoidable privilege expansion, owner bypass, trigger weakening, RLS
  change, or generic CRUD path is proposed;
- required races cannot be tested through commit with independent connections
  and explicit barriers;
- a production, platform, deployment, publishing, migration, or external
  provider dependency is needed to claim completion; or
- the design conflicts with DEC-01 through DEC-22, the source-freshness
  contract, SC-01, RS-01, or BL-01-FI.

## 17. Governance confirmation

- DEC-01 through DEC-22 remain approved.
- DEC-12 remains exclusively the Payment, Allocation and Settlement Policy.
- Source freshness remains implementation-level.
- DEC-23 is not created and is not required.
- DEC-04 immutability remains authoritative.
- DEC-21 RLS remains defence-in-depth only and is not introduced.
- BL-06 and BL-07 remain blocked.
- #40-CF-01 remains incomplete pending the later #44 completion assessment.
- #44 remains incomplete pending TR-01 implementation and independent review.
- Production posting remains disabled.
- No deployment, publishing, migration, cutover, production data change, or
  production authority is granted.

## 18. Decision

**Decision:** `READY FOR #44-TR-01 IMPLEMENTATION APPROVAL`

This readiness is approval to review and, if separately approved, implement the
development-only boundary described here. It is not implementation authority,
does not create a task, and does not authorize production posting or any
unapproved authority schema.
