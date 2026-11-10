# Job26 — consolidated development acceptance and export

## Scope and disposition

No earlier Job26 checkpoint existed. Incremental base is Job25
`316c9872977db523630dd610b3b3747f52efef39`. Cumulative export begins at the
original Job1 prerequisite `2212b74816f2f4d9913bb611a58668a8ae5c5094`.
That prerequisite and parent requirements are not automatically accepted.
Only the isolated source and fresh synthetic runners were used.
This closes the bounded development consolidation, **not commercial release**.
Stop here for independent review; no Job27 or competing work queue.

## New acceptance evidence

The populated/encrypted restore runtime now recovers a real native bank
opening receipt, committed import receipt and match receipt through the
restricted application's services before and after restore and compares their
entire returned evidence. All three kinds must be populated; unknown outcomes
do not count. This closes the specifically identified banking recovery gap.

The new check exposed a pre-existing fixture-selection hazard: prepare creates
a £1 synthetic payment, and random ordering could select a company used by
compensation acceptance, changing its expected zero unapplied cash to £1.
Selection now excludes compensation and replacement-observation companies.
No financial implementation or expected-balance assertion was weakened.
The failed run and its cleanup/restore receipts are retained.

Final PG/restore source: `012755b4f9d4275eedc3d89f5bc8ccf16757b44d`.
317 PG tests pass, zero failures/skips. Populated restore compares 52 tables
and 14,905 rows; encrypted separate-cluster application recovery also passes,
including all three banking recovery kinds. Runtime grants, source isolation
and cleanup remain checked by the existing runner.

Combined source/UI: 949 pass; migration registry: 31 pass; full build/typecheck
passes on base316c987. Subsequent executable changes are confined to the
restore acceptance script, compiled and executed in the final PG runner.
No product runtime source changed after the combined build.

## Actual banking journeys and provenance

- The immutable Job24B package supplies the normal Bank Accounts opening
  review/confirm/recovery browser journey and report/cutoff acceptance.
- The immutable Job24C package supplies CSV review/cancel, duplicate
  rejection, £70+£50 matching to a £120 original payment and balanced original
  journal. These are historical exact-source receipts, not reruns claimed
  against this head. The consolidated PG suite still exercises these services.
- Job26 loopback UI imported one £120 statement and committed one £70 match.
  The server returned200 before delivery was deliberately aborted. Reload
  recovered the original match; its journal remained exactly two £120 lines.
- Initial browser GET403 interception failed to fire. The same captured
  request body was then restored verbatim into browser session storage, with
  a targeted fetch wrapper simulating403 on its recovery GET. While the
  request was pending, a review of the remaining £50 was blocked, with no
  second POST. Removing the test flag allowed real recovery to confirm the
  original £70 and clear pending state. Final remaining amount: £50, explained
  by the intentionally uncompleted match, not an unexplained ledger defect.
- Browser source:52cc572ea4b86e04f2bde5c77c69048b21835c4f. Its only subsequent
  executable change is the restore fixture-selection filter.
- This is AI-assisted synthetic-header authentication, not real Clerk,
  human/accountant sign-off, or complete styled-app visual acceptance.
  The Replit preview origin was never visited.
- The browser launch copy changes only its schema import to an absolute
  local path and evidence output to Job26. Original runner and old evidence
  remain unchanged. The exact launch copy is exported.

## Remaining blockers and unsupported scope

1. Independent review of the consolidated repairs and prerequisite chain
   remains pending. The original Job25 independent review failed the earlier
   base; author regression results do not turn it into independent approval.
2. Real Clerk, complete customer-facing shell and release-environment
   acceptance remain outstanding. No production, HMRC or public qualification.
3. An already-open match panel retains its earlier warning after successful
   recovery, although the success banner, cleared pending state and actual
   balance are correct. This is a known minor UI clarity issue, not concealed
   as fixed or accepted.
4. Banking supports GBP original native customer receipts/supplier payments.
   Refund, reversal, fee, transfer and FX matching, confirmed-match undo and
   imported-evidence deletion remain unavailable. Matched-payment reversal
   fails safely until an explicit correction workflow exists.
5. Opening balances cover the supported bank-asset/equity path, not opening
   receivable/payable subledgers or a complete historical migration.
6. Exact-content duplicate imports have no legitimate-duplicate override.
   Storage-unavailable submission fails closed; failed lookup does not prove
   an earlier command absent. Large-scale import/history performance is not
   qualified by these synthetic cases.
7. No new bank/provider, OCR/email/LLM connection, filing, purchasing or
   deployment was performed. All previously documented statutory,
   conditional-discount and provider acceptance restrictions remain.
8. The original catalogue's 92 source requirements are preserved unchanged;
   neither these tests nor this export mark broad tax/payroll/accounting
   product priorities complete. The full catalogue and existing delivery
   documents are in the source archive, not replaced by a new plan.

## Failures, cleanup and package

The first combined foreground command hit its five-minute process limit during
PG tests. It produced no automatic finally receipt. Its log is retained; the
identified runner-owned cluster was independently confirmed stopped with
pg_ctl, then removed, with a manual cleanup receipt. The unchanged runner was
rerun in a background shell. The later fixture-interference failure is also
retained, followed by the final green run.

Final PG and browser cleanup receipts confirm owned services stopped and
temporary directories removed. Existing demos, databases, frozen candidates,
GitHub controls and all earlier review ZIP bytes were preserved. No push,
merge, deployment, activation, provider action or real financial data.

The export contains tracked source, cumulative and incremental binary patches,
a Git bundle with its explicit prerequisite, exact manifests, test/build logs,
restore and cleanup evidence, browser reports, the prior banking journey
packages, requirement-preservation hashes and RESUME.md. The manifest binds
final head/tree independently from each test's actual source.
