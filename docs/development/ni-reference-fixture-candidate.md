# Job 7 — official NI reference fixtures, not an engine

Scope: P04-01/P04-03 prerequisite for P09-04. Base
5b8b616eff816e15e49ba0ea1c532d1c3bf1e02f; depends on the unreviewed local
candidate chain. Shared source6ebee0fd204b1d9434fd349f6d0c850d57a3e0bc and
coordinator268 were inspected read-only; no queue/lease/acceptance changes.

The existing 44-case register, payroll family matrix, PAYE168 and student-loan130
official reference packs already exist. NI had no expected-result pack. The
register remains unqualified; P04-01/P04-03 parent acceptance and P04-02 engine
implementation are not inferred from adding this independent fixture slice.

## Primary evidence

- HMRC, *Software developers: payroll test data 2026 to 2027*:
  https://www.gov.uk/government/publications/software-developers-payroll-test-data-2026-to-2027
- National Insurance v1.0, retrieved 2026-11-06, effective tax year
  6 April2026–5 April2027:
  https://assets.publishing.service.gov.uk/media/69676c2297d42030a67b0d60/NI-test-data-examples-from-April-2026-v1-0__1_.zip
- Archive SHA256:
  49edd60c91df45d5f529b92291c018e4fc453ab17675035d1f2662825c0b0368
- Open Government Licence v3.0; source workbook hashes, sheets, rows, original
  numeric lexemes and HMRC reporting columns retained.

The offline importer extracts896 rows from the ordinary and Freeport/Investment
Zone workbooks:16categories ×4frequencies ×14examples. Expected employee,
employer and total NI are copied from cached official cells, not calculated by
our code. The shared existing PAYE importer normalizes only negligible binary
cache residue below0.000001pence; substantive fractions reject.

## Source anomaly preserved

Cat_S and Cat_L each have period0 at rows26 and44 in the official workbook.
The initial strict importer rejected this; its diagnostic is retained.
All four rows remain verbatim with sourceIssues. The executable reference
selector refuses them even if the issue list is stripped, and never silently
substitutes period1. Thus892 rows are available as reference examples;4require
source clarification. None of the896 is accountant-reviewed or engine-qualified.
No HMRC contact or filing was made.

## Checks and boundaries

Executable tests reproduce JSON from pinned archive bytes offline; assert all
category/frequency counts and unique lineage; reconcile employee+employer=total
in integer pennies; check explicit official penny boundaries; preserve source
anomalies; reject wrong-year, changed qualification status, duplicate identity,
unknown reference and quarantined lookup. Existing registry validation still
requires unqualified family status and null expectedResultEvidence.

Run from isolated source:

```sh
python -B artifacts/api-server/src/services/payroll/contracts/import_hmrc_ni_fixtures.py
node --test artifacts/api-server/src/services/payroll/contracts/niFixtures.test.mjs
node tools/development/check.mjs
PORT=5179 BASE_PATH=/ pnpm run build
```

Actual sanitized commands/logs and final identity are in job7-evidence.
No PostgreSQL tests are needed for this offline-only reference change:
no runtime routes, database, schema, grants, journals or financial writers changed.
No browser/demonstration/Clerk or independent approval claim.

Still missing: director annual/alternative examples (source archive retained,
not extracted), eligibility and geographic relief qualification, category
transitions, irregular periods, negative/refund/correction examples, other years,
accountant review and deterministic native engine. These remain commercial
requirements, not removed scope. Conditional replacement terms from Job3 remain
unimplemented. Job8 remains the next existing consolidation package.
