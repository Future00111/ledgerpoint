# 14 — Core Maxims

> Short rules that govern every Ledgerly decision. When in doubt, return to these.

These maxims sit beneath the [Ledgerly Vision](./13-ledgerly-vision.md) and govern day-to-day decisions. They override preference, habit and precedent.

---

1. **Simple beats clever.** Choose the obvious solution over the clever one. Cleverness creates confusion; simplicity creates trust.
2. **Explain everything.** Every number, suggestion and action should tell the user *why*. Understanding builds confidence.
3. **Never expose technical details.** No IDs, raw JSON, stack traces or API responses to non-developers. See Customer Safe Mode.
4. **Rules before AI.** Deterministic rules run first. AI fills the gaps rules cannot cover.
5. **AI before asking the user.** If Ledgerly can infer or decide, it should — only ask the user when it genuinely cannot.
6. **Everything searchable through Ask.** Any record, action or answer should be reachable from the Ask bar.
7. **Design for business owners first.** Owners are the primary user. Accountants and bookkeepers are served through modes, not defaults.
8. **Build once. Build properly.** No duplicate logic, no throwaway patterns. Do it right the first time.
9. **Performance is a feature.** Speed is part of the experience. Slow is a bug.
10. **Every click should have purpose.** Remove friction, decoration and dead ends. Each interaction earns its place.
11. **Reduce stress.** The product should lower the user's burden, never add to it. See [11 — Calm Computing](./11-calm-computing.md).
12. **Delight users.** Beyond correct and fast — make the experience genuinely pleasant.
13. **Never stop polishing.** Nothing is finished. Keep refining what exists, not just what is new.

---

## How to use these

Before implementing any change, check it against every maxim. A change that breaks even one should be questioned before it ships.