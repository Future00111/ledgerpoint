# Ledgerly Design System & Interaction Standards

> **Status:** Permanent · Authoritative
> **Applies to:** Every future feature, page, workspace and component in Ledgerly.

## Purpose

This document defines the permanent interaction, design and usability standards for Ledgerly.

Every future feature, page, workspace and component must follow these standards.

When generating or modifying any feature, compare it against this document **before** implementation.

The objective is to ensure Ledgerly feels like one coherent product regardless of how many modules are added.

---

## Ledgerly Design Philosophy

Ledgerly should feel:

- Calm
- Modern
- Intelligent
- Fast
- Trustworthy
- Approachable

The software should reduce stress rather than create it. Every interaction should make running a business easier.

---

## Golden Rules

### 1. One Click Rule

The most common action should always require **one click**.

Examples:

- Click Customer → Open Customer Workspace
- Click Supplier → Open Supplier Workspace
- Click Invoice → Open Invoice
- Click Bill → Open Purchase Bill
- Click Bank Account → Open Bank Account

Do **not** require separate "Open" or "View" buttons.

### 2. Primary Object Principle

The **primary object** on the screen performs the primary action.

Examples:

- Customer Name
- Invoice Number
- Supplier Name
- Report Name
- Document Name
- Bank Account
- VAT Return

These objects should always be directly clickable. The entire record card should also be clickable.

### 3. Workspace Principle

Ledgerly does **not** use record pages. Ledgerly uses **Workspaces**.

Every major object should have its own workspace.

Examples:

- Customer Workspace
- Supplier Workspace
- Invoice Workspace
- Bill Workspace
- Bank Workspace
- VAT Workspace

Each workspace should combine:

- Summary
- Timeline
- Activity
- Documents
- AI Insights
- Related Records
- Notes
- Ask

Users should never need to visit multiple pages to understand an object.

### 4. One Home Rule

Every piece of information should exist in **one authoritative location**.

Never duplicate:

- Today's Priority
- Business Health
- Greeting
- Ask
- Reports
- Summaries

If information is required elsewhere, **link** to it instead of repeating it.

### 5. Ask First

Ask is Ledgerly's universal command centre. Users should never have to remember where features live.

Every module must integrate with Ask.

Ask should support:

- Search
- Navigation
- Actions
- Business Questions
- AI Conversations
- Context Awareness

### 6. Universal Search

Everything in Ledgerly should be searchable.

- Customers
- Suppliers
- Companies
- Invoices
- Bills
- Credit Notes
- Documents
- Reports
- VAT
- Settings
- Help
- Future Modules

Search should support:

- Partial matches
- Case-insensitive matches
- Fuzzy matching
- Typo correction
- Live search
- Grouped results

### 7. Universal Actions

Search results should provide contextual actions.

Examples:

**Customer**

- Open
- Ask

**Invoice**

- Open
- Record Payment
- Ask

**Supplier**

- Open
- Create Bill
- Ask

Users should not need to navigate through menus to complete common tasks.

### 8. Progressive Disclosure

Display only what users need. Advanced functionality should appear progressively. Business owners should never be overwhelmed.

### 9. Explain Everything

Never expose technical information. Never expose stack traces. Never expose JSON. Never expose internal IDs.

Always explain:

- What happened.
- Why it happened.
- What happens next.

### 10. Trust Above Everything

- If Ledgerly is unsure → Explain.
- If AI is unsure → Ask.
- If something fails → Explain why.

Trust always comes before automation.

---

## Component Standards

Every component should include:

- Hover state
- Loading state
- Empty state
- Success state
- Error state
- Keyboard support
- Touch support
- Responsive layout
- Accessibility support

## Card Standards

Cards should:

- Use consistent spacing.
- Use consistent border radius.
- Use consistent typography.
- Use consistent icon sizing.
- Use subtle hover elevation.
- Be clickable when representing business records.

## Table Standards

- Rows representing records should be clickable.
- Hover states should indicate interaction.
- The first column should always represent the primary object.
- Avoid unnecessary action buttons.

## Button Standards

- **Primary actions:** Blue
- **Secondary actions:** Neutral
- **Dangerous actions:** Only inside confirmation menus.

Avoid permanent Delete buttons where possible.

## Dashboard Standards

Dashboard widgets should:

- Be modular.
- Be resizable.
- Be movable.
- Support templates.
- Support Focus Mode.
- Support personalised layouts.

Core widgets:

- Ask
- Today's Priority
- Business Health

These define the Ledgerly experience.

## Ask Standards

Ask should feel similar to:

- macOS Spotlight
- Raycast
- ChatGPT
- Linear Command Palette

Users should think:

> "I'll Ask Ledgerly."

Not:

> "Where is that feature?"

---

## Interaction Hierarchy

**One Click** — Open

**Two Clicks** — Edit · Duplicate · Export · Archive

**Three Clicks** — Delete · Merge · Destructive actions

---

## Definition of Good Design

- If users need training → Redesign it.
- If users hesitate → Redesign it.
- If users become confused → Redesign it.
- If users ask where something is → Improve Ask.

---

## Final Principle

Every feature should answer one question:

> **Does this make running a business easier?**

If not, it is not finished.