# Job 14 — director NI reference prerequisite

Base: 7bc33ceee1b3ae598906172446c82b47383d1078. Local branch
replit/four-day-job14; prior candidate chain remains unreviewed.

## Dependency selection

The preserved backlog orders deterministic calculation P04-02 after P04-01 and
P04-03. Its recorded state still marks all three pending, and the case register
contains 44 unsupported cases. The previous NI pack explicitly omitted director
examples already present in its pinned official archive. This is the next
independent reference prerequisite, not a claim to have accepted those parent
requirements or checked a newer authoritative remote state.

## Actual implementation

An offline importer now extracts all four director sheets from HMRC's retained
2026–27 NI v1.0 archive. It preserves workbook hash, source sheet/row, cached
numeric lexemes, contextual headers and reporting/YTD cells. It distinguishes
weekly employee-basis, annualised-total, year-end reconciliation and annual-method
stages. It imports 110 rows: 108 numeric expected results and two instruction-only
week-52 rows. Those two rows retain null expectations and explicit source issues;
they are not guessed, copied from a neighbouring row or turned into zero.

Source: https://www.gov.uk/government/publications/software-developers-payroll-test-data-2026-to-2027
Archive SHA256: 49edd60c91df45d5f529b92291c018e4fc453ab17675035d1f2662825c0b0368
Original archive retrieval: 2026-11-06; reused offline, not newly downloaded.
Effective tax year: 2026-04-06 through 2027-04-05. OGL v3.0.

Tests pin annual A results (£3,050.60 employee / £7,050 employer), annual M
(£2,815.92 / £239.40), and separate reconciliation amounts directly to cached
official examples. They check digest tampering, sequence/count, lineage,
reproducibility, stage distinction and integer-penny totals. The four Python
checks are also invoked by the existing NI Node test suite.

## Verification and limits

Executable head e96fdad9b5dc2f4db995888b4a3a39ae2a9efbbd passed four focused
Python checks, 883/883 current-source checks, 31/31 migration checks and full
build/typecheck. Initial strict failures on instruction rows are retained; the
fix classifies them without changing the original text, including whitespace.
The generated reference JSON and logs are in sibling job14-evidence.

No database tests were necessary: no runtime, schema, grants, records or routes
changed. No new calculation engine or reference-selector API was added. Registry
qualification and parent task status remain unchanged. No independent accountant
approval, production/HMRC acceptance, filing, demo/startup change, push or merge.

## Blocked calculation slice and next step

Actual NI calculation is not implemented by this package. Before an eligible
slice, pin its statutory method, thresholds, rounding and effective-date rules;
map the exact supported selector/input boundaries to independently verified
expected-result evidence and satisfy the recorded prerequisite acceptance.
Do not use cached-result lookup as an engine or infer category/appointment
eligibility from these examples. Other years, category transitions and irregular
or negative-pay/correction cases remain unqualified.
