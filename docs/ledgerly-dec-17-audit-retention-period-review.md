# DEC-17 Audit Retention Period Review

**Decision:** DEC-17 — Audit retention period
**Status:** **APPROVED — product/governance policy only**
**Review date:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting, legal,
security, privacy, and architecture review
**Implementation authority:** None

> This records an approved product/governance policy. It does not approve
> DEC-22, and it does not authorise an implementation task, code, schema,
> migration, accounting logic, UI, workflow, dependency, deployment, or
> publishing work.

## 1. Exact registered question

The Current Decision Register defines DEC-17 as:

> **Audit retention period:** Define retention duration and classification for
> posted journals, source links, approvals, reversals, VAT, reconciliation, AI
> actions, documents, and personal data.

The registered options are:

1. retain for the company life;
2. use a defined legal period; or
3. retain accounting evidence indefinitely while applying a separate policy to
   personal data, documents, and AI records.

The registered recommendation is to retain posted accounting evidence and its
audit trail for the company life plus the applicable legal period, with
separate classifications for personal, document, and AI data.

This review evaluates that recommendation without approving it.

## 2. Purpose and scope

DEC-17 must define how long Ledgerly retains the records needed to reconstruct
authoritative accounting, approvals, corrections, VAT preparation,
reconciliation, and AI-assisted actions, and how those records are classified.

The review covers:

- posted journals and canonical accounting history;
- source links, approvals, reversals, and corrections;
- VAT and reconciliation evidence;
- accounting documents;
- personal data;
- AI actions and recommendations;
- legal holds, company closure, and retention triggers;
- access, export, audit, and operational consequences;
- migration and future flexibility.

DEC-17 does not decide:

- what may be deleted or anonymised, which belongs to DEC-18;
- export scope, which belongs to DEC-19;
- backup and recovery policy, which belongs to DEC-20;
- tenant isolation policy, which belongs to DEC-21;
- migration and cutover policy, which belongs to DEC-22;
- source freshness/posting safety;
- any implementation, schema, API, UI, or deployment detail.

Retention duration and deletion authority are related but distinct:

- DEC-17 defines retention requirements and classification.
- DEC-18 defines permitted deletion, anonymisation, and archival actions.

No DEC-17 recommendation should be read as permission to delete or anonymise
records.

## 3. Constraints from DEC-01 through DEC-16

### Already decided

- **DEC-03:** VAT preparation remains document-driven and must be
  reconstructable from authoritative records.
- **DEC-04:** Canonical journals are balanced, server-generated, source-linked,
  idempotent, immutable, and corrected through controlled mechanisms.
- **DEC-05:** Capabilities are company-scoped and enforced server-side.
  Retention and audit access must not become a frontend-only control.
- **DEC-06 and DEC-07:** Financial-year and accounting-period context must
  remain reconstructable; closed periods cannot be rewritten.
- **DEC-08:** Year-end is reporting-only.
- **DEC-09 and DEC-10:** Stable account identities and protected control
  mappings must remain intelligible for historical accounting.
- **DEC-11:** Material configuration is immutable, effective-dated, selected by
  canonical posting date, and retained with resolved account identities.
- **DEC-12:** Payment evidence, accounting payment, allocation, and settlement
  remain distinct, with append-only allocation history.
- **DEC-13:** Customer credits and supplier prepayments remain distinct
  authoritative balances and must be auditable.
- **DEC-14:** Unapplied-cash review, allocation, unallocation, and reallocation
  preserve explicit history.
- **DEC-15:** Refund requests, approvals, postings, failures, completions, and
  reversals require immutable evidence.
- **DEC-16:** Payment-on-account is not a separate launch feature; future
  classifications must not create a second accounting history.

### Implication for retention

Retention must preserve enough evidence to answer:

- what was posted;
- why it was posted;
- which source and configuration were used;
- who or what proposed, approved, or changed an action;
- which period and accounts were affected;
- how a balance, allocation, refund, or VAT preparation value was derived; and
- which correction or reversal followed.

The retention policy must not preserve every data type identically. It must
avoid both loss of accounting evidence and unnecessary retention of personal or
non-authoritative AI data.

## 4. Proposed retention classes

Recommend a class-based policy rather than one undifferentiated retention
period.

### Class A — Authoritative accounting evidence

Includes:

- posted journal headers and lines;
- canonical source references;
- posting dates and period context;
- account identities and resolved configuration context;
- idempotency and correction relationships;
- financial-year and period relationships;
- controlled reversals and corrections;
- customer-credit, supplier-prepayment, payment, allocation, and refund
  accounting relationships.

Proposed retention: **for the company life plus the applicable legal period**,
subject to legal hold and DEC-18 deletion constraints.

### Class B — Audit and approval evidence

Includes:

- actor and company scope;
- capability used;
- request, approval, rejection, cancellation, and completion;
- reasons and supporting evidence;
- timestamps;
- approval and separation-of-duties relationships;
- changes to material accounting configuration;
- immutable links to the affected canonical records.

Proposed retention: **at least as long as the authoritative accounting event
it explains**, and for the company life plus the applicable legal period where
it is necessary to reconstruct control history.

### Class C — VAT and reconciliation evidence

Includes:

- source documents and tax-relevant relationships;
- VAT calculation inputs and corrections;
- bank evidence linked to accounting;
- reconciliation decisions and exceptions;
- payment and refund evidence.

Proposed retention: **with the related accounting and document evidence for the
company life plus the applicable legal period**, unless a later approved
policy establishes a longer or more specific requirement.

### Class D — Accounting documents

Includes:

- invoices, bills, credit notes, and source attachments;
- documents referenced by journals, VAT preparation, payments, refunds, or
  reconciliation;
- document metadata needed to interpret the accounting source.

Proposed retention: **for the company life plus the applicable legal period
where the document is needed to support accounting or tax evidence**. A
document must not be detached from an authoritative record merely because its
ordinary operational use has ended.

DEC-18 owns whether a document may later be archived, redacted, or deleted
without breaking accounting reconstruction.

### Class E — Personal data

Includes:

- names, email addresses, phone numbers, addresses, and other personal
  information in company, party, actor, document, or audit records;
- personal data contained in attachments or free-text reasons.

Proposed retention: **separate and minimised**, retaining only what is
necessary for the related accounting, audit, legal, security, or operational
purpose. The duration and lawful redaction/anonymisation actions remain
subject to DEC-18 and applicable legal requirements.

This class must not be used to justify removing accounting evidence that still
requires an intelligible actor, party, source, or control relationship.

### Class F — AI actions and outputs

Includes:

- AI analysis and recommendation;
- prompt or input context where retained;
- model/provider and execution metadata;
- generated explanations;
- user acceptance, rejection, or override;
- resulting task or accounting relationship.

Proposed retention:

- retain the minimum AI evidence needed to explain or audit a consequential
  action for as long as the related accounting or audit record is retained;
- retain non-consequential exploratory AI content only for a separately
  justified operational period;
- do not treat raw prompts or model output as authoritative accounting; and
- preserve the user approval and canonical accounting relationship even if
  non-authoritative AI content later reaches its shorter retention limit.

DEC-17 does not select a model provider or define AI data export.

## 5. Retention triggers and duration

The recommendation is not a single calendar number. It is a lifecycle rule
with explicit triggers:

1. **Company active:** retain authoritative accounting and required audit
   evidence throughout the company life.
2. **After company closure:** retain the relevant authoritative evidence for
   the applicable legal and regulatory period, measured from the legally
   relevant closure, final accounting, or last-record trigger.
3. **Open legal hold:** suspend ordinary expiry for affected records until the
   hold is released by an authorised process.
4. **Correction or reversal:** retain the original and correcting records
   together; a correction does not restart permission to remove the original.
5. **Linked document or source:** retain the evidence needed to interpret a
   posted record for the same effective retention requirement.
6. **AI recommendation:** retain only the evidence needed to explain a
   consequential action for the related record's retention period.

The exact statutory or regulatory periods must be validated for the applicable
company, market, record type, and date. This review does not invent a legal
number or replace legal review.

## 6. Audit reconstruction requirements

At the end of the applicable retention period, a permitted reviewer should be
able to reconstruct:

- the original accounting source;
- the canonical journal and its debit/credit effect;
- the company, actor, capability, and approval;
- the financial year, period, posting date, and configuration version;
- the source document or bank evidence relationship;
- payment, allocation, customer-credit, supplier-prepayment, and settlement
  relationships;
- refund request, approval, bank, completion, failure, or correction state;
- VAT-relevant source and calculation relationship; and
- any later reversal or correction.

Reconstruction does not require retaining every presentation layer or every AI
conversation. It requires retaining authoritative evidence and sufficient
links to explain consequential actions.

## 7. Access, security, and legal hold

Retention must not mean unrestricted visibility. Apply DEC-05 capabilities and
company scope to:

- view retained accounting and audit evidence;
- place, review, or release a legal hold;
- request an export or access report;
- review personal-data retention classification;
- inspect AI action evidence; and
- perform any later deletion, anonymisation, or archival action under DEC-18.

Recommend:

- legal holds override ordinary expiry for affected records;
- holds record scope, reason, actor, date, and release authority;
- access to personal and AI data is narrower than access to ordinary financial
  reports where possible;
- retained audit records are tamper-evident and append-only; and
- retention configuration changes are themselves audited.

DEC-21 owns tenant-isolation policy. This review only requires that retained
records remain company-scoped and must not be exposed across companies.

## 8. Reporting, export, and backups

### Reporting

Reports must continue to derive from canonical accounting. Retention expiry
must not cause current or historical reports to silently recalculate from
partial evidence.

If an approved later policy permits removal of non-authoritative content, the
remaining report must make any limitation explicit rather than manufacturing
values.

### Export

DEC-19 owns export scope and format. DEC-17 requires that any approved export
of retained accounting evidence preserve sufficient relationships to
reconstruct journals, approvals, sources, corrections, and configuration
context.

### Backups and recovery

DEC-20 owns backup and recovery policy. Retention must not assume that a backup
is the authoritative archive, and backup expiry must not silently destroy
records that DEC-17 requires Ledgerly to retain.

## 9. Migration and legacy records

Historical records should be assigned retention classes only where evidence
supports their type and relationship.

Do not invent:

- missing audit events;
- historical approval;
- actor identity;
- legal-hold state;
- source relationships;
- retention start dates;
- AI action history; or
- document relationships.

Where a legacy record is incomplete, preserve the known evidence and mark the
retention or reconstruction limitation explicitly. DEC-22 owns migration
cohorts, evidence thresholds, cutover, rollback, and legacy authority
retirement.

## 10. Options

### Option A — Retain for company life only

- **Accounting:** Keeps records while the company is active but risks losing
  evidence during or after closure when legal reconstruction is still needed.
- **Data/schema:** Simplest duration rule but still needs classes and legal-hold
  state.
- **Migration:** Easy to assign active-company records, difficult for closed
  or migrated companies.
- **Reporting:** Historical reports may become incomplete after closure.
- **Security/capability:** Smaller retained-data surface but no substitute for
  legal and audit obligations.
- **Operations:** Lower storage and support burden; high risk at closure.
- **UX/compatibility:** Simple to explain but unsafe for accountants, auditors,
  and long-lived records.
- **Future flexibility:** Difficult to recover lost evidence or add regulated
  markets later.

### Option B — One defined legal period for all data

- **Accounting:** May protect evidence if the period is long enough, but one
  period may be too short for accounting or unnecessarily long for AI and
  personal data.
- **Data/schema:** Simple policy surface but weak classification and hold
  semantics.
- **Migration:** Clearer date assignment but may misclassify older records.
- **Reporting:** More predictable, but data minimisation and document/AI
  differences are lost.
- **Security/capability:** Retains more personal and non-authoritative data
  than necessary.
- **Operations:** Easier scheduling but harder privacy review and deletion
  decisions.
- **UX/compatibility:** Easy to communicate but inflexible across record types
  and markets.
- **Future flexibility:** Poor fit for new data types or changing legal
  requirements.

### Option C — Class-based retention with accounting evidence protected

- **Accounting:** Preserves journals, audit, sources, corrections, VAT, and
  reconciliation for company life plus applicable legal period.
- **Data/schema:** Requires retention class, trigger, legal-hold, and
  relationship metadata, but avoids one-size-fits-all retention.
- **Migration:** Allows evidence-backed classification and explicit exceptions.
- **Reporting:** Protects historical reconstruction while allowing
  non-authoritative data to have distinct treatment.
- **Security/capability:** Supports narrow access to personal and AI data
  while preserving accounting control history.
- **Operations:** More policy and monitoring work, but clearer expiry and
  investigation behaviour.
- **UX/compatibility:** Mostly invisible to ordinary users; supports
  accountant-grade audit and privacy explanations.
- **Future flexibility:** Best supports new jurisdictions, documents, AI
  actions, and retention requirements without changing the accounting
  authority.

### Option D — Indefinite retention of everything

- **Accounting:** Strong reconstruction but exceeds what is necessary for many
  personal, document, and AI records.
- **Data/schema:** Simplifies expiry but still needs legal holds and access
  classification.
- **Migration:** Avoids expiry decisions but preserves historical ambiguity
  indefinitely.
- **Reporting:** Stable, but non-authoritative records can create clutter and
  privacy risk.
- **Security/capability:** Largest attack and access surface.
- **Operations:** Higher storage, discovery, incident, and privacy burden.
- **UX/compatibility:** Hard to explain and difficult to reconcile with
  minimisation requests.
- **Future flexibility:** Operationally inflexible despite apparent
  availability.

## 11. APPROVED POLICY

Approve **Option C: class-based retention with protected accounting
evidence**:

1. Retain posted journals and the audit trail needed to reconstruct them for
   the company life plus the applicable legal period.
2. Retain source links, approvals, reversals, corrections, VAT, reconciliation,
   payment, allocation, credit, prepayment, and refund evidence with the
   related authoritative accounting record.
3. Apply separate retention classes to personal data, accounting documents,
   and AI actions rather than forcing every record into the accounting
   period.
4. Retain only the AI evidence needed to explain consequential actions for the
   related accounting record; keep exploratory AI content on a shorter,
   separately justified period.
5. Use explicit lifecycle triggers, legal holds, company closure handling,
   retention start dates, and audited policy changes.
6. Preserve original journals and corrections together; retention must never
   become permission to rewrite or silently remove history.
7. Keep retained records company-scoped and capability-controlled.
8. Defer deletion, anonymisation, export, backup, tenant-isolation, and
   migration execution rules to DEC-22.

This policy is approved as a product/governance policy only.

## 12. Decision boundaries

### Already decided

DEC-03 through DEC-16, including document-driven VAT, immutable canonical
accounting, server-side capabilities, financial years, periods, reporting-only
year-end, stable accounts and mappings, configuration versioning,
payment/allocation/settlement, customer credits and supplier prepayments,
unapplied-cash workflow, controlled refunds, and no separate payment-on-account
launch feature.

### Recommended

Class-based retention with accounting evidence and its audit trail retained for
the company life plus the applicable legal period, while personal, document,
and AI data receive separate classifications and proportionate retention.

### Approved policy

Class-based audit retention consistent with the policy in section 11.

### Deliberately left open

- **DEC-18:** deletion, anonymisation, archival, and retained-record
  redaction authority;
- **DEC-19:** export scope and format;
- **DEC-20:** backup and recovery policy;
- **DEC-21:** tenant isolation policy;
- **DEC-22:** migration evidence, cohorts, cutover, rollback, and legacy
  authority retirement;
- exact legal retention periods by jurisdiction and record type;
- source freshness/posting safety;
- implementation details, schema, APIs, UI, tests, dependencies, deployment,
  and publishing.

### What DEC-17 approval locks in

- retention classes for accounting, audit, VAT/reconciliation, documents,
  personal data, and AI actions;
- company-life-plus-applicable-legal retention for authoritative accounting
  evidence;
- preservation of source, approval, correction, and configuration lineage;
- legal holds overriding ordinary expiry;
- separate proportionate treatment for personal, document, and AI data; and
- no deletion or anonymisation permission outside the later DEC-18 policy.

### What remains changeable

Exact legal periods, class-level schedules, legal-hold workflow, redaction and
anonymisation rules, export representation, backup retention, tenant controls,
migration treatment, AI-content detail, and implementation design.

## 13. Decision readiness

DEC-17 was explicitly approved on 2026-08-21. The approval is a
product/governance policy only. Until the applicable remaining decisions are
approved or amended:

- DEC-22 is approved separately as the historical accounting-data compatibility
  and cutover policy;
- BL-06 and BL-07 remain **BLOCKED**;
- no retention, deletion, anonymisation, archival, schema, migration, or
  accounting mechanism may be implemented; and
- no implementation task is authorised.

**DEC-01 through DEC-17:** **APPROVED**
**DEC-18:** **APPROVED — Deletion and Anonymisation Policy**
**DEC-19:** **APPROVED — Export Policy**
**DEC-20:** **APPROVED — Backup and Recovery Policy**
**DEC-21:** **APPROVED — Tenant Isolation Policy**
**DEC-22:** **REQUIRE USER DECISION**
**BL-06 / BL-07:** **BLOCKED**
**Application code changed by this review:** **NO**
**Database or migrations changed by this review:** **NO**