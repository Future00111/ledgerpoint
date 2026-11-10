# Job 13 — extended lifecycle acceptance candidate

Base: 559be3ee132eca535d0343add8768aacf7ad7d84 (Job 12).
Branch: replit/four-day-job13. The preceding candidate chain remains unreviewed.
This is local AI-run acceptance evidence, not coordinator or accountant approval.

## Implemented

The four native customer/supplier prior-credit scenarios now reconcile six
historical cutoffs after the entire lifecycle has completed. They cover the
original, ordinary credit, optional correction, fresh payment, replacement discount
redemption and compensation. Each cutoff compares full-history, same-day and
previous-day native reports: journal balances, trial balance, party statements
and CSV projections, ageing, P&L, balance sheet, cash and VAT workings.

The extended scenarios also reject compensation in a closed period without
financial effects. Existing concurrent identical requests, source-forgery
rejection, rollback and replay checks remain part of these scenarios.

Encrypted recovery into a separate fresh cluster now executes the native
replacement overview and all 24 historical report snapshots for those four
lifecycles under the restricted runtime. Observation/history and permanent
consumption survive without recertifying foreign transaction origins.
The ordinary populated restore still fingerprints every captured table.

## Results and retained failure

Executable acceptance commit: 02962111013283339cfe2ee84e84dfb76a5c9a3d.
304/304 disposable-suite tests, 882/882 source/UI tests and 31/31 registry tests
passed, with zero failures/skips in final runs. Full build/typecheck passed before
the final test-only assertion additions. Populated restore preserved 46 tables /
14,264 rows. Encrypted native recovery verified four replacement lifecycles.
Both disposable clusters stopped and their directories were removed.

The first run exposed a test assumption, not an accounting defect: these supplier
fixtures do not claim input VAT, so P&L includes that cost while the purchases VAT
working retains the net amount. The shared acceptance helper now distinguishes
those two expectations. No production financial calculation changed. The failed
log and cleanup receipt remain in job13-evidence.

## Limits and next work

This bounded matrix uses one-line standard-VAT customer documents and supplier
documents with nonrecoverable input VAT. It is not exhaustive mixed-rate or
recoverable-input-VAT replacement acceptance. Existing isolated synthetic browser
tests remain in the suite; no new signed-in Clerk browser acceptance is claimed.
No demo, existing database, startup pointer, public posting gate, authoritative
queue, provider or GitHub control changed. Nothing was pushed, merged or deployed.

Job 14 is next in the existing owner backlog: inspect official fixtures and
dependencies before selecting an eligible in-house statutory calculation
prerequisite. Do not infer tax rules or treat this acceptance as production/HMRC
qualification.
