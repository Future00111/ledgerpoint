# Invoice traceability and usable profit & loss

21 October 2026 follow-up to the workspace visual refresh.

The fresh Willow demo had only `STANDARD_20` configured. Its invoice editor
correctly read company tax rules, which meant 5% and zero-rated were missing.
The demo seed now installs three explicit rules. The guarded
`repair-workspace-vat.mjs <company-id>` command adds missing rules to the existing
Willow synthetic company only, using its fixed private socket and verified
persistent data directory. It refuses conflicting existing rules and does not
reset or rewrite any documents, journals or saved tax evidence.

The observed £60 `FLOW-UI-DRAFT-001` invoice was already posted: receivables £60,
sales £50 and output VAT £10. The P&L and VAT totals already included it. The
missing feature was a clear path from the document to the report detail.

## Customer-visible changes

- Posted invoices, bills and credits show **Where this appears**. Amounts come
  from actual journal lines using the document's saved posting accounts.
- Report links retain the document and dates; the report identifies its entries
  separately from whole-company totals. Drafts explicitly say they are excluded.
- The P&L has a conventional statement layout with revenue, cost of sales,
  gross profit, operating expenses and net profit. Existing custom account names,
  groups and ordering are retained.
- Select a category, custom group or nominal account to open its transactions.
  Rows combine split journal lines per document and retain negative credits.
  Search by document or contact, open source documents/journals and export the
  matching detail with its total. Back navigation keeps the report dates.
- Date shortcuts, manual dates and explicit report refresh are available.
  Balance-sheet account amounts also open the cumulative ledger detail.

## Verification

- Three focused trace/aggregation cases cover saved custom accounts, credit
  signs, unrecoverable VAT in costs, split-line aggregation and dated links.
- All 15 isolated accounting integration cases passed. The new case exercises
  5% and zero-rated invoices, bills and both credits under inclusive/exclusive
  input, then checks P&L, VAT, balances and the canonical ledger. Repeat rule
  installation adds nothing; drafts remain outside financial reports.
- Frontend production build and typecheck pass.
- Signed-in preview: the user's £50 net sale appears in the Revenue drilldown,
  its source link opens the £60 posted invoice, and the invoice links back to
  the P&L with the £50 posting identified. The restored VAT options are visible.

No tax calculation, canonical posting, authentication or isolation controls were
changed. This remains the synthetic development environment, not HMRC filing or
production qualification. VAT rates reference: https://www.gov.uk/vat-rates.
