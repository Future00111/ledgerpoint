# DEC-14 Unapplied Cash Workflow Policy Review

**Decision:** DEC-14 — Unapplied Cash Workflow Policy
**Status:** **APPROVED — product/accounting workflow policy only**
**Review date:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting, security,
and architecture review
**Implementation authority:** None

> This records an approved product/accounting workflow policy. It does not
> approve DEC-21 and DEC-22, and it does not authorise an implementation
> task, code, schema,
> migration, accounting logic, UI, workflow, dependency, deployment, or
> publishing work.

## 1. Purpose and scope

DEC-14 defines how users identify, review, manage, and allocate unapplied
customer and supplier cash after the accounting representation approved by
DEC-13 exists.

This review defines a proposed workflow for:

- identifying unapplied balances;
- distinguishing known parties from unknown evidence;
- locating candidate invoices and bills;
- allocating all or part of an unapplied balance;
- returning an allocation to unapplied status;
- preserving history and audit;
- presenting customer credits and supplier prepayments clearly; and
- keeping AI and automation approval-first.

DEC-14 does not decide:

- refund support, refund sources, refund VAT, or refund approval;
- user-facing payment-on-account launch scope;
- the accounting representation already established by DEC-13;
- source-freshness/posting-safety policy;
- migration/cutover policy under DEC-22; or
- any implementation detail.

## 2. Existing authority

### Already decided

- **DEC-03:** UK standard invoice-basis VAT remains document-driven. The
  unapplied-cash workflow must not create a second VAT engine.
- **DEC-04:** Canonical journals are balanced, server-generated, immutable,
  source-linked, and corrected through controlled mechanisms. UI workflow
  states do not justify artificial journal entries.
- **DEC-05:** Payment identification, allocation, reallocation, clearing, and
  other consequential actions require active company membership, company scope,
  server-side capabilities, validation, and audit.
- **DEC-06 and DEC-07:** Payment and accounting reclassification use validated
  posting dates and cannot bypass closed-period controls.
- **DEC-08:** Year-end is reporting-only.
- **DEC-09 and DEC-10:** Stable account identity and protected AR/AP/bank-cash
  mappings remain authoritative. Required customer-credit and supplier-
  prepayment mappings must be validated.
- **DEC-11:** Material posting configuration is immutable, effective-dated,
  selected by canonical posting date, and retained with resolved account IDs.
- **DEC-12:** Bank evidence, accounting payment, allocation, and settlement are
  distinct. Allocation is many-to-many, settlement is derived, and bank
  reconciliation must not duplicate accounting.
- **DEC-13:** Customer excess is a customer-credit/receipt-on-account
  liability; supplier excess is a supplier-prepayment/receivable asset.
  Known-party payments may exist before document allocation. Allocation cannot
  exceed eligible amounts, and later application uses controlled
  reclassification where accounting treatment changes.

### Workflow evidence

The existing product has bank reconciliation and AI analysis concepts, but
those are evidence and recommendation paths rather than an approved
unapplied-cash workflow. Existing invoice/bill paid and due fields, bank
matching fields, and current reconciliation states must not become independent
authorities for balances or settlement.

## 3. Definitions and workflow state boundary

| Concept | Precise meaning | User-facing consequence |
| --- | --- | --- |
| **Bank evidence awaiting reconciliation** | A bank-feed row whose party, purpose, or accounting treatment is not yet approved | Remains in evidence/review queue; no party credit or prepayment is created |
| **Known-party accounting payment** | A posted payment with validated party, direction, amount, date, evidence, and canonical journal | Can be reviewed and allocated even when no document is known |
| **Unallocated payment remainder** | The measurable portion of a posted payment not allocated to eligible documents | Appears as an available remainder |
| **Unapplied customer payment** | A customer payment or remainder not allocated to a specific customer invoice | Appears as customer credit after DEC-13 accounting treatment |
| **Unapplied supplier payment** | A supplier payment or remainder not allocated to a specific supplier bill | Appears as supplier prepayment/receivable after DEC-13 treatment |
| **Customer credit** | A customer-credit/receipt-on-account liability created by DEC-13 | Appears separately from aged receivables |
| **Supplier prepayment** | A supplier-prepayment/receivable asset created by DEC-13 | Appears separately from aged payables |
| **Workflow status** | Review progress such as needs information or ready to allocate | Operational metadata only; not accounting or settlement authority |
| **Settlement status** | Derived unpaid, partially paid, or fully settled document state under DEC-12 | Not independently editable |

Workflow status must never be used to infer that a bank row is a payment, that
a payment is a party credit, or that a document is settled.

## 4. Recommended launch experience

Recommend a dedicated **Unapplied Cash workspace** as the primary launch
experience, supported by contextual entry points:

1. **Unapplied Cash workspace:** one queue for customer credits and supplier
   prepayments, with filters for party, amount, age, reference, evidence,
   currency, status, and suggested matches.
2. **Bank reconciliation:** a bank row can open the relevant evidence,
   accounting payment, and remaining unapplied balance. A bank row without an
   approved payment remains evidence only.
3. **Customer and supplier accounts:** show available credit/prepayment,
   allocation history, and a clear “Allocate” action.
4. **Invoice and bill screens:** show eligible unapplied balances and allow a
   user to start an allocation review without changing accounting silently.
5. **Payment detail:** show payment total, allocated total, remaining amount,
   accounting journal, evidence, configuration context, and history.
6. **Notifications and Ask:** may point users to a queue item or explain a
   recommendation. They must not be the accounting authority or silently
   allocate money.

The workspace should make the next safe action obvious: identify party,
review suggested documents, allocate a chosen amount, request information, or
leave the balance unapplied. It should not force a match to make the queue
empty.

## 5. Known-party and unknown-party workflow

### Known party plus known payment

If the payment and party are known and the accounting payment is already
posted, show it in the relevant customer or supplier queue. The user may:

- review evidence and posting;
- allocate to eligible documents;
- allocate partially;
- leave a remainder unapplied;
- request more information; or
- open the audit trail.

If the payment is known but not yet posted, the authorised payment-posting
workflow must validate the payment and required DEC-10/DEC-11 context before
creating the canonical payment. The unapplied workflow must not bypass posting
validation.

### Known party plus payment but no document

Allow the user to retain the known-party payment as an unapplied customer
credit or supplier prepayment under DEC-13. Do not invent an invoice or bill.
The queue should explain:

- who the party is;
- what evidence supports the payment;
- the amount remaining;
- why there is no document allocation;
- which actions are available; and
- the date and audit history.

### Unknown party plus bank evidence

Keep the row in an evidence/classification queue. The user may identify the
party, classify the transaction, link an existing payment, or create an
authorised accounting payment where supported. Until that decision is made,
the row must not create customer credit, supplier prepayment, AR, AP, revenue,
expense, VAT, or a settlement state.

### Unknown party plus accounting payment

This should be an exception requiring review. The workflow must show the
payment's provenance and prevent allocation to a customer or supplier until
party identity and eligibility are validated. It must not silently guess from
description, amount, or an AI recommendation.

## 6. Customer workflow

For a customer payment with no invoice match:

1. show payment evidence, payment journal, customer, amount, currency, date,
   and current customer-credit remainder;
2. show deterministic candidate invoices, if any, with reasons and hard
   eligibility failures;
3. allow the user to choose one or more invoices and an amount for each;
4. validate payment remainder, invoice open amount, party, currency, period,
   and any required canonical reclassification;
5. show before/after customer credit, invoice balances, and settlement states;
6. require an explicit confirmation;
7. create the allocation/reclassification through the approved accounting
   boundary; and
8. display the retained audit history and remaining balance.

When a later customer invoice is created, the existing credit may be surfaced
as a contextual candidate, but it must not be allocated automatically merely
because the party and amount happen to match.

## 7. Supplier workflow

The supplier workflow mirrors the customer workflow:

1. show supplier payment evidence, payment journal, supplier, amount, currency,
   date, and prepayment remainder;
2. show eligible candidate bills and hard validation results;
3. allow one or more partial or full allocations;
4. validate payment remainder, bill open amount, supplier, currency, period,
   and required AP/prepayment reclassification;
5. show before/after supplier prepayment, bill balances, and settlement states;
6. require explicit confirmation;
7. create the allocation/reclassification through the canonical boundary; and
8. preserve audit and remaining balance.

When a later supplier bill is created, the prepayment can be surfaced as a
candidate without silently applying it.

## 8. Allocation workflow

The allocation screen should make the accounting and settlement boundary
visible:

- payment total;
- already allocated amount;
- available remainder;
- selected invoice/bill;
- document open amount;
- proposed allocation amount;
- remaining payment amount;
- remaining document amount;
- whether a canonical reclassification is required;
- resulting customer credit or supplier prepayment; and
- any period or configuration warning.

The user may allocate to one or multiple eligible documents, including partial
amounts. Server-side validation must reject:

- amounts above the payment remainder;
- amounts above document open amount;
- wrong party or direction;
- unsupported currency;
- inactive or ineligible documents;
- duplicate allocation commands;
- stale payment or document context; and
- closed-period accounting changes.

Confirmation must describe whether the action is:

1. allocation-only settlement linkage for a direct payment; or
2. allocation plus canonical reclassification from customer credit or supplier
   prepayment into AR/AP.

The workflow must never create a journal merely to update a screen status.

## 9. Unallocation and reallocation

Every removal or move must be an explicit action with a reason where required.
The workflow should show the original allocation, current allocation, proposed
replacement, affected balances, and any accounting reclassification.

### Direct payment

Moving a direct payment from Invoice A to Invoice B:

- preserves the original cash/AR journal;
- reverses or supersedes the A allocation;
- creates the replacement B allocation;
- recalculates settlement; and
- preserves both allocation events in history.

### Customer credit or supplier prepayment

Removing an allocation from an on-account balance reverses the relevant
reclassification and returns the amount to the available party balance.
Allocating it elsewhere creates a new controlled reclassification. The original
cash journal remains unchanged.

### Workflow rules

- Do not overwrite the original allocation.
- Do not silently change allocation dates to rewrite an earlier report.
- Show the before/after effect before confirmation.
- Require elevated capability for high-risk reallocation or clearing.
- Use the open accounting period for any canonical reclassification.
- If only a settlement relationship changes, preserve the allocation event
  without manufacturing cash/AR/AP accounting.

## 10. Search, matching, AI, and automation

### Deterministic eligibility

Rules must decide whether a candidate is eligible. Hard rules should include:

- company and party identity;
- customer versus supplier direction;
- document status and open amount;
- currency and amount precision;
- payment remainder;
- document date and posting/period constraints;
- duplicate or already-consumed allocation checks; and
- any source, credit-note, or configuration requirement.

### Deterministic suggestions

Recommend deterministic suggestions ranked using explainable signals such as:

- exact customer or supplier;
- exact invoice/bill number;
- exact or close amount;
- bank reference;
- payment reference;
- document date proximity;
- expected payment terms; and
- historical matching patterns, provided they do not override hard rules.

Every suggestion must show the signals used and the reasons other candidates
were excluded or ranked lower.

### AI recommendations

AI may:

- suggest a party or document candidate;
- explain a deterministic match;
- identify missing information;
- group related evidence; and
- recommend a next review action.

AI must not:

- override eligibility rules;
- create a payment or party credit silently;
- allocate or reallocate money without explicit authorised action;
- decide a refund;
- change a canonical journal; or
- turn an unknown bank row into a customer or supplier balance.

### Automatic allocation

Recommend **no silent automatic allocation at launch**. A future opt-in
automation policy may be considered only with deterministic rules, an explicit
company setting, capability control, visible scope, idempotency, immutable
audit, duplicate safeguards, exception routing, and an immediate review or
reversal path. That future policy must not be inferred from DEC-14 approval.

## 11. Customer credit and supplier prepayment views

The user should see a clearly labelled balance card:

### Customer credit

- customer name;
- available credit;
- source payments and evidence;
- allocations and remaining amounts;
- eligible future invoices;
- pending review items; and
- separate refund hand-off where later policy permits it.

The view must say that this is a customer-credit liability and is not an
overdue receivable or revenue.

### Supplier prepayment

- supplier name;
- available prepayment;
- source payments and evidence;
- allocations and remaining amounts;
- eligible future bills;
- pending review items; and
- separate refund/recovery hand-off where later policy permits it.

The view must say that this is a supplier-prepayment/receivable asset and is
not an overdue payable or expense.

## 12. Reporting and statements

All views must be derived from the same authoritative accounting, payment,
allocation, and open-item data:

- **Customer statements:** show invoices, applied receipts, customer-credit
  balance, allocation history, and later approved actions separately.
- **Supplier statements:** show bills, applied payments, supplier-prepayment
  balance, allocation history, and later approved actions separately.
- **Customer/supplier balance:** expose AR/AP and credit/prepayment components
  without presenting an unapplied balance as an unpaid document.
- **Aged receivables/payables:** exclude customer credits and supplier
  prepayments from overdue document aging while showing them separately.
- **Balance Sheet, Trial Balance, and General Ledger:** use DEC-13 canonical
  liability/asset accounts and any approved reclassification journals.
- **Bank reporting:** show cash and evidence/payment linkage without
  double-counting allocations.

An allocation-only workflow change may change current settlement and allocation
views, but as-of reporting must respect the effective history of the allocation
event. Current configuration and current workflow status must not recalculate
historical accounting.

## 13. Periods, accounting effects, and configuration

Initial payment posting uses the validated payment posting date and DEC-07
period. A closed period rejects ordinary payment posting.

An allocation-only event is dated as a workflow/allocation event and must not
rewrite an earlier closed-period report. When an allocation requires DEC-13
customer-credit or supplier-prepayment reclassification, the reclassification
uses its own validated posting date and must post in an open period.

Payment and reclassification behavior uses the DEC-11 configuration version
selected by canonical posting date. The canonical posting retains the resolved
account IDs. DEC-14 does not redesign DEC-10 or DEC-11.

## 14. Permissions and audit

### Permissions

Use DEC-05 server-side capabilities for:

- viewing company unapplied balances;
- identifying or confirming a party;
- allocating;
- unallocating;
- reallocating;
- clearing or adjusting a balance; and
- handing a balance to a later refund workflow.

Recommend normal capability for ordinary review and allocation. Recommend
elevated capability and proportionate approval for:

- reallocation with historical reporting impact;
- clearing, adjustment, or write-off;
- actions involving a closed-period exception; and
- any later refund action.

Do not grant authority through frontend controls, AI confidence alone, or
arbitrary role strings.

### Audit

Immutable audit history must retain:

- evidence and payment identity;
- party identification or correction;
- customer-credit/supplier-prepayment creation;
- candidate suggestions and selected/rejected match reasons;
- allocation, unallocation, and reallocation;
- old and new remainder and settlement states;
- any canonical reclassification and journal link;
- actor, capability, company, reason, approval, and timestamps; and
- DEC-11 configuration version and resolved account identities where
  accounting is affected.

## 15. Refund and payment-on-account hand-offs

DEC-14 must define safe hand-offs but must not decide later product policy.

### Refund hand-off

A customer-credit or supplier-prepayment view may expose a future refund
action or route, but DEC-14 does not decide whether a refund is supported, its
source, VAT, approval, or launch scope. DEC-15 owns those decisions. Any
future refund must use a separate controlled payment/canonical event and must
not edit the original receipt/payment.

### Payment-on-account hand-off

DEC-14 may show that an unapplied party balance is available for future use,
but must not approve or reject payment-on-account as a user-facing product
feature. DEC-16 owns whether customer and/or supplier payment-on-account
workflows launch.

## 16. Migration

Historical unapplied cash, customer credits, supplier prepayments, and
workflow actions may be migrated only where evidence supports the party,
amount, date, payment, account treatment, and allocation relationship.

Do not infer a workflow action from a current balance, an unmatched bank row,
or a current UI status. Do not invent historical suggestions, approvals,
allocations, unallocations, or party identification.

Ambiguous records become explicit DEC-22 migration exceptions. DEC-22 retains
authority for migration evidence thresholds, cohorts, cutover, rollback, and
legacy authority retirement.

## 17. Options

### Option A — Bank reconciliation as the only workflow

- **Accounting:** Keeps evidence close to matching but risks treating evidence
  as payment and cannot give a complete party-credit/prepayment view.
- **Data/migration:** Reuses current matching data but cannot reliably preserve
  workflow, allocation, or historical party-balance decisions.
- **Reporting/VAT:** Contextual screens can contradict statements and aging;
  VAT remains document-driven but evidence boundaries are easy to blur.
- **Security/operations:** Suitable for simple matches but weak for later
  allocation, reallocation, supplier prepayments, and audit.
- **User experience/flexibility:** Bank-centric and confusing when a document
  does not yet exist; difficult to extend to non-bank payments.

### Option B — Contextual allocation only from customer/supplier screens

- **Accounting:** Can respect DEC-12/DEC-13 when implemented correctly, but
  users lack a unified queue for balances needing attention.
- **Data/migration:** Reuses party/document records but makes unmatched or
  cross-document review difficult.
- **Reporting/security:** Statements may be clear, but audit and permissions
  must be duplicated across multiple screens.
- **User experience/flexibility:** Familiar in context, but poor for operations
  teams and future automation.

### Option C — Dedicated unapplied-cash workspace with contextual entry points

- **Accounting:** Centralises review while keeping evidence, payment,
  allocation, settlement, and reclassification distinct.
- **Data/migration:** Requires explicit workflow links and audit around the
  existing accounting model; legacy uncertainty can remain visible.
- **Reporting/VAT:** One queue can link to consistent customer, supplier,
  statement, aging, and ledger views without changing invoice-basis VAT.
- **Security/operations:** Provides one capability/audit boundary, deterministic
  eligibility, explicit confirmation, and exception routing.
- **User experience/flexibility:** Best supports owners, accountants, AI
  recommendations, later payment methods, currencies, and automation without
  silent financial action.

### Matching and automation alternatives

1. Manual-only allocation: safest but slowest and least helpful for volume.
2. Deterministic suggestions with manual confirmation: explainable, efficient,
   and preserves user control.
3. AI suggestions with deterministic hard rules: useful for ambiguous
   references, but must remain recommendations.
4. Automatic allocation: efficient for strict cases but introduces material
   control, reversal, stale-data, and audit risk; not recommended at launch.

## 18. APPROVED POLICY

Approve **Option C: a dedicated Unapplied Cash workspace with contextual
entry points**, combined with deterministic suggestions and explicit user
confirmation:

1. Keep bank evidence, accounting payment, unapplied balance, customer credit,
   supplier prepayment, allocation, refund, and settlement distinct.
2. Use one unified queue for customer credits and supplier prepayments, with
   bank reconciliation, party, invoice/bill, payment-detail, notification, and
   Ask entry points linking into it.
3. Keep unknown bank evidence unresolved until an authorised user establishes
   the party and accounting treatment.
4. Let known-party payments remain unapplied without inventing documents.
5. Allow manual one-to-many and many-to-one allocation, including partial
   amounts, subject to DEC-12 server-side limits.
6. Present deterministic candidate matches with explainable signals and hard
   eligibility failures.
7. Allow AI to recommend and explain, but never let it override rules or
   perform a consequential allocation silently.
8. Do not enable silent automatic allocation at launch. Preserve a future
   opt-in path with separate safeguards if later approved.
9. Treat direct-payment reallocation as an append-only settlement change and
   use canonical reclassification only when customer-credit or supplier-
   prepayment accounting genuinely changes.
10. Show customer credits separately from aged receivables and supplier
    prepayments separately from aged payables.
11. Use DEC-05 capabilities, DEC-07 period controls, DEC-10/DEC-11 account
    resolution, DEC-12 settlement rules, and DEC-13 accounting treatment.
12. Define only the hand-offs to DEC-15 refunds and DEC-16 payment-on-account;
    do not resolve those policies.

This policy is approved as a product/accounting workflow decision only.

## 19. Decision boundaries

### Already decided

DEC-03 through DEC-13, including invoice-basis VAT, immutable canonical
journals, capability controls, periods, stable account/mapping policy,
effective-dated configuration, payment/allocation separation, and customer-
credit/supplier-prepayment accounting.

### Recommended

A dedicated unapplied-cash workspace, contextual entry points, deterministic
eligibility and suggestions, explicit user-confirmed allocation, no silent
automatic allocation at launch, append-only workflow history, and clear
customer/supplier statements.

### Requires user decision

Approval of the recommended DEC-14 unapplied-cash workflow policy.

### Deliberately left open

- **DEC-15:** refund support, source, VAT, approval, reversal, and launch scope;
- **DEC-16:** customer and/or supplier payment-on-account user-facing scope;
- **DEC-22:** migration evidence, exceptions, cohort, cutover, rollback, and
  legacy authority retirement;
- source freshness/posting safety;
- detailed capability identifiers, UI, APIs, schema, workflow implementation,
  tests, dependencies, deployment, publishing, and implementation tasks.

### What DEC-14 approval locks in

- a unified workflow distinction between unknown bank evidence and known-party
  unapplied accounting payments;
- a dedicated review queue with contextual links;
- explicit user confirmation for allocation;
- deterministic rules as the authority for eligibility;
- AI as recommendation and explanation only;
- no silent automatic allocation at launch;
- append-only unallocation/reallocation history; and
- clear separation of customer credits/supplier prepayments from AR/AP aging.

### What remains changeable

Future queue presentation, matching signals, notification design, Ask
integration, supported payment methods/currencies, opt-in automation safeguards,
refund workflow, payment-on-account scope, and migration details.

## 20. Decision readiness

DEC-14 was explicitly approved on 2026-08-21. The approval is a
product/accounting workflow-policy decision only. Until the applicable
remaining decisions are approved or amended:

- DEC-21 and DEC-22 remain untouched and unresolved;
- BL-06 and BL-07 remain **BLOCKED**;
- no unapplied-cash workflow, UI, schema, migration, or accounting mechanism
  may be implemented; and
- no implementation task is authorised.

**DEC-01 through DEC-14:** **APPROVED**
**DEC-15:** **APPROVED — Refund Policy**
**DEC-16:** **APPROVED — Payment-on-Account Launch Scope**
**DEC-17:** **APPROVED — Audit Retention Period**
**DEC-18:** **APPROVED — Deletion and Anonymisation Policy**
**DEC-19:** **APPROVED — Export Policy**
**DEC-20:** **APPROVED — Backup and Recovery Policy**
**DEC-21 and DEC-22:** **REQUIRE USER DECISION**
**BL-06 / BL-07:** **BLOCKED**
**Application code changed by this review:** **NO**
**Database or migrations changed by this review:** **NO**