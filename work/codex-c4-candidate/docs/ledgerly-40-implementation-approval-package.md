# #40 Canonical Accounting Foundation — Implementation Approval Package

**Status:** PLANNING / REVIEW ONLY — NO IMPLEMENTATION AUTHORISED  
**Proposed task:** `#40-CF-01 — Canonical Posting Foundation`  
**Identifier status:** Proposed identifier only; no project task has been created  
**Governance baseline:** DEC-01 through DEC-22 APPROVED  
**BL-06 / BL-07:** Remain blocked except for any explicitly approved, bounded
slice that may result from this package  
**DEC-23:** Not created and not required  
**BL-01-FI:** Complete, including the final post-remediation review  
**Decision requested:** Explicit approval of this single implementation task,
including its scope, exclusions, proposed technical choices, and approval gates

> This package converts the existing #40 canonical accounting foundation design
> into one reviewable implementation proposal. It does not approve, create, or
> execute the task. It does not change application code, schema, migrations,
> accounting logic, UI, workflows, dependencies, infrastructure, deployment,
> publishing, migration, or production data.

## 1. Executive recommendation

Approve `#40-CF-01` as the first accounting implementation slice, subject to
the gates in this document.

The task should establish the minimum server-side canonical posting foundation:

1. one consequential accounting command boundary;
2. a normalized journal-header and journal-line model;
3. server-side double-entry and money invariants;
4. source, company, posting-context, and economic-effect identity;
5. final source-freshness revalidation;
6. immutable posted journals and additive linked corrections/reversals;
7. atomic canonical persistence with successful audit evidence; and
8. unit, integration, transaction, concurrency, authorization, and isolation
   evidence.

The task must not implement or wire the full invoice, bill, payment, allocation,
refund, VAT-return, bank-reconciliation, migration, reporting, or period
management product workflows. It provides the authority boundary those later
workflows must call.

This is the narrowest useful accounting slice because it creates no new
source-specific accounting workflow while making the accounting effect itself
safe, traceable, and non-duplicating. A source adapter or domain workflow may
not bypass this boundary after the task is approved and implemented.

## 2. Authority and classification

The following labels are normative for this package:

- **APPROVED GOVERNANCE POLICY** — binding policy already approved by
  DEC-01–DEC-22.
- **ACCOUNTING INVARIANT** — a condition that must hold for canonical
  accounting, derived from approved policy.
- **REQUIRED IMPLEMENTATION BEHAVIOUR** — behavior the implementation must
  provide to conform to the approved policy and invariants.
- **PROPOSED ENGINEERING DESIGN** — a candidate design for this task, subject
  to approval and change during implementation review.
- **ENGINEERING CHOICE REQUIRING APPROVAL** — a material technical choice that
  must be accepted before execution and must not be presented as policy.
- **DEFERRED** — intentionally excluded from this task and requiring its own
  later scope and approval.

Approval of a policy does not approve a table, route, class, package,
dependency, migration, or implementation task.

## 3. Governance basis

### 3.1 Approved policy constraints

`#40-CF-01` is constrained by, but does not amend:

| Policy | Constraint on this task |
|---|---|
| DEC-01 | Preserve the governance hierarchy and stop implementation if a genuine policy conflict is found. |
| DEC-02 | Support only the approved initial UK/GBP product direction; do not imply broader market or source support. |
| DEC-03 | Treat the existing deterministic Standard VAT, invoice-basis service as the VAT authority; do not create a second VAT engine. |
| DEC-04 | Use server-side normalized, balanced, append-only, source-linked, idempotent, atomic journals with linked additive corrections. |
| DEC-05 | Require authenticated identity, active membership, company scope, server-side capability evaluation, approval where applicable, and audit. |
| DEC-06 | Resolve financial year from validated company policy and posting date; do not silently rebase it. |
| DEC-07 | Resolve an accounting period server-side and reject ordinary posting into a closed period. |
| DEC-08 | Keep year-end reporting-only; do not generate automatic closing or retained-earnings journals. |
| DEC-09 | Use stable account identity and validated account classification, not names or codes as authority by themselves. |
| DEC-10 | Respect protected, company-scoped AR, AP, bank/cash, Input VAT, and Output VAT mappings where a posting context uses them. |
| DEC-11 | Retain the effective material configuration version and resolved account identities used by a posting. |
| DEC-12–DEC-16 | Keep payment, allocation, settlement, credit, prepayment, refund, and bank evidence concepts distinct; this task does not implement their workflows. |
| DEC-17–DEC-20 | Preserve audit meaning, lifecycle controls, bounded recovery behavior, and no-replay expectations. |
| DEC-21 | Enforce company isolation across all canonical entities, references, jobs, reads, writes, and audit evidence. |
| DEC-22 | Do not migrate or invent historical accounting; future migration adapters must use the same canonical authority. |

### 3.2 Source-freshness status

The Source-Freshness and Posting-Safety Contract is an implementation-level
safety contract derived from DEC-01–DEC-22. It is not assigned to DEC-12 and
does not require DEC-23.

Its final implementation treatment is an approval gate for this task. The
implementation must not treat an older browser page, AI recommendation, queue
payload, or draft as permission to post.

## 4. Proposed task

### 4.1 Proposed task name and identifier

**`#40-CF-01 — Canonical Posting Foundation`**

This is a proposed first implementation identifier for the #40 planning
workstream. It is not a new governance decision, does not replace BL-06 or
BL-07, and does not create an executable task until explicitly approved.

### 4.2 Objective

Implement one protected, server-side canonical posting boundary that can accept
a fully validated internal posting command and atomically create one balanced,
source-linked, immutable canonical journal with audit evidence.

The task must also define the interfaces through which later source and
configuration domains supply validated facts. It must not allow those later
domains to create journal lines directly.

### 4.3 Exact scope

The approved task, if approved, should contain only the following:

1. **Consequential command boundary**
   - Establish one server-side entry point for canonical posting,
     correction, and reversal commands.
   - Prevent browser state, AI output, generic CRUD, imports, queues, and
     retries from becoming alternate posting authorities.
   - Return deterministic business outcomes for accepted, rejected, duplicate,
     stale, conflicting, and retry-safe commands.

2. **Canonical journal and line authority**
   - Persist a normalized journal header and normalized journal lines.
   - Generate final amounts and totals on the server.
   - Require at least two lines for a posted journal.
   - Store explicit integer minor units and currency code.
   - Store source, posting-context, actor/job, and audit references.
   - Make a posted header and its lines immutable.

3. **Posting command contract**
   - Require a trusted company context, source identity, source revision or
     evidence identity, posting date, currency, server-resolved account IDs,
     period/configuration context, and economic-effect identity.
   - Accept only a typed internal command or a dedicated protected route whose
     final journal lines are generated and validated server-side.
   - Do not expose arbitrary posted journal-line creation through generic CRUD.

4. **Context and authority integration**
   - Reuse the completed BL-01-FI Principal and Tenant Guard.
   - Require an active membership and the named server-side capability for the
     operation.
   - Require company ownership checks on the source, accounts, period,
     configuration, journal, lines, and audit evidence.
   - Consume a posting-context provider for financial year, accounting period,
     configuration version, control mappings, and account eligibility.
   - Reject the command if a required context provider is missing, ambiguous,
     stale, or inconsistent.

5. **Final freshness revalidation**
   - Re-read or atomically lock the authoritative source and relevant
     company-owned accounting context at final posting time.
   - Compare current source revision, normalized evidence hash, material status,
     ownership, approval context, period state, configuration version, and
     command identity with the submitted envelope.
   - Reject or route for review when freshness cannot be established.

6. **Canonical invariants**
   - Enforce balanced, one-sided, non-negative journal lines and valid account,
     company, currency, date, period, and configuration relationships.
   - Validate all cross-entity references within the same company.
   - Ensure the posting date resolves to exactly one valid financial year and
     period.
   - Ensure ordinary posting cannot enter a closed period.

7. **Idempotency and concurrency**
   - Establish a durable company-scoped economic-effect identity.
   - Serialize, reject, or safely resolve concurrent commands for the same
     effect.
   - Return the original exact result for a safe retry with the same identity.
   - Reject a reused identity whose command meaning differs.
   - Ensure an uncertain client outcome can be recovered by querying or retrying
     the same identity without creating a second journal.

8. **Corrections and reversals**
   - Preserve the original posted journal and lines.
   - Create a balanced, additive, linked reversal or replacement journal.
   - Require the appropriate capability, reason, source/evidence reference,
     target posting date, period validation, and idempotency identity.
   - Prevent a second reversal unless an explicitly supported correction
     command permits it.
   - Do not reopen a period or invent a year-end entry automatically.

9. **Atomic audit evidence**
   - Commit successful journal, lines, source/effect relationship, idempotency
     result, and required audit evidence in one transaction where the storage
     boundary permits.
   - Record actor or validated job identity, company, capability, source,
     target, posting context, result, reason, request/correlation identity,
     timestamps, and calculation/version references.
   - Preserve rejected, stale, conflict, and uncertain outcomes through the
     approved durable audit or operational evidence path without creating an
     accounting effect.

10. **Test-only source adapter**
    - Provide a controlled fixture or test adapter that supplies validated
      source and posting-context envelopes.
    - Use it to prove the posting kernel without implementing invoice, bill,
      payment, bank, VAT-return, or reconciliation workflows.
    - The fixture must not be exposed as a production accounting source.

### 4.4 Scope boundary around BL-06 and BL-07

This task is a bounded foundation slice, not completion of either backlog item.

- It implements the canonical posting kernel responsibilities needed to create
  a safe authority boundary.
- It consumes chart, period, financial-year, mapping, and configuration
  contracts.
- It may implement the minimum provider interfaces and test doubles needed to
  exercise those contracts.
- It must not silently become the full BL-07 chart/configuration/period product.
- If a real BL-07 provider is not available, the canonical production posting
  command must remain disabled rather than falling back to browser values,
  ambient configuration, or the legacy JSON journal.

The final implementation review must state which BL-06 and BL-07 portions were
actually delivered. The whole BL-06 and BL-07 backlog items remain blocked until
their remaining prerequisites and approvals are satisfied.

## 5. Explicit exclusions

The task must not include:

- invoice or bill lifecycle implementation;
- payment records, payment allocation, settlement, credits, prepayments,
  refunds, or customer/supplier balances;
- bank import, bank categorisation, transfer pairing, or reconciliation;
- VAT calculation, VAT return locking, HMRC submission, or a second VAT engine;
- migration, historical backfill, cutover, legacy-data rewriting, or DEC-22
  execution;
- year-end closing journals, retained-earnings journals, or year-transition
  workflows;
- chart-of-accounts administration, default-chart onboarding, or full
  configuration management;
- period creation, close, reopen, numbering, or operational period UI;
- journal-authoritative reporting, report redesign, or broad frontend UI;
- universal RLS or a new tenant-isolation architecture;
- provider, queue, worker, scheduler, backup, or deployment selection;
- broad generic-CRUD cleanup unrelated to protecting the new canonical boundary;
- multi-currency accounting behavior beyond the explicitly approved launch
  contract;
- external communications or consequential automation; or
- publishing, production rollout, or production data changes.

Existing `journal_entries` JSON records remain legacy/compatibility records until
a separately approved additive migration and authority-transfer plan exists.
They must not be silently reinterpreted as the new canonical model.

## 6. Dependencies

### 6.1 Required completed or approved dependencies

The task depends on:

1. BL-01-FI and its remediation being complete — satisfied.
2. DEC-01 through DEC-22 remaining approved — confirmed by the current decision
   register.
3. The eight logical ownership boundaries remaining unchanged — confirmed.
4. The final source-freshness treatment being approved for implementation.
5. A typed protected-write contract and server-side money validation being
   available or explicitly included as a prerequisite.
6. An approved relationship to the BL-07 context providers.
7. Architecture, accounting, security, and product approval of this task.
8. A separate schema approval for any physical schema changes.

### 6.2 Required dependency contracts

Before a production posting route can be enabled, the implementation must have
authoritative contracts for:

- authenticated actor or explicit validated system/job principal;
- active membership and company/resource scope;
- operation-specific DEC-05 capability and approval;
- source identity, revision/snapshot/evidence, and source ownership;
- posting date, financial year, accounting period, and period state;
- DEC-11 configuration version and DEC-10 account/control mappings;
- account identity, company ownership, activity, eligibility, and currency;
- deterministic VAT result where the selected source is VAT-bearing;
- durable economic-effect identity and retry outcome;
- transaction isolation, locking, and uncertain-outcome recovery; and
- atomic successful audit evidence.

## 7. Files and areas expected to change

The following are expected implementation areas, not an authorization to edit
them now:

| Area | Expected purpose | Boundary |
|---|---|---|
| `lib/db` schema and exports | Add the approved canonical logical entities, constraints, indexes, and types | Additive schema only; exact physical names require approval |
| API accounting domain/service area | Implement the command boundary, posting kernel, context interfaces, and correction/reversal commands | Server-side only; no browser-created journal lines |
| Principal and Tenant Guard integration | Reuse BL-01-FI for identity, active membership, company/resource scope, and job context | Do not duplicate or bypass the guard |
| Capability/approval integration | Enforce the approved operation capability and approval context | Exact capability names and mapping remain approval-time choices |
| Existing generic entity routes | Ensure the new canonical model is not exposed as generic mutable CRUD | Do not delete legacy records or broaden unrelated route refactors |
| Accounting tests | Add invariant, authorization, freshness, idempotency, transaction, audit, and isolation tests | Include unit, integration, and transaction-level evidence |
| API documentation/contracts | Document the approved internal command/result/error contract if a route is exposed | Exact public route and DTO remain open until approved |

No frontend page, workflow, deployment configuration, dependency, or production
data area is expected to change in this task.

## 8. Proposed schema impact

### 8.1 Are schema changes required?

**Yes, proposed.** The current JSON `journal_entries` shape is not sufficient as
the canonical normalized journal model. The current table may remain a legacy
compatibility surface, but it must not be silently repurposed without an
additive compatibility and migration review.

No schema change is being made by this package.

### 8.2 Required logical entities

The implementation requires the following logical entities. Physical table names,
column names, key types, and migration sequencing are engineering choices that
require approval:

| Logical entity | Required responsibility |
|---|---|
| Canonical journal header | Company, immutable identity, posting date, period, currency, source/effect identity, totals, lifecycle, actor, and configuration context |
| Canonical journal line | Journal relationship, company, stable line order, account identity, one-sided minor-unit debit/credit, currency, and source/tax traceability |
| Posting source/effect identity | Typed company-scoped source, source revision/evidence, posting kind, economic-effect identity, and safe retry result |
| Journal correction/reversal relationship | Original-to-new journal relationship, reason, actor, approval/capability, and idempotency context |
| Accounting audit evidence | Append-only successful and outcome evidence linked to company, source, command, journal, actor/job, and context |
| Account/context provider contract | Authoritative references to company-owned accounts, period, financial year, mappings, and configuration version; may be supplied by BL-07 |

### 8.3 Existing schema reuse

- The current `chart_of_accounts` may be reused as an account source only after
  its company ownership, active state, stable identity, classification, and
  eligibility contract is accepted.
- The current JSON `journal_entries` table cannot be reused unchanged as the
  canonical header/line model.
- Existing invoice, bill, bank, VAT, AI, and compatibility records remain
  source/workflow records.
- Existing denormalized totals and links are not canonical accounting effects.

### 8.4 Required constraints and indexes

The proposed physical model should provide, subject to schema approval:

- foreign keys from lines to headers and from headers to source/context records;
- company-safe relationships for every cross-entity reference;
- unique company-scoped source/effect idempotency identity;
- stable company-scoped account identity;
- non-negative amount checks;
- a line-level check that debit and credit are not both positive;
- indexed company, source, period, posting date, account, and status lookups;
- protection against posted header/line update and deletion; and
- enough audit linkage to rebuild the evidence chain.

The database should enforce simple row-level constraints. The posting service
must enforce cross-row balance, freshness, capability, period, context, and
atomicity invariants in the same authority boundary.

## 9. Accounting invariants

The following are **ACCOUNTING INVARIANTS**, not optional implementation
preferences:

1. A posted journal belongs to exactly one company, currency, source/effect
   identity, financial year, and accounting period.
2. A posted journal has at least two lines.
3. Total debit equals total credit.
4. Debit and credit values are non-negative integer minor units.
5. A line cannot contain both a positive debit and a positive credit.
6. A posted journal has a positive total debit and credit.
7. All lines belong to the same journal, company, and currency.
8. Every account is company-owned, valid, active, and eligible for the posting.
9. The posting date resolves to exactly one valid financial year and period.
10. Ordinary posting into a closed period is rejected.
11. Server-generated final amounts, totals, mappings, and tax results are
    authoritative; browser-provided totals are advisory at most.
12. A source/effect identity cannot create two economic effects.
13. Posted headers and lines are never edited or deleted.
14. A correction or reversal is a new balanced journal linked to the original.
15. A failed transaction creates no partial canonical accounting effect.
16. A successful accounting effect has the required audit evidence.
17. Reports and projections, when later built, derive from immutable canonical
    journals rather than becoming a second authority.
18. Bank evidence, payments, allocations, settlements, and source documents are
    not conflated by this foundation.

## 10. Security requirements

### 10.1 Principal and Tenant Guard

The implementation must reuse the completed BL-01-FI guard. It must not add a
parallel membership lookup or trust a client-supplied company or role.

For every command:

1. Establish the authenticated actor or explicit validated job principal.
2. Resolve one company from trusted server-side context and the owned source.
3. Require an active membership or an explicitly approved system/job context.
4. Evaluate the named operation capability server-side.
5. Verify source, accounts, periods, configuration, journal, lines, and audit
   records all belong to the resolved company.
6. Reject missing, malformed, conflicting, revoked, lookup-failed, or ambiguous
   authorization context.

### 10.2 Proposed capabilities

The following names are a **PROPOSED ENGINEERING DESIGN**, not new policy:

- `accounting.post`;
- `accounting.reverse`;
- `accounting.correct`; and
- any separate capability later approved for period or configuration actions.

The exact names, role mapping, approval requirement, and segregation-of-duties
behavior are **ENGINEERING CHOICES REQUIRING APPROVAL**. The implementation may
not substitute broad role checks or frontend visibility for the approved
capability contract.

### 10.3 Background work

Background work must carry an explicit validated system/job principal and one
company context. Ambient request identity, missing company context, or a queue
payload alone cannot authorize a posting.

## 11. Source-freshness requirements

### 11.1 Required in this task

Final source-freshness revalidation is required before any canonical write. The
final command must account for:

- company and resource ownership;
- source type and stable source identity;
- native revision, event sequence, provider token, or normalized evidence hash;
- material source status and source evidence;
- actor/job, active membership, capability, and approval context;
- posting date, financial year, period, and period state;
- DEC-11 configuration version;
- DEC-10 mapping and account eligibility;
- VAT evidence/result when applicable;
- economic-effect identity and any prior result;
- canonical journal invariants;
- transaction and audit atomicity.

Where a source has no native revision, the approved fallback must be a
deterministic normalized evidence hash with capture and extraction context. If
neither a reliable revision nor a stable hash can be established, automatic
consequential posting must be rejected or routed to an explicitly approved
human-review state.

### 11.2 Required stale/conflict behavior

If current state differs from the command envelope:

- do not merge values silently;
- do not post from the old envelope;
- return an explicit stale, conflict, ownership, or context error;
- preserve the old and current evidence references where the audit contract
  permits;
- require fresh analysis or an authorised correction; and
- make the outcome visible to the responsible company user or operator.

### 11.3 Deferred freshness concerns

The following remain deferred from this task unless required by the selected
posting command:

- provider-specific conditional-read implementations;
- queue technology, expiry policy, and dead-letter infrastructure;
- source-specific payment, allocation, refund, or reconciliation state;
- migration-source adapters and cohort thresholds; and
- production monitoring and operational SLO selection.

Deferral does not permit a production posting path to bypass the required core
freshness contract.

## 12. Transaction and idempotency requirements

### 12.1 Proposed posting transaction

The proposed transaction sequence is:

1. Authenticate the actor/job and resolve one company context.
2. Run the Principal and Tenant Guard and capability check.
3. Load or lock the authoritative source and relevant accounting context.
4. Revalidate source freshness, period, configuration, mapping, VAT, and
   account eligibility.
5. Validate the server-generated command and all journal invariants.
6. Claim or resolve the durable economic-effect identity.
7. If the identity already has the same completed command, return its exact
   original result without inserting another journal.
8. If the identity conflicts with a different command, reject it explicitly.
9. Insert the journal header, lines, source/effect relationship, and required
   audit evidence.
10. Commit the complete result atomically.

Any failed mandatory check must prevent the canonical accounting write.

### 12.2 Idempotency behavior

The proposed identity is company-scoped and must distinguish at least source
identity, posting kind/effect kind, and the intended economic effect. The exact
key construction and durable storage are **ENGINEERING CHOICES REQUIRING
APPROVAL**.

Required outcomes:

- same identity and same meaning: return the original result;
- same identity and different meaning: return a conflict;
- two concurrent first attempts: one effect, one deterministic duplicate/result;
- retry after a known failure: no journal exists and the command may be retried
  safely according to the result;
- retry after an uncertain outcome: query or reuse the same identity; never
  generate a second identity merely because the client timed out;
- duplicate correction/reversal request: return the prior result or a safe
  duplicate response.

### 12.3 Uncertain outcome

The implementation must not claim that a timeout means “not posted.” It must
provide a safe result lookup or equivalent retry contract. If the result cannot
yet be determined, it must return an explicit uncertain/pending operational
state without creating a second effect.

## 13. Immutability and correction behavior

| Situation | Required behavior |
|---|---|
| Draft or unposted command | May be rejected, discarded, or revised within the approved command boundary; no posted journal exists. |
| Balanced valid posting | Create one immutable posted journal and lines atomically with required evidence. |
| Unbalanced, zero, invalid, stale, unauthorized, or wrong-company command | Reject with no canonical accounting effect. |
| Posted journal edit | Reject; do not mutate posted header or lines. |
| Posted journal deletion | Reject; do not physically delete accounting history. |
| Full reversal | Create one new balanced linked reversal journal with reason, authority, target period, and audit. |
| Corrected replacement | Preserve the original, create linked additive reversal/replacement entries, and retain both meanings. |
| Duplicate posting | Resolve through the durable effect identity; never post twice. |
| Failed transaction | Roll back the canonical journal, lines, source/effect claim, and successful-post audit as one unit. |
| Uncertain transaction result | Reconcile by the same command identity; do not replay with a new identity. |
| Period already closed | Reject ordinary posting; do not silently reopen or rebase the date. |
| Year-end | Do not create closing or retained-earnings journals automatically. |

The exact correction command shape and target-period rules require accounting
and architecture approval before execution. This task must not invent a new
accounting policy.

## 14. Audit requirements

### 14.1 Successful posting

Successful audit evidence must accompany the canonical effect atomically and
include, as applicable:

- company and actor/job identity;
- capability and approval context;
- command and correlation identity;
- source type, source ID, source revision/evidence, and source owner;
- posting date, financial year, accounting period, and period state;
- configuration version, resolved account IDs, and control mappings;
- currency, server-calculated totals, and journal/line IDs;
- economic-effect and idempotency identity;
- action, result, timestamp, and request context;
- correction/reversal relationship; and
- source-freshness and validation outcome.

### 14.2 Rejected and uncertain outcomes

The implementation should preserve durable evidence for rejected, stale,
conflicting, duplicate, and uncertain commands without creating an accounting
effect. The exact audit storage, redaction, retention, and failure telemetry
remain **ENGINEERING CHOICES REQUIRING APPROVAL** under DEC-17, DEC-18, DEC-20,
and DEC-21.

The audit writer records evidence; it never grants permission to post.

## 15. Concrete acceptance test plan

Tests must distinguish behavior of the pure validation logic, behavior against
the actual API/database contracts, and all-or-nothing transaction behavior.

### 15.1 Unit tests

Unit tests must cover:

1. a balanced journal is accepted;
2. an unbalanced journal is rejected;
3. a zero-total journal is rejected;
4. negative, non-integer, NaN, overflow, or otherwise invalid monetary values
   are rejected;
5. a line containing both debit and credit is rejected;
6. fewer than two lines are rejected;
7. invalid or inactive account identity is rejected;
8. a wrong-company account is rejected;
9. mixed company or currency lines are rejected;
10. an invalid posting date, missing financial year, ambiguous period, or closed
    period is rejected;
11. a configuration-version mismatch is rejected;
12. a stale source revision or evidence hash is rejected;
13. a missing or ambiguous source identity is rejected;
14. insufficient capability, inactive membership, malformed context, and
    revoked membership are rejected;
15. a reused idempotency identity with different meaning is rejected;
16. correction/reversal commands require reason and the relevant authority; and
17. server-generated totals cannot be replaced by client-supplied totals.

### 15.2 Integration tests

Database/API integration tests must cover:

1. a valid internal command creates one header, its lines, source/effect link,
   and successful audit evidence;
2. the resulting journal is balanced and all rows are company-scoped;
3. a Company A principal cannot post using a Company B source, account, period,
   configuration, or journal reference;
4. an inactive or revoked member cannot post, reverse, correct, or retry a
   command;
5. an authenticated principal without the posting capability is rejected;
6. a closed period rejects ordinary posting;
7. a configuration or control-mapping mismatch rejects posting;
8. duplicate economic effect requests produce one journal and a safe duplicate
   result;
9. a retry with the same identity returns the original exact result;
10. a conflicting reuse of the same identity is rejected;
11. a posted journal cannot be edited or deleted through the dedicated path or
    generic CRUD;
12. a reversal/correction preserves the original and creates an additive linked
    balanced result;
13. the source-freshness envelope is revalidated at final posting time;
14. a source or context change between analysis and posting produces a visible
    stale/conflict rejection; and
15. background posting requires explicit validated job/company context.

The company-isolation tests should use authenticated Company A and Company B
fixtures when the protected API route exists. They must not rely only on a
client-supplied company field.

### 15.3 Transaction-level and concurrency tests

Transaction tests must prove:

1. failure during journal-line persistence leaves no header, line, effect
   identity, or successful-post audit;
2. failure during required successful-audit persistence leaves no accounting
   effect;
3. concurrent commands for one economic effect create at most one journal;
4. concurrent commands with conflicting meanings do not both succeed;
5. a period close/configuration change racing with posting cannot allow a stale
   or closed-context post;
6. a timeout or simulated uncertain commit can be resolved using the same
   identity without duplicate accounting;
7. a duplicate reversal cannot silently create a second reversal; and
8. restoration or retry of the command does not replay a completed effect.

The exact isolation level, lock order, retry policy, and uncertain-outcome
storage must be approved as engineering choices before implementation.

## 16. Proposed engineering design

The following is a candidate design, not an approved physical architecture:

```text
trusted source/context envelope
  -> Consequential Accounting Command Boundary
  -> Principal and Tenant Guard
  -> Source Freshness Guard
  -> Accounting Context Resolver
  -> Idempotency and Concurrency Coordinator
  -> Canonical Posting Authority
  -> atomic journal/header + lines + audit write
```

The eight logical ownership boundaries remain:

1. Consequential Accounting Command Boundary;
2. Principal and Tenant Guard;
3. Source Freshness Guard;
4. Accounting Context Resolver;
5. Domain State Guard;
6. Idempotency and Concurrency Coordinator;
7. Canonical Posting Authority; and
8. Audit Evidence Writer.

`#40-CF-01` uses the first, second, third, fourth, fifth where relevant,
sixth, seventh, and eighth boundaries. Domain-specific payment, allocation,
refund, migration, and reconciliation state remains deferred.

These are logical boundaries. The task does not approve microservices,
deployment units, database procedures, queues, or a particular framework.

## 17. Engineering choices still requiring approval

The following must be decided or expressly accepted before execution:

1. **Physical schema strategy** — recommended: additive canonical entities
   beside the legacy JSON journal model, with no destructive replacement.
2. **Physical names and key types** — must preserve company-safe relationships
   and immutable posted identity.
3. **BL-07 context relationship** — choose whether the task consumes existing
   providers, implements minimum approved context providers, or remains
   disabled until a separately approved BL-07 slice is available.
4. **Exact command/API shape** — recommended: a protected typed internal command;
   no arbitrary client journal lines.
5. **Capability names and role mapping** — must implement DEC-05 semantics
   without broad-role or UI-only authorization.
6. **Source revision/hash contract** — choose native revision precedence,
   normalized hash format, evidence strength, and unsupported-source result.
7. **Transaction isolation and lock order** — must prevent period, context,
   source, and idempotency races.
8. **Economic-effect identity** — choose key construction, scope, retention,
   conflict comparison, and result lookup.
9. **Audit storage and immutability** — choose append-only storage, redaction,
   retention, and failure behavior under the approved lifecycle policies.
10. **Money precision and residual handling** — use integer minor units and
    explicit currency; do not invent a balancing residual policy.
11. **Correction/reversal command shape** — choose how target dates, reasons,
    links, and duplicate correction requests are represented.
12. **Legacy generic CRUD treatment** — ensure it cannot mutate the new
    canonical model; do not silently declare legacy JSON writes canonical.
13. **Feature activation** — recommended: keep production source workflows
    disabled until all required real context providers and gates are complete.

None of these choices is silently approved by DEC-04, DEC-05, or this package.

## 18. Rollback and recovery strategy

### 18.1 Before production activation

- Take the normal project checkpoint before schema or code execution.
- Use an additive, forward-compatible schema migration.
- Keep the new posting command behind an explicit activation control.
- Do not wire existing source workflows to it until integration approval and
  tests are complete.
- Verify that legacy reads remain compatible and that no legacy JSON row is
  reinterpreted as canonical history.

### 18.2 If implementation or tests fail

- Disable the new command boundary.
- Preserve all diagnostics and audit evidence.
- Correct code or schema forward; do not delete posted journals to simulate
  rollback.
- If a controlled environment contains test postings, remove or restore only
  through an approved isolated test reset, never through a production
  accounting deletion path.

### 18.3 After any canonical posting exists

Rollback cannot rewrite accounting history. A defect is handled by:

- disabling further posting if necessary;
- preserving the original journal;
- using an approved additive correction/reversal path;
- using DEC-20 recovery only under the approved recovery and no-replay process;
  and
- reconciling the idempotency/effect register before resuming.

No deployment or production recovery approval is granted by this package.

## 19. Risks and mitigations

| Risk | Consequence | Required mitigation |
|---|---|---|
| Treating the current JSON journal as canonical | Conflicting authorities and unsafe edits | Additive model; explicit legacy status; no silent reinterpretation |
| Posting without a real BL-07 context provider | Wrong period, mapping, or configuration | Disable production posting until required providers exist |
| Stale source or approval envelope | Incorrect accounting effect | Final source/context revalidation and visible stale/conflict result |
| Duplicate or conflicting retries | Double accounting | Durable effect identity, unique boundary, same-key result lookup |
| Cross-company references | Tenant breach or wrong-company accounting | BL-01-FI reuse plus company-safe relationships and every-resource checks |
| Generic CRUD bypass | Unbalanced or mutable canonical history | Dedicated protected boundary and route-level bypass tests |
| Partial transaction failure | Header, lines, and audit disagree | One transaction and failure-injection tests |
| Period/configuration race | Posting under invalid context | Lock/order design and concurrency tests |
| Overbroad #40 scope | Unreviewable accounting behavior | Exclude source workflows, BL-07 administration, migration, and UI |
| Ambiguous correction behavior | History rewritten or corrections duplicated | Additive linked correction contract and accounting approval |
| Unapproved RLS or infrastructure choice | Deployment and data-access risk | Keep RLS/provider/deployment decisions separate |
| Unsupported currency/rounding behavior | Incorrect totals | Explicit integer minor-unit contract and reject unsupported cases |

## 20. Open questions

These questions are not hidden assumptions. They must be answered in the
implementation approval or recorded as explicit execution gates:

1. Are the proposed logical entities approved as an additive schema change, and
   which physical names/keys should be used?
2. Will a real BL-07 period/configuration/context provider be available before
   the canonical posting route is enabled?
3. What exact capability names and approved role mappings will be used?
4. What native revision and normalized-hash rules apply to the first supported
   test/production source?
5. What transaction isolation and lock order will be used for source, period,
   configuration, and effect identity?
6. What exact economic-effect identity and result-retrieval contract will be
   durable?
7. What audit storage, retention, redaction, and rejected-attempt behavior is
   accepted?
8. What correction/reversal command is in the first foundation contract without
   expanding into invoice, payment, or period workflows?
9. Is the first production activation intentionally disabled until a later
   source-workflow task, with this task proving the kernel through a fixture
   adapter only?
10. What exact currency precision and unsupported-treatment behavior is
    accepted for the initial UK/GBP scope?

If any answer changes approved policy rather than selecting engineering detail,
implementation must stop and raise that policy conflict for review. No DEC-23
should be created to resolve ordinary technical ownership.

## 21. Approval gates

The following gates are required before execution:

| Gate | Required evidence | Required approval |
|---|---|---|
| Scope gate | This package, exact scope, exclusions, dependencies, and deferred work | Product owner |
| Accounting gate | Invariants, money model, posting/correction behavior, and no-policy-invention review | Accounting reviewer |
| Architecture/data gate | Logical-to-physical schema, relationships, constraints, compatibility, and BL-07 context contract | Architecture and data reviewer |
| Security gate | BL-01-FI reuse, capability, active membership, company isolation, resource ownership, and background context | Security reviewer |
| Freshness gate | Final revalidation, revision/hash, stale/conflict, and unsupported-source treatment | Accounting, security, architecture, product |
| Transaction gate | Atomicity, locks, idempotency, concurrency, uncertain outcome, and no-replay plan | Architecture and operations |
| Audit/lifecycle gate | Successful and rejected evidence, retention, redaction, recovery, and correction traceability | Accounting, security, operations |
| Test gate | Unit, authenticated integration, transaction, concurrency, failure-injection, and isolation plan | Engineering, accounting, security |
| Activation gate | Explicit decision whether production posting is enabled or remains disabled pending source workflows | Product owner and accounting reviewer |
| Execution gate | Explicit user approval of `#40-CF-01`; no implied approval of unrelated backlog items | User/stakeholder |

Schema, deployment, publishing, migration, and production rollout each remain
separate approvals even if this task is approved.

## 22. Definition of done

`#40-CF-01` is complete only when all of the following are demonstrated:

1. The approved logical and physical canonical journal model exists without
   destructive legacy conversion.
2. One protected consequential posting boundary is the only path that can
   create canonical journals.
3. BL-01-FI is reused for authenticated identity, active membership, company
   scope, and resource ownership.
4. The named capability and any required approval are evaluated server-side.
5. Final source/context freshness is revalidated immediately before posting.
6. Server-side amount, account, company, currency, period, configuration,
   source, and balance invariants are enforced.
7. Posted headers and lines are immutable and generic CRUD cannot mutate them.
8. Corrections/reversals are additive, linked, reasoned, authorized, and
   idempotent.
9. Duplicate, retry, concurrency, and uncertain-outcome behavior is proven.
10. Successful journal, source/effect identity, and audit evidence commit
    atomically.
11. Failure injection proves no partial canonical accounting effect.
12. Authenticated Company A/B isolation tests pass.
13. The fixture source adapter is not exposed as an unsupported production
    accounting source.
14. No invoice, bill, payment, allocation, VAT-return, reconciliation,
    migration, year-end, RLS, broad UI, deployment, or publishing behavior has
    been smuggled into the task.
15. Accounting, architecture, security, operations, and product reviewers
    accept the implementation evidence.
16. A separate explicit user decision records whether the completed bounded
    slice may be activated.

## 23. Final governance check

At the time this package is produced:

- DEC-01–DEC-22 remain approved.
- No DEC-23 exists or is required.
- BL-01-FI is complete.
- #40 remains unimplemented.
- #41 remains planning/design only.
- BL-06 and BL-07 remain blocked pending their applicable scoped approvals.
- No schema, accounting, migration, UI, workflow, dependency, infrastructure,
  deployment, publishing, or production-data changes were made for this
  package.
- The unrelated proposed bulk-approval task remains untouched.
- Source freshness remains an implementation-level safety contract and is not
  reassigned to DEC-12.
- The eight logical ownership boundaries remain unchanged.

## 24. Verdict

The planning records provide a sufficiently bounded and reviewable first
implementation slice. The remaining physical schema and engineering choices are
explicitly identified as approval gates rather than being silently resolved.

**READY FOR #40 IMPLEMENTATION APPROVAL**