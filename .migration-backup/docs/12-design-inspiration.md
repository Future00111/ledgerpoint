# 12 — Design Inspiration

> Ledgerly should not use traditional accounting software as its primary design inspiration.

This is a permanent Product Principle for Ledgerly. It is mandatory reading alongside [01 — Product Principles](./01-product-principles.md) (Principle 22) and [11 — Calm Computing](./11-calm-computing.md).

---

## 1. The rule

Traditional accounting software (legacy desktop suites, dated web dashboards) should only be referenced for **accounting functionality and compliance** — not for interface design, interaction patterns, or visual language.

Ledgerly's design language comes from modern software products that users already love.

**Never copy an outdated interface pattern simply because a competitor uses it.**

---

## 2. Primary inspiration

| Product | What we learn from it |
|---------|----------------------|
| **Stripe** | Calm dashboards, precise typography, restrained colour, clean data tables, confident empty states. |
| **Linear** | Speed, keyboard-first flow, dense-but-clear layouts, subtle motion, command palette. |
| **Notion** | Approachable structure, progressive disclosure, friendly empty states, flexible organisation. |
| **Apple** | Restraint, hierarchy, clarity, deference to content, polish in every detail. |
| **Raycast** | Fast, keyboard-driven, command-first interaction, delightful but never noisy. |
| **ChatGPT** | Conversational, helpful, explains its reasoning, lowers the barrier to action. |
| **Figma** | Modern tooling feel, smooth collaboration cues, clear toolbars, generous canvas. |
| **GitHub** | Structured lists, status pills, clear navigation, reliable and legible at scale. |

---

## 3. What we take from each

- **From Stripe** — financial UI that is calm, not anxious; numbers feel trustworthy, not alarming.
- **From Linear** — the app should feel instant; Ask and keyboard shortcuts are first-class.
- **From Notion** — screens should feel approachable and self-explanatory, never intimidating.
- **From Apple** — less is more; every element earns its place.
- **From Raycast** — the command/Ask experience should be fast and joyful.
- **From ChatGPT** — the AI should explain and guide, not just answer.
- **From Figma** — tooling that professionals enjoy using all day.
- **From GitHub** — large datasets stay legible and navigable.

---

## 4. What we do not take

Do not inherit these from traditional accounting software:

- Cluttered, tab-heavy, modal-heavy interfaces.
- Dense grids with no hierarchy.
- Jargon-heavy labels and codes exposed to business owners.
- Red-heavy, alarm-first styling.
- Multi-step wizards that feel bureaucratic.
- Outdated button styles, bevels, heavy borders, default browser controls.

If a competitor ships one of these patterns, that is a reason to avoid it, not to copy it.

---

## 5. The screen test

Before implementing any new screen, ask:

> **Would this feel at home inside Stripe or Linear?**

If the answer is no, redesign it before implementation. Specifically check:

- [ ] Is the hierarchy clear at a glance?
- [ ] Is colour restrained and purposeful?
- [ ] Is the typography calm and legible?
- [ ] Are empty states friendly and instructive?
- [ ] Is the screen keyboard-navigable and fast?
- [ ] Does it avoid legacy accounting UI tropes?
- [ ] Would a business owner enjoy using it?

If any answer is "no", redesign.

---

## 6. Relationship to other principles

Design Inspiration reinforces:

- **Principle 15 (Modern Software)** — explicitly names these references; this principle makes them mandatory.
- **Principle 21 (Calm Computing)** — these references embody calm, confident software.
- **Principle 13 (Consistent Design)** — one modern language across every module.
- **[05 — UI / UX Design System](./05-design-system.md)** — tokens and components must reflect this language.

---

## Final test for Design Inspiration

> Would this screen feel at home inside Stripe or Linear?

If not, redesign it before implementation.