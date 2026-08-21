# DEC-13 Overpayments, Unapplied Cash and Excess Payment Policy Review

**Decision:** DEC-13 — Overpayments, Unapplied Cash and Excess Payment Policy
**Status:** **APPROVED — product/accounting policy only**
**Review date:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting, security,
and architecture review
**Implementation authority:** None

> This records an approved product/accounting policy. It does not approve
> DEC-18 through DEC-22, and it does not authorise an implementation task, code,
> migration, accounting logic, UI, workflow, dependency, deployment, or
> publishing work.

## 1. Purpose and scope

DEC-13 must determine how Ledgerly represents money received from customers or
paid to suppliers when the amount cannot be fully applied to currently
eligible invoices or bills.

The review covers:

- customer overpayments;
- supplier overpayments;
- unapplied customer and supplier payment balances;
- explicit payment-on-account intent;
- later allocation and reallocation prerequisites;
- balance-sheet and statement presentation;
- period, VAT, permission, audit, and migration boundaries; and
- the relationship between overpayments and future refunds.

This review builds directly on DEC-12. It does not collapse bank evidence,
accounting payment, unapplied payment, payment-on-account, overpayment,
allocation, refund, or document settlement into one object or one editable
status.

## 2. Existing authority and evidence

### Already decided

- **DEC-03:** Launch VAT is standard UK invoice-basis VAT. Payment,
  overpayment, unapplied cash, and payment-on-account do not independently
  calculate or reverse VAT.
- **DEC-04:** Canonical journals are balanced, server-generated, immutable,
  source-linked, and corrected through controlled reversal/replacement
  mechanisms. Artificial journal entries must not be created just to satisfy a
  UI label.
- **DEC-05:** Payment creation, allocation, reallocation, clearing, and other
  consequential actions require active company membership, server-side
  capability checks, validation, and audit.
- **DEC-06 and DEC-07:** Payment and any accounting reclassification use a
  validated posting date and cannot bypass closed-period controls.
- **DEC-08:** Year-end is reporting-only and does not create automatic closing
  or retained-earnings entries.
- **DEC-09:** Stable account identity and controlled account lifecycle are
  authoritative. Customer-credit and supplier-prepayment accounts must be
  compatible with the chart policy.
- **DEC-10:** AR, AP, and bank/cash mappings are protected company-scoped
  mappings. Other required balance-sheet accounts must be validated and
  configured before a posting that needs them can succeed.
- **DEC-11:** Material payment-posting configuration is immutable,
  company-scoped, effective-dated, selected by canonical posting date, and
  retained with resolved account IDs.
- **DEC-12:** Payment evidence, accounting payment, allocation, and settlement
  are separate concepts. Payment posts once; allocation does not duplicate
  cash/AR/AP accounting; settlement is derived; allocation history is
  append-only.

### Existing evidence and compatibility limits

The existing accounting architecture shows direct customer payment as
`DR Bank/Cash, CR AR` and direct supplier payment as `DR AP, CR Bank/Cash`.
It also states that a bank row alone does not create a posting. Existing
invoice and bill records expose paid and due amounts, while bank matching and
reconciliation data exposes evidence and links. Those fields do not prove a
historical customer-credit, supplier-prepayment, unapplied, or
payment-on-account state.

Current capped paid/balance values cannot safely reconstruct excess amounts,
historical allocations, or party-level credits without evidence. They are
compatibility evidence only, not authority for DEC-13.

## 3. Distinct concepts

| Concept | Meaning | Accounting consequence |
| --- | --- | --- |
| **Bank evidence** | External bank-feed row, receipt, payment-provider event, or manual evidence | None until an authorised accounting decision posts it |
| **Accounting payment** | A recognised money movement with amount, direction, party/evidence, date, and canonical journal | Posts money once |
| **Unapplied payment** | A posted payment or residual amount not currently allocated to a specific eligible document | Retains a separately traceable open balance; account treatment depends on party and approved policy |
| **Payment-on-account** | An explicit known-party instruction to hold money for future goods/services or future documents | A controlled customer-credit or supplier-prepayment position; not a fake invoice/bill |
| **Overpayment** | Amount remaining after all valid allocations to currently eligible documents | Becomes a party-level credit/asset position, not a negative document balance |
| **Allocation** | Relationship applying money to one or more eligible open documents | Usually changes settlement; may require a canonical reclassification from on-account |
| **Refund** | Money returned to a customer or recovered from a supplier | Separate controlled payment/accounting event; detailed workflow remains later |
| **Document settlement** | Derived unpaid, partially paid, or fully settled state | Not independently editable and not itself a journal |

An unmatched bank row is not automatically any of the last six concepts. A
payment-on-account is not merely a bank reconciliation status, and an
overpayment is not an instruction to allocate beyond a document's open amount.

## 4. Customer overpayments

### Recommended meaning

A customer overpayment is a recognised customer receipt whose valid allocation
to one or more eligible invoices is less than the payment amount. The excess
belongs to the customer as a credit balance until it is allocated, refunded,
or otherwise cleared under a separately authorised policy.

The excess must not be:

- discarded;
- capped out of the accounting payment;
- allocated to an invoice beyond its open amount;
- used to make an invoice balance negative; or
- presented as an unpaid invoice or income.

### Accounting treatment

For a customer payment with an amount applied to invoices and an excess
remainder:

```text
DR Bank or Cash                         full receipt
CR Accounts Receivable                 applied amount
CR Customer Credit / Receipt-on-Account liability
                                         excess remainder
```

For a wholly unapplied known-party customer payment:

```text
DR Bank or Cash
CR Customer Credit / Receipt-on-Account liability
```

This is one canonical payment posting with the appropriate balanced lines, not
a direct payment journal plus an artificial status journal. The customer
credit liability account must be an approved, validated company configuration
under DEC-10/DEC-11. If the required account is not configured, the posting
must fail closed for review rather than silently crediting AR or an arbitrary
account.

The customer statement should show the receipt, allocations, remaining credit,
and any later refund or reversal separately.

## 5. Supplier overpayments

### Recommended meaning

A supplier overpayment is a recognised payment to a supplier whose valid
allocation to one or more eligible bills is less than the amount paid. The
excess is normally a supplier prepayment or receivable asset recoverable from
future goods/services or a later recovery/refund.

The excess must not be:

- discarded;
- capped out of the accounting payment;
- allocated beyond a bill's open amount;
- used to make a bill balance negative; or
- presented as an additional expense.

### Accounting treatment

For a supplier payment with an amount applied to bills and an excess
remainder:

```text
DR Accounts Payable                     applied amount
DR Supplier Prepayment / Other Receivable asset
                                         excess remainder
CR Bank or Cash                         full payment
```

For a wholly unapplied known-party supplier payment:

```text
DR Supplier Prepayment / Other Receivable asset
CR Bank or Cash
```

The supplier-prepayment or receivable account must be an approved, validated
company configuration under DEC-10/DEC-11. The system must fail closed if no
compatible account is available.

Supplier statements should distinguish unpaid bills, applied payments,
prepayments, and amounts potentially recoverable from the supplier.

## 6. Unapplied cash and payment-on-account

### Unapplied payment

An unapplied payment is a posted accounting payment, or a residual amount of
one, that is not currently allocated to a specific eligible invoice or bill.
It may exist without a document allocation when the payment has sufficient
evidence and an approved party/accounting treatment.

Recommended minimum distinctions:

1. **Bank evidence awaiting classification:** no accounting payment and no
   Balance Sheet effect.
2. **Accounting payment awaiting allocation:** payment has posted and the
   party/direction are known, but no eligible document has been selected.
3. **Unapplied balance:** a remaining amount after one or more allocations, or
   a wholly unallocated payment, retained as an explicit open balance.
4. **Payment-on-account:** a user-authorised business intention to retain that
   known-party balance for future documents or goods/services.

Payment-on-account is a controlled interpretation of a known-party unapplied
balance, not another cash movement. It must never be inferred solely from a
bank row or from the absence of an invoice match.

### Launch recommendation

Recommend supporting the accounting representation for both:

- customer credit/receipt-on-account liabilities; and
- supplier prepayment/receivable assets.

This preserves money and gives users a safe way to record known-party receipts
and payments before a document exists. However, the final user-facing launch
scope and workflow for payment-on-account remain **DEC-16**. DEC-13 does not
approve DEC-16 by implication.

## 7. Allocation after an unapplied or on-account payment

### Customer example

For a £1,000 customer receipt:

- £700 is allocated to Invoice A;
- £300 remains a customer credit;
- Invoice B is later raised;
- £300 is allocated to Invoice B.

The initial accounting payment can be:

```text
DR Bank or Cash                         £1,000
CR Accounts Receivable                 £700
CR Customer Credit liability            £300
```

When the £300 customer credit is later allocated to Invoice B, the
reclassification is a canonical accounting event:

```text
DR Customer Credit liability             £300
CR Accounts Receivable                  £300
```

The allocation relationship and Invoice B settlement are recorded separately.
The original bank receipt is not reposted.

### Supplier equivalent

For a £1,000 supplier payment:

- £700 is allocated to Bill A;
- £300 remains a supplier prepayment;
- Bill B is later received;
- £300 is allocated to Bill B.

The initial accounting payment can be:

```text
DR Accounts Payable                     £700
DR Supplier Prepayment asset             £300
CR Bank or Cash                        £1,000
```

Later allocation to Bill B requires:

```text
DR Accounts Payable                     £300
CR Supplier Prepayment asset             £300
```

The exact launch workflow and legal treatment of these balances remains
subject to DEC-14 and DEC-16 where applicable.

### When allocation does not create accounting

If a payment was already posted directly against the same AR or AP control
account and is merely moved between eligible documents, allocation changes
settlement relationships without creating another cash, AR, or AP journal.

If the payment is being moved from a customer-credit liability or supplier-
prepayment asset into AR/AP, the accounting classification changes. That
transition requires a separate balanced canonical reclassification, not a
silent subledger edit.

## 8. Reallocation and clearing

Reallocation must preserve DEC-12's append-only history.

### Direct payment reallocation

If a direct customer payment is moved from Invoice A to Invoice B, the original
cash-to-AR journal remains unchanged. The system records:

1. an explicit reversal or supersession of the A allocation;
2. a replacement B allocation;
3. recalculated current settlement; and
4. actor, reason, timing, and capability audit evidence.

The same applies to a direct supplier payment moved between eligible bills.

### On-account reallocation

If a customer credit allocated to Invoice A is removed, the credit becomes
available again. A controlled reversal of the A reclassification returns the
balance to the customer-credit liability, after which a replacement allocation
to Invoice B may reclassify it to AR. Supplier prepayments follow the mirrored
AP treatment.

The original cash journal is never edited. No allocation change may erase
which document was previously selected or make a closed-period history appear
as if the later allocation always existed.

### Clearing and write-off

No automatic write-off, forced refund, or silent balance clearing should be
allowed. A zeroing or write-off action is consequential accounting and
requires an explicit supported source, elevated DEC-05 capability, reason,
approval where risk requires it, and canonical accounting treatment.

The detailed legal, tax, approval, and launch policy for clearing or refunds
remains outside DEC-13 where it belongs to later decisions.

## 9. Balance-sheet and statement treatment

### Customer

Customer overpayments and payment-on-account balances normally appear as a
separate customer-credit or receipt-on-account liability. They must not reduce
AR below the valid open-item amount and must not be presented as revenue.

Customer reporting should show:

- invoices and their valid outstanding balances;
- applied receipts;
- unapplied/customer-credit balance;
- approved refunds or reversals; and
- the resulting net customer position, with its AR and liability components
  visible rather than misleadingly netted.

### Supplier

Supplier overpayments and payment-on-account balances normally appear as a
separate supplier-prepayment or receivable asset. They must not reduce AP below
the valid open-bill amount and must not be presented as an expense.

Supplier reporting should show:

- bills and their valid outstanding balances;
- applied payments;
- supplier-prepayment/receivable balance;
- approved recovery/refunds or reversals; and
- the resulting supplier position with AP and asset components visible.

### Aging

Customer credit balances are not overdue receivables. Supplier prepayments are
not overdue payables. Aged receivables and aged payables must age document open
items, while statements separately expose party-level credits or prepayments.

## 10. VAT

DEC-03 remains the sole VAT authority.

Under the approved invoice-basis launch model:

- receiving a customer overpayment does not create output VAT;
- making a supplier overpayment does not create input VAT;
- unapplied cash does not create VAT;
- payment-on-account does not create VAT merely because money moved;
- allocation of a payment does not recalculate invoice/bill VAT; and
- customer/supplier credit or prepayment balances do not substitute for
  invoices, bills, or approved credit notes.

Credit-note VAT, refund VAT, bad-debt relief, cash-accounting treatment,
special schemes, and other tax consequences remain governed by DEC-03 and any
later approved policy. DEC-13 must not create a second VAT engine.

## 11. Period controls and configuration

The initial payment and any canonical customer-credit/supplier-prepayment
posting use the validated payment posting date. DEC-07 assigns the accounting
period and rejects ordinary posting into a closed period.

An allocation-only event uses its actual allocation event date for settlement
history. It cannot rewrite an earlier closed-period report. If allocating an
on-account balance requires a canonical reclassification, that reclassification
has its own validated posting date and must use an open period.

A later allocation may settle a document raised after the original payment,
provided the payment balance, party, currency, document eligibility, and period
rules validate. It must not pretend that the original receipt was posted on
the later document date.

Where a material account mapping affects the payment or reclassification,
DEC-11 selects the configuration version by canonical posting date and the
canonical journal retains the resolved account IDs. DEC-13 does not redesign
DEC-11.

## 12. Permissions and audit

### Permissions

Use the DEC-05 server-side capability model for:

- posting a customer or supplier payment;
- creating or retaining a known-party unapplied balance;
- recording explicit payment-on-account intent;
- allocating or reallocating;
- reversing an allocation;
- clearing, adjusting, or writing off a balance; and
- initiating or approving a refund where the later refund policy allows it.

Recommend elevated capability and proportionate separate approval for
reallocation with historical reporting impact, write-off/clearing, and any
refund or exceptional period action. Do not require dual approval for every
ordinary allocation, and do not grant authority through frontend controls or
arbitrary role strings.

### Audit

Immutable audit history should retain, where applicable:

- evidence and accounting payment identity;
- company, party, direction, amount, currency, and dates;
- invoice/bill allocations and remaining amount;
- customer-credit or supplier-prepayment creation;
- payment-on-account classification and later conversion;
- allocation reversal, reallocation, or unallocation;
- clearing, adjustment, write-off, or refund relationship;
- old and new effective balances;
- actor, capability, reason, approval, timestamps, and source context; and
- canonical-journal and DEC-11 configuration-version references.

Settlement status is derived but material state transitions must remain
auditable. Audit records cannot be deleted or overwritten by later allocation.

## 13. Migration

Historical overpayments, unapplied cash, payment-on-account, customer credits,
supplier credits, and allocations may be migrated only where evidence supports
the amount, party, direction, date, document relationship, and accounting
treatment.

Never infer:

- an overpayment from a current capped `amount_paid` field;
- a customer credit or supplier prepayment from an unmatched bank row;
- a payment-on-account intention from the absence of an invoice or bill;
- historical allocation order from a final document balance;
- a refund or write-off event without evidence; or
- a historical customer-credit/supplier-prepayment account from a current
  account mapping.

Evidence-backed balances may be migrated with explicit legacy provenance.
Unknown or conflicting states must remain visible as DEC-22 migration
exceptions. DEC-22 retains authority for migration cohorts, cutover, rollback,
and legacy authority retirement.

## 14. Options

### Option A — Cap or discard the excess

- **Accounting:** Falsifies received/paid money, understates customer
  liabilities or supplier assets, and can make payment totals disagree with
  bank evidence.
- **Data/migration:** Simple fields but impossible to reconstruct discarded
  history reliably.
- **Reporting/VAT:** Misleading statements, aging, and balances; VAT still
  must not be inferred from the cap.
- **Audit/security/operations:** Poor auditability and high risk of silent
  financial loss or forced allocation.
- **Flexibility:** Makes later refunds, on-account workflows, and additional
  payment methods difficult or impossible.

### Option B — Keep excess only as a metadata flag

- **Accounting:** Avoids discarding a label but cannot represent the liability
  or asset required by the Balance Sheet.
- **Data/migration:** Low structural complexity but depends on mutable document
  fields and cannot safely model many-to-many later allocation.
- **Reporting:** Customer and supplier statements may be wrong, and aging can
  confuse a credit with an unpaid document.
- **Audit/security/operations:** Easy to lose or overwrite during
  reallocation; refunds and clearing lack a controlled balance.
- **Flexibility:** Better than Option A for display, but expensive to convert
  into an authoritative open-balance model later.

### Option C — First-class party credit/prepayment balances

- **Accounting:** Customer excess is a liability; supplier excess is an asset.
  Cash is posted once, and later allocation can use controlled
  reclassification journals.
- **Data/migration:** Requires explicit payment remainder, party balance,
  allocation, account, journal, configuration, provenance, and audit
  relationships. Unknown legacy states remain exceptions.
- **Reporting/VAT:** Produces honest statements, separate aging, Balance Sheet,
  Trial Balance, and General Ledger treatment. Invoice-basis VAT remains
  document-driven.
- **Audit/security/operations:** Supports append-only allocation history,
  capability-gated clearing, and future refund workflows.
- **Flexibility:** Supports both customer and supplier workflows, later
  payment-on-account, refunds, currencies, and banking integrations, with
  further policy detail still changeable.

### Option D — Force an immediate refund

- **Accounting:** Avoids retaining a credit/asset but creates unnecessary
  payment reversals and may be legally or commercially wrong.
- **Data/migration:** Requires refund evidence and source relationships for
  every excess amount.
- **Reporting/VAT:** Can distort cash timing and credit-note/VAT relationships.
- **Audit/security/operations:** High operational burden and increased fraud
  risk; does not support ordinary future allocation.
- **Flexibility:** Makes customer credits, supplier prepayments, and
  payment-on-account workflows difficult to add later.

## 15. APPROVED POLICY

Approve **Option C: first-class party credit/prepayment balances**, with the
following boundaries:

1. Never discard or cap an excess payment. Preserve the full accounting
   payment and a separately measurable unapplied remainder.
2. Represent a customer excess as a customer-credit/receipt-on-account
   liability and a supplier excess as a supplier-prepayment/receivable asset,
   using validated company mappings.
3. Permit a known-party payment to exist before document allocation. Keep an
   unmatched bank row as evidence only until an authorised accounting
   classification exists.
4. Support both customer-credit and supplier-prepayment accounting
   representations, while leaving final user-facing payment-on-account launch
   scope to DEC-16.
5. Allocate only up to eligible document open amounts and payment remainder.
   Keep excess at party level rather than making invoices or bills negative.
6. Use a canonical reclassification when a customer-credit or supplier-
   prepayment balance is later applied to AR/AP. Do not repost the original
   cash movement.
7. Make allocation and reallocation append-only, with explicit reversal or
   supersession history and no silent historical mutation.
8. Keep refunds, detailed unapplied-cash workflow, clearing, and launch
   payment-on-account UX within DEC-14 through DEC-16.
9. Keep invoice-basis VAT document-driven under DEC-03 and apply DEC-07
   period controls and DEC-11 configuration resolution.
10. Migrate only evidenced historical balances and relationships; route
    ambiguity to DEC-22.

This policy is approved as a product/accounting decision only.

## 16. Decision boundaries

### Already decided

DEC-03 through DEC-12, including invoice-basis VAT, immutable canonical
journals, capabilities, periods, chart/control mappings, effective-dated
configuration, and the separation of payment, allocation, and settlement.

### Recommended

First-class customer-credit liabilities and supplier-prepayment/receivable
assets; payment-once accounting; no discarded excess; controlled later
reclassification; derived settlement; and append-only allocation history.

### Requires user decision

The approved DEC-13 overpayment, unapplied-balance, and payment-on-account
accounting structure.

### Deliberately left open

- **DEC-14:** first-class unapplied-cash state, workflow, and detailed
  account/subledger behavior;
- **DEC-15:** refund source, workflow, tax, approval, reversal, and launch
  scope;
- **DEC-16:** customer and/or supplier payment-on-account user-facing launch
  scope;
- **DEC-22:** migration evidence thresholds, exception handling, cohort,
  cutover, rollback, and legacy authority retirement;
- detailed write-off/clearing policy where not covered by an approved source;
- source freshness, which remains a separate unresolved posting-safety
  dependency; and
- physical schema, APIs, UI, workflows, capability identifiers, tests,
  dependencies, deployment, publishing, and implementation tasks.

### What DEC-13 approval locks in

- customer excess as a distinct liability rather than a negative invoice;
- supplier excess as a distinct asset/prepayment rather than a negative bill;
- preservation of full payment amounts and unapplied remainders;
- known-party unapplied payment as distinct from unmatched bank evidence;
- no over-allocation of documents;
- canonical reclassification when on-account balances move into AR/AP;
- no artificial UI-status journals;
- the prerequisites for later allocation, refund, and payment-on-account
  workflows; and
- evidence-based migration with DEC-22 exceptions.

### What remains changeable

The detailed user experience, whether and how unapplied cash becomes a
first-class workflow under DEC-14, refund scope under DEC-15, payment-on-account
launch scope under DEC-16, supported payment methods/currencies, and future
market-specific treatment.

## 17. Decision readiness

DEC-13 was explicitly approved on 2026-08-21. The approval is a
product/accounting-policy decision only. Until the applicable remaining
decisions are approved or amended:

- DEC-18 through DEC-22 remain untouched and unresolved;
- BL-06 and BL-07 remain **BLOCKED**;
- no overpayment, unapplied-cash, payment-on-account, refund, write-off,
  schema, migration, or accounting mechanism may be implemented; and
- no implementation task is authorised.

**DEC-01 through DEC-13:** **APPROVED**
**DEC-14:** **APPROVED — Unapplied Cash Workflow Policy**
**DEC-15:** **APPROVED — Refund Policy**
**DEC-16:** **APPROVED — Payment-on-Account Launch Scope**
**DEC-17:** **APPROVED — Audit Retention Period**
**DEC-18 through DEC-22:** **REQUIRE USER DECISION**
**BL-06 / BL-07:** **BLOCKED**
**Application code changed by this review:** **NO**
**Database or migrations changed by this review:** **NO**