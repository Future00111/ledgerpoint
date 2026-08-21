# DEC-12 Payment, Allocation and Settlement Policy Review

**Decision:** DEC-12 — Payment, Allocation and Settlement Policy
**Status:** **APPROVED — product/accounting policy only**
**Review date:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting, security,
and architecture review
**Implementation authority:** None

> This records an approved product/accounting policy. It does not approve
> DEC-17 through DEC-22, and it does not authorise an implementation task, code, schema,
> migration, accounting logic, UI, workflow, dependency, deployment, or
> publishing work.

## 1. Purpose and scope

DEC-12 must establish Ledgerly's authoritative payment, allocation, and
settlement model without conflating commercial/bank evidence with accounting
effects.

The review addresses:

- customer and supplier payments;
- allocation to invoices and bills;
- partial and full settlement;
- many-to-many payment/document relationships;
- allocation changes and audit;
- the boundary for unapplied, on-account, and overpayment flows;
- links to bank reconciliation; and
- reporting and migration consequences.

### Scope-alignment note

The Current Decision Register previously described DEC-12 as source freshness.
This review follows the current user-directed DEC-12 title: **Payment,
Allocation and Settlement Policy**. Source freshness is not decided, reassigned,
or implemented here. It remains an unresolved posting-safety dependency that
requires a distinct future placement in the decision register before source
posting can be implemented.

## 2. Existing authority

### Already decided

- **DEC-03:** Launch VAT is UK standard-scheme and invoice-basis. VAT is
  determined from the authoritative source/tax point, not bank settlement.
  Payment and allocation do not independently create or reverse VAT.
- **DEC-04:** Canonical journals are server-generated, balanced, immutable,
  source-linked, and separate from bank evidence, payments, and allocations.
  Corrections use controlled reversal/replacement mechanisms.
- **DEC-05:** Consequential accounting actions require active membership,
  company scope, server-side capabilities, validation, and audit.
- **DEC-06 and DEC-07:** Posting date determines the company financial year and
  accounting period; ordinary posting cannot bypass a closed period.
- **DEC-08:** Year-end is reporting-only; payments do not create automatic
  closing or retained-earnings entries.
- **DEC-09:** Stable chart identity and controlled account use are
  authoritative. Account names/codes are not payment logic.
- **DEC-10:** Company-scoped protected AR, AP, and bank/cash mappings are
  authoritative for their respective control roles.
- **DEC-11:** Material payment-posting configuration is immutable,
  company-scoped, effective-dated, selected by canonical posting date, and
  retained with resolved account IDs on the posting.

### Existing evidence

The current architecture review illustrates customer payment as `DR Bank/Cash,
CR AR` and supplier payment as `DR AP, CR Bank/Cash`. It also states that an
imported bank row alone does not create a posting. Existing compatibility data
contains invoice/bill paid/balance fields, bank matching fields, credit-note
records, and reconciliation analysis; it does not yet prove a canonical
payment, allocation, settlement, or open-item contract. Those current fields
are evidence only and cannot be treated as the authoritative future model.

## 3. Four distinct concepts

The following concepts are related but must remain distinct:

| Concept | Meaning | Accounting effect by itself |
| --- | --- | --- |
| **Payment evidence** | External proof or instruction: bank-feed row, cash receipt, payment-provider event, or manual evidence | None |
| **Accounting payment** | A recognised movement of money with a party, direction, amount, posting date, account context, and canonical journal | Exactly one canonical accounting effect when posted |
| **Allocation** | A controlled relationship applying an eligible payment/open balance to an eligible invoice, bill, or other approved open item | Normally no new journal when it only changes settlement links |
| **Settlement status** | Derived presentation of the remaining open amount of a document | None; never independently editable |

Bank evidence can be linked to an accounting payment. It must not be assumed to
be one, and a reconciliation link must not create a duplicate payment or
journal. Allocation explains how a posted payment settles open items. It must
not be used to create a second cash or AR/AP posting.

## 4. Payment as a canonical accounting event

Recommend that a payment be a standalone, immutable accounting event once
posted. It may exist before allocation, provided the payment itself has
sufficient evidence and the appropriate party/direction/accounting treatment.

Each posted payment should retain at least:

- company, direction, party, amount/currency, and validated posting date;
- source/evidence context, including an optional linked bank-evidence identity;
- the DEC-11 configuration version and resolved cash/AR/AP accounts;
- canonical-journal identity, source revision/idempotency context, and audit;
- allocation total, unapplied/open amount, and lifecycle/audit context; and
- links to later controlled reversals, refunds, or corrections where approved.

The amount of an accounting payment must be posted once. Allocation records,
settlement-state recalculation, and bank reconciliation links cannot create a
second payment journal.

### Customer payment

For a payment directly allocated to an eligible customer invoice:

```text
DR Bank or Cash
CR Accounts Receivable
```

This reduces the customer AR control balance and makes the payment available
for allocation to the customer's eligible open invoice(s). The bank/cash entry
and AR credit are canonical journal facts; allocation is the subledger/open-item
explanation.

### Supplier payment

For a payment directly allocated to an eligible supplier bill:

```text
DR Accounts Payable
CR Bank or Cash
```

This reduces the supplier AP control balance and makes the payment available
for allocation to the supplier's eligible open bill(s).

## 5. Allocation and settlement

### Allocation model

Recommend a first-class, many-to-many allocation relationship:

- one payment may allocate across multiple eligible invoices or bills;
- one invoice or bill may receive multiple allocations;
- a payment may remain wholly or partly unallocated;
- an allocation amount must be positive, in the payment/document currency, and
  cannot exceed the currently eligible payment remainder or document open
  amount; and
- allocation must preserve party, direction, company, and supported-currency
  compatibility.

An allocation that merely moves an already-posted direct payment between
eligible documents within the same AR or AP control balance does not create a
new canonical journal. It changes the settlement relationship only.

If an allocation changes the underlying accounting treatment—for example,
applying a separately posted customer credit liability or supplier prepayment
asset to AR/AP—it must use a separate controlled canonical posting. DEC-13,
DEC-14, and DEC-16 retain the authority to decide the exact account treatment,
launch scope, and allowable transitions for those cases.

### Partial, full, and excess settlement

Document settlement is derived from authoritative open-item data, not edited by
users:

- **Unpaid:** no eligible allocation has reduced the document open amount.
- **Partially paid:** eligible allocations reduce, but do not eliminate, the
  authoritative open amount.
- **Fully paid:** the authoritative open amount is exactly zero after eligible
  payments and authorised canonical adjustments such as credit notes.
- **Overpayment condition:** a payment or party-level balance exceeds the
  amount validly allocable to the document(s). It is not a licence to
  over-allocate a document.

The preferred model prevents an invoice or bill allocation from exceeding its
open amount. An excess is represented as a payment/party remainder, not as a
silently negative invoice/bill balance. A user interface may present a
document as “settled with excess on account”, but the core document settlement
is fully settled and the excess remains separately traceable.

For an as-of date, the document open amount is derived from the posted
document's authoritative open-item amount, authorised canonical adjustments,
and allocations effective by that date. Historical aging must use allocation
history, not today's edited status.

## 6. Allocation changes and historical traceability

Allocation records must be append-only business events. Reallocation or
unallocation cannot overwrite the original record silently.

Recommended handling:

1. create an explicit allocation reversal/supersession event referencing the
   earlier allocation and giving a reason;
2. create the replacement allocation, if any;
3. recalculate current settlement state from active allocation events;
4. preserve the prior allocation and its effective/audit timestamps for
   historical reports and investigation; and
5. create a controlled canonical correction only if the change alters actual
   accounting treatment, not merely the AR/AP document relationship.

Examples:

- Moving a direct customer payment from Invoice A to Invoice B changes the
  settlement links and aging, but not the total AR or bank balance; no second
  cash journal is created.
- Making a partial allocation fully allocated recalculates document settlement
  and payment remainder; it does not repost the original payment.
- Returning a payment to unapplied/on-account state is an allocation reversal.
  Whether it transfers balance between AR/AP and a customer-credit/supplier-
  prepayment account belongs to DEC-13, DEC-14, and DEC-16.

An allocation event must not be created with a date that rewrites the
historical view of a closed period. The period policy controls any associated
canonical accounting correction; allocation history remains auditable even
where it does not itself create a journal.

## 7. Unapplied, overpaid, and payment-on-account boundaries

### Bank evidence awaiting classification

A bank transaction with unknown payer/payee, purpose, or accounting treatment
is payment evidence awaiting classification. It is not automatically an
accounting payment, unapplied cash, or payment-on-account. It must not be
silently assigned to a customer, supplier, invoice, or bill.

### Known-party payment awaiting allocation

When a payment has been recognised in accounting, the party is known, and no
eligible document has yet been selected, it may have an unapplied remainder.
This is conceptually different from unclassified bank evidence.

### DEC-12 prerequisite, later policy authority

DEC-12 should establish the representation boundary: payment total, allocation
total, and unapplied remainder are separate authoritative values; money is
never discarded, capped, or forced onto a document.

It should not decide the final customer-credit liability versus supplier-
prepayment asset treatment, launch scope for first-class unapplied cash, or
customer/supplier payment-on-account eligibility. Those decisions belong to:

- **DEC-13:** customer overpayments and supplier prepayments;
- **DEC-14:** first-class unapplied cash;
- **DEC-15:** refund workflow and scope; and
- **DEC-16:** customer and/or supplier payment-on-account launch scope.

The recommended later path is an explicit, auditable customer-credit or
supplier-prepayment open balance where approved. It must not be simulated by a
fake invoice or bill, and an unmatched bank row must not be automatically
converted into it.

## 8. Credit notes and refunds

Customer and supplier credit notes remain separate authoritative source
documents with canonical journal effects. Payment allocation may link to an
eligible credit/open-item balance only through that source's approved canonical
relationship; it cannot create an alternative credit-note accounting path.

DEC-12 establishes only these prerequisites for later refund policy:

- refunds/reversals must not edit the original payment journal;
- a refund requires its own controlled payment/canonical posting, evidence,
  date, direction, audit, and any required source link;
- payment allocation may need a controlled reversal before or with the refund;
  and
- DEC-03 remains authoritative for any sales/purchase credit-note VAT effect.

Whether refunds require an eligible credit/return source, whether standalone
refunds are allowed against unapplied balances, and which cases launch remain
DEC-15 decisions.

## 9. Bank reconciliation

Reconciliation must link, not collapse, these four concepts:

```text
Bank evidence ── linked to ── Accounting payment
                                     │
                                     ├── canonical journal
                                     └── allocation(s) ──> invoice/bill settlement
```

Recommended idempotency rules:

- importing or analysing a bank row creates no payment journal;
- approving a reconciliation may link an existing posted payment or create one
  authorised, source-linked, idempotent payment posting;
- a bank row cannot be used to create duplicate payment postings;
- a payment can retain a link to its bank evidence without treating the
  evidence as the allocation; and
- reconciliation state and document settlement state are separate derived
  concepts.

An accounting payment may be recorded without a bank-feed row, for example a
cash receipt or manual evidence, but it still requires authorised evidence,
canonical posting, and later reconciliation where appropriate.

## 10. VAT, periods, configuration, permissions, and audit

### VAT

Under DEC-03's invoice-basis launch scope, payment, allocation, reallocation,
overpayment, and unapplied-cash state do not independently create, reverse, or
recalculate VAT. VAT remains tied to authoritative invoices, bills, credit
notes, and documented correction policy. Cash accounting and payment-driven VAT
remain outside scope.

### Periods and configuration

The canonical payment posting uses its validated posting date to select the
open accounting period and the DEC-11 material configuration version. A closed
period rejects ordinary payment posting. Reallocation that only changes
settlement links cannot silently change historical accounting; any resulting
canonical adjustment follows DEC-04 and DEC-07.

### Permissions

Ordinary authorised payment creation/posting and ordinary allocation require
the applicable DEC-05 company-scoped capability. Elevated capability and,
where risk justifies it, separate approval should be required for:

- payment reversal or refund;
- controlled reallocation/unallocation with historical reporting impact;
- on-account/overpayment treatment once the later decisions approve it; and
- any exception involving a closed period or protected mapping.

The exact capability names, role grants, and approval thresholds remain
implementation detail under DEC-05.

### Audit

Immutable audit evidence must retain payment creation and posting, source or
bank evidence, party/direction/amount/date, configuration version, resolved
accounts, canonical journal, allocation creation/reversal/reallocation,
settlement-state transition, actor, capability, reason, approval where
applicable, and timestamps. Historical payment, allocation, and accounting
events must remain traceable after correction.

## 11. Reporting

Reports derive from authoritative journals and open-item/allocation data:

- **Customer/supplier balances:** AR/AP journal control balances, explained by
  party open items and allocations.
- **Aged receivables/payables:** authoritative document open amounts and
  allocation history as of the reporting date, not editable document status.
- **Bank reconciliation and cash reporting:** bank evidence and linked payment
  journal status, without double-counting allocations.
- **Trial Balance, General Ledger, Balance Sheet:** canonical payment journals
  and any separately approved customer-credit/supplier-prepayment postings.
- **Profit & Loss:** ordinary settlement does not create income or expense; it
  settles AR/AP. Credit notes and approved corrections remain their own
  authoritative source paths.

Current and comparative reports must not recompute historical payment
treatment from a later configuration or current settlement label.

## 12. Migration

Historical payment, allocation, settlement, and party balance records may only
be migrated where evidence supports their amount, direction, party, document
relationship, date, and accounting/bank linkage.

Do not invent:

- historical allocations from current `amount_paid` or `balance_due` fields;
- payment-on-account, customer-credit, supplier-prepayment, or overpayment
  state from an unmatched bank row;
- settlement events or effective dates; or
- a journal link where legacy data cannot demonstrate one.

Evidence-backed records may be preserved with explicit legacy/unknown markers.
Ambiguous payments, allocations, balances, and migration relationships become
DEC-22 exceptions. DEC-22 retains authority for migration cohorts, cutover,
rollback, and retirement of legacy authority.

## 13. Options

### Option A — Treat a bank row, payment, allocation, and settlement as one event

- **Accounting/reporting:** Appears simple, but duplicates cash/AR/AP risk,
  cannot represent partial or many-to-many settlement safely, and makes aging
  and reconciliation unreliable.
- **Data/migration/audit:** Requires fewer records initially but cannot retain
  independent evidence, accounting, and allocation history.
- **Operations/flexibility:** Easy to start and extremely difficult to extend
  to overpayments, on-account payments, credit notes, refunds, and bank
  integrations.

### Option B — Payment journal plus a mutable document paid-status field

- **Accounting/reporting:** Posts cash once, but mutable settlement fields
  cannot reconstruct allocation history or historical aging.
- **Data/migration/audit:** Simpler than Option A, but reallocation becomes a
  destructive edit and migration must infer relationships from current totals.
- **Operations/flexibility:** Supports simple direct settlement but becomes
  fragile for partial, split, excess, or corrected payments.

### Option C — Separate payment accounting event, allocation event, and derived settlement

- **Accounting/reporting:** Posts payment once through the canonical journal;
  allocation explains many-to-many settlement and status is derived. Historical
  cash/AR/AP, aging, and reconciliation remain explainable.
- **Data/migration/audit:** Requires payment, allocation, open-item, journal,
  evidence, idempotency, version, and immutable audit relationships. Legacy
  ambiguity is explicit rather than invented.
- **Operations/security:** Allows user-friendly allocation while preventing
  duplicate accounting and requiring controlled reversal/supersession.
- **Compatibility/flexibility:** Supports future customer credit, supplier
  prepayment, refund, currency, payment-method, and bank-provider policies.
  It is more deliberate to implement, but avoids a later reconstruction of
  settlement history.

### On-account and overpayment alternatives

1. Reject all payments without a source: simple but loses valid money and
   obstructs real payment workflows.
2. Store an unapplied flag only: preserves a label but lacks accountable
   party/open-item and controlled reporting treatment.
3. Use first-class party-level customer-credit/supplier-prepayment balances:
   preserves money and later allocation/refund lineage, but requires the
   separate decisions in DEC-13, DEC-14, DEC-15, and DEC-16.

## 14. APPROVED POLICY

Approve **Option C** with the following policy:

1. Treat an accounting payment as a standalone canonical event that posts
   money exactly once.
2. Keep payment evidence, payment accounting, allocation, and derived document
   settlement as separate first-class concepts.
3. Support many-to-many allocation and partial settlement; prevent allocation
   from exceeding an eligible payment remainder or document open amount.
4. Derive settlement from authoritative document/open-item and allocation
   history. Do not permit an independently editable paid status.
5. Make allocation changes append-only reversal/supersession events. Do not
   create a second journal where only document settlement changes.
6. Require a controlled canonical posting when an allocation changes underlying
   accounting treatment, such as an approved on-account balance moving to
   AR/AP.
7. Do not discard, cap, or force excess money onto a document. Preserve the
   conceptual payment remainder while leaving final overpayment, unapplied-cash,
   refund, and payment-on-account policy to DEC-13 through DEC-16.
8. Link bank evidence to payment accounting idempotently, without treating a
   bank row as a payment or duplicating journals.
9. Apply DEC-03 VAT, DEC-05 capabilities, DEC-07 periods, DEC-10 mappings,
   DEC-11 configuration versioning, and DEC-04 canonical correction controls.
10. Migrate only evidenced historical payment/allocation facts and route
    ambiguity to DEC-22.

This policy is approved as a product/accounting decision only.

## 15. Decision boundaries

### Already decided

DEC-03 through DEC-11 authorities listed above, including immutable journals,
invoice-basis VAT, capability controls, periods, chart/control mappings, and
effective-dated configuration.

### Recommended

The separate payment/evidence/allocation/settlement model, payment-once rule,
many-to-many allocation, derived settlement, append-only allocation history,
and explicit links to bank evidence and canonical journals.

### Requires user decision

DEC-12 approval of the recommended payment, allocation, and settlement policy.

### Deliberately left open

- **DEC-13:** customer-overpayment and supplier-prepayment accounting
  treatment and scope;
- **DEC-14:** whether unapplied cash is a first-class state and its approved
  account/subledger treatment;
- **DEC-15:** refund source, workflow, tax, approval, and reversal scope;
- **DEC-16:** customer and/or supplier payment-on-account launch scope;
- **DEC-22:** evidence thresholds, migration cohort/cutover, rollback, and
  legacy authority retirement;
- source freshness: unresolved separate posting-safety policy; and
- physical schema, APIs, user interface, workflow, role matrix, tests,
  dependency changes, deployment, publishing, and implementation tasks.

### What DEC-12 approval locks in

- payment, evidence, allocation, and settlement as distinct concepts;
- one canonical accounting effect per posted payment;
- allocation as the authoritative settlement link rather than a second cash
  posting;
- derived, non-editable settlement status;
- many-to-many, non-overallocating allocation;
- append-only allocation change history;
- the reconciliation/no-duplicate-accounting boundary; and
- the prerequisite representation for later overpayment, unapplied cash,
  refund, and payment-on-account decisions.

### What remains changeable

Future party/open-item presentation, allocation UX, payment-method support,
currencies, banking integrations, customer-credit/supplier-prepayment account
details, refund workflows, and other extensions that preserve the approved
accounting boundaries.

## 16. Decision readiness

DEC-12 was explicitly approved on 2026-08-21. The approval is a
product/accounting-policy decision only. Until the applicable remaining
decisions are approved or amended:

- DEC-17 through DEC-22 remain untouched and unresolved;
- BL-06 and BL-07 remain **BLOCKED**;
- no payment, allocation, settlement, or accounting mechanism may be
  implemented; and
- no implementation task is authorised.

**DEC-01 through DEC-12:** **APPROVED**
**DEC-13:** **APPROVED — Overpayments, Unapplied Cash and Excess Payment Policy**
**DEC-14:** **APPROVED — Unapplied Cash Workflow Policy**
**DEC-15:** **APPROVED — Refund Policy**
**DEC-16:** **APPROVED — Payment-on-Account Launch Scope**
**DEC-17 through DEC-22:** **REQUIRE USER DECISION**
**BL-06 / BL-07:** **BLOCKED**
**Application code changed by this review:** **NO**
**Database or migrations changed by this review:** **NO**