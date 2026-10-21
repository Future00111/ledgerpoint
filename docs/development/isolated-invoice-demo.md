# Native four-document accounting extension

## ChatGPT-assisted development browser walkthrough — 2026-10-21

The user reported a ChatGPT-assisted signed-in browser walkthrough through normal navigation:
edited/saved all four starters, reloaded the invoice note, explicitly confirmed
each posting in the in-app review dialog and opened all four actual journals.
Reported results matched the table and balances below: 12 ledger lines/four
journals; movement debits/credits £216/£216; closing trial balance £144/£144;
P&L £80/£40/£40; gross balance sheet £104 = £64 + £40; customer £96 and
supplier £48 with linked credit histories; current ageing £96/£48; VAT boxes
1/4/5/6/7 £16/£8/£8/£80/£40. The fresh UI-created FLOW-UI-DRAFT-001 was
saved/reloaded at net £10 + VAT £2 = gross £12 and deliberately left unposted.

This is ChatGPT-assisted development browser evidence, not independent
owner/accountant sign-off, independent human review, public release,
HMRC qualification or qualification of this
workspace commit. Automated accounting checks run in separate disposable
databases; the owner retains control of the demonstration postings.

Final UI corrections rename the VAT-offset balance-sheet cards **Assets after
VAT offset** and **Liabilities after VAT offset**, not conventional net assets.
Ledger/trial-balance footers show movement/closing totals respectively.
The shared editor now computes new ordinary-draft due dates from issue date
and terms until overridden, reads the actual date controls on submit, hydrates
saved dates and preserves existing/manual dates on reopen. A read-only check
before this fix found the fresh draft's stored due date was still 21 October;
no direct database correction was made. The final ChatGPT-assisted browser
recheck confirmed a new 21 October + 30 days defaults to 20 November, and
FLOW-UI-DRAFT-001 saves/reloads the manually selected 20 November while remaining
an unposted £10/£2/£12 draft. It also confirmed the corrected balance-sheet labels,
the £144/£144 trial-balance footer, sales-only account overrides, and unchanged
legacy DEMO-INCLUSIVE-001 at £100/£20/£120, due 20 November.
Override selectors offer only revenue/income for sales and expense/cost of
sales for bills; credit mappings remain inherited from the original.

Final focused checks: 8 native full-canonical API integration cases, 9 existing
invoice contract cases, 16 existing disposable invoice integration cases, and
18 client/editor cases passed. API and web typechecks passed; the web build
passed with its existing large-chunk warning. The native integration runner's
receipt confirms its PostgreSQL process stopped and temporary directory was
removed, with no ambient database credentials used or production contact.
These checks do not constitute a hosted canonical qualification.

This local development extension uses the same fixed Unix socket, identity
guard, actual Clerk session and per-account company membership as the invoice
demo below. It does not use the configured external database. It does not
authorize production posting, cash payments, refunds, error corrections, VAT
filing or changes to frozen candidates or GitHub controls.

While the isolated PostgreSQL server is running, install the reviewed full local
schema with:

```sh
node tools/accounting-flow/setup.mjs
```

The installer checks the exact local identity, fingerprints the three existing
sample drafts before/after, and installs the real canonical tables and five
immutable canonical guards. The old empty four-column journal guard, if present,
is renamed only after confirming it contains no entries. No populated ledger is
dropped or replaced. This is not a production migration command.

With the existing development-only demo flag enabled, restart the API workflow.
In the signed-in application, open **Companies → Create synthetic accounting
demo**. This creates or reopens a separate company labelled **TEST DATA, not
business records**. It records explicit accounts, accrual mapping, a meaningful
open financial-year period, parties, tax rules and four drafts; it does not
post them or reset the earlier invoice samples.

Use the normal Invoice, Sales credit note, Bill and Supplier credit note screens:
save/reopen/review, then explicitly confirm posting in the in-app review dialog.
The owner is performing this UI walkthrough; automation must not post their
prepared documents.

| Document | Net | VAT | Gross | Treatment |
|---|---:|---:|---:|---|
| FLOW-SI-001 | £100 | £20 | £120 | Standard sales invoice |
| FLOW-SC-001 | £20 | £4 | £24 | Partial genuine price reduction, offset against SI |
| FLOW-PB-001 | £50 | £10 | £60 | Explicitly eligible, fully recoverable purchase VAT |
| FLOW-PC-001 | £10 | £2 | £12 | Partial supplier reduction, offset against PB |

Expected after all four are posted: four source-linked journals, aggregate
debits/credits £216 each; closing trial-balance debits/credits £144 each;
receivables £96, payables £48, revenue £80, expense £40, profit £40, output VAT
£16, recoverable input VAT £8, net VAT payable £8. Gross balance sheet:
assets £104 = liabilities £64 + earnings £40. Net VAT presentation:
receivables £96 = payables £48 + net VAT £8 + earnings £40.

Normal General Ledger and Reports navigation provides journal/account history,
trial balance, parties/ageing, P&L, balance sheet and review-only VAT workings.
`/vat` prominently includes these authoritative workings and labels older VAT
figures incomplete. P&L and VAT are movements in the selected date range;
trial balance, party balances, ageing and balance sheet close through the end
date including earlier postings. Reports use one repeatable-read snapshot.

The limited credit path requires a linked posted original, genuine adjustment
reason, original line/rate context and explicit effective decrease date, matching
the credit posting date. It rejects unallocated/refund/error-correction/cash-VAT
paths. The original gross document remains unchanged; a credit's reversed
canonical journal reduces its linked outstanding liability without cash and
without a second allocation journal.

Authorities checked: [VATSC06635](https://www.gov.uk/hmrc-internal-manuals/vat-supply-and-consideration/vatsc06635)
(actual offset against outstanding liability); [Notice 700, 18.2.5–18.2.6](https://www.gov.uk/guidance/vat-guide-notice-700)
(original tax-point rate, nature/reason and effective decrease period);
[Notice 700/12, boxes 1/4/6/7](https://www.gov.uk/guidance/how-to-fill-in-and-submit-your-vat-return-vat-notice-70012).
These limited workings are not a VAT return submission or general tax advice.

Focused full-schema disposable API checks:

```sh
node tools/accounting-flow/test.mjs
```

That runner uses its own temporary Unix-socket PostgreSQL database, sanitized
child environment, real native APIs and canonical providers. It stops/removes
its own database afterwards and writes an ignored cleanup receipt to
`generated-artifacts/accounting-flow-cleanup.json`. It does not stop/reset the
session-long demo database or alter the owner's sample documents.

# Isolated invoice development demo

This is a synthetic, authenticated invoice-draft demonstration, not production
qualification or DEC-04 accounting acceptance. It uses no external database
credentials and does not issue, post, send, pay or reconcile an invoice.

## Current running demo

The existing demo is running at `/tmp/ledgerly-w03-invoice-demo`, Unix socket
`/tmp/ledgerly-w03-invoice-demo/socket`, port `55440`, database
`ledgerly_w03_invoice_demo`, runtime role `ledgerly_api`. The development
`W03_INVOICE_DEMO_MODE=1` flag is already enabled. Do not reinitialize or replace
this database: it contains the owner's synthetic drafts.

Sign in with the existing Clerk flow. In Companies, use the single
**Create / open synthetic invoice demo** button. It creates or opens two labelled
sample companies for your account, not arbitrary users or supplied memberships.
Switch between Standard VAT and No VAT using the company selector. Selection
persists per account, but is restored only after the current authenticated
membership list confirms access. Never use real customer or financial data here.

Existing records can be edited at `/invoices/<saved-id>`, previewed at
`/invoices/<saved-id>/view`, and reopened from the invoice list. Saving edits uses
the existing record and revision, not a new create request. An explicit due date
is retained; new drafts default to invoice date plus 30 calendar days.

## Reproduce on an empty local environment

Prerequisites: this workspace's Node/pnpm and PostgreSQL command-line tools, and
the already configured Clerk development connection. Do not change
`DATABASE_URL`, supply external PostgreSQL credentials, or use a general schema
push. The fixture below is intentionally limited to the invoice slice.

Only for a **new** demo directory, from the repository root:

```bash
set -eu
D=/tmp/ledgerly-w03-invoice-demo
test ! -e "$D/data/PG_VERSION" || { echo "Existing demo: do not reinitialize"; exit 1; }
mkdir -p "$D/socket"
chmod 700 "$D" "$D/socket"
env -i PATH="$PATH" HOME="$D" LANG=C LC_ALL=C \
  initdb -D "$D/data" -U w03_bootstrap -A trust --no-locale --encoding=UTF8
```

Start PostgreSQL in a dedicated terminal and leave it running. This command also
restarts an existing, stopped demo without modifying its records:

```bash
D=/tmp/ledgerly-w03-invoice-demo
exec env -i PATH="$PATH" HOME="$D" LANG=C LC_ALL=C \
  postgres -D "$D/data" -h '' -k "$D/socket" -p 55440 -F
```

There is no TCP listener. The private directory and local trust configuration
are for this disposable workspace only, never a deployable database setup.

In another terminal, initialize the **new empty cluster only**, preserving the
fixed socket and scrubbing all ambient database variables:

```bash
set -eu
D=/tmp/ledgerly-w03-invoice-demo
local_pg() { env -i PATH="$PATH" HOME="$D" LANG=C LC_ALL=C "$@"; }
local_pg psql -h "$D/socket" -p 55440 -U w03_bootstrap -d postgres \
  -v ON_ERROR_STOP=1 -c 'CREATE ROLE ledgerly_api LOGIN'
local_pg createdb -h "$D/socket" -p 55440 -U w03_bootstrap ledgerly_w03_invoice_demo
local_pg psql -h "$D/socket" -p 55440 -U w03_bootstrap \
  -d ledgerly_w03_invoice_demo -v ON_ERROR_STOP=1 \
  -f artifacts/api-server/scripts/fixtures/invoice-demo-schema.sql \
  -f artifacts/api-server/scripts/fixtures/invoice-demo-runtime-grants.sql
local_pg psql -h "$D/socket" -p 55440 -U ledgerly_api \
  -d ledgerly_w03_invoice_demo -v ON_ERROR_STOP=1 \
  -c 'SELECT current_database(),current_user,inet_server_addr() IS NULL AS unix_socket'
```

Expected identity: `ledgerly_w03_invoice_demo`, `ledgerly_api`, `unix_socket=true`.
The runtime grants include only ID-column update privileges on the empty source
guard projections, because PostgreSQL requires an update privilege for the
unchanged `FOR SHARE` checks used on reopen/edit. Audit updates/deletes/truncates
remain denied, with an append-only trigger as well.

Ensure the development-only flag is `1` in workspace environment settings and
restart the existing API workflow, not a duplicate server. The API refuses
startup outside development or if the fixed local database identity cannot be
verified. There is no fallback to the external `DATABASE_URL`. Keep the existing
Clerk authentication and web workflow unchanged.

## Expected sample results

- Standard VAT: quantity-one lines £1.01 at 20%, £1.03 at 20%, £0.10 at 5%:
  net £2.14, VAT £0.42, gross £2.56. Save, edit the reference/date, save again,
  refresh and reopen the same ID.
- No VAT: quantity 2.5 at £19.99: net/gross £49.98, VAT £0.00. Save, refresh
  while No VAT is selected, and reopen the same ID.
- Draft rows retain their amounts but do not count as unpaid, overdue or paid
  receivables. Draft detail has document preview and Edit/Back only.
- Synthetic standard 20% starts 2011-01-04; reduced 5% starts 1997-09-01.
  Earlier dates are rejected; this is not full historical tax coverage.

Use **Prices are: Excluding VAT / Including VAT** near the items. Excluding is
the default for older drafts. Changing it retains the entered prices; save to
calculate new totals. The selected basis is restored on edit/reload.

The exclusive calculation rounds each line net, then VAT, nearest penny half-up.
Inclusive input rounds quantity × entered price to gross pence, extracts VAT as
gross × rate/(100+rate) rounded half-up, and sets net=gross−VAT. All arithmetic is
integer/rational. Totals sum saved lines without another VAT round. Examples:
£120 including 20% = £100 net + £20 VAT; £105 including 5% = £100 + £5;
2.5 × £19.99 including 20% = £49.98 gross, £8.33 VAT, £41.65 net.
Zero-rated, exempt, outside-scope and no-VAT treatments retain their distinct
labels and zero VAT in either basis. See
[HMRC VAT Notice 700 §7.3.1](https://www.gov.uk/guidance/vat-guide-notice-700)
for the inclusive-price VAT fraction. This is an explicit development
implementation choice, not formal production policy approval.

Original entered unit prices and basis remain in draft source and read-projection
metadata. Existing `unit_price` read fields remain net unit prices (four-decimal
half-up representation for inclusive input); authoritative saved line net/VAT/
gross must not be recomputed from that unit-price representation. The tax-context
digest binds the canonical source fingerprint, including basis, even when a
zero-VAT line's totals are equal. Existing duplicate-number and revision guards
remain fail-closed; no automatic create retry/replay has been introduced.
Unsupported discounts, credit/negative invoices and unsupported VAT schemes
still fail closed. Old drafts are not automatically rewritten.

## Boundaries and lifecycle

The schema fixture contains invoice tables and empty source-check projections,
not the complete accounting database. Other pages may request tables that this
invoice-only demo does not initialize. A full fresh-schema push was not used to
work around its unrelated accounting foreign-key setup failure; no shared
schema was changed.

Data survives browser refresh and PostgreSQL process restarts while this `/tmp`
directory exists, but is disposable and may not survive a recreated workspace.
Leave the current demo running for the owner's checks. When finished, stop the
API workflow before stopping this local server:

```bash
D=/tmp/ledgerly-w03-invoice-demo
env -i PATH="$PATH" HOME="$D" LANG=C LC_ALL=C pg_ctl -D "$D/data" -m fast -w stop
```

Do not delete the current directory or disable isolation while continuing the
demo. Any later deletion/reinitialization should be an explicit decision after
the synthetic records are no longer needed.
