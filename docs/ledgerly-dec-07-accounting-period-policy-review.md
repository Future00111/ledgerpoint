# DEC-07 Accounting-Period Policy Review

**Decision:** DEC-07 — Accounting-period policy, creation, close, and reopen  
**Status:** **APPROVED**
**Review date:** 2026-08-21  
**Decision recorded:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting, security,
and architecture review  
**Implementation authority:** None

> This records an approved product/accounting policy. It does not approve
> DEC-08, an implementation task, code, schema, migration, UI, workflow,
> dependency, deployment, or publishing work.

## 1. Purpose and decision question

DEC-06 approved the financial-year boundary and stable company-scoped
financial-year identity. DEC-07 must decide how those years are divided into
accounting periods and how period state controls posting.

DEC-07 must establish:

1. launch period frequency;
2. period identity and relationship to the DEC-06 financial year;
3. period creation and future-period behavior;
4. the authoritative open/closed lifecycle;
5. posting-date assignment and future/historical posting rules;
6. close validation and permissions;
7. reopen authority, approval, reason, and audit requirements;
8. the prohibition or controlled treatment of posting into closed periods; and
9. reporting and migration consequences.

DEC-07 must not decide year-end closing mechanics, retained-earnings treatment,
or whether a year-end closing journal is created. Those remain DEC-08.

## 2. Decision labels and existing authority

### ALREADY DECIDED

- **DEC-01:** Governance documents and the Master Backlog form a hierarchy;
  implementation work cannot resolve an accounting policy.
- **DEC-02:** The initial product direction is UK accounting, VAT preparation,
  invoices, bills, payments, banking, reconciliation, and reporting in a UK/GBP
  direction. It does not require calendar-month periods.
- **DEC-03:** Standard UK VAT on invoice basis, controlled corrections, and
  preparation/export without direct HMRC filing are approved. VAT periods are
  not automatically accounting periods.
- **DEC-04:** Journals are canonical, append-only, immutable once posted, and
  posted server-side. The architecture proposes separate financial-year and
  accounting-period concepts, with posting date controlling period validation.
- **DEC-05:** Consequential operations use active, company-scoped, server-side
  capabilities and audit. The approved starting direction gives Owner broad
  authority, Accountant close authority if assigned and elevated reopen
  authority, Admin no default close/reopen authority, and no period mutation to
  Manager or Read-only by default.
- **DEC-06:** The financial year is company-configurable with a 1 April–31 March
  UK default, supports partial first years, preserves historical boundaries
  after posting, and requires evidence-based historical assignment.
- The existing product requirement includes accounting periods, open/closed
  status, controlled reopening, posting restrictions, and an audit trail.

### APPROVED DECISION

DEC-07 records the approved monthly-period policy in section 16. Future
amendments must use the Living Product Decisions process and must preserve the
DEC-04 immutability and DEC-05 capability boundaries.

- monthly, quarterly, annual-only, or configurable frequency;
- automatic creation and future-period availability;
- the minimum period lifecycle;
- close validation and treatment of warnings;
- reopen authority and approval;
- the closed-period posting rule; and
- the migration and reporting behavior attached to period state.

### DELIBERATELY LEFT OPEN

This review does not decide:

- year-end closing journals, retained earnings, or balance-sheet carry-forward
  mechanics (DEC-08);
- chart of accounts, control-account mappings, or configuration versioning;
- payment, overpayment, allocation, refund, or payment-on-account policy;
- audit retention, deletion, export, backup/recovery, or RLS policy;
- the historical migration cohort, cutover, or rollback sequence (DEC-22);
- physical table names, API routes, UI design, or provider choices; or
- future country-specific period policies beyond preserving a company-scoped,
  extensible model.

## 3. Existing evidence and compatibility baseline

The current architecture review proposes:

- separate `fiscal_year` and `accounting_period` concepts;
- company and financial-year scope;
- start/end boundaries and sequence;
- `OPEN` and `CLOSED` period states;
- server-side validation that exactly one period contains a posting date; and
- rejection of normal posting into a closed period.

The current implementation search found no canonical accounting-period entity,
period state, close operation, reopen operation, or period-assignment service.
Existing code and data are therefore compatibility evidence, not a target
period authority. The current company-level financial-year setting cannot by
itself establish period identity or close history.

This creates the following compatibility requirements:

- a period cannot be inferred from a calendar month, VAT return, bank statement,
  or display label alone;
- a posted journal must resolve to exactly one company period;
- changing period configuration must not rewrite posted journals;
- period state must be enforced by the server rather than by disabled controls;
  and
- migration must preserve uncertainty instead of inventing period facts.

## 4. Period frequency options

### Option A — Monthly periods

Each approved DEC-06 financial year is divided into contiguous monthly periods
anchored to that financial year's start date. A company with a 1 April start
has April-to-March periods; a company with a 15 April start has
15 April-to-14 May, 15 May-to-14 June, and so on.

**Accounting consequences:** Monthly posting boundaries support month-end
control, accrual review, management reporting, and timely correction. They
create more close actions and more period-assignment edge cases than quarterly
periods.

**Data/schema consequences:** The logical model needs period identity, fiscal
year identity, sequence, contiguous boundaries, state, and close/reopen audit
metadata. It must support a short first or final period when DEC-06 creates a
partial year.

**Migration consequences:** Historical records need monthly assignment from
their authoritative posting date. Missing dates or conflicting period evidence
becomes an exception; the migration must not recreate unsupported month-end
close events.

**Reporting consequences:** P&L, trial balance, general ledger, and
comparatives can be produced at useful monthly granularity. Open and closed
state can be shown without changing journal amounts. VAT reporting remains
independent.

**Security/permission consequences:** More close and reopen operations require
the DEC-05 capability boundary and complete audit evidence. The smaller period
size makes accidental close or reopen more consequential operationally.

**Operational consequences:** This matches common UK bookkeeping and
management-review practice but requires a repeatable month-end checklist and
exception visibility.

**Compatibility consequences:** It matches the existing architecture review's
monthly recommendation and gives a clear target for existing reports, while
requiring replacement of browser-side date calculations.

**Future flexibility:** Monthly periods can support quarterly and annual
roll-ups. Moving later to custom periods remains possible but requires
preserving historical identities.

**Hard to change later:** Once reports, close history, and audit evidence use
monthly sequences, changing existing years to quarterly or custom boundaries
would require a controlled migration and could invalidate comparisons.

### Option B — Quarterly periods

Each financial year is divided into four contiguous periods anchored to the
DEC-06 financial-year start.

**Accounting consequences:** Quarterly close is lighter operationally and can
fit smaller businesses, but errors and unreconciled activity remain open longer
and monthly management control is weaker.

**Data/schema consequences:** Fewer period records and close events are needed,
but the model still requires stable identities, boundaries, state, and audit.
Future monthly reporting would need a separate non-authoritative projection.

**Migration consequences:** Date assignment is simpler, but historical records
with incomplete dates can still not be safely assigned. Existing month-oriented
reports or VAT evidence must not be silently presented as quarterly accounting
periods.

**Reporting consequences:** Quarterly P&L and trial balance reporting is
straightforward. Monthly management reports would be less authoritative unless
they filter journals by date independently of period state.

**Security/permission consequences:** There are fewer close/reopen actions, but
each close covers more activity and a reopen has a larger impact. The same
DEC-05 capability and audit controls remain necessary.

**Operational consequences:** Lower close overhead suits very small businesses,
but a long open period can allow errors to accumulate and delay issue
detection.

**Compatibility consequences:** It conflicts with the current architecture
review's monthly recommendation and may require a different reporting and
roadmap contract.

**Future flexibility:** Quarterly roll-up to annual reporting is easy. Moving
to monthly later is possible but requires a new period-generation policy and
may make historical comparisons asymmetric.

**Hard to change later:** Quarterly close behavior would become embedded in
comparatives and workflows; changing existing years to monthly periods would
require explicit period reconstruction.

### Option C — Annual-only periods

Each DEC-06 financial year is one accounting period, with no intra-year close.

**Accounting consequences:** The smallest period-control surface is easy to
explain, but it provides weak month-end or quarter-end control and makes
posting-date mistakes harder to detect promptly.

**Data/schema consequences:** A minimal period model is possible, but the
financial-year and accounting-period identities must still remain distinct
logical concepts if later periods are introduced. Close and reopen metadata
still cannot be omitted.

**Migration consequences:** Assignment by posting date is simple, but legacy
period closures, month-end evidence, and historical control information would
be lost or left outside the model.

**Reporting consequences:** Annual P&L and balance-sheet reporting works, but
monthly and quarterly reports would be date projections rather than period
reports. VAT and management reporting would need separate boundaries.

**Security/permission consequences:** Fewer close actions reduce operational
surface, but a single annual reopen would affect a large volume of accounting
history and requires strong elevation and audit.

**Operational consequences:** Lowest period-maintenance burden, but poor fit for
regular bookkeeping review, VAT preparation, and exception management.

**Compatibility consequences:** It does not fit the current product direction
or architecture recommendation for controlled period boundaries and close
operations.

**Future flexibility:** Annual-only is easy to extend to monthly in new years,
but old annual periods cannot be split without a controlled historical
reconstruction.

**Hard to change later:** A large body of annual reports and audit records would
make intra-year period introduction difficult to explain and compare.

### Option D — Company-configurable monthly, quarterly, or custom periods

Each company chooses its frequency or creates custom period boundaries.

**Accounting consequences:** It can fit different bookkeeping practices, but
period behavior differs between companies and custom boundaries increase
posting, close, VAT, comparative, and correction complexity.

**Data/schema consequences:** The model must validate arbitrary contiguous
boundaries, effective rules, sequence behavior, partial periods, and changes
without overlap or gaps. Configuration versioning becomes a material
requirement.

**Migration consequences:** Historical assignment needs company-specific
configuration evidence. Legacy records without reliable period definitions
produce more exceptions and cannot be normalized by date alone.

**Reporting consequences:** Company-specific reports are flexible but
comparatives across companies and periods are harder. VAT must remain separate,
and management reports need explicit boundary labels.

**Security/permission consequences:** Frequency and boundary changes become
high-impact accounting configuration. More powerful configuration capabilities
would need stricter DEC-05 grants and audit than a fixed monthly model.

**Operational consequences:** This creates the most setup, support, testing, and
explanation burden. Users could select a configuration that is technically
valid but operationally unsuitable.

**Compatibility consequences:** It preserves the widest future compatibility,
but it does not provide a simple launch contract and would magnify current
legacy-data ambiguity.

**Future flexibility:** Strongest for new markets and future policies, provided
the identity and versioning model is designed correctly.

**Hard to change later:** Once arbitrary boundaries are supported, restricting
them later would require migration, customer communication, and a policy for
companies already using custom periods.

## 5. Recommended period frequency and creation policy

### RECOMMENDATION — NOT APPROVAL

Adopt **Option A: contiguous monthly periods** for the launch accounting core,
anchored to the approved DEC-06 financial year.

The recommended creation policy is:

1. Generate periods automatically for each established financial year.
2. Generate the full set of contiguous periods for a known financial year,
   including future periods, rather than waiting for the current period to
   close.
3. Use financial-year anniversaries as the period boundaries, not ordinary
   calendar months. This preserves companies' DEC-06 choice of recurring start.
4. Permit a partial first or final period where DEC-06 creates a partial first
   financial year, while retaining sequence and boundary evidence.
5. Create no period outside an approved company financial year.
6. Require no gap, overlap, or duplicate sequence within a company financial
   year.
7. Treat period existence and period posting permission as separate: a future
   period may exist before the current period closes, but its state and the
   posting-date rules still control whether a journal may post.
8. Do not create, close, or reopen a period because a VAT return, bank
   statement, invoice number sequence, or document date changes.

This is a recommendation only. It does not approve DEC-07.

## 6. Period identity

An accounting period should have a stable identity within a company and
financial year. The logical identity needs, at minimum:

- company scope;
- a stable period identifier;
- the parent DEC-06 financial-year identifier;
- an ordered sequence within that financial year;
- immutable inclusive start and end dates, or an equivalent exclusive next-start
  boundary;
- the selected period frequency or generation context; and
- the authoritative state, initially `OPEN` or `CLOSED`.

The period identifier must not be generated only from `2026-04`, `Q1`, a VAT
period label, a bank statement range, or a calendar month. A company starting
on 15 April may have a period that spans parts of two calendar months; it is
still one accounting period.

The period is distinct from:

- VAT periods and VAT return locks;
- the UK tax year;
- bank statement or bank-feed ranges;
- invoice/document numbering periods;
- ordinary calendar months; and
- source-document dates.

The authoritative assignment date is the server-validated posting date,
consistent with DEC-04 and DEC-06.

## 7. Open and closed lifecycle

### Recommended states

Use only:

- **OPEN:** normal posting may be considered if the posting date, source,
  capability, and all other accounting validations pass.
- **CLOSED:** normal posting is rejected and the period can be reopened only
  through the approved elevated process.

No additional `LOCKED`, `FINAL`, `PENDING`, or `ARCHIVED` status is recommended
for launch. A VAT return lock, year-end state, audit retention state, or
migration review state must not be overloaded into accounting-period status.

### State authority

The period state is accounting authority, not a presentation preference.
Disabling a date picker or hiding a posting button is only usability support.
The server must validate the company, period identity, posting date, current
state, capability, and source before accepting a posting.

Reopening changes period availability; it does not edit or delete posted
journals and does not rewrite historical financial-year identity.

## 8. Posting into periods

### Period assignment

The server assigns a posting to exactly one period by:

1. validating the company and active membership;
2. validating the authoritative posting date;
3. finding the one company period whose immutable boundary contains that date;
4. checking the period state and applicable capabilities; and
5. storing the resolved period identity with the posted journal.

Document date, due date, payment date, bank value date, VAT period, and creation
timestamp may be retained as evidence but do not replace the posting date.

### Dates outside an open period

A posting date outside any established company financial year or accounting
period must be rejected with a business-language explanation. The server must
not silently move the posting to the nearest period, current period, or next
open period.

If a date is inside a `CLOSED` period, normal posting is rejected. The system
must not silently post a later adjustment or change the date. A controlled
correction or an explicit period reopen is a separate authorised action.

### Future-dated postings

Future periods may exist before the current period closes. A future-dated
posting may be accepted only when its server-validated posting date falls in an
open future period and the source workflow permits that date. The existence of a
future period is not itself permission to post.

The interface may warn about future dates, but the final decision is
server-side and must be visible in the source and audit evidence. A future
posting must not be created merely because a document or bank-feed row was
imported.

### Historical postings during migration

Historical records must use reliable posting-date evidence and the DEC-06
financial-year boundaries. If a historical record cannot be assigned
deterministically, it must remain an explicit migration exception and must not
be posted into a guessed period.

The migration must not make a closed historical period appear open simply to
accept legacy data. Any approved historical compatibility treatment must
preserve source evidence, original authority, and audit context.

## 9. Period close

### Close authority

Closing a period is a named DEC-05 consequential capability. The recommended
starting mapping is:

- **Owner:** may close, subject to all validation and audit controls;
- **Accountant:** may close when assigned the capability;
- **Admin:** no default close capability; any grant must be explicit and
  auditable;
- **Manager:** no close capability by default; and
- **Read-only:** no mutation capability.

These are capability outcomes, not permission to rely on role names. The server
must evaluate active membership, company scope, current capability, period
state, and request context.

### Close validation

Close should run a deterministic validation snapshot before changing state. It
should check at least:

- all included journals are balanced, valid, company-scoped, and linked to
  exactly one period;
- required source/version and VAT evidence checks have passed for postings
  that rely on them;
- no posting or approval job is still in an inconsistent intermediate state;
- no existing audit or idempotency invariant is broken; and
- the requested period is currently open.

The validation result, including warnings and exceptions, must be shown to the
authorised actor before close.

### Drafts

Unresolved drafts should not automatically block close. Drafts are not posted
accounting history and must remain outside authoritative reports. Close should
show the count and relevant period dates, require acknowledgement of the
warning where appropriate, and prevent a draft from being posted into the
closed period later without a deliberate date/reopen decision.

If a later product decision makes a particular approved source a mandatory
period obligation, that rule must be added explicitly rather than inferred from
the existence of a draft.

### Unallocated payments

Unallocated or unapplied payments should not automatically block close in this
decision. They must be surfaced as exceptions and close must not change their
allocation or accounting treatment. Their detailed treatment remains subject to
the later payment decisions.

This avoids inventing a hard blocker for a legitimate business state while
preserving visibility for review.

### Unreconciled bank transactions

Unreconciled bank evidence should not automatically block accounting-period
close. A bank-feed row is evidence, not a journal, and importing or
reconciling it must not create a hidden period posting. The close validation
should show the exception and any linked posted accounting items without
changing them.

### VAT issues

VAT evidence and source freshness failures that make an included posting
invalid should block that accounting validation. A VAT return being open,
unapproved, or on a different VAT timetable should not automatically block
accounting-period close because DEC-03 keeps VAT periods distinct.

The close result must identify VAT exceptions and link to the affected source
or journal. It must not submit, lock, or relabel a VAT return.

### Close result and audit

On success, the server changes the period from `OPEN` to `CLOSED` atomically
with the close audit event. The audit record should retain:

- actor and active company membership;
- company and period identifiers;
- the close capability evaluated;
- validation time and result;
- warnings acknowledged and blockers resolved;
- source/version or VAT-check summary where applicable;
- request and correlation context; and
- resulting state and timestamp.

If the operation fails, the period remains open and the failed attempt is
auditable when the request reached the protected accounting boundary.

## 10. Period reopen

### Authority and approval

Reopening is a distinct elevated DEC-05 capability. The recommended starting
mapping is:

- **Owner:** may request/approve reopen subject to audit and segregation
  controls;
- **Accountant:** requires a separate elevated reopen grant;
- **Admin:** no default reopen capability;
- **Manager:** no reopen capability; and
- **Read-only:** no mutation capability.

For a closed period containing posted accounting records, reopening should
require a reason and an approval distinct from ordinary close permission.
Where segregation of duties applies, the requester must not approve their own
reopen. The exact grant and approval-chain implementation remains subject to
the DEC-05 capability model and later amendment process.

### Reopen behavior

Reopening is persistent: the period returns to `OPEN` and remains open until a
new authorised close. It is not a temporary bypass attached to one request.

Reopening must not:

- modify or delete posted journal lines;
- change financial-year identity;
- recalculate historical reports silently;
- alter VAT-return state; or
- bypass source, balance, idempotency, or audit controls.

The reopen audit must retain actor, company, period, elevated capability,
reason, approver where required, previous state, new state, timestamp,
validation/recheck results, and request context.

## 11. Posting to closed periods and period locking

### Recommended rule

No normal posting may occur in a `CLOSED` period. There should be no hidden
exception flag that bypasses the period state.

When a correction relates to closed history, the controlled choices are:

1. use a later open-period adjustment when the approved accounting policy says
   the adjustment belongs there; or
2. request an audited elevated reopen, then post through the normal protected
   posting path.

The period engine must not choose between these accounting treatments silently.
The correction, reversal, source, and year-end policies remain applicable.

### Enforcement layers

- **UI:** May disable controls, explain the closed state, and direct the user
  to a review path.
- **Application/server:** Must reject the request transactionally after
  checking company scope, period identity, state, capability, source, and
  posting date.
- **Accounting authority:** A closed period is not available for normal
  posting. Only the approved reopen process can change that availability.

Client-supplied period IDs, role strings, state values, or “override” flags must
not establish authority.

## 12. Reporting consequences

- **Profit & Loss:** Include authoritative posted journal activity whose posting
  date resolves to the selected period. Closing a period does not alter its
  amounts; it changes whether further normal posting is allowed.
- **Balance Sheet:** Provide an as-of-date view and show the period state for
  the selected date. A period close does not itself create a year-end journal
  or carry retained earnings; DEC-08 decides that treatment.
- **Trial Balance:** Include posted journal lines by period or as-of date and
  display whether the selected period is open or closed. Open data must not be
  presented as final merely because it is in a report.
- **General Ledger:** Show the stable period identity, posting date, source,
  and state in drill-down. Document and bank dates remain evidence only.
- **VAT reporting:** VAT return periods and DEC-03 source evidence remain
  authoritative. Accounting-period state can be shown as context but cannot
  move VAT-box inclusion, lock a VAT return, or override VAT evidence.
- **Comparative reporting:** Compare periods with compatible boundaries and
  clearly identify open, closed, partial, migrated, or exception-containing
  periods. Monthly periods can roll up to quarters and years without changing
  journal authority.

Reports must continue to derive from canonical posted journals under DEC-04.
Close state is a control boundary, not a second financial truth.

## 13. Migration

Historical records should be assigned using:

1. the DEC-06 company financial-year boundary;
2. the authoritative posting date;
3. reliable historical period evidence where it exists; and
4. a deterministic monthly boundary calculation for the selected policy.

If period information is missing but the posting date is reliable, the period
may be derived and the derivation recorded. If dates or period evidence are
missing, invalid, conflicting, or ambiguous, the record must be visible as a
migration exception.

Migration must distinguish:

- a known period with known posted records;
- a derived period with preserved evidence;
- a historical period whose close status is unknown; and
- a record that cannot yet be assigned.

It must not:

- invent a month-end close;
- make a historical period open solely to accept data;
- silently repost records into the current period;
- rewrite posted journal history; or
- treat a VAT or bank period as an accounting period.

The historical migration cohort, cutover order, rollback, and retirement of
legacy authority remain DEC-22 decisions.

## 14. Audit requirements

The protected accounting boundary should audit:

### Period creation

Record company, financial-year identity, period identity, boundaries,
sequence, generation context, actor/system identity, configuration evidence,
timestamp, and result. Duplicate or conflicting creation attempts should
retain idempotency and failure context.

### Close

Record actor, capability, company, period, validation snapshot, warnings,
exceptions, acknowledged items, state transition, timestamp, and request
context. The close and state change must commit atomically.

### Reopen

Record requester, approver where required, elevated capability, reason,
previous/new state, validation or recheck result, timestamp, company, period,
and request context.

### Closed-period posting attempts

Record the protected request outcome, company, actor or system identity,
posting date, target period, source reference, capability evaluation, rejection
reason, and request context. A rejected attempt must not create a journal.

### Privileged exceptions

Record the exact capability, target period, reason, approval, evidence,
effective state, and result. Audit records must remain independent of UI
visibility and must not be deleted or rewritten by a period action.

## 15. Permissions under DEC-05

The recommended capability mapping is:

| Action | Owner | Admin | Accountant | Manager | Read-only |
|---|---:|---:|---:|---:|---:|
| View period state | Yes | Yes | Yes | Yes | Yes |
| Create/generate periods | Yes | Configurable | Configurable | No | No |
| Close period | Yes | No by default | Yes if assigned | No | No |
| Reopen period | Elevated/controlled | No by default | Separate elevated grant | No | No |
| Post into an open period | Matching posting capability | Matching posting capability | Matching posting capability | No by default | No |
| Post into a closed period | No direct bypass; reopen path only | No direct bypass | No direct bypass; reopen path only | No | No |

This table is a recommended operational interpretation of DEC-05, not a new
role grant. “Configurable” and “if assigned” require explicit capability
definitions, active membership, company scope, and audit before implementation.
No UI state or client-provided role may widen the server decision.

## 16. Recorded approval — DEC-07

Lee approved the recommended accounting-period policy with the following
boundaries:

1. Use contiguous monthly periods anchored to each approved DEC-06 financial
   year.
2. Generate the full set of periods automatically when the financial year is
   established, including future periods within that year.
3. Use only `OPEN` and `CLOSED` states.
4. Assign a posting to exactly one period from the server-validated posting
   date; never silently move an out-of-period or closed-period posting.
5. Allow future periods to exist before the current period closes, while
   keeping period existence separate from posting permission.
6. Close only through an explicit DEC-05 capability after deterministic
   validation. Drafts, unallocated payments, unreconciled bank evidence, and
   ordinary VAT timetable differences produce visible warnings rather than
   automatic hard blockers; invalid source, journal, or VAT evidence blocks
   the affected accounting validation.
7. Reopen only through an elevated, reasoned, auditable capability. A closed
   period containing posted records should require separate approval where
   segregation of duties applies.
8. Reject normal posting into closed periods. Use a later open-period
   adjustment or the controlled reopen path according to the applicable
   accounting policy; never use a hidden override.
9. Make close, reopen, period creation, and rejected closed-period attempts
   auditable and company-scoped.
10. Preserve historical uncertainty and never invent period closures, journal
    entries, or accounting facts during migration.

This approval does not decide year-end closing mechanics, retained earnings, or
other DEC-08 treatment.

## 17. What approving DEC-07 would lock in

DEC-07 locks in:

1. monthly period frequency for the launch accounting core;
2. contiguous periods anchored to DEC-06 financial-year boundaries;
3. stable period identity within a company and financial year;
4. automatic creation of the known periods, including future periods;
5. the minimal `OPEN`/`CLOSED` lifecycle;
6. server-side posting-date assignment and no silent nearest-period fallback;
7. deterministic close validation with visible warnings and accounting
   integrity blockers;
8. elevated, reasoned, audited reopening;
9. rejection of normal closed-period posting; and
10. period creation, close, reopen, rejection, and migration audit evidence.

This approval does not authorise implementing any of these items.

## 18. What remains changeable after approval

The following could be amended later through the Living Product Decisions
process without silently rewriting posted history:

- a future frequency policy for new companies or future financial years;
- support for quarterly or custom periods with an explicit compatibility plan;
- the exact validation checklist and warning presentation;
- additional company-specific or international calendar policies;
- display labels, report layouts, and operational guidance;
- physical schema, API, and provider choices; and
- the exact migration cohort and cutover process under DEC-22.

Changing existing period boundaries, frequency, or close state must preserve
historical identities, report reproducibility, and audit context.

## 19. What must instead be decided by DEC-08

DEC-08 must decide:

- reporting-only year-end versus an explicit closing journal;
- retained-earnings and profit-and-loss treatment;
- balance-sheet carry-forward semantics;
- source, idempotency, approval, and audit behavior for closing entries;
- year-end correction and reopening behavior; and
- classification of historical closing entries during migration.

DEC-07 establishes period state and close/reopen control, but a period close is
not a year-end closing entry.

## 20. Decisions that should remain outside DEC-07

The following must remain outside this decision:

- chart defaults, control accounts, account editing, and configuration
  versioning (DEC-09 through DEC-11);
- payment allocation, overpayment, refund, and payment-on-account treatment
  (DEC-12 through DEC-16);
- retention, deletion, export, backup/recovery, and tenant isolation
  (DEC-17 through DEC-21);
- historical migration cohort, cutover, rollback, and legacy authority
  retirement (DEC-22);
- future markets, currencies, and specialist VAT schemes; and
- implementation task assignment, schema design, API design, UI design,
  testing sequence, deployment, or publishing.

## 21. Decision readiness

**DEC-07 approval is recorded.** It is a product/accounting-policy approval
only and is not implementation authorisation.

Until DEC-07 is approved or amended:

- the current architecture proposal is not an implementation authority;
- no canonical period, close, or reopen implementation may begin;
- BL-06 and BL-07 remain **BLOCKED**; and
- DEC-08 and all later decisions remain untouched and unresolved.

**DEC-07:** **APPROVED — product/accounting policy only**
**DEC-08:** **APPROVED — reporting-only year-end policy only**
**DEC-09:** **APPROVED — Chart of Accounts and Default Account Policy**
**DEC-10:** **APPROVED — Control-Account Mapping Policy**
**DEC-11:** **APPROVED — Configuration Versioning and Effective Dating Policy**
**DEC-12:** **APPROVED — Payment, Allocation and Settlement Policy**
**DEC-13:** **APPROVED — Overpayments, Unapplied Cash and Excess Payment Policy**
**DEC-14 onward:** **NOT STARTED; REQUIRES USER DECISION**
**BL-06 / BL-07:** **BLOCKED**  
**Application code changed by this review:** **NO**  
**Database or migrations changed by this review:** **NO**