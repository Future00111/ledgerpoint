# DEC-19 — Export Policy

**Decision:** DEC-19 — Export formats, scope, and permissions
**Scope:** Export formats, scope, and permissions
**Status:** **APPROVED — product/data-export policy only**
**Review date:** 2026-08-21
**Decision authority:** Product owner/stakeholder, with accounting, legal,
privacy, security, and architecture review
**Implementation authority:** None

> This records an approved product/data-export policy. It does not approve
> DEC-22, and it does not authorise an implementation task, code, schema,
> migration, accounting logic, UI, workflow, dependency, deployment, or
> publishing work.

## 1. Exact registered question

The Current Decision Register defines DEC-19 as:

> **Export formats, scope, and permissions:** Define accounting, audit, report,
> document, and data export formats, scope, access authority, and versioning.

The registered options are:

1. CSV/PDF;
2. CSV plus machine-readable JSON; or
3. a full archive including documents and audit evidence.

The registered recommendation is:

> Company-scoped CSV plus versioned machine JSON for canonical accounting/audit
> data, with human-readable reports separately.

This review records that policy without authorising its implementation.

## 2. Purpose and export principles

An export is an authorised copy or representation of retained information. It
is not a posting mechanism, backup, correction mechanism, or substitute for
canonical accounting.

Every export must:

- derive from canonical, server-authoritative data;
- remain company-scoped;
- respect DEC-05 capabilities;
- respect DEC-17 retention and DEC-18 disposal state;
- preserve the relevant date, period, account, source, approval, correction,
  configuration, and audit context;
- be versioned where it is intended for machine consumption;
- be auditable without retaining unnecessary personal data; and
- make limitations, redactions, missing evidence, and archived content
  explicit.

Every export must never:

- create or modify accounting;
- reinterpret historical journals;
- silently recalculate historical accounting;
- change VAT, AR/AP, payment, allocation, or settlement;
- restore deleted or anonymised information;
- bypass a legal hold or retention restriction;
- cross company boundaries; or
- expose internal implementation details merely because they exist.

## 3. Export categories

The product should distinguish export categories instead of offering one
ambiguous “export everything” action.

### A. Human-readable report export

Purpose: management review, accountant review, customer or supplier
communication, and ordinary business use.

Candidate content:

- Balance Sheet;
- Profit & Loss;
- Trial Balance;
- General Ledger;
- VAT overview or approved VAT-preparation report;
- aged receivables and aged payables;
- customer and supplier statements; and
- document renderings such as invoices, bills, receipts, and credit notes.

Recommended formats:

- PDF for stable human-readable reports and documents;
- CSV where a report is naturally tabular and further analysis is useful.

These exports are representations of the same authoritative data used
in-product. They are not the canonical accounting record.

### B. Accounting data export

Purpose: accountant review, data portability, external analysis, system
transition, and machine processing.

Candidate content:

- posted journal headers and lines;
- posting date, document date, financial year, accounting period, and status;
- stable account identity and account classification;
- resolved configuration/version context where relevant;
- source relationships;
- payment, allocation, settlement, customer-credit, supplier-prepayment,
  and refund relationships;
- VAT-relevant fields and source references;
- invoice, bill, credit-note, customer, supplier, and company references; and
- explicit correction and reversal relationships.

Recommended formats:

- CSV for tabular interoperability;
- versioned JSON for relationships, lineage, configuration context, and
  machine-readable compatibility.

JSON should expose a documented export contract, not raw database tables,
internal joins, secrets, or undocumented implementation identifiers.

### C. Operational data export

Purpose: business operations, customer/supplier review, support, and
external analysis.

Candidate content:

- customers and suppliers;
- invoices and bills;
- payments and allocations;
- customer credits and supplier prepayments;
- refunds;
- bank evidence and reconciliation outcomes;
- document metadata; and
- company settings that are useful for the selected operational scope.

Operational exports must distinguish source evidence from accounting outcomes.
They must not imply that a bank row, document, payment, allocation, or
settlement is interchangeable with another.

### D. Audit export

Purpose: accountant, auditor, regulator, dispute, investigation, or controlled
company review.

Candidate content:

- canonical journals;
- source links;
- approvals and capability evidence;
- reversals and corrections;
- VAT evidence;
- reconciliation evidence;
- payment and allocation history;
- credit, prepayment, settlement, and refund evidence;
- relevant configuration versions;
- retention, disposal, legal-hold, and redaction markers where authorised;
- audit events; and
- an index describing relationships and known limitations.

Recommended format:

- versioned machine-readable JSON with tabular CSV extracts where helpful;
- a human-readable manifest or report;
- documents included only when the requesting authority and DEC-17/18 state
  permit them.

An audit export should be complete enough to explain consequential activity
within its authorised scope, but should not include unnecessary personal data.

### E. Document export

Purpose: download invoices, bills, receipts, credit notes, and supporting
accounting evidence.

Recommended treatment:

- allow individual document downloads where the user has authority;
- allow bounded document bundles for a selected authorised scope;
- include a manifest linking documents to their accounting and source
  relationships where appropriate;
- preserve archive, redaction, and anonymisation state; and
- never reconstruct or reintroduce a document disposed of under DEC-18.

A document bundle is not automatically a full company export or an accounting
backup.

### F. Configuration export

Purpose: accountant review, portability, troubleshooting, and future migration
preparation.

Candidate content:

- chart of accounts and stable account identity;
- control-account mappings;
- effective-dated configuration versions;
- financial-year and accounting-period context;
- document numbering configuration where relevant; and
- company-level settings needed to interpret exported records.

Configuration exports must preserve historical context. They must not expose
raw internal identifiers to ordinary users without a legitimate technical
purpose, and they must not imply that current configuration can be applied to
historical records.

## 4. Recommended launch scope

Recommend a bounded launch export model with separate entry points and
contracts:

1. **Reports:** PDF and CSV for supported financial, VAT, AR/AP, statement, and
   ledger reports.
2. **Accounting data:** CSV plus versioned JSON for canonical posted
   accounting and its relationships.
3. **Operational data:** CSV for selected customers, suppliers, documents,
   payments, allocations, credits, prepayments, refunds, bank evidence, and
   reconciliation data.
4. **Audit package:** versioned JSON and a human-readable manifest for
   authorised accountant/audit use, with documents included only when
   explicitly authorised.
5. **Documents:** individual downloads and bounded bundles for authorised
   source documents.
6. **Configuration:** a versioned, interpretation-safe configuration extract
   for authorised accounting or migration preparation.

Do not expose an unbounded “full company archive” as the default launch
action. A future full archive may combine these categories only after its
privacy, retention, backup, migration, and security consequences are
separately understood.

## 5. Export purposes

### Explicitly support at launch

- accountant review;
- management reporting;
- statutory and accounting record portability;
- audit and controlled investigation;
- external analysis;
- document download and business operations; and
- preparation for a future migration, without resolving DEC-22.

### Support with restrictions

- business closure;
- customer or supplier support;
- data portability and subject-related requests;
- dispute or legal investigation; and
- external accountant access.

These purposes should use the smallest export category and scope that satisfies
the legitimate need. A support request should not require a full audit export.

### Deliberately not assumed at launch

- every internal record is exportable to every user;
- every export includes source documents;
- every export includes raw AI prompts or intermediate data;
- every export includes all personal data;
- a report PDF is a canonical accounting archive;
- CSV alone preserves every relationship; or
- a full company archive is equivalent to a backup.

## 6. Formats and compatibility

### CSV

CSV is appropriate for tabular reports, journals, operational lists, and
analysis. Each CSV export should define:

- column meanings;
- currency and amount conventions;
- date and time conventions;
- sign conventions;
- account and transaction references;
- null and redaction representation;
- export contract version; and
- whether the file is a report, extract, or evidence table.

CSV should not be treated as sufficient for relationship-rich audit evidence
without companion metadata or a manifest.

### Versioned JSON

JSON is appropriate for canonical accounting/audit relationships, source and
correction lineage, configuration context, and machine portability.

The contract should:

- be versioned independently from internal schema migrations;
- preserve stable business identities and relationship semantics;
- distinguish posted, reversed, corrected, archived, redacted, and
  anonymised states;
- expose resolved account/configuration context where needed to interpret
  history;
- identify unavailable, disposed, or redacted evidence without recreating it;
- avoid undocumented internal database structures; and
- allow consumers to reject or safely handle an unknown version.

### PDF

PDF is appropriate for human-readable reports, statements, invoices, bills,
receipts, credit notes, and controlled review packages. PDF is not sufficient
as the only machine-readable accounting export.

### XLSX

XLSX may be useful for future user workflows, but it should not be the
canonical accounting or audit contract at launch. It introduces formatting and
formula compatibility questions and can be added later without replacing CSV
or versioned JSON.

### Structured accounting formats

Country- or provider-specific formats should remain deliberately open unless a
separate approved requirement establishes their scope, legal meaning, and
versioning. A future structured format must map to canonical data rather than
become a second accounting authority.

### ZIP and bundles

ZIP may be used as a delivery container for a bounded report, document, or
audit package. The bundle should contain a manifest, contract version,
generated timestamp, scope, and file relationships. ZIP does not itself
define archive retention, backup, or canonical authority.

## 7. Canonical accounting and reporting consistency

Exports must use the same authoritative sources as in-product reports:

- canonical posted journals for accounting totals;
- stable account identity under DEC-09;
- protected control mappings under DEC-10;
- effective-dated configuration under DEC-11;
- payment/allocation/settlement distinctions under DEC-12;
- customer-credit and supplier-prepayment treatment under DEC-13;
- unapplied-cash workflow history under DEC-14;
- controlled refund history under DEC-15; and
- no separate payment-on-account accounting model under DEC-16.

Every accounting or report export should state, where relevant:

- reporting date or date range;
- posting-date basis;
- financial year;
- accounting period;
- inclusion of closed periods;
- report or export contract version;
- configuration context; and
- filters applied.

Historical exports must respect the period and configuration context that
governed the records. A current account label must not silently replace the
historical identity needed to interpret an old journal.

An export generated after a source correction should reflect the current
authoritative state and identify the correction relationship. It must not
silently preserve a stale prior representation as if it were current.

## 8. Audit and evidence guarantees

An audit export should provide evidence appropriate to its authorised scope,
including:

- who or what created the source;
- what was posted;
- when it was posted and in which period;
- which account and configuration context applied;
- who approved or rejected a consequential action;
- which reversals or corrections followed;
- how payments, allocations, credits, prepayments, settlement, refunds, VAT,
  and reconciliation relate; and
- which information is unavailable, redacted, archived, or anonymised.

An export is not a certification merely because it is labelled “audit”. The
package should state its scope, generation time, contract version, filters,
authorisation, and limitations.

Export generation and access events should themselves be retained as audit
evidence under DEC-17/18. The audit event must not include unnecessary payload
copies or sensitive data.

## 9. Source documents and disposed data

Respect DEC-17 and DEC-18:

- authoritative source documents remain exportable only while retained and
  available to the requesting authority;
- archived documents may be included when the archive remains authorised and
  accessible;
- redacted documents must be identified as redacted and must not be presented
  as complete originals;
- anonymised or pseudonymised party information must remain consistent with
  the retained accounting meaning;
- deleted or disposed information must not be recreated in an export;
- a missing or disposed supporting source should be represented as an
  explicit limitation where necessary for interpretation; and
- a legal hold may restrict disposal but does not grant export authority.

Exports should not bypass DEC-18 by acting as an indefinite shadow copy. The
export itself is a new data representation with its own retention, access, and
delivery considerations.

## 10. Personal data and privacy

Recommend data minimisation by export category:

- reports include only the names or identifiers necessary for the report;
- accounting extracts use stable business references and only necessary party
  data;
- audit exports include personal or actor information only when needed to
  explain consequential activity and authorised for that purpose;
- document bundles inherit the document's retention and redaction state;
- AI prompts, intermediate outputs, and unnecessary personal context are not
  included by default; and
- full party or company exports require a specific high-risk authority.

The export should warn or require confirmation when it contains sensitive
personal data, broad company data, audit evidence, or a large document set.
DEC-19 does not create a separate privacy policy; it applies DEC-17 and
DEC-18's classifications and disposal boundaries.

## 11. Permissions and approval

Use DEC-05 server-side capabilities. Recommend capability separation:

- **Standard reporting export:** ordinary reporting capability for the
  authorised company and report scope.
- **Accounting data export:** elevated accounting/reporting capability because
  it exposes canonical financial history and relationships.
- **Operational party export:** elevated capability when it includes broad
  customer, supplier, contact, or personal data.
- **Document export:** capability matching document access, with additional
  authority for bulk or sensitive bundles.
- **Audit export:** specialised audit or accounting authority, with approval
  for broad or high-risk scopes.
- **Full company export:** specialised authority and explicit approval; not a
  default launch action.
- **Export configuration or migration preparation:** elevated authority and
  clear purpose, without granting DEC-22 migration authority.

All permission checks must be server-side and company-scoped. Frontend hiding
is not a security boundary. The export audit event must record the actor,
company, capability, purpose or reason where required, category, scope,
filters, format, contract version, result, and access/download outcome.

## 12. Security, delivery, and large exports

Recommend that generated exports:

- are generated server-side from an authorised snapshot or query boundary;
- are inaccessible to other companies;
- use access-controlled delivery;
- have a finite download/availability expiry appropriate to the category;
- do not expose credentials, secrets, internal paths, or raw database data;
- are protected while stored and transmitted;
- record generation and download/access events where appropriate; and
- are invalidated or restricted when authority changes where feasible.

Large exports should use background generation with:

- an explicit requested scope;
- progress or queued status;
- success, failure, and cancellation outcomes;
- bounded retry behaviour;
- completion notification through an authorised channel;
- expiry and cleanup under DEC-17/18; and
- no implication that a failed export succeeded.

Ordinary users should see a simple request and status experience, not storage
or job-queue details. A large export must not bypass capability checks merely
because it runs in the background.

## 13. Filters and scope

Recommend filters that map to accounting meaning:

- posting-date range;
- document-date range where appropriate;
- financial year;
- accounting period;
- account;
- customer;
- supplier;
- document type;
- payment, allocation, refund, bank, or reconciliation type;
- report type; and
- document or audit category.

Filters must be shown in the export manifest and must not cause historical
accounting to be recalculated under current configuration. A filter that
excludes related evidence should identify the resulting scope limitation.

Export scope should default to the current company and an explicit bounded
date or record selection where practical. “All companies” is never a valid
implicit scope.

## 14. Configuration and historical identity

Where configuration is included:

- preserve stable account identity and classification;
- identify effective date and configuration version;
- include resolved account context where necessary to interpret a journal;
- distinguish current configuration from historical configuration;
- avoid raw internal IDs in ordinary human exports; and
- include technical identifiers only in a documented machine or audit contract
  when they are needed for reconciliation.

Configuration export must not allow consumers to infer that changing an
exported setting changes historical accounting.

## 15. Migration and backup boundaries

### DEC-20 — Backup and recovery

DEC-19 defines user-facing portability and reporting exports, not backup,
restore, disaster recovery, backup retention, or recovery objectives. An
export may be useful to a user but is not a guaranteed backup. DEC-20 owns the
backup architecture and propagation of disposal or restoration.

### DEC-21 — Tenant isolation

DEC-21 owns detailed tenant-isolation architecture. DEC-19 nevertheless
requires every export query, file, manifest, permission check, delivery path,
and audit event to remain company-scoped.

### DEC-22 — Migration and cutover

Exports may support migration preparation and historical review, but they do
not decide migration authority, cohorts, cutover, rollback, or legacy
retirement. Historical exports must:

- reflect available evidence only;
- label legacy formats as legacy;
- preserve known limitations and disposed/redacted states;
- never invent missing journals, approvals, source links, or configuration;
  and
- remain a copy rather than becoming a migration write path.

## 16. Options

### Option A — Reporting exports only

- **Accounting:** Low risk if reports are journal-authoritative, but weak for
  machine portability and audit reconstruction.
- **Data/schema:** Smallest contract surface; does not cover relationships or
  durable accounting interchange.
- **Migration:** Poor support for transition because report layouts are not
  canonical data.
- **Reporting:** Strong human usability for supported reports.
- **Privacy/security:** Smaller data surface and simpler permissions.
- **Audit:** Insufficient for detailed source, approval, and correction
  evidence.
- **Operations:** Easiest generation and support.
- **UX:** Simple but frustrating for accountants and portability requests.
- **Compatibility:** Strong for human use, weak for system-to-system use.
- **Future flexibility:** Requires a later machine contract under pressure.

### Option B — CSV plus versioned machine JSON

- **Accounting:** Preserves canonical journals, relationships, and lineage
  without making a report layout the authority.
- **Data/schema:** Requires versioned contracts, manifests, relationship
  semantics, and compatibility discipline.
- **Migration:** Useful for preparation and external analysis without deciding
  cutover authority.
- **Reporting:** Supports CSV/PDF reports separately while keeping machine
  data distinct.
- **Privacy/security:** Scope and permissions can be tailored by category;
  JSON must avoid raw internal structures and unnecessary personal data.
- **Audit:** Supports an authorised evidence package with source, approval,
  correction, and configuration context.
- **Operations:** Moderate generation, delivery, expiry, and support burden.
- **UX:** Clear if categories are named by purpose rather than technical
  format.
- **Compatibility:** Strongest practical baseline with explicit versioning.
- **Future flexibility:** Can add formats and integrations without replacing
  canonical accounting.

### Option C — Full company archive including documents and audit

- **Accounting:** Potentially complete, but high risk of mixing canonical
  accounting, documents, personal data, AI data, and implementation details.
- **Data/schema:** Large contract and relationship surface; difficult to
  version and keep privacy-safe.
- **Migration:** Useful for broad transition but risks becoming an undeclared
  migration authority.
- **Reporting:** Comprehensive, but report and evidence semantics may be
  confused.
- **Privacy/security:** Highest leakage and oversharing risk.
- **Audit:** Strong only if classification, scope, and limitations are clear.
- **Operations:** Expensive generation, storage, delivery, expiry, and support.
- **UX:** Easy to describe but hard to use and govern.
- **Compatibility:** Fragile because every future record type becomes part of
  the contract.
- **Future flexibility:** Can constrain later retention, disposal, and privacy
  decisions.

### Option D — Format-specific exports without a common contract

- **Accounting:** Risk of inconsistent totals and interpretation across
  formats.
- **Data/schema:** Low initial discipline but high long-term drift.
- **Migration:** Consumers cannot rely on stable semantics.
- **Reporting:** Superficially convenient but difficult to reconcile.
- **Privacy/security:** Permissions may diverge by format.
- **Audit:** Weak evidence of which representation is authoritative.
- **Operations:** Repeated fixes and format-specific support.
- **UX:** More choices without clear purpose.
- **Compatibility:** Poor because formats evolve independently.
- **Future flexibility:** Appears flexible but creates incompatible branches.

## 17. APPROVED POLICY

Approve **Option B: company-scoped CSV plus versioned machine-readable JSON
for canonical accounting and audit data, with human-readable reports
separately**, using these launch boundaries:

1. Provide PDF and CSV report exports for supported financial, VAT, AR/AP,
   statement, and ledger reports.
2. Provide CSV and versioned JSON accounting exports for posted journals and
   their source, approval, correction, configuration, payment, allocation,
   credit, prepayment, settlement, refund, VAT, and reconciliation
   relationships.
3. Provide bounded operational CSV exports for authorised customers,
   suppliers, documents, payments, and related workflows.
4. Provide a specialised, audited audit package with versioned JSON and a
   human-readable manifest; include documents only when separately authorised.
5. Provide individual document downloads and bounded document bundles that
   preserve DEC-17/18 state.
6. Keep configuration export versioned and interpretation-safe.
7. Do not expose an unbounded full-company archive by default at launch.
8. Enforce company scope and DEC-05 capabilities server-side, with elevated
   authority for broad accounting, party, document, audit, and company
   exports.
9. Make exports finite, access-controlled, auditable, and subject to explicit
   expiry; never treat them as backups.
10. Include filters, contract version, scope, generated time, redactions,
    archive state, and known limitations in the export manifest.
11. Do not recreate disposed data or use exports to mutate accounting.

This policy is approved as a product/data-export policy only.

## 18. Decision boundaries

### Already decided

DEC-01 through DEC-18, including governance hierarchy, UK/GBP launch
direction, source-linked VAT, immutable canonical accounting, server-side
capabilities, financial years and periods, stable accounts and mappings,
effective-dated configuration, payment/allocation/settlement, customer credits
and supplier prepayments, unapplied cash, controlled refunds, no separate
payment-on-account launch feature, class-based retention, and controlled
class-based disposal with protected accounting.

### Approved policy

Company-scoped CSV plus versioned machine-readable JSON for canonical
accounting/audit data, with PDF and CSV human-readable reports separately,
bounded operational and document exports, and specialised audited exports for
high-risk scopes.

### Requires user decision

The bounded launch export model described in section 17.

### Deliberately left open

- exact export schemas and field contracts;
- exact JSON versioning and compatibility policy;
- detailed report layouts;
- structured accounting formats and provider integrations;
- XLSX support;
- full-company archive scope;
- export storage, delivery, and expiry mechanics;
- detailed privacy/request procedures;
- backup and recovery under DEC-20;
- tenant-isolation architecture under DEC-21;
- migration and cutover under DEC-22;
- source freshness/posting safety; and
- implementation details, schema, APIs, UI, tests, dependencies, deployment,
  and publishing.

### What DEC-19 approval locks in

- exports are copies/representations, never accounting authority;
- company scope and server-side DEC-05 capability enforcement;
- separate report, accounting, operational, audit, document, and
  configuration categories;
- CSV plus versioned JSON as the recommended machine portability baseline;
- human-readable reports separately from canonical machine data;
- export scope, filters, format, version, limitations, and access events are
  auditable;
- DEC-17 retention and DEC-18 disposal state apply to exported information;
- exports do not recreate disposed data or act as backups; and
- DEC-22 retains its registered policy boundary.

### What remains changeable

Exact fields, schemas, versions, layouts, structured formats, XLSX support,
full-archive availability, document bundle rules, expiry periods, delivery
mechanics, privacy warnings, migration formats, provider integrations, and
implementation design.

## 19. Important principle

Export is a copy or representation of authorised data.

It must never:

- mutate or create accounting;
- rewrite or reinterpret history;
- bypass permissions, retention, disposal, or legal holds;
- restore deleted or anonymised data;
- cross company boundaries; or
- expose technical internals without a documented purpose.

Ledgerly should make exporting useful without requiring ordinary users to
understand the underlying accounting or technical architecture.

## 20. Decision readiness

DEC-19 was explicitly approved on 2026-08-21. The approval is a
product/data-export policy only. Until the applicable remaining decisions are
approved or amended:

- DEC-22 is approved separately as the historical accounting-data compatibility
  and cutover policy;
- BL-06 and BL-07 remain **BLOCKED**;
- no export format, scope, permission, schema, migration, accounting, UI,
  workflow, dependency, deployment, or publishing implementation may begin;
  and
- no implementation task is authorised.

**DEC-01 through DEC-19:** **APPROVED**
**DEC-20:** **APPROVED — Backup and Recovery Policy**
**DEC-21:** **APPROVED — Tenant Isolation Policy**
**DEC-22:** **REQUIRE USER DECISION**
**BL-06 / BL-07:** **BLOCKED**
**Application code changed by this review:** **NO**
**Database or migrations changed by this review:** **NO**