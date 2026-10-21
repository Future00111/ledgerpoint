# Clean invoice and partial credit walkthrough

21 October 2026. The owner requested clearing the current invoices and credits
and starting again with one invoice and one credit, visibly reconciled everywhere.

## Recoverable reset

The previous synthetic company was relabelled **Willow & Co — PREVIOUS DEMO
(synthetic)**. Its posted records, journals and payment remain intact; no
immutable guards were disabled or records deleted. A backup preceded the reset.

The active **Willow & Co — CLEAN DEMO (synthetic)** company is
`cc06efaa-9e23-4051-aa8a-c00887ccc0ca`. It retains the nine nominal accounts,
posting/payment mappings, custom presentation settings, open period, three VAT
rates and sample contact names/terms from the prior demo. It began with zero
documents, journals, journal lines and payment events; the P&L visibly showed £0.
Previous bills and payments therefore cannot affect the clean test's balances.

`tools/accounting-flow/fresh-invoice-demo.mjs` implements this one-time setup in
one transaction, verifies the fixed private development database and persistent
data-directory identity, and refuses a repeated reset. Before/after fingerprints
prove the previous company's financial records were unchanged. The reset receipt
is in the ignored persistent demo directory. This is synthetic development only.

## Created through the signed-in interface

- **INV-001**, `08265a9e-d855-4d39-8e43-de15dbf8ade1`: Cedar Studio (sample),
  21 October 2026, £120 including 20% VAT (£100 net + £20 VAT), due 20 November.
  Saved, reviewed and confirmed using the normal invoice workflow.
- **CN-001**, `f6feea4f-d736-4dca-bc28-62e0c2e1a939`: created from INV-001's
  Create credit note action, quantity 1 and £24 including VAT (£20 net + £4 VAT),
  with an explicit partial-reduction reason. Saved, reviewed and confirmed.

No invoices were sent and no payment or refund was recorded.

## Observed results

| Screen | Result |
|---|---|
| Original invoice | £120 original, £24 credit, £0 payments, £96 due; Partially credited |
| P&L Revenue detail | INV-001 +£100 and CN-001 −£20; two rows, total £80 |
| General ledger | Two balanced journals, six lines; movements £144 debit and £144 credit |
| Balance sheet | Receivables £96, output VAT £16, current earnings £80; Balanced |
| VAT workings | Box 1 £16, Box 4 £0, Box 5 £16, Box 6 £80, Box 7 £0 |
| Customer balances | £96 outstanding; invoice +£120 and credit −£24 |
| Customer detail | Both posted documents, £96 outstanding, £80 net revenue, no drafts |
| Customer statement | £0 opening, £120 invoice, £24 credit; £96 closing, £0 unapplied |

All entries were checked in the running signed-in preview against the same clean
company. This verifies this ordinary invoice/partial-credit journey; it is not
evidence of HMRC submission, payroll or full public-release readiness.
