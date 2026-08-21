# DEC-18 — Deletion, Anonymisation, Archival and Redaction Policy

**Decision:** DEC-18 — Deletion and anonymisation policy
**Scope:** Deletion, anonymisation, archival and redaction policy
**Status:** **APPROVED — product/governance/data-lifecycle policy only**
**Review date:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting, legal,
privacy, security, and architecture review
**Implementation authority:** None

> This records an approved product/governance/data-lifecycle policy. It does
> not approve DEC-19 through DEC-22, and it does not authorise an implementation task, code, schema,
> migration, accounting logic, UI, workflow, dependency, deployment, or
> publishing work.

## 1. Exact registered question

The Current Decision Register defines DEC-18 as:

> **Deletion and anonymisation policy:** Define what may be physically deleted,
> anonymised, archived, or retained, especially for posted accounting and audit
> records.

The registered options are:

1. physical deletion;
2. no accounting/audit deletion with controlled personal-data redaction; or
3. archive all records.

The registered recommendation is to never delete posted accounting or audit
evidence, while allowing controlled draft deletion and narrowly governed
personal-data redaction.

This review records that policy and expands the lifecycle distinctions required
by the supplied DEC-18 scope.

## 2. Purpose and scope

DEC-17 approved class-based retention. DEC-18 defines what happens when a
record reaches the end of its applicable retention requirement, without
changing the meaning or reconstructability of canonical accounting history.

The required lifecycle is:

**RETENTION PERIOD → ELIGIBILITY → REVIEW / HOLD CHECK → DISPOSAL ACTION**

The review distinguishes:

- **Retention:** keeping information because DEC-17 or another valid
  requirement still applies.
- **Eligibility:** a record has reached the end of its applicable period and
  may be considered for a permitted action; eligibility is not permission.
- **Deletion:** irreversible removal of information from the authoritative
  active record set, subject to legal, backup, and audit constraints.
- **Anonymisation:** transforming personal data so the person is no longer
  identifiable by reasonably available means, without changing required
  accounting meaning.
- **Pseudonymisation:** replacing identifying values with controlled
  references while retaining a means of re-identification; this remains
  protected personal data where applicable.
- **Archival:** moving or marking information as inactive for ordinary
  operations while preserving it under an approved retention and access
  policy. Archival is not deletion.
- **Redaction:** removing or masking selected content from a permitted view or
  copy. Redaction must not alter a posted journal or conceal a required audit
  fact.
- **Legal hold:** an explicit, auditable suspension of disposal for affected
  records.
- **Accounting immutability:** DEC-04's prohibition on rewriting posted
  accounting history; disposal is never a correction mechanism.
- **Personal-data minimisation:** retaining no more personal data than is
  necessary and lawful, even where related accounting evidence must remain.

DEC-18 covers policy boundaries and permitted actions. It does not decide:

- retention duration, which is DEC-17;
- export scope and formats, which is DEC-19;
- backup and recovery, which is DEC-20;
- tenant-isolation architecture, which is DEC-21; or
- migration and cutover policy, which is DEC-22.

## 3. Constraints from DEC-01 through DEC-17

### Already decided

- **DEC-01:** Governance follows Manifesto → Product Principles → PRD/Product
  Scope → Technical Architecture → Feature Specifications/Master Backlog.
- **DEC-02 and DEC-03:** The initial product is UK/GBP-oriented, with VAT
  preparation and source-linked accounting evidence rather than direct HMRC
  submission.
- **DEC-04:** Canonical accounting is append-only, balanced, server-generated,
  source-linked, idempotent, immutable, and corrected through controlled
  reversals or replacement entries.
- **DEC-05:** Company-scoped capabilities are enforced server-side. Disposal
  cannot be a frontend-only action or an arbitrary role-string check.
- **DEC-06 through DEC-08:** Financial years, accounting periods, closed
  periods, and reporting-only year-end remain historically interpretable.
- **DEC-09 and DEC-10:** Stable account identities and protected control
  mappings must continue to explain historical journals.
- **DEC-11:** Material accounting configuration is immutable, effective-dated,
  and retained with the resolved posting context.
- **DEC-12:** Payment, allocation, settlement, and their histories remain
  distinct and non-duplicating.
- **DEC-13:** Customer credits and supplier prepayments remain distinct
  balances.
- **DEC-14:** Unapplied cash, allocation, unallocation, and reallocation
  require explicit, auditable history.
- **DEC-15:** Refund activity remains controlled, reconciled, and auditable.
- **DEC-16:** Payment-on-account is not a separate launch feature.
- **DEC-17:** Authoritative accounting evidence and necessary audit evidence
  are retained for company life plus the applicable legal/regulatory period,
  with separate classes for personal data, documents, and AI actions.

### Consequences for DEC-18

Disposal must never:

- delete a posted journal while leaving an unexplained balance;
- alter a debit, credit, date, account, tax meaning, or correction chain;
- remove the evidence needed to explain a VAT or reconciliation outcome;
- rewrite approval or capability history;
- make a customer-credit or supplier-prepayment balance uninterpretable;
- change historical reports merely because a supporting copy was disposed of;
- turn a privacy request into an accounting mutation; or
- cross a company boundary.

Where a personal identifier is no longer needed, the policy should prefer
minimisation, controlled anonymisation, or a redacted view over removal of
the accounting relationship itself.

## 4. Recommended lifecycle decision

Recommend the following decision flow:

1. **Retain:** DEC-17 class and applicable period are identified.
2. **Assess eligibility:** the period has expired for the specific class and no
   dependency requires continued availability.
3. **Check holds and dependencies:** legal hold, investigation, dispute,
   reporting, accounting traceability, export, recovery, and migration
   dependencies are checked.
4. **Choose the least destructive permitted action:** retain, archive,
   minimise, anonymise, pseudonymise, redact a view/copy, or delete.
5. **Authorise:** the action uses DEC-05 capability enforcement and any
   required elevated approval.
6. **Execute server-side:** the action is company-scoped and atomic with its
   retention audit evidence.
7. **Record outcome:** actor, company, action, reason where required,
   timestamp, affected records/classes, policy, hold result, and resulting
   state are retained.
8. **Verify:** reporting, accounting links, audit reconstruction, and company
   isolation remain intact.

An eligible record must not be disposed of automatically merely because a
calendar threshold has passed.

## 5. Accounting records and evidence

### Must not be deleted or semantically altered

Subject to DEC-17, retain the accounting meaning and traceability of:

- posted journal headers and lines;
- source-to-journal relationships;
- approvals and capability evidence;
- reversals and corrections;
- VAT evidence required to reproduce or explain treatment;
- reconciliation decisions and bank-to-accounting relationships;
- payment and settlement evidence;
- allocation and reallocation history;
- customer-credit evidence;
- supplier-prepayment evidence; and
- refund evidence.

No deletion, anonymisation, archival, or redaction may change the accounting
meaning of these records or make their balances unexplained.

### Permitted treatment

- Archive inactive accounting evidence only if it remains complete, protected,
  discoverable to authorised users, and included in the appropriate historical
  accounting views.
- Pseudonymise or anonymise a party or actor only where the remaining record
  still has the stable context required to interpret the accounting and the
  action is legally appropriate.
- Redact a presentation or export view where the authoritative underlying
  evidence remains intact and the redaction is disclosed to an authorised
  reviewer.
- Delete a non-authoritative duplicate or temporary processing artefact when
  it is not required by DEC-17, legal hold, recovery, audit, or a related
  accounting relationship.

### Draft and unposted records

Draft or unposted records may be eligible for controlled deletion when they
have no posted accounting effect, legal hold, required audit relationship,
active workflow dependency, or other retention requirement. The deletion must
still be company-scoped, capability-controlled, and auditable.

Deletion of a draft must not be used to hide an attempted consequential action
or an approval failure where that event is required by the applicable audit
policy.

## 6. Personal data

Recommend a separate personal-data treatment:

- **Retain** personal data only where necessary for accounting, audit, legal,
  security, fraud prevention, customer support, or another documented purpose.
- **Minimise** redundant names, contact details, free text, and attachments
  when they are not needed to explain the retained record.
- **Anonymise** or **pseudonymise** personal data where the accounting record
  can remain intelligible and the transformation is legally appropriate.
- **Redact** selected personal content from permitted views or copies without
  altering the authoritative accounting record.
- **Retain** identifying information where it is required to establish the
  actor, party, approval, source, or legal meaning of accounting evidence.
- **Never assume** that a personal-data request permits deletion of required
  accounting or audit evidence.

Pseudonymisation is not equivalent to anonymisation. A controlled
re-identification key, if retained, remains protected and company-scoped.

DEC-18 should not define detailed subject-access handling or legal rights
procedures beyond this accounting-retention boundary. Those procedures may
need legal and privacy review.

## 7. Documents

Classify documents by accounting and legal significance:

1. **Authoritative source documents:** invoices, bills, credit notes, and
   attachments required to support a posted journal, VAT treatment, payment,
   refund, or reconciliation. Retain or archive them for the related
   requirement. Do not destroy or redact them in a way that breaks traceability.
2. **Supporting business documents:** retain, archive, redact, or delete based
   on their own DEC-17 class and legal significance.
3. **Duplicates and temporary uploads:** delete when no longer needed and when
   no hold, audit, migration, or accounting dependency applies.
4. **Redacted derivatives:** may be created for least-privilege viewing or
   sharing, but must not replace the authoritative source where the full
   source is required.

If an authoritative document becomes unavailable under an approved action,
the retained accounting evidence must explicitly record the limitation. The
system must not imply that a missing document was preserved or reconstruct a
document that was never available.

## 8. AI prompts, outputs, and action evidence

Respect DEC-17's distinction between AI data and authoritative accounting:

- delete or expire unnecessary prompts, intermediate context, drafts, and
  exploratory outputs when their separately justified period ends;
- retain only the AI evidence necessary to explain a consequential action for
  as long as the related accounting and audit evidence requires;
- preserve the user's approval, capability, action, and resulting canonical
  record even if the raw prompt or intermediate output is disposed of;
- do not treat an AI explanation as a substitute for a journal, source,
  approval, or correction record; and
- do not retain AI conversations indefinitely merely because they once
  existed.

AI evidence that materially contributed to a consequential action must remain
linked to the action without becoming a second accounting authority.

## 9. Redaction

Recommend supporting narrowly governed redaction, with these boundaries:

### May be redacted

- unnecessary personal data in a permitted view or non-authoritative copy;
- sensitive free-text content that is not required to explain accounting;
- document presentation content where the authoritative source remains
  protected and available to authorised reviewers;
- AI prompt or output detail that is not needed to explain a consequential
  action.

### Must never be redacted from authoritative evidence

- debit and credit amounts;
- posting date and accounting period;
- account identity and tax meaning;
- source and correction relationships;
- approval, actor, capability, and timestamp evidence where required;
- payment, allocation, credit, prepayment, settlement, refund, and
  reconciliation relationships; or
- the fact that a redaction or disposal action occurred.

Redaction should preserve a visible marker, affected class, authority, reason
where required, and audit relationship. It must not be presented as if the
underlying value never existed.

## 10. Anonymisation

Recommend anonymisation only where all of the following are satisfied:

- the applicable retention requirement for the personal data has expired or
  permits the action;
- no legal hold or dependency blocks the action;
- the retained accounting record remains intelligible;
- the transformation does not change historical reports, VAT meaning, AR/AP
  history, or audit conclusions;
- the action is authorised under DEC-05;
- the transformation is irreversible if it is described as anonymisation; and
- the action is audited.

Where a stable party or actor reference is required for historical
interpretation, controlled pseudonymisation may be preferable to total
anonymisation, but it remains protected data and is not a disposal shortcut.

Customer and supplier identities should not be anonymised in a way that merges
distinct parties or changes the meaning of historical balances.

## 11. Archival

Recommend archival as a distinct lifecycle state, not as deletion:

- archived records remain complete and protected;
- authorised audit and accounting users can discover them;
- archived authoritative accounting remains included in the relevant
  historical reports and audit views;
- archived operational items may be excluded from ordinary active-work lists;
- archival does not alter balances, VAT, customer statements, supplier
  statements, or aged history;
- restoration, if supported, is an audited state transition and does not
  rewrite the record; and
- archival must respect legal holds and DEC-17 class periods.

Archival storage mechanics, backup copies, and recovery objectives belong to
DEC-20. DEC-18 only defines that an archive cannot be treated as disposal and
must not be used to evade accounting or audit access.

## 12. Legal holds

Recommend an explicit legal-hold concept that takes precedence over normal
eligibility:

- a hold identifies the company, affected records or class, reason,
  placing authority, start time, and scope;
- an authorised specialised capability places, reviews, and releases a hold;
- release records actor, time, scope, reason where required, and resulting
  eligibility state;
- a hold prevents deletion, anonymisation, redaction, destruction, and any
  archival action that would make required evidence unavailable;
- a hold does not permit editing or rewriting a posted record; and
- holds are themselves retained under DEC-17's audit requirements.

If multiple holds apply, disposal remains blocked until all relevant holds are
validly released.

## 13. Company closure

Company states must not create a new accounting meaning merely to support
disposal. For an inactive, closed, or dissolved company:

- required accounting and audit evidence remains retained for the applicable
  DEC-17 period;
- closure does not override a legal hold;
- disposal eligibility is evaluated only after the applicable post-closure
  period and dependency checks;
- a closed company's retained records remain company-scoped and
  capability-controlled; and
- any final disposal or anonymisation remains an auditable lifecycle action,
  not a journal correction.

The legal meaning of closure and dissolution, and the migration of closed
companies, must be validated in the relevant later decision or legal review.

## 14. User rights and data requests

Recommend this handling boundary:

1. Identify the requesting subject and affected company through an authorised
   process.
2. Classify the requested data under DEC-17.
3. Check accounting, legal, audit, security, and hold requirements.
4. Retain evidence that must legally remain.
5. Minimise, anonymise, pseudonymise, or redact personal data where lawful and
   where accounting remains intelligible.
6. Record the outcome and reason without exposing unrelated company data.

A request must not automatically delete a posted journal, source link,
approval, correction, VAT evidence, reconciliation evidence, payment,
allocation, customer credit, supplier prepayment, refund, or required audit
relationship.

The detailed subject-access, objection, and request-response workflow remains
outside the DEC-18 accounting-policy boundary unless separately approved.

## 15. Audit requirements

Every disposal-related action must preserve immutable evidence of:

- company and affected record/class;
- actor and capability;
- action: deletion, anonymisation, pseudonymisation, archival, redaction,
  hold, hold release, failed disposal, or restoration;
- timestamp;
- reason where required;
- applicable retention class and policy;
- eligibility and legal-hold result;
- approval or elevated authority where required;
- previous and resulting lifecycle state; and
- affected relationships or explicit failure reason.

Failed disposal attempts are auditable events. They must not silently retry
across company boundaries or conceal the reason an action was blocked.

Retention-related audit evidence is itself protected under DEC-17. Disposal
must not destroy the evidence needed to prove that a disposal occurred or was
refused.

## 16. Permissions and security

Use DEC-05 capabilities and company scope:

- ordinary users may not perform consequential disposal actions merely because
  a record appears eligible;
- draft deletion may use a normal capability only where it has no posted or
  required audit effect;
- anonymisation, redaction, archival, legal-hold placement/release, and
  destruction require elevated or specialised capabilities as determined by
  the approved capability model;
- consequential actions require approval and reason where policy requires;
- all checks and actions are enforced server-side; and
- no disposal operation may read, alter, or expose another company's records.

Do not create an isolated DEC-18 permission model that bypasses DEC-05.

## 17. Reporting and accounting views

Disposal must have no silent accounting effect:

- Balance Sheet, Profit & Loss, Trial Balance, and General Ledger remain
  journal-authoritative.
- Historical customer and supplier statements remain consistent with
  retained payment, allocation, credit, prepayment, settlement, and refund
  history.
- Aged receivables and aged payables do not change because a non-authoritative
  duplicate, prompt, or presentation copy was removed.
- Archived authoritative records remain included where the report covers their
  accounting period.
- An authorised redaction or anonymisation must not alter amounts, account
  identities, VAT treatment, dates, or period inclusion.
- If a supporting record is unavailable, the limitation is explicit; the
  report must not invent a replacement value.

DEC-19 owns export presentation and scope. A report or export must not hide a
disposal limitation in a way that misrepresents accounting completeness.

## 18. Backup, tenant isolation, and migration boundaries

### DEC-19 — Export

DEC-19 owns export scope, format, access authority, and versioning. DEC-18
requires only that a disposed or redacted record's export eligibility follow
the approved lifecycle and that canonical accounting is not misrepresented.

### DEC-20 — Backup and recovery

DEC-20 owns backup retention, restoration, disaster recovery, and whether
disposal propagates to backup copies. DEC-18 requires disposal requests and
outcomes to be compatible with that later policy; it does not define the
backup architecture.

### DEC-21 — Tenant isolation

DEC-21 owns detailed tenant-isolation architecture. DEC-18 requires every
eligibility check, hold, query, disposal action, and audit record to remain
company-scoped and never cross company boundaries.

### DEC-22 — Migration

DEC-22 owns migration cohorts, historical authority, cutover, rollback, and
legacy retirement. DEC-18 requires:

- never invent historical deletion, anonymisation, archival, redaction, or
  legal holds;
- preserve available evidence and mark missing evidence as a limitation;
- treat ambiguous historical disposal state as an explicit migration
  exception; and
- avoid applying a current disposal action to historical data without the
  evidence and authority required by DEC-22.

## 19. Options

### Option A — Broad physical deletion after expiry

- **Accounting:** High risk of broken source and audit chains, unexplained
  balances, and irreversible loss of accounting context.
- **Data/schema:** Appears simple but requires dependency checks, hold state,
  tombstones, referential safety, and disposal audit records.
- **Migration:** Cannot distinguish genuine historical deletion from missing
  legacy evidence without explicit records.
- **Reporting:** Historical reports can become incomplete or misleading.
- **Security/privacy:** Reduces retained-data volume but creates high
  integrity, fraud, and accidental-loss risk.
- **Audit:** Weakest option because deletion can remove proof of what happened.
- **Operations:** Difficult recovery, investigation, and support.
- **UX:** Simple to promise but difficult to explain when accounting history
  disappears.
- **Compatibility:** Breaks integrations and future exports that rely on
  stable source relationships.
- **Future flexibility:** Poor; lost evidence cannot support later legal or
  market requirements.

### Option B — No disposal; retain all records indefinitely

- **Accounting:** Strongest preservation of history.
- **Data/schema:** Fewer expiry decisions but still needs classification,
  access control, holds, and audit.
- **Migration:** Avoids disposal-state ambiguity but preserves all historical
  data, including incomplete or unnecessary records.
- **Reporting:** Stable but may retain irrelevant presentation data.
- **Security/privacy:** Largest personal-data and breach surface; conflicts
  with minimisation.
- **Audit:** Easy to reconstruct but difficult to govern.
- **Operations:** Increasing storage, discovery, support, and incident burden.
- **UX:** Poor fit for legitimate data requests and privacy expectations.
- **Compatibility:** Simple for consumers but rigid for new legal requirements.
- **Future flexibility:** Retains options but makes principled minimisation
  difficult.

### Option C — Controlled class-based disposal with protected accounting

- **Accounting:** Never disposes of required canonical history; permits
  limited treatment of non-authoritative or expired personal data.
- **Data/schema:** Requires classes, lifecycle state, hold state, dependency
  checks, referential safety, and immutable disposal audit.
- **Migration:** Preserves known evidence and exposes ambiguity as an
  exception.
- **Reporting:** Keeps journal-authoritative reports stable and makes
  supporting-data limitations explicit.
- **Security/privacy:** Minimises personal and AI data while retaining
  necessary accounting evidence and company isolation.
- **Audit:** Strong, because actions, failures, holds, and resulting states
  are preserved.
- **Operations:** More policy and monitoring work, but predictable and
  recoverable lifecycle handling.
- **UX:** Allows understandable data-request and document explanations without
  exposing accounting implementation details.
- **Compatibility:** Preserves stable accounting relationships and permits
  redacted views or archived access without changing the source of truth.
- **Future flexibility:** Supports legal, market, privacy, and storage changes
  without reopening DEC-04 or DEC-17.

### Option D — Archive everything, never delete

- **Accounting:** Protects history if the archive remains complete and
  queryable.
- **Data/schema:** Requires archive state, access controls, restoration, and
  retention/hold semantics.
- **Migration:** Safer than destructive deletion but does not resolve missing
  historical disposal evidence.
- **Reporting:** Requires clear rules so archived accounting remains included
  while inactive operational data does not pollute work queues.
- **Security/privacy:** Still retains personal and AI data beyond necessity.
- **Audit:** Strong if the archive is authoritative and protected.
- **Operations:** Higher storage and recovery burden.
- **UX:** Can confuse users if archive and deletion are not clearly distinct.
- **Compatibility:** Requires consumers to handle archived state.
- **Future flexibility:** Good for storage evolution but weak for
  minimisation and lawful disposal.

## 20. APPROVED POLICY

Approve **Option C: controlled class-based disposal with protected
accounting**, with these policy rules:

1. Apply the DEC-17 class and retention period before considering disposal.
2. Treat expiry as eligibility, not automatic permission.
3. Check legal holds, accounting relationships, investigations, reporting,
   export, recovery, and migration dependencies before acting.
4. Never delete, anonymise, archive, or redact canonical posted journals or
   required evidence in a way that changes accounting meaning or breaks
   reconstruction.
5. Permit controlled deletion of eligible drafts, duplicates, temporary
   artefacts, and non-authoritative data only where no required dependency
   remains.
6. Minimise, anonymise, pseudonymise, or redact personal data only where lawful
   and where the retained accounting record remains intelligible.
7. Treat authoritative documents as retained evidence; allow archival or
   permitted derivatives without replacing the required source.
8. Allow shorter disposal of unnecessary AI prompts and intermediate data,
   while preserving sufficient evidence of consequential AI contributions.
9. Support archival as a distinct, auditable, company-scoped lifecycle state.
10. Make legal holds override deletion, anonymisation, redaction, destruction,
    and any archival action that would remove required access.
11. Enforce consequential actions server-side through DEC-05 capabilities and
    preserve immutable audit evidence for actions and failures.
12. Keep DEC-19, DEC-20, DEC-21, and DEC-22 within their registered boundaries.

This policy is approved as a product/governance/data-lifecycle policy only.

## 21. Decision boundaries

### Already decided

DEC-01 through DEC-17, including immutable canonical accounting, server-side
capabilities, source-linked VAT and reconciliation, payment/allocation/
settlement history, customer credits and supplier prepayments, controlled
refunds, no separate payment-on-account launch feature, and class-based
retention for company life plus the applicable legal/regulatory period.

### Approved policy

Controlled, class-based disposal with no mutation of canonical accounting;
separate treatment for personal data, documents, AI evidence, drafts, and
duplicates; distinct archival; auditable legal holds; and explicit
eligibility-to-action checks.

### Deliberately left open

- exact deletion and destruction mechanics;
- exact anonymisation and pseudonymisation tests;
- detailed redaction views and subject-access procedures;
- archive storage and restoration implementation;
- export effects under DEC-19;
- backup propagation and recovery under DEC-20;
- detailed tenant-isolation architecture under DEC-21;
- migration and legacy authority under DEC-22;
- exact legal interpretation by jurisdiction and record type;
- source freshness/posting safety; and
- implementation details, schema, APIs, UI, tests, dependencies, deployment,
  and publishing.

### What DEC-18 approval locks in

- expiry is an eligibility event, not automatic disposal;
- legal holds override ordinary disposal;
- posted journals and required accounting/audit evidence cannot be disposed
  of in a way that changes meaning or breaks traceability;
- controlled draft and non-authoritative disposal is permitted only after
  dependency and hold checks;
- personal data may receive separate minimisation, anonymisation,
  pseudonymisation, and redaction treatment where lawful;
- archival is distinct from deletion and remains auditable;
- disposal is company-scoped, server-side, capability-controlled, and
  immutably audited; and
- later policies retain their own boundaries.

### What remains changeable

Exact legal schedules, deletion and destruction mechanics, class-level
eligibility rules, redaction representations, anonymisation methods, archive
storage, restoration, request handling, export, backup, tenant isolation,
migration, and implementation design.

## 22. Decision readiness

DEC-18 was explicitly approved on 2026-08-21. The approval is a
product/governance/data-lifecycle policy only. Until the applicable remaining
decisions are approved or amended:

- DEC-19 through DEC-22 remain untouched and unresolved;
- BL-06 and BL-07 remain **BLOCKED**;
- no deletion, anonymisation, archival, redaction, schema, migration, or
  accounting mechanism may be implemented; and
- no implementation task is authorised.

**DEC-01 through DEC-18:** **APPROVED**
**DEC-19 through DEC-22:** **REQUIRE USER DECISION**
**BL-06 / BL-07:** **BLOCKED**
**Application code changed by this review:** **NO**
**Database or migrations changed by this review:** **NO**