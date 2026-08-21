# DEC-06 Financial-Year Policy Review

**Decision:** DEC-06 — Financial-year start and change policy  
**Status:** **APPROVED**
**Review date:** 2026-08-21  
**Decision recorded:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting and
architecture review  
**Implementation authority:** None

> This records an approved product/accounting policy. It does not approve
> DEC-07, DEC-08, an implementation task, code, schema, migration, UI,
> workflow, dependency, deployment, or publishing work.

## 1. Purpose and decision question

Ledgerly needs a stable financial-year boundary before the accounting core can
assign journals, reports, and future accounting periods to an authoritative
financial year.

DEC-06 must decide:

1. the default UK small-business financial-year start;
2. whether a company may choose another recurring start;
3. how a financial year is identified independently of document dates;
4. how the first, historical, and migrated years are represented;
5. what happens when a company tries to change its start after accounting
   records exist; and
6. which controls and audit evidence apply to financial-year configuration.

DEC-06 must not decide period frequency, period close/reopen behavior, or
year-end closing-entry treatment. Those remain DEC-07 and DEC-08 respectively.

## 2. Decision labels and existing authority

### ALREADY DECIDED

- **DEC-01:** The Manifesto, Product Principles, PRD/Product Scope, Technical
  Architecture, and Feature Specifications/Master Backlog form the governance
  hierarchy.
- **DEC-02:** The initial direction is UK accounting and VAT preparation,
  invoices, bills, payments, banking, reconciliation, and reporting, with UK/GBP
  as the initial market/currency direction. This does not create a statutory
  financial-year rule.
- **DEC-03:** The initial VAT scope is Standard UK VAT on invoice basis, with
  controlled corrections and preparation/export rather than direct HMRC filing.
  A VAT return cycle is not automatically a financial year.
- **DEC-04:** The accounting core must use canonical, company-scoped,
  append-only journals; server-side posting; immutable posted history; and
  journal-authoritative reporting. It identifies separate fiscal-year and
  accounting-period concepts but does not choose this policy.
- **DEC-05:** Consequential configuration is subject to active,
  company-scoped, server-side capabilities, with auditable actions and no
  client-only authority. No role may edit or delete a posted journal.
- Existing product direction requires financial years and accounting periods
  with controlled posting and audit boundaries. The detailed policy is still a
  decision.

### REQUIRES USER DECISION

The user must approve, amend, or reject the recommendation in section 11,
including:

- the launch default start date;
- the allowed company-level start configuration;
- the treatment of the first and partial first year;
- the post-transaction change policy;
- the historical/migration assignment rule; and
- the treatment of edge cases such as 29 February.

### DELIBERATELY LEFT OPEN

This review does not decide:

- accounting-period frequency, generation, status, close, or reopen controls
  (DEC-07);
- year-end closing journals, retained-earnings mechanics, or reporting-only
  year-end treatment (DEC-08);
- control accounts, configuration versioning, or payment treatment (DEC-10
  onward);
- physical table names, API routes, UI design, or provider choices;
- the historical migration cohort, cutover sequence, or rollback policy
  reserved to DEC-22; or
- financial-year policy for future countries or tax regimes beyond preserving
  a general company-scoped model.

## 3. Existing evidence and compatibility baseline

The current application is evidence of compatibility work, not policy
authority.

The current database schema contains an optional company-level
`financial_year_end` text field. The company form exposes a corresponding
free-form value. The current search of the application and database packages
did not find a canonical fiscal-year entity, accounting-period entity, or
server-side financial-year assignment model. Existing demonstration data
includes a “year ending 31 March” description, but that is sample data and not
an approved default.

This baseline creates the following compatibility risks:

- a free-form year-end value does not identify immutable financial years;
- an ordinary company setting cannot safely move the boundaries of posted
  journals;
- document dates, invoice dates, bank dates, and VAT-return dates cannot each
  be treated as the accounting posting boundary without an explicit policy;
- existing legacy records may lack reliable posting dates or may contain
  inconsistent historical meaning; and
- migration must not manufacture fiscal years or accounting history merely to
  satisfy a new model.

Any future canonical model must therefore preserve evidence, validate dates,
and make unresolved historical assignments visible for review.

## 4. Financial-year meaning and identity

### 4.1 Business definition

A financial year is a company-scoped annual reporting boundary. It is not:

- the calendar year by default;
- the UK income-tax year by default;
- a VAT return period;
- an invoice numbering year;
- a document issue-date label; or
- a mutable description stored on a company profile.

The financial year is resolved from the authoritative accounting posting date
and the company's approved boundary configuration.

### 4.2 Logical identity

Each financial year should have a stable identity independent of ordinary
transaction or document dates. The logical identity needs, at minimum:

- company scope;
- a stable financial-year identifier;
- an immutable inclusive start date;
- an immutable inclusive end date, or an equivalent exclusive next-start
  boundary;
- an ordered sequence within the company;
- a human-readable label derived from the dates; and
- a lifecycle/status reference only where later period policy requires it.

The identifier must not be regenerated from a document date or from a display
label. A journal, source posting, report result, and audit record should resolve
to the same financial-year identity for the relevant posting date.

For date arithmetic, an implementation may use an exclusive next-start boundary
internally so that adjacent years cannot overlap or leave a one-day gap. In
business language, the start date is inclusive and the last day before the next
start is included in the year.

### 4.3 Labels

Labels should be derived from the company's boundary dates, for example:

- `FY2026` for 1 April 2026 through 31 March 2027; or
- `Year ended 31 March 2027`.

The label is for explanation and reporting. It is not the financial-year
identity and must not be used as the sole reference in accounting records.

## 5. Company configuration and defaults

### 5.1 Recommended configuration shape

The company should own its approved recurring start month/day. A system-level
default should be applied only when a company does not provide another value.
The logical separation is:

- **System default:** the launch default proposed in section 11, validation
  rules, and supported calendar semantics.
- **Company configuration:** the company's chosen start month/day, accounting
  commencement date where needed for a partial first year, and the effective
  date/version of the approved configuration.
- **Financial-year records:** immutable snapshots of the resulting boundaries,
  retaining the configuration context that created them.

The system default must not overwrite an explicit company choice. A company
must not inherit a different default retroactively after its financial years or
posted records exist.

### 5.2 Allowed company choices

Companies should be able to choose a different recurring start to support
business reporting practice, group reporting, or a company-specific year end.
This is a financial-reporting configuration, not permission to choose arbitrary
boundaries for individual transactions.

The initial policy should accept a month/day start that is valid as a recurring
annual boundary. 29 February should not be accepted as a launch configuration
unless a separate normalization rule is explicitly approved. Rejecting that
configuration is safer than silently changing it to 28 February or 1 March.

### 5.3 Accounting commencement and first year

The first accounting commencement date must be explicit when a company starts
mid-year or when historical records are migrated. It must not be invented from
the first invoice, first bank row, or company creation timestamp without a
documented policy.

If commencement is after the configured annual start, the first financial year
may be partial and runs from the approved commencement date to the day before
the next recurring boundary. Subsequent years are full recurring years. If the
company's approved accounting scope begins exactly on the recurring boundary,
the first year is a normal full year.

The commencement date is a boundary for Ledgerly's accounting scope; it is not
evidence that the underlying business was incorporated or that no earlier
business activity existed.

## 6. Historical financial years

Historical financial years should be represented only when their boundaries can
be established from an approved company configuration, an explicit accounting
commencement date, or reliable migration evidence.

For each historical record:

1. use the authoritative posting date where one exists;
2. resolve it against the applicable immutable financial-year boundaries;
3. preserve the source and configuration evidence used for the assignment;
4. flag missing, invalid, conflicting, or ambiguous dates for review; and
5. do not create a journal, tax event, closing entry, or financial year merely
   because a report expects one.

A historical year with no migrated transactions may be represented as an empty
boundary record if the company explicitly configured or evidenced it. An
unsubstantiated historical year must remain unknown rather than being filled
with invented dates or balances.

Migration must distinguish:

- a known financial year with known posted records;
- a known boundary with incomplete or excluded records;
- a record that can be deterministically assigned by posting date; and
- a record whose financial year is unresolved.

Unresolved records must not silently enter authoritative reports or VAT
calculations.

## 7. Changes after accounting records exist

### 7.1 Before the first posted accounting record

Before the first canonical posted journal for a company, the approved company
configuration may be changed through the applicable DEC-05 capability. The
change must validate that the generated first year and any existing draft
information do not create overlapping or missing boundaries. A change should
record actor, company, old value, new value, reason where required, timestamp,
and request context.

Draft operational records do not become posted history merely because their
dates are already present. Their future posting must resolve against the
approved configuration at posting time.

### 7.2 After posted accounting records exist

The recommended launch rule is that a financial-year start cannot be changed
retroactively after posted accounting records exist. A normal company-settings
edit must be rejected rather than silently rebasing posted journals, VAT
evidence, reports, or audit history.

If a company needs a different start after posting, the request should enter an
explicit privileged review path. At minimum it requires:

- active company membership and a DEC-05-authorised capability;
- a stated reason and impact assessment;
- a preview of affected financial-year assignments and reports;
- confirmation that no posted journal or audit record will be rewritten;
- an explicit decision about any short or long transition year; and
- a separately recorded approval before any future-effective change is allowed.

Until such a transition policy is approved, the safe outcome is to reject the
change and retain the established boundaries. A future-effective change, if
later approved, must preserve all historical financial-year identities and
must create explicit non-overlapping transition boundaries rather than mutate
old years.

### 7.3 Permissions and audit

Financial-year configuration is consequential accounting configuration. The
server, not the browser, must enforce:

- active company membership;
- company scope;
- the named DEC-05 capability;
- the state of posted history;
- the required reason and approval evidence; and
- immutable audit evidence of the attempted and completed action.

DEC-05 establishes the capability boundary but does not require every role to
receive the capability. Owner authority remains subject to accounting safety
and audit controls. Admin or Accountant access to a post-transaction
configuration change, if ever allowed, must be an explicit auditable grant; it
must not arise from an arbitrary role string or a hidden UI control.

## 8. Boundary conditions

### First financial year

The first year is based on an explicit accounting commencement date and the
approved recurring start. It may be partial. If no commencement date is
available, the company or migration process must resolve it before
authoritative posting/reporting is allowed.

### Partial first year

A partial first year is valid when accounting begins after the recurring
boundary. It must be clearly labelled as partial and must not be treated as a
normal comparative year without a warning.

### Year transitions

The next financial year starts on the configured recurring boundary. Adjacent
years must be contiguous, non-overlapping, and immutable once they contain
posted accounting records. A transaction's authoritative posting date belongs
to exactly one year.

### Leap years

29 February transactions are ordinary valid dates and must resolve to the year
whose boundaries contain that date. Leap-year arithmetic must not change an
existing boundary. A 29 February start configuration is excluded from the
recommended launch policy unless its non-leap-year behavior is separately
decided.

### Boundary dates

The first day of a financial year belongs to that year. The final day before the
next start belongs to the ending year. A transaction dated exactly on a
boundary must never be assigned based on time zone conversion or document
display formatting; financial-year resolution uses the company's accounting
calendar date.

### Historical migration

Migration uses a documented posting-date precedence rule. It must not silently
substitute invoice issue date, due date, bank-import date, VAT-return date, or
company creation date when the authoritative posting date is absent. Missing or
conflicting evidence becomes a visible exception.

## 9. Interaction with DEC-07 — accounting periods

DEC-06 should establish the outer annual boundary and stable financial-year
identity. It gives DEC-07:

- the company and financial year to which periods belong;
- immutable start/end boundaries from which periods may be generated;
- the rule that periods cannot overlap or leave gaps;
- the date-resolution rule for assigning postings; and
- the treatment of partial first years and historical exceptions.

DEC-06 must not decide:

- monthly, quarterly, or custom period frequency;
- whether periods are generated automatically;
- period open/closed statuses;
- close prerequisites;
- normal posting restrictions for closed periods; or
- who may close or reopen a period.

Those are DEC-07 decisions. A financial year can be identified before the
period-control policy is approved.

## 10. Interaction with DEC-08 — year-end treatment

DEC-06 establishes the date boundary at which a financial year ends and the next
one begins. It therefore gives DEC-08 the reporting boundary and the identity
to which any year-end treatment would attach.

DEC-06 must not decide:

- whether year-end creates a closing journal;
- whether profit and loss is closed to retained earnings;
- how balance-sheet carry-forward is represented;
- whether year-end can be reopened; or
- the approval and idempotency requirements for any closing workflow.

Those are DEC-08 decisions. No year-end journal or retained-earnings entry is
implied by this review.

## 11. Reporting consequences

- **Profit & Loss:** Include authoritative posted journal activity whose posting
  dates fall within the selected financial year. A partial first year must be
  labelled, and reports must not imply a full-year comparison.
- **Balance Sheet:** Provide an as-of-date view and identify the financial year
  containing that date. A financial-year boundary does not by itself create a
  closing journal or alter posted balances; DEC-08 decides that treatment.
- **Trial Balance:** Resolve each included posted journal line to one
  financial-year identity and later period identity. Opening/closing behavior
  must remain consistent with DEC-08.
- **General Ledger:** Show the financial-year identity and posting date for
  drill-down and filtering. Document dates may be displayed as evidence but do
  not replace the posting-date assignment.
- **VAT reporting:** DEC-03's invoice-basis VAT evidence and VAT-return periods
  remain authoritative. Financial-year boundaries may be used for analysis and
  reconciliation, but must not move VAT transactions between returns or
  override VAT-box evidence.
- **Comparative reporting:** Compare matching completed financial years with
  the same boundary policy. Comparisons involving a partial first year, a
  transition year, or unresolved migrated records must be clearly qualified.

Reports must ultimately derive from the authoritative posted journal, not from a
company setting, browser calculation, bank evidence, or operational document
status.

## 12. Material policy options

### Option A — Fixed calendar year for every company

Every company uses 1 January through 31 December. No company-level start choice
is available.

**Accounting consequences:** Boundaries are simple and deterministic. They do
not match many UK companies' preferred year ends and may force management
reporting into an unsuitable boundary.

**Data/schema consequences:** The smallest boundary model is possible, but
company-specific configuration and future transition history are not available.
Financial-year identities and immutable boundaries are still required.

**Migration consequences:** Historical assignment is easy only where records
have reliable posting dates. Existing companies using another year would need
reclassification, which could create large exception sets and must not rewrite
history.

**Reporting consequences:** Calendar-year reporting is predictable and easy to
compare. UK business comparisons may be less useful where accounts traditionally
end on 31 March, 5 April, or another date.

**Security/permission consequences:** Fewer configuration mutations exist, but
company administrators cannot correct an unsuitable launch policy. Historical
immutability and audit are still required.

**Compatibility consequences:** It is less compatible with existing sample and
company data that describes a 31 March year end or stores a company-specific
year-end value.

**Future flexibility:** Weak for different company practices and international
requirements. It is simple to explain but creates a permanent product
constraint.

**Hard to change later:** Moving from a universal calendar year to
company-configurable years would require adding configuration and potentially
reassigning historical reports.

### Option B — Company-configurable recurring start with a safe default

Use a launch default, allow a company to choose a different recurring
month/day, and freeze established boundaries after posting. This is the
recommended option in section 13.

**Accounting consequences:** Each journal resolves to the company's approved
financial-year identity. Historical boundaries remain stable, while a company
can use an appropriate reporting year.

**Data/schema consequences:** The logical model needs company configuration,
stable financial-year identities, immutable boundaries, configuration evidence,
and explicit handling for a partial first year. It must not be implemented as a
single mutable text label.

**Migration consequences:** Records can be assigned deterministically by
posting date and the company's evidenced configuration. Missing or ambiguous
history becomes a review exception rather than invented accounting data.

**Reporting consequences:** P&L, trial balance, general ledger, and
comparatives can follow each company's boundary. Partial and transition years
can be labelled. VAT remains independent.

**Security/permission consequences:** Setup and changes are consequential
company configuration under DEC-05. Post-transaction changes are rejected or
sent to an elevated, reasoned, audited review path; no client-only edit can move
posted history.

**Compatibility consequences:** It can represent the existing
`financial_year_end` concept while replacing its free-form behavior with
validated, evidence-linked boundaries. Existing values must be validated rather
than trusted automatically.

**Future flexibility:** Strong for different UK businesses and future
international markets because the model is company-scoped and does not hard-code
the calendar year or VAT cycle.

**Hard to change later:** The launch default, date semantics, and
post-transaction freeze become meaningful compatibility commitments. Changing
them later requires explicit migration and reporting treatment.

### Option C — Import or derive the UK statutory/company year only

Use a company incorporation or statutory accounting reference date as the
financial-year boundary, with little or no user choice.

**Accounting consequences:** The boundary may fit statutory accounts for some
companies but does not provide a universal rule for sole traders,
unincorporated businesses, groups, or management reporting. It risks confusing
statutory accounts with Ledgerly's internal accounting calendar.

**Data/schema consequences:** The model needs an authoritative source and
provenance for the imported reference date, refresh/error handling, and a
fallback for companies without a matching statutory record.

**Migration consequences:** Imported dates may be unavailable, stale, wrong, or
different from the company's historical bookkeeping. Migration cannot safely
infer them for every legacy record.

**Reporting consequences:** Statutory comparisons may be useful where data is
correct, but operational reports become dependent on an external concept.
VAT-return periods remain separate.

**Security/permission consequences:** Changing an imported reference date
requires elevated review and audit. External data must not silently override a
company's accounting history.

**Compatibility consequences:** It does not fit the current company-level
free-form year-end behavior without an import and exception process.

**Future flexibility:** Weak for non-UK markets and businesses whose internal
reporting year differs from a statutory reference date.

**Hard to change later:** Once reports and migrated journals depend on an
external statutory source, replacing it with a company-owned configuration
would require provenance and reassignment work.

### Option D — Company-configurable start with unrestricted retroactive changes

Allow a company to change its start at any time and recompute financial-year
membership from the new setting.

**Accounting consequences:** Posted journals, reports, VAT analysis, audit
explanations, and comparative periods could change without any journal changing.
This undermines stable accounting identity and makes historical explanations
unreliable.

**Data/schema consequences:** Every report and audit record would need to retain
historical configuration versions and resolve which version was in force.
Without that complexity, old reports could not be reproduced.

**Migration consequences:** Existing records would need repeated reassignment,
including ambiguous transition cases. A change could create short, long,
overlapping, or missing years.

**Reporting consequences:** Previously issued reports and comparisons could
change merely because a setting changed. Reconciliation and audit trails would
be difficult to explain.

**Security/permission consequences:** A broad settings permission would become
a consequential accounting mutation. UI-only protection would be unsafe, and
every change would require strong capability, review, and audit controls.

**Compatibility consequences:** It is superficially compatible with the
existing editable text field but conflicts with DEC-04's stable, traceable,
immutable accounting boundary.

**Future flexibility:** It offers apparent flexibility at the cost of
reproducibility and trust. It is not an acceptable launch policy.

**Hard to change later:** Once retroactive changes are allowed, restoring
immutable financial-year identities would require versioned historical
configuration and report reconstruction.

## 13. Recorded approval — DEC-06

Lee approved the recommended **Option B: company-configurable recurring
financial-year start with a launch default and an after-posting freeze**, with
the following policy boundaries and clarifications:

1. For new UK-focused companies, the product default is **1 April through
   31 March**. This is a product default, not an immutable requirement.
2. A company may choose another valid recurring financial-year start during
   setup or before its first canonical posted accounting record. The
   architecture must not hard-code 1 April as the only possible value.
3. Financial-year identity is explicitly represented and company-scoped,
   distinct from document dates, transaction dates, VAT periods, tax years, and
   bank dates. Reporting must not infer it solely from a document date.
4. Once canonical posted accounting records exist, ordinary company
   configuration must not change the financial-year start retrospectively.
   Existing posted records must not be silently reclassified. Any future
   transition mechanism must be separately designed, approved, privileged, and
   fully audited.
5. The policy supports a first financial year, a partial first financial year
   where applicable, normal recurring subsequent years, and year-boundary
   transitions. The first year is not assumed to be a full 12 months.
6. Historical financial years use available source evidence. The product must
   never invent historical accounting data merely to populate financial-year
   structures; incomplete or ambiguous history remains recorded as a
   limitation.
7. Financial-year identity must support accurate Profit & Loss, Balance Sheet,
   Trial Balance, General Ledger, comparative reporting, and other accounting
   reports. Reporting ultimately relies on the canonical accounting model
   approved under DEC-04.
8. Changing company financial-year configuration is consequential accounting
   configuration and must respect DEC-05 active membership, company scope,
   server-side capability checks, appropriate privileged authority, and audit.
9. The policy must not unnecessarily prevent future different starts, markets,
   currencies, or international accounting requirements.

This approval does not decide period generation/close/reopen under DEC-07 or
year-end treatment under DEC-08.

## 14. What approving DEC-06 would lock in

Approval of the recommendation would lock in:

1. the launch default of 1 April to 31 March;
2. company-level choice of a validated recurring start month/day;
3. the distinction between a financial year, a VAT period, a tax year, and
   ordinary document dates;
4. stable company-scoped financial-year identity and immutable boundaries;
5. explicit handling of commencement and partial first years;
6. date-based assignment of posted records with visible historical exceptions;
7. rejection of ordinary post-transaction retroactive boundary changes;
8. DEC-05 server-side authorization and audit for consequential configuration.

Approval would not authorise the implementation of any of these items.

## 15. What remains changeable after approval

The following could remain changeable through the Living Product Decisions
process without silently weakening accounting safety:

- the launch default, if a documented amendment explains reporting and
  migration effects before broad adoption;
- support for a 29 February start with explicit normalization rules;
- a future-effective transition-year policy that preserves old identities;
- additional country-specific calendars and statutory reporting layers;
- display labels and reporting presentation;
- the exact physical schema and API contracts; and
- later policy for configuration versioning, provided historical reports remain
  reproducible.

Any change that moves an established boundary or changes historical assignment
requires an explicit accounting, migration, reporting, security, and audit
review.

## 16. What must instead be decided by DEC-07

DEC-07 must decide:

- monthly, quarterly, or custom period frequency;
- whether periods are generated automatically;
- how a partial first financial year is divided into periods;
- period open/closed status and close prerequisites;
- normal posting behavior in closed periods;
- period reopening conditions, authority, and audit requirements; and
- how period-level VAT and reporting cutoffs operate within the financial-year
  boundary.

DEC-07 may refine period behavior but must not move or redefine an established
financial-year boundary without an approved DEC-06 amendment.

## 17. What must instead be decided by DEC-08

DEC-08 must decide:

- reporting-only year-end versus explicit closing journals;
- retained-earnings and profit-and-loss treatment;
- balance-sheet carry-forward semantics;
- the source, idempotency, approval, and audit behavior of any closing entry;
- year-end correction and reopening behavior; and
- how historical closing records are classified during migration.

DEC-08 may use the DEC-06 year boundary but must not infer that a boundary itself
creates a closing journal.

## 18. Decision readiness

**DEC-06 approval is recorded.** The approved policy is a product/accounting
decision only and is not implementation authorisation.

Until DEC-06 is approved or amended:

- the current free-form company value is not an accounting authority;
- no canonical financial-year or period implementation may begin;
- BL-06 and BL-07 remain **BLOCKED**; and
- DEC-07 and all later decisions remain untouched and unresolved.

**DEC-06:** **APPROVED — product/accounting policy only**
**DEC-07:** **APPROVED — accounting-period policy only**
**DEC-08:** **APPROVED — reporting-only year-end policy only**
**DEC-09:** **APPROVED — Chart of Accounts and Default Account Policy**
**DEC-10:** **APPROVED — Control-Account Mapping Policy**
**DEC-11:** **APPROVED — Configuration Versioning and Effective Dating Policy**
**DEC-12:** **APPROVED — Payment, Allocation and Settlement Policy**
**DEC-13:** **APPROVED — Overpayments, Unapplied Cash and Excess Payment Policy**
**DEC-14:** **APPROVED — Unapplied Cash Workflow Policy**
**DEC-15:** **APPROVED — Refund Policy**
**DEC-16:** **APPROVED — Payment-on-Account Launch Scope**
**DEC-17:** **APPROVED — Audit Retention Period**
**DEC-18:** **APPROVED — Deletion and Anonymisation Policy**
**DEC-19:** **APPROVED — Export Policy**
**DEC-20:** **APPROVED — Backup and Recovery Policy**
**DEC-21 onward:** **NOT STARTED; REQUIRES USER DECISION**
**BL-06 / BL-07:** **BLOCKED**  
**Application code changed by this review:** **NO**  
**Database or migrations changed by this review:** **NO**