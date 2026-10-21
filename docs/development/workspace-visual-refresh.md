# Workspace visual refresh — 21 October 2026

The owner requested a clearer, more polished main menu and daily workflows,
using Xero's workflow organisation as a reference without copying its interface.
All existing features must remain accessible.

## Implemented interface

- Dark green navigation, warm neutral workspace, consistent type and spacing.
- Search all menu tools; one section expanded at a time; clear selected page.
  All 35 unique existing menu destinations remain. Planned tools remain available
  through **Show planned tools** and search, with their existing Soon labels.
- A simple ledger-backed Overview with outstanding sales/purchases, revenue,
  profit, next steps, cash and document links. **My dashboard** preserves the
  existing templates, customisation, widgets and saved layout preferences.
- Consistent invoice, bill and credit registers, status counts, search, balance
  summaries and links to details. Earlier drafts remain accessible.
- Posted documents are readable documents instead of disabled editing forms.
  Balance, payment/credit history, original credit links and journal details
  remain accessible. Drafts retain the existing save/review/post safeguards.
- A reports library groups financial reports by purpose, retaining date filters,
  CSV exports, account statements and the earlier report tools.
- One persistent Ask entry in the header, with Cmd/Ctrl+K and contextual entry
  points. The floating overlay and bare-Space interception are removed to keep
  content clear and normal keyboard button operation intact.

No accounting engine, tax calculation, authorisation or posting guard changes.
Menu availability is not a claim that every planned module is implemented.

## Persistent development demo

The owner authorised a fresh synthetic demo after the interface work. The old
`/tmp` data directory was missing after a workspace restart; this does not recover
those records. PostgreSQL data now lives in the ignored workspace directory
`.local/share/ledgerly/demo/data`. Only its private Unix socket lives in `/tmp`.
Normal development API startup starts the existing database; it never creates,
resets or replaces it. fsync stays enabled. The fixed socket, development-only
flag, database/role identity checks, Clerk and company scopes remain enabled.
External DATABASE_URL and libpq credentials are never used by the demo tooling.

Explicit commands (from the repository root):

```sh
NODE_ENV=development W03_INVOICE_DEMO_MODE=1 node tools/accounting-flow/persistent-demo.mjs create
NODE_ENV=development W03_INVOICE_DEMO_MODE=1 node tools/accounting-flow/persistent-demo.mjs status
NODE_ENV=development W03_INVOICE_DEMO_MODE=1 node tools/accounting-flow/persistent-demo.mjs backup
```

`create` refuses an existing persistent or old temporary cluster. Backup dumps
are retained under `.local/share/ledgerly/demo/backups` with private permissions.
Workspace storage and these local backups survive process/workspace restarts;
this is still synthetic development storage, not production hosting, off-site
backup or a guarantee against workspace deletion.

The fresh **Willow & Co — DEMO (synthetic)** sample contains five invoices,
three bills, two linked credits and one synthetic payment: seven posted documents
and three drafts. It is created by `workspace-demo.ts`, which requires an invoice
from the authenticated owner's initial synthetic company and refuses an existing
sample. It uses the normal protected save, posting and reviewed payment services;
no source totals or canonical journal rows are inserted directly. The initial
four accounting-flow drafts remain untouched in their own company.

## Verification

Frontend typecheck and production build passed (the existing large-bundle warning
remains); all nine focused editor/date/account-selection tests passed. A source
comparison confirmed all 35 unique pre-existing menu destinations are retained.
The source for the customisable dashboard and its saved-layout keys is preserved.

Signed-in preview checks confirmed menu search, the report library, the new
Overview and real figures: customers owe £1,310, suppliers £444, revenue £1,491.67,
profit £1,121.67 and posted cash £480. INV-002 shows £60 original, £10 credit and
£50 due; its expandable journal contains the original £60/£50/£10 entries.
INV-004 saved and reloaded an edited reference while staying an unposted £840
draft. No owner-prepared accounting-flow draft was posted.

The API and local PostgreSQL process were stopped, then the normal API workflow
restarted the existing persistent cluster. Before/after sorted record fingerprints
matched across all 14 documents, eight journals, 23 lines and one payment. API
health passed and a fresh private backup was created. Evidence files and dumps
are under the ignored persistent demo directory. This verifies process restart
persistence, not workspace deletion recovery, off-site restore or public launch
readiness. Independent accountant acceptance and a full feature-by-feature
functional review remain separate from this interface delivery.
