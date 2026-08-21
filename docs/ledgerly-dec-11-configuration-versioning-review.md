# DEC-11 Configuration Versioning and Effective Dating Review

**Decision:** DEC-11 — Configuration Versioning and Effective Dating
**Status:** **APPROVED — product/accounting policy only**
**Review date:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting, security,
and architecture review
**Implementation authority:** None

> This records an approved product/accounting policy. It does not approve
> DEC-12, an implementation task, code, schema, migration, UI, workflow,
> dependency, deployment, or publishing work.

## 1. Purpose and decision question

DEC-11 must determine how Ledgerly preserves the accounting configuration that
was used when a canonical posting was made, while allowing safe future
configuration changes.

The policy must support:

- prospective changes approved by DEC-10;
- immutable canonical journals under DEC-04;
- deterministic server-side posting;
- historically accurate reports and VAT evidence;
- DEC-05 capability and audit boundaries;
- DEC-06 financial-year and DEC-07 period identity; and
- evidence-based migration under DEC-22.

Configuration history explains how a posting was generated. It is not a second
accounting ledger and must never be used to rewrite or reinterpret a posted
journal.

## 2. Existing authority and evidence

### Already decided

- **DEC-03:** Standard UK invoice-basis VAT and its deterministic,
  source-linked evidence remain the sole VAT authority. Configuration cannot
  create a second VAT engine or infer return boxes.
- **DEC-04:** Canonical journals are balanced, source-linked, server-side,
  append-only, and immutable after posting. Payments, allocations, and bank
  evidence remain distinct concepts.
- **DEC-05:** Consequential configuration changes require active membership,
  company scope, server-side capabilities, appropriate authority, and audit.
  Role labels and frontend controls are not sufficient.
- **DEC-06 and DEC-07:** Financial-year and monthly-period identity are
  company-scoped, server-assigned, and protected from silent reclassification.
  Closed periods reject ordinary posting.
- **DEC-08:** Year-end is reporting-only. Configuration must not create
  automatic closing or retained-earnings journals.
- **DEC-09:** Chart identity, classification, lifecycle, and reporting
  boundaries are explicit. Cosmetic account changes must not alter historical
  meaning.
- **DEC-10:** AR, AP, each accounting bank/cash location, Output VAT, and
  Input VAT use protected company-scoped mappings. Mapping changes are
  prospective only, and historical resolved account identity is preserved.

### Existing technical and product evidence

The accounting-core architecture review already requires:

- source/version context and company-scoped idempotency;
- posting templates that resolve AR, AP, bank/cash, VAT, and ordinary source
  accounts;
- VAT evidence linked to the journal, source, source line, tax treatment, and
  calculation result; and
- reports derived from canonical journal lines, with AR/AP allocations and
  bank/cash evidence remaining separate.

The current implementation is compatibility evidence rather than policy
authority. Its company account records currently contain code, name,
primary type/subtype, description, and active state, but not configuration
version, effective date, mapping role, approval, or posting snapshot. Current
bank transactions contain bank-account and matching fields, while AI
reconciliation records can contain suggested account IDs, codes, and names.
Those fields do not establish the configuration that a canonical posting used.

## 3. Configuration scope

Configuration should be versioned when changing it can alter the debit/credit
destination, VAT account, source treatment, control-account integrity, or
historical explanation of a future posting.

### Material configuration that requires version context

The following should be represented by an immutable configuration version or a
materially equivalent effective-dated record:

- DEC-10 AR, AP, bank/cash, Output VAT, and Input VAT mappings;
- any approved VAT-settlement mapping used by an approved settlement workflow;
- invoice posting configuration that affects source roles or account
  resolution;
- bill posting configuration that affects expense/asset selection, tax
  treatment, or AP resolution;
- payment posting configuration that affects cash, AR, or AP resolution;
- controlled credit-note and reversal mapping rules;
- company defaults for ordinary revenue, Cost of Sales, expense, and asset
  selections when those defaults affect a canonical posting;
- material reporting classification changes that affect a future posting or
  the interpretation of a future account balance; and
- any other accounting rule that changes canonical posting meaning.

The version context should identify the relevant configuration bundle and the
resolved account IDs. It must not replace the source snapshot, VAT result,
tax-rule identity, period identity, or journal line data required by DEC-03,
DEC-04, DEC-06, and DEC-07.

### Configuration that need not create an accounting version

The following can remain ordinary company configuration when they do not alter
posting meaning:

- display labels, descriptions, help text, and UI ordering;
- a code or name change that preserves stable identity and classification;
- non-accounting notes and contact metadata;
- presentation preferences; and
- other cosmetic chart changes that do not affect eligibility, mapping,
  classification, source treatment, or report meaning.

An account code or name change must still be audited where DEC-09 requires it.
It must not be allowed to masquerade as a material change or to rewrite the
name/code recorded in historical evidence.

Account activation, deactivation, primary-type changes, and reporting-class
changes need special treatment. A deactivation or future eligibility change
should be effective-dated when it changes which account a future posting may
resolve to. A primary-type or meaning-changing classification change after use
is prohibited under DEC-09; it requires a replacement account or a separately
approved correction policy, not an in-place reinterpretation.

## 4. Recommended version model

Recommend an **immutable, company-scoped, effective-dated accounting
configuration version** with:

- a stable version identity;
- a company identity;
- an effective-from posting date;
- an optional effective-until boundary derived from the next version;
- immutable material configuration contents;
- creation, approval, activation, supersession, and cancellation evidence;
- a deterministic current-version rule; and
- a reference from each canonical posting to the version used.

This is a conceptual policy, not approval of a physical schema or API.

### Version identity and current resolution

Each company has a sequence of approved configuration versions. A version is
identified by a stable ID and a company-local sequence, not by a mutable name,
account code, or timestamp alone.

For a posting with canonical posting date `D`, the applicable version is the
single approved version for that company with the greatest effective-from date
that is less than or equal to `D`. Effective ranges must not overlap, and
there must not be an unhandled gap for a posting that requires accounting
configuration. If no valid version exists, the posting fails closed and
requires configuration review; it must not guess from current UI state.

The configuration shown as “current” in settings is a user-facing convenience.
It is not the authority for a historical posting. Historical resolution uses
the posting's recorded version reference and resolved values.

### Version contents and posting snapshot

A version should contain or reference the material mapping and posting
configuration needed for deterministic resolution. The canonical posting
should additionally retain:

- the configuration version identity;
- resolved stable account IDs for each journal line;
- source and source-revision context;
- applicable company, financial-year, and accounting-period identity;
- applicable VAT result/rule/evidence identity where VAT is present; and
- the idempotency/source context required by DEC-04.

This avoids relying on a later configuration lookup to explain a posted
journal. The precise physical snapshot and version record belong to DEC-11's
eventual implementation design and must remain compatible with DEC-03 and
DEC-04.

## 5. Effective dates

The effective date for accounting configuration is the canonical **posting
date**, not the document date, bank-feed date, transaction-import date,
financial-year start, VAT-period label, or record-creation timestamp.

These dates must remain distinct:

| Date or identity | Meaning |
| --- | --- |
| Creation timestamp | When a draft or configuration change was recorded |
| Approval timestamp | When an authorised actor approved it |
| Effective-from date | Earliest canonical posting date to which it may apply |
| Posting date | Accounting date used to select period and configuration |
| Document/transaction date | Source or commercial evidence date |
| Bank date | Date on external bank evidence |
| Accounting period | DEC-07 period assigned server-side from posting date |
| Financial year | DEC-06 financial-year identity containing the posting |

Creating or approving a change must never silently make it effective for an
earlier posting date. A posting preview may show the version selected for its
proposed posting date, but the server must resolve it again atomically when
the canonical posting is committed.

If a posting date is in a closed period, DEC-07 controls the rejection or
privileged correction path. A configuration version cannot bypass a closed
period or silently move a posting to another period.

## 6. Posting resolution

The canonical posting flow should:

1. validate the active company membership, source, source revision, posting
   date, currency, VAT result, and open accounting period;
2. select exactly one approved company configuration version using the
   canonical posting date;
3. validate that each required control role resolves to an eligible protected
   account under DEC-10;
4. resolve ordinary revenue, Cost of Sales, expense, or asset selections using
   the validated source and configuration;
5. recompute or verify the source and VAT values required by DEC-03/DEC-04;
6. record the selected version identity and resolved account IDs in the
   posting context;
7. create the balanced immutable journal and its source/audit relationships
   in one transaction; and
8. reject the posting if configuration is missing, overlapping, expired,
   incompatible, stale, or otherwise ambiguous.

The client cannot choose an arbitrary configuration version or account to
override server-side resolution. An AI suggestion can inform a review but
cannot select or persist a mapping without the equivalent DEC-05 capability
and canonical posting path.

## 7. Backdated changes

The recommended ordinary policy is **no backdating over a posting or a
closed-period boundary**.

A controlled pre-posting correction may be allowed only when:

- no posted journal depends on the affected configuration interval;
- no closed period is reopened or bypassed;
- the requested effective date is supported by company evidence;
- an elevated DEC-05 capability authorises the action;
- type/classification and mapping validation passes;
- the actor supplies a reason and any required evidence; and
- an immutable audit record records the old and new configuration.

Once a configuration version has been used by a posted journal, a new mapping
must not be inserted before that journal's posting date. If a historical
posting is wrong, the remedy is an explicit correction, reversal, period
reopen, or later-period adjustment under the approved accounting policies—not
a backdated configuration rewrite.

Open-period status alone does not permit historical reinterpretation. Drafts
may be recalculated before posting, but a posted journal remains protected.

## 8. Future-dated changes

Future-dated changes should be supported for a valid future posting date,
provided they do not overlap an existing approved version or create a gap.

Recommended lifecycle:

1. **DRAFT:** editable proposal, not usable for posting.
2. **APPROVED:** authorised immutable contents with a future effective date,
   waiting to become active.
3. **ACTIVE:** the version selected for at least one eligible posting date.
4. **SUPERSEDED:** retained historical configuration after a later version
   takes over; still retrievable.
5. **CANCELLED:** an unactivated proposal that will never become effective;
   retained for audit and never used for posting.

`ACTIVE` is configuration state and does not mean that an accounting period is
open. A future-approved version may become active by date selection without a
manual period-state transition. Cancellation must not remove a version already
used by a posting.

## 9. Approval, capability, and audit

Material changes to protected mappings, posting treatment, effective dates,
or configuration that affects a consequential accounting workflow require the
DEC-05 accounting-configuration capability, active membership, company scope,
server-side validation, and audit.

A second-person approval is not required for every harmless display change.
Recommend separate approval or elevated segregation-of-duties treatment for:

- changes to AR, AP, bank/cash, Output VAT, or Input VAT mappings;
- a future change that affects multiple protected roles;
- any exceptional pre-posting backdated correction; and
- any change that would become effective across a closed-period or
  financial-year boundary.

The final capability identifiers, role grants, and segregation rules remain
within DEC-05's approved capability model and are not implemented by this
review.

An immutable audit record for a material change must retain, at minimum:

- company and configuration/version identity;
- actor who created it;
- actor who approved it, where approval is required;
- creation, approval, activation, supersession, and cancellation timestamps;
- effective-from date and any effective-until boundary;
- old and new material values or a durable change set;
- reason and supporting evidence reference;
- capability and authority context; and
- resulting configuration version and outcome.

Audit history must not be deleted, overwritten, or altered by later
configuration changes.

## 10. Reporting, VAT, AR/AP, and bank behavior

Historical reports must use the account identity and classification recorded
by the canonical journal. They must not re-resolve a historical journal using
the company's current configuration. This preserves comparative P&L, Balance
Sheet, Trial Balance, General Ledger, aged receivables, aged payables, VAT,
bank reconciliation, and payment reporting.

Current and future reports can use the configuration applicable to the report's
posting-date range, but report presentation must remain subordinate to
canonical journal lines and posting-time identity. Changing an account name,
code, or current mapping cannot change a prior report's accounting meaning.

### VAT

DEC-03 remains the sole VAT authority. Configuration versioning records which
protected Output VAT or Input VAT account applied to a posting and which
approved tax/evidence context was used. It does not calculate VAT, infer boxes,
or turn bank settlement into invoice-basis VAT. Historical VAT returns and
source evidence resolve through their recorded journal/source/tax context.

### AR and AP

The DEC-10 AR and AP mappings are selected from the version applicable to the
posting date. Invoice, credit-note, payment, and allocation records retain
their source and journal relationships. A later AR/AP mapping cannot move or
reinterpret prior open-item balances. Payment edge cases remain DEC-12
through DEC-16 decisions.

### Bank and cash

Each bank/cash location resolves to the protected accounting account in the
version applicable to the posting date. Bank-feed evidence retains its
separate identity and date. A later bank mapping cannot change the account
identity of an existing cash journal or erase its reconciliation evidence.
Transfers continue to require linked treatment of the two cash locations and
are not created by a configuration version alone.

## 11. Chart of Accounts interaction

DEC-09's stable account identity is the durable reference. Configuration
versioning must not create a new accounting meaning merely because an account
name or code changes.

- A cosmetic name/code/description change may be audited without a new
  accounting version when classification and posting eligibility are
  unchanged.
- A future ordinary-account default change requires the applicable future
  configuration context, but does not reclassify old journals.
- Deactivation or eligibility changes must be future-effective where they
  alter resolution, and cannot deactivate an account required by an active
  DEC-10 mapping.
- A meaning-changing primary-type or reporting-class change after use is
  prohibited by DEC-09; use a replacement account or explicit correction
  policy instead.
- Control-account replacement is a DEC-10-protected, prospective change and
  must be retained in the posting context.

Account configuration history is not a substitute for a journal snapshot.
Names and codes remain presentation/configuration attributes, never posting
logic.

## 12. Migration

Historical configuration versions may be created only where evidence supports:

- the material mapping or posting rule;
- the company scope;
- the effective date or a defensible interval;
- the approving authority, if evidenced; and
- the relationship to existing source and journal records.

Do not invent historical versions, effective dates, approvals, mappings, or
configuration states from current names, codes, or guesses. Where only the
resolved historical account ID is known, preserve that identity and record an
unknown configuration-version marker or migration exception. Where even the
account relationship is ambiguous, preserve the ambiguity for DEC-22.

Migration must not apply today's configuration to historical postings or
pretend that an effective date is known merely because an account is currently
active. DEC-22 remains responsible for cohort, cutover, rollback, and legacy
authority retirement.

## 13. Options

### Option A — Mutable current configuration

Keep one editable current mapping set and use it for all postings.

- **Accounting/reporting:** Simple for new postings but cannot reliably explain
  why historical accounts, VAT, AR/AP, or reports were selected.
- **Data/migration/audit:** Low initial complexity, but historical migration
  must guess past values and audit cannot prove which mapping applied.
- **Security/operations:** Easy to misuse through a current UI value and hard
  to repair after an unsafe change. Later versioning requires reconstructing
  history.
- **Flexibility:** Very flexible immediately, but costly and disruptive to
  change into an immutable model later.

### Option B — Append-only change log plus current configuration

Keep an audit log of edits but resolve postings from the current configuration.

- **Accounting/reporting:** Better change visibility, but a log is not enough
  unless each posting can deterministically identify the applicable entry.
- **Data/migration/audit:** More evidence than Option A, though out-of-order,
  overlapping, or missing changes remain difficult to resolve historically.
- **Security/operations:** Supports audit review but still risks accidental
  retroactive interpretation and ambiguous effective dates.
- **Flexibility:** Easier to evolve than Option A, but later correction of
  ambiguous log order is difficult.

### Option C — Immutable snapshots with a current pointer

Create an immutable configuration snapshot for each material change and retain
one current pointer.

- **Accounting/reporting:** Strong historical reproducibility when every
  posting records the snapshot ID; current pointer changes do not rewrite old
  journals.
- **Data/migration/audit:** Clear version identity and audit, but the system
  still needs effective-date and overlap rules for historical posting dates.
- **Security/operations:** Protected snapshot creation and approval are
  understandable, while cancellation and supersession remain manageable.
- **Flexibility:** Good future flexibility, but an incomplete date model can
  still make backdated postings ambiguous.

### Option D — Immutable effective-dated versions

Use immutable company-scoped versions selected by canonical posting date, with
resolved configuration context recorded on every posting.

- **Accounting/reporting:** Best fit for DEC-04 and DEC-10; historical
  journals, VAT, AR/AP, bank, and comparative reports remain reproducible.
- **Data/migration/audit:** Requires version identity, effective ranges,
  posting references, source context, and explicit unknown markers for
  unsupported legacy history.
- **Security/operations:** Supports validation of overlaps and gaps,
  future scheduling, capability-gated changes, approval, cancellation, and
  immutable audit.
- **Compatibility/flexibility:** Supports company-specific mappings, future
  chart changes, markets, currencies, VAT/accounting rules, and workflows.
  It is more deliberate to design, but avoids a later historical
  reconstruction project.

## 14. APPROVED POLICY

Approve **Option D: immutable, company-scoped, effective-dated
configuration versions**, with these policy boundaries:

1. Version only material accounting configuration; keep cosmetic display
   changes outside the accounting version while retaining any required audit.
2. Select a single approved version by canonical posting date, with no
   overlap or unhandled gap for a posting that requires configuration.
3. Use future-effective changes as the ordinary path. Do not backdate over
   posted journals or closed periods; allow only controlled pre-posting
   correction where no dependent posting exists and DEC-05 evidence is
   satisfied.
4. Record the selected configuration version and resolved stable account IDs
   with every canonical posting, alongside source, VAT, financial-year,
   period, and idempotency context.
5. Use DEC-05 capabilities, validation, reason, audit, and proportionate
   approval for material protected-role changes. Do not require a second
   approver for harmless cosmetic edits.
6. Keep configuration state separate from DEC-07 accounting-period state.
7. Migrate historical configuration only from evidence; preserve unknown
   versions and ambiguous intervals as DEC-22 exceptions.
8. Leave payment edge cases to DEC-12 through DEC-16 and leave the physical
   versioning contract and implementation sequence outside this review.

This approved policy preserves immutable accounting, historical
reproducibility, VAT authority, company-specific chart flexibility, and
auditable future change.

## 15. Decision boundaries

### What DEC-11 approval locks in

- the material-versus-cosmetic configuration boundary;
- immutable company-scoped configuration identity;
- effective selection by canonical posting date;
- no ordinary backdating over posted journals or closed periods;
- future-only mapping and posting-configuration changes;
- posting-time retention of version identity and resolved account IDs;
- explicit overlap/gap validation and fail-closed posting;
- configuration lifecycle distinct from accounting-period lifecycle; and
- audit and evidence requirements for configuration history.

### What remains changeable

- future configuration bundle contents and ordinary account defaults;
- display names, codes, descriptions, and presentation conventions;
- future market, currency, VAT, and accounting extensions approved through
  governance;
- the detailed user experience for drafting, approving, scheduling, and
  reviewing changes; and
- future policy amendments that preserve historical immutability.

### Deliberately left open

- payment source freshness, overpayments, unapplied cash, refunds, and
  payment-on-account treatment (DEC-12 through DEC-16);
- retention, deletion/anonymisation, export, backup/recovery, RLS, migration
  cohort, cutover, rollback, and legacy authority retirement (DEC-17 through
  DEC-22);
- physical tables, APIs, capability identifiers, UI, workflow, testing,
  dependencies, deployment, and publishing; and
- any implementation task.

## 16. Decision readiness

DEC-11 was explicitly approved on 2026-08-21. The approval is a
product/accounting-policy decision only. Until the applicable remaining
decisions are approved or amended:

- no configuration-versioning or effective-dating mechanism may be
  implemented;
- DEC-18 through DEC-22 remain untouched and unresolved;
- BL-06 and BL-07 remain **BLOCKED**; and
- no implementation task is authorised.

**DEC-01 through DEC-11:** **APPROVED**
**DEC-12:** **APPROVED — Payment, Allocation and Settlement Policy**
**DEC-13:** **APPROVED — Overpayments, Unapplied Cash and Excess Payment Policy**
**DEC-14:** **APPROVED — Unapplied Cash Workflow Policy**
**DEC-15:** **APPROVED — Refund Policy**
**DEC-16:** **APPROVED — Payment-on-Account Launch Scope**
**DEC-17:** **APPROVED — Audit Retention Period**
**DEC-18 through DEC-22:** **REQUIRE USER DECISION**
**BL-06 / BL-07:** **BLOCKED**
**Application code changed by this review:** **NO**
**Database or migrations changed by this review:** **NO**