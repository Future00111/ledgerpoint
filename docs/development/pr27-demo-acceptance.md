# PR27 isolated demo acceptance

30 October 2026. Development preview only; PR27 remains a draft. No merge,
publication, external provider connection or production-data change is authorised
by this record. The whole-product backlog remains in the delivery board.

## Environment and preservation

The review app runs in a separate worktree and a new PostgreSQL cluster/database,
`ledgerly_pr27_review`, through a private Unix socket on port 55442. Launch checks
the database identity before starting the restricted API role. Clerk and company
membership checks remain enabled; unauthenticated company requests return 401.
Autonomous AI jobs are omitted from the local review entrypoint.

Only two reversible development launch pointers changed in the original Replit
workspace. Exact originals, restoration instructions, seed manifest and database
fingerprints are retained there under `generated-artifacts/pr27-isolated-demo/`.
The previous database was not migrated, reseeded or reset. Setup verification
reported identical content fingerprints for all 27 original tables, including
3 companies, 24 accounts, 17 native documents, 11 journals and 32 journal lines.

## Authenticated browser checks

Company: **PR27 Credit Recovery — SYNTHETIC TEST DATA**. All amounts below are
synthetic, and recording a payment did not instruct a bank transfer.

| Journey | Observed result |
| --- | --- |
| Original supplier bill | Two calipers at £50 net each plus a separate £20 net surcharge; £144 gross. Linked £30 credit leaves £114 due and preserves the original. |
| Incoming-credit suggestion | A posted quantity-0.5 credit is highlighted against the one-caliper £60 claim, separately from the £24 surcharge. |
| Explicit match | Confirmation records £30 received and £30 remaining on the caliper. Reload preserves the result and receipt history; the match action disappears. Bill balance stays £114. |
| Awaiting-only item | Select the posted bracket line in the bill; reason, return note, part, vehicle and dates are retained. Expected amount is £10 net + £2 VAT. Its £12 bill balance does not change. |
| Cancellation | Cancelling a claim without receipts preserves its history under Cancelled and excludes it from open totals. A replacement can be created through the normal bill selection form. |
| Search and status | Part and vehicle searches return the expected item; Received has a truthful empty state. Three open claims total £66 after the partial receipt; cancellation test history remains visible separately. |
| Sales and payment history | £120 invoice − £10 linked credit − £50 recorded payment = £60 outstanding. The payment link opens that exact event and its allocation history. |
| Statements | Customer £60; supplier £126 across the £114 main bill and £12 bracket bill. Source and journal links are present. |
| P&L | Revenue £91.67, costs £105, loss £13.33. |
| VAT and balance sheet | Output VAT £18.33, input VAT £21; net VAT position −£2.67. Assets £131 equal liabilities £144.33 plus earnings −£13.33. |
| Trial balance | Closing debit and credit totals both £236. These closing balances differ from the £366 gross journal movements. |
| Mixed-rate draft | £100 net at 5% plus £100 net at 0% saves and reopens at net £200, VAT £5, total £205. It remains unposted; dashboard balances are unchanged. |
| Company switch | Switching to the empty configured test company clears payment history and claims; switching back restores the correct company data. Delayed-request races are separately covered by automated tests. |

Date controls were verified with keyboard entry and persisted after saving. A
browser automation fill that changed the DOM value without committing a React
change was diagnosed and repeated using normal keyboard events; no application
workaround or date-model change was introduced.

## Findings addressed before handoff

The legacy journal page exposed a gap in isolated provisioning: its existing
`journal_entries` table was excluded from the selected schema export. The review
fix includes that existing table with SELECT-only runtime access; explicit
INSERT/UPDATE/DELETE/TRUNCATE revokes and a real PostgreSQL regression test keep
it from becoming a financial-write bypass. Normal existing-demo startup still
does not apply schema changes.

The page also treated a failed read as a balanced zero ledger and consumed
nonexistent header debit/credit fields. The corrected page uses the actual stored
entry totals, exact precision, a retryable neutral error, and labels confined to
displayed legacy history. Generic entity failures retain server diagnostics but
return a neutral 500 response without SQL text. See the PR's latest-commit
validation and browser recheck before accepting these follow-up changes.

## Remaining scope

This demo proves the coordinated first slice, not a completed accounting product.
Upload/photo OCR and email ingestion are foundations only. Native bank matching,
canonical VAT preparation integration, filing, tax and payroll remain separate
workstreams. Later return cycles, receipt correction/reallocation and credits
after full payment need the accounting contracts described in the delivery board.

The PR records current-commit automated results. Review the demo before any merge;
do not treat the original commit's green checks as evidence for a later patch.
