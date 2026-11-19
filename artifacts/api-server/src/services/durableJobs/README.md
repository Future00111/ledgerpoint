# Durable intake jobs

Explicit native intake API requests persist queued identities and cancellation
history with a lifecycle outbox in one transaction. Recovery verifies current
company membership, original unconverted bytes, source revision, reconstructed
contract identity, contiguous supported events and matching outbox records.

The additive execution journal supports internal worker claims, bounded attempts,
lease expiry, cancellation, retry and review-required results. Stored commands
replay through the original extraction validators; snapshots are compared with
that replay. Original provider payloads are retained and independently re-adapted.
The existing native recover/cancel routes expose the reconstructed job without
creating an invoice, posting an entry or accepting extracted financial values.

Physical transport capacity is independent of logical lease expiry. The original
worker may append closure only with its in-process issued lease after its trusted
transport's `closed` promise resolves. A restarted repository cannot release an
old reservation. Actual process-death recovery therefore retains unknown physical
capacity and refuses another claim, even after recording a timeout. A trusted
supervisor closure/recovery protocol remains required; no caller boolean or elapsed
time is treated as proof that external work stopped.

Capacity admission validates full closure histories and matching outbox records.
Damaged proof conservatively holds its starts. A 1,000-job execution-history bound
fails closed and preserves evidence; archival/retention policy is future work.
Current access and source freshness are rechecked at settlement, and the host clock
is sampled after obtaining locks so queued stale workers cannot beat expiry.

No startup process consumes this outbox and no provider is connected. OCR and
email remain `not_connected`; uploads do not enqueue automatically. Scheduler,
fenced outbox delivery, supervisor crash settlement and real provider execution
remain required for full P03-02 acceptance. Cancellation fences results; immediate
cross-process transport abortion is not implemented by this journal.

All migrations are installed only by the fresh disposable test installer. The
execution migration adds separate immutable event/outbox tables; prior migrations
and queue rows are unchanged. Runtime checks history, columns, tenant keys, guards,
ownership and grants before access and never applies or repairs DDL. Missing or
altered execution storage cannot silently make a running job appear queued.
Original source upload/read/review is independent of execution availability.
