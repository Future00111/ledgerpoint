# #44 Canonical Posting Safety Enforcement — Implementation Approval Package

**Status:** PLANNING / REVIEW ONLY — NO IMPLEMENTATION AUTHORISED  
**Proposed task:** `#44 — Canonical Posting Safety Enforcement`  
**Identifier status:** Proposed identifier only; no project task has been created  
**Governance baseline:** DEC-01 through DEC-22 APPROVED  
**BL-06:** Remains blocked except for the bounded canonical-safety
 responsibilities explicitly described here
**BL-07:** Remains blocked
**DEC-23:** Not created and not required  
**Related work:** `#40-CF-01 — Canonical Posting Foundation` remains incomplete
 until the enforcement and evidence in this package are implemented and passed
**Decision requested:** Approval to implement this exact bounded #44 task

> This package is planning and approval material only. It does not approve,
> create, or execute #44. It does not change application code, database schema,
> migrations, workflows, dependencies, infrastructure, deployment, publishing,
> production data, or project-task state.

## 1. Executive recommendation

Approve `#44 — Canonical Posting Safety Enforcement` for implementation with
the exact mechanisms selected in this document:

1. **Database-enforced append-only protection** using a dedicated non-login
   table-owner role, application-role privilege separation, and
   `ENABLE ALWAYS` PostgreSQL triggers;
2. **PostgreSQL row-level locks held through one transaction** for every
   authoritative source, authority, period, configuration, mapping, financial
   year, and account record used by a posting; and
3. **Original-journal `SELECT ... FOR UPDATE` plus database uniqueness
   constraints** for correction/reversal serialization and deterministic
   idempotency.

These are concrete selections, not alternatives. A provider that cannot
participate in the selected transaction and lock contract is unavailable for
production posting and must fail closed.

The task is a safety-enforcement prerequisite, not completion of BL-06 or BL-07.
It must not introduce invoice, bill, payment, bank, reconciliation, VAT-return,
period-management, reporting, migration, or user-interface workflows.

## 2. Current #40 stopping reason

The #40 foundation currently has additive canonical journal, line, posting
effect, relation, and audit structures plus a protected service boundary. Its
development fixtures exercise balanced posting, basic company scope,
idempotency, rollback, same-command concurrency, reversal, and correction.

It is not complete because:

- posted headers and lines are not protected at the persistence boundary;
- a future server path with database access could bypass application
  conventions;
- provider reads do not currently prove that source, membership, company,
  account, mapping, configuration, financial-year, or period state remains
  valid through commit;
- correction/reversal serialization and the complete command-validation
  contract are not yet enforced; and
- the existing tests do not attempt direct mutation or prove freshness races
  through commit.

Until #44 is implemented and independently reviewed, production posting must
remain disabled.

## 3. Authority and classification

The following labels are normative:

- **APPROVED GOVERNANCE POLICY** — binding policy already approved by
  DEC-01–DEC-22;
- **ACCOUNTING INVARIANT** — a condition that must hold for canonical
  accounting;
- **REQUIRED IMPLEMENTATION BEHAVIOUR** — behavior required to satisfy the
  approved policy and invariants;
- **SELECTED ENGINEERING DESIGN** — the concrete technical design selected by
  this package;
- **DEFERRED** — intentionally excluded from #44.

This package selects the three core safety mechanisms. No implementation may
replace them with a best-effort read, an application convention, or an
unapproved equivalent.

## 4. Governance basis

### 4.1 Approved constraints

| Decision | Constraint on #44 |
|---|---|
| DEC-01 | Stop if implementation conflicts with approved governance or cannot provide the guarantees stated here. |
| DEC-04 | Canonical journals remain normalized, balanced, append-only, source-linked, idempotent, atomic, auditable, and correctable only through linked additive entries. |
| DEC-05 | Preserve authenticated identity, active membership, company scope, server-side capability evaluation, approval requirements, and audit. |
| DEC-06 | Resolve financial year from validated company policy and posting date; never silently rebase it. |
| DEC-07 | Ordinary posting cannot bypass a closed accounting period. |
| DEC-09 | Stable account identity and validated classification remain authoritative; names and codes are not sufficient. |
| DEC-10 | Protected company-scoped control-account mappings must be locked and validated where a posting context uses them. |
| DEC-11 | Material configuration is versioned, effective-dated, company-scoped, and retained with the posting. |
| DEC-17–DEC-20 | Preserve accounting meaning, audit retention, bounded recovery, and no-replay behavior. |
| DEC-21 | Company isolation applies to canonical records, references, authority, jobs, and audit evidence. |
| DEC-22 | Do not migrate, reinterpret, backfill, or cut over historical accounting. |

### 4.2 Source-freshness ownership

Source freshness remains a cross-cutting implementation-level posting-safety
contract derived from DEC-01–DEC-22. It is not assigned to DEC-12 and does not
create DEC-23.

The selected mechanism below treats a captured source or approval envelope as
evidence to compare, never as permission to post.

## 5. Exact task scope

### 5.1 Consequential boundary

The task will harden the existing canonical posting service boundary only. The
boundary will be the sole server-side writer for:

- ordinary canonical posting;
- additive linked corrections; and
- additive linked reversals.

Browser state, AI output, generic CRUD, imports, queues, retries, or source
adapters may request a command, but cannot write canonical headers, lines,
relations, or audit records directly.

The command returns deterministic outcomes:

`POSTED`, `DUPLICATE`, `IDENTITY_CONFLICT`, `STALE_SOURCE`,
`STALE_CONTEXT`, `AUTHORIZATION_CONFLICT`, `COMPANY_SCOPE_CONFLICT`,
`PERIOD_CLOSED`, `INVALID_COMMAND`, `INVALID_JOURNAL`, or
`RETRY_REQUIRED`.

### 5.2 Canonical accounting invariants

The boundary must enforce:

- at least two lines;
- positive, non-negative integer minor units;
- exactly one of debit or credit per line;
- equal positive debit and credit totals;
- one currency per launch-scope journal;
- valid ISO posting date;
- company-owned active eligible accounts;
- exactly one resolved financial year and accounting period;
- an open period for ordinary posting;
- one material configuration version and protected mapping snapshot;
- source, actor/job, company, context, and economic-effect identity;
- atomic journal, line, effect, relation, and audit persistence.

Final journal lines and totals are generated and validated server-side. No
caller supplies arbitrary posted-line rows through generic CRUD.

## 6. Selected mechanism 1 — database-enforced append-only protection

### 6.1 Selection

The selected mechanism is a **database-enforced append-only boundary composed
of a dedicated non-login owner role, application-role privilege separation,
and `ENABLE ALWAYS` PostgreSQL triggers**.

The API connection role will not own the canonical tables and will not have
`UPDATE`, `DELETE`, or `TRUNCATE` privileges on immutable canonical records.
The trigger functions are owned by the dedicated guard role and are not
disableable by the API role.

A database administrator or migration principal with ownership-level
privileges can still intentionally bypass the boundary. Such a principal is
not an application/server role; use of it is outside normal Ledgerpoint
posting and requires the separate operational governance path. If the
deployment cannot separate the API role from table ownership, #44 must stop
and production posting must remain disabled.

### 6.2 Tables and operations protected

The database enforcement applies to these existing #40 canonical tables:

1. `canonical_journal_entries`
   - `INSERT`: permitted only to the canonical posting transaction;
   - `UPDATE`: always rejected;
   - `DELETE`: always rejected;
   - `TRUNCATE`: denied to the API role.
2. `canonical_journal_lines`
   - `INSERT`: permitted only as part of a new canonical journal transaction;
   - `UPDATE`: always rejected;
   - `DELETE`: always rejected;
   - `TRUNCATE`: denied to the API role.
3. `canonical_journal_relations`
   - `INSERT`: permitted only for an additive correction or reversal in the
     canonical transaction;
   - `UPDATE`, `DELETE`, and `TRUNCATE`: rejected/denied.
4. `accounting_audit_events`
   - `INSERT`: permitted only for durable audit evidence;
   - `UPDATE`, `DELETE`, and `TRUNCATE`: rejected/denied.
5. `accounting_posting_effects`
   - `INSERT`: permitted for a new effect identity;
   - `UPDATE`: only the exact `pending → posted` transition or exact
     `pending → uncertain` recovery transition is permitted;
   - identity, company, source, economic-effect, and creator fields cannot
     change;
   - `DELETE`, `TRUNCATE`, and all other transitions are rejected/denied.

The API role retains only the privileges required for canonical posting:
`SELECT` and `INSERT` on append-only tables, `SELECT` and the constrained
finalization `UPDATE` on posting effects, and no direct mutation privilege on
posted journals, lines, relations, or audit records.

### 6.3 Exact permitted transitions

There is no permitted transition for a canonical journal header or line after
insert. A posted header remains `posted`; it is never changed to `reversed`,
`corrected`, or another mutable state. A correction or reversal is a new
insert linked to the original.

For `accounting_posting_effects`, the only permitted update transitions are:

- `pending → posted`, exactly once, with a non-null journal ID and complete
  result matching the inserted identity; or
- `pending → uncertain`, exactly once, with no journal ID and a durable
  retry/recovery reason.

No `posted → *`, `uncertain → *`, identity-field, company-field, source-field,
or result replacement transition is permitted.

### 6.4 Exact DDL/schema objects permitted

#44 may add only the following development database objects:

- one `NOLOGIN` role named `ledgerly_canonical_owner`;
- one immutable trigger function for journal headers;
- one immutable trigger function for journal lines;
- one append-only trigger function for relations and audit events;
- one constrained-transition trigger function for posting effects;
- `ENABLE ALWAYS` row triggers on the five tables above;
- ownership transfers of those five tables to `ledgerly_canonical_owner`;
- revocation of `UPDATE`, `DELETE`, and `TRUNCATE` from the API role and
  `PUBLIC`;
- narrowly scoped grants for the canonical service;
- one partial unique index allowing at most one reversal relation per original
  journal;
- one unique index for a correction identity per original/economic effect;
- one index supporting locked original-journal relation checks.

The approved development DDL must:

1. capture the current API role before transferring ownership;
2. create `ledgerly_canonical_owner` as `NOLOGIN`;
3. create the trigger functions with `SECURITY DEFINER` and a fixed
   `search_path` of `pg_catalog, public`;
4. transfer ownership to `ledgerly_canonical_owner`;
5. revoke broad mutation privileges;
6. grant only the exact canonical-service privileges; and
7. install the triggers as `ENABLE ALWAYS`.

The DDL must be applied through the project-approved development schema-change
path. It must not be applied to production by the agent.

### 6.5 Corrections and reversals under the boundary

Corrections and reversals do not update or delete the original header, lines,
relations, effect, or audit evidence. They insert a new posted journal, new
lines, one new relation, one new effect identity, and one new audit event.

The immutable triggers therefore permit the additive insert sequence but reject
any attempt to “fix” the original in place. The relation and effect uniqueness
rules provide the second, database-level defence against duplicate links.

## 7. Selected mechanism 2 — transactional final freshness

### 7.1 Selection

The selected mechanism is **one PostgreSQL transaction using deterministic
`SELECT ... FOR UPDATE` row locks on every authoritative record, held until
commit**.

There is no conditional-write fallback and no ordinary-read fallback. The
canonical command must use the same transaction handle for authority
resolution, final validation, identity insertion, journal insertion, line
insertion, relation insertion, effect finalization, and audit insertion.

If an authoritative state is external or cannot expose a row lock through the
same transaction, the provider is unsupported for production posting and the
command returns `RETRY_REQUIRED` without an accounting effect.

### 7.2 Transaction ordering and deadlock rule

Every canonical command acquires locks in this order:

1. resolved company row;
2. source row;
3. active membership rows, sorted by membership ID;
4. account rows, sorted by account ID;
5. DEC-10 mapping rows, sorted by mapping ID;
6. DEC-11 configuration-version row;
7. financial-year row;
8. accounting-period row; and
9. original journal row for a correction or reversal.

The service must never acquire these locks in caller-supplied order. A lock
timeout or deadlock aborts the transaction and returns `RETRY_REQUIRED`; it
never creates a partial effect.

### 7.3 State-by-state authority contract

For every row below, the provider must expose a stable primary key, a captured
revision/evidence token, and a transaction-aware `lockForPosting` operation
that executes `SELECT ... FOR UPDATE` on the authoritative row. The final
revalidation compares the locked current value with the captured envelope
before any accounting insert.

| State | Authoritative record | Captured token | Exact final read/lock | Concurrent change detected | Result |
|---|---|---|---|---|---|
| Source revision/evidence | The source adapter’s company-owned source row and its normalized evidence record | Source revision/event sequence; normalized evidence SHA-256 when the source has no native revision | Lock the source row and read current material fields plus revision/hash with `SELECT ... FOR UPDATE` | Source revision, material status, evidence, or source ownership changes before the lock/read | `STALE_SOURCE`; no effect |
| Company ownership | The locked source row’s `company_id` plus the company row | Company primary key and source owner ID | Lock company row and source row; compare both company IDs | Source/company ownership changes or source is reassigned | `COMPANY_SCOPE_CONFLICT`; no effect |
| Active membership/authorization | `company_users` membership rows for the actor and resolved company | Membership primary key, `is_active`, role, and `updated_at` | Lock all matching membership rows with `SELECT ... FOR UPDATE`; reject zero or conflicting active rows | Membership revoked, role changed, duplicate/conflicting membership appears | `AUTHORIZATION_CONFLICT`; no effect |
| Account eligibility | `chart_of_accounts` rows for every resolved account | Account primary key, `is_active`, classification, and `updated_at` | Lock all account rows sorted by ID; validate company ownership and eligibility while locked | Account deactivated, reassigned, or classification changes | `STALE_CONTEXT`; no effect |
| DEC-10 mapping | The provider’s protected company mapping row for every control-account role used | Mapping primary key and immutable mapping version | Lock each mapping row sorted by ID; compare captured mapping version and resolved account IDs | Mapping changes or is removed | `STALE_CONTEXT`; no effect |
| DEC-11 configuration | The immutable effective configuration-version row selected by company and posting date | Configuration-version primary key and immutable version | Lock the selected version row; confirm effective date, company, and captured version | Configuration selection/version changes or row becomes invalid | `STALE_CONTEXT`; no effect |
| Financial year | The company financial-year row containing the posting date | Financial-year primary key, date bounds, and version | Lock the resolved year row; confirm exactly one match and captured identity | Year bounds/version change or ambiguous match | `STALE_CONTEXT`; no effect |
| Accounting period/state | The company accounting-period row containing the posting date | Period primary key, bounds, state, and version | Lock the resolved period row; require `OPEN` for ordinary posting | Period closes, reopens, changes bounds, or becomes ambiguous | `PERIOD_CLOSED` or `STALE_CONTEXT`; no effect |
| Command identity | Company-scoped posting-effect identity rows | Company + idempotency key and company + economic-effect ID | Lock or atomically insert under the two unique indexes after authority locks | Same identity is posted, pending, uncertain, or reused with different meaning | `DUPLICATE`, `IDENTITY_CONFLICT`, or `RETRY_REQUIRED` |

The current workspace does not provide authoritative period, financial-year,
DEC-10 mapping, or DEC-11 configuration product tables. #44 does not invent
those product domains. Until approved providers expose the exact locked rows
above, production posting remains disabled. A test double may supply the
contract only for controlled tests.

### 7.4 Final transaction model

The canonical transaction is:

1. `BEGIN`;
2. resolve source ownership and company from the provider;
3. lock the records in the exact order above;
4. re-read every captured revision, hash, status, company, role, mapping,
   configuration, year, period, and account value;
5. evaluate capability and approval requirements from the locked state;
6. validate command identity and server-generated lines;
7. insert or resolve the durable posting effect;
8. insert the posted canonical header and lines;
9. insert the additive relation when applicable;
10. insert audit evidence;
11. finalize the effect using the constrained `pending → posted` transition;
12. `COMMIT`.

Any exception, lock timeout, validation failure, uniqueness conflict, provider
failure, or audit failure rolls back the entire transaction. A network timeout
after commit is resolved by querying the company-scoped effect identity, never
by creating a new identity.

## 8. Selected mechanism 3 — correction/reversal concurrency and idempotency

### 8.1 Identity definitions

- **Posting identity:** `(company_id, economic_effect_id)`.
- **Request identity:** `(company_id, idempotency_key)`.
- **Correction identity:** `(company_id, original_journal_id,
  economic_effect_id, relation_type='correction')`.
- **Reversal identity:** `(company_id, original_journal_id,
  economic_effect_id, relation_type='reversal')`.

The original journal’s company is authoritative. Caller-supplied company
context may agree with it but cannot replace it.

### 8.2 Exact serialization and uniqueness mechanism

Every correction or reversal:

1. locks the original canonical journal row with
   `SELECT ... FOR UPDATE`;
2. confirms the original is a complete `posted` journal in the same company;
3. locks and validates the relevant period/configuration/context rows;
4. resolves the request and economic-effect identity under the existing
   company-scoped unique indexes;
5. inserts one additive linked journal and relation; and
6. commits the effect and audit atomically.

The database adds:

- a partial unique index on
  `(company_id, original_journal_id)` where `relation_type = 'reversal'`;
- a unique index on
  `(company_id, original_journal_id, economic_effect_id, relation_type)` for
  correction/reversal relation identities; and
- the existing company-scoped unique indexes on idempotency and
  economic-effect identity.

The policy is therefore:

- one reversal per original journal;
- multiple corrections are permitted only when each has a distinct economic
  effect identity and passes the locked current-context checks;
- the same correction or reversal identity is a safe duplicate;
- a different identity attempting a second reversal is a deterministic
  `IDENTITY_CONFLICT`;
- two distinct correction identities serialize on the original row and may
  both proceed only if each is independently valid; they cannot produce two
  copies of one intended effect.

### 8.3 Retry and uncertain outcomes

- A committed effect with the same request and meaning returns the original
  exact journal/result with `DUPLICATE`.
- A reused request or economic-effect identity with different meaning returns
  `IDENTITY_CONFLICT`.
- A committed `uncertain` effect returns `RETRY_REQUIRED` and can be resolved
  only through the same company-scoped identity.
- A transaction rolled back before commit leaves no journal, lines, relation,
  audit event, or durable posted effect.
- A client timeout after commit is not evidence of rollback; the caller must
  query the identity before retrying.
- The original posted journal and lines remain unchanged in every case.

## 9. Exact schema/DDL boundary

### A. Existing #40 canonical schema

The following existing additive #40 tables are the starting point and are not
reinterpreted:

- `accounting_posting_effects`;
- `canonical_journal_entries`;
- `canonical_journal_lines`;
- `canonical_journal_relations`; and
- `accounting_audit_events`.

The legacy JSON `journal_entries` table remains compatibility data. It is not
read as canonical authority and is not rewritten.

### B. Exact #44 additions

#44 may introduce only:

1. the `ledgerly_canonical_owner` `NOLOGIN` role;
2. the four trigger functions and `ENABLE ALWAYS` triggers defined in section
   6;
3. ownership and privilege changes required to prevent the API role from
   bypassing those triggers;
4. the partial unique reversal index;
5. the unique correction/reversal identity index; and
6. any narrowly scoped index needed to execute the specified locked lookups.

No new source, invoice, bill, payment, bank, VAT-return, period-management,
financial-year product, mapping product, or configuration product table is
introduced by #44.

### C. Explicitly prohibited

- historical migration;
- legacy journal backfill;
- data transformation or authority transfer;
- deletion or reinterpretation of existing journal data;
- universal RLS or a new tenant-isolation architecture;
- production database changes;
- deployment or publishing;
- production posting enablement;
- broad generic-CRUD cleanup;
- provider, queue, worker, scheduler, backup, or infrastructure selection.

RLS remains defence-in-depth only and is not part of #44. Company isolation is
enforced by the existing BL-01-FI Principal and Tenant Guard, locked
company-owned references, canonical service authorization, and no generic
canonical mutation route.

## 10. Security and company isolation

- The BL-01-FI guard remains the only membership/company authorization
  mechanism; #44 adds no parallel membership system.
- Resource-derived company identity wins over caller input; conflicts fail
  closed.
- Membership rows are locked and rechecked inside the posting transaction.
- Every canonical row stores company identity or is reachable only through a
  company-owned parent.
- Account, source, context, relation, effect, and audit references are checked
  against the locked company.
- The API role cannot directly update or delete posted accounting rows.
- RLS is not introduced; the absence of RLS is an explicit bounded tradeoff,
  not permission to omit service-level company checks.
- System/job principals must carry an explicit company ID and named
  capability; an unscoped background principal is rejected.

## 11. Mandatory adversarial acceptance matrix

Every test below must record setup, concurrent event where applicable,
expected result, accounting effect, audit effect, and final database state.
“No effect” means no new journal, line, relation, or posted effect; existing
records must remain byte-for-byte equivalent for the tested fields.

### 11.1 Immutability

| Test | Setup | Event | Expected result | Accounting/audit effect | Final state |
|---|---|---|---|---|---|
| Direct header update | Post a canonical journal as Company A | Execute `UPDATE canonical_journal_entries` on the posted row | Database immutability error | No new effect or audit event | Header remains posted and unchanged |
| Direct line update | Post a canonical journal and select one line | Execute `UPDATE canonical_journal_lines` | Database immutability error | No effect or audit event | Line remains unchanged |
| Direct header delete | Post a canonical journal | Execute `DELETE canonical_journal_entries` | Database immutability error/privilege denial | No effect or audit event | Header and lines remain |
| Direct line delete | Post a canonical journal | Execute `DELETE canonical_journal_lines` | Database immutability error/privilege denial | No effect or audit event | Line remains |
| Status mutation | Post a canonical journal | Attempt to change `status` | Rejected by trigger | No effect | Status remains `posted` |
| Company mutation | Post a canonical journal | Attempt to change `company_id` | Rejected by trigger | No effect | Company remains original company |
| Ownership mutation | Post a canonical journal | Attempt to change source or actor ownership fields | Rejected by trigger/privilege boundary | No effect | Provenance remains unchanged |
| Another server path | Post a canonical journal | Invoke generic entity CRUD or an alternate server mutation helper | Route/path unavailable or denied | No effect or audit mutation | Canonical row unchanged |
| After correction | Post original and linked correction | Attempt to mutate original header/lines | Rejected | No new effect | Original and correction remain additive |
| After reversal | Post original and linked reversal | Attempt to mutate original header/lines | Rejected | No new effect | Original remains posted; reversal remains linked |
| Relation mutation | Create correction/reversal relation | Attempt relation update/delete | Rejected | No audit/effect change | Relation remains unchanged |
| Audit mutation | Create posting audit event | Attempt audit update/delete | Rejected | No effect | Audit evidence remains unchanged |
| Effect identity mutation | Create pending effect | Attempt to change company, source, or effect identity | Rejected | No journal | Identity remains unchanged |

### 11.2 Freshness and authority

| Test | Setup | Concurrent event | Expected result | Accounting/audit effect | Final state |
|---|---|---|---|---|---|
| Source material change | Capture source revision and begin posting | Update source after capture; posting locks/re-reads it | `STALE_SOURCE` | No accounting effect; optional rejection evidence only | Source update commits; no journal |
| Source revision change | Capture revision `r1` | Source advances to `r2` before final read | `STALE_SOURCE` | No effect | No canonical rows for command |
| Evidence hash change | Capture hash `h1` | Material evidence changes to `h2` | `STALE_SOURCE` | No effect | No canonical rows |
| Source ownership change | Capture Company A source | Reassign source to Company B before lock/read | `COMPANY_SCOPE_CONFLICT` | No effect | No cross-company journal |
| Membership revocation | Begin with active owner membership | Revoke membership before final lock/read | `AUTHORIZATION_CONFLICT` | No effect | Revocation remains; no journal |
| Role/capability change | Begin with posting-capable role | Change role to insufficient role before final read | `AUTHORIZATION_CONFLICT` | No effect | Role change remains; no journal |
| Company change | Begin with Company A context | Change company ownership/context before final read | `COMPANY_SCOPE_CONFLICT` | No effect | No Company B effect |
| Account deactivation | Capture active account | Deactivate account before account lock/read | `STALE_CONTEXT` | No effect | Account remains deactivated |
| Account reassignment | Capture Company A account | Reassign account to Company B before final read | `STALE_CONTEXT` | No effect | No cross-company line |
| Mapping change | Capture DEC-10 mapping version | Change mapping before mapping lock/read | `STALE_CONTEXT` | No effect | No journal |
| Configuration change | Capture DEC-11 version | Change effective configuration before lock/read | `STALE_CONTEXT` | No effect | No journal |
| Period closure | Capture open period | Close period before period lock/read | `PERIOD_CLOSED` | No effect | Period remains closed |
| Period bounds change | Capture period match | Change bounds to make date ambiguous/outside period | `STALE_CONTEXT` | No effect | No journal |
| Financial-year change | Capture resolved financial year | Change year bounds/version before final read | `STALE_CONTEXT` | No effect | No journal |
| Missing provider | Omit one required authoritative provider | Attempt posting | `RETRY_REQUIRED`/provider-unavailable business error | No effect | No partial context or journal |
| Lock timeout | Begin posting while another transaction holds authority row | Lock acquisition times out | `RETRY_REQUIRED` | Full rollback, no audit success | Competing transaction remains sole writer |
| Locked unchanged state | Capture all tokens | No concurrent change; all locks succeed | `POSTED` | One journal, lines, effect, and success audit | All committed atomically |

### 11.3 Correction and reversal

| Test | Setup | Concurrent event | Expected result | Accounting/audit effect | Final state |
|---|---|---|---|---|---|
| Simultaneous reversals, same identity | One posted original; two requests share identity | Both lock original and submit | One `POSTED`, one `DUPLICATE` | One reversal, one success audit | One reversal relation |
| Simultaneous reversals, different identity | One posted original; two distinct reversal identities | Both contend for original lock | One `POSTED`; other `IDENTITY_CONFLICT` | One reversal only | Original unchanged, one reversal |
| Duplicate reversal retry | Committed reversal exists | Retry exact command | `DUPLICATE` with original exact result | No second journal/audit | One reversal |
| Simultaneous corrections, same identity | One posted original; two same correction commands | Both contend for original/effect identity | One `POSTED`, one `DUPLICATE` | One correction | One correction relation |
| Duplicate correction retry | Committed correction exists | Retry exact command | `DUPLICATE` | No second correction | Original and one correction |
| Distinct correction identities | One posted original; two valid distinct corrections | Requests serialize on original | Each either posts once if independently valid | At most one effect per distinct identity | Additive valid corrections only |
| Uncertain reversal | Reversal commit completes but client loses response | Query/retry same identity | Query resolves; retry is `DUPLICATE` | No second reversal | One committed reversal |
| Uncertain correction | Correction commit completes but client loses response | Query/retry same identity | Query resolves; retry is `DUPLICATE` | No second correction | One committed correction |
| Second reversal after correction | Original already has a correction | Request reversal | Allowed only if reversal identity and policy permit; partial index still limits one reversal | One additive result or deterministic conflict | Original immutable |
| Original mutation during link | Begin correction/reversal | Separate mutation attempts original row | Mutation blocked; link sees locked original | No partial link | Original unchanged |

### 11.4 Atomicity and failure injection

| Test | Setup | Event | Expected result | Accounting/audit effect | Final state |
|---|---|---|---|---|---|
| Header failure | Valid command with header insert failure injected | Header insert fails | Transaction rolls back | No effect, line, relation, or audit | No canonical rows |
| Line failure | Valid header path with line insert failure | One line insert fails | Transaction rolls back | No committed header/effect/audit | No orphan header |
| Effect insert failure | Valid command | Effect identity insert fails | Transaction rolls back | No journal or audit | No effect identity |
| Effect finalization failure | Header/lines/audit staged | Pending-to-posted update fails | Transaction rolls back | No committed accounting effect | No orphan journal |
| Relation failure | Correction/reversal staged | Relation insert fails | Transaction rolls back | No linked journal/effect/audit | Original unchanged |
| Audit failure | Journal/effect staged | Audit insert fails | Transaction rolls back | No success accounting effect | No journal/effect |
| Final freshness conflict | Locks acquired, then provider reports mismatch | Final check fails | Explicit stale/context result | No effect or success audit | No partial writes |
| Authorization failure | No active/adequate membership | Authorization check fails | `AUTHORIZATION_CONFLICT` | No accounting effect | No canonical writes |

### 11.5 Authorization and isolation

| Test | Setup | Event | Expected result | Accounting/audit effect | Final state |
|---|---|---|---|---|---|
| Inactive membership | User has inactive Company A membership | User posts Company A | `AUTHORIZATION_CONFLICT` | No effect | No Company A write |
| Revoked membership | User is revoked before final lock | User posts captured Company A command | `AUTHORIZATION_CONFLICT` | No effect | Revocation remains |
| Conflicting memberships | Duplicate active rows disagree on role | User posts | Fail closed | No effect | No arbitrary role selection |
| Malformed company context | Request contains invalid company value | User posts source-owned command | `INVALID_COMMAND` or scope denial | No effect | No cross-company read/write |
| Conflicting company context | Source belongs to A; request says B | User posts | `COMPANY_SCOPE_CONFLICT` | No effect | No B write |
| Insufficient capability | Active read-only/insufficient role | User posts/corrects/reverses | `AUTHORIZATION_CONFLICT` | No effect | No canonical write |
| System principal scope | Job principal lacks exact company/capability | Job posts | `AUTHORIZATION_CONFLICT` | No effect | No unscoped job write |
| Company A/B references | Valid A source plus B account/mapping/period | Attempt cross-company line/reference | `COMPANY_SCOPE_CONFLICT` or `STALE_CONTEXT` | No effect | All rows remain company-correct |
| Company A/B reads | User is member only of A | Request B canonical record | Access denied | No audit leakage or accounting effect | No B data exposed |

### 11.6 Command validation

| Test | Setup | Event | Expected result | Accounting/audit effect | Final state |
|---|---|---|---|---|---|
| Invalid date | Valid context | Submit impossible/non-ISO posting date | `INVALID_COMMAND` | No effect | No canonical rows |
| Zero total | Valid source/context | Builder returns zero lines total | `INVALID_JOURNAL` | No effect | No canonical rows |
| Unbalanced lines | Valid source/context | Builder returns unequal totals | `INVALID_JOURNAL` | No effect | No canonical rows |
| Mixed currency | Valid context | Builder returns a different currency | `INVALID_JOURNAL` | No effect | No canonical rows |
| Negative/fractional money | Valid context | Builder returns negative or non-integer minor units | `INVALID_JOURNAL` | No effect | No canonical rows |
| Fewer than two lines | Valid context | Builder returns one line | `INVALID_JOURNAL` | No effect | No canonical rows |
| Missing reversal reason | Posted original | Submit empty reversal reason | `INVALID_COMMAND` | No effect | Original unchanged |
| Missing correction identity | Posted original | Submit empty effect/idempotency identity | `INVALID_COMMAND` | No effect | Original unchanged |

## 12. Rollback and recovery

Rollback means reverting the #44 code/schema change or disabling canonical
posting before production rollout. It never means deleting canonical journals,
removing audit evidence, or undoing posted accounting rows.

If the DDL or trigger deployment fails in development, do not partially enable
the canonical writer. Restore the previous application/schema checkpoint and
leave production posting disabled.

If an application deployment fails after #44, disable the canonical command
boundary while preserving committed canonical rows. A network timeout is
resolved through the durable effect identity. A posted accounting effect is
changed only by a new authorized additive correction or reversal.

No production migration, production rollback, backup change, or deployment is
authorized by this package.

## 13. Risks

| Risk | Control |
|---|---|
| Managed database cannot create a dedicated owner role | Stop; do not claim immutability or enable production posting |
| API role can still alter protected tables | Verify ownership and privilege tests with the actual API role before completion |
| A provider is not row-backed or cannot share the transaction | Treat it as unavailable and fail closed |
| Lock ordering causes contention/deadlock | Enforce the fixed lock order; return `RETRY_REQUIRED` on timeout/deadlock |
| Existing domain tables lack period/configuration/mapping authority | Do not invent fallback state; keep production posting disabled |
| Trigger function is bypassable by a privileged operator | Keep privileged ownership separate from the API role and require operational governance for bypass |
| Duplicate correction semantics are misunderstood | Enforce the exact identity and one-reversal partial index policy above |
| Rejection evidence becomes an alternate accounting state | Never create a journal/effect for rejected or stale commands |

## 14. Open questions

These are readiness dependencies, not unresolved choices between safety
mechanisms:

1. Which approved source, period, financial-year, DEC-10 mapping, and DEC-11
   configuration providers will expose the required locked rows at execution
   time?
2. Can the development and eventual Publish-managed database grant the
   dedicated non-login owner role and preserve API-role privilege separation?
3. Which existing rejection/operational evidence store should retain
   non-accounting stale and authorization outcomes?

If any answer prevents the selected lock or privilege contract, implementation
must stop and production posting remains disabled.

## 15. Approval gates

Before implementation begins, the user must explicitly accept:

1. the exact #44 scope and exclusions;
2. the selected database-enforced append-only mechanism, including the
   dedicated owner role, API privilege separation, trigger functions, and
   `ENABLE ALWAYS` triggers;
3. the selected `SELECT ... FOR UPDATE` mechanism held through one transaction
   for every authoritative state listed in section 7;
4. the selected locked-original plus uniqueness mechanism for corrections and
   reversals;
5. the one-reversal-per-original policy and distinct-effect correction policy;
6. fail-closed behavior when period/configuration/mapping/provider authority is
   missing or cannot participate in the transaction;
7. the complete adversarial test matrix and required final database-state
   assertions;
8. no RLS, historical migration, production schema change, deployment,
   publishing, or production posting as part of #44.

Approval must not be inferred from reviewing this document, the earlier #40
approval, a cancelled task, or the existence of development fixtures.

## 16. Definition of done

#44 is complete only when:

- the API role cannot update, delete, truncate, or disable protection on posted
  canonical headers, lines, relations, or audit events;
- direct database update/delete attempts fail and leave all tested records
  unchanged;
- the only effect update is a validated `pending → posted` or
  `pending → uncertain` transition;
- every required authority provider participates in the same transaction and
  locks its authoritative row with `SELECT ... FOR UPDATE`;
- final source, company, membership, account, mapping, configuration,
  financial-year, period, and command identity checks occur after locks and
  before any accounting insert;
- source/context/authorization changes during posting produce the exact
  conflict outcome and no accounting effect;
- one reversal per original and one effect per correction identity are
  enforced by database uniqueness;
- safe duplicate retries return the original exact result;
- uncertain correction/reversal outcomes can be resolved without a second
  effect;
- original journals and lines remain unchanged after all corrections and
  reversals;
- journal, lines, relation, effect result, and success audit commit atomically;
- header, line, effect, relation, audit, freshness, authorization, isolation,
  and validation failure-injection tests pass;
- Company A/B isolation is proven across every canonical reference;
- all missing-provider cases fail closed;
- the legacy JSON journal remains untouched;
- #40-CF-01 is no longer blocked by these two enforcement gaps, while BL-06
  and BL-07 remain blocked as whole backlog items;
- no excluded workflow, RLS architecture, migration, deployment, publishing,
  or production change is introduced; and
- type checks, focused tests, production build, schema validation, runtime
  health, diff validation, and an independent implementation review pass.

## 17. Production and governance confirmation

- #40-CF-01 remains incomplete until #44’s implementation gates pass.
- Production posting remains disabled.
- BL-06 remains blocked.
- BL-07 remains blocked.
- #41 remains planning/design-only.
- No migration is authorised.
- No deployment is authorised.
- No publishing is authorised.
- No downstream accounting workflow is authorised.
- DEC-01–DEC-22 remain approved.
- DEC-23 does not exist.
- DEC-12 remains exclusively the Payment, Allocation and Settlement Policy.
- Source freshness remains implementation-level.
- DEC-04 immutability remains authoritative.
- DEC-21 RLS remains defence-in-depth only and is not introduced here.

## 18. Decision record

**Decision:** `PENDING — DO NOT IMPLEMENT`

**Approved task:** `#44 — Canonical Posting Safety Enforcement`

**Selected immutability mechanism:** Database-enforced append-only protection
using `ledgerly_canonical_owner`, API-role privilege separation, and
`ENABLE ALWAYS` PostgreSQL triggers.

**Selected freshness mechanism:** One PostgreSQL transaction with deterministic
`SELECT ... FOR UPDATE` locks on every authoritative record, held through
commit; unsupported providers fail closed.

**Selected correction/reversal mechanism:** Original-journal
`SELECT ... FOR UPDATE`, company-scoped effect/idempotency uniqueness, one
reversal partial unique index, and unique correction/reversal identities.

**Production status:** No production schema change, deployment, publishing,
migration, production posting, or production data change is authorised by this
package.

READY FOR #44 IMPLEMENTATION APPROVAL