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

`GET /api/companies/:id/payroll-pay-records/:recordId` reads one persisted GBP
annual pay record from `public.employee_pay_records`. The fixed response has
`id`, `effective_from`, `annual_salary_pence` (an exact decimal integer string)
and `currency: "GBP"`. Current owners and `payroll_preparer` members additionally
receive the internal `employee_id`; `payroll_reader` and `payroll_approver` do not
select or return that column. Ordinary bookkeeping and personal-tax roles receive
no fields. Bank, NINO, names and other identifiers are outside this record model.

The existing sensitive boundary locks the company, reloads unique active
membership, selects the role's fields with exact company/record predicates and
commits a redacted `payroll.read` receipt before returning. The record store must
be an ordinary table owned by the canonical owner with runtime SELECT only,
including no column INSERT/UPDATE grants. Missing/foreign records share a denial;
audit or storage protection failure releases no salary or employee reference.
All route responses use `no-store`, including authentication failures. Query
overrides, collections, exports and existing-record mutation endpoints are absent.

`POST /api/companies/:id/payroll-pay-records` creates one dated annual pay intent
for a current unique active owner or `payroll_preparer`. Its exact body is `id`
(client-generated record UUID and idempotency key), `employee_id`, `effective_from`
(real Gregorian date `YYYY-MM-DD`, years 0001–9999) and `annual_salary_pence`
(canonical nonnegative integer string through the PostgreSQL bigint maximum).
Currency is implicitly GBP; extra fields, caller authority and query parameters
are rejected. Employee references accept native PostgreSQL UUIDs; record IDs use
the existing sensitive-request UUID contract.

The response is only `{id,status}`, with 201/`created` or 200/`replayed`. A current
authorized owner/preparer can replay the same company/id and exact canonical
intent. Changed employee/date/amount or a different id on an occupied company,
employee and effective date returns a redacted 409. Company identities are
independent. A later date creates a separate record without overwriting earlier
pay. Administrator-seeded rows cannot be claimed as native creations, even by
forging an audit row: the restricted function also checks protected origin data.

`ledgerly_api` retains SELECT-only table access. A fixed, canonical-owner definer
function with pinned search path rechecks locked active membership, validates
protected audit storage and writes the record plus one redacted creation receipt
atomically. The normal `payroll.prepare` boundary adds an allowed-operation
receipt for every successful create/replay. Neither receipt contains the employee
reference, date or salary. Unknown function status, unsafe function grants and
failed/skipped receipts fail closed; wrapper failure also rolls back a newly
inserted record and its creation receipt. Denied/conflicting requests add no
success receipts. Retries after revocation remain denied.

These workflows are qualified with synthetic disposable records. They do not
calculate payroll, manage full employee/employer setup, create a live pay run or
make payments. The company pay-record UI uses the native read/create endpoints.
The additive schema and populated restore checks are coordinated separately.

`GET /api/companies/:id/personal-tax-preparations/:recordId` reads one persisted
annual employment-income draft input from `public.personal_tax_preparations`.
Owners and `personal_tax_preparer` members receive `id`, `tax_year_start`,
`employment_income_pence` as an exact decimal integer string, `currency: "GBP"`
and internal `taxpayer_id`. `personal_tax_submitter` receives the same input
without `taxpayer_id`; its SQL projection never selects that column. Payroll,
ordinary bookkeeping, inactive, unknown and ambiguous memberships receive no
fields. Taxpayer references accept native UUID values; route record IDs retain
the existing sensitive-request UUID contract. NINO, UTR, bank data and other
personal identifiers are not part of this record.

The existing `personal_tax.read` boundary locks the company and rechecks current
membership, applies exact company/record predicates, and confirms a redacted read
receipt before disclosure. Missing and foreign records share a denial; failed or
silently skipped audit insertion releases no data. `Cache-Control: no-store`
also covers authentication failures and absent collection/mutation routes.
No role, field, company or year query overrides are accepted.

Both native sensitive record stores use one closed internal table allowlist to
attest canonical ownership, an ordinary table and runtime SELECT-only access,
including absence of column INSERT/UPDATE grants. Existing pay read/create
behaviour is unchanged. Personal-tax inputs here are seeded only by the isolated test
administrator; no tax create, list, export, submission or UI is enabled.
One company/taxpayer/year may hold one annual employment-income input, not one
row per employer. Amounts are nonnegative bigint pence and the storage year is
an integer from 1 to 9998.

That storage range is not a supported tax-year or statutory qualification claim.
The existing tax declaration register separately lists 2025–26, 2026–27 and
2027–28 as unqualified cases. Its complete taxpayer model requires source,
residency, region and period evidence absent from this single input. This read
does not resolve a declared calculation case, calculate taxable income or a
liability, map a return box, or grant external filing authority. A populated
owner/submitter fixture is retained for independent encrypted-restore checks.

Native disposable tests exercise the boundary with synthetic payloads and
transactional fixture mutations, current membership races, audit failure and
existing owner-only membership assignment. Complete employee lifecycle,
remaining personal-tax record workflows, actual exports and external submission
remain absent.
Wiring the remaining native record/read/export/change routes,
qualified field projection and retrieval of other sensitive audit actions
remain required before full P02-04 acceptance. These helpers are not evidence
that those absent workflows are secured or implemented.
