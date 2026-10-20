# W03 proposed role-operation and membership contract

**Review proposal, not an implemented or newly approved permission policy.**
Read with the [package index](ledgerpoint-w03-contract-review-package.md).
DEC-05's Owner/Admin/Accountant draft create/edit direction is approved;
the exact identifiers, grants, deletion and membership procedures below need
review. Uppercase role names here describe presets; wire role strings are
exact lowercase `owner`, `admin`, `accountant`, `manager`, `read_only`.
Reject case variants, whitespace, null/blank/unknown strings. No aliases.

## 1. Operation matrix

Y = allowed only with current active company membership and full field/
reference/revision guards. S = explicit matching scope grant required.
G = explicit Owner-issued administrative grant required. N = denied.

| Operation | Owner | Admin | Accountant | Manager | Read-only/unknown/inactive |
| --- | --- | --- | --- | --- | --- |
| Read company accounting/AI recommendation | Y | Y | Y | Y | Read-only: approved reads only; unknown/inactive: no new read grant |
| Invoice/bill draft create | Y | Y | Y | S | N |
| Draft source/metadata edit | Y | Y | Y | S | N |
| Draft delete (new proposed preset) | Y | Y | Y | S | N |
| Atomic financial bulk | Each element's capability | Same | Same | S for every element | N |
| Persist AI draft/analysis/task decision | Matching write capability | Same | Same | S and matching operation | N |
| Add/invite/change/remove non-Owner member | Y | G, restricted as below | N | N | N |
| Appoint/promote/demote/remove/deactivate Owner | Y, never last active Owner | N | N | N | N |
| Issue/revoke Admin membership or Manager scope grant | Y | N | N | N | N |
| Edit own membership role/grants | Same Owner rule, not last active Owner | N | N | N | N |
| Post/approve/settle/pay/reverse/correct/period/chart/config/VAT approval | Existing separately approved capabilities, **not granted by W03** | Same | Same | Same | No added authority |
| Modify posted document/journal via draft/generic route | N | N | N | N | N |

`financial.invoice.draft.{create,update,delete}` and
`financial.bill.draft.{create,update,delete}` are proposed finite capability
IDs. Bulk and AI are **not extra super-capabilities**. AI actor context uses
the authenticated delegating user, exact company and resulting operation;
AI origin does not override current membership or turn Read-only persistence
into a read. View-only AI endpoints must not persist business/task/activity
state. Existing guards remain enforced; extend narrowly where required.

Read-only/unknown cannot self-upgrade through CompanyUser generic CRUD,
company settings, invitation acceptance, agent functions or bulk routes.
W03 must route/deny those bypass surfaces; do not limit enforcement to the
new membership endpoint.

## 2. Configurable scope: explicit and fail closed

Proposed **Owner-only** grant requests, scoped to one company/target membership:

```json
{"contract":"w03.membership.v1","grant":{"type":"manager_drafts","document_kinds":["invoice"],"operations":["create","update"],"party_ids":["11111111-1111-4111-8111-111111111111"]},"reason":"Reviewed pilot responsibility"}
```

Exact grant union:
- `manager_drafts`: `document_kinds` nonempty unique subset of `invoice,bill`;
  `operations` nonempty unique subset of `create,update,delete`;
  `party_ids` 1–100 unique UUIDs, active company-owned Customers/Suppliers of
  the selected kinds. Capability AND kind AND current party must all match.
  Update checks **both old and proposed party**; scope changes cannot escape
  by relinking. Grant removal makes subsequent writes fail.
- `admin_membership`: `assignable_roles` nonempty unique subset of
  `accountant,manager,read_only`; operations fixed to add/invite/role-change/
  deactivate/remove non-Owners. Admin may act only when both current target
  role (if existing) and proposed role are in that explicit allowlist.
  Cannot manage an Owner/Admin, self, grants, or assign `owner`/`admin`.

No wildcard, role inheritance, default-all, client-supplied grant authority,
expired/revoked grant or fallback to broad non-Read-only rules.
Grant identity/revision/issuer/effective state must be durably auditable.
**Current schema has role/is_active but no reviewed grant/version storage.**
This is a contract/storage decision blocker, not permission to add columns
now. An initial explicitly approved deny-configurable-writes release is
possible; it must not be advertised as configured Manager/Admin support.

## 3. Proposed membership wire contract

Company and target user are path authority, not mass-assignment fields.
Authenticate every request and recheck actor/target/grants inside transaction.
Paths below are proposed extensions to the existing company routes:

| Method/path suffix under `/api/companies/:companyId` | Exact body | Result |
| --- | --- | --- |
| POST `/members` | `{"contract":"w03.membership.v1","user_id":"<existing identity>","role":"accountant","reason":"..."}` | 201 server member view |
| POST `/invite` | `{"contract":"w03.membership.v1","email":"<validated address>","role":"manager","reason":"..."}` | 201 created member or 202 pending invite only if a separately approved invite store exists; initial existing-account flow returns 201/404 |
| PUT `/members/:userId` | `{"contract":"w03.membership.v1","role":"read_only","reason":"..."}` | 200 updated member |
| POST `/members/:userId/deactivate` | `{"contract":"w03.membership.v1","reason":"..."}` | 200 inactive member |
| DELETE `/members/:userId` | no body; `X-Change-Reason` required | 200 `{"data":{"removed":true},"request_id":"..."}`; evidence retained |
| PUT `/members/:userId/grant` | exact grant union above + contract/reason | 200 server grant view; Owner only |
| DELETE `/members/:userId/grant` | no body; `X-Change-Reason` required | 200 revoked grant view; Owner only |

For role/deactivate/remove/grant mutations require `If-Match` exact opaque
target membership revision; missing 428, stale 409. Add/invite duplicate 409,
not silent role overwrite/upsert. Grant PUT replaces only the one named union
type, not other capabilities; DELETE requires `?type=manager_drafts` or
`?type=admin_membership`, rejects extra query keys. New membership role is
mandatory, **no `member`/`staff` or schema `owner` default**.
Identity provider lookups resolve identity only, never assign authorization.
Invite is not an email-delivery feature; no provider write occurs in preparation.

Success view: `{"data":{"user_id":"...","role":"accountant","is_active":true,"revision":"opaque","grants":[]},"request_id":"server-generated"}`.
Exclude other identity-provider profile data. Reasons 1–500 characters,
trimmed server-side; email validated/normalized as identifier only, never
logged in public errors. Unknown keys rejected at every nested level.
Existing identity length limit proposed 255 UTF-8 bytes. Same safe error
envelope/status scheme as the financial contract; additionally
`LAST_ACTIVE_OWNER` 409, `ROLE_INVALID` 422, `GRANT_FORBIDDEN` 403,
`MEMBER_CONFLICT` 409. Audit includes before/after role/active/grant state,
server actor/company, target, reason and correlation ID atomically.

## 4. Last active Owner and legacy transition

Proposed invariant: every active company has **at least one active Owner**.
Only an active Owner can appoint another Owner. Do not demote/deactivate/
remove the last active Owner, even on self-leave. Appoint replacement first,
then use a separately authorized mutation with fresh target revision.
Company creation atomically creates its first Owner. Company deletion,
identity-user deletion/deactivation/webhooks, generic CompanyUser writes and
grant changes must obey the same invariant; a UI checkbox is insufficient.
Identity-provider revocation can invalidate authentication independently:
do not claim company locks make external identity changes atomic.
If no usable Owner remains, **hold writes and use a separately reviewed
recovery procedure**, never elevate the next login/Admin automatically.

Lock company first, then all relevant memberships/grants in deterministic
order. Count active Owners under that lock; serialize all membership,
company-deactivation and financial authority mutations using the same
protocol. Two concurrent demotions/removals cannot both observe two Owners
and leave zero. Existing inconsistent duplicates require explicit conflict/
recovery; do not count duplicate rows as two Owners or fabricate cleanup.

Transition proposal (no data writes now):
1. Inventory distinct role spellings, null/empty, inactive and duplicate states
   **under separately approved data access**, not inferred from source.
2. Exact existing `owner/admin/accountant/manager/read_only` may be candidates
   for reviewed mapping, not proof of historically authorized grants.
3. `member`, `staff`, case variants, null, unknown and ambiguous duplicates
   deny financial/AI writes pending Owner-reviewed mapping. Inactive always
   denies. Do not trim/lowercase an unknown role into an authorization grant.
4. Show an Owner-visible access-review exception, retain original values/
   historical audit, proposed destination, evidence and approving actor.
5. Apply only a separately authorized bounded mapping/cohort with rollback
   plan; no startup migration or bulk aliasing. Last-owner/recovery checks
   apply before and after any mapping. Review client lockout impact.

The existing generic role blocklist and schema defaults are not the target
policy. This document proposes a conservative transition; it does not claim
an inventory was queried or any user was remapped.
