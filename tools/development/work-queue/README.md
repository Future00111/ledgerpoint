# LedgerPoint dynamic work queue

This is the operating procedure for the owner's existing 18-priority checklist,
not a new product assessment. `docs/development/work-backlog.json` preserves all
92 source bullets. Narrow completed slices are separate evidence; they do not
mark the broader commercial work complete. Accounting, tax and payroll engines
remain in-house. No scope reduction, engine purchase or production authority is
implied by a queue entry.

## Run and resume

One coordinator dispatches up to six interchangeable workers in the current
seven-slot Work host. Six is a starting ceiling, not a permanent staffing map or
a proved optimum. Only dispatch the number of independent, approved claims and
resources actually available. A worker may move between any product areas.

Before a new session, read `docs/development/work-coordinator.json` from branch
`codex/ledgerly-work-queue-state` in `Future00111/ledgerpoint`. It is the durable
checkpoint authority. Its `codeHead` identifies the source revision; its queue
state supersedes an older source-branch seed. Do not use an ephemeral filesystem
path from a previous session as the source of truth.

Acquire the single coordinator lease using `coordinator.mjs`, then commit the
new state on the state branch with **expected previous head SHA**, fast-forward
only. Re-read and verify the lease token before launching workers or publishing
code. A failed compare-and-swap means stop and inspect; never force-push or
blindly retry. Renew/checkpoint while active. An expired lease requires evidence
that the previous run and all its workers stopped, plus their durable checkpoints;
expiry alone is never permission to take over.

Restore the committed queue state into the fresh checkout's
`docs/development/work-state.json`, then initialize the local store. The CLI
shares one state under the Git common directory across isolated worktrees.
Set `LEDGERLY_QUEUE_COORDINATOR` to the session coordinator identity. Optional
`LEDGERLY_QUEUE_ACTOR` pins a worker's command identity. These are orchestration
checks, not a security boundary against someone who can rewrite the repository.

```sh
node tools/development/work-queue/cli.mjs status </dev/null
node tools/development/work-queue/cli.mjs init < coordinator-command.json
node tools/development/work-queue/cli.mjs claim < worker-command.json
```

An init command has `{"actor":"coordinator"}`. A claim has
`{"actor":"worker-1","leaseMs":900000}`. Claim chooses the highest-priority
eligible task and generates its lease token; callers cannot choose a lower
priority task ID. `help` documents commands. Send command JSON through stdin,
not shell interpolation. Tokens and runtime state contain no service secrets.

## Worker and integration loop

1. Claim; read the returned task's acceptance criteria and file leases. Inspect
   current implementation first so remaining broad packages do not duplicate work.
   Create one isolated Git worktree from the coordinator's current integrated
   source. Never let worktrees share a database, port, job queue or credentials.
2. Record a checkpoint before editing and renew the lease while active. Stay
   inside leased files. Shared financial logic, schema, API and router changes
   require a coordinator-reviewed contract and a narrow explicit file lease.
3. On a blocker, checkpoint the branch/commit durably, record the exact task,
   environment or decision blocker, release through `block`, and immediately
   claim another eligible task. Stop the old operation before releasing ownership.
   Task blockers resolve automatically after prerequisite acceptance; unrelated
   environment/decision blockers require an explicit coordinator resolution.
4. Submit a small commit with exact passing test commands and the acceptance
   evidence. Submission retains the file lease through review. The worker can
   immediately claim another independent task; a different worker or coordinator
   reviews the submitted diff. No work is counted done from a worker's assertion.
5. The coordinator integrates serially, runs relevant regressions on the combined
   tree, and accepts only independently reviewed, matching-commit evidence. Reopen
   invalidates affected dependents. Quarantined work retains its files until the
   old worker is confirmed stopped and recovery is reviewed.
6. Refill free worker slots after completion, block, acceptance, reopening or
   reprioritization. If no claim is available, report concrete blockers. Request
   only genuinely missing owner decisions or permissions; do not invent work.

The queue prevents overlapping exact paths and directory-prefix leases. It also
pins the catalogue identity so worktrees cannot reinterpret an active lease.
Changing task definitions requires all affected workers stopped, reviewed state
migration preserving evidence, and one atomic durable checkpoint. Never delete
runtime state to make a mismatch disappear. A dead same-host storage lock can be
recovered explicitly; time alone does not prove a process is dead.

## Verification and publication

Run `node tools/development/check.mjs` for source and scheduler regression and
`pnpm run build` for full typecheck/build. Financial changes also require
`node tools/accounting-flow/test.mjs` in its fresh disposable PostgreSQL runner.
Where this host cannot run non-root PostgreSQL, the existing PR development
workflow supplies that isolated test/restore evidence. Preserve source links,
historical accounting evidence and all original financial invariants.

Publish only to the existing draft development PR with an expected-head check.
Check CI for that new revision. Keep required owner review, production migration,
real filing/sends, connections, pilot admission and release gates. The scheduler
does not make these actions authorized. Do not merge, deploy or touch production.

Export the queue with its expected revision, publish worker checkpoints, then
save the queue and integrated source head to the state branch. Release the
coordinator lease only after all workers stop and all checkpoints are durable.
If interrupted, the next run must recover explicitly rather than reuse stale
claims. Keep the event history. When every approved task is verified complete,
disable the recurring continuation; if only external gates remain, surface them.

## Unattended execution boundary

The CLI is a tested scheduler and durable state store. It does **not** launch an
LLM. During a Work run, the coordinating assistant invokes concurrent agents and
repeats the claim/review loop. A hosted hourly continuation can restore this
repository checkpoint and execute another bounded run using the tools it actually
has. Hosted runs do not retain local folders/worktrees. Never claim an unavailable
coding tool or failed connection is an active worker.

For continuously running workers between hosted runs, use an always-on runner
with authenticated Codex CLI/SDK and the same queue/CAS protocol. That runner and
credentials are not installed by this change. Eight concurrent workers also
exceed this Work session's seven total slots and require another execution host.

## Completion-focused coordination (owner approved 31 October 2026)

Keep all six interchangeable workers productive whenever safe approved work is
available. Review, acceptance testing and prerequisite resolution count as work;
there is no fixed developer/reviewer split. Claims still select the original
highest-priority eligible task. Do not use focus targets to skip dependencies or
higher-priority independent work.

Select at most two primary end-to-end targets, continuing them across runs until
accepted or concretely blocked. Initially these are excess-credit/conditional
discounts and connected persistence/migration. Inspect existing implementation
first: repeat tests for qualification when needed, but do not rebuild completed
allocation/refund behavior or substitute polish for unfinished acceptance.
Resolve internal interfaces, period-close rules and file ownership first.
A stopped task's reviewed environment/decision blocker can be cleared using
`resolve` with `resolvedBlockers` indices and a concrete `reason`. This preserves
partial evidence and discovered dependencies, unlike reopening accepted work.
It cannot clear task dependencies, active leases, unknown rules or owner gates.
Catalogue ownership changes still require reviewed, durable migration.

Split a broad bullet only when useful: children retain original priority and
explicit parent linkage, dependencies, acceptance scenario, exact files and
review requirements. A child's completion never accepts its parent. Retain all
92 original bullets, priorities and acceptance criteria. Every partial submission
records remaining work, the next executable task and exact parent-closing evidence.
Review continuously; submitted files remain leased and authors cannot self-approve.
Free workers immediately take eligible independent review, testing or implementation.

Every five minutes record observed worker activity, progress, blocker and next
action; leases alone are not activity evidence. Save a compact run handoff with
original bullets accepted, journeys verified, internal blockers resolved/remaining
(age and next action), measured review wait, regressions, utilisation/idle reasons,
next tasks and exact-commit checks. Mark unmeasured values unknown. Compare after
three runs and adapt assignments without reducing capacity, scope or quality.
