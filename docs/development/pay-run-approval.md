# Pay-run revision and approval

Implementation contract for the payroll approval portion of P02-04. The current application stores annual pay inputs. This document defines the record and transaction needed to approve a calculated run once qualified payroll results are available.

## Record the reviewer sees

A run belongs to one company and has a stable run UUID. Its head points to one immutable revision, identified by company, run and a positive integer revision number. The server assigns revision numbers under the run lock. Each revision contains:

- The pay period start and end, payment date, currency and payroll calculation rules version.
- The included employee lines, each with a stable company-scoped internal link, the versioned inputs used, and the resulting gross pay, itemised deductions, adjustments and net pay. Store amounts as integer minor units and retain the signed calculation breakdown.
- Server-calculated totals for the same components and the number of employee lines. The review response reads its summary and lines from the same stored revision. Sensitive source references stay server-side. The approver receives run-local line references for drill-down under the existing payroll projection rules.
- Preparation actor and server timestamp. Persist the snapshot independently of subsequent changes to employee or salary records. Bank details are outside the approval record.

An unqualified snapshot can be retained as a draft. Qualification changes require a new revision with newly verified results. The draft remains immutable.

The review screen identifies the run, revision, period and payday. The approval request references the displayed run and revision. The server loads the stored snapshot and verifies that all lines have qualified calculations and that totals reconcile before offering it for approval. Offline loan fixtures and annual-salary inputs alone cannot create an approvable revision.

## Transitions and authorisation

| Operation | Preconditions | Committed result |
| --- | --- | --- |
| Prepare or revise | Active company member with payroll.prepare. For edits, the expected head matches. | Append a new snapshot, advance the head and leave the new revision awaiting review once qualified. |
| Approve | Active company member with payroll.approve. The requested revision is the current, reviewable head. | Insert one immutable approval for that revision, recording company, run, revision, actor and server time. |
| Revise after approval | Same preparation and expected-head checks. | Preserve the prior snapshot and approval. The new head requires its own approval. |

Owners and payroll approvers use the existing approval capability. Preparers and owners use the preparation capability. Ordinary bookkeeping roles have neither. The role matrix assigns owners both capabilities. An active company owner may approve a qualified current revision they personally prepared. Record the owner as both preparer and approver, preserving the separate timestamps for the two decisions. Approval records a local decision only. Payments, ledger posting and external filings require separate workflows.

Use the existing payroll access boundary to lock the company and reload membership. Then lock the scoped run head, check the requested revision and perform the transition within that same transaction. Scope every lookup and foreign key by company. Record the protected audit event before commit, linked to the immutable revision through a stable revision resource UUID. Keep figures and employee references out of the audit payload. A rejected audit insert rolls back the transition.

Enforce uniqueness for both revision number within a run and approval per revision. An authorised retry for the same still-current approved revision returns the original receipt, including its original actor and time. A second approver cannot replace it. Treat a missing or foreign run or revision as unavailable without disclosing its existence. Only a revision belonging to the authorised run can produce a stale-head conflict. If the head has advanced, return a stale-revision conflict and require the reviewer to reload. Perform authorisation before returning a prior receipt. An access audit for a retry is distinct from the single durable approval.

Owner self-approval is a LedgerPoint access policy. HMRC allows employers to run their own payroll. The employer generally reports pay and deductions in a Full Payment Submission on or before payday, subject to the published exceptions. Local approval and the HMRC filing receipt represent separate events. [HMRC payroll options](https://www.gov.uk/paye-for-employers/choose-payroll) and [reporting guidance](https://www.gov.uk/running-payroll/reporting-to-hmrc).

## Acceptance examples for implementation

1. An approver opens revision 3. A preparer changes a deduction and commits revision 4. Approval of revision 3 returns a conflict and revision 4 has no approval.
2. If approval wins that race, revision 3 keeps its receipt. The preparer's subsequent revision 4 still requires review. A lost-response retry after the revision change returns a conflict.
3. Two authorised approvals of the same current revision produce one decision. Both callers can retrieve the same committed receipt. Audit failure publishes neither a new decision nor a successful response.
4. A reviewer who loses membership before the transaction acquires the company lock cannot approve or retrieve a receipt by retrying. Foreign-company IDs never expose the snapshot or receipt.
5. A synthetic unqualified line or a mismatch between line totals and the summary prevents approval. A later salary edit cannot change what an existing approval attests to.
6. An owner prepares and reviews the same qualified revision, then approves it. The preparation and approval records identify the same actor. A preparer who lacks payroll.approve cannot perform the same transition.

The next implementation slice is immutable revision storage and company-scoped readback in the disposable database. Verify snapshot stability, tenant isolation and restore before wiring an approval control to it.
