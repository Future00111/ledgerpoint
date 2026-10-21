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
