# LedgerPoint launch plan — preparation draft, 2026-10-14

**DRAFT; owners, pilot scope and capacity remain PROPOSED. G5–G7 PENDING.**
This record authorizes no implementation, Phase A, merge, dispatch or launch.

## Source and preservation

Original attachment: `ledgerpoint-launch-plan_1791988313235.xlsx`.
Exact SHA-256:
`09f97f20b91fc6a62fb9e6fa2c3ad2330ef0054b6a76cda6476e06d99f4062e8`.
Byte-exact preserved copy:
`generated-artifacts/ledgerpoint-launch-plan/ledgerpoint-launch-plan.original.xlsx`.
The original attachment and workbook bytes were not edited.

Five sheets were read from XLSX XML without recalculating or rewriting the file:
Launch plan, Workstreams, Weekly schedule, Features and Evidence. Full extracted
values/formulas are retained in `workbook-extraction.json` beside the original.
The 70 feature rows remain reference scope, not 70 additive estimates. Feature
labels and findings from the workbook are source assessments, not automatically
verified implementation or customer-journey acceptance.

Local preparation starts from preserved workspace HEAD
`7bea71feb97e6d58753907f3a67cb76c9718389d` on separate branch
`records-planning/ledgerpoint-launch-g5-w03`, not main or a frozen candidate.
The workbook's source assessment was of integration
`085b7e0491d9adbbebcc7e8db384c575bcfa2aca`; current W03 findings below were
checked directly against this workspace, not assumed from that historical label.

## Forecast assumptions — NOT launch promises

The workbook uses a proposed Monday start **2026-10-19**, one sequential
build/review workstream, **five focused delivery days per week**, ten delivery
days of pilot fix/delay allowance, four calendar weeks of observation and five
delivery days of public allowance. This is not measured velocity or five days
of owner availability. Owner response/review time, scope and actual capacity
may change the dates.

| Item | Low | Base | High |
| --- | ---: | ---: | ---: |
| Pilot work, delivery days W01–W15 | 47 | 77 | 136 |
| Public extra work, delivery days W16–W18 | 7 | 15 | 27 |
| Cached private-pilot forecast | 2027-01-11 | 2027-02-22 | 2027-05-17 |
| Cached public-release forecast | 2027-03-01 | 2027-04-19 | 2027-08-02 |

Dates are the workbook's cached forecast outputs, converted from Excel serial
dates; they are conditional planning values, not recalculated Excel results,
approved milestones or launch commitments. Reforecast after the first accepted
invoice→ledger→report journey and two weekly delivery reviews.

## Proposed workstream order and shared effort

| ID | Remaining work | Dependency | Low/base/high focused days |
| --- | --- | --- | --- |
| W01 | Confirm pilot scope, capacity and release reviews | Owner decisions | 1/1/2 |
| W02 | G5–G7 development activation and exception closure | W01; separate gate approvals | 1/2/5 |
| W03 | Roles, write contracts and server money calculations | W02 | 5/8/13 |
| W04 | Posting providers, accounts, configuration and periods | W03 | 5/8/14 |
| W05 | Canonical invoice and bill lifecycle | W04 | 3/5/9 |
| W06 | Payments, allocation, credits, refunds and statements | W05 | 4/7/12 |
| W07 | CSV banking, categorisation, transfers and reconciliation | W06 | 4/6/11 |
| W08 | VAT freshness, evidence and preparation/export | W07 | 3/5/9 |
| W09 | Canonical reports, aging and export parity | W08 | 4/7/12 |
| W10 | Durable documents and issued invoice copies | W09; provider decisions | 2/4/7 |
| W11 | Onboarding, Ask, core workspaces and recovery UX | W10 | 3/5/9 |
| W12 | Pilot cohort, opening balances and data boundary | W11; cohort decision | 2/3/6 |
| W13 | Full journeys, financial regressions and release security | W12 | 5/8/13 |
| W14 | Production configuration, recovery and monitoring | W13; separate production authority | 4/6/10 |
| W15 | Pilot acceptance and controlled onboarding | W14; separate acceptance | 1/2/4 |
| W16 | Pilot feedback fixes and operational hardening | W15 | 4/8/15 |
| W17 | Public onboarding, support and commercial checks | W16 | 2/4/7 |
| W18 | Public release acceptance | W17; separate acceptance | 1/3/5 |

Workbook build owners such as Replit + Codex, owner acceptance and TBD security/
accounting reviewers remain proposed assignments. Preparation does not appoint
reviewers, accept their work or create an implementation task.

## Decisions still required

- D01: private pilot/public-first choice, named pilot scope and exclusions.
  Approved UK/GBP core remains authority; optional contacts/items/quotes/orders,
  live banking and HMRC filing are not silently included.
- D02: durable storage, invoice delivery and whether OCR/email/notifications/
  recurring generation are launch requirements.
- D03: observed delivery capacity replacing the provisional five-day model.
- D04–D06: separate G5 exact acceptance/ordinary merge, G6 exact activated run/
  normal owner release, G7 result acceptance and applicable approved closure.
- D07: pilot cohort/new companies versus reviewed opening balances; no assumed
  historical-business migration.
- D08: named production, accounting, security and release reviewers.

The bounded development single-owner exception is not production or customer
release authority. C7's existing qualification covers exact C7, not the composite
workspace, activated future G or business/customer journeys.

## First prepared records

1. [G5 exact owner-review and ordinary-merge proposal](ledgerly-tr01-c7-g5-owner-review-proposal.md).
   Fresh identities/source/control checks passed; G5 remains pending.
2. [W03 scoped implementation-ticket proposal](ledgerpoint-w03-implementation-ticket-proposal.md).
   Current source inspected; no implementation or capability policy expansion.

Workbook release blockers B01/B02/B04–B06 remain recorded assessment inputs,
not new reproductions in this turn. The W03 role/write findings in B03 were
directly reconfirmed by static inspection. No new database, browser business
journey, report probe, restore, accounting test or production check was run.

## Scope and evidence

Local documentation/evidence plus read-only GitHub checks only. No reset/discard,
push, PR readiness change, merge, control/closure write, dispatch, Environment
release, migration, runtime/schema/workflow change, production/Helium access,
deployment, publishing or Phase A.

See `ledgerpoint-launch-preparation/` for thin durable receipts; full readbacks,
workbook and source inventory are in the delivered preparation archive.
