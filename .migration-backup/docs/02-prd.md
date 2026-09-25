# 02 — Product Requirements Document (PRD)

Defines every feature within Ledgerly. Each feature below contains: **Purpose**, **Business Value**, **User Stories**, **Acceptance Criteria**, **Future Enhancements**, and **Dependencies**.

New features must be added here before implementation, and assigned to a release in [10 Release Roadmap](./10-release-roadmap.md).

---

## 1. Invoicing (Sales Invoices)

**Purpose:** Create, send and track sales invoices with UK VAT.

**Business Value:** Primary revenue collection mechanism; drives aged debtors and VAT.

**User Stories:**
- As a business owner, I can create an invoice for a customer.
- As a business owner, I can add line items with VAT rates and see totals.
- As a business owner, I can approve an invoice so it posts to the ledger.
- As a business owner, I can see which invoices are overdue.

**Acceptance Criteria:**
- Invoice number is unique per company.
- Totals (subtotal, VAT, total, balance due) calculate automatically.
- Approval posts a balanced journal entry.
- Status reflects draft / approved / sent / part-paid / paid / overdue.

**Future Enhancements:** Recurring invoices, online payment links, custom invoice templates, e-invoicing.

**Dependencies:** Customers, Chart of Accounts, VAT rates, Journal Entry posting.

---

## 2. Bills (Purchase Bills)

**Purpose:** Record supplier bills with VAT and approval before posting.

**Business Value:** Tracks payables and recoverable input VAT.

**User Stories:**
- As a business owner, I can record a bill from a supplier.
- As a business owner, I can approve a bill so it posts to the ledger.
- As a business owner, I can see bills due for payment.

**Acceptance Criteria:**
- Bill number is unique per supplier per company.
- Manual approval is required before posting.
- Approval creates a balanced journal entry.

**Future Enhancements:** Approval workflows, batch approval, supplier portal.

**Dependencies:** Suppliers, Chart of Accounts, VAT rates, Journal Entry posting.

---

## 3. Credit Notes (Sales & Supplier)

**Purpose:** Issue and apply credit notes against invoices and bills.

**Business Value:** Corrects errors and handles returns while keeping the ledger auditable.

**User Stories:**
- As a business owner, I can raise a sales credit note against an invoice.
- As a business owner, I can record a supplier credit note against a bill.
- As a business owner, I can apply a credit note to its original document.

**Acceptance Criteria:**
- Credit note numbers are unique per company (sales) / per supplier (supplier).
- Applied credit notes reduce the balance of the original document.

**Future Enhancements:** Refund processing, bulk credit notes.

**Dependencies:** Invoices / Bills, Journal Entry posting.

---

## 4. Bank Accounts & Transactions

**Purpose:** Record bank accounts and import/reconcile transactions.

**Business Value:** Enables cash matching and accurate cashflow.

**User Stories:**
- As a business owner, I can add a bank account.
- As a business owner, I can import transactions via CSV.
- As a business owner, I can match a transaction to an invoice or bill.
- As a business owner, I can see matched vs review transactions.

**Acceptance Criteria:**
- Transactions are either "Review" or "Matched".
- Matched transactions contribute to VAT only when linked to a document.
- Bank balance updates on posting.

**Future Enhancements:** Open Banking live feed, rules-based auto-matching.

**Dependencies:** Invoices, Bills, Chart of Accounts.

---

## 5. VAT Returns

**Purpose:** Produce HMRC 9-box VAT returns with drill-down.

**Business Value:** Compliance; avoids penalties; reclaims input VAT.

**User Stories:**
- As a business owner, I can generate a VAT return for a period.
- As a business owner, I can drill into each box to see source documents.
- As a business owner, I can mark a return as filed.

**Acceptance Criteria:**
- Standard 9-box HMRC layout.
- Every box supports drill-down to underlying invoices/bills/credit notes.
- VAT only includes matched/posted documents.

**Future Enhancements:** HMRC MTD direct submission, flat-rate scheme calculations.

**Dependencies:** Invoices, Bills, Credit Notes, Bank Transactions.

---

## 6. Documents & AI Extraction

**Purpose:** Upload documents and use AI to extract data for review.

**Business Value:** Reduces manual data entry while keeping a human in control.

**User Stories:**
- As a business owner, I can upload a bill or receipt.
- As a business owner, I can review AI-extracted fields with confidence scores.
- As a business owner, I can confirm extracted data to create a bill.

**Acceptance Criteria:**
- Original file is stored.
- Extracted fields show confidence scores.
- User must manually confirm before any record is created.
- AI never auto-posts.

**Future Enhancements:** Bulk upload, line-item extraction, auto-categorisation.

**Dependencies:** Storage, Bills, AI providers.

---

## 7. Email Capture

**Purpose:** Capture invoice attachments from inbound emails.

**Business Value:** Removes manual upload of supplier invoices.

**User Stories:**
- As a business owner, I can configure an email account to scan.
- As a business owner, I can define rules for which emails to capture.
- As a business owner, I can review the capture log.

**Acceptance Criteria:**
- Rules filter by sender, subject and attachment type.
- Captured attachments become Documents pending extraction.
- Log records captured and ignored items.

**Future Enhancements:** Live mailbox polling, multi-provider OAuth.

**Dependencies:** Documents, Email providers.

---

## 8. Chart of Accounts

**Purpose:** Maintain the company's account structure.

**Business Value:** Foundation for all journal posting and reporting.

**User Stories:**
- As a business owner, I can view my chart of accounts.
- As an accountant, I can add or edit accounts with codes and types.
- As a business owner, defaults are created for my business type.

**Acceptance Criteria:**
- Accounts have unique codes per company.
- Posting uses account codes, not names.
- Missing account code during posting shows an explicit error.

**Future Enhancements:** Account mapping, multi-currency accounts.

**Dependencies:** Company business type.

---

## 9. General Ledger & Manual Journals

**Purpose:** Record and review all journal entries.

**Business Value:** Single auditable ledger; supports manual adjustments.

**User Stories:**
- As an accountant, I can post a manual journal.
- As an accountant, I can review all journal entries by account.
- As a business owner, I can trace any figure back to its source.

**Acceptance Criteria:**
- Every entry references a source type and source record.
- Manual journals require approval.
- Journals remain balanced.

**Future Enhancements:** Reversal journals, recurring journals, budget journals.

**Dependencies:** Chart of Accounts.

---

## 10. Reports

**Purpose:** Provide financial reporting with drill-down.

**Business Value:** Decision-making and compliance.

**User Stories:**
- As a business owner, I can run a P&L, Balance Sheet and Trial Balance.
- As a business owner, I can drill into any figure to its source.
- As a business owner, I can export reports.

**Acceptance Criteria:**
- Reports derive from journal entries.
- Every total supports drill-down.
- UK date and currency formatting.

**Future Enhancements:** Custom reports, scheduled reports, budget vs actual.

**Dependencies:** General Ledger, Chart of Accounts.

---

## 11. Customers & Suppliers

**Purpose:** Manage contact and trading details.

**Business Value:** Needed for invoicing, bills and credit control.

**User Stories:**
- As a business owner, I can add a customer or supplier.
- As a business owner, I can see outstanding balances.
- As a business owner, I can set payment terms.

**Acceptance Criteria:**
- Scoped to the active company.
- Outstanding balances reflect posted documents.

**Future Enhancements:** Contact merge, statement generation.

**Dependencies:** Invoices, Bills.

---

## 12. Companies & Multi-Company

**Purpose:** Manage multiple businesses within one account.

**Business Value:** Serves users with more than one entity.

**User Stories:**
- As a business owner, I can create a company.
- As a business owner, I can switch the active company.
- As a business owner, all data is filtered to the active company.

**Acceptance Criteria:**
- All business entities scoped by `company_id`.
- Switching company reloads scoped data.

**Future Enhancements:** Consolidated reporting, inter-company transactions.

**Dependencies:** Users, Permissions.

---

## 13. Users & Permissions

**Purpose:** Control who can access each company and what they can do.

**Business Value:** Security and collaboration.

**User Stories:**
- As an owner, I can invite users to my company.
- As an owner, I can assign roles (owner, accountant, staff, read-only).
- As an owner, I can remove a user.

**Acceptance Criteria:**
- Roles gate actions.
- Users only see companies they belong to.

**Future Enhancements:** Granular permissions, SSO.

**Dependencies:** Companies, Authentication.

---

## 14. Setup Wizard

**Purpose:** Guide new users through initial configuration.

**Business Value:** Fast time-to-value; correct defaults.

**User Stories:**
- As a new user, I can set up my company step by step.
- As a new user, accounts and VAT are configured from my business type.
- As a new user, I can add a bank account and import transactions.

**Acceptance Criteria:**
- Wizard creates company, chart of accounts, VAT config, bank account and first invoice.

**Future Enhancements:** Skip-ahead, progress save, import from another system.

**Dependencies:** Companies, Chart of Accounts, Bank Accounts.

---

## 15. AI Accounting Copilot

**Purpose:** Read-only AI assistant for business questions.

**Business Value:** Answers in plain English using the user's own data.

**User Stories:**
- As a business owner, I can ask a question about my finances.
- As a business owner, the copilot explains its reasoning.
- As a business owner, the copilot links me to relevant records.

**Acceptance Criteria:**
- Read-only; never modifies records without confirmation.
- Scoped to the active company.
- Explains reasoning and provides deep-links.

**Future Enhancements:** Proactive suggestions, document-aware answers.

**Dependencies:** Ask, AI providers, entity read access.

---

## 16. AI Insights Dashboard

**Purpose:** Auto-generate business insights.

**Business Value:** Surfaces issues and opportunities without manual analysis.

**User Stories:**
- As a business owner, I can see insights about overdue invoices, costs and cashflow.
- As a business owner, I can dismiss insights.
- As a business owner, I can drill into an insight.

**Acceptance Criteria:**
- Insights generated on a schedule.
- Each insight links to underlying records.
- Severity levels: positive, info, warning, critical.

**Future Enhancements:** Trend insights, predictive forecasts.

**Dependencies:** Invoices, Bills, Bank Transactions.

---

## 17. Smart Account Suggestions

**Purpose:** Suggest the correct account and VAT for transactions.

**Business Value:** Speeds entry; improves consistency.

**User Stories:**
- As a business owner, when I enter a bill the account is suggested.
- As a business owner, the suggestion explains its source.
- As a business owner, my choice is learned for next time.

**Acceptance Criteria:**
- Priority: User Rules > History > Supplier Defaults > Industry > AI.
- Every suggestion states its reason and confidence.
- Choices are logged for learning.

**Future Enhancements:** Rule builder UI, bulk re-suggest.

**Dependencies:** Chart of Accounts, Suppliers, Suggestion entities.

---

## 18. Ask (Universal Assistant)

**Purpose:** Single entry point for navigation, creation, actions and questions.

**Business Value:** Users never need to remember where features live.

**User Stories:**
- As a business owner, I can open Ask with Cmd/Ctrl+K or Space.
- As a business owner, I can navigate, create records, run actions and ask questions.
- As a business owner, Ask understands the current company context.

**Acceptance Criteria:**
- Every module is searchable.
- Ask understands intents and routes correctly.
- Works on every page.

**Future Enhancements:** Natural-language reporting, voice input.

**Dependencies:** navConfig, askAI backend function, AI providers.

---

## 19. Dashboard (Business Command Centre)

**Purpose:** Customisable, role-based overview.

**Business Value:** Fast situational awareness; no blocking loads.

**User Stories:**
- As a business owner, I can choose a dashboard mode.
- As a business owner, I can rearrange widgets.
- As a business owner, a failing widget does not break the dashboard.

**Acceptance Criteria:**
- Widgets load independently.
- Each widget has an empty state with an Ask shortcut.
- Layout persists per user.

**Future Enhancements:** More widgets, shared layouts, custom widgets.

**Dependencies:** Ask, Insights, all data modules.

---

## 20. Development Tools (hidden)

**Purpose:** Internal tooling for demo data and debugging.

**Business Value:** Faster testing; gated from customers.

**User Stories:**
- As a developer, I can generate demo data from a template.
- As a developer, I can reset data.
- As a developer, I can toggle dev settings.

**Acceptance Criteria:**
- Only visible to developer role / dev environment.
- Never exposed to customers (Customer Safe Mode).

**Future Enhancements:** Seeded scenarios, snapshot/restore.

**Dependencies:** Developer access gating.