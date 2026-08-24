# Ledgerly Safety-Rule Ownership Record

**Status:** PLANNING / GOVERNANCE DESIGN ONLY — NOT APPROVED FOR
IMPLEMENTATION  
**Related contract:** [Source-Freshness and Posting-Safety
Contract](ledgerly-source-freshness-posting-safety-contract.md)  
**Governance baseline:** DEC-01 through DEC-22 APPROVED  
**BL-06 / BL-07:** BLOCKED  
**DEC-23:** Not created and not required  
**Purpose:** Record which authoritative server-side boundary should own each
posting-safety check

> This record assigns proposed logical ownership for future design. It does not
> implement a check, select a physical schema, create a migration, change
> accounting logic, modify UI/workflows, change infrastructure, deploy,
> publish, migrate data, or unblock BL-06/BL-07.

## 1. Ownership principles

### 1.1 Governance authority is not implementation ownership

**Governance authority** answers which approved decision constrains a rule.
**Accounting authority** answers which approved accounting boundary may
ultimately accept an accounting effect. **Proposed implementation owner**
answers which logical server-side boundary should enforce the rule when
implementation is separately approved.

A decision may constrain a check without selecting its module, class, route,
table, queue, or deployment unit.

### 1.2 One consequential command boundary

**PROPOSED IMPLEMENTATION:** Treat a consequential accounting action as passing
through one authoritative server-side **Consequential Accounting Command
Boundary**. It orchestrates specialized guards and delegates domain-specific
validation, but no browser, AI output, generic CRUD path, import adapter, queue
payload, or reporting projection can bypass it.

The proposed logical boundaries are:

1. **Principal and Tenant Guard** — authentication, active membership,
   capability/approval, and company/resource scope;
2. **Source Freshness Guard** — source identity, revision/snapshot, evidence,
   stale/conflict, queue age, and approval-context comparison;
3. **Accounting Context Resolver** — posting date, financial year, period,
   configuration version, control mapping, account eligibility, and VAT
   context;
4. **Domain State Guard** — payment, allocation, credit, prepayment, refund,
   reconciliation, migration, and other operation-specific current state;
5. **Idempotency and Concurrency Coordinator** — command/effect identity,
   serialization, duplicate detection, and safe retry outcome;
6. **Canonical Posting Authority** — final journal invariants and the
   canonical accounting transaction; and
7. **Audit Evidence Writer** — immutable evidence for the checks, outcome, and
   accounting effect, committed with a successful effect.

These are logical owners within a proposed modular server-side design, not
approved microservices or physical components.

### 1.3 The final owner is accountable for orchestration

**REQUIRED IMPLEMENTATION BEHAVIOR:** The Consequential Accounting Command
Boundary remains accountable for invoking all required guards in the correct
company-scoped context and for refusing persistence when a mandatory guard
fails. Specialized owners may validate their own concern, but none may grant
permission outside the command boundary.

**DELIBERATELY OPEN:** Whether the final implementation uses a modular
monolith, domain services, middleware, database procedures, or another
architecture. Unnecessary microservice decomposition is not implied.

## 2. Governance ownership boundary

### 2.1 Source freshness is not DEC-12

**APPROVED GOVERNANCE REQUIREMENT:** DEC-12 is exclusively the **Payment,
Allocation and Settlement Policy**. Its approved review explicitly states that
source freshness is not decided, reassigned, or implemented there.

**REQUIRED IMPLEMENTATION BEHAVIOR:** Source freshness is an implementation-
level safety contract derived from the approved DEC-01–DEC-22 policies that
govern deterministic authority, source linkage, capabilities, periods,
configuration, VAT, idempotency, audit, tenant isolation, and migration.

**REQUIRES SEPARATE APPROVAL:** Final governance ownership or amendment
placement for source freshness must be recorded through the appropriate
governance path before consequential posting is implemented. This record does
not assign it to DEC-12, create DEC-23, or invent a new decision number.

### 2.2 Existing decision constraints

| Constraint | Existing authority |
|---|---|
| Server-side canonical accounting authority | DEC-04 |
| Active membership and capability/approval boundary | DEC-05 |
| Financial-year resolution | DEC-06 |
| Accounting-period state and closed-period protection | DEC-07 |
| Reporting-only year-end | DEC-08 |
| Stable account identity and eligibility | DEC-09 |
| Protected control-account mappings | DEC-10 |
| Immutable effective-dated configuration | DEC-11 |
| Payment, allocation, and settlement distinction | DEC-12 |
| Overpayment and unapplied-cash treatment | DEC-13 / DEC-14 |
| Refund authority and accounting treatment | DEC-15 |
| Payment-on-account scope | DEC-16 |
| Audit retention and evidence | DEC-17 |
| Disposal and lifecycle controls | DEC-18 |
| Bounded exports | DEC-19 |
| Backup, recovery, and no-replay controls | DEC-20 |
| Company/tenant isolation | DEC-21 |
| Migration provenance, validation, exceptions, and cutover | DEC-22 |

## 3. Ownership matrix

The matrix records proposed logical ownership. “Constrained?” means whether
DEC-01–DEC-22 already constrain the relevant authority, not whether the
implementation exists.

| Safety check | Governance authority | Accounting authority | Proposed implementation owner | Constrained by DEC-01–DEC-22? | Engineering choice that remains open |
|---|---|---|---|---|---|
| Source freshness, revision, snapshot, and evidence validation | DEC-01 hierarchy; DEC-03, DEC-04, DEC-05, DEC-06/07, DEC-10/11, DEC-17, DEC-21, DEC-22 as applicable. DEC-12 is explicitly not the owner. | Consequential Accounting Command Boundary may submit to Canonical Posting Authority only after current source is established. | Source Freshness Guard, orchestrated by the Consequential Accounting Command Boundary. | Partially. The safety need is derived across approved decisions, but no decision assigns a final technical owner or complete freshness semantics. | Native revision vs hash/snapshot, provider conditional reads, evidence-strength classes, age thresholds, storage, and conflict API. |
| Active company membership | DEC-05; DEC-21. | Gate to Canonical Posting Authority; membership alone never creates accounting authority. | Principal and Tenant Guard using the authoritative membership source. | Yes, for active membership and company-scoped consequential authority. | Auth provider integration, cache invalidation, revocation propagation, and transaction/identity mechanism. |
| DEC-05 capability and approval | DEC-05; constrained by DEC-01 hierarchy and relevant DEC-03/04/06–22 operation rules. | Gate to the relevant canonical command; approved authority must be specific to the operation. | Principal and Tenant Guard / Approval Guard. | Yes, for server-side capability, approval, active membership, audit, and no UI-only authority. | Capability names, role presets, segregation-of-duties algorithm, approval storage, expiry, and delegation mechanics. |
| Company and tenant scope | DEC-05 and DEC-21; DEC-04 for company-scoped accounting. | Canonical Posting Authority may only act within one resolved company context. | Principal and Tenant Guard, with every domain owner enforcing resource ownership. | Yes, across users, records, documents, jobs, exports, recovery, support, and AI context. | Context propagation, RLS breadth, pooling, support elevation, and error redaction. |
| Financial year | DEC-06; DEC-08 for year-end behavior. | Accounting Context Resolver supplies year identity to Canonical Posting Authority. | Accounting Context Resolver. | Yes, posting date and company year must be server-resolved and not silently rebased. | Calendar representation, lookup/lock strategy, historical migration handling, and API shape. |
| Accounting period | DEC-07; DEC-06/08 for date/year relationship. | Canonical Posting Authority may commit only to a valid postable period. | Accounting Context Resolver, coordinated with the period state owner and command transaction. | Yes, closed-period bypass is prohibited and period identity is controlled. | Locking/isolation, close/reopen transaction, period calendar storage, and race handling. |
| DEC-11 configuration version | DEC-11; DEC-04, DEC-06/07, DEC-09/10 and DEC-21 constrain its use. | Accounting Context Resolver supplies immutable effective context retained on the canonical posting. | Accounting Context Resolver / Configuration Authority. | Yes, material configuration must be immutable, effective-dated, company-scoped, and retained with the posting. | Version bundle shape, activation workflow, effective-date lookup, and snapshot representation. |
| DEC-10 control-account mapping | DEC-10; DEC-09 account identity and DEC-03 VAT constraints. | Canonical Posting Authority may use only validated protected AR, AP, bank/cash, Input VAT, Output VAT, and approved settlement mappings. | Accounting Context Resolver / Control-Mapping Authority. | Yes, protected roles, company scope, eligibility, and historical resolved identity are constrained. | Mapping storage, uniqueness, activation, effective dating, and account eligibility query. |
| DEC-03 VAT validation | DEC-03; DEC-04, DEC-05, DEC-10/11, DEC-17 and DEC-21 also constrain authority/evidence. | Deterministic VAT Authority supplies validated evidence/result to Canonical Posting Authority; it does not post independently. | VAT Validation Boundary invoked by Accounting Context Resolver and the command boundary. | Yes, sole VAT authority, supported scheme, source evidence, deterministic treatment, approval, and audit are constrained. | VAT service interface, rule-version representation, rounding implementation, unsupported-state handling, and return lock integration. |
| Payment state | DEC-12; DEC-04/05/10/11/17/21 also constrain posting. | Payment Domain Authority may request one canonical payment effect through Canonical Posting Authority. | Domain State Guard / Payment Domain Authority. | Yes, payment evidence is distinct from accounting payment and payment posts once. | Payment state model, evidence links, balance locking, and operation-specific command format. |
| Allocation state | DEC-12, DEC-13, DEC-14, DEC-16; DEC-04/05/10/11/21. | Allocation Domain Authority may change settlement links or request a separate controlled effect; it cannot create duplicate cash. | Domain State Guard / Allocation and Settlement Authority. | Yes, eligible balances, party/direction/company, many-to-many relationships, and no duplicate cash are constrained. | Relationship representation, lock strategy, derived-state calculation, and bulk operation behavior. |
| Customer-credit state | DEC-13/14/16; DEC-04/05/10/11/17/21. | Credit Domain Authority controls approved liability/remainder treatment through Canonical Posting Authority where an accounting effect is needed. | Domain State Guard / Customer-Credit Authority. | Yes, excess must remain explicit and cannot be silently over-allocated. | Credit lifecycle, balance/version representation, and approval transitions. |
| Supplier-prepayment state | DEC-13/14/16; DEC-04/05/10/11/17/21. | Supplier-Prepayment Domain Authority controls approved asset/remainder treatment through Canonical Posting Authority where needed. | Domain State Guard / Supplier-Prepayment Authority. | Yes, excess must remain traceable and cannot be silently applied or refunded. | Prepayment lifecycle, balance/version representation, and transition rules. |
| Refund state | DEC-15; DEC-12–16 and DEC-04/05/10/11/17/21 as applicable. | Refund Domain Authority requests a controlled canonical refund effect with original-source and balance links. | Domain State Guard / Refund Authority. | Yes, refund authority, evidence, balance, approval, source links, and no alternative free-standing path are constrained. | Refund eligibility calculation, approval chain, external settlement interaction, and retry behavior. |
| Idempotency | DEC-04; DEC-05, DEC-12–16, DEC-20, and DEC-22 reinforce no duplicate effects. | Idempotency and Concurrency Coordinator protects the Canonical Posting Authority and returns the original exact result. | Idempotency and Concurrency Coordinator, inside the Consequential Accounting Command Boundary. | Yes, source linkage, one-time accounting effects, atomicity, and no-replay behavior are constrained. | Key construction, effect identity, storage, retention, locking, and uncertain-timeout recovery. |
| Canonical journal invariants | DEC-04; DEC-09/10/11; DEC-03; DEC-06–08; DEC-12–16. | Canonical Posting Authority is the sole owner of final journal validation and posting. | Canonical Posting Authority / Posting Kernel. | Yes, balanced, source-linked, server-generated, immutable, idempotent journals and linked corrections are constrained. | Physical journal model, transaction isolation, money library, template registry, and correction command shape. |
| Final audit evidence | DEC-04/05; DEC-17/18; DEC-20/21/22; relevant DEC-03, 06–16, and 19. | Audit Evidence Writer must commit successful evidence atomically with Canonical Posting Authority; rejected-attempt audit must remain durable and scoped. | Audit Evidence Writer, invoked by the Consequential Accounting Command Boundary and transaction coordinator. | Yes, auditability, retention, lifecycle, recovery, privileged access, and migration evidence are constrained. | Event format, storage, immutability mechanism, redaction, encryption, retention, and failure telemetry. |

## 4. Boundary responsibilities

### 4.1 Consequential Accounting Command Boundary

**PROPOSED IMPLEMENTATION OWNER:** The command boundary is the single
server-side entry point for consequential persistence.

It is responsible for:

- classifying the operation as consequential;
- establishing the principal and one company scope;
- loading the correct source/command envelope;
- invoking each required specialized owner;
- preventing generic CRUD, UI, AI, imports, queues, and retries from bypassing
  validation;
- coordinating the final transaction/consistency boundary;
- refusing to persist on any failed mandatory check; and
- returning a deterministic business outcome.

It is not a second accounting ledger and does not replace Canonical Posting
Authority.

### 4.2 Principal and Tenant Guard

**PROPOSED IMPLEMENTATION OWNER:** Principal and Tenant Guard owns the
authorization preconditions:

- authentication;
- active membership;
- company context;
- resource ownership;
- DEC-05 capability;
- required approval and segregation of duties;
- privileged/support/recovery/migration scope; and
- AI/job principal scope.

Every domain owner must still verify that its resources match the resolved
company. A single early check is not sufficient protection against a later
cross-company lookup or mutation.

### 4.3 Source Freshness Guard

**PROPOSED IMPLEMENTATION OWNER:** Source Freshness Guard owns the comparison
between captured and current source/evidence context:

- source type and stable identity;
- source revision/version/event/hash/snapshot;
- material source status and ownership;
- evidence integrity and retrieval context;
- approval/analysis/AI/queue freshness;
- stale/conflict classification;
- source-specific final read or conditional check; and
- weak-evidence routing to human review or exception.

The guard does not decide the accounting treatment, account mapping, VAT rule,
or journal effect. It reports whether the source context is safe to hand to the
domain and posting authorities.

### 4.4 Accounting Context Resolver

**PROPOSED IMPLEMENTATION OWNER:** Accounting Context Resolver owns the final
resolution of:

- posting date;
- company financial year;
- accounting period and postable state;
- DEC-11 configuration version;
- DEC-10 protected control mappings;
- DEC-09 account eligibility;
- DEC-03 VAT context and result; and
- any source-specific accounting context required by the selected command.

It must not accept stale caller-supplied account IDs, tax values, period IDs, or
configuration IDs as authority.

### 4.5 Domain State Guard

**PROPOSED IMPLEMENTATION OWNER:** Domain State Guard owns current state for
the operation being attempted:

- payment existence and current balance;
- allocation eligibility and remaining amounts;
- customer-credit and supplier-prepayment state;
- refundability and prior refund state;
- reconciliation state;
- migration cohort/exception/checkpoint state; and
- any other operation-specific resource that could make a command stale or
  duplicative.

It must distinguish a relationship-only allocation from an operation that
requires a new canonical accounting effect.

### 4.6 Idempotency and Concurrency Coordinator

**PROPOSED IMPLEMENTATION OWNER:** This coordinator owns the command/effect
identity and the consistency boundary needed to make concurrent decisions safe.
It must:

- identify an intended economic effect;
- serialize or conditionally validate competing commands;
- distinguish an exact retry from changed intent;
- return a prior result for an exact completed command;
- reject duplicate or key-reuse conflicts;
- protect against timeout/retry replay; and
- preserve effect identity through restore/recovery.

It cannot approve a command that another guard has rejected.

### 4.7 Canonical Posting Authority

**PROPOSED IMPLEMENTATION OWNER:** Canonical Posting Authority owns the final
accounting invariant and journal transaction:

- permitted canonical effect;
- company and source links;
- account and currency validity;
- balanced debit/credit lines;
- period/configuration/mapping/VAT context;
- one-time economic effect;
- immutable posted history; and
- linked correction/reversal behavior.

It is the only proposed owner allowed to create a canonical journal. BL-06
remains blocked; this is a future design target, not an implementation claim.

### 4.8 Audit Evidence Writer

**PROPOSED IMPLEMENTATION OWNER:** Audit Evidence Writer owns the durable
explanation of checks and outcomes:

- principal, company, capability, and approval;
- source/revision/evidence;
- final context and validation results;
- idempotency/correlation identity;
- accepted/rejected/stale/conflict/duplicate outcome;
- canonical journal or correction links;
- migration/recovery/AI context; and
- retention/lifecycle classification.

For a successful accounting effect, it must participate in the same
authoritative transaction as the journal/effect. Audit does not grant authority
to post.

## 5. Final ownership sequence

The following is a **PROPOSED TECHNICAL DESIGN** sequence:

1. **Command Boundary:** classify the request and establish a request identity.
2. **Principal and Tenant Guard:** authenticate, resolve company, validate
   active membership, capability, approval, and resource scope.
3. **Source Freshness Guard:** reload or conditionally validate source and
   evidence revision/snapshot, compare material state, and reject stale/conflict
   context.
4. **Accounting Context Resolver:** resolve final date, year, period,
   configuration version, control mapping, account eligibility, and VAT.
5. **Domain State Guard:** reload/lock current payment, allocation, credit,
   prepayment, refund, reconciliation, migration, or other relevant state.
6. **Idempotency and Concurrency Coordinator:** establish the effect identity
   and safe transaction/serialization boundary.
7. **Repeat mandatory guards at the final boundary:** detect races introduced
   while acquiring locks or resolving state.
8. **Canonical Posting Authority:** validate final accounting invariants and
   create the one canonical effect or linked correction.
9. **Audit Evidence Writer:** commit the successful effect and its evidence
   atomically, or record a durable rejected attempt without accounting effect.
10. **Command Boundary:** return a deterministic success, exact duplicate,
    stale, conflict, unauthorised, not-postable, or validation-failed result.

This ordering is not a physical call graph. Any alternative must preserve the
same authority, race, atomicity, and no-bypass properties.

## 6. Ownership by caller type

| Caller | Required owner path | Prohibited shortcut |
|---|---|---|
| Human web/API action | Command Boundary → Principal/Tenant → Freshness → Context → Domain → Idempotency → Posting → Audit | UI approval, client company ID, cached source, or generic CRUD |
| AI-assisted action | Same path, with AI evidence/recommendation identity and human approval where required | Model output, tool call, prompt, or stale retrieval directly persisting accounting |
| Background job | Same path with explicit job principal, company scope, source envelope, expiry, retry identity, and capability | Ambient worker company, replayed queue payload, or worker-only trust |
| Import/migration adapter | Same path where accounting effects are allowed, plus migration provenance, cohort, exception, and checkpoint guards | Adapter directly writing journals or inventing source facts |
| Reconciliation action | Same path with bank evidence and payment/reconciliation domain state | Bank row alone creating a payment or second journal |
| Recovery/restore action | Recovery authority plus idempotency, scope, audit, and no-replay checks before any consequential replay | Restore treating historical command payloads as fresh permission |
| Support/privileged action | Explicit bounded capability, company scope, reason, expiry, and audit | Broad support access bypassing normal tenant or posting authority |

## 7. Failure and ownership handoff

| Failure | Owning boundary | Required result |
|---|---|---|
| Source changed or cannot be verified | Source Freshness Guard | Stale/conflict; no accounting effect; fresh review or exception |
| Membership revoked or inactive | Principal and Tenant Guard | Unauthorised; no accounting effect |
| Capability/approval missing or expired | Principal and Tenant Guard | Unauthorised/approval-required; no reuse of old approval |
| Company/resource mismatch | Principal and Tenant Guard plus domain owner | Reject without cross-company disclosure; audit blocked access |
| Year or period unresolved/closed | Accounting Context Resolver | Not postable; no silent period substitution |
| Configuration/mapping changed or invalid | Accounting Context Resolver | Stale/validation conflict; no stale account resolution |
| VAT unsupported/inconsistent | VAT Validation Boundary | VAT validation failure; no approximation or alternate VAT authority |
| Payment/allocation/credit/prepayment/refund state changed | Domain State Guard | Conflict or exact duplicate; no over-allocation/duplicate effect |
| Duplicate or changed-intent command | Idempotency and Concurrency Coordinator | Original result for exact duplicate; conflict for reused identity |
| Journal would be unbalanced or invalid | Canonical Posting Authority | Validation failure; no journal |
| Audit cannot commit with effect | Audit Evidence Writer / transaction coordinator | Abort accounting effect; no unaudited success |
| Worker timeout or retry | Idempotency and Concurrency Coordinator | Resolve durable result before retry; never blind replay |
| Migration provenance/reconciliation incomplete | Migration domain owner and Freshness/Context guards | Exception or non-posting state; no invented history |

No boundary may convert another boundary's rejection into a successful post.

## 8. Existing constraints versus proposed ownership

### Already constrained by DEC-01–DEC-22

- canonical accounting must be deterministic and server-side;
- posted journals must be balanced, source-linked, immutable, idempotent, and
  auditable;
- active membership, capability, approval, and company scope are mandatory;
- financial year, period, configuration, mapping, VAT, payment, and lifecycle
  rules are controlled by their named decisions;
- bank evidence, payment, allocation, settlement, credits, prepayments, and
  refunds remain distinct;
- reports cannot become accounting authority;
- AI cannot become accounting authority;
- migration cannot invent facts or bypass provenance/reconciliation; and
- recovery cannot replay accounting effects.

### Proposed by this record

- a Consequential Accounting Command Boundary coordinates every mandatory guard;
- the specialized logical owners named in the matrix;
- source freshness is enforced by a Source Freshness Guard, not by DEC-12;
- final audit evidence is owned by an Audit Evidence Writer but transactionally
  coupled to Canonical Posting Authority;
- the final accounting journal is owned by Canonical Posting Authority; and
- background jobs, AI, migration, recovery, and support use the same command
  boundary with an explicit principal.

These are proposed technical ownership arrangements. They do not amend policy.

### Engineering choices that remain changeable

- exact module/class/service names;
- modular-monolith versus separately deployed service;
- API and command format;
- database transaction/isolation/locking mechanism;
- schema and storage layout;
- RLS implementation and breadth;
- queue and worker technology;
- source revision/hash provider integration;
- audit event format and storage;
- capability/approval data representation; and
- error transport/status-code conventions.

## 9. Separate approval before implementation

Before any implementation task uses these ownership assignments, the project
must separately approve:

1. the final governance placement/ownership of source freshness, consistent
   with DEC-12's explicit non-assignment;
2. a bounded implementation scope for a selected command or domain;
3. the source-specific accounting effect and VAT treatment;
4. the physical architecture, schema, API, transaction, and concurrency design;
5. the capability, active-membership, tenant, support, job, AI, and recovery
   security design;
6. the period/year/configuration/control-mapping resolution design;
7. the audit, retention, privacy, observability, and recovery design;
8. acceptance tests for stale, conflict, duplicate, concurrency, tenant,
   failure, AI, recovery, and migration scenarios;
9. the corresponding implementation task;
10. any schema or migration task separately;
11. any migration/cutover execution separately; and
12. deployment and publishing separately.

DEC-01 through DEC-22 approval alone does not pass any of these gates.

## 10. Final verification

- DEC-01 through DEC-22 remain APPROVED.
- DEC-12 remains exclusively Payment, Allocation and Settlement Policy.
- Source freshness is not assigned to DEC-12.
- No new governance decision was created.
- No DEC-23 exists.
- BL-06 and BL-07 remain BLOCKED.
- The merged #39 deliverable remains a planning/design contract, not
  implementation authority.
- #40 and #41 were not started by this record.
- No application code, schema, migration, accounting logic, UI, workflow,
  dependency, infrastructure, deployment, publishing, migration, or cutover
  change was made.

This record stops at governance and ownership design.