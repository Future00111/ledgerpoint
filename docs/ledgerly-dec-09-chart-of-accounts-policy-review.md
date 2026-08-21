# DEC-09 Chart of Accounts and Default Account Policy Review

**Decision:** DEC-09 — Chart of Accounts and Default Account Policy
**Status:** **APPROVED — product/accounting policy only**
**Review date:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting, security,
and architecture review
**Implementation authority:** None

> This records an approved product/accounting policy. It does not approve
> DEC-10, an implementation task, code, schema, migration, UI, workflow,
> dependency, deployment, or publishing work.

## 1. Purpose and decision question

DEC-09 must establish a practical UK small-business Chart of Accounts policy
without making the chart an uncontrolled substitute for accounting logic.

The decision must determine:

1. whether Ledgerpoint provides a default chart and how it is created;
2. account types, classifications, names, codes, and optional hierarchy;
3. which accounts are system/default/user-created/inactive/historical;
4. safe account customisation, deactivation, deletion, and merge behavior;
5. reporting classification and current operational compatibility;
6. the boundary between a protected chart and DEC-10 control-account mappings;
7. DEC-05 capability treatment; and
8. evidence-based migration of current accounts and account references.

Account names and codes are user-facing labels. They must never be the sole
source of posting logic, VAT logic, reporting classification, or historical
meaning. Canonical accounting must use stable account identity, explicit
classification, and approved source/mapping configuration.

## 2. Existing evidence and compatibility baseline

The current `chart_of_accounts` data model is a starting point, not a canonical
chart policy. It currently provides company ownership, optional code,
name, type/subtype, description, and an active flag, but does not establish
company-code uniqueness, immutable account identity, reporting classification,
system/default protection, control role, parent grouping, configuration
versioning, capability boundaries, or audit behavior.

The current seed creates a broad chart with bank/cash, receivables, inventory,
prepayments, fixed assets, liabilities, VAT, equity, retained earnings, revenue,
cost of sales, and operating expenses. It is useful compatibility evidence, but
it does not prove that all corresponding product areas are supported. In
particular, inventory, payroll, fixed assets, and corporation tax must not be
implied as launch accounting workflows merely because named seed accounts exist.

Existing reports and journal views often group values using account codes. AI
account-learning and suggestion records also retain account IDs, names, and
codes. These are not authoritative mapping controls. They demonstrate why
historical code/name changes or guessed account migration could make reports,
explanations, and suggestions inconsistent.

The existing account seed includes an account named “Retained Earnings.” Under
DEC-08 this is not evidence of an automatic year-end posting, closing journal,
or retained-earnings balance. It must not be given those meanings without a
separately approved canonical source and mapping policy.

## 3. Decision labels and existing authority

### ALREADY DECIDED

- **DEC-01:** Governance and Master Backlog authority order.
- **DEC-02:** UK/GBP-oriented small-business accounting direction; future
  markets and currencies remain open.
- **DEC-03:** Standard invoice-basis VAT policy and deterministic VAT evidence;
  the chart must not create a second VAT engine.
- **DEC-04:** Canonical append-only journals, server-side double-entry,
  immutable posted history, source linkage, idempotency, and
  journal-authoritative reporting.
- **DEC-05:** Active company membership, company scope, server-side capability,
  and audit are authoritative. Posted journals cannot be edited or deleted.
- **DEC-06:** Financial-year identity is company-scoped and historical
  assignments cannot be silently rebased after posting.
- **DEC-07:** Monthly periods, `OPEN`/`CLOSED` lifecycle, and controlled
  close/reopen behavior are approved.
- **DEC-08:** Reporting-only year-end: no automatic closing or
  retained-earnings transfer journals; reports remain subordinate to canonical
  history.

### APPROVED DECISION

DEC-09 approves the policy in section 16, including:

- a versioned UK small-business template copied to each company;
- the recommended account taxonomy, numbering ranges, and launch account list;
- system/default/user-created account treatment;
- safe user customisation and no destructive deletion after historical use;
- no account merging at launch; and
- explicit reporting-classification and capability boundaries.

### DELIBERATELY LEFT OPEN

DEC-09 does not decide:

- mandatory AR, AP, bank/cash, VAT, revenue, expense, equity, or other
  control-account mappings and remapping rules (DEC-10);
- effective-dated configuration and mapping versioning (DEC-11);
- source freshness, overpayments, unapplied cash, refunds, or
  payment-on-account treatment (DEC-12 through DEC-16);
- retention, deletion/anonymisation, export, backup/recovery, and RLS
  policies (DEC-17 through DEC-21);
- migration cohort, cutover, rollback, or legacy-authority retirement
  (DEC-22);
- physical schema, routes, UI, or implementation sequence;
- inventory, payroll, fixed-asset, corporation-tax, or international accounting
  workflows not otherwise approved; or
- an implementation task.

## 4. Default chart options

### Option A — Minimal Ledgerpoint-owned chart

Provide a small fixed list of accounts shared by every company, with little or
no company customisation.

**Accounting consequences:** Simple defaults but poor fit for legitimate
company-specific revenue, expense, and equity needs. A global account list can
encourage unsafe use of the same label for different accounting purposes.

**Data and migration consequences:** Lowest initial data complexity, but
company-specific legacy accounts require lossy mapping or exceptions.

**Reporting and security consequences:** Easy uniform reporting, but weak
explanation for customised businesses. Central changes could affect every
company and would need unusually strong governance.

**Compatibility and flexibility:** Inflexible for future markets, currencies,
and reporting needs. Changing the global list later risks changing meaning
across companies.

### Option B — Versioned UK small-business template copied to each company

Provide a curated template at company setup. Each company receives its own
stable account records, with controlled user customisation and explicit
protection for system/default accounts.

**Accounting consequences:** Provides useful defaults while preserving
company-specific account identity and clear source/reporting classification.

**Data and migration consequences:** Requires a template version and company
copy provenance. Existing accounts can be mapped to template accounts only with
evidence; exceptions remain visible.

**Reporting and security consequences:** Reports use stable type and reporting
class rather than code/name ranges. Company-specific chart changes are scoped,
capability-controlled, and auditable.

**Compatibility and flexibility:** Supports controlled additions and future
templates without forcing a universal chart. A template upgrade must be
future-effective and must not reinterpret historical journals.

### Option C — User-created chart only

Start each company with no meaningful default and require the business to build
its own chart and mappings.

**Accounting consequences:** Maximum freedom but high setup risk and poor
small-business usability. It makes safe invoice, bill, VAT, bank, and reporting
defaults harder to provide.

**Data and migration consequences:** Compatible with arbitrary legacy charts,
but mapping quality varies widely and missing setup can block normal operations.

**Reporting and security consequences:** Requires extensive validation and
support. Users can create classifications that make reports inconsistent unless
the product constrains them heavily.

**Compatibility and flexibility:** Flexible but does not deliver the intended
UK small-business launch experience.

## 5. Recommended account taxonomy and default chart

The recommended foundation is **Option B**: a versioned UK small-business
template copied into each company. It should be practical rather than a
complete textbook chart.

### 5.1 Account types and reporting classes

Every account should have one stable primary type:

| Primary type | Normal reporting role | Examples |
| --- | --- | --- |
| `ASSET` | Balance Sheet | Bank/cash, Accounts Receivable, prepayments, recoverable input VAT |
| `LIABILITY` | Balance Sheet | Accounts Payable, output VAT payable, loans |
| `EQUITY` | Balance Sheet | Owner capital/share capital, posted retained earnings where evidenced |
| `REVENUE` | Profit & Loss | Sales revenue, other operating income |
| `COST_OF_SALES` | Profit & Loss | Direct cost of goods/services where supported |
| `EXPENSE` | Profit & Loss | Rent, utilities, professional fees, bank charges |

VAT accounts should use their underlying asset or liability nature and an
explicit VAT-related reporting/control classification where later mapping policy
requires it. Do not make a separate top-level `TAX` account type the source of
VAT calculation or return treatment; DEC-03 remains authoritative.

Each account should also have an explicit reporting class/subclass, such as
current asset, fixed asset, current liability, long-term liability, capital,
operating income, other income, direct cost, or operating expense. Reporting
must use these classifications and stable identifiers, not account code ranges
or account-name text.

### 5.2 Recommended numbering convention

Use optional, human-readable, company-scoped four-digit codes as a template
convention:

| Range | Family | Launch purpose |
| --- | --- | --- |
| 1000–1999 | Assets | Cash/bank, receivables, VAT recoverable, prepayments, optional assets |
| 2000–2999 | Liabilities | Payables, VAT payable/settlement, loans, other liabilities |
| 3000–3999 | Equity | Capital/share capital, posted retained earnings where evidenced |
| 4000–4999 | Revenue | Sales and other income |
| 5000–5999 | Cost of Sales | Direct costs where product scope supports them |
| 6000–6999 | Operating Expenses | Ordinary UK small-business expenses |
| 7000–7999 | Reserved/other income and expense | Future-approved optional reporting use |

The code is not the account’s durable identity or accounting logic. The stable
company account identifier, primary type, reporting class, and approved mapping
are authoritative. Codes should be unique within a company when present, but
the system must not infer accounting treatment from a range alone.

### 5.3 Practical default account list

The initial template should include a concise minimum set:

| Family | Suggested accounts |
| --- | --- |
| Asset | Cash on Hand; Bank Clearing; Accounts Receivable; Other Receivables; Input VAT Recoverable; Prepayments |
| Liability | Accounts Payable; Output VAT Payable; VAT Settlement/Control; Loans and Other Liabilities |
| Equity | Owner/Share Capital; Retained Earnings/Accumulated Results (presentation or evidenced posting only) |
| Revenue | Sales Revenue; Other Income |
| Cost of Sales | Cost of Sales |
| Expense | Wages and Salaries; Rent and Rates; Utilities; Telephone and Internet; Marketing; Professional Fees; Travel; Office Supplies; Bank Charges; Depreciation; General Expenses |

Optional accounts for fixed assets, accumulated depreciation, inventory,
corporation tax, payroll liabilities, and deferred income may be available only
as clearly optional template extensions. Their presence must not claim that the
corresponding workflow, tax treatment, or automation is supported at launch.

### 5.4 Parent and child grouping

Support an optional single parent/group relationship for report organisation,
such as “Operating Expenses” above individual expenses. A parent must not be a
posting shortcut, a replacement for reporting classification, or a way to
change historical journal meaning. Multi-level trees, consolidation, and
cross-company hierarchy are outside DEC-09 launch policy unless later approved.

## 6. System, default, user-created, inactive, and historical accounts

### System accounts

System accounts are protected account records that the product needs to support
approved accounting boundaries. Candidate system accounts include AR, AP,
bank/cash clearing, input/output VAT, VAT settlement, and any posted
retained-earnings account. Their exact assignment to control roles remains
DEC-10.

System accounts:

- cannot be physically deleted;
- cannot be manually posted to where a protected source workflow is required;
- cannot be changed into another primary type or reporting class;
- cannot be deactivated while an active required mapping uses them; and
- require elevated, audited authority for any permitted metadata change.

### Default accounts

Default accounts are template-provided ordinary accounts that are not inherently
system-protected. Companies may rename, deactivate, or replace them subject to
usage and mapping validation. A template label never overrides company-specific
stable identity.

### User-created accounts

Companies may create ordinary accounts within the approved primary types and
reporting classes. A user-created account cannot declare itself a control/system
account merely through its name, code, or category.

### Inactive and historical accounts

Use only `ACTIVE` and `INACTIVE` as account availability states. “Historical”
is a derived condition: an inactive account remains visible in historical
journals, reports, audit trails, and migration evidence because it has
references. “System” is a protection role, not an availability state.

This avoids unnecessary `ARCHIVED`, `CLOSED`, or `DELETED` lifecycle states
while preserving historical references.

## 7. User customisation and lifecycle safety

### Recommended allowed actions

| Action | Ordinary unused account | Ordinary referenced account | System/control candidate |
| --- | --- | --- | --- |
| Create | Allowed with chart-management capability | Not applicable | Only through controlled setup/mapping policy |
| Rename | Allowed and audited | Allowed as metadata if historic display preserves the recorded journal account identity | Elevated, limited, audited |
| Change code | Allowed if unique and no active mapping ambiguity | Future-effective only; historical journal meaning must not change | Elevated; generally prohibited if it is a control reference |
| Change primary type/reporting class | Allowed only before use and validation | Prohibited; use a replacement account | Prohibited |
| Deactivate | Allowed if no active required use | Allowed only after replacement/remapping validation | Prohibited while required by an active mapping |
| Reactivate | Allowed and audited | Allowed and audited | Elevated and audited |
| Delete | Allowed only if truly unused and unreferenced | Prohibited | Prohibited |
| Merge | Not at launch | Not at launch | Prohibited |

The product should show a replacement target when an account is deactivated,
but it must not silently rewrite historic journals, VAT evidence, documents,
payments, reports, or AI learning records to the replacement account.

### Deletion

An account referenced by posted journals, VAT evidence, invoices, bills,
payments, bank evidence, reports, account-learning data, or approved mappings
must never be physically deleted. If an unreferenced draft/setup account can be
deleted, the server must prove it has no historical or configuration reference.

### Merging

Do **not** support account merging at launch. A “merge” that rewrites historic
journal lines violates DEC-04. A future merge capability would need to be a
forward-only replacement/alias policy with explicit report presentation, audit,
mapping version, and migration treatment. It belongs outside DEC-09 launch
policy.

## 8. Reporting classification and year-end

Every account must map through explicit type and reporting classification to:

- Profit & Loss;
- Balance Sheet;
- Trial Balance;
- General Ledger; and
- VAT analysis where an approved VAT-related account role applies.

Reports must query the canonical journal joined to stable account identity and
classification. They must not assume that “4xxx means revenue,” infer a report
section from a display name, or group balances in browser code by a fragile
seed code.

DEC-08 remains authoritative for year-end:

- revenue, cost of sales, and expense accounts are temporary for reporting;
- asset, liability, and equity accounts continue across years;
- a retained-results account may display posted equity only where a canonical
  posting exists; and
- the chart must not create an automatic closing or retained-earnings transfer
  journal merely to make a report presentation look complete.

## 9. Invoice, bill, payment, credit-note, and VAT support

The default chart must make the following future canonical postings possible,
without defining the mandatory mapping authority that belongs to DEC-10:

| Source | Required account roles | DEC-09 role |
| --- | --- | --- |
| Sales invoice | AR, revenue, output VAT | Provide type/class-compatible chart candidates |
| Supplier bill | AP, expense or asset, input VAT | Provide type/class-compatible chart candidates |
| Customer payment | Bank/cash, AR | Provide compatible candidates; do not implement allocation logic |
| Supplier payment | AP, bank/cash | Provide compatible candidates; do not implement allocation logic |
| Credit note | Corresponding reversal/reduction roles | Provide compatible candidates; preserve source-link requirements |
| Bank categorisation | Bank/cash and selected income/expense/asset/liability account | Provide ordinary selectable categories without turning AI suggestions into posting authority |

DEC-10 must decide the mandatory company-scoped mapping list, whether one or
multiple accounts may serve a control role, mapping validation, remapping,
effective dates, and the configuration snapshot required on a posting. DEC-09
does not approve a particular AR, AP, VAT, bank, revenue, expense, or equity
account as a company’s active control mapping.

For VAT, the chart supplies account candidates and reporting classifications
only. It must not calculate VAT, infer VAT return boxes from account names, or
override DEC-03 source-linked VAT evidence.

## 10. Permissions under DEC-05

Recommended server-side capabilities:

| Action | Capability boundary |
| --- | --- |
| View chart and historic account information | Company read capability |
| Create/revise ordinary unreferenced account | Chart-management capability |
| Rename/reactivate/deactivate ordinary account | Chart-management capability plus validation and audit |
| Change code or reporting metadata on referenced account | Elevated chart-management capability, future-effective treatment, audit |
| Change a system account or protected classification | Elevated system-account capability; DEC-10/DEC-11 controls where applicable |
| Delete unreferenced setup account | Elevated chart-management capability plus server-side reference check |
| Change control mapping | Outside DEC-09; DEC-10 capability and approval policy |

Capability checks require active membership and company scope. UI visibility is
not authority. Owners, Admins, Accountants, Managers, and Read-only users
receive only the capabilities explicitly granted under DEC-05; role names alone
must not bypass a protected chart boundary.

## 11. Migration and compatibility

Historical account migration must be evidence-based:

1. Preserve stable source account IDs, codes, names, type/subtype, and company
   context where available.
2. Map to a proposed template account only when code, source metadata, mapping
   documentation, and accounting purpose give sufficient evidence.
3. Do not map solely because two account names look similar.
4. Preserve an ambiguous account as a legacy account or migration exception.
5. Preserve existing journal account references and report evidence; do not
   rewrite them merely to make the template look uniform.
6. Treat existing code/name-only AI learning and suggestion records as
   compatibility evidence that may need explicit review, not as an authority to
   select a canonical account.
7. Do not create historical control mappings, VAT treatment, account merges,
   retained-earnings postings, or account history without evidence.

DEC-22 remains responsible for migration cohort, cutover, rollback, and
legacy-authority retirement.

## 12. Future markets, currencies, and chart evolution

The UK template is a launch default, not a global assumption. The account
model should keep:

- company-scoped chart ownership;
- stable identifiers independent of language and display code;
- explicit primary type and reporting classification;
- optional currency-policy metadata when future scope needs it;
- template version/provenance; and
- controlled future-effective amendments.

DEC-09 does not implement multi-currency, localization, country tax systems, or
international reporting. It only prevents the chart policy from making those
future decisions needlessly impossible.

## 13. Material option comparisons

### Account codes

| Option | Consequences |
| --- | --- |
| Numeric range convention | Readable UK-style reporting and room for expansion; must not become accounting logic; code migrations remain display/configuration changes rather than journal rewrites. |
| Semantic codes | Easier to read but less compatible with conventional UK imports and harder to localize; still cannot be used as logic. |
| No codes | Simplifies setup but weakens report navigation, migration comparison, and accountant familiarity. |

### System-account treatment

| Option | Consequences |
| --- | --- |
| Protected company-scoped system records | Best balance: source/mapping safety, explicit audit, future template flexibility, and no global cross-company mutation. |
| One immutable global system chart | Uniform but incompatible with company-specific chart ownership and future markets. |
| Fully user-editable system accounts | Unsafe: mappings, VAT, AR/AP, bank, and reporting can silently diverge. |

### Customisation and deletion

| Option | Consequences |
| --- | --- |
| Controlled custom accounts; deactivate after use | Supports business needs while retaining historical report and journal meaning. Requires capability/audit validation. |
| No customisation | Simple but unsuitable for small-business variation and migration. |
| Free edit/delete/merge | High corruption and audit risk; historic references and report classifications become unreliable. |

### Reporting classification

| Option | Consequences |
| --- | --- |
| Stable explicit type/classification | Journal-authoritative, testable, code/name independent, and compatible with future reporting. |
| Account-code range inference | Familiar but fragile under custom codes, migration, and future markets. |
| Account-name inference | Unsafe and incompatible with renaming, localization, and audit. |

## 14. DEC-10 and DEC-11 boundaries

### DEC-10 — Mandatory control-account mappings

DEC-10 must decide:

- the mandatory company mappings for AR, AP, bank/cash, input/output VAT,
  VAT settlement, revenue, expense, equity, and other control roles;
- whether a company may have multiple accounts for each role;
- validation by type/classification;
- mapping-change authority and approval; and
- how a source resolves the applicable control mapping.

DEC-09 may protect candidate system accounts and define their type/class
compatibility, but does not choose which account is currently mapped to each
role.

### DEC-11 — Account configuration versioning

DEC-11 approves:

- immutable, company-scoped, effective-dated configuration for material
  posting behavior;
- posting-time retention of configuration and resolved-account context;
- future-only changes with no ordinary backdating over posted journals or
  closed periods; and
- evidence-based unknown markers where historic configuration cannot be proven.

DEC-09 defines the safety need for stable identity and non-rewritten history,
while DEC-11 provides the approved configuration-versioning mechanism.

## 15. Approved DEC-09 policy

DEC-09 approves:

1. a versioned UK small-business template copied into each company;
2. the six primary account types and explicit reporting classifications;
3. company-scoped optional numeric codes with stable identifiers independent of
   code/name;
4. a concise default list plus clearly optional extensions;
5. system/default/user-created/inactive/historical distinctions;
6. controlled customisation, no destructive deletion after use, and no
   launch-time account merging;
7. report classification independent of frontend and code/name assumptions;
8. DEC-08-compatible retained-results presentation with no automatic
   year-end journal; and
9. evidence-based account migration.

This approval does not authorise implementation.

## 16. APPROVED POLICY

Ledgerly approves:

1. adopts **Option B**, a versioned UK small-business chart template copied into
   each company;
2. uses the six primary types: Asset, Liability, Equity, Revenue, Cost of
   Sales, and Expense, plus explicit reporting classes;
3. uses company-scoped four-digit numeric code ranges as readable conventions,
   while stable account identity and classification—not names or codes—drive
   accounting and reports;
4. starts with the practical account list in section 5.3 and offers optional
   extensions only without claiming unsupported product workflows;
5. identifies AR, AP, bank/cash, VAT, VAT settlement, and applicable posted
   retained-results accounts as protected system-account candidates, while
   leaving active control mapping to DEC-10;
6. permits controlled creation and metadata customisation of ordinary accounts,
   but prohibits primary-type/class changes after use, destructive deletion
   after any reference, and account merging at launch;
7. uses `ACTIVE` and `INACTIVE` availability states, with historical/system as
   derived/protection roles rather than extra lifecycle states;
8. requires DEC-05 active membership, company scope, capability checks,
   validation, and audit for chart changes;
9. preserves all historical references and treats ambiguous legacy accounts as
   migration exceptions; and
10. keeps DEC-03 VAT, DEC-08 reporting-only year-end, DEC-10 control mappings,
    and DEC-11 configuration versioning as separate authorities.

This approved policy balances useful UK defaults, small-business usability,
canonical accounting integrity, auditability, and future extensibility.

## 17. What remains changeable after approval

The Living Product Decisions process can amend:

- future template versions and optional account extensions;
- account display names, codes, and non-destructive reporting categories;
- future localization, currencies, markets, and reporting requirements;
- a future forward-only account replacement/alias model;
- explicit retained-earnings posting policy; and
- capability presets, provided the DEC-05 server-side protection boundary
  remains intact.

No amendment may reinterpret, delete, or silently remap historical posted
journals, VAT evidence, financial-year assignments, or source links.

## 18. Decision readiness

DEC-09 was explicitly approved on 2026-08-21 with the policy in section 16.

DEC-10, DEC-11, DEC-12, and DEC-13 are approved in their separate policy
reviews. DEC-14, DEC-15, DEC-16, DEC-17, DEC-18, DEC-19, and DEC-20 are approved and DEC-21 and all later decisions remain unresolved. Until the applicable remaining decisions
are approved or amended:

- no canonical chart/account policy, system-account protection, account
  lifecycle, control mapping, or account configuration versioning may be
  implemented;
- BL-06 and BL-07 remain **BLOCKED**; and
 - DEC-21 and all later decisions remain untouched and unresolved.

**DEC-09:** **APPROVED — product/accounting policy only**
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