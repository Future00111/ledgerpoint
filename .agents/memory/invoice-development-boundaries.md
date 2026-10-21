---
name: Invoice development boundaries
description: Owner-authorized development rounding scope and isolated authenticated invoice demonstrations.
---

Draft invoices in this development slice use nearest-penny, half-up rounding
for each line's net and then its VAT. Invoice totals sum the saved rounded
lines, with no additional total VAT rounding. This is not retrospective DEC-04
approval, formal accounting acceptance, or production qualification.

**Why:** The owner explicitly chose this development method to enable working
drafts while keeping formal accounting decisions and production approval separate.

**How to apply:** Do not generalize this permission to posting, issued records,
other document types, discounts, negative/credit invoices, VAT-inclusive pricing,
or unsupported VAT schemes.

Unissued drafts are not receivables. Keep their document row and saved amount,
but exclude them from receivables/payment KPIs. Draft detail should offer a clean
preview and Edit/Back, not issue/send controls, collections, payment predictions,
outstanding balances or revenue claims.

**Why:** The owner explicitly required draft-status correctness after the
signed-in walkthrough showed a draft being treated as unpaid and overdue.

**How to apply:** Check draft lifecycle before loading or displaying payment,
collections and revenue information; do not infer issued status from a due date.

Interactive synthetic invoice demos must use a fixed local Unix socket,
development-only opt-in, exact database identity checks, and per-account sample
companies bootstrapped only through actual Clerk authentication. The owner
confirmed this approach is appropriate. The configured external database must
remain unchanged and unused by the demo; no silent fallback is allowed.

**Why:** Sample writes must stay separate from business records without bypassing
authentication, membership, roles, or financial write safeguards.

**How to apply:** Never accept a caller-supplied user, company, or role for demo
bootstrap. Fail closed if the isolated service is absent or its identity differs.

For a session-long local PostgreSQL demo, retain the server as a foreground
process in a tracked background shell. A daemon started by a short-lived shell
did not survive that shell invocation in this workspace.

**Why:** The initial daemon disappeared before the next connection; the tracked
foreground process remained available.

**How to apply:** Keep the tracked process running while the demo is in use and
stop it explicitly when the disposable environment is no longer needed.
