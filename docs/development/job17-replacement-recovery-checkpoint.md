# Job 17 — replacement recovery repair checkpoint

Base d5d4e99500c97e2372ca02420500a8dbc4146fe6.
Executable validation 455afd569a54b17437d904100656bdebec51cf96.
This is a bounded repair, not completion of every financial recovery journey.

## Defect and working change

The normal replacement panel classified an AbortError as a definite failed write.
An aborted response does not establish that the server rolled back. Retrying
after an unknown response could then clear the retained request on a 403/409,
even though the original attempt might have committed. The panel also allowed
“Forget this request” without any conclusive outcome.

AbortError now remains unknown. An existing uncertain request is retained across
a rejected retry; different terms/request identities cannot overwrite it. History
readback confirms the original request without posting a second one. Sending is
blocked if session recovery storage is unavailable or silently fails to persist.
The normal panel preserves the pending state and no longer offers forgetting an
uncertain operation. Definite rejection of a first attempt still clears that
attempt. Permissions, company/document scoping and public posting gates unchanged.

## Checks

15 focused action/model tests passed; 886/886 combined source/UI/scheduler checks,
31/31 migration registry checks and full build/typecheck passed. No failed run
occurred in this checkpoint. Tests cover abort after simulated commit, reload of
stored identity, read-only known recovery, absent outcomes, same-identity retry,
permission revocation, changed-request rejection, company switch, storage failure
and removal of the forget action. These are controller/static-render checks,
not a signed-in browser walkthrough or server-restart acceptance.

No DB or schema changes; no PostgreSQL processes started for this UI-only repair.
Job15's full tracked-source archive was independently compared with its Git tree:
all 1455 paths, blobs and modes match. Exact receipts are in job17-evidence.

## Remaining work, not claimed complete

Existing correction recovery uses persisted request lookup and a URL locator;
existing payment recovery has an immutable page-memory controller. Its complete
reload/restart behavior must be traced through the normal caller before claiming
Job17 complete. Compensation's normal panel remains review-only with posting
disabled; no bypass was introduced to manufacture a browser acceptance result.

Session storage supports reload in that tab, not guaranteed recovery after the
tab/browser storage is discarded. Cross-session locator behavior and isolated
browser journeys remain acceptance work. No real Clerk or independent-human
approval is claimed. No live demo, existing DB, queue/lease, provider, push,
merge, deployment or public activation change.

Continue the remaining Job17 caller/reload checks before Job18 empty-company
acceptance. Job19 requires the existing-fixture executable statutory specification;
Job20's combined disposable/restore/browser acceptance remains pending.
