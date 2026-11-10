---
name: Official reference anomalies
description: Preserve inconsistent official fixture inputs and quarantine them instead of inferring corrections.
---
Keep anomalous official examples verbatim, distinguish them from usable reference
expectations, and require source clarification before using them to qualify an engine.

**Why:** HMRC's 2026–27 NI v1.0 reference workbook contains four period-zero rows.
Assuming period one would invent input evidence while appearing to quote HMRC.

**How to apply:** Any new official fixture import must preserve source cells,
identify unexplained inconsistencies and fail closed for those examples. A pinned
official source is not accountant approval or statutory engine qualification.

Keep pay-period, annual-total and year-end-reconciliation stages separate even
when their period numbers coincide. Instruction-only cells are not zero results.

**Why:** Treating an annual total as the final week's deduction can double count
contributions while still quoting a genuine official number.

**How to apply:** Retain the original instruction and row identity, classify its
stage explicitly, and leave numeric expectations unavailable where the source
provides instructions rather than an amount.

Distinguish manual deduction-table instructions from payroll software
specifications before translating a rule into executable arithmetic.

**Why:** HMRC's manual multi-week loan instructions and software annual/period
threshold method have different rounding order. Applying the manual sequence
to the developer fixtures can change a deduction by a whole pound.

**How to apply:** Pin the software-specific authority, compare the existing
official examples and preserve discrepancies. Matching those examples remains
engineering evidence, not independent statutory qualification.

Do not spend another delivery job extracting tax reference tables while the
same qualification blocker remains unresolved.

**Why:** The owner explicitly prioritised completing native business journeys
over further reference extraction under an unchanged qualification blocker.

**How to apply:** Continue independent product and acceptance work; retain the
statutory gate rather than treating more imported examples as its resolution.
