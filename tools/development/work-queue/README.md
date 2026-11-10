# LedgerPoint dynamic work queue

This is the operating procedure for the owner's existing 18-priority checklist,
not a new product assessment. `docs/development/work-backlog.json` preserves all
92 source bullets. Narrow completed slices are separate evidence; they do not
mark the broader commercial work complete. Accounting, tax and payroll engines
remain in-house. No scope reduction, engine purchase or production authority is
implied by a queue entry.

## Run and resume

One coordinator normally dispatches at most two implementers and one independent
reviewer. Expand to six workers only for named ready independent tasks with a
documented expected benefit and sufficient verification/publication capacity.
Use the smallest useful team; workers remain interchangeable across product areas.

Before a new session, read `docs/development/work-coordinator.json` from branch
`codex/ledgerly-work-queue-state` in `Future00111/ledgerpoint`. It is the durable
checkpoint authority. Its `codeHead` identifies the source revision; its queue
state supersedes an older source-branch seed. Do not use an ephemeral filesystem
path from a previous session as the source of truth.

Acquire the single coordinator lease using `coordinator.mjs`, then commit the
new state on the state branch with **expected previous head SHA**, fast-forward
only. Re-read and verify the lease token before launching workers or publishing
code. A failed compare-and-swap means stop and inspect; never force-push or
blindly retry. Renew/checkpoint while active. Version 2 stores `tokenSha256`
in both active leases and retired owners; raw command tokens stay local. Before
publication compare the live run ID and SHA-256 of the locally held token, then
use expected-head fast-forward. A persisted digest is not an accepted command
token. Acquisition still rejects previous token/run reuse; every owned transition
still requires the matching local token. Version-1 plaintext records normalize on
transition; mixed/malformed records and version-2 plaintext fail closed. Older
readers reject version 2 rather than acquire competing ownership.

The first v2 acquisition is an independently reviewed idle-state migration. Its
state-branch `protocolMigration` record identifies the exact source, module hash,
non-executable patch and review evidence used before source publication. If a
run stops before that source publishes, inspect and verify those exact bootstrap
artifacts before loading the patched coordinator; do not run the old reader on
v2, delete state or invent an owner. Losing the local token requires normal
stopped-worker recovery evidence after expiry, not use of the public digest.
An expired lease requires evidence
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
not shell interpolation. Raw worker command tokens are returned only by the local claim call. Version-3 runtime states and exports contain only SHA-256 token verifiers, including historical claim events. A persisted verifier is never a valid command token. Local filesystem lock tokens remain local and are not exported.

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
6. Reassess useful capacity after completion, block, acceptance, reopening or
   reprioritization; do not fill slots automatically. Report concrete blockers. Request
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

### Reproducible validation and publication preflight

A worker's author branch is provenance, not the publication destination. Use
`publication.mjs` before every source-publication attempt to construct the explicit existing integration-ref update from
fresh GitHub observations. It accepts only `Future00111/ledgerpoint`, open draft
PR 27, head `codex/whole-product-first-sprint`, and base
`dev/w03-draft-invoice-slice`. It validates the full coordinator state through
the existing fencing module, the observed head, reviewed candidate commit/tree,
and the candidate's single actual parent. An equivalent author tree does not
make an author commit's different parent a valid publication parent.

The helper is read-only. It neither publishes nor grants approval, and cannot
change the platform's approval classification. A previous automatic rejection
remains a blocker until explicitly resolved; do not retry through another token,
tool, branch, transport or workflow. State archival remains a separate operation.

1. Read the current state-branch authority, then acquire/checkpoint the single
   coordinator lease before edits. A fresh supported checkout is
   `git clone https://github.com/Future00111/ledgerpoint.git ledgerpoint`.
   Detach at the authority's `codeHead`; verify the actual tree and clean status.
   Do not reuse scratch paths or assume a gateway credential exists.
2. Recover an existing candidate from its immutable state-branch archive.
   Verify the manifest's patch byte length and SHA-256, apply to its exact
   `basePublished` in a separate detached worktree with `git apply --index`,
   and require `git write-tree` to equal the recorded tree. Verify the raw
   commit's byte length/hash and `git hash-object -t commit --stdin` against
   the recorded commit before restoring it. Author and integrator identities
   may differ while their verified trees match. Do not recreate financial work.
3. Use Node 24 and CI's pinned pnpm **10.26.1**, then
   `pnpm install --frozen-lockfile`. Check `pnpm --version` first: an ambient
   newer pnpm can rewrite workspace configuration even when installation fails.
   Revert any installation-only configuration changes before checking source;
   use the pinned version instead of approving new scripts or changing the lock.
4. Run `node tools/development/check.mjs`,
   `node --test tools/development/migrations/registry.test.mjs`, and
   `PORT=8080 BASE_PATH=/ pnpm run build` on the candidate to be reviewed.
   Capture command status and complete logs against commit/tree identities.
   `check.mjs` discovers the publication regression tests automatically.
5. Before attempting local PostgreSQL, verify `id -u` and availability of
   `initdb`, `postgres`, `pg_isready`, `pg_dump`, `pg_restore` and `psql`.
   Use only the existing fresh disposable accounting/recovery runners on a
   supported non-root runtime. A root-only host without PostgreSQL, or a denied
   `runuser -u nobody -- id`, is an environment blocker, not a skipped passing
   check. Do not bypass host restrictions or connect an existing database.
   Where unavailable, the existing PR development workflow supplies these
   gates after authorized publication; no new runner or dispatch is implied.
6. After independent review, read the authority, destination ref, PR 27 and
   actual remote candidate commit again. Supply observations no older than
   60 seconds. Each has `repository` and local `observedAt` milliseconds;
   `authority` has `sha` (state-branch commit) and `value` (state JSON),
   `pullRequest.value` is the GitHub PR response, `candidate.value` is the Git
   commit response, and `destination` has `ref` and `sha`. Keep the separately
   reviewed intent fixed: `expectedHead`, `expectedBaseSha`, `candidateSha`,
   `candidateTree`, `authorCommit`, `authorBranch`, `authorActor`,
   `reviewed: true`, and an independent `reviewer` distinct from `authorActor`.
   The local `owner` contains the current `runId` and raw fencing `token`.
   Invoke `preflightPublication(input)`; persist only its result, never the
   input/token. It emits `destination_kind: integration`, distinct author
   provenance, and the exact `updateRef` arguments with `force: false`.
   These are trusted read-only observations supplied by the coordinator; the
   helper does not fetch GitHub or prove the review/CI itself. Run it from the
   repository root, keeping the raw owner file outside the repository:

   ```sh
   node --input-type=module - <<'NODE'
   import { readFileSync } from 'node:fs';
   import { preflightPublication } from './tools/development/work-queue/publication.mjs';
   const input = JSON.parse(readFileSync('../fresh-publication-observations.json', 'utf8'));
   const owner = JSON.parse(readFileSync('../local-owner.json', 'utf8'));
   try {
     console.log(JSON.stringify(preflightPublication({ ...input, owner }), null, 2));
   } catch (error) {
     console.error(error.code || 'PREFLIGHT_FAILED');
     process.exitCode = 1;
   }
   NODE
   ```
7. A preflight result is a short-lived review aid, not a remote lock or
   permission. Immediately before an authorized update, repeat the reads and
   preflight; call the existing GitHub `update_ref` with those exact arguments.
   Stop on rejection or expected-head conflict. Do not blindly retry.
8. Fetch the resulting PR workflow's actual checkout and verify tree equality
   with the published candidate. Require successful source/build/typecheck,
   native disposable PostgreSQL, populated restore, encrypted recovery,
   current-run/source receipt matching and cleanup; inspect failures and skips.
   Archive exact identities, full logs and receipts. Earlier green CI on a
   different source does not qualify this candidate. Parent workflow acceptance
   and browser journeys remain separate existing requirements.

The preserved 4 November candidate is archived at
`f99c7a616e079903fa7d4641c15eac6959853f8a`, under
`docs/development/candidates/20261104-2121-*`: author
`381ab815678ad20d9271a21729d2674ce9ae867d`, tree
`bd95f5578824de7e0b13015af4dfd0273cb4c384`, published base
`de140ea97eed9cccb01a6dccc2edc79638da6c91`. The unreferenced remote candidate
`2ce3b050135b0852f60474190c11e4c00c63263e` must still be fetched and its actual
tree/parent verified before preparing its update. Its blocked publication and
unrun native PostgreSQL/restore gates are not resolved by a successful preflight.

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

## Credit-efficient coordination (owner approved 3 November 2026)

Focus the primary track on one priority customer workflow, continuing until accepted
or concretely blocked. A second track may advance the next highest-priority eligible
independent launch dependency; original claim ordering and dependencies still govern. First recover and independently review existing payment
recovery, populated restore and permission-race candidates before replacement
work. Claims still select the original highest-priority eligible task; focus
never skips dependencies or changes priorities. Inspect existing implementation
and resolve internal contracts and exact file ownership before dispatch.

Use compact briefs with exact source, owned paths, acceptance and known blockers.
Run focused checks for each change, then one combined full source/build/typecheck
and exact PR27 disposable PostgreSQL/restore CI after integration. Reuse prior
reviews only when they cover the exact unchanged source; financial/security
changes retain independent review. Authors cannot self-approve.

A stopped task's reviewed environment/decision blocker can be cleared using
`resolve` with blocker indices, a concrete reason and fresh expectedRevision.
Do not clear task dependencies, active leases, unknown rules or owner gates.
Catalogue ownership changes require stopped affected workers, independently
reviewed migration and durable preservation of events and partial evidence.

Retain all 92 original source bullets, priorities, acceptance criteria and full
in-house accounting, tax and payroll scope. Children retain parent linkage and
never accept the parent. Every partial submission records remaining work, next
executable step and the exact evidence needed to close its parent.

At least every five minutes persist observed activity, blockers and next actions.
Reserve time and capacity for review, durable publication and clean shutdown;
there is no requirement to fill all six slots or consume the whole run window.
Do not begin work that cannot be checkpointed. Record actual start/end timestamps,
accepted source bullets, verified journeys, resolved/remaining blockers, review
wait and rework. Record credits per accepted workflow only if measured; unknown
measurements remain unknown. Compare three runs and adjust concurrency using
observed completion and cost without reducing scope or quality. This policy does
not imply continuous execution between hosted hourly resumptions.

## Replit implementation slot

Use [the hybrid execution protocol](../../../docs/development/replit-worker-protocol.md)
for Replit assignment, bounded activity, immutable handoff, independent review and
shutdown. Plan one Replit implementer and one Codex implementer together, plus
an independent reviewer and one coordinator, when named ready nonoverlapping
work makes both useful. Keep at most two implementers by default and the existing
capacity ceiling. Both providers may implement; neither self-approves. Prefer the
same priority journey when ownership/eligibility allow it, otherwise claim the
next eligible independent task, do authorized review/prerequisite work or idle.
Preserve automatic highest-eligible selection; do not manufacture occupancy. If
Replit is unavailable, Codex may continue safe eligible work through the same queue.
The [prepared P01-03 packet](../../../docs/development/replit-first-assignment.json)
holds no claim and must be refreshed from current durable state before dispatch.
This procedure is not a new always-on provider integration.

## Worker-token protocol version 3

Version 3 persists only `tokenSha256` in held task leases and claim events.
Claim returns its fresh raw token once to the local caller; keep it local and
supply it for renew/checkpoint/block/submit. Those commands hash the supplied
value before fencing. Reuse checks compare digests across historical claims.
A lost token requires normal stopped-worker recovery; its digest cannot replace it.
Older version-2 readers reject version 3 rather than acquiring competing leases.

Migration is explicit coordinator work, never a side effect of `init`, `status`
or a worker command. With every worker stopped and no held tasks, archive the
unchanged version-2 state, independently review the migration, then call
`migrateV2State(catalog, state, { source: { ref, sha, path } })` from `core.mjs`.
The immutable source reference and `sourceStateSha256` record provenance. That
hash covers `JSON.stringify(input)`; it is not a claim about original archive
file bytes. Migration preserves revision, event count/order, task metadata,
priorities, dependencies and evidence; only claim token representations and the
explicit state version/provenance change. Mixed, malformed or unknown versions
fail closed. Do not delete an existing runtime or silently rewrite its history.

Migrate the source seed separately from the newer durable queue. Restore the
current durable queue before runtime initialization, never an older source seed.
When the coordinator checkpoint uses an external queue reference, fetch that
exact archived JSON first. Persist reviewed protocol code and migrated authority
before dispatching any worker; preserve the old archive as provenance.

## Completion-driven launch delivery (4 November 2026)

Use the existing catalogue and highest-eligible CLI selection. The milestone map
in `docs/development/product-completion-plan.md` is a delivery view, not a new
scheduler or a priority override. Default to two useful implementation tracks plus
independent review and the coordinator; leave capacity idle when overlap or
dependencies prevent safe work. Expand only for named ready independent tasks.

Before dispatch, coordinator resolves internal contracts and file ownership.
For multi-run work, preserve one candidate chain with explicit next steps rather
than restart discovery. A child must name its original parent, acceptance scenario,
dependencies, exact files and independent review/tests; it cannot close the parent.
Preserve completed prerequisites when reopening or splitting work. Never bypass
real dependencies to move a lower-priority engine task ahead of the ready queue.

Each handoff records accepted journeys, launch-blocking dependencies, actual
observed activity, review/rework, next task and matching-source evidence. Compare
three runs using outcomes and measured credits, not occupied slots. Unknowns stay
unknown. An isolated browser journey is required where the milestone needs it;
source checks alone do not establish launch readiness. This scheduling policy is
instructions, not a claim of new automated enforcement.

A checkpoint may reference an immutable `exact-queue-delta-v1` artifact. Rebuild
the exact archived base, verify its digest, apply only task replacements and ordered
appended events, set the recorded revision, verify the resulting digest and validate
with the current queue module before init. Never initialise the stale base alone.
Normal coordinator recovery requires stopped evidence and preserves lastOwner's
SHA-256 reuse fence; do not remove fencing fields to resolve publication failures.


### Owner-approved simplification and merged PR successor - 10 November 2026

One implementer plus root for coordination/integration is the default. Obtain a
separate financial/security review, without a standing extra team. Replit must
still meet isolation, observation and stop/export controls; unavailable Replit
never stalls eligible local implementation. This is staffing policy, not a new
scheduler enforcement claim.

After the owner explicitly merges the pinned integration PR, record its number,
merge commit and owner approval as `publicationSuccessor` on the durable authority.
The reviewed preflight may bootstrap exactly one FF candidate on the unchanged
approved head branch only when the closed merged PR and current base match that
merge commit. Immediately create a successor draft PR against the same base,
persist its number as `integrationPullRequest`, and remove `publicationSuccessor`.
All subsequent updates require that numbered open draft. No branch change,
force-push, merge, deployment or parent acceptance is authorized by this transition.
