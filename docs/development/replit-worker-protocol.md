# Replit execution through the LedgerPoint coordinator

Prepared 3 November 2026. This is an operating plan, not a Replit integration or
an active implementation assignment. The queue, catalogue, financial contract,
92 source bullets and acceptance criteria remain unchanged. Existing tools enforce
queue ownership and fencing; provider dispatch, observation, export and shutdown
in this document are coordinator responsibilities, not new automated code.

## Capacity and authority

Prefer Replit for the first implementation slot, replacing one Codex implementer.
Default to one Replit implementer, one independent Codex reviewer and the existing
coordinator. Add a second implementer only for named, ready, nonoverlapping work
with a measured expected benefit and enough review/publication capacity. The
existing six-worker ceiling is unchanged. Providers are interchangeable: assign
from the same highest-priority eligible queue, never a permanent product area.

The only authoritative coordinator record is `docs/development/work-coordinator.json`
on `codex/ledgerly-work-queue-state` in `Future00111/ledgerpoint`. The coordinator
alone runs the existing queue CLI and writes durable state. A separate Replit Git
clone has a separate Git-common-directory store: do not initialise or mutate a
second queue there. The Replit actor reports observations to its coordinator.
Never put a coordinator token, task token, service credentials or database URL in
a Replit prompt. Queue actor labels are orchestration identities, not credentials.

## Preflight and dispatch

1. Read the current durable record, restore its exact source and queue, acquire
   and persist a fresh coordinator lease with expected-head fast-forward, then
   re-read its live fence. On automatic approval rejection or compare-and-swap
   failure, stop that action; do not use another route to bypass it. Establish any
   missing authorization before retrying. Expiry alone never grants ownership.
2. Verify the actual Replit connection or authorized browser session, exact app,
   ability to send a bounded brief, observe acknowledgements/activity, stop work
   and retrieve an immutable result. Record the verified export method. A visible
   app or completed demo startup alone does not establish these capabilities.
   If control, safe export or confirmed stop is unavailable, do not dispatch;
   record the exact blocker. Hosted runs may have different tools.
3. The coordinator invokes `cli.mjs claim` for the remote actor, supplying the
   fresh expected queue revision and bounded lease. It must let the queue choose
   the highest eligible task. Export that reservation and persist it with
   provider, actor, task, exact source SHA, isolated branch/workspace, file lease,
   acceptance, run deadline and next checkpoint. Re-read the live coordinator
   fence and durable reservation before sending the brief. Do not reserve work
   merely to prepare a plan.
4. The author must acknowledge the source SHA, owned paths, contract, deadline,
   isolated workspace and stopped/demo boundaries before editing. If the expected
   task is no longer highest eligible, refresh the packet for the selected task;
   do not force P01-03 or filter the queue to favour a provider.

Use a fresh isolated work branch and disposable synthetic resources. Never edit
or restart the running demo at `.local/share/ledgerly/review-126d25b`, reuse its
original database, change its startup pointer, or run schema push against it.
Read-only reference to the demo does not authorize modifying it. Do not change
provider connections, permissions, subscriptions or deployment configuration.

## Bounded work and durable handoff

The coordinator owns a run of at most 30 minutes and reserves time for stopping,
review and checkpoints. A connected slice may span several bounded runs; stop at
a recorded local commit without enabling admission until all slice gates pass.
Do not promise that the entire P01-03 slice fits one run. Ask for a checkpoint at least every five minutes and
persist observed activity, actual source/commit, files, tests, blockers and next
action. Absence of an observation is unknown, never proof of liveness. Renewal
must be based on observed activity and stay within the coordinated run; a shorter local target is welcome. Stop
before the deadline; do not leave Replit executing after releasing its claim.

The first supported result format is a local Git commit plus a plain UTF-8 patch
and manifest, returned through a verified allowed export/download route. Before
dispatch, prove that the available Replit surface can return those bytes; do not
promise an unverified connector endpoint. The author produces:

- base commit, branch, author commit, resulting tree SHA and exact changed paths;
- `git diff --binary BASE..AUTHOR` saved as a patch, with SHA-256 of exact bytes;
- tests with commands, results and source identity; remaining acceptance and the
  next executable step; actual start/end and confirmed stopped/clean state;
- measured provider time/cost only if available, otherwise `unknown`.

The coordinator downloads/exports without executing supplied code, verifies the
manifest against the patch and leased paths, and archives the original patch,
manifest and test logs as non-executable evidence on the state branch. Treat the
patch as untrusted data. Reject secrets or unexplained files before publication.
Reconstruct on a fresh checkout at the exact base; compare its tree with the
manifest before tests. An exported commit is local author evidence, not proof it
exists on the remote. If only an archive is available, verify its extracted tree
and reconstruct the patch with the same base/author/tree evidence. If provenance
or exact bytes cannot be verified, keep the task blocked and do not integrate.

Workers never push an unreviewed branch to the shared source or bypass a denied
worker push through another tool. The coordinator does not publish executable
worker content as a way around an approval denial. Submission is `review-ready`,
not accepted, and the file lease remains held through independent review.

For a blocker or run end: request stop, obtain explicit stopped confirmation,
archive the last checkpoint, then use the existing `block`/submission/recovery
transitions as appropriate and persist the queue. Do not release or reassign
while the old worker may still edit. If shutdown is unconfirmed, retain/quarantine
ownership, record the blocker and stop dispatching replacements. Never steal an
expired claim. A prepared packet has no claim and no running worker.

## Review and publication

A Codex reviewer who did not author the change checks the actual diff, shared
financial interfaces, tests and original acceptance. The coordinator resolves
findings, integrates serially and runs one combined `node tools/development/check.mjs`
and full `pnpm run build` on the integrated tree. Publish only the reviewed
candidate to the existing draft PR27, checking the live coordinator fence and
expected source head with fast-forward only. Independently fetch and inspect
that exact revision's existing development CI: full source/build, disposable
PostgreSQL, populated/encrypted restore and cleanup must pass. Match CI merge-tree
evidence to the published source. Failed or unavailable checks stay pending.

Preserve owner review, live browser qualification, migration, release and production
gates. No merge, deployment, live activation, external send or production mutation
follows from this plan. Original parent acceptance is never inferred from a narrow
slice. Publish durable exact-source evidence, verify every worker stopped, then
checkpoint and release through `coordinator.mjs`.

## First prepared assignment and three-run evaluation

See [the prepared P01-03 packet](replit-first-assignment.json). It records an exact
source and owned file list but holds no lease. Revalidate it at dispatch. The
connected first slice follows the existing [credit capacity contract](credit-capacity-contract.md),
including trusted evidence chronology and reversal guards; it does not duplicate
already implemented excess-pool allocation/refund services.

Evaluate at most three actual hybrid implementation runs. Count this setup as zero
implementation runs. For each, record accepted original bullets, verified connected
journeys, blocked time, reviewer wait, rework, actual start/end, provider usage/cost
and credits per accepted workflow when measured. Unknown values remain unknown.
Compare completion first, then observed cost/time against available prior evidence;
do not invent savings. Continue, reduce or stop provider dispatch based on those
observations without changing scope or lowering review/testing gates. This plan
makes no always-on or automatic cross-provider orchestration claim.
