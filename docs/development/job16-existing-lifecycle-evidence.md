# Job 16 — supported scenarios already implemented; no duplicate engine

Inspection of Jobs9–13 finds the requested supported scenarios already present:

- `conditionalDiscount.integration.test.ts`: Job11 both customer/supplier,
  ordinary prior £24 credit, with/without correction £120→£96, explicit £12
  replacement, fresh £84/£60 payment, redemption, compensation/unallocation.
  Existing rollback, concurrent same-request replay and source-fraud cases remain.
- `corrections.integration.test.ts`: both-party correction after credits,
  cumulative line capacity, exact history, stale reviews, concurrent payments,
  period closure, rollback and immutable consumed-allowance boundaries.
- The same file's corrected supplier claim tests retain cancelled claim history,
  recalculate fresh claim capacity from corrected original lines, and use actual
  receipt confirmation. Corrupt bill/credit history fails closed.
- Job13 report/restore cases exercise actual settlement and historical source
  journals, not caller totals. Original terms and permanent consumption survive.

The financial services, their tests, schema and runner are byte-identical to the
Job13 executable test source 02962111013283339cfe2ee84e84dfb76a5c9a3d. A Git
path-identity receipt accompanies this record. Its preserved runner passed 304/304
with populated/encrypted restore and cleanup; this job did not rerun that suite.

Not supported: corrected/reversed child-credit combinations and certain downstream
reallocations; their rejection guards remain. Public conditional posting remains
closed. Extended mixed-rate/recoverable-supplier lifecycle acceptance and real Clerk
browser acceptance remain gaps, not implicit approval from the existing counts.

No further eligible implementation was identified in this bounded supported set.
Per the instruction to reuse implemented behavior, proceed to the concrete Job17
unknown-outcome recovery defect rather than duplicating allocation or credit engines.
No runtime/schema/queue/demo changes in this documentation-only checkpoint.
