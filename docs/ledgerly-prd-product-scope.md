# Ledgerly PRD / Product Scope

**Authority level:** 3 — beneath the Product Principles and above the Technical
Architecture  
**Status:** Living governance document established by Decision 1 on 2026-08-21  
**Launch-scope status:** Not fully approved  
**Implementation authority:** None

## Purpose

This document records Ledgerly's intended product outcome, capability boundaries,
and scope decisions. It is based on the Manifesto, Product Principles, existing
governance documents, the Living Product Decisions Register, the product gap
analysis, and the Master Backlog.

It deliberately does not turn current implementation, recommendations, or
provisional directions into approved launch commitments. Every unresolved item is
marked **REQUIRES USER DECISION**.

## Product outcome

Ledgerly is intended to make running a business easier by providing a calm,
trustworthy accounting product that helps business owners understand, control,
and grow their business with confidence.

The product is accounting-first. It must provide accurate and auditable
financial information, explain what matters, reduce routine effort, and retain
user control over consequential actions. Ask is intended to provide a universal
way to find, understand, and safely act on product capabilities.

## Established product boundaries

The following commitments are established by the Manifesto and recorded
governance:

- Accounting accuracy, traceability, and user trust take priority over feature
  count or automation.
- AI may assist, explain, recommend, classify, analyse, and prepare drafts. It
  must not silently make consequential financial decisions or send consequential
  external communications without the required control.
- Rules precede AI for deterministic accounting outcomes.
- Major product capabilities should explain what happened, why it matters, and
  what the user can do next.
- The product must use business language and must not expose technical internals
  to customers.
- Financial years and accounting periods are required product concepts, with
  controlled reopening, posting restrictions, and an audit trail. The detailed
  policy remains a technical and product decision.
- Consequential accounting, AI, VAT, reconciliation, correction, and external
  communication actions must be auditable.

## Intended capability areas

The existing roadmap, feature matrix, and backlog identify the following
capability areas as the product landscape. Their inclusion here does **not**
approve each one for launch or authorise implementation:

| Capability area | Product intent supported by existing documentation | Current decision state |
| --- | --- | --- |
| Accounting foundation | Authoritative financial records, controlled corrections, periods, configuration, and reporting. | **REQUIRES USER DECISION** for the BL-06/BL-07 accounting-core design and policies. |
| Sales and purchases | Invoices, bills, credit notes, payments, allocation, and related customer/supplier workflows. | Core direction exists; detailed lifecycle and launch scope remain **REQUIRES USER DECISION**. |
| Banking and reconciliation | Manual/CSV bank evidence, controlled matching, categorisation, transfers, and reconciliation. | Existing product direction; live banking/feed scope is **REQUIRES USER DECISION**. |
| VAT | Deterministic, auditable VAT evidence and return preparation. | UK VAT direction is provisional; supported schemes, adjustments, and MTD/HMRC scope are **REQUIRES USER DECISION**. |
| Reporting | Financial and management reporting that explains the business and is traceable to authoritative records. | Required direction; final report scope and journal authority depend on BL-06/BL-07. |
| Documents and communications | Documents, extraction/review, approved sending, and durable audit trails. | Providers, inbound handling, retention, and launch scope are **REQUIRES USER DECISION**. |
| Ask and AI Accountant | Search, explanation, safe assistance, recommendations, tasks, and contextual actions. | Assistant/approval boundary is established; action coverage and delivery sequencing remain **REQUIRES USER DECISION**. |
| Workspaces and experience | Consistent business-object workspaces, responsive design, accessibility, and clear next actions. | Established quality direction; per-feature delivery remains subject to approved specifications. |

## Current product direction that is not final scope

The following directions are recorded in the Living Product Decisions Register,
but remain provisional, open, deferred, or future. They must not be treated as
approved launch scope:

- Final product name: Ledgerly or Ledgerpoint.
- UK small and medium-sized businesses as the launch market.
- GBP as the launch currency, without full multi-currency until separately
  approved.
- Quotes, purchase orders, a shared contacts model, and reusable
  products/services/items.
- The exact UK VAT scheme set and MTD/HMRC filing scope.
- Live Open Banking requirements and provider.
- Email, inbound-mail, document-storage, and OCR providers.
- Payment-provider, advanced expenses, payroll, inventory, fixed-assets,
  budgeting, and forecasting scope.
- Notification delivery and escalation policy.
- Retention, deletion/anonymisation, export, backup/recovery, and RLS policy.

## Launch-scope decisions still required

The following remain **REQUIRES USER DECISION** before they can constrain
implementation:

1. Final name and launch positioning.
2. Supported countries, tax regimes, and currencies.
3. The launch capability set and explicit exclusions.
4. Supported VAT schemes, adjustments, exports, and MTD/HMRC filing scope.
5. The role/capability model for consequential accounting actions.
6. The financial-year, period close/reopen, and year-end policy.
7. The chart template, control-account mappings, and configuration versioning.
8. Source freshness, overpayment, unapplied cash, refund, and
   payment-on-account treatment.
9. Audit retention, deletion/anonymisation, export, backup/recovery, and tenant
   isolation policy.
10. Legacy accounting-data compatibility, migration cohort, and cutover policy.

The [pre-implementation decision pack](ledgerly-accounting-core-decision-pack.md)
is the detailed decision record for items 5–10 as they affect BL-06 and BL-07.

## Scope governance

Feature specifications and Master Backlog items define individual work only
within this document's boundaries. They cannot establish a missing product
decision. Existing code and a feature's presence in the application are evidence
of current state, not approval of its intended scope.

No capability may be implemented solely because it appears in this document,
the roadmap, feature matrix, or backlog. It still requires an approved
implementation task and satisfaction of the higher governance documents.

## Amendments

This is a living document. Any scope amendment requires an explicit, documented
decision that identifies consequences for:

- existing implementation;
- accounting data;
- database/schema;
- migrations;
- backwards compatibility;
- dependent features; and
- Master Backlog items.

The amendment record must update affected decisions, specifications, and backlog
dependencies before implementation direction changes. It does not independently
authorise application, schema, migration, UI, workflow, or deployment work.