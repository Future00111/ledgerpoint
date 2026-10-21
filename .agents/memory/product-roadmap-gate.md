---
name: Active product direction and policy boundaries
description: The owner reset Ledgerly's delivery scope on 2026-10-21 and authorized reversible implementation; existing accounting and security decisions still govern how features are built.
---

Decision 1 approved the living hierarchy of Manifesto → Product Principles →
PRD/Product Scope → Technical Architecture → Feature Specifications/Master
Backlog. DEC-02 approved the initial UK/GBP accounting scope: authoritative
core accounting, VAT preparation, invoices, bills, payments, banking,
reconciliation, and reporting. DEC-03 approves Standard VAT on invoice basis,
controlled source-linked and return-level corrections, and VAT
preparation/export without direct HMRC submission. DEC-04 approves the
accounting-core architecture foundation: canonical normalized append-only
journals, server-side transactional posting, immutable correction history,
deterministic VAT integration, journal-authoritative reporting, company-scoped
capability/audit boundaries, and additive evidence-based migration. Special VAT
schemes, specialist adjustments, and direct HMRC workflows remain future scope.
DEC-04 is architecture approval only. DEC-05 approves Option B: server-side
capabilities with conservative role presets, including active company scope,
posted-journal immutability, AI capability inheritance, auditable actions, and
conservative migration. DEC-06 approves the financial-year policy: 1 April to
31 March is the UK default, company-specific starts are supported before
posting, historical boundaries cannot be rebased through ordinary settings, and
changes require privileged audit controls. DEC-07 approves contiguous
company-scoped monthly periods, automated generation, OPEN/CLOSED states,
server-side posting-date assignment, audited close/reopen, and no direct
closed-period posting bypass. DEC-08 approves reporting-only year-end
treatment: no automatic closing or retained-earnings journals, canonical
history remains unchanged, and completion is an auditable derived condition.
DEC-09 approves the versioned, company-copied UK small-business Chart of
Accounts policy: six primary account types, stable identities independent of
names/codes, controlled lifecycle, no destructive deletion after use, no launch
account merging, protected system-account candidates, and journal-authoritative
reporting. DEC-10 approves protected company-scoped AR, AP, bank/cash, Output
VAT, and Input VAT mappings, with prospective-only capability-gated changes and
historical posting identity preserved. DEC-11 approves immutable,
company-scoped, effective-dated versions for material accounting configuration:
posting-date selection, no ordinary backdating over history, resolved account
IDs and version context retained on postings, and immutable audit. DEC-12
approves distinct payment evidence, accounting payment, allocation, and
settlement concepts; one canonical payment posting; non-duplicating,
many-to-many allocation; derived settlement; and immutable payment/allocation
history. DEC-13 approves no-loss excess handling: customer excess is a
customer-credit liability, supplier excess is a supplier-prepayment asset, and
known-party payments may exist before allocation without negative documents.
DEC-14 approves a dedicated unapplied-cash workspace with contextual entry
points, deterministic eligibility, explicit user confirmation, AI suggestions
only, and no silent automatic allocation at launch. DEC-15 approves controlled
customer refunds and supplier refund receipts only from approved refundable
party balances, with explicit approval, amount limits, canonical cash journals,
reconciliation, immutable correction, and no silent launch automation. DEC-16
approves no separate user-facing payment-on-account feature, workflow,
navigation item, accounting object, or journal type at launch; it relies on the
approved payment, credit/prepayment, unapplied-cash, allocation, and refund
foundation. DEC-17 approves class-based retention: authoritative accounting
evidence and necessary audit evidence are retained for company life plus the
applicable legal/regulatory period; personal data, documents, and AI evidence
have separate proportionate classes. DEC-18 approves controlled, class-based
disposal after retention expiry, with legal holds, protected canonical
accounting, and separate personal-data treatment. DEC-19 approves bounded,
company-scoped PDF/CSV reports plus CSV and versioned JSON accounting/audit
exports, without making exports accounting authority. DEC-20 approves managed,
encrypted, tested backup/recovery targets without implementation authority.
DEC-21 approves layered company isolation without implementation authority.
DEC-22 approves validated additive historical-data adapters and Ledgerly's
canonical journals as the authority after cutover.

The owner reset product direction on 2026-10-21: full UK small-business
accounting, Self Assessment/MTD Income Tax, VAT filing and recovery, small-company
Corporation Tax/CT600/accounts, end-to-end payroll, and approval-first AI.
Small limited companies are a planning assumption; pilot owners, cohort, and
capacity remain proposed. The active delivery plan is
`docs/ledgerly-active-product-plan.md`; prior PRD/backlog/phase sequencing is
historical for delivery.

The reset authorizes reversible feature work, not weakened safeguards. Preserve
Clerk authentication, active membership, role/capability checks, company
isolation, protected accounting/reconciliation writes, source freshness, audit,
posted-record immutability, and separate approvals for external actions. The
product target for direct HMRC filing supersedes the old exclusion as a roadmap
statement only; filing rules, consent, idempotency, receipts, amendments, and
recovery still need a specific implementation design. DEC-04 money and rounding
semantics remain unresolved; do not select calculation behavior silently.
Remove Base44-shaped active runtime usage starting with invoices, then migrate
remaining journeys to native Ledgerly services. Keep historical Base44 mentions.

**Why:** The owner explicitly replaced planning-only delivery holds with
reversible implementation, while preserving established financial and access
protections. The expanded tax/payroll scope is a product target, not proof of
implementation or compliance.

**How to apply:** Follow the active plan for delivery order. Build small working
features, run their preview and focused checks, then summarize the commit. Keep
unknown accounting policies and high-consequence external actions behind their
explicit decision and authorization boundaries.