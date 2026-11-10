# Job5 — correction outcome recovery

Local candidate based on531e261b08af2f6f866533b595905b44c5f09a8b.
Parent P03-01; prior candidates remain unreviewed. Shared source6ebee0f and
coordinator268 unchanged; no lease claim or integration authority.

Inspection: native payment recovery already exists. Document intake persists the
source/document linkage and returns the prior document for an identical reviewed
conversion. Do not replace either engine. Correction requests already persist
immutable request identity/hash, actor, document, revision and journal in the same
transaction; identical POST replay and conflict checks already exist.
The identified gap was correction UI page-memory-only recovery after reload.

The normal correction editor now saves only its request UUID in the current
page's recovery query parameter BEFORE sending the reviewed command. Failure to
save that locator prevents sending. No financial payload, token or personal
details are placed in browser storage. Reopening the same URL automatically
checks a new company/document-scoped read-only outcome endpoint.

The endpoint rechecks active membership and accounting.correct, validates the
complete immutable amendment/journal/audit/effect chain, and only returns a known
receipt for the original actor/request/document. Unknown means no visible
committed result, NOT proof of failure: an in-flight transaction could commit
later. The reloaded UI permits repeated read-only checks, not automatic retries,
new edits or a new request. Same-page exact POST replay remains an existing
controller capability but the unknown-outcome UI now calls only GET.

Late responses after scope disposal cannot update the old screen. Known recovery
shows the original journal and revision even after a later correction; it does
not claim that revision is the document's current revision. Closing a confirmed
result removes the URL locator. A reload without that URL cannot discover a lost
request automatically; correction history remains the existing alternative.

No migrations, new financial writer, payment/capture duplication, public
conditional gate changes or demo updates. Unit/controller/render tests cover
reload/unknown/permission-error/mismatched receipt/locator failure/disposal;
real disposable native HTTP tests cover known/unknown/rollback, journal identity,
repeat read with no writes, later revisions, foreign company, reader and revoked
membership. No real Clerk/owner browser acceptance is claimed.
