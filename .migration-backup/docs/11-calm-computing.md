# 11 — Calm Computing

> Ledgerly should reduce stress, not create it.

This is a permanent UX principle for Ledgerly. Every screen, feature, widget and notification must help the user feel calm, confident and in control. Where this principle conflicts with density, urgency or "show everything at once" impulses, **Calm Computing wins**.

It is mandatory reading alongside [01 — Product Principles](./01-product-principles.md) (Principle 21).

---

## 1. Why this principle exists

Running a business is already stressful. Accounting software that shouts, flashes, and drowns the user in red warnings makes that stress worse. Ledgerly's job is the opposite: to make the owner feel on top of their finances, able to see what matters, understand why it matters, and act with confidence.

A calm interface signals trust. A loud, anxious interface signals that something is always wrong — even when it isn't.

---

## 2. Design rules

### Reduce, don't pile on
- Never overwhelm users. Each screen shows what matters now; everything else is one click away.
- Only surface information that matters for the user's current task.
- Prioritise clarity over density. White space is not wasted space — it is clarity.
- Progressive disclosure: summary first, detail on demand.

### Colour with care
- Avoid unnecessary red. Reserve red for genuinely destructive or overdue-critical moments, not routine states.
- Prefer neutral tones for the everyday. Use colour to guide attention, not to raise alarm.
- Status pills use the agreed scale: green (positive), amber (needs attention), red (critical). Most things should be neutral or green.
- Never use colour as the only signal — pair it with a label.

### No noise
- Avoid flashing indicators, blinking dots, and pulsing badges.
- Motion should be subtle: gentle fades, small slides, ease-out durations. Nothing should demand the eye.
- Loading states are calm skeletons or a quiet spinner, not strobing placeholders.

### Always explain why
- Every number, suggestion and alert must answer "why does this matter?"
- No bare red totals. If something is red, the user should also see why and what to do.
- Suggestions include their reason ("Suggested because…"). Alerts include their cause and a next step.

### Keep the user in control
- Every screen should help the user feel in control of their finances and of the software.
- Ledgerly suggests; the user decides. Nothing posts, sends or changes silently.
- Clear, obvious next actions — never a dead end, never a wall of data with no way forward.

### Notifications that help, not demand
- Notifications should be helpful rather than demanding.
- No stack of shouting toasts. Quiet, dismissible, grouped, and relevant.
- Default to low interruption. Important things surface; routine things don't nag.

---

## 3. Build-time checklist

Before a screen ships, confirm:

- [ ] Does each element on screen earn its place? Could anything be removed without loss?
- [ ] Is red used only where it is truly warranted?
- [ ] Are there any flashing, blinking or pulsing indicators? If yes, remove them.
- [ ] Does every key number have a plain-English "why" within reach?
- [ ] Does the user know what to do next from this screen?
- [ ] Are animations subtle and motion reduced where possible?
- [ ] Do notifications inform rather than interrupt?
- [ ] Would a stressed business owner feel calmer after using this screen?

If any answer is "no", redesign before implementing.

---

## 4. Relationship to other principles

Calm Computing reinforces:

- **Principle 1 (Simple Beats Clever)** — calm comes from simplicity.
- **Principle 6 (No Dead Ends)** — control comes from a clear next action.
- **Principle 11 (Explain Everything)** — calm comes from understanding why.
- **Principle 17 (Customer Confidence)** — a calm user is a confident user.
- **[05 — UI / UX Design System](./05-design-system.md)** — colour, spacing and motion standards must follow these rules.

---

## Final test for Calm Computing

> After using this screen, does the user feel more in control of their business — or more anxious?

If the answer is "more anxious", redesign the screen.