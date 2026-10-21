---
name: Invoice development boundaries
description: Owner-authorized development rounding scope and isolated authenticated invoice demonstrations.
---

Nominal codes and names are customer-defined presentation, not numeric accounting
rules. Keep stable account identities when labels change. Category governs
eligibility/report placement; custom report headings may change presentation
without moving balances. Preserve classification once used or control-mapped.

**Why:** The owner explicitly requires customisable codes and connected reports,
without reinterpreting posted history.

**How to apply:** Keep chart, mapping and document choices coherent. Chart writes
must participate in company-wide posting/configuration serialization: revision
and normalized-code uniqueness safety deliberately depend on that shared lock.
Do not introduce a read-then-write path outside it.

Draft invoices in this development slice use nearest-penny, half-up rounding
for exclusive line net and then VAT. Inclusive input instead rounds the entered
line gross, extracts VAT using rate/(100+rate) rounded half-up, and sets
net=gross−VAT. Invoice totals sum saved rounded lines with no further tax
rounding. Excluding VAT is the default for older drafts; the selected basis and
original entered prices must be retained. Switching basis does not convert
typed prices and must invalidate stale totals. This is not retrospective DEC-04
approval, formal accounting acceptance, or production qualification.

**Why:** The owner explicitly chose the development half-up method and then
replaced the VAT-inclusive-input exclusion with invoice-wide including/excluding
VAT input, while keeping formal accounting and production approval separate.

**How to apply:** The owner subsequently authorized development-only native
sales invoices, customer credits, purchase bills and supplier credits through
the normal UI, with real canonical posting and connected reports. This replaces
the earlier draft-only exclusion for those four flows, not for production,
other VAT schemes, cash movements, refunds or error corrections. Credits must
actually offset their linked outstanding original, retain its original tax-point
rate/context and genuine adjustment reason, and record the effective VAT
decrease date. Recoverable purchase VAT requires an explicit eligible treatment.

**Why:** The owner explicitly expanded delivery to the complete four-document
accounting cycle while retaining development isolation and financial safeguards.

**How to apply:** Preserve prior draft samples. Exercise the same authenticated
customer-facing application in a separate synthetic company. Draft save is
never posting acceptance.

The user reported a ChatGPT-assisted browser walkthrough of the complete
signed-in development four-document cycle
through normal navigation, explicit in-app posting review, actual journals and
matching ledger/party/report/VAT workings. Record this as ChatGPT-assisted
development UI evidence only, never independent owner/accountant sign-off,
public release, HMRC qualification, independent-human review or qualification
of a different source revision.

**Why:** The user explicitly corrected the attribution and required this
distinction in delivery records.

**How to apply:** Preserve the demonstrated posted samples and the deliberately
unposted create/reopen sample. Keep VAT-offset asset/liability presentation
distinct from conventional net assets (assets minus liabilities).

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
