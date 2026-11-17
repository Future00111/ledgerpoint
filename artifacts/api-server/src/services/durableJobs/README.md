# Durable intake queue

Explicit native intake API requests persist queued identities and cancellation
history with a lifecycle outbox in one transaction. Recovery verifies current
company membership, original unconverted bytes, source revision, reconstructed
contract identity, contiguous supported events and matching outbox records.
Only queued and cancelled states with zero attempts can be reconstructed.

No worker consumes this outbox. OCR and email remain `not_connected`; uploads do
not enqueue automatically. There is no provider dispatch, execution claim,
scheduler, attempt lease, retry, result acceptance or financial effect. Those
remain required for full P03-02 acceptance, including physical transport closure
and validated in-flight/result reconstruction. A lifecycle notification is not
an execution attempt or delivery receipt.

The additive migration is installed only by the fresh disposable test installer.
Runtime checks history, columns, tenant keys, guards, ownership and grants before
queue access and never repairs/applies DDL. An unavailable queue does not disable
existing source upload/read/review. Original intake evidence and audits remain.
