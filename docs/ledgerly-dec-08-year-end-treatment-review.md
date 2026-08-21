# DEC-08 Year-End Treatment and Financial-Year Transition Review

**Decision:** DEC-08 — Year-end treatment and financial-year transition
**Status:** **APPROVED**
**Review date:** 2026-08-21
**Decision recorded:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting, security,
and architecture review
**Implementation authority:** None

> This records an approved product/accounting policy. It does not approve
> DEC-09, an implementation task, code, schema, migration, UI, workflow,
> dependency, deployment, or publishing work.

## 1. Purpose and decision question

DEC-06 established company-scoped financial years and DEC-07 established
contiguous monthly accounting periods with `OPEN` and `CLOSED` states. DEC-08
must decide how Ledgerpoint crosses the end of one approved financial year into
the next without creating a second accounting truth.

DEC-08 must establish:

1. whether year-end is a reporting boundary, a posting event, or both;
2. how current-year income and expenses relate to prior-year results;
3. how retained earnings and equity are represented;
4. how permanent and temporary accounts behave across the boundary;
5. what a year-end process validates, records, and approves;
6. how corrections discovered after year-end are controlled;
7. whether a completed financial year needs a separate status; and
8. how historical year-end evidence is migrated.

The policy must preserve the DEC-04 canonical journal as the source of truth.
It must never delete journals, rewrite posted lines, change historical posting
dates, silently reassign financial years, or overwrite historical balances.

## 2. Existing evidence and compatibility baseline

The accounting-core architecture review currently proposes that year-end:

- must not delete, rewrite, or automatically rebalance accounting history;
- initially carries retained-earnings/reporting behavior through controlled
  reporting rules; and
- may later support an explicit closing journal only through a separately
  approved workflow with its own source, period, idempotency, and audit record.

The current application has a retained-earnings account in the standard chart
seed. That account is not evidence that any closing journal, retained-earnings
balance, approval, or historical year-end event exists. The current search found
no year-end workflow, closing-journal service, retained-earnings posting
service, or completed-year state.

Current implementation and data are compatibility evidence, not policy
authority. A retained-earnings account name, report subtotal, or demo year-end
label must not be treated as an accounting event.

## 3. Decision labels and existing authority

### ALREADY DECIDED

- **DEC-01:** Governance documents and the Master Backlog form the decision
  hierarchy.
- **DEC-02:** The initial product direction is UK accounting, VAT preparation,
  invoices, bills, payments, banking, reconciliation, and reporting in a
  UK/GBP direction.
- **DEC-03:** Standard UK VAT on invoice basis, controlled corrections, and
  preparation/export without direct HMRC filing are approved. Year-end must not
  create a second VAT engine or change VAT-return inclusion.
- **DEC-04:** Canonical normalized journals, server-side double-entry posting,
  immutable posted history, source linkage, idempotency, and
  journal-authoritative reporting are approved architecture invariants.
- **DEC-05:** Consequential actions require active company membership,
  company-scoped server-side capability checks, appropriate authority, and
  audit. Posted journals cannot be edited or deleted.
- **DEC-06:** Financial years have stable company-scoped identities and
  boundaries, with a 1 April–31 March UK default, company-specific starts, and
  no ordinary retroactive rebasing after posting.
- **DEC-07:** Accounting periods are contiguous monthly periods with automatic
  generation, `OPEN`/`CLOSED` state, server-side posting-date assignment,
  privileged audited close/reopen, and no direct closed-period posting bypass.
- Reports must derive from the canonical accounting model rather than browser
  calculations or operational-document state.

### APPROVED DECISION

DEC-08 records the reporting-only year-end policy in section 15. Future
amendments must use the Living Product Decisions process and preserve the
DEC-04 journal, DEC-03 VAT, DEC-05 capability, and DEC-06/DEC-07 boundaries.

- reporting-only, automatic journal, explicit journal, or hybrid treatment;
- the representation of current-year and prior-year results;
- retained-earnings behavior;
- the year-end validation and approval workflow;
- correction treatment after a year ends; and
- whether a year-end process creates an auditable event without creating a new
  accounting-period status.

### DELIBERATELY LEFT OPEN

This review does not decide:

- default chart structure, protected accounts, or control-account mappings
  (DEC-09 and DEC-10);
- configuration versioning and effective-dated account policy (DEC-11);
- payment, allocation, overpayment, refund, or payment-on-account treatment
  (DEC-12 through DEC-16);
- retention, deletion, export, backup/recovery, and tenant-isolation policy
  (DEC-17 through DEC-21);
- historical migration cohort, cutover, rollback, or legacy-authority
  retirement (DEC-22);
- future country-specific tax or statutory reporting rules;
- physical schema, API routes, UI design, or provider choices; or
- an implementation task or implementation sequence.

## 4. Year-end model options

### Option A — Reporting-only year-end boundary

The financial-year boundary changes reporting scope but creates no physical
closing journal. Revenue and expense activity remains in the canonical journal.
Reports derive current-year and prior-year results from posted journal lines and
show retained-earnings presentation as a clearly labelled derived view where no
corresponding posting exists.

**Accounting consequences:** Posted revenue, cost-of-sales, and expense
accounts remain unchanged. Current-year profit/loss is the net of those
accounts within the selected financial-year boundary. Prior-year results remain
reproducible from historical journal activity. No artificial balance is posted
to retained earnings.

**Data/schema consequences:** Stable financial-year and period identities are
enough for the initial model, with an auditable year-end review event if the
process is completed. No closing-journal source type or generated journal lines
are required at launch.

**Migration consequences:** Historical journals and any documented legacy
closing entries can be classified without inventing a new close. A legacy
retained-earnings balance without supporting evidence remains a limitation or
opening-balance fact only where separately evidenced.

**Reporting consequences:** P&L can be filtered by financial year. Balance
Sheet and Trial Balance remain as-of views of posted journals, with a derived
current/prior result presentation clearly distinguished from posted equity.
Comparatives are reproducible and do not change because a report was run.

**Audit/security consequences:** Year-end review, validation, and completion
are consequential company-scoped actions under DEC-05, even though they do not
post a journal. There is no automatic journal bypass or hidden mutation path.

**Operational consequences:** The smallest launch process: validate, present
reports and warnings, record approval/review, and establish the next
financial-year boundary. It avoids an automatic accounting event that users
may not understand.

**Compatibility consequences:** Best fit for the current absence of a closing
workflow and the DEC-04 architecture review. Existing retained-earnings
account seeds are not given unsupported historical meaning.

**Future flexibility:** Strong. An explicit closing-journal workflow can be
added later without changing historical reporting-only years, if the new source
and account treatment are separately approved.

**Hard to change later:** Users may later expect a posted retained-earnings
journal for each year. Adding one retroactively would require explicit
historical evidence or a controlled migration policy and must not be automatic.

### Option B — Automatic year-end closing journal

At every year-end, Ledgerpoint automatically posts a journal that clears
temporary accounts and transfers the net result to retained earnings.

**Accounting consequences:** This produces explicit ledger entries and zeroes
revenue and expense balances after the close, but it creates a consequential
accounting fact without a user-specific accounting decision at the time of
posting. Incorrect mappings or incomplete late postings could create
incorrect retained-earnings entries.

**Data/schema consequences:** The model requires a year-end source type,
financial-year link, period link, generated journal identity, idempotency key,
account mappings, posting actor/system identity, and correction/reversal
relationships. It also needs a reliable rerun boundary.

**Migration consequences:** Historical automatic closes cannot be reconstructed
without evidence. Assuming that every legacy year had an automatic close would
invent accounting facts and could duplicate existing retained-earnings
balances.

**Reporting consequences:** Reports can use posted retained-earnings movements,
but a failed or delayed automatic job would affect the ledger. Reopening and
late corrections become more complex because generated journals are part of
posted history.

**Audit/security consequences:** Automation would require a privileged,
auditable system capability and robust failure monitoring. It would be unsafe
if a scheduler could post without a complete validation and idempotency
boundary.

**Operational consequences:** Low user effort when correct, but high support
cost when the job fails, mappings are incomplete, or late sources arrive.
Users may not understand an automatic journal that they did not initiate.

**Compatibility consequences:** Conflicts with the existing recommendation and
the current lack of canonical posting infrastructure. It would also create
meaning for the existing retained-earnings seed that current data does not
support.

**Future flexibility:** Weak to moderate. Replacing automatic close with
reporting-only treatment would leave historical generated journals that cannot
be removed.

**Hard to change later:** Once automatic closing entries exist, every
comparative report, correction, migration, and audit process must account for
them. Changing the automatic rule cannot erase prior generated entries.

### Option C — Explicit user-approved year-end closing journal

Year-end may create a normal canonical closing journal only after validation,
explicit user action, appropriate approval, and a protected posting operation.
No journal is created merely because the date crossed a boundary.

**Accounting consequences:** The ledger explicitly records the transfer of
temporary-account balances to retained earnings. A typical closing journal
would debit credit-balance revenue accounts, credit debit-balance cost and
expense accounts, and post the net result to the approved retained-earnings or
equivalent equity account. Exact account mappings remain dependent on DEC-09
and must be validated server-side.

**Data/schema consequences:** The logical contract requires a distinct
year-end source, source and financial-year links, posting date, period link,
balanced lines, account mapping/version, idempotency key, actor/approver,
approval evidence, and correction/reversal relationships. It must be a normal
canonical journal, not a report-side mutation.

**Migration consequences:** Only evidenced legacy closing journals should be
imported as closing journals. A historical retained-earnings balance or
year-end label alone is not enough to create one. Unsupported history remains
an explicit limitation.

**Reporting consequences:** Posted closing entries make retained earnings
visible in the ledger and can simplify some balance-sheet presentation.
Reports still need to distinguish the closing journal from ordinary source
activity and preserve pre-close P&L detail.

**Audit/security consequences:** This is a highly consequential operation.
It requires DEC-05 active membership, company scope, a named year-end posting
capability, explicit approval, reason/evidence, atomic posting, idempotency,
and a complete audit trail. The requester should not approve their own close
where segregation of duties applies.

**Operational consequences:** More explainable than an automatic journal but
requires a deliberate year-end workflow, final validation, account mapping,
and correction handling. It gives users control over when the accounting event
occurs.

**Compatibility consequences:** Fits DEC-04 if implemented as a normal
source-linked posting, but requires a new posting boundary and account
contract. Existing historical data cannot be backfilled without evidence.

**Future flexibility:** Strong for businesses and jurisdictions requiring
explicit closing entries, provided the source and account mappings are
versioned and future-effective.

**Hard to change later:** Once closing journals are posted, switching to
reporting-only treatment cannot remove or rewrite them. Future reports must
support both years with and without explicit closing entries.

### Option D — Hybrid: reporting-only by default, explicit journal when approved

The initial policy uses reporting-only year boundaries. A company or later
approved product policy may use an explicit closing journal only when the
appropriate accounting treatment, account mapping, and approval are available.
There is no automatic journal.

**Accounting consequences:** New companies can operate without an invented
closing event while businesses that require explicit closing entries can use a
controlled canonical posting. Reports must support both journal histories
without treating one as incomplete merely because it uses reporting-only
boundaries.

**Data/schema consequences:** The model needs the reporting-only boundary and
an optional year-end source contract, plus a clear indicator of whether an
explicit closing journal exists. It must avoid making the indicator a mutable
substitute for journal evidence.

**Migration consequences:** Evidenced historical closing journals can be
preserved; unsupported years remain reporting-only with an explicit limitation.
Migration must not add a synthetic journal merely to make year types uniform.

**Reporting consequences:** Reports need to explain whether retained earnings
are posted or derived for each year. Comparatives remain possible if the
presentation distinguishes canonical entries from derived subtotals.

**Audit/security consequences:** Reporting-only review and explicit closing
posting have different capabilities but both are auditable. The explicit
journal path requires the stronger approval and idempotency controls.

**Operational consequences:** Flexible, but the product must explain two valid
year-end treatments and prevent users from assuming that review completion
always posts a journal.

**Compatibility consequences:** Best accommodates current missing workflows and
future accounting needs, but adds a compatibility dimension to reporting and
support.

**Future flexibility:** Strongest overall, if the optional path is constrained
by approved accounting policy and does not allow arbitrary per-user treatment.

**Hard to change later:** Once some companies use explicit journals, a later
policy change must preserve both historical modes and explain differences in
comparatives and retained-earnings presentation.

## 5. Profit and loss and retained earnings

### 5.1 Temporary accounts

Revenue, cost-of-sales, and operating-expense accounts are temporary for
financial-year reporting purposes:

- current-year P&L is the net posted activity whose dates fall within the
  selected financial year;
- prior-year P&L remains queryable for the historical year;
- a reporting-only policy does not delete or zero the underlying journal
  balances; and
- an explicit closing journal, if later approved, must zero the selected
  temporary-account balances through normal canonical postings.

“Temporary” describes their year-end reporting treatment. It does not permit
editing or deleting posted journal lines.

### 5.2 Permanent accounts

Assets, liabilities, and equity are permanent accounts. Their posted balances
continue across financial-year boundaries. A new year does not reset cash,
receivables, payables, fixed assets, loans, VAT liability, share capital, or
other permanent balances.

Retained earnings is an equity concept and may be:

- a posted equity balance where an evidenced opening or explicit closing
  journal exists; or
- a clearly labelled derived presentation of cumulative prior-year results when
  the approved policy does not create a closing journal.

The reporting layer must not present a derived subtotal as a posted journal or
create an accounting fact that is absent from the canonical journal.

### 5.3 Current-year and prior-year results

Reports should distinguish:

- **Current-year profit/loss:** net posted temporary-account activity within the
  selected financial year;
- **Prior-year results:** historical year-scoped P&L, retained as a reportable
  comparative even if no closing journal exists;
- **Posted retained earnings:** balances supported by canonical equity postings;
  and
- **Derived accumulated results:** a report-only subtotal, if needed, clearly
  labelled as derived from posted history rather than a ledger entry.

The same journal lines must reconcile to the same totals regardless of whether
the user views a year-end report, comparative report, or general ledger.

## 6. Balance Sheet behavior at year-end

### Permanent accounts

Assets, liabilities, and equity remain in the canonical balance sheet after a
financial year ends. Their balances at the last day of one year become the
starting as-of balance for the next year, subject to any genuine subsequent
postings. No automatic carry-forward journal is required by a reporting-only
boundary.

### Temporary accounts

Revenue, cost-of-sales, and expenses are included in the selected year's P&L.
Under reporting-only treatment, the ledger balances remain historical posted
balances and the report applies the year boundary. Under an explicit closing
journal, the source-linked journal transfers the net result and zeroes the
temporary accounts according to the approved account mapping.

### Equity and retained earnings

Share capital and other permanent equity postings remain unchanged. Retained
earnings must not be increased by a display calculation that is represented as
an ordinary posted balance. A derived result may be shown separately with
source-year traceability.

DEC-09 approves the chart policy and protected system-account candidates.
DEC-10 remains responsible for active control-account mappings. DEC-08 must
not silently select a protected account or invent an account that the approved
chart does not contain.

## 7. Trial Balance behavior

- **Before year-end:** Include posted journal lines through the selected
  as-of/posting date and show the relevant open or closed period state.
- **At year-end:** A reporting-only boundary changes the report's date range
  without changing journal balances. An explicit closing journal, if approved,
  appears as a normal balanced journal in the final period and is traceable to
  the year-end event.
- **After the next year begins:** Permanent account balances continue. P&L
  reporting starts a new year scope, while the general ledger remains a
  continuous journal history. Any derived retained-earnings presentation must
  reconcile to posted history.
- **Historical queries:** A prior-year Trial Balance must be reproducible from
  the same immutable journals and the financial-year/period identities in
  force for that history. It must show whether the year used reporting-only or
  explicit closing treatment where that distinction exists.

The Trial Balance cannot be the authority for creating a missing closing
journal or correcting an imbalance.

## 8. General Ledger behavior

The General Ledger must:

- retain every historical posted journal and its original financial-year and
  period identity;
- show year-end boundaries as filters and explanatory markers, not as deleted
  rows or rewritten dates;
- show any explicit closing entry as a source-linked, balanced, auditable
  journal;
- distinguish posted retained earnings from a derived report-only result; and
- expose corrections, reversals, approvals, and year-end audit events without
  hiding the original history.

A reporting-only year-end creates no ledger row. An explicit year-end policy
creates a normal ledger row only through the protected posting path.

## 9. Year-end process

### Recommended workflow shape

The recommended launch process is a controlled year-end review, not an
automatic closing journal:

1. identify the approved DEC-06 financial year and its DEC-07 periods;
2. verify that every period in the financial year is closed;
3. run deterministic journal, source, idempotency, and reporting validations;
4. present final P&L, Balance Sheet, Trial Balance, General Ledger,
   comparative, and relevant VAT-context reports;
5. show drafts, unresolved accounting issues, unreconciled bank evidence,
   unallocated payments, and VAT exceptions with business explanations;
6. block the review on genuine accounting or VAT integrity failures, but do
   not turn the DEC-07 warning categories into automatic blockers without a
   specific reason;
7. record the authorised year-end review/approval and its validation snapshot;
8. create the next DEC-06 financial year and its DEC-07 periods according to
   the approved generation rules; and
9. do not create a closing journal unless the selected policy and a separate
   protected posting workflow explicitly require it.

The next financial year may be established without changing historical
journals. A year-end review is not an HMRC filing, VAT-return approval, or
external communication.

### Validation treatment

- **Drafts:** visible warnings; they are not posted accounting history.
- **Unresolved accounting issues:** integrity failures block completion; minor
  review items remain visible with explanation and ownership.
- **VAT issues:** source/evidence integrity failures can block affected
  accounting validation. VAT return timing, approval, and export remain under
  DEC-03 and are not replaced by year-end.
- **Unreconciled banking:** visible evidence warning; bank data does not become
  a year-end posting merely because it is unreconciled.
- **Unallocated payments:** visible warning; year-end must not change
  allocation or invent a settlement treatment.
- **Period state:** all periods must be closed before a year-end review can be
  completed, but year-end does not add another accounting-period state.

## 10. Year-end approval and permissions

Year-end review and any explicit year-end posting are consequential,
company-scoped server-side actions.

The recommended capability separation is:

- **Review/complete year-end:** a named year-end review capability;
- **Create an explicit closing journal:** the matching posting capability plus
  the year-end closing capability;
- **Approve a closing journal:** a separate approval capability where
  segregation of duties applies; and
- **Reopen or correct a closed period:** the DEC-07 elevated reopen or
  correction capability, not a year-end shortcut.

The starting role interpretation is:

- **Owner:** may hold the year-end capabilities subject to validation, audit,
  and segregation controls;
- **Accountant:** may perform or approve only where explicitly assigned the
  relevant capability;
- **Admin:** no default year-end posting or approval authority; any grant must
  be explicit and auditable;
- **Manager:** no year-end mutation or approval authority by default; and
- **Read-only:** no mutation or approval path.

A year-end review may be completed without a closing journal under a
reporting-only policy, but it still requires active membership, company scope,
server-side authorization, appropriate authority, and audit evidence.

## 11. Year-end reversals and corrections

Year-end completion does not make a posted journal mutable. The appropriate
treatment depends on the correction's accounting date and approved policy:

### Expense posted incorrectly

Create an explicit reversal/correction linked to the original source and
journal. If the correction belongs to a closed historical period, use the
DEC-07 controlled reopen path or an approved adjustment in a later open period.
Do not edit the original line or silently move it.

### Invoice omitted

Create and post the omitted source with its validated posting date and
financial-year/period assignment. If the correct date is in a closed year,
follow the controlled historical correction or later-period adjustment policy;
do not change the year-end boundary to accommodate it.

### VAT correction

Use the deterministic DEC-03 VAT evidence and correction process. A year-end
review must not move a transaction between VAT returns, create a second VAT
engine, or treat a VAT adjustment as a retained-earnings entry.

### Prior-year accounting error

Prefer a controlled, source-linked correction in the appropriate open period
when accounting policy says that is the correct treatment. If the accounting
policy requires the original year, require an elevated DEC-07 reopen and a
reasoned, audited correction. A material prior-period adjustment mechanism may
be added only through an explicit accounting policy and must never rewrite
posted history.

Reversal/correction behavior must preserve original source linkage,
idempotency, actor, approval, date, period, financial-year identity, and audit
context.

## 12. Closed years and status model

Avoid introducing a second set of overlapping lifecycle states:

- **Closed accounting period:** the DEC-07 period is `CLOSED`; normal posting
  is rejected.
- **Completed financial year:** a derived condition where all periods in the
  financial year are closed and the year-end review has passed, if the review
  policy requires completion.
- **Year-end process completed:** an auditable year-end review/approval event,
  not a new accounting-period state.
- **Historical financial year:** an immutable DEC-06 financial-year record
  retained for reporting and audit, regardless of whether historical completion
  evidence exists.

The recommended launch model does not create a separate mutable `COMPLETED`,
`FINAL`, or `ARCHIVED` financial-year status. If a future workflow needs to
record review completion, it should use an auditable event with validation
evidence while retaining `OPEN`/`CLOSED` as the period authority.

## 13. Migration

Historical year-end migration must classify evidence without inventing facts:

1. Preserve existing canonical or legacy journals with their original dates,
   sources, and balances.
2. Assign financial-year and period identity using DEC-06/DEC-07 boundaries
   where the authoritative posting date is reliable.
3. Import a historical closing journal only when the source evidence identifies
   its entries, date, accounts, approval/context, and relationship to the
   financial year.
4. Do not create a closing journal because a retained-earnings account exists,
   a report has a prior-year subtotal, or a company description says “year
   ending”.
5. Preserve incomplete, conflicting, or ambiguous year-end information as a
   migration limitation and handle it through DEC-22.
6. Do not invent historical approvals, year-end events, retained-earnings
   balances, dates, journals, or accounting facts.

A legacy closing balance may be carried as explicitly evidenced opening
information only if the migration policy and source support it. It must not be
silently converted into a current-year closing journal.

## 14. Reporting and VAT boundary

### Profit & Loss

Filter canonical posted activity by financial-year identity and posting date.
Reporting-only year-end does not zero the underlying journal. Explicit closing
entries, if later approved, remain visible and are included according to their
posting date and source.

### Balance Sheet

Show permanent account balances as of the selected date. Present current-year
profit, prior-year results, and retained earnings with clear labels identifying
posted versus derived values.

### Trial Balance and General Ledger

Use immutable posted journal lines, stable financial-year/period identity, and
explicit source links. Never make a report subtotal the authority for adding a
missing journal.

### Comparative reports

Compare equivalent financial-year boundaries and disclose partial, migrated,
unresolved, reporting-only, or explicit-closing treatments where relevant.
Historical reports must remain reproducible.

### VAT

DEC-03 remains authoritative. Year-end boundaries may organize accounting
analysis but do not change VAT-box inclusion, VAT return status, invoice-basis
timing, correction evidence, export state, or HMRC filing scope.

## 15. Recorded approval — DEC-08

Lee approved **Option A at launch, designed with the controlled extension seam
from Option D**:

1. Use a reporting-only financial-year boundary initially; do not create an
   automatic closing journal.
2. Keep canonical revenue, cost, expense, asset, liability, and equity
   postings unchanged across the boundary.
3. Represent current-year P&L, prior-year results, and any derived retained
   earnings as traceable report views unless a canonical equity posting
   actually exists.
4. Require all DEC-07 periods in the year to be closed before completing a
   year-end review, while retaining visible warnings for drafts, unallocated
   payments, unreconciled bank evidence, and ordinary VAT timetable differences.
5. Block completion on genuine accounting or VAT integrity failures.
6. Record a server-side, company-scoped, capability-authorised year-end review
   event with validation snapshot, reports/context, warnings, approver, actor,
   result, and timestamp.
7. Establish the next DEC-06 financial year and DEC-07 periods without
   rewriting prior history.
8. Handle post-year-end errors through explicit linked corrections, controlled
   reopen, or an approved later-period adjustment; never through mutation or
   silent reclassification.
9. Add an explicit closing-journal workflow only through a later approved
   policy that defines source, accounts, posting date, period, idempotency,
   approval, reversal, and audit behavior.

This approved policy best fits the DEC-04 canonical journal architecture,
preserves historical immutability, avoids inventing unsupported legacy
closures, and remains practical for small businesses. It does not authorise
implementation.

## 16. What DEC-08 locks in

The approved policy locks in:

1. reporting-only year-end treatment at launch, with no automatic closing
   journal;
2. canonical journal continuity across financial years;
3. distinct permanent-account and temporary-account reporting behavior;
4. traceable, non-authoritative derived retained-earnings presentation where no
   posting exists;
5. closed-period completion as a prerequisite for a completed year-end review;
6. visible warnings versus integrity blockers as described above;
7. a server-side, company-scoped, audited year-end review action;
8. creation of the next approved financial year without rewriting history; and
9. explicit corrections/reopen/adjustment paths for post-year-end errors.

Approval would not authorise implementing any of these items.

## 17. What remains changeable after approval

The following could be amended through the Living Product Decisions process:

- adoption of an explicit approved closing journal for future companies or
  future years;
- the exact year-end review checklist and warning presentation;
- account mappings and protected retained-earnings treatment under DEC-09 and
  DEC-10;
- country-specific statutory closing requirements;
- presentation of derived versus posted retained earnings, provided the
  distinction remains clear; and
- the historical migration and cutover policy under DEC-22.

No amendment may delete, rewrite, or silently reclassify historical posted
journals or invent unsupported legacy year-end events.

## 18. Decisions that remain outside DEC-08

DEC-10 onward must separately decide:

- active control-account mappings, configuration versioning, and detailed
  retained-earnings treatment;
- payments, allocations, refunds, overpayments, and payment-on-account;
- retention, deletion, export, backup/recovery, and RLS;
- historical migration cohort, cutover, and legacy authority retirement;
- future markets, currencies, and specialist VAT schemes; and
- implementation task assignment, physical schema, API, UI, testing sequence,
  deployment, and publishing.

DEC-08 uses DEC-06 financial-year boundaries and DEC-07 period state but does
not amend either decision.

## 19. Decision readiness

**DEC-08 approval is recorded.** It is a product/accounting-policy approval
only and is not implementation authorisation.

The approval does not authorise:

- year-end closing-journal or retained-earnings-posting implementation;
- year-end workflow or completed-year-status implementation;
- code, schema, migration, UI, workflow, dependency, deployment, or
  publishing work; or
- an implementation task.

BL-06 and BL-07 remain **BLOCKED**. DEC-09 is approved; DEC-10 and all later
decisions remain untouched and unresolved.

**DEC-08:** **APPROVED — product/accounting policy only**
**DEC-09:** **APPROVED — Chart of Accounts and Default Account Policy**
**DEC-10 onward:** **NOT STARTED; REQUIRES USER DECISION**
**BL-06 / BL-07:** **BLOCKED**
**Application code changed by this review:** **NO**
**Database or migrations changed by this review:** **NO**