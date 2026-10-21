# Ledgerly active product plan

**Status:** Active delivery direction, set 2026-10-21  
**Authority:** The owner's product reset supersedes earlier delivery plans and conflicting launch-scope statements. Existing accounting, security, access, audit, and deployment policies remain in force unless separately revised.

## Product goal

Build a dependable UK accounting product for sole traders and small businesses. Small limited companies are included as a planning assumption, not a confirmed pilot cohort. The full public-release scope includes everyday accounting; Self Assessment and Making Tax Digital for Income Tax; VAT preparation and filing with receipts, status, and recovery; Corporation Tax computations, CT600, and accounts; end-to-end payroll; and AI assistance that saves time without deciding or recording consequential financial actions on the user's behalf.

The tax and payroll scope is a product target, not evidence that current calculations, filing authority, provider connections, or compliance are implemented. Existing policies still govern code until explicitly updated. In particular, DEC-03's previous exclusion of direct HMRC filing is superseded for delivery planning, but its supported tax treatments remain the present calculation boundary. Filing implementation needs its own rules for eligibility, consent, idempotency, receipts, amendments, failures, and audit before it can be enabled.

## Delivery milestones

1. **Working daily workflows and native runtime.** Complete the real invoice-draft create, edit, save, list, preview, and reopen journey; then migrate the remaining active Base44-shaped frontend calls to native Ledgerly services, preserving authentication, company access, and business behavior. Remove obsolete Base44 instructions. A Base44 name or adapter is not considered a migration.
2. **Complete accounting core.** Finish the supported invoice, bill, credit-note, payment, reconciliation, ledger, reporting, audit, and recovery journeys on the canonical accounting foundation. Posting, settlement, and VAT evidence keep their protected server-side boundaries.
3. **Tax coverage.** Deliver Self Assessment, MTD Income Tax, VAT filing and its receipts/status/recovery, and small-company Corporation Tax computations, CT600, and accounts. Define and test the exact supported cases before claiming filing or tax compliance.
4. **End-to-end payroll.** Assess a maintained payroll engine/provider against direct implementation before selecting an approach. Cover payroll calculation, review, payslips, PAYE/NI, statutory pay, RTI submissions and responses, corrections, and required pension workflows. No vendor is purchased or connected by this plan.
5. **AI assistance.** Apply across the workflows: source-linked capture and explanation, reviewable suggestions, and draft preparation. Deterministic rules remain authoritative for financial calculations; consequential posting, filing, payment, payroll, and external actions require informed approval and audit.
6. **Controlled pilot and public release.** Use synthetic data for development demonstrations. Any pilot is separately scoped and does not shrink the release target. Public release requires the full tax, VAT-filing, and payroll scope, recovery paths, access controls, testing, support, and operational readiness.

No forecast date in the earlier plans is a launch promise. Any later forecast assumes five focused delivery days per week and remains a planning estimate.

## Current implementation

**First delivery:** make invoice drafts genuinely usable through native Ledgerly services. Provide a clear create/edit/save/reopen flow, approved company VAT-code selection, accurate server totals, the existing invoice preview, and explicit loading, validation, save, and error states. Saving a draft must not issue, post, pay, reconcile, or imply that it has been posted.

Use only the company's explicit, effective-dated tax rules and the currently supported VAT treatments. A non-VAT route is valid only when its no-VAT reason is recorded. Do not infer VAT from the company default or a bank-feed rate. Exact-pence net and VAT results can be saved without a rounding decision; any line producing a fractional penny must fail clearly and leave no record until the owner resolves DEC-04 rounding semantics. Continue the UI, source integration, lifecycle checks, and isolated tests that do not depend on that choice.

The remaining active Base44 runtime migration is a continuing implementation milestone, not another approval package. Keep a visible inventory of actual SDK/runtime dependencies, imports, build configuration, service calls, and compatibility code. Historical documentation may retain Base44 references. Prove migrated journeys through the running app and focused checks; report any remaining runtime dependency honestly.

## Delivery and safety rules

- Work in small, reversible changes on a development branch: implement a feature, verify the running preview, run focused checks, and give a concise commit/PR summary. Avoid planning-only cycles and repeated approval requests for work already authorized.
- Preserve Clerk authentication, active membership, role/capability checks, company isolation, source freshness, immutable accounting records, and explicit user review for consequential actions. Never add an auth bypass or generic write path around a protected financial workflow.
- Use synthetic data and a disposable development database for database demonstrations. Do not migrate or write to an existing/shared database, use production or Helium data, or use real financial records for these tasks.
- Do not purchase/connect external providers, file with HMRC, move money, publish, deploy, merge, change GitHub protections, or enter Phase A without the separate action-specific authority those steps require. Keep existing frozen candidates and accepted G7 evidence unchanged. Development qualification does not automatically qualify later commits.
- Keep normal branch and repository protections. Never force-push, rewrite history, auto-merge, disable checks, or weaken access controls.

## Historical plan status

The phase roadmap, former PRD launch scope, master backlog, readiness review, and first-implementation package are retained as historical records. This plan is the single active delivery plan. Approved accounting/security decisions and frozen-candidate evidence remain separate and are not rewritten by the roadmap reset.
