# Ledgerly Workspace Framework

> **Status:** Permanent · Authoritative
> **Applies to:** Every major business object in Ledgerly.

## Purpose

Ledgerly does not use traditional record pages. Ledgerly uses **Workspaces**.

A Workspace is the central location for everything relating to a business object — summary, related records, timeline, documents, AI insights, notes, activity and Ask — in one place. The user should never need to visit multiple pages to understand a record.

The **Customer Workspace** is the reference implementation. Every future Workspace (Supplier, Invoice, Bill, Bank Account, VAT, Report, Document) is built from the same shell and reusable cards, swapping only the business-specific data.

---

## Architecture

```
WorkspaceShell            ← reusable container (header · stats · tabs · Ask)
 ├─ WorkspaceHeader       ← name · status · key info · quick actions · Ask · favourite · more
 ├─ SummaryStat (×N)      ← key figures row
 ├─ Tabs (from config)
 │   └─ Workspace Cards   ← assembled per tab
 └─ Contextual Ask bar    ← inherits the record's context automatically
```

### Reusable cards (`src/components/workspace/cards/`)

| Card | Purpose |
| --- | --- |
| OverviewCard | Labelled field list (contact, terms, address, etc.) |
| FinancialSummaryCard | Titled grid of financial stat tiles |
| BusinessHealthCard | 0–100 score, progress bar, factor breakdown |
| TimelineCard | Complete chronological history with event icons |
| RecentActivityCard | Flat list of most recent events |
| DocumentsCard | Clickable document rows |
| RelatedRecordsCard | One or more titled sections of clickable record rows |
| AIInsightsCard | Generates an intelligent summary from workspace context |
| TasksCard | Outstanding tasks / reminders |
| AutomationCard | Automations related to the record (+ link to module) |

---

## The Five Questions

Every Workspace answers, immediately:

1. **What am I looking at?** — header + summary stats
2. **Why does it matter?** — health score + financial summary
3. **What changed recently?** — timeline + activity
4. **What should I do next?** — AI insights + recommended actions
5. **How do I take action?** — quick actions + Ask + clickable rows

---

## Ask Integration

Ask automatically inherits the workspace context. While viewing a record the user can type `create invoice`, `show unpaid invoices`, `summarise this customer` **without naming the record**. The context string is built by the Workspace and passed to `useWorkspaceAsk`, which calls the `askAI` backend function with `{ company_id, question, context }`.

---

## Interaction Standards (from the Design System)

- Entire cards/rows are clickable (One Click Rule). No separate Open/View buttons.
- Hover states, pointer cursor, keyboard (Enter/Space), touch and responsive layouts.
- Empty states explain what the section does and how to get started — never blank.
- Loading states use skeletons — never blank white screens.
- Error states explain in business language — never stack traces or IDs.

---

## Building a New Workspace

1. Create `<Entity>Workspace.jsx` under `src/components/<entity>/`.
2. Load the record's related data (invoices, documents, transactions…).
3. Derive summary stats, a health score, a timeline and an Ask context string.
4. Assemble quick actions + more actions.
5. Compose tabs from the reusable cards.
6. Pass `header`, `summaryStats`, `tabs`, `ask` to `<WorkspaceShell />`.

Only the business-specific data changes. The layout, spacing, interaction model and behaviour remain identical — so every Workspace feels like the same product.

---

## Success Criteria

A Workspace is complete only when it:

- ✓ Follows the Ledgerly Manifesto
- ✓ Follows the Design System & Interaction Standards
- ✓ Passes the Definition of Done
- ✓ Integrates with Ask
- ✓ Is fully responsive
- ✓ Contains no duplicated information
- ✓ Uses reusable Workspace Cards
- ✓ Feels consistent with every other Workspace