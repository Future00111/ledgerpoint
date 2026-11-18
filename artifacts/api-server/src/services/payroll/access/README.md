# Native sensitive-operation access boundary

Development outcome for P02-04. The company owner can assign specialized roles
through the existing Clerk-verified membership flow. Existing bookkeeping roles
and posting permissions are unchanged. Specialized roles never gain generic
company writes or native invoice draft authority.

| Role | Payroll rights | Personal-tax rights |
| --- | --- | --- |
| owner | Read, export, prepare, approve | Read, export, prepare, submit |
| payroll_reader | Read | None |
| payroll_preparer | Read, export, prepare | None |
| payroll_approver | Read, approve | None |
| personal_tax_preparer | None | Read, export, prepare |
| personal_tax_submitter | None | Read, submit |
| admin, accountant, staff, member, read_only | None | None |

Read covers a scoped native salary, identifier or bank record; export is a
separate action. Approval/submission do not grant preparation. Owner retains
explicit full local rights. Submission permission never supplies HMRC consent,
provider credentials or authority to send an external request.

`withPayrollAccess` and `withPersonalTaxAccess` accept an exact request shape
containing company, actor, resource company, resource UUID and action. They lock
the company and reload current membership before invoking trusted server code.
Unknown/inactive/ambiguous roles, mismatched resource company, invalid action
and request-supplied role/capabilities fail closed. The callback receives only
the scoped transaction/context, must enforce actual native record ownership,
must use that transaction, and must not stream a response or make external calls.
It returns data for disclosure only after protected audit insertion and commit.

The existing append-only `accounting_audit_events` stores fixed action,
actor/company/resource identity, current role and version. It never stores the
callback result, salary, bank details, tax identifiers, request body or export.
Audit protection is checked before the callback. Audit failure rolls back local
mutations and prevents a returned result; arbitrary diagnostics are redacted.
The insert must return the expected audit ID; silent trigger suppression also
fails closed.

The existing membership routes audit grants, invitations, role transitions and
removals involving any specialized role, including self-removal and deletion of
a company. They retain the company lock and current membership authorization,
then commit the membership mutation and audit in the same transaction. Each
event records the actor, company, membership UUID, operation, previous/next role
and active state. It omits target user IDs, emails, names and request bodies;
actor IDs remain necessary audit identity (including self-removal). Company
deletion records one event per specialized membership, including inactive rows,
and verifies that the company was deleted before commit. Audit history survives
company removal. Denied, same-role and bookkeeping-only membership operations
produce no sensitive event; bookkeeping-only changes do not require this audit
storage. Existing owner-only assignment and last-owner rules are unchanged.

The canonical disposable runtime grants no `DELETE` privilege on `companies`
or `company_users`. Under those unchanged grants, owner/self removal and company
deletion return the existing generic failure response with no committed data
or audit changes. Positive deletion and its audit/rollback behaviour are
qualified only with explicit test-only `DELETE` grants around individual awaited
requests in the serial disposable suite. The fixture verifies the baseline,
grants only the required table permissions, revokes them in `finally` (including
when the operation throws), and verifies permission restoration. No application
grants, runner configuration or deployment permissions are changed. These
conditional tests do not establish that deletion is available in the canonical
runtime or authorize enabling it elsewhere.

`GET /api/companies/:id/specialist-access-history` returns the latest 50 persisted
specialized membership-change events for a current unique active owner. It locks
the company before reloading authority and returns `events`, `limit: 50` and
`has_more`, ordered by event timestamp then UUID, newest first. There are no query
parameters or pagination. Each event contains only its UUID, UTC timestamp,
membership UUID, allowlisted operation, previous/next known role and boolean/null
active flags. Deleted membership rows do not erase history; deleted companies
are inaccessible through this endpoint. Stored actor IDs, target identities,
emails, monetary data and arbitrary context are excluded. Missing, unknown or
contradictory projected metadata fails closed; valid historical null active flags
are retained.

Every successful read, including an empty result, commits a separate protected
`sensitive_membership_history_read` receipt with the authenticated actor, company,
fixed contract and result count before disclosure. Reads are excluded from the
returned history. Protection failure, failed/skipped receipt insertion or commit
failure returns no history. All endpoint responses, including unauthenticated
failures, use `Cache-Control: no-store`. This endpoint does not expose other
sensitive audit actions or add an access-management UI.

Native disposable tests exercise the boundary with synthetic payloads and
transactional fixture mutations, current membership races, audit failure and
existing owner-only membership assignment. No employee/personal-tax record
schema, public sensitive-record route, actual export or external submission is
introduced. Wiring every future native record/read/export/change route,
qualified field projection and retrieval of other sensitive audit actions
remain required before full P02-04 acceptance. These helpers are not evidence
that those absent workflows are secured or implemented.
