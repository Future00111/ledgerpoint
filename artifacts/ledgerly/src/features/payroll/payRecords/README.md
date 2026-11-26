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
still no taxpayer directory, collection or submission operation.

After a successful tax input lookup/readback, owners and personal-tax preparers
can explicitly select **Download CSV**. Submitters have no export control. The
client fetches the separate authenticated same-origin export endpoint with no
cache or redirects and validates the media type, fixed attachment name, requested
company/record headers and exact numeric year/pence/GBP CSV against the loaded
immutable input. Only then does it create a Blob and request the fixed
`personal-tax-input.csv` download. Taxpayer references are excluded.

Leaving the result or changing actor/company/role aborts the request and
invalidates its generation before any file can be created; this also handles
transports that ignore cancellation. A denied export clears the previous input
and form. Other failures show fixed wording and create no download. The temporary
link and object URL are released. No export is stored in local storage, shared
query caches or URLs. An already requested browser download cannot be retracted.
The server can commit its audit after client cancellation; neither that receipt
nor the UI's download-request message proves that a file was saved or opened.

## Employee bank lookup

The pay-record workspace has a separate explicit **Look up bank details** action.
It uses an internal employee UUID, including native nil or non-versioned UUIDs,
and the current company. Owners and payroll preparers receive exactly an
eight-digit account number; payroll approvers receive only four final digits.
Payroll readers and other roles have no bank lookup controls. There is no bank
export, mutation, account directory or automatic fetch on mount.

The GET client rejects unexpected fields and role projections, uses credentials
with no cache or redirects, and never exposes server response bodies in errors.
Actor/company/role changes remount the lookup; editing the employee or starting
another lookup immediately clears the previous result. Abort plus generation
checks prevent delayed responses from restoring stale values, including when
the transport ignores cancellation. Denial or a missing record clears the input
and result. Account data stays only in the current component and never enters
browser storage, shared query caches, CSV downloads or page URLs. Each native
successful lookup remains subject to current server authorization and audit.

## Pay record CSV

Owners and payroll preparers can select **Download CSV** after a native pay record
lookup/readback. Readers and approvers can view their permitted fields but have
no export control. The distinct audited endpoint returns exactly the effective
date, annual salary in integer pence and GBP; employee references are excluded.
The client validates the fixed response headers, requested company/record scope,
real Gregorian date and exact amount against the loaded immutable record before
requesting `payroll-pay-record.csv`. Dates remain ISO values and pence are never
converted to floating point.

Pay and tax export buttons now share only the browser download and scoped-button
mechanics. Each keeps its own closed role, route, header and CSV contract. The
shared lifecycle aborts and invalidates requests on result/scope removal before
any file can be created, clears previous data after denial, reports other errors
with fixed wording and releases temporary DOM/object URLs. Both export workflows
retain their contract and cleanup tests. No file contents enter browser storage,
shared query caches or URL state. A server audit can complete after cancellation;
a requested download or receipt does not establish that a file was saved.
