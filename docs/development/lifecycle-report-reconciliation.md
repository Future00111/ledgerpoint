# Job4 — supported lifecycle reconciliation

Local candidate based on 5cb5e4e87ca80aed1cc23b699fa90816c3bae2a5.
Parent P01-03/P01-04; depends on the unreviewed Jobs1–3 and compensation
candidate. No coordinator lease or independent acceptance is claimed.

Extended real disposable PostgreSQL scenarios exercise the native statementRows
and reportRows projections used by customer statement/report screens. Tests
compare full-history, movement-only and immediately preceding cutoff reports.

Customer and supplier coverage:
- Original120, cash50, correction108, credit12 => outstanding46.
- Final credit96 releases cash allocation50: outstanding0, unapplied50,
  cash unchanged. Cutoffs cover original, payment, correction, partial credit,
  full credit and a later period with no movements.
- Conditional compensation with allocation undo: outstanding22, unapplied10,
  original cash108 preserved, frozen discount12 reversed.
- Compensation after a completed surplus refund: outstanding22, unapplied21,
  cash119 preserved; no refund reclamation.
- Full payment reversal after discount consumption for cash108 and cash120:
  outstanding120, unapplied0 and cash0.

Assertions link exact party open/unapplied/net amounts to ageing totals and
statement opening/running/closing balances; reconcile balanced GL movements,
trial balance, balance-sheet equality and cumulative earnings; assert expected
P&L and VAT values and period deltas. Narrowing `from` must not reset trial
balance, balance sheet, ageing or open items. CSV paths use the real native
projection, not a second report implementation.

No new financial calculation or cosmetic rewrite is warranted without a
demonstrated discrepancy. This package changes test coverage, not report runtime.
Existing repeatable-read reporting and financial safeguards remain unchanged.
No new browser session or real Clerk/owner acceptance is claimed.

Conditional replacement terms have an approved policy but are not implemented.
These checks cannot qualify that future lifecycle or close all of Job3/P01-03.
Next backlog item is Job5 operation recovery, subject to a continuation request;
do not rebuild existing payment recovery or start unattended work.
