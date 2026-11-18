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

Native disposable tests exercise the boundary with synthetic payloads and
transactional fixture mutations, current membership races, audit failure and
existing owner-only membership assignment. No employee/personal-tax record
schema, public sensitive-record route, actual export or external submission is
introduced. Wiring every future native record/read/export/change route,
qualified field projection and sensitive audit retrieval
remain required before full P02-04 acceptance. These helpers are not evidence
that those absent workflows are secured or implemented.
