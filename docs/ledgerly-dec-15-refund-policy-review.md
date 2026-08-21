# DEC-15 Refund Policy Review

**Decision:** DEC-15 — Refund Policy
**Status:** **APPROVED — product/accounting policy only**
**Review date:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting, security,
and architecture review
**Implementation authority:** None

> This records an approved product/accounting policy. It does not approve
> DEC-17 through DEC-22, and it does not authorise an implementation task, code,
> migration, accounting logic, UI, workflow, dependency, deployment, or
> publishing work.

## 1. Purpose and scope

DEC-15 must define Ledgerly's policy for returning money to a customer or
recognising money returned by a supplier while preserving the DEC-04 canonical
journal model.

The review covers:

- the definition of a refund;
- customer and supplier refund sources;
- accounting treatment;
- credit-note and payment-reversal boundaries;
- approval and amount controls;
- refund lifecycle and failure handling;
- bank evidence and reconciliation;
- reporting, VAT, permissions, audit, and migration; and
- safe hand-offs to DEC-16 payment-on-account.

DEC-15 does not decide:

- user-facing payment-on-account launch scope, which remains DEC-16;
- any later decision from DEC-17 through DEC-22;
- source-freshness/posting-safety policy;
- the complete credit-note policy where that is owned by another decision;
- implementation, schema, API, UI, workflow, or deployment details.

## 2. Existing authority

### Already decided

- **DEC-03:** UK standard invoice-basis VAT remains document-driven. A refund
  must not create a second VAT engine or directly invent VAT treatment.
- **DEC-04:** Refund accounting must use balanced, server-generated,
  source-linked, idempotent, immutable journals with controlled reversals and
  corrections.
- **DEC-05:** Refund initiation, approval, posting, reversal, and correction
  require company-scoped server-side capabilities and audit.
- **DEC-06 and DEC-07:** Refund posting dates use the approved financial-year
  and accounting-period controls. Closed periods cannot be bypassed.
- **DEC-08:** Year-end remains reporting-only.
- **DEC-09 and DEC-10:** Stable accounts and protected bank/cash, AR/AP,
  customer-credit, and supplier-prepayment mappings remain authoritative.
- **DEC-11:** Material account configuration is immutable, effective-dated,
  selected by canonical posting date, and retained with resolved account IDs.
- **DEC-12:** Payment evidence, accounting payment, allocation, and settlement
  remain distinct. Reconciliation must not duplicate accounting.
- **DEC-13:** Customer excess is a customer-credit/receipt-on-account
  liability; supplier excess is a supplier-prepayment/receivable asset. Excess
  must not be discarded or capped.
- **DEC-14:** A dedicated unapplied-cash workflow is authoritative for review
  and allocation. Allocation is explicit, deterministic, capability-controlled,
  and not silently automated.

### Existing product and technical evidence

Existing invoice, credit-note, payment, banking, reconciliation, and VAT
paths are compatibility evidence only. Existing paid/due fields, bank
matching, or reconciliation states must not independently authorise a refund.

## 3. Definitions and distinctions

| Concept | Precise meaning | Refund consequence |
| --- | --- | --- |
| **Refund** | A controlled return or receipt of money against an existing customer-credit, supplier-prepayment, or other approved refundable balance | Creates a separate canonical money-movement event |
| **Customer refund** | Money paid out to a customer from an available refundable customer balance | Reduces the customer-credit liability and cash when posted |
| **Supplier refund** | Money received from a supplier against an available supplier prepayment or approved supplier refund source | Reduces the supplier-prepayment asset and increases cash when posted |
| **Payment reversal** | A correction of an erroneous or invalid payment posting | Corrects accounting; it is not a customer-service refund |
| **Allocation reversal** | Removal or supersession of a payment-to-document relationship | Changes allocation history and settlement; it does not by itself move cash |
| **Credit note** | An authorised source document that reduces or credits an invoice/bill under the applicable document and VAT policy | May create or increase an available party credit; is not itself a bank refund |
| **Customer credit** | DEC-13 customer-credit/receipt-on-account liability | Can be a refund source if refundable under this policy |
| **Supplier prepayment** | DEC-13 supplier-prepayment/receivable asset | Can be a supplier-refund source if refundable under this policy |
| **Unapplied cash** | A known-party payment remainder managed through DEC-14 | Must be converted to an approved refundable balance before refunding |
| **Bank evidence** | A bank-feed record not yet authorised as accounting | Cannot itself create or authorise a refund |

A refund must represent a genuine movement of money or a separately authorised
accounting correction. It must not be created merely to change a screen
balance, conceal an erroneous posting, or force an invoice or bill to settle.

## 4. Recommended refund scope

Recommend supporting two distinct launch workflows:

1. **Customer refund:** an outbound refund from an available customer credit
   or other approved refundable customer balance.
2. **Supplier refund receipt:** an incoming amount returned by a supplier
   against an available supplier prepayment or approved supplier refund source.

Recommend that a refund is not permitted directly from:

- an unmatched bank row;
- ordinary unpaid AR or AP;
- a negative or unavailable party balance;
- an unapproved credit note or return;
- an unposted payment; or
- an accounting correction that should use reversal/correction mechanics.

The workflow should be explicit and approval-first. It should not promise that
every historical, credit-note, payment-on-account, or cross-currency scenario
is supported at launch.

## 5. Customer refunds

### Customer-credit refund

Permit a customer refund up to the available refundable customer-credit
balance. The customer credit may originate from:

- a genuine customer overpayment;
- an unapplied customer payment;
- an approved customer credit note; or
- another later-approved source explicitly marked refundable.

The workflow must show the source, available amount, prior allocations,
proposed refund amount, bank/cash source, approval state, and resulting
balance.

### Settled or partially paid invoice

A settled or partially paid invoice does not by itself authorise a refund.
Where the commercial reason is a return, cancellation, price correction, or
other reduction of supply, an approved credit note or other authorised source
must establish the customer credit under the applicable document/VAT policy.
The resulting credit may then be refunded through this policy.

For a pure duplicate or excess receipt with no supply adjustment, a credit
note should not be invented solely to make the refund possible. The genuine
customer credit remains the refund source and VAT remains unchanged under
DEC-03.

### No invoice exists

A known-party payment with no invoice may be refunded only from an available
customer-credit balance after the party, payment, evidence, amount, and
refund authority are validated. An invoice must not be invented.

### Future payment-on-account

If DEC-16 later approves a user-facing payment-on-account workflow, its
refundable balance may connect to this refund workflow only through an
approved extension. DEC-15 does not approve payment-on-account scope.

## 6. Supplier refunds

A supplier refund is money returned by a supplier, not a customer-style
outbound payment. It may relate to:

- a supplier overpayment;
- an unapplied supplier payment;
- a supplier prepayment;
- an approved supplier credit note; or
- another approved supplier-return source.

The workflow must show supplier, source prepayment or credit, expected refund
amount, incoming bank/cash account, evidence, approval state, and resulting
prepayment balance.

A supplier credit note may reduce a bill or create a supplier-side credit
under the applicable document policy. It is not itself proof that money has
arrived. The incoming bank transaction remains evidence until reconciled to
the posted supplier refund.

Do not use a supplier refund to make AP or an expense negative. Do not treat
money returned by a supplier as revenue.

## 7. Refund source

Every refund must identify its source and destination:

### Customer refund

- source: available customer-credit liability or another explicitly approved
  customer refundable balance;
- destination: validated bank/cash account;
- evidence: authorised refund request plus bank payment evidence when
  available.

### Supplier refund

- source: available supplier-prepayment/receivable asset or another explicitly
  approved supplier refundable balance;
- destination: validated bank/cash account receiving the supplier's money;
- evidence: supplier confirmation, bank evidence, or other approved support.

The workflow must not create money that did not previously exist in the
accounting model. A pending request is not cash and does not reduce a balance
until the approved posting event occurs.

## 8. Canonical accounting treatment

### Customer refund from customer credit

When the authorised customer refund is posted:

**DR Customer Credit / Receipt-on-Account Liability**
**CR Bank/Cash**

The debit may be to the specific approved customer-credit liability mapping
resolved under DEC-10 and DEC-11. The posting must link to the refund request,
customer credit, bank/cash account, actor/approval, and source evidence.

### Supplier refund received against supplier prepayment

When the supplier refund receipt is posted:

**DR Bank/Cash**
**CR Supplier Prepayment / Receivable Asset**

The credit may be to the specific approved supplier-prepayment asset mapping
resolved under DEC-10 and DEC-11. The posting must link to the supplier
refund, prepayment, bank evidence, actor/approval, and source evidence.

### Credit note relationship

If an approved credit note creates the party credit, the credit-note journal is
posted through its own canonical source. A later refund consumes that available
credit through the refund journal. Do not repost the credit note, original
payment, or original allocation merely because the credit is refunded.

### No duplicate posting

Reconciliation of the outgoing customer payment or incoming supplier refund
must link evidence to the existing refund posting. It must not create a second
refund, second cash movement, or duplicate AR/AP entry.

## 9. Refund versus credit note and allocation

| Action | What it does | What it does not do |
| --- | --- | --- |
| Credit note | Reduces or credits an invoice/bill under document policy | Does not prove that bank money was returned |
| Allocation | Links a payment or party balance to an eligible invoice/bill | Does not move money |
| Allocation reversal | Removes or supersedes that link | Does not refund cash |
| Customer credit | Holds an available customer liability balance | Is not automatically a refund request |
| Supplier prepayment | Holds an available supplier asset balance | Is not automatically a supplier refund |
| Refund | Moves money against an approved refundable balance | Does not correct an erroneous original journal |

A credit note may create a customer credit or affect supplier balances where
the applicable document policy permits. A refund may then consume that credit.
A refund does not always require a credit note: a genuine customer
overpayment can be refunded from the customer-credit liability without
inventing a supply adjustment. Conversely, a credit note is required where the
commercial and VAT treatment requires a document correction.

## 10. Refund versus payment reversal

### Erroneous payment

If a payment was created incorrectly, use a controlled correction or reversal
of the payment source. Preserve the original journal and explain the error.
Do not label that action a refund.

### Legitimate payment

If a legitimate customer payment is returned, use the refund workflow against
the available customer credit. If a supplier legitimately returns a
prepayment, use the supplier refund-receipt workflow.

### Incorrect allocation

If only the document link is wrong, use DEC-14 unallocation/reallocation.
Do not create a refund or reverse cash merely to change allocation.

The refund workflow must not provide a way to conceal a correction, rewrite
history, or reduce a screen balance without a canonical source event.

## 11. Refund amount limits

Support:

- a refund less than the available refundable balance;
- a refund exactly equal to the available refundable balance; and
- a supplier refund receipt less than or equal to the available refundable
  supplier balance.

Do not allow a customer refund or supplier refund application to exceed the
available refundable balance. Server-side validation must recheck the balance
under a lock or equivalent concurrency control at approval/posting time.

Reject:

- negative or zero refund amounts where no meaningful action exists;
- amounts above the available customer credit or supplier prepayment;
- stale requests whose balance has since been allocated, refunded, or adjusted;
- unsupported currency or bank account combinations; and
- duplicate refund commands.

The balance must never become negative merely to facilitate a refund.

## 12. Approval and lifecycle

### Recommended capabilities

- A user with ordinary DEC-05 capability may prepare a refund request.
- A user with elevated refund capability must approve a consequential refund.
- The same person should not prepare and approve a higher-risk refund.
- Clearing, adjusting, reversing, or correcting a completed refund requires
  elevated capability and an explicit reason.
- Exact monetary thresholds may be configured through a later approved
  capability/control policy; absent an approved threshold, elevated approval
  applies to every refund.

No frontend visibility or AI confidence grants authority.

### Recommended minimal lifecycle

1. **Requested:** refundable source and amount identified; no accounting cash
   movement yet.
2. **Approved:** required capability and approvals completed; balance remains
   protected from competing use.
3. **Posted:** canonical refund journal created in an open period.
4. **Completed:** bank evidence confirms the outbound customer payment or
   incoming supplier receipt and is reconciled.
5. **Failed:** the attempted bank movement did not complete; the accounting
   treatment is handled by the controlled failure path.
6. **Reversed:** a completed refund was later corrected through a new canonical
   reversal/correction event.

Cancellation before posting is a cancellation of the request, not a journal
deletion. Bank operational status must remain distinguishable from accounting
posting status.

## 13. Cancellation, failure, and reversal

### Cancelled before posting

Cancel the request with actor, reason, timestamp, and approval history. Do not
reduce the available balance and do not create a journal.

### Bank payment fails

Keep the refund request and attempted bank evidence. Do not silently retry or
create another refund. Use an explicit failure/recovery path that either:

- leaves the original balance available when no cash movement posted; or
- posts a controlled correction/reversal when a bank or accounting movement
  did post.

### Incorrectly completed refund

Never delete or rewrite the original refund journal. Use a controlled canonical
reversal or correction in an open period, with reason, capability, approval
where required, and links to the original refund and new evidence.

### Returned or disputed bank movement

Treat a returned bank movement as a new evidence and correction event. Do not
silently reopen or mutate the original refund record.

## 14. VAT and credit notes

DEC-03 remains the sole VAT authority.

- A pure overpayment refund does not create a new VAT event.
- A customer refund connected to a return, cancellation, price reduction, or
  other taxable-supply correction uses the approved credit-note/document
  treatment; the refund itself is not a second VAT engine.
- A supplier credit note follows the approved supplier-document treatment;
  receipt of supplier money does not create a new VAT rule.
- Customer and supplier refunds must not directly populate VAT return boxes
  unless the approved document/accounting source already does so.
- VAT treatment for special schemes, payment-on-account, cross-border cases,
  mixed tax treatment, or new refund scenarios remains outside this review
  unless separately covered by DEC-03 or a later approved decision.

No direct HMRC submission is introduced.

## 15. Bank reconciliation

### Customer refund

The outgoing bank transaction is evidence for the already posted customer
refund. Reconciliation links:

1. bank evidence;
2. bank/cash account;
3. refund record;
4. customer-credit source; and
5. canonical refund journal.

Matching must not post the refund again.

### Supplier refund

The incoming bank transaction remains evidence until reconciled to the posted
supplier refund receipt. Reconciliation links the bank evidence to:

1. supplier;
2. supplier prepayment or approved refund source;
3. refund record; and
4. canonical refund journal.

Unknown incoming or outgoing evidence remains unresolved under the relevant
bank/reconciliation workflow. It must not automatically create a refund.

## 16. Reporting and statements

Reports derive from canonical accounting data:

- **Customer statements:** show original invoices, payments, credit notes,
  customer-credit movements, refund requests, completed refunds, and
  reversals separately.
- **Supplier statements:** show bills, payments, credit notes,
  supplier-prepayment movements, supplier refund receipts, and reversals
  separately.
- **AR/AP:** refunds reduce the relevant customer-credit liability or
  supplier-prepayment asset; they do not make ordinary AR/AP negative.
- **Balance Sheet:** shows remaining customer-credit liability and
  supplier-prepayment asset, plus bank/cash movement.
- **Profit & Loss:** a pure overpayment/prepayment refund does not create
  income or expense. A credit-note source affects results only under its own
  approved document treatment.
- **Trial Balance and General Ledger:** include the canonical refund and any
  controlled reversal, never a duplicate reconciliation posting.
- **Cash/bank reporting:** reflects actual posted cash movement and separates
  pending evidence from completed reconciliation.

Pending requests must not appear as completed cash movements.

## 17. Periods and configuration

Refund journals use a validated posting date and DEC-07 open accounting
period. A refund cannot bypass a closed period through a UI action, bank
matching, approval, or scheduled retry.

Cancellation before posting has no accounting period effect. A completed
refund correction or reversal uses its own validated posting date and open
period, preserving the original history.

Where refund accounting uses material mappings:

- resolve the DEC-11 configuration version for the canonical posting date;
- use protected DEC-10 bank/cash, customer-credit, supplier-prepayment, and
  any document mappings; and
- retain resolved account IDs and configuration context on the posting.

## 18. Permissions and audit

### Permissions

Use DEC-05 server-side capabilities for:

- preparing a refund request;
- approving a customer refund;
- approving or recording a supplier refund receipt;
- posting or confirming a bank movement;
- cancelling before posting;
- reversing or correcting a completed refund; and
- clearing or adjusting a balance.

Recommend separation of duties for higher-risk refunds. Approval requirements
must be visible before confirmation and must not be inferred from frontend
role strings.

### Audit

Immutable audit history must retain:

- source balance and source evidence;
- customer or supplier identity;
- requested amount, currency, and bank/cash account;
- actor, company scope, capability, approval, reason, and timestamps;
- lifecycle transitions and failure details;
- canonical journal and configuration links;
- bank evidence and reconciliation outcome;
- cancellation, reversal, correction, or retry decisions; and
- the balance before and after each consequential event.

## 19. Migration

Historical refunds, customer credits, supplier prepayments, credit-note
relationships, approvals, and bank evidence may be migrated only where
evidence supports the party, amount, date, source, destination, accounting
treatment, and relationship.

Do not invent:

- historical refunds;
- historical approval;
- historical refund dates;
- historical credit or prepayment sources;
- historical bank completion;
- historical VAT treatment; or
- historical refund relationships.

Ambiguity becomes an explicit DEC-22 migration exception. DEC-22 retains
authority for migration evidence thresholds, cohorts, cutover, rollback, and
legacy authority retirement.

## 20. Options

### Option A — No refund workflow

- **Accounting:** Avoids refund journals but leaves genuine customer credits
  and supplier prepayments unresolved.
- **Data/migration:** Simplest launch shape but cannot represent historical
  refunds or operational outcomes consistently.
- **Reporting/VAT:** Balances remain accurate only if users handle refunds
  outside Ledgerly; statements become incomplete. VAT is not expanded.
- **Security/operations:** Low product risk but creates uncontrolled external
  processes and weak audit.
- **User experience/flexibility:** Poor for normal small-business needs and
  incompatible with first-class party balances.

### Option B — Credit-note-only refunds

- **Accounting:** Handles commercial corrections but cannot safely refund a
  pure overpayment without inventing a document.
- **Data/migration:** Reuses document relationships but conflates document
  correction with cash movement.
- **Reporting/VAT:** Risks incorrect VAT treatment for pure overpayments and
  incomplete cash reporting.
- **Security/operations:** Easier approval around documents but does not cover
  supplier prepayment returns or operational bank failure.
- **User experience/flexibility:** Understandable for returns, incomplete for
  customer credits and supplier refunds.

### Option C — Controlled refunds from approved balances

- **Accounting:** Uses customer-credit liability and supplier-prepayment asset
  as explicit sources, with one canonical cash journal per refund.
- **Data/migration:** Requires refund source, approval, lifecycle, bank
  evidence, and immutable correction links.
- **Reporting/VAT:** Keeps credits/prepayments distinct, makes cash outcomes
  visible, and leaves VAT with credit-note/document authority.
- **Security/operations:** Supports capabilities, separation of duties,
  amount limits, idempotency, failure paths, and reconciliation.
- **User experience/flexibility:** Resolves genuine balances without forcing
  fake invoices, while supporting later payment-on-account and bank methods.

### Option D — Automatic refunds

- **Accounting:** Increases risk of stale balances, duplicate money movement,
  and incorrect sources.
- **Data/migration:** Requires scheduling, mandates, retries, idempotency,
  provider state, and detailed recovery history.
- **Reporting/VAT:** Pending and failed states are easy to misrepresent.
- **Security/operations:** Material fraud, approval, bank, and segregation
  risks; difficult to make safe without separate policy.
- **User experience/flexibility:** Convenient but conflicts with approval-first
  principles unless separately designed and approved.

## 21. APPROVED POLICY

Approve **Option C: controlled customer and supplier refunds from approved
party balances**, with:

1. Customer refunds sourced only from an available customer-credit liability or
   another explicitly approved refundable customer balance.
2. Supplier refund receipts sourced only from an available supplier-prepayment
   asset or another explicitly approved refundable supplier balance.
3. A credit note used when the commercial/VAT correction requires one, but no
   credit note invented for a pure overpayment refund.
4. Payment reversals and allocation reversals kept separate from refunds.
5. Explicit request, approval, posting, completion, failure, and reversal
   lifecycle states, with bank operational status kept separate.
6. Refund amounts limited to the currently available refundable balance,
   revalidated at approval/posting time.
7. Normal-capability preparation and elevated approval, with separation of
   duties for higher-risk refunds.
8. One canonical refund journal per actual accounting event:
   customer-credit liability to bank/cash for customer refunds, and bank/cash
   to supplier-prepayment asset for supplier refund receipts.
9. Bank reconciliation linking evidence to the existing refund without
   duplicate accounting.
10. DEC-03 document-driven VAT treatment with no second VAT engine.
11. Immutable audit, controlled canonical corrections, DEC-07 periods,
    DEC-10 mappings, and DEC-11 configuration context.
12. No silent automatic refund execution at launch.

This policy is approved as a product/accounting decision only.

## 22. Decision boundaries

### Already decided

DEC-03 through DEC-14, including document-driven VAT, canonical journals,
capabilities, periods, protected mappings, configuration versioning,
payment/allocation/settlement separation, customer-credit and
supplier-prepayment representation, and the unapplied-cash workflow.

### Recommended

Controlled customer refunds and supplier refund receipts from approved
customer-credit or supplier-prepayment balances, with explicit approval,
amount limits, canonical cash journals, bank reconciliation, immutable
correction, and no silent automation at launch.

### Requires user decision

Approval of the recommended DEC-15 refund policy, including launch support for
customer refunds and supplier refund receipts.

### Deliberately left open

- **DEC-16:** user-facing payment-on-account scope and its refund interaction;
- **DEC-17 onward:** later product, accounting, security, and operational
  decisions;
- **DEC-22:** migration evidence, exceptions, cohort, cutover, rollback, and
  legacy authority retirement;
- source freshness/posting safety;
- detailed thresholds, provider integrations, capabilities, schema, APIs, UI,
  tests, dependencies, deployment, publishing, and implementation tasks.

### What DEC-15 approval locks in

- a refund is a genuine controlled money movement, not a screen adjustment;
- customer and supplier refunds remain distinct workflows;
- refunds require an approved existing refundable balance;
- payment reversals and allocation reversals remain separate;
- credit notes remain document/VAT sources rather than bank refunds;
- refund amounts cannot exceed available balances;
- explicit approval, canonical journals, period controls, bank evidence, and
  immutable audit are mandatory; and
- silent automatic refund execution is not allowed at launch.

### What remains changeable

Exact thresholds, provider and payment-method support, scheduling details,
notification design, user-facing labels, future automation safeguards,
payment-on-account interaction, and migration details.

## 23. Decision readiness

DEC-15 was explicitly approved on 2026-08-21. The approval is a
product/accounting-policy decision only. Until the applicable remaining
decisions are approved or amended:

- DEC-17 through DEC-22 remain untouched and unresolved;
- BL-06 and BL-07 remain **BLOCKED**;
- no refund workflow, UI, schema, migration, or accounting mechanism may be
  implemented; and
- no implementation task is authorised.

**DEC-01 through DEC-15:** **APPROVED**
**DEC-16:** **APPROVED — Payment-on-Account Launch Scope**
**DEC-17 through DEC-22:** **REQUIRE USER DECISION**
**BL-06 / BL-07:** **BLOCKED**
**Application code changed by this review:** **NO**
**Database or migrations changed by this review:** **NO**