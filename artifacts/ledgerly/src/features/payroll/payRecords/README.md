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
