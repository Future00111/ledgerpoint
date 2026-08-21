# DEC-10 Control-Account Mapping Policy Review

**Decision:** DEC-10 — Control-Account Mappings
**Status:** **APPROVED — product/accounting policy only**
**Review date:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting, security,
and architecture review
**Implementation authority:** None

> This records an approved product/accounting policy. It does not approve
> DEC-11, an implementation task, code, schema, migration, UI, workflow,
> dependency, deployment, or publishing work.

## 1. Purpose and decision question

DEC-10 must establish how Ledgerly selects and protects company-scoped accounts
for system-controlled accounting flows. It must make those flows deterministic
without treating an account name, code, category, or browser selection as
accounting authority.

This review distinguishes:

- **account identity** — the stable company account record used by a journal
  line;
- **account classification** — the approved primary type and reporting class;
- **control-account role** — a named accounting function with validated
  eligibility, such as AR, AP, or input VAT;
- **transaction/posting mapping** — the resolved account IDs a canonical source
  posting uses;
- **ordinary user-configurable accounts** — compatible revenue, cost, expense,
  asset, or liability accounts selected for an allowed business purpose; and
- **system-protected accounts** — accounts currently assigned to a protected
  control role or otherwise protected under DEC-09.

The current broad account seed, generic account references, bank-feed records,
and AI category suggestions are compatibility evidence only. They do not
constitute approved mappings or a canonical posting design.

## 2. Existing authority and evidence

### Already decided

- **DEC-03:** Standard-scheme invoice-basis VAT is the sole VAT authority.
  Output and input VAT arise from approved source/tax evidence, not payment or
  bank settlement. VAT adjustments are controlled and source-linked or
  return-level; Ledgerly does not gain a second VAT engine through mapping.
- **DEC-04:** Canonical journals are append-only, source-linked, balanced,
  server-side, and immutable after posting. Payments, allocations, and bank
  evidence are distinct. Reporting is journal-authoritative.
- **DEC-05:** Consequential accounting configuration requires active membership,
  company scope, server-side capability enforcement, and audit evidence. A role
  label or hidden UI is never authority.
- **DEC-06 and DEC-07:** Financial-year and monthly-period identity are
  server-assigned and cannot be silently rebased or bypassed.
- **DEC-08:** Year-end is reporting-only. No automatic closing journal or
  retained-earnings transfer follows from a control mapping.
- **DEC-09:** Each company receives a versioned UK small-business chart with
  stable account identity, explicit classification, controlled lifecycle, and
  protected-system-account candidates. It deliberately leaves active control
  mappings to DEC-10.

### Existing compatibility evidence

The legacy seed includes accounts labelled Accounts Receivable, Accounts
Payable, Bank Accounts, VAT Liability, Sales Revenue, operating expenses, and
Retained Earnings. It does not include authoritative control-role assignment,
input/output VAT separation, per-bank ledger mapping, source-version
snapshots, or account-configuration history.

The existing architecture review describes the following future canonical
templates:

```text
Sales invoice:     DR AR / CR revenue / CR output VAT
Supplier bill:     DR expense or asset / DR input VAT / CR AP
Customer payment:  DR bank or cash / CR AR
Supplier payment:  DR AP / CR bank or cash
```

These templates are architecture evidence, not implemented behavior. Existing
bank transactions are evidence records linked to a bank-account record, and
existing AI reconciliation data can contain a suggested category account. Neither
is a canonical accounting posting nor authority to select a control mapping.

## 3. Control-account model

A **control account** is a company-scoped account assigned to a defined,
system-enforced accounting role because the role must reconcile to a source,
subledger, tax evidence, or cash location. A control account is not simply an
account frequently used by the business.

### Roles that should be protected

| Role | Why system protection is needed | Eligible classification |
| --- | --- | --- |
| Accounts Receivable (AR) | Must reconcile customer open items, allocations, aged receivables, and journal balances. | Asset / receivable class |
| Accounts Payable (AP) | Must reconcile supplier open items, allocations, aged payables, and journal balances. | Liability / payable class |
| Accounting bank/cash account | Must reconcile a specific cash location or bank account to postings and bank evidence. | Asset / cash or current-asset class |
| Output VAT | Must receive source-derived sales VAT and reconcile to VAT evidence and returns. | Liability / VAT-payable class |
| Input VAT | Must receive recoverable purchase VAT and reconcile to VAT evidence and returns. | Asset / VAT-recoverable class |
| VAT settlement/control | Must be protected if an approved VAT return settlement, payment, or refund source needs a net VAT balance role. | Validated asset or liability VAT-settlement class |

AR, AP, bank/cash, and output/input VAT genuinely require system-controlled
treatment because they connect to subledgers, cash-location evidence, or
DEC-03 tax evidence. VAT settlement is a protected role only where an approved
VAT-return settlement workflow requires it; this review does not create that
workflow.

### Roles that should not be universal control accounts

Revenue, cost of sales, ordinary expenses, ordinary assets, and general equity
are not one-size-fits-all control accounts. They should be selected from
compatible company accounts for an approved source line or be offered through
controlled company defaults. Their selection must be validated, recorded on
the posting, and never inferred from a name or code.

Retained-results/equity must not be a general default mapping at launch. Under
DEC-08, it is presentation or an evidenced explicit posting only; it is not a
target for automatic year-end closing.

## 4. Mapping policy by accounting flow

### Accounts Receivable

One active AR control role is required per company for launch. A sales invoice
posts its gross receivable to that protected account. A sales credit note
reduces the same AR relationship through a source-linked reversal or reduction.
Customer payments credit AR through the allocation/open-item model; the cash
receipt and allocation must remain distinguishable. Any future customer refund
must retain an explicit source and allocation relationship.

AR protection preserves the ability to reconcile invoices, credit notes,
payments, outstanding balances, aged receivables, the AR subledger, trial
balance, general ledger, and balance sheet to the same canonical journal
evidence.

### Accounts Payable

One active AP control role is required per company for launch. A supplier bill
posts its gross payable to that protected account. A supplier credit note
reduces the linked AP relationship. Supplier payments debit AP through the
allocation/open-item model; a refund must remain source-linked rather than
becoming a free-standing alternative accounting path.

AP protection preserves the relationship among bills, credits, payments,
outstanding balances, aged payables, the AP subledger, trial balance, general
ledger, and balance sheet.

### Bank and cash

Every accounting bank or cash location used for canonical cash postings should
map to exactly one eligible protected asset account. A bank account can have
bank-feed evidence, manual-import evidence, or no external feed; the evidence
does not itself post to the ledger. The mapping connects a validated canonical
posting to the cash location that its evidence or payment identifies.

A transfer is not revenue or expense. It requires separate, linked postings to
the two mapped bank/cash accounts and must not be represented by one generic
bank category. The exact transfer lifecycle remains subject to the applicable
banking and payment decisions.

### VAT

Output VAT and input VAT require separate protected roles, each validated
against its underlying liability or asset classification. Canonical source
posting consumes the DEC-03 deterministic VAT result and records traceable
tax/source evidence. It must not select a VAT account from an account label,
code, bank category, or AI recommendation.

For standard-rated and reduced-rated supported sales, output VAT uses the
resolved output-VAT role. For recoverable VAT on supported bills, input VAT
uses the resolved input-VAT role. Zero-rated, exempt, outside-scope, and
explicit no-VAT treatment creates no ordinary input/output VAT line unless
DEC-03's approved tax evidence requires one. VAT adjustments and VAT-return
settlement/payment/refund remain controlled DEC-03 actions; this review only
requires compatible, protected chart roles for them.

## 5. Source templates and allocation boundary

The recommended future source templates are:

```text
Normal sales invoice
  DR resolved AR control account                 gross
  CR resolved compatible revenue account(s)      net
  CR resolved output-VAT control account         VAT where DEC-03 applies

Normal supplier bill
  DR resolved compatible expense/asset account(s) net
  DR resolved input-VAT control account           recoverable VAT where DEC-03 applies
  CR resolved AP control account                  gross

Customer payment
  DR resolved bank/cash control account
  CR resolved AR control account

Supplier payment
  DR resolved AP control account
  CR resolved bank/cash control account
```

Credit notes reverse or reduce the corresponding source roles through the same
canonical posting service. They do not create a second path around AR, AP, VAT,
or source linkage.

Allocations link the settled amount to eligible open items. They cannot change
the payment total, bank evidence, applied account IDs, VAT result, or posted
journal history. DEC-12 through DEC-16 must still decide source freshness,
overpayments, unapplied cash, refunds, and payment-on-account scope. This
review does not decide those edge cases.

## 6. User customisation and mapping protection

Companies may, within DEC-09 and DEC-05 limits:

- choose compatible revenue, cost, expense, or asset accounts for a source line;
- maintain controlled defaults for such ordinary accounts;
- add eligible bank/cash locations and map each to an eligible ledger account;
- replace a control mapping prospectively through the protected workflow; and
- deactivate an ordinary account only after validation confirms it is not an
  active required mapping.

Companies may not:

- choose an incompatible account class for AR, AP, bank/cash, input VAT, or
  output VAT;
- map an account merely because its name or code looks correct;
- deactivate or delete an account used by an active required control mapping;
- change a mapping in a way that rewrites prior journals, historical VAT,
  AR/AP balances, or reporting; or
- use a user-created account name/category to self-declare a system role.

Mapping changes require an elevated accounting-configuration capability under
DEC-05, active company membership, company scope, server-side validation, a
reason, and durable audit evidence. The final capability identifier and any
separation-of-duties rule remain implementation design details within DEC-05's
approved model.

## 7. Posted history and configuration versioning

A mapping change is future-only. Each canonical posting retains the resolved
stable account IDs and sufficient configuration context to reproduce its
accounting meaning. No remap may rewrite journals, reclassify historic
transactions, alter historic VAT results, change historic AR/AP balances, or
restyle historical reports as though a newer mapping had applied.

DEC-10 should decide the future-only semantic rule and the mandatory mapping
roles. **DEC-11 remains responsible** for the complete physical/versioning
policy: immutable versus effective-dated configuration records, version
identity, effective-date validation, snapshots, historical unknown markers,
and the precise posting reference contract. A configuration version or
effective-from reference is expected to be necessary; this review does not
approve its implementation.

## 8. Reporting and migration

Control mappings support, but do not replace, journal-authoritative reporting:

- Profit & Loss relies on resolved revenue, cost-of-sales, and expense journal
  lines and approved classifications.
- Balance Sheet and Trial Balance show the balances of stable account IDs,
  including AR, AP, bank/cash, VAT, and equity roles.
- General Ledger drills into canonical journal/source evidence.
- Aged receivables and payables reconcile control-account postings to open-item
  and allocation data.
- VAT reporting reconciles tax-coded posted lines and DEC-03 evidence to the
  VAT roles; it does not infer VAT from account names.
- Bank reconciliation compares bank evidence, cash-location mappings, and
  canonical postings without treating a feed row as a journal.
- Payment reporting joins payments and allocations to their resolved cash and
  AR/AP roles.

Migration must be evidence-based per company. Existing account code, name,
category, bank-account reference, source documents, journal lines, and
historical reconciliation evidence can support a proposed mapping only when
their accounting purpose is sufficiently clear. Missing or contradictory
evidence must remain an explicit DEC-22 migration exception; it must not
produce invented AR, AP, VAT, bank, or historical posting relationships.

## 9. Options

### Option A — One global fixed mapping set

All companies use the same global accounts and mappings.

- **Consequences:** It simplifies initial operations and reporting, but conflicts
  with DEC-09 company-owned chart identity and makes migration, custom
  businesses, future markets, and bank-specific cash locations difficult.
- **Security and compatibility:** Central changes would be high-impact across
  companies, while legacy company charts would require lossy translation.
- **Change cost:** Replacing a global role later risks broad compatibility and
  reporting disruption.

### Option B — Fully mutable company configuration

Each company chooses any current account for any mapping and can edit it in
place.

- **Consequences:** It offers maximum flexibility but lets an unsafe edit alter
  future accounting without sufficient validation or audit context.
- **Security, reporting, and migration:** It weakens AR/AP/VAT integrity,
  complicates reproducible reports and historical migration, and turns
  operational support into a company-by-company reconstruction exercise.
- **Change cost:** Later versioning is difficult because there is no reliable
  record of what mapping a prior posting used.

### Option C — Company-scoped protected mappings with controlled overrides

Each company has mandatory typed roles. AR, AP, bank/cash, and VAT roles are
validated and protected; ordinary revenue, cost, expense, and asset selection
remains controlled but not universally fixed.

- **Consequences:** It supports sound posting, subledger, VAT, bank, reporting,
  and permission boundaries while allowing business-specific ordinary accounts.
- **Security and operations:** Changes are capability-gated, reasoned, audited,
  and validated by account type/classification. Bank/cash maps per cash
  location rather than to a generic global bank account.
- **Migration and flexibility:** It permits evidence-based company migration
  and future templates without reinterpreting history. It requires a clear
  replacement workflow and configuration records.

### Option D — Effective-dated protected mappings

Option C is extended with controlled effective-from configuration versions.

- **Consequences:** It gives the strongest historical reproducibility and
  prospective-change behavior for accounting, VAT, reporting, migration, and
  audit.
- **Security and operations:** Validation can prevent overlapping or
  backdated mappings and retain the actor, reason, approval, and timing for
  each change.
- **Compatibility and change cost:** It is the safest future direction but adds
  configuration/version complexity. The exact record shape, version identity,
  effective-date rules, and posting snapshot contract belong to DEC-11.

## 10. APPROVED POLICY

Approve **Option C with Option D's prospective-versioning direction**:

1. Require company-scoped, protected, typed mappings for one AR account, one
   AP account, each accounting bank/cash location, one output-VAT account, and
   one input-VAT account.
2. Reserve a protected VAT-settlement role for approved return settlement
   workflows; do not invent a settlement posting or require it before that
   scope exists.
3. Treat revenue, cost of sales, ordinary expense, ordinary asset, and general
   equity as validated configurable source/default selections—not universal
   control accounts. Do not make retained earnings a launch default.
4. Resolve the account IDs server-side from validated company configuration and
   source context. Names, codes, browser values, bank evidence, and AI
   suggestions are never authority.
5. Permit remapping only prospectively with elevated DEC-05 capability,
   company scope, reason, validation, and audit evidence. Preserve the
   resolved account IDs and configuration context on each posting.
6. Require DEC-11 to define the full effective-dated/versioned configuration
   mechanism before implementation.
7. Preserve all unproven legacy mappings as visible DEC-22 migration exceptions.

This approved policy best satisfies DEC-03 VAT authority, DEC-04 canonical
accounting, DEC-05 capabilities, DEC-06/DEC-07 period integrity, DEC-08
reporting-only year-end, DEC-09 chart policy, small-business usability,
auditability, and future flexibility.

## 10A. Approval boundary

The explicit approval records:

- one protected company-scoped AR account and one protected company-scoped AP
  account;
- a protected accounting account for each bank/cash location;
- one protected Output VAT account and one protected Input VAT account;
- protected VAT settlement only when an approved settlement workflow requires it;
- ordinary revenue, Cost of Sales, expense, asset, and general equity selections
  as validated configurable accounts rather than universal controls;
- no launch default retained-earnings control account and no automatic
  retained-earnings postings; and
- prospective-only mapping changes with DEC-05 capability, validation, reason,
  audit, and preservation of historical resolved account identity.

## 11. Decision boundaries

### What DEC-10 approval locks in

- the mandatory control-role list and eligibility rules;
- which roles are protected versus ordinary configurable selections;
- company-scoped rather than global mapping ownership;
- prospectively effective remapping with validation, capability, reason, and
  audit requirements;
- separation of bank evidence, payment/allocation, and canonical journal roles;
- the source-template role relationships for invoices, bills, payments, and
  credit notes; and
- the rule that postings retain resolved account identity and are never
  reinterpreted by a later mapping.

### Deliberately left open

- the physical schema, APIs, UI, capability identifiers, and implementation
  sequence;
- complete configuration-versioning/effective-date mechanics (DEC-11);
- source freshness (DEC-12);
- overpayments, unapplied cash, refunds, and payment-on-account treatment
  (DEC-13 through DEC-16);
- retention, deletion, export, backup/recovery, RLS, migration cohort,
  cutover, rollback, and legacy authority retirement (DEC-17 through DEC-22);
- new VAT schemes, tax treatments, markets, currencies, payment methods, or
  bank-feed providers; and
- any implementation task.

## 12. Decision readiness

DEC-10 was explicitly approved on 2026-08-21. The approval is a
product/accounting-policy decision only. Until the applicable remaining
decisions are approved or amended:

- no active control mappings, mapping-protection behavior, account-configuration
  versioning, posting-template implementation, or account remapping may be
  implemented;
- DEC-12 and all later decisions remain untouched and unresolved;
- BL-06 and BL-07 remain **BLOCKED**; and
- no implementation task is authorised.

**DEC-01 through DEC-10:** **APPROVED**
**DEC-11:** **APPROVED — Configuration Versioning and Effective Dating Policy**
**DEC-12 through DEC-22:** **REQUIRE USER DECISION**
**BL-06 / BL-07:** **BLOCKED**
**Application code changed by this review:** **NO**
**Database or migrations changed by this review:** **NO**