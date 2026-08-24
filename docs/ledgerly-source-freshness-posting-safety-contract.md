# Ledgerly Source-Freshness and Posting-Safety Contract

**Status:** PLANNING / DESIGN ONLY — NOT APPROVED FOR IMPLEMENTATION  
**Governing decisions:** DEC-01 through DEC-22 APPROVED  
**Implementation authority:** None  
**BL-06 / BL-07:** BLOCKED  
**DEC-23:** Not created and not required by this contract  
**Purpose:** Define the proposed final revalidation contract for consequential
accounting persistence  
**Prepared:** 2026-08-21

**Ownership record:** [Safety-Rule Ownership
Record](ledgerly-safety-rule-ownership-record.md)

> This is a planning and design contract. It does not write application code,
> modify schema or migrations, implement accounting logic, change UI/workflows,
> modify infrastructure or dependencies, deploy, publish, migrate data, or
> unblock backlog work. A proposal below is not an approved policy amendment.

## 1. Contract labels

This document distinguishes:

- **APPROVED GOVERNANCE REQUIREMENT** — a binding constraint already approved
  through DEC-01–DEC-22;
- **REQUIRED IMPLEMENTATION BEHAVIOR** — behavior an implementation must have
  to satisfy those constraints;
- **PROPOSED TECHNICAL DESIGN** — a candidate design for separate review;
- **ENGINEERING CHOICE THAT REMAINS CHANGEABLE** — a non-policy implementation
  decision;
- **REQUIRES SEPARATE APPROVAL** — something governance approval alone cannot
  authorise; and
- **DELIBERATELY OPEN** — intentionally not selected here.

## 2. Purpose, scope, and non-goals

### Purpose

Source freshness is the assurance that a consequential action relies on
identified, authoritative state that was revalidated immediately before Ledgerly
persists an accounting effect. It prevents a user, worker, bulk operation, or
AI-assisted recommendation from turning an old analysis into current
accounting.

### In scope

This contract applies before any action that can:

- post, reverse, correct, or otherwise affect a canonical journal;
- create an accounting payment, allocation with a canonical effect, refund,
  VAT adjustment, or reconciliation outcome with an accounting effect;
- lock or alter a VAT return;
- close, reopen, or otherwise change accounting-period state;
- create a migration/cutover accounting effect;
- execute a queued or retried consequential accounting command; or
- persist any AI-assisted consequential accounting action.

### Out of scope

This contract does not:

- make ordinary reads or drafts authoritative;
- choose a database schema, API format, lock primitive, queue, worker, ORM, or
  cloud service;
- decide the full source-specific accounting treatment of each workflow;
- approve a new VAT scheme, a new product scope, migration execution, or
  cutover;
- assign a final governance owner for source freshness; or
- create DEC-23.

## 3. Governance baseline and ownership boundary

### Existing approved governance requirements

| Decision | Dependency on this contract |
|---|---|
| DEC-01 | The approved hierarchy governs this contract. A technical design cannot override a higher-level policy or silently create policy. |
| DEC-02 | Only approved UK/GBP launch-scope sources and accounting treatments may be considered for consequential persistence. |
| DEC-03 | VAT must be deterministic, source-linked, invoice-basis for the supported scheme, and never inferred from bank settlement or AI output. |
| DEC-04 | Canonical journals are server-generated, balanced, immutable after posting, source-linked, idempotent, atomic, and auditable; corrections are linked additive events. |
| DEC-05 | Every consequential action requires active membership, company scope, server-side capability evaluation, approval where required, and audit. |
| DEC-06 | Posting date determines the company financial year; the assignment may not be silently rebased. |
| DEC-07 | Ordinary posting may not bypass a closed accounting period; period identity and state are controlled. |
| DEC-08 | Year-end is reporting-only; posting safety may not generate automatic closing or retained-earnings journals. |
| DEC-09 | Stable account identity and eligible classification must be respected; names/codes alone are not authority. |
| DEC-10 | AR, AP, bank/cash, Output VAT, and Input VAT mappings are protected, company-scoped, and validated. |
| DEC-11 | Material posting configuration is immutable, company-scoped, effective-dated, selected by canonical posting date, and retained with resolved account IDs. |
| DEC-12 | Payment, allocation, and settlement are distinct; bank evidence, allocation, and settlement cannot create duplicate cash or journal effects. |
| DEC-13 | Overpayment/unapplied-cash treatment must remain explicit; an excess cannot be silently over-allocated. |
| DEC-14 | Unapplied-cash workflow transitions remain controlled, traceable, and auditable. |
| DEC-15 | Refunds require approved source/balance/authority checks and cannot be a free-standing alternative posting path. |
| DEC-16 | Payment-on-account scope and transitions remain explicitly constrained. |
| DEC-17 | Audit and retention must preserve accounting meaning, evidence, and lifecycle traceability. |
| DEC-18 | Disposal/legal-hold behavior cannot remove required posting, audit, or evidence authority. |
| DEC-19 | Exports are bounded company-scoped representations, never alternate accounting authority. |
| DEC-20 | Recovery checkpoints, restore validation, audit, and no-replay behavior protect consequential state. |
| DEC-21 | Company boundaries apply to users, records, jobs, documents, exports, support, recovery, and AI context. |
| DEC-22 | Migration/cutover must preserve provenance, validate/reconcile before authority changes, retain exceptions, and not invent accounting facts. |

### Ownership finding

**APPROVED GOVERNANCE REQUIREMENT:** DEC-12 is the Payment, Allocation and
Settlement Policy. Its approved review explicitly states that source freshness
is not decided or reassigned there and remains a separate posting-safety
dependency.

**REQUIRES SEPARATE APPROVAL:** The product/accounting owner must decide where
the final source-freshness policy is governed and whether an amendment to an
existing decision is needed. Before affected implementation is authorised, the
owner must explicitly record:

1. the existing decision that owns the cross-cutting source-freshness contract;
2. whether a narrowly scoped DEC-12 boundary amendment is needed for
   payment/allocation-specific application; and
3. the resulting references in the decision register and affected
   implementation briefs.

This contract does not assume that DEC-12 owns source freshness, does not amend
it, and does not create DEC-23. If an amendment is selected, it must clarify
the boundary without silently changing DEC-12's approved accounting rules.

## 4. Core safety rule

### Required implementation behavior

No consequential accounting persistence may occur unless the authoritative
current state has been revalidated at final posting time, the operation remains
permitted, all accounting invariants hold, and the resulting accounting effect
is recorded atomically with durable audit evidence.

“Current” means current at the final revalidation point for the source,
company-owned accounting state, user/job authority, period, configuration,
mapping, VAT evidence, allocation/balance state, and command identity. It does
not mean a previously displayed page, an older AI recommendation, a browser
cache, a draft, or a queue payload is still trustworthy.

### Proposed technical design

Use a **final command envelope**. A draft, recommendation, approval request,
queue item, or retry carries the evidence it was based on, but the server treats
that envelope as a claim to revalidate rather than as permission to post.

The final server-side posting command:

1. establishes authenticated actor/job and company scope;
2. reloads or locks authoritative Ledgerly state;
3. compares it to the submitted/captured envelope;
4. resolves current governed posting context;
5. validates authority and accounting invariants;
6. applies the idempotency boundary;
7. writes the canonical outcome and audit together; or
8. writes no accounting effect and returns an explicit reject, stale, conflict,
   duplicate, or retry-safe result.

## 5. Proposed source and command envelope

The following is a **PROPOSED TECHNICAL DESIGN**, not a prescribed schema.

### Source identity and evidence

A consequential command should identify:

- company ID;
- source type and stable source ID;
- source owner/company ID;
- source revision, version, event sequence, ETag, or provider concurrency
  token where available;
- deterministic normalized evidence hash where no native revision exists;
- source status and material source attributes used for the decision;
- source-captured time, evidence-retrieved time, and final-revalidated time;
- source document/evidence references and integrity identifiers;
- source adapter/version and provenance where imported or migrated; and
- an explicit reliability classification when source freshness cannot be
  established automatically.

### Decision and approval context

The envelope should identify:

- analysis/recommendation/draft identity and the source snapshot it used;
- requested consequential operation and intended accounting effect;
- approval identity, approver, approval time, approval scope, and expiry where
  an approval is required;
- authenticated actor or job principal;
- active membership evaluation and capability decision;
- company scope asserted by the command and company scope resolved server-side;
- user- or system-supplied reason where required;
- correlation/causation identity for the operation; and
- AI recommendation/action identity and model-output evidence when AI assisted.

### Accounting context

The envelope should identify:

- canonical posting date;
- financial-year identity when relevant;
- accounting-period identity and observed state;
- DEC-11 configuration-version identity and effective-date context;
- DEC-10 control-account mapping identities for every protected role involved;
- stable ordinary-account identities and eligibility context where used;
- DEC-03 VAT profile, tax-rule/version, source evidence, calculation result,
  supported-scope state, and VAT lock/return context where applicable;
- payment/allocation/credit/prepayment/refund balance versions where applicable;
- expected journal template/effect class; and
- all monetary inputs in approved currency/minor-unit form.

### Command identity

The envelope should contain:

- a unique command/request identity;
- an idempotency key scoped to company, operation, and intended economic effect;
- intended source/revision/effect identity;
- queue creation/expiry/retry metadata where queued; and
- a result reference once a command completes.

### Envelope binding and lifecycle rules

- The envelope must identify the exact source and intended effect; a broad
  company or list query is not sufficient for consequential persistence.
- The analysis snapshot is bound to the source revision and each material
  configuration, mapping, period, VAT, balance, and authority context used to
  produce it.
- A command affecting multiple material sources carries an independently
  comparable envelope for each source plus an overall command identity. A
  single aggregate timestamp must not hide a stale source.
- An envelope passed from draft to approval remains an immutable reference; it
  must not be edited in place to make stale state appear current.

The implementation design should model a reviewable state machine with
equivalent states for captured, analysed, awaiting approval,
approved-pending-revalidation, posted, rejected-stale, conflict, expired,
retryable failure, terminal failure, and cancelled actions. State names remain
changeable, but approval itself must never become posting authority.

**ENGINEERING CHOICE THAT REMAINS CHANGEABLE:** Field names, hashes, token
formats, data serialization, retention implementation, and whether an envelope
is represented as one record or related records.

## 6. Final revalidation sequence

### Required implementation behavior

The server must complete the following checks at final posting time. A browser,
AI model, import client, worker payload, or draft cannot substitute for them.

1. **Authenticate principal.** Establish the user, service principal, or
   controlled job identity.
2. **Resolve company context.** Derive the authoritative company scope
   server-side and reject any mismatch with command, source, target, document,
   account, bank evidence, export, or job scope.
3. **Validate active membership.** For human actions, confirm the membership is
   active at final posting time. A previously active user cannot post after
   revocation or deactivation.
4. **Validate DEC-05 capability and approval.** Evaluate the specific
   server-side capability for the exact consequential operation, target,
   company, and current state. Revalidate required approval status, approver
   eligibility, segregation-of-duties rules, and approval expiry.
5. **Resolve authoritative source.** Reload or lock the source record/evidence;
   confirm it exists, belongs to the company, is eligible for the intended
   operation, and matches the captured source identity.
6. **Detect source change.** Compare native revision/version/event sequence or
   normalized evidence hash, material status, ownership, amount, party,
   document, VAT, and other operation-relevant values to the envelope.
7. **Validate queue/recommendation freshness.** Confirm the operation has not
   expired and that analysis, approval, AI recommendation, and queue context
   still match current source and policy context.
8. **Resolve posting date and DEC-06 year.** Determine posting date under the
   source/workflow rule and resolve its company financial year. Reject ambiguous
   or unsupported assignment.
9. **Validate DEC-07 period.** Resolve the period for that date, confirm it is
   the expected company period, and reject ordinary posting to CLOSED or
   otherwise non-postable state.
10. **Resolve DEC-11 configuration.** Select the immutable, effective-dated
    configuration version for the canonical posting date and compare it to
    the expected configuration context where that context affected approval or
    analysis.
11. **Validate DEC-10 mappings and DEC-09 accounts.** Resolve protected
    control-account mappings and all ordinary account identities, then verify
    company, active/eligible status, classification, role compatibility, and
    future-effective mapping conditions.
12. **Validate DEC-03 VAT.** Recompute or revalidate deterministic VAT from
    current authoritative source/tax evidence, supported VAT profile, applicable
    rate/rule effective date, correction/return state, and protected VAT
    account mapping. Reject unsupported, stale, inconsistent, or manually
    overridden treatment.
13. **Validate source-specific balance/state.** For payments, allocations,
    credits, prepayments, refunds, reconciliation, and migration, lock/reload
    the relevant balances, settlement state, exception state, and
    source-version context. Prevent over-allocation, duplicate payment effects,
    unauthorised refund, or invented migration fact.
14. **Validate idempotency and duplicate prevention.** Resolve the command and
    economic-effect identity under concurrency. Return the original completed
    outcome only when it is exactly the same permitted command; reject a key
    reused with changed intent.
15. **Validate final accounting invariants.** Confirm the canonical effect is
    permitted, source-linked, company-scoped, integer-minor-unit, currency
    compatible, balanced, control-account-compatible, non-duplicating, and
    valid for the resolved year/period/configuration/VAT context.
16. **Persist atomically.** Commit the canonical outcome, source/effect links,
    command/idempotency result, and required audit evidence in one authoritative
    transaction. If any mandatory validation or audit write fails, commit no
    accounting effect.

### Ordering rule

Some checks may be repeated or optimized, but final validation of membership,
capability, source, period, configuration, mappings, VAT, balances,
idempotency, and invariants must occur after the system has acquired the
appropriate consistency/transaction boundary and immediately before the
accounting write.

## 7. Stale reads, conflicts, and source versions

### Required implementation behavior

A command is stale and must not post if any operation-relevant current state
differs from the approved or analysed envelope, including:

- source revision, hash, event sequence, material fields, status, or ownership;
- source document/evidence validity;
- company scope or resource ownership;
- actor membership, capability, approval, or approval expiry;
- posting date, financial year, period identity, or period state;
- configuration version, control-account mapping, account eligibility, or
  ordinary account identity;
- VAT evidence, VAT rule/profile, calculation result, return state, or VAT
  mapping;
- payment/unapplied/credit/prepayment/refund/allocation balance or eligibility;
- migration cohort, mapping, exception, checkpoint, or validation state; or
- prior completion of the same economic effect.

Time since analysis can be an additional expiry rule, but age alone is not a
replacement for version/snapshot comparison where an authoritative revision is
available.

### Sources without a native revision

**PROPOSED TECHNICAL DESIGN:** Build a deterministic hash from the normalized,
operation-relevant evidence, retain the evidence retrieval time and provenance,
and classify the strength of the freshness evidence.

- If the source can be hashed and re-read, compare the final hash before
  posting.
- If source evidence is incomplete, ambiguous, externally mutable without a
  comparable version, or cannot be re-read, do not claim freshness.
- Route the action to an explicit human review, migration exception, or
  non-posting state as appropriate.
- Never manufacture a revision or treat a UI timestamp as proof of source
  immutability.

### Conflict response

When a conflict is detected:

- write no canonical journal or partial accounting state;
- preserve the submitted/captured envelope and current observed state to the
  extent permitted by retention/privacy policy;
- return a deterministic `stale`, `conflict`, `not_authorised`,
  `not_postable`, `duplicate`, or `validation_failed` outcome;
- require fresh analysis/recommendation and renewed approval where the changed
  context made prior approval unreliable;
- expose a business-language reason to an authorised user without leaking
  another company's data; and
- record the attempted consequential action and outcome in audit evidence.

## 8. Queued actions and retry behavior

### Required implementation behavior

A queued action is a deferred proposal, not a standing posting permission. It
must carry sufficient company, principal, source, approval, configuration, and
idempotency context to revalidate itself without ambient request state.

A queued action must expire or be rejected when:

- its source revision or material evidence changes;
- its approval expires, is revoked, or the approver no longer has required
  authority;
- the actor's membership/capability is revoked where a human authority is
  required;
- the posting period closes or its configuration/mapping changes in a way that
  affects the intended effect;
- its defined maximum age is reached;
- it becomes outside supported product/VAT/migration scope; or
- a duplicate/equivalent effect has already completed.

### Proposed retry behavior

1. A retry first resolves the idempotency result.
2. If the same command committed successfully, return its original result;
   never post another journal.
3. If no outcome committed, repeat the full final revalidation sequence.
4. If state changed, mark the queued action stale/conflicted and require a new
   analysis or approval rather than replaying the old decision.
5. If an infrastructure failure leaves completion uncertain, use the
   authoritative command/effect record to determine whether a journal was
   committed before retrying.
6. Dead-lettered consequential actions remain company-scoped, auditable, and
   reviewable; they are not silently discarded or automatically force-posted.

**ENGINEERING CHOICE THAT REMAINS CHANGEABLE:** Queue technology, expiry
duration, retry back-off, number of attempts, and dead-letter implementation.
The chosen values must be documented per operation and must not weaken the
final revalidation rule.

## 9. Concurrency, atomicity, and idempotency

### Required implementation behavior

The system must not rely on “check, then later write” behavior for
consequential accounting. It must establish a transaction/consistency boundary
that prevents the validated Ledgerly state from changing between final
validation and commit, or explicitly detects and rejects that race.

The atomic boundary must include, where applicable:

- canonical journal and journal lines;
- source/effect links;
- payment, allocation, credit, prepayment, refund, and settlement state;
- period/configuration/mapping resolution used for the posting;
- command/idempotency completion record; and
- audit evidence required for the accounting outcome.

### Proposed idempotency model

Use an idempotency identity that is scoped at least by:

`company + command operation + source identity + intended economic effect`

The exact key construction remains changeable, but it must:

- identify the same intended effect across network retries;
- reject accidental key reuse for a different source, amount, target, company,
  or operation;
- prevent duplicate journal/payment/reconciliation/refund/migration effects;
- return a safe prior result for an exact duplicate rather than creating a
  second result;
- distinguish a correction/reversal, which is a new controlled accounting
  action, from a replay of the original action; and
- remain recoverable across process restart and job retry.

### Concurrency scenarios

| Scenario | Required result |
|---|---|
| Two users approve/post the same source simultaneously | At most one effect commits. The loser receives the completed identical result only for an exact duplicate, otherwise a stale/conflict outcome. |
| Two allocations consume the same payment or invoice/bill remainder | Lock or conditionally validate current eligible balances. No allocation may exceed the post-lock remainder, and no duplicate cash journal may result. |
| A period closes while a posting is pending | Posting and close/reopen operations must serialize or detect the state change. Ordinary posting cannot commit into a closed period. |
| A configuration or control mapping changes during posting | The effective version/mapping used must be deterministically resolved within final validation. If changed context invalidates the expected effect, reject as stale/conflict. |
| Membership/capability changes after draft approval | Final capability check prevails; revoked/inactive authority cannot post. |
| Queue retries after timeout | Query the durable idempotency/effect result. Return prior success only if committed; otherwise revalidate fully. |
| Reconciliation and manual payment commands target the same bank evidence | Enforce one authoritative source/effect relationship or reject conflict. Bank evidence cannot create two payment journals. |
| External source changes after it is read | Use a provider revision/conditional operation where supported; otherwise record the final observed snapshot and route uncertainty to review rather than asserting a stronger guarantee than the source supports. |
| Restore/recovery replays a command | Recovery must preserve idempotency/effect state so replay cannot create a duplicate journal. |

### External source boundary

No local transaction can make a third-party system immutable. The contract’s
guarantee is that Ledgerly validates the strongest authoritative source
revision/snapshot available immediately before its own commit and preserves
what was validated. Where the source supports conditional reads/writes,
implementation should use them. Where it does not, automatic consequential
posting must be bounded by evidence strength and may require human review.

## 10. Security and tenant-scope checks

### Required implementation behavior

Before final persistence, the server must:

- authenticate a human, service principal, or controlled job;
- derive company context from authorised server-side state, not trust a client
  company ID;
- verify active company membership for human actions;
- evaluate the exact DEC-05 capability for the current command;
- verify required approval and any segregation-of-duties condition;
- verify source, evidence, document, payment, allocation, account, mapping,
  configuration, period, VAT, journal, and audit resources all belong to the
  same authorised company;
- verify a job carries explicit, bounded company authority instead of an
  inherited/global context;
- prevent a support, export, recovery, migration, or AI context from bypassing
  the normal tenant boundary;
- return non-leaking errors for unauthorised or cross-company identifiers; and
- audit both successful privileged access and blocked consequential access.

### Proposed principal model

Human actions, system jobs, migration operators, recovery operators, and
support access should be distinguishable principals. Each should carry
operation-specific, company-scoped authority and an audit trail. A worker may
not substitute a broad global role for the final capability check.

**DELIBERATELY OPEN:** Exact roles, capability names, impersonation mechanism,
RLS design, pooled connection context, and support-access workflow.

## 11. VAT, period, configuration, mapping, and accounting checks

### VAT — DEC-03

**REQUIRED IMPLEMENTATION BEHAVIOR:** Validate that the source remains in the
approved VAT scope, the supported company VAT profile/tax basis applies, the
source tax point and VAT evidence are current, the applicable tax rule/rate is
effective, the result is deterministic, and relevant VAT return/lock state
permits the operation. Bank settlement, AI output, or a stale analysis cannot
override source VAT evidence.

### Financial year and period — DEC-06 / DEC-07 / DEC-08

**REQUIRED IMPLEMENTATION BEHAVIOR:** Resolve the financial year and accounting
period from the final canonical posting date and current company-controlled
calendar. Require a valid postable period. Preserve reporting-only year-end
behavior and reject any implicit closing/retained-earnings effect.

### Configuration version — DEC-11

**REQUIRED IMPLEMENTATION BEHAVIOR:** Resolve the immutable configuration
version effective on final posting date. A proposal approved using a materially
different configuration context must be treated as stale or must undergo the
approved re-review path. Retain the final resolved version and account IDs on
the accounting outcome.

### Control mappings — DEC-10

**REQUIRED IMPLEMENTATION BEHAVIOR:** Resolve protected AR, AP, bank/cash,
Input VAT, Output VAT, and applicable VAT-settlement mappings from the
authoritative company configuration. Verify role eligibility and account
classification; do not infer mappings from label, code, browser choice, AI
suggestion, or stale cached defaults.

### Final accounting invariants — DEC-04 and DEC-09 through DEC-16

**REQUIRED IMPLEMENTATION BEHAVIOR:** Validate that the intended effect:

- is the permitted canonical result for the current authoritative source;
- uses only stable, eligible, company-scoped accounts;
- uses approved currency/minor-unit representation;
- balances debits and credits;
- has exactly one intended cash/payment effect;
- does not duplicate a bank-evidence, payment, allocation, refund, or
  reconciliation effect;
- does not exceed eligible payment, document, credit, prepayment, or refund
  balances;
- preserves source, configuration, mapping, VAT, year, and period provenance;
- cannot edit/deactivate/delete posted history; and
- uses linked correction/reversal behavior rather than rewriting a prior
  canonical result.

## 12. AI-assisted consequential actions

### Approved governance requirement

AI may recommend, classify, explain, or prepare drafts; it is not accounting
authority. DEC-03, DEC-04, DEC-05, DEC-17/18, and DEC-21 require deterministic
rules, approval/capability controls, audit, evidence retention, and strict
company context.

### Required implementation behavior

For an AI-assisted action:

- bind the recommendation to company-scoped source/evidence identifiers and
  their observed revision/snapshot;
- record retrieved evidence, model/action identity, confidence/uncertainty,
  recommendation time, and proposed operation;
- require an authorised human approval where required by DEC-05;
- treat recommendation or approval as stale when material source, capability,
  period, configuration, mapping, VAT, balance, or policy context changes;
- perform the same final server-side revalidation as a non-AI command;
- never allow an AI output, tool call, cached recommendation, or prompt content
  to bypass source/VAT/accounting/capability validation; and
- retain AI action history and permitted prompt/output evidence according to
  DEC-17/18 without leaking cross-company information.

## 13. Failure and conflict behavior

### Required implementation behavior

No failure condition below may leave a partial canonical effect.

| Failure or conflict | Required behavior |
|---|---|
| Source missing, deleted, voided, changed, or cannot be verified | Reject as stale/conflict; write no journal; preserve auditable evidence and require review. |
| Source belongs to another company or company context is ambiguous | Reject without revealing cross-company details; audit blocked access. |
| Membership inactive or capability/approval invalid | Reject as not authorised; do not reuse a prior approval; audit the attempted privileged action. |
| Period closed, year/period unresolved, or period changes during command | Reject as not postable; do not silently move the posting date/period. |
| Configuration/mapping is absent, invalid, stale, or ineligible | Reject as validation conflict; require a renewed approved context. |
| VAT source/rule/profile/result is unsupported or inconsistent | Reject as VAT validation failure; do not approximate or use bank/AI metadata. |
| Allocation, credit, prepayment, refund, or payment balance changed | Reject or return exact completed duplicate; never over-allocate or duplicate cash. |
| Idempotency key was completed with identical command | Return durable original outcome; create no new accounting effect. |
| Idempotency key is reused with different intent | Reject as idempotency conflict and audit. |
| Concurrent mutation or lock/version check fails | Abort transaction; return stale/conflict; require fresh review. |
| Required audit write fails | Abort the accounting transaction; do not post without audit evidence. |
| Infrastructure timeout or uncertain result | Determine durable command/effect outcome before retrying; never assume failure means no journal. |
| Queue item expires or dead-letters | Mark non-posted state; audit; require fresh authorised action rather than automatic force-posting. |
| Migration evidence/mapping/reconciliation is incomplete | Create/retain a migration exception; do not invent historical accounting facts. |

### User-facing outcome design

An authorised user should receive an actionable reason such as “the source
changed”, “your approval has expired”, “the accounting period is closed”, or
“this payment has already been posted.” The response must not disclose another
company’s resource, mapping, balance, or audit detail.

The API, worker, and review surface should use stable outcome categories,
including source stale, source uncomparable, evidence incomplete, context
changed, authority revoked, idempotency already applied, idempotency-key
conflict, period closed, accounting conflict, retryable failure, and terminal
failure. Their transport/status-code representation remains implementation
detail.

## 14. Audit evidence contract

### Required implementation behavior

For every consequential attempt, whether accepted, rejected, stale, conflicted,
or deduplicated, retain audit evidence sufficient to explain:

- company;
- actor/job/service principal and authentication context;
- evaluated membership, capability, approval, and any segregation-of-duties
  result;
- operation, target, source/evidence identity, source revision/hash, and
  provenance;
- captured analysis/approval/AI/queue context where applicable;
- final revalidation time and observed relevant state;
- posting date, financial year, period, configuration version, mappings,
  account identities, VAT evidence/rule/result, and balance context used;
- idempotency key/command/effect/correlation identity;
- outcome, reason code, and whether an accounting effect committed;
- canonical journal/correction/reversal links if one committed;
- conflict, stale, expiry, duplicate, exception, recovery, or retry evidence;
- retention/lifecycle classification and legal-hold status where applicable;
  and
- a privacy-preserving reference to supporting evidence rather than unnecessary
  duplication of sensitive documents or prompt content.

### Audit integrity rule

Audit evidence for a successful canonical effect must commit in the same
authoritative transaction as the effect. A rejected attempt may be recorded in
a separate durable audit path only if doing so cannot create a canonical
accounting effect and preserves tenant isolation.

**ENGINEERING CHOICE THAT REMAINS CHANGEABLE:** Audit storage layout, hash
algorithm, redaction, encryption, event format, and retention implementation,
subject to DEC-17/18/20/21.

Operational signals must make it possible to detect increasing stale/conflict
rates, repeated retries, idempotency collisions, queue expiry, dead letters,
cross-company rejection, audit-write failures, and any approved non-atomic
fallback. Metric names, vendors, and alert thresholds remain changeable.

## 15. Acceptance criteria

This contract is ready to support a separately approved implementation design
only when the selected scope can demonstrate all of the following:

1. Every consequential command has an explicit source, company, principal,
   operation, posting-date, and idempotency identity.
2. Every operation identifies the authoritative source revision/snapshot or
   explicitly routes weak/unverifiable evidence to review/exception.
3. Approval, AI recommendation, draft, browser state, and queue payloads are
   never themselves final posting authority.
4. Final server-side revalidation checks membership, DEC-05 capability,
   company scope, source, period/year, DEC-11 configuration, DEC-10 mapping,
   DEC-03 VAT, operation-specific balances, idempotency, and final accounting
   invariants.
5. A source/configuration/mapping/period/VAT/authority/balance change after
   analysis prevents silent posting.
6. Two concurrent equivalent actions create at most one economic/canonical
   effect.
7. Exact duplicate requests return the original durable result; changed intent
   under the same idempotency identity is rejected.
8. A queued retry cannot bypass final revalidation or resurrect expired
   authority.
9. A failed validation, conflict, audit write, or transaction commits no
   partial canonical accounting state.
10. The final accounting effect is source-linked, balanced, immutable after
    posting, company-scoped, correct for its period/configuration/mapping/VAT
    context, and recoverable without replay.
11. AI-assisted actions receive the same final validation and cannot post from
    model output alone.
12. Audit evidence explains both acceptance and rejection without leaking
    cross-company information.
13. Migration and recovery flows preserve provenance, idempotency, exceptions,
    checkpoints, and reconciliation boundaries.
14. Tests cover the failure, concurrency, idempotency, tenant-isolation,
    recovery, and AI scenarios in this contract.

## 16. Failure, concurrency, and idempotency test scenarios

The following are design acceptance scenarios, not a test suite.

### Failure scenarios

- Source invoice amount/VAT/party/status changes after an AI recommendation:
  final validation rejects stale recommendation, writes no journal, and retains
  explanation/audit.
- A user loses membership or posting capability after approving a payment:
  final capability check rejects the command.
- A period is closed after a draft was created: posting is rejected rather than
  silently moved to another date.
- Effective configuration or a protected cash/AR/AP/VAT mapping changes:
  posting uses current final resolution only if it remains consistent with the
  approved intent; otherwise it requires fresh review.
- A bank row is matched twice or a retry follows an uncertain timeout: durable
  idempotency/effect state prevents a second cash journal.
- Required VAT evidence is missing or unsupported: the operation cannot
  approximate a result.
- Audit storage fails before commit: no canonical journal commits.
- A migration record has unknown period/configuration/mapping provenance: it
  becomes an exception rather than an invented historical posting.

### Concurrency scenarios

- Two users allocate the same customer payment remainder concurrently.
- Two users apply the same customer credit or supplier prepayment concurrently.
- Reconciliation and manual payment processing target the same bank evidence.
- A capability/period/configuration change races a posting command.
- A correction/reversal is initiated while an original command retry is
  underway.
- A worker retry races a user cancellation or approval revocation.
- A restore repeats a previously committed command.

For each, the expected outcome is one canonical effect at most, no balance
overrun, no partial state, deterministic conflict/duplicate response, and audit
evidence for the winning and rejected attempts.

## 17. Engineering choices that remain changeable

This contract does not select:

- optimistic version checks, pessimistic row locks, serializable transactions,
  advisory locks, or another compatible concurrency mechanism;
- physical schema, table names, constraints, indexes, or event formats;
- identifier, hash, or idempotency-key algorithm;
- queue, retry, expiry, scheduler, worker, dead-letter, or observability
  technology;
- API routes, DTOs, status-code mapping, or user-interface presentation;
- RLS implementation, database provider, hosting, backup, or deployment
  topology;
- AI provider, model, retrieval implementation, or prompt format;
- exact freshness age thresholds where source revisions exist; or
- exact source adapter or migration cohort implementation.

Any selected engineering design must demonstrate that it preserves the required
behavior above.

## 18. Separate approvals required before implementation

Before a bounded implementation task may execute, the project needs:

1. explicit resolution of the governance ownership/amendment path for final
   source-freshness policy;
2. accounting, product, security, architecture, migration, and operations
   review for the selected command scope;
3. an approved source-specific accounting-effect and VAT treatment;
4. a reviewed data/API/transaction/concurrency design;
5. a reviewed capability, active-membership, tenant-isolation, job, AI, and
   support/recovery authorization design;
6. a reviewed period/year/configuration/control-mapping resolution design;
7. an approved audit, retention, recovery, rollback, and observability plan;
8. a test plan covering every acceptance and scenario in this contract;
9. explicit approval of the corresponding implementation task;
10. separate schema/migration approval before any schema change;
11. separate migration/cutover approval before any data movement or authority
    change; and
12. separate deployment/publishing approval before release.

No item above is passed merely because DEC-01 through DEC-22 are approved.

### Required review record

Acceptance must be recorded by the relevant human authority; this planning
artifact does not manufacture signatures or approval. The review record must
cover:

| Reviewer | Required acceptance |
|---|---|
| Accounting authority | Source/evidence precedence, payment/allocation/refund/VAT treatment, periods, configuration, mappings, idempotency, reconciliation, and correction boundaries. |
| Security/tenant reviewer | Authentication, membership/capability revocation, company isolation, worker/AI scope, audit, exports, support, and failure behavior. |
| Architecture/data reviewer | Envelope lifecycle, source comparison, transaction/locking boundary, queue/retry behavior, idempotency, data contracts, and non-atomic race controls. |
| Product owner | User-visible stale/conflict/expiry language, approval meaning, review/resolution flow, and operation scope. |
| Migration and operations reviewers | Source snapshots, provenance, exceptions, checkpoints, recovery, queue expiry, dead-letter handling, observability, and replay prevention. |

Reviewers must confirm that every consequential operation identifies an exact
source and intended effect, detects material change, revalidates final state
and authority server-side, handles stale/duplicate/expiry outcomes safely, and
keeps implementation detail separate from policy approval.

## 19. Final verification

- DEC-01 through DEC-22 remain APPROVED.
- No DEC-23 was created.
- BL-06 and BL-07 remain BLOCKED.
- The proposed source-freshness/posting-safety contract is explicitly
  documented.
- The owning-decision and potential DEC-12 amendment outcome remain explicit
  governance determinations; this document does not decide them.
- Human accounting, security, architecture, product, migration, and operations
  acceptance must be recorded before any affected implementation is authorised.
- Existing approved policy is distinguished from required implementation
  behavior, proposed technical design, changeable engineering choices, and
  separate approvals.
- No application code, schema, migration, accounting logic, UI, workflow,
  dependency, infrastructure, deployment, publishing, migration, or cutover
  change was made.

This document stops at planning and design. It does not authorise
implementation.