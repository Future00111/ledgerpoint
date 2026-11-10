# Job 19 — executable statutory prerequisite

Base: f37fe6fa9facbf73c2bc63eb90f929117e87946d.
Branch: replit/four-day-job19. No application engine is enabled.

## Why this bounded family

The supported-case register still blocks every payroll loan case. Existing
official fixtures already cover five plans and four regular frequencies with
130 exact examples. Unlike another reference import, the new offline executable
specification checks actual calculation order, rounding and input exclusions.
Director NI remains a separate unresolved family; Job14's stage distinctions
and instruction-only examples are preserved, not replaced.

## Pinned authority and calculation order

HMRC, **Collection of student loans from 6 April 2026**, sections 3 and 4:
https://www.gov.uk/government/publications/payroll-technical-specifications-student-loans/collection-of-student-loans-from-6-april-2026

The full extracted Markdown is retained under
tools/payroll-specification/sources/student-loans-2026-27.md.
SHA256 a9ae92e1586f836ce5aa77fbb295bd33bdb5d4d8c6cc6d07e2ec1816af586243.
This pins fetched extracted text, not the original HTML response.
Recorded source check: 2026-11-09. OGL v3.0; HMRC/Crown copyright.

Annual thresholds in pounds: Plan1 26,900; Plan2 29,385; Plan4 33,795;
Plan5 25,000; postgraduate 21,000. Student rates 9%, postgraduate 6%.
Effective year is 6 April 2026 through 5 April 2027; no carry-forward.

Executable sequence, using integer pence:
1. Require explicitly selected year, plan, regular frequency and Class1 NI
   earnings; do not infer eligible earnings from gross pay.
2. Divide annual threshold pence by 52/26/13/12 for weekly/fortnightly/
   four-weekly/monthly respectively; truncate fractional pence.
3. Excess is max(earnings minus that threshold, zero).
4. Multiply excess by the integer percentage rate.
5. Divide by 10,000, truncating to whole pounds; multiply by 100 to return pence.
6. Retain a trace and explicit unqualified/not-for-payroll labels.

Do not average and round weekly deductions before multiplying for a fortnight.
Do not multiply an already truncated weekly threshold either. The software
specification, not SL3 manual-table instructions, governs this review oracle.
The retained manual guidance explicitly targets manual use when software is
not used; applying it indiscriminately would contradict developer fixtures.

## Inputs, exclusions and expected-result provenance

Required exact fields: taxYear, plan, frequency, payMinor, paymentDate,
earningsBasis, confirmedInstruction, protectedEarnings, concurrentLoan,
correction, offPayroll. Unknown or omitted fields reject. Pay is a canonical
nonnegative integer-pence string up to 16 digits (engineering bound, not a
statutory earnings limit). Valid payment dates must fall in the pinned tax year.

This review models one ordinary regular payment and one already-confirmed loan,
with no protected-earnings restriction. Eligibility is a supplied synthetic
precondition, NOT established by a boolean or by this tool in real payroll.
Excluded: notice start/stop/change decisions, unknown-plan default selection,
concurrent postgraduate/student loans, protected-earnings prioritisation,
irregular/short/annual periods, aggregation, negative pay, corrections/refunds,
deemed off-payroll employment, director-specific earnings treatment, other years
and full gross-to-net/payroll lifecycle. Retain these as delivery requirements.

Reuses existing hmrc-student-loans-2026-27-v1.0.json and its ODS:
- ODS SHA256 e2f5bd68521c135faf7b5d43296127d378ecaa6a6b936b0c8253974dda1c7e83.
- JSON SHA256 eb1370c37654efa845e4ea82c1761381f29f1d6fdabfefa666c786f79c4413a5.
- 130 examples, five plans, four frequencies; sheet and row preserved.
- Payment date, confirmed instruction and exclusion flags used by the comparison
  are labelled synthetic assumptions, not invented HMRC input evidence.
- Original expectations are never rewritten to fit the implementation.

The comparison emits a discrepancy list with row IDs, expected and observed
amounts. Current arithmetic matches all 130. Twenty parameterised boundary
checks include zero, below/at/above threshold and the existing penny-wide
£0-to-£1 transitions. Additional checks cover wrong order, invalid context,
effective-year edges, exact large integers, statelessness and application denial.
Independent boundary cases are engineering-derived; only corpus expectations
are labelled official examples.

## Remaining gate and exact next decision

P04-01/P04-03 prerequisite acceptance and independent evidence remain absent.
All five real case selectors still return CASE_NOT_QUALIFIED; the register,
queue and application imports are unchanged. The new executable oracle lives
only in tools, is integrated into source checks, and cannot run payroll, post,
file, make deductions or make eligibility decisions.

Engineering review required:
- independently verify source transcription, period mapping, exact arithmetic,
  input validation and fixture lineage/digests;
- validate rejection and integration boundaries, notices, earnings determination,
  corrections, concurrency, persistence and full-run reproducibility.

Independent payroll/tax professional review required:
- approve intended eligible population and Class1 earnings basis;
- approve notice timing/default selection and excluded-case treatment;
- validate statutory interpretation, priority/protected earnings, combinations,
  and independently reconcile expected outcomes for the intended supported slice.

No such reviewer or approval is available in this run. Author tests are not
independent acceptance. Before a production-service slice: approve these
exact rules and population against the pinned artifacts, record independent
review evidence and satisfy the register's prerequisites. Only then implement
the bounded application adapter and broader acceptance; never promote a case
because this oracle matches its examples.

## Validation and preservation

Run `node --test tools/payroll-specification/studentLoans.test.mjs` for focused
acceptance; `node tools/development/check.mjs` includes it with current source
checks. The pinned fixture importer continues to reproduce original ODS bytes.
No database tests are needed: no runtime service, UI, schema, grants or stored
financial state changed. No live demo, provider, queue, lease, push, merge,
deployment or filing actions. Prior Jobs1–18 candidates remain preserved.
Full results and exact tested identity are retained in sibling job19-evidence.

Validated source: 117a5e4bd8a2a8634786a89cdc5644bc9947465c.
919/919 source tests passed, including all 25 executable specification checks.
All 130 official comparisons matched, with zero discrepancies. Full app
build/typecheck passed. No test database or server was started. This prerequisite
delivery is complete; application calculation and professional acceptance remain
blocked as described above. Job20 combined acceptance does not waive those gates.
