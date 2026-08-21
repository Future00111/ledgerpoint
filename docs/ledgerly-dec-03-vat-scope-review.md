# DEC-03 VAT Schemes, Adjustments, and MTD/HMRC Scope Review

**Decision:** DEC-03 — VAT schemes, adjustments, and MTD/HMRC scope  
**Status:** **APPROVED — S1 + A + H1**
**Review date:** 2026-08-21  
**Decision authority:** Product owner/stakeholder, with accounting and
regulatory review  
**Approval record:** Lee explicitly approved S1 + A + H1 on 2026-08-21. The
other options and recommendations in this review do not expand that approval.

## 1. Review basis and governing constraints

This review is subordinate to:

1. the Ledgerly Manifesto;
2. the Product Principles;
3. approved DEC-01 and DEC-02;
4. the PRD/Product Scope;
5. the Technical Architecture and existing accounting-core review; and
6. this Living Product Decisions Register.

The existing documentation establishes these constraints:

- Ledgerly is accounting software first. VAT results must be accurate,
  explainable, auditable, and authoritative.
- Rules come before AI. AI may explain, recommend, prepare, or create a review
  task, but it must not silently choose a VAT treatment, alter a return, post
  an adjustment, or submit to HMRC.
- VAT calculations must be deterministic. Bank-feed VAT metadata is advisory
  and must never drive VAT return boxes.
- Source invoices, bills, credit notes, and other approved accounting records
  are the VAT evidence authority.
- Posted history is immutable. Corrections must be new, linked, auditable
  postings or controlled return adjustments.
- Explicit authenticated approval is the accounting and consequential-action
  boundary.
- DEC-02 approves UK accounting and VAT preparation for an initial UK/GBP
  launch. It does not approve every UK VAT scheme, direct HMRC filing, or any
  implementation task.

## 2. Approved decision

### Approved launch position — DEC-03

For the initial launch, Ledgerly supports:

1. **One VAT scheme:** the UK **Standard VAT Scheme using invoice-basis
   accounting**.
2. **Core tax treatments:** standard-rate, reduced-rate, zero-rate, exempt,
   outside-scope, and explicitly non-VAT/no-VAT classifications where the
   reason is recorded.
3. **Controlled corrections:** source-linked sales and purchase credit/debit
   notes, deterministic rounding, and an approved prior-period VAT
   correction/adjustment workflow.
4. **Return preparation:** a locked, reviewable, evidence-linked VAT return for
   the supported rule set, with box-by-box drill-down and auditable
   human-readable and structured exports.
5. **MTD/HMRC boundary:** MTD-ready digital records and return export/hand-off,
   but **no direct HMRC submission at initial launch**.

The initial launch should not claim support for:

- Flat Rate Scheme;
- Cash Accounting Scheme;
- Annual Accounting Scheme;
- Retail schemes;
- margin schemes, including second-hand goods or tour-operator treatment;
- agricultural or other sector-specific schemes;
- partial-exemption calculations or the Capital Goods Scheme;
- bad-debt relief/recovery;
- import VAT/postponed import VAT accounting;
- broad domestic or international reverse-charge rule coverage; or
- direct HMRC obligations, liabilities, payments, or VAT return submission.

These exclusions require an explicit onboarding and validation boundary. A
business whose records require an unsupported scheme or treatment must be told
that the workflow is unsupported; Ledgerly must not approximate a result using
the standard scheme.

The approved scope is intentionally narrower than “all UK VAT.” It preserves
the approved DEC-02 VAT-preparation scope without making an incomplete tax
engine look filing-ready.

## 3. VAT scheme options

### Option S1 — Standard VAT, invoice basis only

**Description:** Support the UK Standard VAT Scheme with invoice-basis
accounting. Treat standard, reduced, and zero-rated supplies, exempt supplies,
outside-scope items, and explicit no-VAT classifications. Do not support
special accounting schemes at launch.

**Decision:** **APPROVED FOR INITIAL LAUNCH — DEC-03 S1.**

**Why:** This is the only scheme already represented by the deterministic VAT
service and the existing accounting-core review. It gives Ledgerly a bounded,
testable tax authority without pretending that timing, sector, or margin rules
are interchangeable.

**Accounting consequences:**

- Output VAT and input VAT are recognised from the authoritative source
  document/tax point, not from bank settlement.
- Payment allocation changes cash and AR/AP relationships but does not change
  invoice-basis VAT.
- Sales and purchase credit/debit notes create linked reversing or replacement
  tax effects; posted journal history is not edited.
- Exempt and outside-scope lines do not create ordinary output/input VAT, but
  exempt activity must be clearly identified because partial-exemption
  consequences are outside this launch boundary.
- Tax codes and rates must be effective-dated and validated; rates must not be
  scattered hard-coded constants.

**Data/schema consequences:**

- A company VAT profile needs an explicit scheme and accounting basis.
- Tax codes need a treatment, rate, effective dates, and return-box mapping.
- VAT evidence needs source-document and source-line references, calculation
  inputs, result, rule version, and approval/lock state.
- Return records need period, status, source snapshot/freshness, box values, and
  drill-down relationships.
- Unsupported-scheme and unsupported-treatment states must be representable so
  migration and onboarding can stop safely rather than silently defaulting.
- No special-scheme timing, margin, stock, annual-adjustment, or partial-
  exemption tables are needed for this launch option.

**Reporting consequences:**

- The supported VAT return must reconcile to posted, tax-coded evidence.
- The return must expose every supported box and source drill-down.
- The launch contract should retain the full current return structure, while
  boxes requiring unsupported EU-goods or special-treatment logic remain
  explicitly zero/non-applicable rather than inferred.
- Reports must distinguish VAT payable/receivable, exempt/outside-scope
  turnover, adjustments, and unsupported source items.

**Migration consequences:**

- Existing standard invoice-basis records can be mapped to the launch profile
  when their source, tax code, and period are reliable.
- Existing records with unknown, special, or conflicting schemes must be
  preserved and flagged for review; they must not be reclassified as standard
  automatically.
- Historical returns must retain their original result and evidence. A new
  scheme profile must not silently recalculate old returns.
- Migration must identify exempt or special-treatment history that could not be
  safely included in the supported launch return.

**Backlog consequences:**

- Keeps BL-04/05/06/07/08/10/15/17 within a bounded first accounting surface.
- Makes BL-15 responsible for the supported scheme, adjustment controls,
  evidence exports, and unsupported-treatment handling.
- Keeps special-scheme work as future scope rather than hidden acceptance
  criteria.
- Does not approve BL-06, BL-07, BL-15, or any other implementation item.

### Option S2 — Standard VAT plus selected special schemes/treatments

**Description:** Launch Standard VAT and add a selected subset such as Cash
Accounting, Flat Rate, partial exemption, domestic reverse charge, or import
VAT. The exact subset would need separate scheme specifications and a
customer-eligibility boundary.

**Recommendation:** **NOT RECOMMENDED FOR THE INITIAL LAUNCH; RECOMMENDED ONLY
AS A LATER, SEPARATELY APPROVED EXPANSION.**

**Why:** “Selected” does not define a safe accounting contract. Each selected
scheme changes recognition timing, tax accounts, return evidence, or
configuration. Combining them before DEC-04, chart/control-account, period,
and configuration-version decisions are resolved would move unresolved design
into implementation.

**Accounting consequences:**

- Cash Accounting changes VAT recognition based on payment/allocation timing
  and requires treatment for partial payments, overpayments, refunds, and
  unapplied cash.
- Flat Rate changes the VAT calculation and often the relationship between
  transaction VAT and the return amount; it must not be represented as a
  percentage flag on the standard engine.
- Partial exemption requires recoverability/apportionment and
  provisional/final adjustment logic.
- Reverse charge requires explicit output/input treatment and supported
  transaction rules.
- Import VAT requires customs or import evidence and distinct tax treatment.
- Scheme switching requires effective dates, transition rules, and controlled
  period boundaries.

**Data/schema consequences:**

- Scheme-specific configuration, rule versions, effective dates, transition
  snapshots, payment/tax-point relationships, and evidence types are needed.
- The schema must distinguish a tax treatment from a scheme and must prevent
  incompatible combinations.
- Tax return snapshots must record the exact rule set used, not only a company
  scheme label.
- Partial exemption and capital/import records would require additional source
  and allocation models.

**Reporting consequences:**

- Report definitions can no longer assume invoice-date recognition.
- VAT boxes need scheme-aware explanations and reconciliation paths.
- Cash, AR/AP, VAT, and return reports must agree under each timing model.
- Reports need transition disclosures when a business changes scheme.

**Migration consequences:**

- Historical transaction and payment data must be complete enough to reconstruct
  scheme timing and eligibility.
- Ambiguous history cannot be safely backfilled by a default.
- Scheme changes create cutover and comparative-reporting requirements.
- Historical returns may require separate scheme snapshots and manual
  reconciliation.

**Backlog consequences:**

- Expands BL-05, BL-06, BL-07, BL-08, BL-09, BL-10, BL-13, BL-15, and BL-17.
- Creates new scheme-specific specifications, test suites, onboarding rules,
  migration cohorts, and support/runbook requirements.
- Depends on DEC-04, DEC-05, DEC-06–DEC-11, DEC-12–DEC-16, and DEC-22.

### Option S3 — Broad UK VAT coverage at launch

**Description:** Attempt to support Standard, Cash Accounting, Flat Rate,
Annual Accounting, Retail, margin, sector-specific schemes, partial exemption,
Capital Goods, import VAT, and broad reverse-charge treatment from the first
release.

**Recommendation:** **REJECT FOR LAUNCH.**

**Why:** This is not a realistic extension of the existing deterministic
foundation. It would require multiple accounting engines and specialist
regulatory interpretations before the canonical posting, period, chart,
permissions, and migration decisions are approved.

**Accounting consequences:**

- Multiple incompatible recognition and adjustment models would coexist.
- Incorrect scheme selection could materially misstate VAT, profit, AR/AP, and
  cash.
- The testing and review burden would be disproportionate to the initial UK/GBP
  product boundary.

**Data/schema consequences:**

- Requires a large versioned tax-policy model, specialist evidence, transition
  history, stock/margin data, partial-exemption data, and import/customs data.
- A single generic VAT amount or rate field would be insufficient and unsafe.

**Reporting consequences:**

- Every return, management report, and comparative view would need
  scheme-specific authority and reconciliation.
- A report could not safely aggregate businesses using materially different
  VAT bases without clear definitions.

**Migration consequences:**

- A broad historical migration would be high-risk and would require scheme
  identification, source reconstruction, and manual exception cohorts.
- The product could not honestly promise historical VAT parity from the current
  incomplete records.

**Backlog consequences:**

- Turns BL-15 into a programme rather than a contained feature.
- Delays the canonical accounting and reporting foundation.
- Increases production, support, tax-review, and compliance obligations before
  the core posting model is approved.

## 4. VAT adjustments and accounting-treatment options

### Recommended launch adjustment set

The recommended launch supports these controlled treatments:

1. **Taxable rates:** standard, reduced, and zero rate with effective-dated
   rules.
2. **Non-taxable classifications:** exempt, outside scope, and explicit no-VAT
   reasons.
3. **Source-linked credit/debit notes:** linked to the source invoice or bill,
   with a new accounting and VAT effect.
4. **Deterministic rounding:** generated by the calculation rules within a
   documented tolerance, never an unexplained manual box change.
5. **Prior-period VAT correction:** an explicit, approved adjustment carrying
   reason, affected period, target return, amount, box mapping, evidence,
   actor, and audit trail.
6. **Refund treatment:** a refund must follow the approved credit-note or other
   supported source workflow; a bank row alone cannot change VAT.
7. **Payment treatment:** under invoice basis, payment, allocation,
   overpayment, and unapplied cash do not independently create or reverse VAT.

The recommended launch does **not** include a free-form “change any VAT box”
control. A legitimate manual correction must still be typed, evidenced,
reviewed, approved, and traceable.

### Option A — Controlled source-linked and return-level corrections

**Description:** Support credit/debit notes, deterministic rounding, and
approved return-level corrections with evidence and explicit box mapping.

**Decision:** **APPROVED FOR INITIAL LAUNCH — DEC-03 A.**

**Accounting consequences:**

- Every correction is an additive posting or controlled return adjustment.
- Original journals remain immutable.
- Credit notes reduce the original commercial and tax effect without deleting
  history.
- Correction approval is a consequential accounting action and requires the
  approved capability/permission boundary.

**Data/schema consequences:**

- Adjustment records need company, period, source/reversal relationship, reason,
  tax treatment, box mapping, amount, rule/source snapshot, status, approver,
  and audit event.
- Corrections need idempotency and reversal relationships.
- The model must distinguish a document correction from a return-level error
  correction.

**Reporting consequences:**

- Each adjustment must appear in the affected return and drill down to its
  evidence.
- Reports must show original activity, correction, and net result separately.
- Box totals must reconcile to journals and approved return adjustments.

**Migration consequences:**

- Existing VAT adjustments must be classified as source-linked, return-level,
  or unknown.
- Unknown historical adjustments remain visible and require review; they must
  not be silently converted to a new adjustment type.

**Backlog consequences:**

- Directly defines the required completion for BL-05, BL-10, BL-15, and the
  VAT-related parts of BL-06/07/08/17.
- Depends on source freshness, periods, chart/control accounts, permissions,
  and correction-policy decisions.

### Option B — Free-form manual VAT box overrides

**Description:** Let an authorised user enter arbitrary amounts into VAT return
boxes without requiring a typed adjustment, source relationship, or structured
evidence.

**Recommendation:** **REJECT.**

**Accounting consequences:**

- Return totals could diverge from posted journals and source evidence.
- A correction could be duplicated, omitted, or applied to the wrong period.
- It would undermine deterministic VAT authority and make review dependent on
  unexplained operator knowledge.

**Data/schema consequences:**

- A generic amount/comment field would be insufficient for audit, migration,
  reversals, or reconciliation.
- The shortcut would create data debt that later scheme support could not
  safely interpret.

**Reporting consequences:**

- Reports would need to explain differences between return boxes and the
  ledger, weakening the single-authority model.
- Evidence drill-down could not prove why a box changed.

**Migration consequences:**

- Existing manual changes would be difficult to distinguish from valid
  corrections.
- Historical parity and audit reconstruction would be unreliable.

**Backlog consequences:**

- Appears to reduce BL-15 effort but would create failures in BL-17, BL-23,
  BL-24, and production review.
- It conflicts with the accounting-core review and should not be used as an
  interim implementation shortcut.

### Option C — Broad specialist VAT adjustments at launch

**Description:** Add bad-debt relief/recovery, partial-exemption
  provisional/final adjustments, Capital Goods Scheme adjustments, fuel/private
  use, import VAT, broad reverse charge, and special-scheme adjustments at
  launch.

**Recommendation:** **NOT RECOMMENDED FOR THE INITIAL LAUNCH; RECOMMENDED ONLY
AS SEPARATE, RULE-SPECIFIC FUTURE DECISIONS.**

**Accounting consequences:**

- Each adjustment category needs its own eligibility, timing, source evidence,
  tax-account, reversal, and approval rules.
- Bad-debt recovery and relief interact with payment history and periods.
- Partial exemption affects input-tax recoverability and annual adjustment.
- Capital Goods and private-use adjustments require additional asset or usage
  evidence.

**Data/schema consequences:**

- Requires specialist evidence, allocation, asset/usage, import, and
  configuration-version structures.
- A generic VAT adjustment table alone would conceal incompatible semantics.

**Reporting consequences:**

- Return boxes require category-specific explanations, reconciliation, and
  disclosures.
- Comparative reports must preserve the rule version and adjustment basis.

**Migration consequences:**

- Historical eligibility evidence is unlikely to be complete in the current
  project data.
- Migration would need specialist review cohorts and cannot be an automatic
  backfill.

**Backlog consequences:**

- Expands BL-09, BL-10, BL-12, BL-13, BL-15, BL-16, BL-17, BL-23, and BL-25.
- Must follow separate product and accounting decisions rather than being
  hidden inside the initial VAT backlog.

## 5. MTD/HMRC scope options

### Option H1 — VAT preparation plus MTD-ready export/hand-off

**Description:** Prepare the supported VAT return in Ledgerly, show every box
with source evidence, lock and approve it, and provide auditable structured and
human-readable exports for an accountant, agent, or compatible filing/bridging
workflow. Do not submit directly to HMRC.

**Decision:** **APPROVED FOR INITIAL LAUNCH — DEC-03 H1.**

**Accounting consequences:**

- Ledgerly remains the authority for the prepared return within its supported
  scheme boundary.
- Export is a consequential hand-off, so it must record return revision,
  approval, export version, actor, timestamp, and checksum or equivalent
  identity.
- Export does not change posted accounting or return state without explicit
  user action.

**Data/schema consequences:**

- Return snapshots need stable versions, approval/lock state, export records,
  destination/format, and failure/retry audit.
- The model should reserve filing-state fields without pretending that a return
  was submitted.
- No HMRC credential, obligation, receipt, or submission tables are required
  for the initial boundary.

**Reporting consequences:**

- Users can reconcile every exported value to Ledgerly evidence.
- The export must state its scheme, basis, period, preparation status, and
  unsupported-treatment warnings.
- The UI and documents must say “prepared/exported,” not “filed,” unless a
  verified external filing receipt exists.

**Migration consequences:**

- Historical returns can remain as imported/prepared/unknown records without
  inventing HMRC submission status.
- Existing filing evidence can be attached as evidence, but must not be
  represented as a Ledgerly submission.

**Backlog consequences:**

- Completes the initial direction for BL-15 and supports BL-17, BL-18, BL-23,
  and BL-24 without adding an HMRC integration dependency.
- Keeps direct HMRC integration as a future scope decision and provider/
  authentication review.

### Option H2 — Direct MTD VAT return submission at launch

**Description:** Connect Ledgerly to HMRC, retrieve the relevant obligation,
submit an approved VAT return, store the HMRC response, and show filing
status.

**Recommendation:** **NOT RECOMMENDED FOR THE INITIAL LAUNCH; RECOMMENDED AS A
SEPARATE FOLLOW-ON DECISION AFTER THE PREPARATION FOUNDATION IS COMPLETE.**

**Accounting consequences:**

- Submission is an external consequential action and must require explicit
  authenticated approval; AI cannot submit.
- The exact approved return revision must be bound to the submission.
- Timeouts, retries, duplicate submissions, rejected returns, amendments, and
  HMRC receipts require deterministic state transitions.

**Data/schema consequences:**

- Requires secure HMRC authorisation, obligation and submission records,
  provider response metadata, idempotency keys, receipts, retry states, and
  immutable filing audit.
- Provider credentials and access scopes require an integration decision and
  cannot be stored in application records as ordinary company data.

**Reporting consequences:**

- Ledgerly must distinguish prepared, approved, submitted, accepted, rejected,
  and unknown states.
- Submitted values must remain linked to the exact locked return snapshot.
- HMRC liabilities and payments must not be implied from a submission receipt.

**Migration consequences:**

- Historical returns need a separate external-filing status and evidence model.
- Missing or conflicting HMRC receipts must remain unknown rather than being
  backfilled as accepted.

**Backlog consequences:**

- Adds a provider/integration and secure-authentication dependency to BL-15,
  BL-18, BL-23, BL-24, and future production controls.
- Requires a separate MTD implementation specification and explicit integration
  approval; it is not approved by this review.

### Option H3 — Full HMRC account surface at launch

**Description:** Include VAT return submission plus obligations, liabilities,
payments, payment status, amendments, and related HMRC account workflows.

**Recommendation:** **REJECT FOR INITIAL LAUNCH.**

**Accounting consequences:**

- External account data and Ledgerly accounting records would need clear
  authority and conflict rules.
- Payment and liability data could be mistaken for posted cash or settlement.

**Data/schema consequences:**

- Requires a full external-ledger synchronisation model, provider lifecycle,
  access scopes, retention, reconciliation, and outage handling.
- HMRC data would need separate provenance and freshness states.

**Reporting consequences:**

- Reports must distinguish accounting liabilities, HMRC-reported liabilities,
  payments, and unresolved differences.
- Support and audit complexity would grow beyond the approved initial
  preparation scope.

**Migration consequences:**

- Historical HMRC account imports would require external evidence, dates,
  statuses, and reconciliation cohorts.

**Backlog consequences:**

- Broadens BL-12, BL-15, BL-17, BL-18, BL-21, BL-23, BL-24, and BL-25.
- It should be a later product decision, not an implied part of DEC-03 launch
  approval.

## 6. Launch versus future scope

| Area | Required for recommended launch | Future scope unless separately approved |
|---|---|---|
| Scheme | Standard VAT, invoice basis | Cash, Flat Rate, Annual Accounting, Retail, margin, agricultural, sector-specific schemes |
| Rates/treatments | Standard, reduced, zero, exempt, outside scope, explicit no-VAT reason | Broad reverse charge, import VAT, international VAT, special sector rules |
| Corrections | Linked credit/debit notes, deterministic rounding, controlled prior-period corrections | Bad debt relief/recovery, partial exemption, Capital Goods, private-use/fuel, specialist adjustments |
| VAT return | Supported box structure, source evidence, drill-down, review, lock, approval | Scheme-specific and specialist return engines |
| Export | Auditable structured and human-readable preparation export | Direct HMRC API filing |
| HMRC | MTD-ready records and clear filing hand-off status | Obligations, submission, receipts, liabilities, payments, amendments |
| Customer boundary | Businesses whose VAT activity fits the supported rule set | Businesses needing excluded schemes or specialist treatments |
| AI | Explain, identify missing evidence, prepare a review task | No autonomous VAT treatment, correction, approval, or filing |

## 7. Conflicts with DEC-01 and DEC-02

### No conflict in the recommended position

The recommended position is consistent with DEC-01 and DEC-02:

- It stays within UK/GBP launch direction.
- It implements VAT preparation rather than silently expanding the approved
  scope to every VAT scheme or HMRC service.
- It preserves deterministic, explainable accounting authority.
- It keeps future markets, currencies, and capabilities possible without making
  them launch requirements.

### Options that would conflict or require an explicit scope amendment

- Allowing AI or background automation to apply an unexplained VAT treatment,
  post a correction, approve a return, or submit to HMRC conflicts with the
  Manifesto and DEC-01 approval boundary.
- Treating bank-feed VAT metadata as authoritative conflicts with the existing
  VAT evidence rule.
- Editing posted journals or historical return evidence in place conflicts with
  the accounting immutability rules.
- Calling a return “filed” without a verified HMRC submission receipt conflicts
  with truthful, auditable product behaviour.
- Launching broad non-UK VAT or multi-currency tax scope would go beyond the
  bounded DEC-02 launch direction and require a separate decision.
- Launching special schemes without scheme-specific rules would conflict with
  the deterministic and accounting-first requirements, even if the UI labels
  the result as a recommendation.

## 8. Approval record and amendment rule

Lee approved the following DEC-03 scope:

1. **S1 — Scheme:** UK Standard VAT Scheme using invoice-basis accounting.
2. **A — Corrections:** Controlled, source-linked and return-level corrections
   only, with an explicit reason, evidence, appropriate VAT-box mapping,
   reviewer/approver information, and audit trail. Free-form VAT-box overrides
   are prohibited.
3. **H1 — MTD/HMRC boundary:** supported return preparation, evidence and
   source drill-down, review, approval, locking, and export audit records,
   together with human-readable and structured export/hand-off. A return is
   prepared/exported rather than filed unless there is a verified HMRC
   submission receipt.

All special schemes, specialist adjustments, and direct HMRC capabilities
listed in the approved future-scope boundary remain outside the initial launch.

DEC-03 may be amended through the Living Product Decisions process. Any
amendment must identify the effect on existing implementation, accounting data,
schema, migrations, backwards compatibility, reporting, dependent features, and
backlog items before implementation direction changes.

## 9. Dependencies created by DEC-03

The approved DEC-03 scope creates or refines these dependencies before affected
implementation is approved:

- **DEC-04:** the accounting-core architecture must represent authoritative
  tax results and immutable corrections.
- **DEC-05:** VAT preparation, adjustment approval, export, and any future filing
  action need explicit capabilities and active-membership enforcement.
- **DEC-06–DEC-08:** VAT period boundaries, corrections, locks, reopening, and
  year-end treatment must be compatible.
- **DEC-09:** The approved chart policy provides account taxonomy, classifications,
  and VAT-related account candidates without creating VAT logic.
- **DEC-10:** Approved control-account policy provides protected company-scoped
  Output VAT and Input VAT mappings without changing VAT authority.
- **DEC-11:** Approved configuration-versioning policy requires material VAT
  configuration to be reproducible by posting date without creating a second
  VAT engine. Detailed tax-code configuration remains governed by DEC-03 and
  future implementation design.
- **DEC-12–DEC-16:** payment, allocation, refunds, unapplied cash, and
  payment-on-account policy must not accidentally change invoice-basis VAT.
- **DEC-17–DEC-21:** VAT evidence, exports, retention, recovery, tenant
  isolation, and any provider credentials need governed handling.
- **DEC-22:** migration must preserve historical VAT evidence and distinguish
  supported, unsupported, and unknown scheme history.
- **Backlog:** BL-04, BL-05, BL-06, BL-07, BL-08, BL-10, BL-12, BL-13, BL-15,
  BL-17, BL-18, BL-23, BL-24, and BL-25 are affected. This is a dependency
  statement, not implementation approval.

## 10. Decision summary

| Item | Decision-only conclusion |
|---|---|
| **Decision** | Which VAT schemes, adjustments, and MTD/HMRC capabilities Ledgerly supports at launch |
| **Options** | S1/S2/S3 for scheme breadth; A/B/C for adjustments; H1/H2/H3 for HMRC scope |
| **Approved scope** | S1 + A + H1: Standard invoice-basis VAT, controlled corrections, preparation/export without direct HMRC filing |
| **Consequences** | Bounded deterministic tax engine; explicit source evidence and audit; narrower onboarding; specialist schemes and live filing deferred |
| **What Lee approved** | Scheme set, correction controls, MTD/HMRC preparation/export boundary, and excluded future scope |
| **Dependencies** | DEC-04 through DEC-22 as applicable, plus the affected VAT/accounting/reporting/backlog items listed above |

**DEC-03 status after this review:** **APPROVED — S1 + A + H1**
**DEC-04 and all subsequent decisions:** **NOT REVIEWED OR APPROVED BY THIS
DOCUMENT**  
**Implementation authorised:** **NO**