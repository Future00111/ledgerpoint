# Ledgerly 70-Area Feature Matrix

This matrix records the state found during the read-only product gap analysis.

## Column key

- **Status:** A fully implemented; A* complete within a limited phase contract; B partial; C UI exists/backend incomplete; D backend exists/UI incomplete; E placeholder/mock/demo; F missing/deferred.
- **Current:** what exists now.
- **Workflow:** the actual user journey currently supported.
- **B/D/UI/A/T:** backend, database, UI, automation, and test evidence.
- **Gap:** what prevents product completion.
- **Dependencies:** prerequisite work.
- **Priority:** P0 critical foundation, P1 core product, P2 important, P3 scope-gated/future.

## Matrix

| # | Feature | Status | Current / workflow | B/D/UI/A/T | Gap | Dependencies | Priority |
|---:|---|---|---|---|---|---|---|
| 1 | Authentication & onboarding | B | Clerk sign-in/sign-up/sign-out and protected routes work; first-company setup is partial. | B: Clerk middleware; D: company/member data; UI: active; A: none; T: browser smoke. | Resume-safe onboarding, complete recovery handoff, first-run guidance. | Company and role model. | P0 |
| 2 | Company management | B | Create/select/edit company and company settings exist. | B: `companies.ts`; D: companies/company_users; UI: Companies/Settings; A: limited; T: API/browser. | Inactive membership defect, safe field validation, archive lifecycle. | Permission contract. | P0 |
| 3 | Users, teams and permissions | B | Invite/list/deactivate members and assign coarse roles. | B/D: member routes/table; UI: Users & Roles; A: no granular policy; T: partial API. | Role allowlist, capability matrix, inactive-member revocation, UI gating. | Active membership and company scope. | P0 |
| 4 | Dashboard | B | Financial Command Centre/widgets render and link to modules. | B: aggregates; D: source entities; UI: dashboard widgets; A: limited; T: browser smoke. | Authoritative metrics, definitions, drill-downs, live report lineage. | Posting/reporting. | P1 |
| 5 | Customers | B | Customer create/edit/list and invoice selection work. | B/D: Customer CRUD/table; UI: Customers; A: none; T: no frontend suite. | Full Customer Workspace, statements, contacts, timeline, Ask. | AR and Workspace engine. | P1 |
| 6 | Suppliers | B | Supplier create/edit/list and bill selection work. | B/D: Supplier CRUD/table; UI: Suppliers; A: none; T: no frontend suite. | Supplier Workspace, statements, contacts, AP workflow. | AP and Workspace engine. | P1 |
| 7 | Contacts | F | No separate unified contact model/workflow found. | B/D/UI/A/T: absent as independent module. | Decide whether contacts are separate or party subrecords. | Customer/supplier scope decision. | P2 |
| 8 | Sales invoices | B | Create/edit/save/view/post invoice; reconciliation updates balance fields. | B: invoice/functions; D: invoices/lines; UI: forms/detail/PDF; A: no journal; T: partial scenarios. | Server-calculated totals, immutable posting, AR/cash journals, send/delivery, allocation. | P0 authority, periods. | P0 |
| 9 | Credit notes | B | Sales and supplier credit-note registers/forms exist. | B/D: credit-note entities; UI: forms/registers; A: no complete allocation; T: limited matcher exclusions. | Post, allocate, reverse balance/VAT, journal, audit. | Invoice/bill posting. | P1 |
| 10 | Quotes/estimates | F | No active quote entity or workflow found. | B/D/UI/A/T: absent. | Decide whether quote-to-invoice lifecycle is required. | Product scope decision. | P2 |
| 11 | Purchase bills | B | Create/edit/save/post bill; reconciliation updates balance fields. | B: bill posting/functions; D: bills/lines; UI: forms/registers; A: no AP journal; T: partial scenarios. | Server-calculated totals, AP/cost journals, approval, allocation, statements. | P0 authority, periods. | P0 |
| 12 | Purchase orders | F | No active purchase-order entity or workflow found. | B/D/UI/A/T: absent. | Decide whether order-to-bill matching is required. | Supplier/items scope decision. | P3 |
| 13 | Products/services/items | F | No dedicated item catalogue found. | B/D/UI/A/T: absent as product module. | Item model, defaults, pricing, tax/account snapshots. | Sales/purchases scope decision. | P2 |
| 14 | Bank accounts | B | Manual bank account CRUD and account transaction registers exist. | B/D: BankAccount; UI: BankAccounts; A: no live feed; T: browser route. | Feed/provider decision, balances, account reconciliation and Workspace. | Banking decision. | P1 |
| 15 | Bank transaction importing | B | CSV mapping → preview → duplicate check → persistence works. | B: import functions; D: BankTransaction; UI: ImportCSVDialog; A: analysis after import; T: limited browser. | Mapping recovery, import audit, provider feed decision. | Bank accounts. | P1 |
| 16 | Bank transaction management | B | Browse/filter/edit and open reconciliation. | B/D: generic/protected routes; UI: register; A: limited; T: API scenarios. | Strong validation, bulk operations, lifecycle/audit controls. | Banking authority. | P1 |
| 17 | Transaction categorisation | B | Suggestions/account-code recommendations exist. | B: categorise/AI services; D: learning/suggestion logs; UI: review cards; A: no posting; T: scenario coverage. | Approved category → balanced journal → report/VAT effect. | Posting engine, chart. | P0 |
| 18 | Bank reconciliation | A* | Match one/multiple invoices/bills/credits, partials, confidence, individual/batch approval. | B: matcher/approval; D: bank/review/task data; UI: Reconciliation; A: Phase 5–6; T: strong scenarios. | General-ledger/cash effects, complete rationale UI, frontend regression coverage. | Posting engine. | P0 |
| 19 | Transfers | B | Internal transfers detected and excluded from income/expense/VAT. | B: transfer detection; D: transaction metadata; UI: indicators; A: no pairing; T: Phase 6 scenarios. | Pair both accounts and create controlled inter-account movement. | Banking/posting. | P1 |
| 20 | Recurring transactions | B | Recurring patterns detected and flagged. | B: recurrence analysis; D: analysis/task data; UI: indicators; A: detection only; T: Phase 6 scenarios. | Templates, schedule, generated drafts, approval, idempotency. | Posting/automation. | P1 |
| 21 | Chart of accounts | B | Account records can be viewed/created/edited. | B/D: ChartOfAccount; UI: ChartOfAccounts; A: not used consistently; T: limited. | Account validation, system accounts, posting/report integration. | Accounting authority. | P0 |
| 22 | Accounting configuration | C | Company/VAT/settings fragments exist. | B/D: company/tax fields; UI: Settings; A: none; T: limited. | Fiscal year, numbering, default accounts, posting controls. | Scope and chart decisions. | P1 |
| 23 | VAT configuration | B | Standard invoice-basis VAT profile/rules/settings exist. | B: VAT settings/rules; D: tax tables; UI: settings; A: limited scheme; T: VAT scenarios. | Decide supported schemes and enforce effective-dated rules. | VAT decisions. | P1 |
| 24 | VAT calculations | B | Deterministic calculations from invoice/bill evidence. | B: `vat.ts`/`vatMath.ts`; D: VAT data; UI: returns; A: refresh/manual; T: VAT scenarios. | Authoritative posted data and complete scheme support. | Posting, scheme decision. | P0 |
| 25 | VAT returns | B | Create/recalculate/review return records. | B/D: VAT return services/tables; UI: returns/detail; A: explicit refresh; T: integration tests. | Complete lifecycle, failure recovery, export/filing decision. | VAT authority. | P0 |
| 26 | VAT review/approval/locking | B | Ready/approve/lock/revision/audit mechanisms exist. | B: locking; D: audits/revisions; UI: detail; A: approval; T: concurrency tests. | Final live-source freshness check before approval. | Source authority. | P0 |
| 27 | VAT evidence and drill-downs | B | Matched invoices/bills are intended evidence authority. | B/D: evidence/audit links; UI: partial VAT detail; A: no evidence pack; T: VAT scenarios. | Box-level drill-down, evidence export, source-change visibility. | Posting and reports. | P1 |
| 28 | Collections | B | Overdue analysis, customer health, and reminder drafting exist. | B: collections services; D: tasks/analysis; UI: Collections/dialog; A: no send; T: collections scenarios. | Manual approved send, delivery log, follow-up, statements/aging. | AR, email decision. | P1 |
| 29 | Payments | B | Reconciliation updates paid/part-paid/balance fields. | B: payment update; D: invoice/bill fields; UI: reconciliation-driven; A: no standalone run; T: scenarios. | Manual payment, allocation, cash/AR/AP journals, audit. | Posting engine. | P0 |
| 30 | Customer balances | B | Invoice amount-paid/balance fields update after matching. | B/D: invoice balance; UI: invoice/customer views; A: aggregate only; T: matching scenarios. | Ledger-derived balances, statement, aging, credit allocation. | Payment allocation/AR. | P1 |
| 31 | Supplier balances | B | Bill amount-paid/balance fields update after matching. | B/D: bill balance; UI: bill/supplier views; A: aggregate only; T: matching scenarios. | Ledger-derived balances, supplier statement, aging, credits. | Payment allocation/AP. | P1 |
| 32 | Accounts receivable | B | Unpaid invoices and collections provide initial AR view. | B/D: invoices/collections; UI: Collections; A: no formal ledger; T: limited. | Formal AR ledger, aging, statements, journal reconciliation. | Posting/payment. | P1 |
| 33 | Accounts payable | C | Bills register exists without full payable management. | B/D: bills; UI: register; A: no AP report/run; T: limited. | AP ledger, aging, statements, payment run, reconciliation. | Posting/payment. | P1 |
| 34 | Journals | B | Manual journal form and General Ledger page exist. | B/D: JournalEntry; UI: GeneralLedger/manual form; A: manual only; T: limited. | Double-entry enforcement and operational posting integration. | Chart, periods, posting engine. | P0 |
| 35 | Adjustments | C | VAT adjustments exist; no general accounting adjustment workflow. | B/D: VAT adjustments; UI: VAT-focused; A: no general scheduler; T: VAT tests. | General adjustments, approvals, reversals, period policy. | Journals/periods. | P1 |
| 36 | Periods/financial years | F | No dedicated period-close or financial-year workflow found. | B/D/UI/A/T: absent as dedicated module. | Fiscal calendar, close/reopen, year-end rules. | Accounting authority. | P0 |
| 37 | Accounting reports | C | Reports page and export utilities exist. | B: export helpers/aggregates; D: source data; UI: Reports; A: no authoritative statements; T: no report suite. | Journal-backed report definitions and drill-down. | Journals/periods. | P0 |
| 38 | Management reports | C | Dashboard-style indicators exist. | B: aggregates; D: mixed sources; UI: widgets; A: limited; T: browser smoke. | KPI definitions, comparisons, saved views, lineage. | Reporting authority. | P1 |
| 39 | Profit & Loss | F | No verified authoritative P&L workflow found. | B/D/UI/A/T: not established as journal-backed statement. | Revenue/cost statement by period with drill-down. | Journals, chart, periods. | P0 |
| 40 | Balance Sheet | F | No verified authoritative Balance Sheet workflow found. | B/D/UI/A/T: not established as journal-backed statement. | Assets/liabilities/equity as-of reporting. | Journals, periods. | P0 |
| 41 | Trial Balance | F | No verified authoritative Trial Balance workflow found. | B/D/UI/A/T: not established as journal-backed statement. | Debit/credit report and balancing checks. | Journals, chart, periods. | P0 |
| 42 | General Ledger | B | Manual journal/general-ledger view exists. | B/D: JournalEntry; UI: GeneralLedger; A: manual only; T: limited. | Automatic operational posting, account drill-down, period controls. | Posting engine. | P0 |
| 43 | VAT reports | B | VAT return information and export helpers exist. | B/D: VAT services; UI: VAT pages; A: refresh/manual; T: VAT tests. | Filing-quality report/evidence package. | VAT authority/reporting. | P1 |
| 44 | Aged debtors | C | Collections exposes overdue/risk information. | B: invoice/collection data; UI: Collections; A: no formal aging; T: limited. | Configurable aging report and statements. | AR/payment. | P1 |
| 45 | Aged creditors | F | No active aged-creditor report found. | B/D/UI/A/T: absent. | Supplier aging report and drill-down. | AP/payment. | P1 |
| 46 | Cash/bank reporting | C | Bank accounts and transactions are visible. | B/D: bank records; UI: banking pages; A: no cash report; T: route smoke. | Reconciled cash position and cashflow report. | Banking/posting. | P1 |
| 47 | Search | B | Selected list search exists; generic helper supports limited search. | B: scalar/`$in`; D: entity data; UI: page search; A: none; T: no frontend suite. | Universal fuzzy/grouped search and contextual actions. | Stable entity/workspace model. | P2 |
| 48 | Filters | B | Per-page filters exist. | B: limited query operators; D: entity data; UI: list filters; A: none; T: no frontend suite. | Date/range/status operators, saved views, no silent ignored operators. | Search/query contract. | P2 |
| 49 | Exports | B | CSV/PDF/XLSX report utilities and invoice PDF exist. | B: export helpers; D: report/source data; UI: export controls; A: limited; T: no parity suite. | Authoritative data, permission policy, export audit, broader import/export. | Reporting. | P1 |
| 50 | Document generation | B | Invoice documents/PDF and report export exist. | B: PDF/helpers; D: document links; UI: invoice/detail; A: no delivery; T: limited. | Branded templates, immutable issued copy, delivery status. | Document storage/email. | P1 |
| 51 | AI Accountant | B | Analysis, tasks, review, collections, reconciliation and settings exist. | B: AI services; D: AI/task data; UI: AI pages; A: analysis after import; T: strong scenarios. | Consistent cross-product action handoff and source-linked explanations. | Authoritative reports/data. | P1 |
| 52 | AI task queue | B | Task summaries, priorities, confidence groups, review pages. | B/D: task engine/data; UI: Inbox/Tasks/Reviews; A: refresh/manual; T: service scenarios. | Pagination, complete lifecycle, broader task categories. | AI source coverage. | P1 |
| 53 | AI explanations | B | Explain services and some rationale cards exist. | B: explain service; D: analysis; UI: partial rationale; A: no universal explain; T: limited. | Explain every recommendation with evidence and uncertainty. | AI/source data. | P1 |
| 54 | AI approvals | B | Protected reconciliation/VAT/task decisions use explicit approvals. | B: approval services; D: audit records; UI: action controls; A: approval; T: integration scenarios. | Uniform freshness/permission confirmation and complete action coverage. | Phase A authority. | P0 |
| 55 | AI automation | B | Analysis settings and analysis-after-import exist; auto-reconciliation remains off. | B: settings/analysis; D: automation data; UI: AI settings; A: limited; T: Phase 6. | Scheduler, observability, event freshness, user controls. | Automation framework. | P1 |
| 56 | Collections automation | C | Draft reminder and analysis UI exist; no verified send automation. | B: collection analysis; D: tasks; UI: reminder dialog; A: none; T: collection scenarios. | Approved manual send/logging before automation. | Email provider/AR. | P2 |
| 57 | Bank automation | B | Import-triggered analysis and recurring/transfer detection. | B: Phase 6 services; D: analysis/task data; UI: import/reconciliation; A: partial; T: Phase 6. | Feed integration, failure monitoring, configurable rules. | Banking decision. | P1 |
| 58 | Reconciliation automation | B | Automatic analysis and high-confidence batch approval foundation. | B: matcher/approval; D: analysis; UI: batch review; A: auto-analysis only; T: Phase 5–6. | Mature confidence policy and category-to-ledger workflow. | Posting engine. | P1 |
| 59 | Recurring transaction automation | C | Recurrence detection only. | B: detector; D: analysis; UI: indicators; A: no generation; T: Phase 6. | Templates, schedules, drafts, approval, idempotency. | Posting/automation. | P2 |
| 60 | Notifications | E | Settings/UI indicates future capability. | B/D/A/T: no active notification platform; UI: coming soon. | Notification model, preferences, channels, audit. | Automation decisions. | P2 |
| 61 | Tasks | B | AI task records and workflow activity exist. | B/D: task/workflow entities; UI: task pages; A: AI only; T: service scenarios. | General assignments, due dates, notifications, object linkage. | Notification model. | P2 |
| 62 | Audit trail | B | VAT, reconciliation, workflow, and approval audits exist. | B/D: audit/activity tables; UI: partial; A: domain-specific; T: service tests. | Universal append-only audit viewer and mutation coverage. | All domain writes. | P1 |
| 63 | Activity history | B | Workflow activity and selected timelines exist. | B/D: activity data; UI: partial Workspace/timeline; A: limited; T: no frontend suite. | Consistent object timeline and filters. | Workspace engine. | P2 |
| 64 | Company settings | B | Company/member/VAT/automation settings exist. | B/D: company/settings data; UI: Settings; A: limited; T: API/browser. | Safe allowlists, capability gating, complete accounting configuration. | Phase A/config. | P0 |
| 65 | User settings | C | Clerk profile/account information is displayed. | B: Clerk; D: external user; UI: Settings; A: Clerk-managed; T: browser smoke. | Preferences, notification controls, complete account UX. | Notification decision. | P2 |
| 66 | Import/export | B | CSV import and selected PDF/CSV/XLSX exports work. | B/UI: import/export helpers; D: source records; A: limited; T: import/scenario tests. | General importer, correction/retry, mappings, audit. | Entity contracts. | P1 |
| 67 | Error handling | B | Inline errors and generic API failures exist. | B: generic errors; D: route responses; UI: partial; A: no retry policy; T: limited. | Typed business errors, retry/recovery, no raw messages. | API contract. | P1 |
| 68 | Empty states | B | Major audited pages have empty states. | B/D: source-dependent; UI: dashboard/VAT/AI/collections/reconciliation; A: no global standard; T: browser smoke. | Consistent instructional empty states throughout product. | UX standards. | P2 |
| 69 | Loading states | B | Spinners/skeletons exist on major screens. | B/D: route data; UI: loading states; A: no cancellation; T: browser smoke. | Partial-load recovery, cancellation, no silent AI fallback. | API/UI state model. | P1 |
| 70 | Responsive/mobile experience | B | Responsive shell and collapsing navigation exist; desktop smoke passed. | B/D: same APIs; UI: responsive styles; A: limited; T: no mobile suite. | Dense reconciliation/AI layouts, mobile workflows, accessibility. | Stable IA and UI tests. | P1 |

## Matrix conclusion

The highest-value gaps are not additional registers. They are:

1. authoritative financial writes;
2. active-member and capability enforcement;
3. immutable journals and periods;
4. complete payment/allocation effects;
5. journal-backed VAT and reporting;
6. Workspace/Ask completion;
7. integrations and automation with explicit approval;
8. frontend workflow and mobile coverage.