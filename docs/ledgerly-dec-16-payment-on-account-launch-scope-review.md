# DEC-16 Payment-on-Account Launch Scope Review

**Decision:** DEC-16 — Payment-on-Account Launch Scope
**Status:** **REQUIRES USER DECISION**
**Review date:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting, security,
and architecture review
**Implementation authority:** None

> This is a decision-only review. It does not approve DEC-16 or DEC-17 through
> DEC-22, and it does not authorise an implementation task, code, schema,
> migration, accounting logic, UI, workflow, dependency, deployment, or
> publishing work.

## 1. Purpose and scope

DEC-16 must decide whether Ledgerly should expose **user-facing
payment-on-account** at launch for customers, suppliers, or both.

DEC-13 already approved the accounting representation for customer credits and
supplier prepayments. DEC-14 already approved the unapplied-cash workflow.
DEC-15 already approved controlled refunds from approved refundable balances.
DEC-16 therefore concerns product naming, user intent, launch scope, and
workflow presentation rather than a replacement accounting model.

This review covers:

- the meaning of payment-on-account;
- customer and supplier use cases;
- launch-scope options;
- user-facing labels and workflows;
- allocation, refund, credit-note, VAT, reporting, and bank boundaries;
- permissions, audit, periods, configuration, migration, and extensibility.

DEC-16 does not decide:

- the accounting representation already established by DEC-13;
- the unapplied-cash workflow already established by DEC-14;
- the refund policy already established by DEC-15;
- later decisions from DEC-17 through DEC-22;
- source freshness/posting safety;
- implementation, schema, API, UI, or deployment details.

## 2. Existing authority

### Already decided

- **DEC-03:** VAT remains document-driven under the approved UK invoice-basis
  scope. Calling a payment “on account” must not create a VAT event.
- **DEC-04:** Accounting remains canonical, balanced, server-generated,
  source-linked, idempotent, and immutable. A payment-on-account label must not
  create an artificial journal.
- **DEC-05:** Creation, classification, allocation, reallocation, refund,
  clearing, and adjustment use company-scoped server-side capabilities.
- **DEC-06 and DEC-07:** Payment, allocation, and refund dates respect approved
  financial-year and open/closed-period controls.
- **DEC-08:** Year-end remains reporting-only.
- **DEC-09 and DEC-10:** Stable account identities and approved AR/AP,
  bank/cash, customer-credit, and supplier-prepayment mappings remain
  authoritative.
- **DEC-11:** Material configuration is immutable, effective-dated, selected
  by canonical posting date, and retained with resolved account IDs.
- **DEC-12:** Payment evidence, accounting payment, allocation, and settlement
  remain distinct. Settlement is derived and allocation is non-duplicating.
- **DEC-13:** Customer excess is a customer-credit liability and supplier
  excess is a supplier-prepayment asset. Known-party payment may exist before a
  document is identified.
- **DEC-14:** Unapplied cash is reviewed through a dedicated workflow.
  Deterministic rules are authoritative, allocation is explicit, and no
  silent automatic allocation occurs at launch.
- **DEC-15:** Refunds use approved refundable balances, explicit approval,
  canonical cash journals, immutable correction, and no silent automation at
  launch.

### Product meaning

Payment-on-account is a deliberate business instruction that a known-party
payment is intended to remain available for future invoices or bills. It is
not merely a technical status for a payment with no match.

## 3. Definitions and distinctions

| Concept | Meaning | User-facing implication |
| --- | --- | --- |
| **Bank evidence** | A bank-feed record not yet authorised as accounting | Remains unresolved evidence and cannot become payment-on-account |
| **Accounting payment** | A validated, posted money receipt/payment | Has a source, party, date, amount, and canonical journal |
| **Unapplied payment** | A known-party payment or remainder not allocated to a document | Managed by DEC-14; absence of a match does not prove deliberate future use |
| **Customer credit** | DEC-13 customer-credit/receipt-on-account liability | Available party balance that may later be allocated or refunded under approved policy |
| **Supplier prepayment** | DEC-13 supplier-prepayment/receivable asset | Available party balance that may later be allocated or refunded under approved policy |
| **Payment-on-account** | A deliberate user-facing designation that a known-party payment is held for future documents | Product intent and presentation, not a replacement accounting object |
| **Allocation** | A relationship between a payment/party balance and an eligible invoice or bill | Changes open-item and derived settlement views, not original cash |
| **Refund** | A controlled money movement against an approved refundable balance | Governed by DEC-15, not by the payment-on-account label |
| **Credit note** | An approved document reducing or crediting an invoice/bill | May create a party credit; is not itself payment-on-account or a bank refund |

Payment-on-account must not be used as a synonym for:

- unknown bank evidence;
- an unclassified payment;
- an unmatched payment;
- every customer credit;
- every supplier prepayment;
- a credit note;
- a refund; or
- a settled or partially settled invoice/bill.

## 4. Customer payment-on-account

### Business meaning

A customer payment-on-account is an intentional advance, deposit, retainer, or
prepayment held for future customer invoices. The customer and accounting
payment are known, but the specific invoice may not yet exist or may not yet
be selected.

### Accounting consequence

The recommended model does not create a new accounting object or duplicate
cash journal. It presents an intentional purpose over the DEC-13 customer-
credit liability. The original receipt remains posted once.

When later allocated to an invoice, the DEC-13/DEC-14 customer-credit
reclassification applies where required:

**DR Customer Credit / Receipt-on-Account Liability**
**CR Accounts Receivable**

The later allocation does not repost the original cash receipt.

### User consequence

If enabled by a future decision, a user could explicitly choose “Hold for
future invoices” after identifying the customer and payment. The UI should
explain the available amount and next actions without exposing account names
or journal mechanics to normal users.

At the recommended launch scope, the same business need is supported through
known-party payment and customer-credit/unapplied-cash workflows, without
adding a separate payment-on-account product label.

## 5. Supplier payment-on-account

### Business meaning

A supplier payment-on-account is an intentional deposit, advance, or
prepayment held for future supplier bills.

### Accounting consequence

The recommended model does not create a new accounting object or duplicate
cash journal. It presents an intentional purpose over the DEC-13 supplier-
prepayment asset. The original payment remains posted once.

When later allocated to a bill, the DEC-13/DEC-14 supplier-prepayment
reclassification applies where required:

**DR Accounts Payable**
**CR Supplier Prepayment / Receivable Asset**

The later allocation does not repost the original cash payment.

### User consequence

If enabled by a future decision, a user could explicitly choose “Hold for
future bills” after identifying the supplier and payment. The available
prepayment would remain separate from ordinary aged payables.

At the recommended launch scope, the same business need is supported through
known-party payment and supplier-prepayment/unapplied-cash workflows, without
adding a separate payment-on-account product label.

## 6. Launch-scope options

### Option A — No user-facing payment-on-account at launch

Support the underlying DEC-13 customer-credit and supplier-prepayment
representation through DEC-14, but do not expose “payment-on-account” as a
separate product feature or classification at launch.

- **Accounting:** Simplest; no duplicate object or journal. Known-party
  payments, customer credits, and supplier prepayments remain authoritative.
- **Data/schema:** Reuses approved payment, allocation, party-balance, and
  audit concepts. Avoids premature purpose-state and lifecycle fields.
- **Migration:** Does not require inventing historical user intent. Evidence-
  backed credits and prepayments remain the migration concern.
- **Reporting:** Existing DEC-13/14 separation remains clear. Customer credits
  and supplier prepayments stay out of ordinary aged AR/AP.
- **VAT:** No new VAT consequence; DEC-03 remains sole authority.
- **UX:** Fewer labels and fewer choices. Users resolve known-party balances
  through the unapplied-cash workspace.
- **Operations:** Smaller support and exception surface; no separate
  payment-on-account queue or policy to explain.
- **Audit/security:** Existing DEC-05 capability and DEC-14 audit boundaries
  remain sufficient.
- **Future flexibility:** Can add an intentional purpose classification later
  over the same accounting representation.
- **Harder to change later:** Customer-facing language and historical intent
  will not be captured before a later decision; that is an accepted tradeoff.

### Option B — Customer payment-on-account only

Expose deliberate customer advances or deposits while continuing to treat
supplier prepayments through DEC-14.

- **Accounting:** Reuses customer-credit liability, but creates asymmetric
  customer/supplier concepts and more opportunities for inconsistent balances.
- **Data/schema:** Needs purpose, lifecycle, user-intent, and migration handling
  for customer payments only.
- **Migration:** Historical customer credit cannot automatically be labelled
  payment-on-account without evidence.
- **Reporting:** Customer statements gain another classification while supplier
  statements use a different model; clear mapping is required.
- **VAT:** No VAT event merely from the label, but users may assume an advance
  has a tax effect.
- **UX:** Helpful for customer deposits and retainers, but introduces a
  customer-only concept that may confuse supplier workflows.
- **Operations:** Requires customer-specific support, permissions, and refund
  explanations.
- **Audit/security:** User intent and later changes require additional audit
  events; DEC-05 still governs consequential actions.
- **Future flexibility:** Provides a path to supplier support but risks
  preserving asymmetry.
- **Harder to change later:** Supplier support and shared terminology may
  require relabelling or data migration.

### Option C — Customer and supplier payment-on-account

Expose deliberate future-use payment designation for both directions.

- **Accounting:** Can reuse DEC-13 liability/asset balances without duplicate
  cash, provided the designation remains a user-facing classification.
- **Data/schema:** Requires shared purpose, state, allocation, refund,
  cancellation, audit, and reporting semantics for both parties.
- **Migration:** Requires evidence for historical intent on both sides.
- **Reporting:** Can be consistent if both balances remain separate from aged
  AR/AP and the designation does not become a second accounting authority.
- **VAT:** Still no VAT event from the designation, but broader UX increases
  the need for explanatory controls.
- **UX:** Most complete for businesses using deposits and advances, but adds
  another decision and label on top of DEC-14.
- **Operations:** Larger support, training, review, and exception surface.
- **Audit/security:** More intentional-classification changes and refund
  interactions need audit and capability handling.
- **Future flexibility:** Best supports deposits, retainers, advances, and
  payment methods if the shared model is sound.
- **Harder to change later:** Once users rely on the label, removing or
  redefining it becomes disruptive.

### Option D — Payment-on-account as a separate accounting object

Create separate accounting objects and postings solely for the product state.

- **Accounting:** Risks duplicate cash, customer-credit, supplier-prepayment,
  allocation, and refund accounting; conflicts with DEC-13.
- **Data/schema:** Highest complexity, with parallel balances and reconciliation
  relationships.
- **Migration:** Requires reconstructing historical user intent and object
  boundaries that may not exist.
- **Reporting:** High risk of contradictory balances between subledger and
  canonical journals.
- **VAT:** High risk of accidental tax treatment from a product state.
- **UX:** Appears explicit but exposes a technical model that users do not need.
- **Operations:** Highest exception, correction, support, and reconciliation
  burden.
- **Audit/security:** More surfaces to secure and reconcile.
- **Future flexibility:** Looks flexible but makes later simplification and
  correction difficult.
- **Harder to change later:** Very difficult; not recommended.

## 7. Recommended launch scope

Recommend **Option A: no separate user-facing payment-on-account feature at
launch**.

This does not reject the business need for advances, deposits, retainers, or
prepayments. It means the launch product uses:

- known-party accounting payments;
- DEC-14 unapplied-cash review;
- DEC-13 customer-credit liabilities;
- DEC-13 supplier-prepayment assets;
- explicit allocation;
- DEC-15 refunds; and
- clear party-balance presentation.

The recommendation is based on the Ledgerly Manifesto:

- users need a clear next action, not another ambiguous status;
- rules must determine accounting validity;
- the product should not expose unnecessary accounting jargon;
- the smallest correct launch scope is preferable to a parallel workflow;
- no user intent should be inferred from an unmatched payment; and
- future flexibility should be preserved without committing to premature
  classification semantics.

If stakeholders consider customer deposits or supplier advances essential to
the initial market proposition, Option C is the preferable fallback over
Option B because it keeps the product model symmetrical. Even then,
payment-on-account should remain a classification over DEC-13 balances, not a
new accounting object.

## 8. User experience under the recommended scope

At launch, users should:

1. identify the customer or supplier;
2. record or review the known-party payment through the approved payment path;
3. use the DEC-14 Unapplied Cash workspace when no document is available;
4. see “customer credit” or “supplier prepayment” in business language;
5. allocate explicitly when an eligible invoice or bill exists; and
6. use DEC-15 refund workflow when an approved refundable balance should be
   returned.

Do not show “payment-on-account” as a separate required choice or imply that
an unmatched payment was intentionally held for future use.

Do not expose:

- liability or asset account names to normal users;
- journal construction;
- internal subledger identifiers; or
- implementation states as business decisions.

If a later approved decision enables payment-on-account, the user-facing
experience should:

- use “customer advance” or “supplier advance” only where that language is
  clear for the market;
- explain that the payment is being held for future invoices or bills;
- show the available balance and source;
- link to allocation and DEC-15 refund actions;
- distinguish it from unresolved bank evidence; and
- avoid presenting it as an invoice, bill, or settlement status.

## 9. Allocation

Payment-on-account, if later approved, must allocate through DEC-12 and
DEC-14:

Example:

- customer intentionally holds £1,000 for future invoices;
- Invoice A is later issued for £700;
- £700 is explicitly allocated;
- £300 remains as available customer credit or future-use balance.

The accounting effect is the DEC-13 customer-credit reclassification where
required. The original £1,000 cash receipt is not reposted.

The supplier equivalent applies to an advance held against later bills.

Allocation must respect:

- payment remainder;
- eligible document open amount;
- party and direction;
- currency;
- document eligibility;
- period controls;
- capability;
- stale-data and idempotency checks; and
- append-only history.

An allocation changes document settlement only through DEC-12 derived data. It
does not make a payment-on-account label itself a settlement state.

## 10. Refunds

DEC-15 remains authoritative.

If a future payment-on-account designation is refundable:

- the available refundable balance must be established from the underlying
  DEC-13 customer-credit or supplier-prepayment balance;
- refund amount cannot exceed that balance;
- DEC-05 approval and DEC-15 lifecycle controls apply;
- customer refund accounting debits customer-credit liability and credits
  bank/cash;
- supplier refund receipt accounting debits bank/cash and credits supplier-
  prepayment asset; and
- bank evidence is reconciled to the existing canonical refund posting.

DEC-16 does not approve automatic refunds, a new refund source, or a new VAT
rule.

## 11. Credit notes and VAT

A payment-on-account designation does not create VAT.

- A credit note remains a document under DEC-03 and its applicable policy.
- A credit note may create or increase a party credit where authorised.
- A pure payment advance or overpayment does not require a credit note merely
  because it is held for future use.
- A refund following a commercial correction uses the approved credit-note and
  VAT treatment before the DEC-15 refund.
- A refund of a pure overpayment remains a refund of customer credit and does
  not itself create VAT.
- Supplier advances, supplier credit notes, and supplier refund receipts
  remain distinct.

Questions about special VAT schemes, cross-border supplies, payment timing,
or new document types remain outside DEC-16 unless separately approved under
DEC-03 or a later decision.

## 12. Balances and reporting

Under the recommended launch scope:

- customer credits remain separate from ordinary aged receivables;
- supplier prepayments remain separate from ordinary aged payables;
- customer and supplier statements explain the balance and available next
  actions;
- invoices and bills never appear negatively outstanding merely because a
  party has paid in advance;
- Balance Sheet, Trial Balance, and General Ledger use canonical DEC-13
  liability/asset accounts;
- AR/AP reports use authoritative open-item data;
- cash/bank reporting shows actual payment and refund movements; and
- historical reports derive from canonical accounting rather than an inferred
  payment-on-account label.

If payment-on-account is later approved as a user-facing classification, it
may be shown as a sublabel or purpose on the relevant customer-credit or
supplier-prepayment balance. It must not create a contradictory balance or a
second aging category without an approved reporting decision.

## 13. Bank reconciliation

Maintain these separate stages:

1. bank evidence;
2. authorised accounting payment;
3. optional user-facing payment-on-account intent, if later approved;
4. unapplied/customer-credit or supplier-prepayment balance;
5. allocation; and
6. refund.

An unknown bank row must not become payment-on-account merely because it has
not been matched. A known-party accounting payment may be classified or
managed through DEC-14, but reconciliation must not create duplicate
accounting.

For a later approved payment-on-account classification, bank evidence remains
the provenance of the payment, not the accounting state itself.

## 14. Periods and configuration

Payment posting uses its validated payment date and DEC-07 period.
Classification as payment-on-account, if later approved, must not bypass
posting controls.

Allocation uses DEC-14 and must not rewrite a closed-period report. Refunds
use DEC-15 posting and open-period controls. Any canonical reclassification
uses its own validated posting date and open period.

Where material account configuration is involved:

- resolve the DEC-11 configuration version by canonical posting date;
- use approved DEC-10 customer-credit, supplier-prepayment, AR/AP, and
  bank/cash mappings; and
- retain resolved account IDs and configuration context on canonical postings.

## 15. Permissions and audit

### Permissions

Under the recommended scope, use DEC-05 capabilities for:

- identifying a known party;
- recording or confirming a known-party payment;
- allocating and reallocating;
- refunding;
- clearing or adjusting; and
- any future explicit payment-on-account classification.

If payment-on-account is later approved, its classification should require the
same or a proportionate capability as identifying a known-party payment. It
must not grant allocation or refund authority automatically.

Allocation, reallocation, refund, clearing, and adjustment retain their
existing DEC-05/DEC-14/DEC-15 controls. Higher-risk actions require elevated
approval and, where appropriate, separation of duties.

### Audit

Immutable audit must preserve:

- party and payment identity;
- whether payment-on-account intent was explicitly selected, if supported;
- source evidence;
- amount, currency, and dates;
- allocation and reallocation history;
- refund relationship;
- actor, company scope, capability, reason, approval, and timestamps; and
- canonical journal, configuration, and resolved account links where
  accounting is affected.

Do not infer or backfill user intent from a current customer-credit or
supplier-prepayment balance.

## 16. Migration

Under the recommended launch scope, historical records are migrated as
evidence-backed payments, customer credits, supplier prepayments, allocations,
refunds, and credit notes. They are not relabelled payment-on-account unless
a later approved policy defines an evidence threshold and the historical
record proves deliberate intent.

Never invent:

- historical payment-on-account intent;
- customer deposits;
- supplier deposits;
- advance-payment labels;
- allocation relationships;
- refund relationships; or
- historical approval.

Ambiguity becomes an explicit DEC-22 migration exception. DEC-22 retains
authority for evidence thresholds, cohorts, cutover, rollback, and legacy
authority retirement.

## 17. Future extensibility

Deferring the user-facing feature must not prevent future:

- customer deposits and retainers;
- supplier advances;
- recurring payments;
- explicit payment-on-account purpose;
- automated allocation under a separate approved policy;
- DEC-15 refunds;
- additional payment methods;
- additional currencies; or
- additional markets.

The safe extensibility rule is to add a user-facing intent/classification over
the existing DEC-13/DEC-14 model, not to create parallel cash, credit,
prepayment, allocation, or settlement accounting.

## 18. Recommendation — not approval

Recommend **Option A: do not expose user-facing payment-on-account as a
separate launch feature**.

At launch, Ledgerly should satisfy the underlying business need through:

1. known-party accounting payments;
2. the DEC-14 Unapplied Cash workspace;
3. customer-credit and supplier-prepayment balances under DEC-13;
4. explicit allocation and append-only reallocation;
5. DEC-15 controlled refunds; and
6. clear business-language explanations of available balances.

Do not infer deliberate payment-on-account intent from an unmatched payment.
Do not create a separate accounting object or journal for a product label.
Preserve a future path for an explicit, symmetrical customer-and-supplier
classification if later evidence shows that it is necessary for the initial
market proposition.

This recommendation is **not approval**.

## 19. Decision boundaries

### Already decided

DEC-03 through DEC-15, including document-driven VAT, canonical journals,
capabilities, periods, protected mappings, configuration versioning,
payment/allocation/settlement separation, customer-credit and supplier-
prepayment representation, unapplied-cash workflow, and refund policy.

### Recommended

No separate user-facing payment-on-account feature at launch. Use DEC-13 and
DEC-14 balances and workflows, keep the product language clear, and preserve a
future classification over the same accounting model.

### Requires user decision

Whether to expose payment-on-account at launch and, if so, whether the scope
is customer-only or customer-and-supplier.

### Deliberately left open

- **DEC-17 onward:** later product, accounting, security, and operational
  decisions;
- **DEC-22:** migration evidence, exceptions, cohort, cutover, rollback, and
  legacy authority retirement;
- source freshness/posting safety;
- exact labels, thresholds, capabilities, schema, APIs, UI, tests,
  dependencies, deployment, publishing, and implementation tasks.

### What approving DEC-16 would lock in

- the selected customer/supplier launch scope;
- the distinction between deliberate payment-on-account intent and unapplied
  cash/customer credit/supplier prepayment;
- the user-facing labels and entry points;
- whether payment-on-account is a classification over DEC-13 balances or
  deferred entirely;
- its allocation and DEC-15 refund hand-offs;
- reporting and statement presentation; and
- migration treatment for historical intent.

### What remains changeable

Future deposits, retainers, supplier advances, recurring payments, labels,
matching and allocation automation, refund interaction, payment methods,
currencies, markets, and detailed implementation design.

## 20. Decision readiness

DEC-16 is ready for an explicit user decision. Until it is approved or amended:

- DEC-17 through DEC-22 remain untouched and unresolved;
- BL-06 and BL-07 remain **BLOCKED**;
- no payment-on-account feature, UI, schema, migration, or accounting
  mechanism may be implemented; and
- no implementation task is authorised.

**DEC-01 through DEC-15:** **APPROVED**
**DEC-16:** **REQUIRES USER DECISION**
**DEC-17 through DEC-22:** **REQUIRE USER DECISION**
**BL-06 / BL-07:** **BLOCKED**
**Application code changed by this review:** **NO**
**Database or migrations changed by this review:** **NO**