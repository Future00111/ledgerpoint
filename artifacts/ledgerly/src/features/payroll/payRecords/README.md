# Company pay records

`/payroll/pay-records` uses the native authenticated company pay API. The normal
company selector and server-returned role determine presentation; the server
rechecks current membership for every read and creation. Owners and payroll
preparers can enter a dated annual salary. Payroll readers and approvers have
only explicit record-ID lookup. Other roles have no page controls or navigation.
This is annual pay entry and retrieval, not a payroll calculator or payment run.
Employee UUIDs are explicit because the API has no employee directory.

GBP entry converts decimal pounds into exact integer pence with BigInt. The
client validates dates, record IDs, allowed response fields and exact string
amounts. Reader/approver responses must omit employee references. Errors use
fixed local wording and never display response bodies or request diagnostics.

Each new form receives a random record UUID. The first submission freezes its
canonical body and UUID. Unconfirmed saves allow only identical retry and lookup;
neither changed values nor a new request ID are available. A lookup alone does
not confirm the creation receipt or unlock the attempt. Verified POST success
triggers native readback and permits an explicit new form. Failed readback does
not misreport a confirmed save as failure. A verified conflict keeps the prior
request available for lookup and permits an intentional blank new entry.
Denial clears values and disables creation; users can still make a blank,
independently authorised lookup or refresh membership through the company context.
Missing/foreign record denial never proves a prior creation failed.

The component remounts on actor, company or role changes, clearing inputs,
attempts, results and request IDs. Membership reload also removes the page while
loading. Cleanup aborts pending work; generation guards discard stale responses
even if abort is ignored. Request state stays in the component, outside shared
query caches. No pay data or record locators enter browser storage or URLs.
The displayed record ID must be retained by the user for lookup after leaving or
reloading; this slice has no durable browser recovery or record collection.

`PayRecordsWorkspace` is the exported scoped component used by the normal route
and the coordinator-owned disposable browser journey. Pure contract/client and
render tests are discovered by the existing development checker. The coordinator
owns the connected native browser fixture and PostgreSQL integration acceptance.

## Specialist access history

`/payroll/access-history` is visible only to the current company owner and reads
the existing audited specialist-membership history endpoint. `AccessHistory.jsx`
uses the same auth/company context; `AccessHistoryWorkspace.jsx` exposes the
reusable component without auth imports for the isolated browser journey.
History is loaded only by an explicit **View history** or **Refresh history**
action. Mounting the page, company switching and role/account changes do not
silently issue audited reads.

The table shows operation, before/after role and active status, exact UTC time,
and membership reference. **Not present** identifies absence before addition or
after removal; **Not recorded** preserves a historical null active flag for a
membership that existed. Actor/target user identities, emails, salaries and raw
audit context are never displayed. The client validates the exact response
projection, known roles/operations, meaningful transitions, timestamps, unique
event IDs, newest-first ordering, fixed 50-row limit and more-results flag.
When more history exists, the page states that older changes are not shown; no
pagination, export, target identity lookup or history-write controls are added.

Refresh immediately clears the previous result. Denial, malformed responses and
other failures leave no previous rows visible. Actor/company/role keys and
abort/generation checks prevent late responses repopulating another scope.
No history is persisted in browser storage, URL state or shared query caches.
The server remains authoritative and audits every successful history read,
including empty results, before disclosure. This page does not broaden that
existing endpoint or establish full P02-04 completion.

## Personal tax inputs

`/personal-tax/preparations` uses the native annual employment-income input API.
Owners and personal-tax preparers can create an input and retrieve its taxpayer
reference. Personal-tax submitters have lookup only and never receive that
reference in the validated response or display. Payroll and ordinary bookkeeping
roles see neither controls nor a navigation link. This is a draft input workflow,
not taxpayer registration, tax calculation, year qualification or filing.

The form requires an explicit internal taxpayer UUID, the tax-year starting year
and a GBP amount. Decimal pounds are converted exactly with the existing BigInt
money parser. The body sends a bounded integer year and canonical integer pence
string, never a floating-point monetary value. Native results are checked against
the role-specific exact field list, currency, attempted record ID and status.
Unknown response fields, malformed amounts/years and unexpected status fail closed.

Pay and tax entry now share `useSensitiveEntry`: the original frozen intent and
request UUID survive retries, unknown outcomes cannot be edited or replaced,
only a verified native conflict permits a deliberate fresh entry, and a confirmed
save triggers native readback. Denial clears sensitive fields and disables
creation while allowing a blank independently authorised lookup. Missing records
do not prove a prior save failed. Actor/company/role switches remount both
workspaces and invalidate pending requests. No input, result or locator enters
browser storage, URL parameters or shared query caches.

`TaxPreparations.jsx` is the context wrapper; `TaxPreparationsWorkspace.jsx`
exports the same reusable scope boundary used by the coordinator-owned native
browser journey. Existing pay/history tests and routes are retained. There is
still no taxpayer directory, collection, export or submission operation.
