# 01 — Product Principles

These principles apply to every page, feature, workflow and future enhancement within Ledgerly.

Whenever new functionality is created, it must comply with these principles. This document is mandatory reading before implementing any new feature.

---

## 1. Simple Beats Clever

Ledgerly should always choose the simplest user experience.

- Avoid unnecessary options.
- Avoid unnecessary clicks.
- Avoid accounting jargon where possible.
- Complex functionality should feel simple.

## 2. Accounting First

Ledgerly is accounting software first.

- AI, automation and integrations should improve accounting.
- They should never replace accounting principles.
- Every accounting entry must remain auditable.

## 3. Never Expose Technical Information

Customers must never see: JSON, Database IDs, UUIDs, API Responses, Stack Traces, SQL Errors, Developer Logs, Internal Error Messages, or Technical Terminology.

Developer information must only be visible when Developer Mode is enabled.

## 4. Friendly Business Language

Use language business owners understand.

- Use "Bills", not "Purchase Documents".
- Use "Accounts", not "Nominal Ledger".
- Use "Money In", not "Receivables".
- Use "Money Out", not "Payables".
- Explain accounting terms where necessary.

## 5. Rules Before AI

Always process information in this order:

1. User Rules
2. Business History
3. Supplier Learning
4. Industry Defaults
5. AI
6. Manual User Input

AI should enhance decisions. It should never override explicit business rules.

## 6. No Dead Ends

Every screen should provide a next action.

If a page has no data: explain the feature, explain why it is useful, offer a clear next step, and provide an Ask shortcut.

## 7. Empty States Should Teach

Never display "No data". Instead display: what the feature does, why it matters, how to get started, and relevant actions.

## 8. Everything Is Searchable

Every module must be searchable using Ask: Customers, Suppliers, Invoices, Bills, Reports, VAT, Documents, Settings, Actions, and future modules.

## 9. One Way To Do Things

Avoid duplicate workflows. Users should not have multiple ways of completing the same task unless there is a clear benefit. Ask should become the primary interaction point.

## 10. Fast Always Wins

The application should always feel responsive. Use lazy loading, independent widgets, background processing, and optimistic updates. No single component should block the application.

## 11. Explain Everything

Whenever Ledgerly makes a suggestion it must explain why.

- "Suggested because this supplier has used this account 18 times."
- "Profit reduced because fuel costs increased."
- "VAT estimate changed because new invoices were posted."

## 12. Users Remain In Control

Ledgerly may suggest. Ledgerly may automate. Ledgerly must never silently change accounting records. Posting journals must always require approval where appropriate.

## 13. Consistent Design

Use consistent buttons, colours, spacing, typography, icons, terminology, and navigation. The application should feel like one product rather than separate modules.

## 14. Accessibility

Support keyboard navigation, screen readers, high contrast, focus indicators, and responsive layouts. Accessibility should never be an afterthought.

## 15. Modern Software

Design inspiration should come from Linear, Notion, Stripe Dashboard, GitHub, and Figma. Avoid looking like legacy accounting software.

## 16. Modular Architecture

Every feature should be capable of being extended without redesign. Future modules should plug into Dashboard, Ask, Reports, Notifications, Search, and Permissions.

## 17. Customer Confidence

Ledgerly should always increase customer confidence. The user should understand what happened, why it happened, and what they should do next.

## 18. Ask Is The Heart Of Ledgerly

Every new feature should be accessible through Ask. Users should never need to remember where functionality is located. Ask should understand navigation, creation, actions, reporting, business questions, and context.

## 19. Design For Business Owners First

Every screen should be understandable by someone with little or no accounting knowledge. Accountants should have access to advanced functionality without making the interface more complicated for everyone else.

## 20. Build For The Next Ten Years

When implementing features, avoid short-term solutions. Database design, APIs, permissions, AI integrations, and workflows should all be extensible. Do not hardcode behaviour that limits future growth.

---

## Final Principle

Every new feature should answer one question:

> Does this make running a business easier?

If the answer is no, redesign the feature before implementing it.