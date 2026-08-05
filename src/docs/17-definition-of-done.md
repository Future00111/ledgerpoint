# Ledgerly Definition of Done (DoD)

The Ledgerly Definition of Done defines the minimum quality standard that every feature, page, workflow and enhancement must meet before it is considered complete.

A feature is not complete simply because it works.

It is only complete when it satisfies all of the following requirements.

This document should be consulted before any feature is marked as complete.

---

## FUNCTIONAL

- [ ] The feature performs its intended purpose.
- [ ] All buttons perform the expected action.
- [ ] No dead links exist.
- [ ] No placeholder functionality remains.
- [ ] No developer or debug information is visible.

---

## INTERACTION

- [ ] Every primary business object is directly clickable.
- [ ] Entire record cards are clickable where appropriate.
- [ ] Hover states exist.
- [ ] Pointer cursor is displayed.
- [ ] Keyboard navigation is supported.
- [ ] Mobile tap behaviour is intuitive.
- [ ] The most common task requires only one click.

---

## ASK INTEGRATION

Every new feature must integrate with Ask.

Ask must be able to:

- [ ] Find the record.
- [ ] Open the record.
- [ ] Perform common actions.
- [ ] Answer questions about the record using Ledgerly's own data.
- [ ] Suggest relevant follow-up actions.

---

## DESIGN

The feature follows the Ledgerly Design System.

- [ ] Consistent spacing.
- [ ] Consistent typography.
- [ ] Consistent icon sizing.
- [ ] Consistent colours.
- [ ] Consistent button styles.
- [ ] Consistent card styles.
- [ ] Consistent animations.

---

## RESPONSIVE

The feature must work correctly on:

- [ ] Desktop.
- [ ] Tablet.
- [ ] Mobile.

No overlapping content.
No hidden controls.
No horizontal scrolling.

---

## USER EXPERIENCE

Users should immediately understand:

- [ ] What this page is.
- [ ] What they can do.
- [ ] What the next step is.

No unnecessary complexity.
No duplicated information.
No unnecessary clicks.

---

## LOADING STATES

Every data-driven feature must include:

- [ ] Loading state.
- [ ] Empty state.
- [ ] Success state.
- [ ] Error state.

Users should never wonder whether the software is working.

---

## ERROR HANDLING

Never display:

- Developer errors.
- Stack traces.
- Technical messages.

Instead explain:

- What happened.
- Why it happened.
- What the user should do next.

---

## PERFORMANCE

Pages should load quickly.
Search should feel instant.
Animations should remain smooth.
Avoid unnecessary processing.

Performance is a feature.

---

## ACCESSIBILITY

- [ ] Keyboard accessible.
- [ ] Visible focus states.
- [ ] Appropriate colour contrast.
- [ ] Readable typography.
- [ ] Touch-friendly controls.

---

## CONSISTENCY

The feature should feel like every other part of Ledgerly.

Users should never need to learn a new interaction style.

---

## CLICKABILITY AUDIT

Every business object expected to open must be clickable.

Examples include:

- Customers
- Suppliers
- Companies
- Invoices
- Bills
- Credit Notes
- Documents
- Reports
- Bank Accounts
- Bank Transactions
- Journal Entries
- VAT Returns
- Dashboard Widgets
- Search Results
- Ask Results
- Timeline Items
- Notifications

No Open or View button should be required where clicking the object itself is the expected behaviour.

---

## FINAL REVIEW

Before marking a feature as complete, ask the following questions:

- Would a first-time business owner understand this?
- Does it reduce effort?
- Does it reduce clicks?
- Does it increase confidence?
- Does it follow the Ledgerly Manifesto?
- Does it follow the Ledgerly Design System?
- Would we proudly use this to run our own business?

If the answer to any question is "No", the feature is not complete.

---

## FINAL PRINCIPLE

Ledgerly should never ship features that merely work.

Ledgerly ships features that feel complete.