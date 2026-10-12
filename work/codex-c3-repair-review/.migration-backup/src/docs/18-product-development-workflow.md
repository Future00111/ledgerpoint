# Ledgerly Product Development Workflow

This document defines how every feature is designed, developed, reviewed and approved before becoming part of Ledgerly.

This workflow is mandatory.

No feature should bypass this process.

This document sits alongside:

- The Ledgerly Manifesto
- Ledgerly Design System & Interaction Standards
- Ledgerly Definition of Done
- Ask Engine Specification
- Technical Architecture

Before implementing any feature, Base44 must follow this workflow.

---

## STAGE 1 — Understand the Request

Before writing code:

Understand the business problem.

Do not immediately implement the requested feature.

Ask:

- What problem is the user trying to solve?
- Could the same outcome be achieved more simply?
- Would this feature improve the experience?
- Would this feature increase trust?
- Would this feature reduce effort?

---

## STAGE 2 — Compare Against The Manifesto

Compare the proposed feature against:

The Ledgerly Manifesto.

If the feature conflicts with the manifesto:

Redesign it.

Do not implement features simply because competitors have them.

---

## STAGE 3 — Compare Against The Design System

Ensure the feature follows:

Ledgerly Design System & Interaction Standards.

Check:

- Layout
- Spacing
- Typography
- Cards
- Buttons
- Interaction
- Navigation
- Responsive behaviour
- Accessibility
- Consistency

---

## STAGE 4 — Ask First Review

Every new feature must answer:

- Can Ask find it?
- Can Ask open it?
- Can Ask perform actions on it?
- Can Ask explain it?

If not,

the feature is incomplete.

---

## STAGE 5 — Workspace Review

Every major business object should become a workspace.

Avoid isolated record pages.

Whenever possible include:

- Summary
- Timeline
- Activity
- Related Records
- Documents
- AI Insights
- Contextual Ask

---

## STAGE 6 — Interaction Review

Confirm:

- Primary objects are clickable.
- One-click rule followed.
- Hover states exist.
- Touch interactions work.
- Keyboard navigation works.
- No unnecessary View or Open buttons exist.

---

## STAGE 7 — Definition of Done Review

The feature must satisfy every requirement within:

Ledgerly Definition of Done.

Do not mark the feature complete until all items pass.

---

## STAGE 8 — Quality Review

Ask:

- Would this feel at home in Stripe?
- Would this feel at home in Linear?
- Would this feel at home in Notion?
- Would this feel premium?
- Would we proudly use this ourselves every day?

If not,

continue refining.

---

## STAGE 9 — Polish Review

Review:

- Animations.
- Loading states.
- Empty states.
- Error states.
- Micro-interactions.
- Spacing.
- Alignment.
- Responsiveness.
- Performance.
- Accessibility.

The final 10% of polish is often what users remember most.

---

## STAGE 10 — Ledgerly Ready

A feature is only considered Ledgerly Ready when it satisfies:

- ✓ Ledgerly Manifesto
- ✓ Design System
- ✓ Interaction Standards
- ✓ Definition of Done
- ✓ Ask Integration
- ✓ Responsive Design
- ✓ Accessibility
- ✓ Performance
- ✓ No duplicated information
- ✓ No developer information
- ✓ Consistent interaction model

Only then should the feature be released.

---

## QUALITY STATUS

Every feature should have one of the following statuses.

### 🟥 In Development

Feature is incomplete.

May contain placeholder functionality.

Not ready for customers.

### 🟨 Feature Complete

Functionality works.

Requires refinement.

Needs UX review.

Needs interaction review.

Needs polish.

### 🟩 Ledgerly Ready

Feature satisfies every governance document.

Fully tested.

Consistent.

Responsive.

Accessible.

Ready for customer use.

---

## PROJECT CULTURE

Ledgerly is not built feature by feature.

Ledgerly is built principle by principle.

Every release should improve:

- Trust.
- Clarity.
- Speed.
- Consistency.
- Simplicity.

---

## FINAL PRINCIPLE

Never ask:

"Can we build this?"

Always ask:

"Should we build this?"

If the answer improves the lives of business owners while remaining true to the Ledgerly Manifesto, build it.

If it adds complexity without delivering meaningful value, redesign it or do not build it at all.