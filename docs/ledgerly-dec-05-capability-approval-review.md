# DEC-05 Accounting Capability and Approval Matrix Review

**Decision:** DEC-05 — Accounting capability and approval matrix
**Status:** **REQUIRES USER DECISION**
**Review date:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting and security
review
**Implementation authority:** None

> This is a decision-only review. It does not approve a permission matrix,
> implementation task, code, schema, migration, UI, workflow, dependency,
> deployment, or publishing work.

## 1. Decision question

Which company-scoped server-side capability and approval model should govern who
may:

- view accounting data;
- create or edit drafts;
- approve operational sources;
- post accounting entries;
- reverse or correct posted entries;
- close periods;
- reopen periods;
- edit the chart of accounts;
- change accounting defaults or other accounting configuration;
- view AI recommendations; and
- persist AI-assisted or other accounting actions?

The decision must also establish how active company membership, role changes,
segregation of duties, approval evidence, and audit records affect those
capabilities.

Role names alone must not silently determine accounting authority. The selected
model must produce explicit server-side decisions for each consequential action.

## 2. Authority and constraints already established

### DEC-01 — Governance hierarchy

DEC-01 approved the hierarchy:

1. Ledgerly Manifesto;
2. Product Principles;
3. PRD / Product Scope;
4. Technical Architecture; and
5. Feature Specifications / Master Backlog.

DEC-05 must therefore be recorded in the decision registers and cannot be
resolved by an implementation, existing route, UI convention, or backlog item.

### DEC-02 — Initial product scope

DEC-02 approved the initial UK/GBP direction and authoritative core accounting,
including invoices, bills, payments, banking, reconciliation, and reporting.
It also requires the architecture to avoid unnecessary UK/GBP hard-coding.

DEC-05 therefore applies to the approved accounting scope and must preserve
reasonable future extensibility without approving future markets or capabilities.

### DEC-03 — VAT scope

DEC-03 approved Standard UK VAT on invoice basis, controlled source-linked and
return-level corrections, and supported VAT-return preparation/export without
direct HMRC submission.

Consequential VAT approvals, corrections, locking, and exports must use the
selected capability and audit boundary. DEC-05 does not expand the approved VAT
scope or grant HMRC filing authority.

### DEC-04 — Approved accounting-core architecture

DEC-04 approved Option A as the accounting-core foundation, architecture only.
The approved invariants include:

- company-scoped server-side capability and audit boundaries;
- immutable posted journals and linked reversals/corrections;
- source linkage and idempotency;
- deterministic VAT through a traceable adapter; and
- additive compatibility and migration.

DEC-04 deliberately left the exact capability matrix, role assignments,
segregation of duties, and approval requirements to DEC-05. DEC-05 must refine
that approved boundary without resolving DEC-06 or any later decision.

## 3. Existing DEC-05 brief

The current brief in the pre-implementation decision pack identifies these
options:

1. broad role-based writes;
2. capability-based permissions with role presets; and
3. per-company custom permissions at launch.

It proposes these role concepts for evaluation:

- Owner;
- Admin;
- Accountant;
- Manager; and
- Read-only.

The brief also establishes two minimum safety constraints:

- `Read-only` must have no mutation path.
- No role may edit a posted journal.

The proposed matrix in the brief is a recommendation only. It is not an
approved permission grant.

## 4. Available options

### Option A — Broad role-based writes

Use a small number of role checks as the primary authority. A role would carry
most of its accounting permissions, with limited operation-specific
distinctions.

This option is only compatible with approved governance if the role check is
still enforced server-side, company-scoped, active-membership-aware, and
audited. A UI-only role restriction or a generic non-read-only write path would
conflict with DEC-04.

**Accounting consequences:**

- Posting, reversal, close, reopen, chart, and configuration authority would be
  bundled into broad roles.
- Segregation of duties would be difficult to express precisely.
- A role change could grant or remove several consequential powers at once.
- The system would need explicit exceptions for posted-journal immutability,
  VAT approval/locking, and period controls.

**Data/schema consequences:**

- Memberships need company scope, active status, role validation, and effective
  permission checks.
- Audit records still need actor, company, operation, target, result, reason
  where required, and request context.
- If role-to-capability mappings are stored, their version/effective behavior
  must be defined rather than inferred from arbitrary strings.

**Migration consequences:**

- Existing broad roles would be mapped conservatively.
- Users who currently have broad non-`read_only` access may lose powers until
  explicitly reviewed.
- Ambiguous historical actor authority would remain an audit/migration
  exception; it must not be reconstructed silently.

**Reporting consequences:**

- Report viewing can be separated from posting, but broad roles increase the
  risk that report/export access and mutation authority are coupled.
- Report and VAT export visibility still requires company scope and any later
  retention/export policy.

**Compatibility consequences:**

- Existing role fields and compatibility APIs could be adapted initially.
- Generic write routes must not treat a role string as sufficient authority for
  protected accounting operations.
- Future custom approval requirements would likely require another permission
  layer, increasing migration and API compatibility cost.

**Security and permission consequences:**

- Simpler to explain initially, but weaker for least privilege and
  segregation.
- Admin defaults could accidentally grant posting, reversal, or reopening
  authority unless explicitly denied.
- Deactivated membership must lose access immediately regardless of role.

**Backlog consequences:**

- Could reduce initial BL-02 matrix complexity.
- Leaves material risk in BL-01, BL-03, BL-06, BL-07, BL-19, and BL-24.
- Makes later approval controls for BL-08, BL-09, BL-13, BL-14, BL-15, and BL-17
  more disruptive.

### Option B — Server-side capabilities with role presets

Define named capabilities for each consequential operation and provide
conservative Owner, Admin, Accountant, Manager, and Read-only role presets.
The server evaluates the capability in the active company context for every
request. Role presets are defaults, not a substitute for operation-level
authorization.

This is the current recommendation. It is not approved by this review.

The existing brief proposes the following starting direction for Lee to accept,
amend, or reject:

| Capability | Owner | Admin | Accountant | Manager | Read-only |
|---|---:|---:|---:|---:|---:|
| View accounting data | Yes | Yes | Yes | Yes | Yes |
| Create/edit drafts | Yes | Yes | Yes | Scoped | No |
| Approve operational sources | Yes | Configurable | Yes | Scoped | No |
| Post accounting entries | Yes | Configurable | Yes | No by default | No |
| Reverse/correct posted entries | Yes | No by default | Yes, with reason | No | No |
| Close periods | Yes | No by default | Yes, if assigned | No | No |
| Reopen periods | Yes | No by default | Separate elevated grant | No | No |
| Edit chart of accounts | Yes | Configurable | Configurable | No | No |
| Change accounting defaults | Yes | Configurable | Configurable | No | No |
| View AI recommendations | Yes | Yes | Yes | Yes | Yes |
| Persist AI/accounting actions | Matching write capability | Matching write capability | Matching write capability | Scoped | No |

The table is a proposed baseline, not an approved matrix. `Configurable`,
`Scoped`, and `Separate elevated grant` require explicit definitions if this
option is selected.

**Accounting consequences:**

- Posting, reversal/correction, period close/reopen, chart changes, and
  configuration changes can each have distinct authority.
- Segregation of duties and approval requirements can be expressed without
  changing the meaning of broad user roles.
- Reversal/correction, VAT approval/locking, and period reopening can require
  explicit reasons, fresh checks, and audit evidence.
- AI may recommend or prepare work, but persistence still requires the
  capability for the resulting operation.

**Data/schema consequences:**

- Company memberships require validated roles, active status, and an explicit
  capability evaluation path.
- Protected operations need stable capability identifiers and audit fields for
  actor, company, capability, target, source, reason, approval, result, and
  request context as applicable.
- Role presets and any company-specific grants need an explicit effective
  behavior; arbitrary role strings cannot become permissions.
- Posted journal immutability remains independent of role and capability.

**Migration consequences:**

- Existing users and broad roles must map conservatively to presets.
- Ambiguous or over-broad access becomes a visible review exception rather than
  an automatic grant.
- Role changes apply to future actions immediately; historical audit records
  retain the actor and authority context that existed when the action occurred.
- Migration and cutover must not infer that a historical user was authorised
  merely because a broad role existed.

**Reporting consequences:**

- View, export, drill-down, and mutation permissions can be separated.
- Journal-authoritative reports remain available only within the company scope
  and subject to any later export/retention policy.
- Report results and financial actions can be traced to the capability and
  actor context without making report projections an authority.

**Compatibility consequences:**

- Existing role-based clients can be supported through a compatibility adapter
  while server-side capability checks become authoritative.
- UI capability state can improve usability, but failed server checks remain
  authoritative and must use business-language outcomes.
- New capabilities can be added without redefining every existing role, subject
  to an amendment or later decision where the change is consequential.

**Security and permission consequences:**

- Strongest least-privilege and segregation-of-duties boundary of the three
  options.
- Active membership and company scope can be checked for every operation.
- Read-only has no mutation path; no role has a posted-journal edit path.
- Default Admin grants must not silently include posting, reversal, or reopen.
- The exact grants, approval chain, and any custom overrides remain Lee's
  decision.

**Backlog consequences:**

- Directly defines the intended BL-02 role/capability contract.
- Provides the safest dependency boundary for BL-01, BL-03, BL-06, BL-07,
  BL-08, BL-09, BL-13, BL-14, BL-15, BL-19, BL-23, and BL-24.
- Does not approve or start any of those backlog items.

### Option C — Per-company custom permissions at launch

Allow each company to define a custom permission set rather than relying
primarily on shared role presets. This may include custom roles, grants, or
company-specific approval chains.

This option is compatible with DEC-04 only if every custom grant remains
server-side, company-scoped, validated, auditable, and unable to bypass
immutable journals or other approved safety boundaries.

**Accounting consequences:**

- Can model different approval responsibilities and segregation requirements
  per company.
- Increases the risk of inconsistent posting, reversal, close/reopen, and VAT
  approval workflows between companies.
- Requires clear separation between a custom grant and approval evidence for a
  particular accounting action.

**Data/schema consequences:**

- Requires a versioned custom permission or role model, company ownership,
  capability allowlists, validation, effective dates, and audit history.
- Requires safe handling of deleted, renamed, or superseded custom roles.
- Requires a fail-closed behavior when a company permission configuration is
  incomplete or invalid.

**Migration consequences:**

- Existing companies need a configuration migration rather than only a role
  mapping.
- Historical permissions and membership changes become more difficult to
  compare across companies.
- A cutover must preserve the effective authority of current users without
  silently granting new powers.

**Reporting consequences:**

- Reporting, export, and drill-down access can be tailored per company.
- Inconsistent configurations make support, audit review, and cross-company
  operational reporting harder.
- Journal authority and report calculation remain common even if visibility
  differs.

**Compatibility consequences:**

- Existing role-based clients require a richer capability discovery contract.
- Every UI surface that offers a consequential action must handle custom
  capability state and stale permission configuration.
- Integrations and support tooling need a stable capability vocabulary even when
  company-specific roles differ.

**Security and permission consequences:**

- Potentially strongest fit for real-world company segregation, but highest
  configuration and misconfiguration risk.
- Requires privileged management of the permission configuration itself,
  including who can grant posting, reversal, reopen, chart, or configuration
  authority.
- Requires strong defaults, validation, audit, and recovery for permission
  changes.

**Backlog consequences:**

- Expands BL-02 substantially and adds configuration, discovery, audit, and
  support work to BL-01, BL-19, BL-23, and BL-24.
- Delays BL-06/BL-07 implementation until custom-permission lifecycle and
  fail-closed behavior are specified.
- Could reduce future migration to custom permissions if chosen deliberately,
  but adds launch complexity and more testing combinations.

## 5. Recommendation

### RECOMMENDATION — NOT APPROVAL

Adopt **Option B: server-side capabilities with conservative role presets**.

The proposed starting direction is:

- Owner can receive broad company authority, subject to the same immutable
  journal and audit controls.
- Accountant can perform accounting work and approved corrections, with
  explicit reason and audit requirements for consequential actions.
- Admin is not granted posting, reversal, or period-reopen authority by default;
  any grant is explicit and auditable.
- Manager receives scoped operational access and no posting, reversal, or
  reopening authority by default.
- Read-only can view permitted data but has no mutation path.
- AI recommendations are viewable according to visibility rules, but AI or
  manual persistence requires the matching write capability.

This is a recommendation for Lee to approve, amend, or reject. It does not
select the exact matrix, configurable grants, approval chain, or segregation
rules.

**Why:** Option B best implements DEC-04's approved company-scoped
server-side capability/audit boundary while keeping role presets understandable
for small businesses. It supports least privilege, explicit approval, future
role evolution, and safe AI hand-offs without making every company configure a
permission system before it can operate.

## 6. Dependencies on later decisions

DEC-05 must remain compatible with, but must not resolve, the following:

- **DEC-06:** Financial-year policy determines whether changing financial-year
  settings is a privileged configuration action and who may perform it.
- **DEC-07:** Period creation, close, and reopen determine the capabilities and
  approval conditions for period control.
- **DEC-08:** Year-end treatment determines authority for any closing or
  reporting-boundary action.
- **DEC-09:** Chart defaults and account editing determine chart-management
  capabilities.
- **DEC-10:** Control-account mappings determine which configuration changes
  require elevated authority.
- **DEC-11:** Configuration versioning determines effective dates and audit
  behavior for capability-sensitive configuration.
- **DEC-12 through DEC-16:** Payment, allocation, refund, overpayment, and
  payment-on-account policy determine which payment and settlement actions need
  distinct capabilities.
- **DEC-17 through DEC-21:** Retention, deletion, export, backup/recovery, and
  RLS decisions determine additional access, export, and operational controls.
- **DEC-22:** Historical migration and cutover determine how existing members,
  roles, audit records, and compatibility routes are mapped.

These dependencies do not prevent a DEC-05 decision. They mean that later
decisions must refine or amend the capability matrix where their policies create
new consequential operations.

## 7. Conflicts with approved governance

The following would conflict with DEC-01 through DEC-04 and must not be selected
or implemented:

- UI-only permission checks without server-side enforcement;
- granting authority from arbitrary role strings or client-supplied fields;
- allowing inactive company members to act;
- allowing any role to edit or delete a posted journal;
- allowing bank evidence, AI recommendations, or a report projection to bypass
  the approved posting and approval boundary;
- allowing Admin defaults to silently grant posting, reversal, or period reopen;
- allowing a company-specific permission to cross company scope;
- silently inferring historical authority during migration; or
- treating a permission recommendation as an approved accounting action.

Option A conflicts with approved governance if it means broad or client-side
writes without named server-side capability checks. Option C conflicts if custom
configuration can bypass the same controls. Both options can remain considered
only within the approved DEC-04 boundary.

## 8. What would become locked if DEC-05 were approved

The exact lock depends on Lee's selected option and amendments. At minimum,
approval would lock:

1. the selected authority model: broad role mapping, role presets, or
   per-company custom permissions;
2. the named consequential operations that require explicit server-side
   authorization;
3. the active-membership and company-scope requirement for every capability
   evaluation;
4. the minimum read-only and posted-journal immutability boundaries;
5. the selected role-to-capability grants or custom-grant rules;
6. the approval, reason, freshness, and audit requirements assigned to each
   consequential operation;
7. how AI recommendations and AI-prepared actions inherit the matching write
   capability; and
8. the effective behavior for permission changes, including whether future
   actions use the current grant while historical audit retains prior context.

If Option B is approved, the selected role presets and any explicitly approved
configurable grants would become the launch permission contract. If Option C is
approved, the custom permission lifecycle, management authority, validation,
and fail-closed behavior would also become part of the launch contract.

## 9. What would remain changeable after approval

DEC-05 approval would not resolve or lock:

- financial-year start and change policy;
- period frequency, close, or reopen policy beyond the capability boundary;
- year-end treatment;
- chart defaults, control-account mappings, or configuration versioning;
- payment, allocation, overpayment, refund, or payment-on-account treatment;
- retention, deletion/anonymisation, export, backup/recovery, or RLS policy;
- the historical migration cohort, cutover sequence, rollback, or legacy
  authority retirement;
- future markets, currencies, VAT schemes, or HMRC filing;
- physical table names, API routes, UI design, or provider choices;
- future roles or capabilities that do not weaken the approved safety boundary;
  or
- the implementation sequence, task assignment, testing plan, or deployment
  plan.

An approved matrix can also be amended later through the process below. Future
changes must not silently broaden authority or rewrite historical audit context.

## 10. Amendment path

DEC-05 is a living product/accounting decision. To amend it:

1. record the proposed amendment in the Living Product Decisions Register;
2. update this DEC-05 review and the Current Decision Register;
3. identify whether the amendment changes accounting authority, data/schema,
   migration, reporting, compatibility, security/permissions, audit, or
   backlog dependencies;
4. review effects on DEC-04 and the applicable DEC-06 onward decisions;
5. obtain explicit product-owner approval with accounting and security review;
6. update the Technical Architecture, decision pack, and relevant
   specifications before implementation direction changes; and
7. retain the previous decision and its effective boundary for audit and
   migration purposes.

No implementation task may use a recommendation or proposed amendment before
the amended decision is explicitly recorded.

## 11. Decision readiness

**DEC-05 is ready for a user decision.** The existing brief contains enough
information to select, amend, or reject one of the three material options.

If Lee wants a bespoke matrix, the requested differences should be recorded as
amendments to the proposed Option B baseline or as an explicit selection of
Option C. No further technical information is required to decide the
architectural direction, but exact capability names, grants, approval chains,
and effective-date details must be recorded before implementation approval.

## 12. Decision-only status

**DEC-05:** **REQUIRES USER DECISION**
**DEC-06 through DEC-22:** **REMAIN UNRESOLVED AND UNAPPROVED**
**DEC-04:** **APPROVED — architecture only**
**BL-06 / BL-07:** **BLOCKED**
**Implementation task:** **NONE CREATED OR EXECUTED**
**Application/implementation changes:** **NONE**
