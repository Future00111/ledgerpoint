# G6 exact-G development-run preparation — 2026-10-14

**PREPARATION ONLY. G6/G7 PENDING. NO DISPATCH OR RELEASE APPROVED.**

The owner supplied a Codex relay: “ok perfect, can you do the next task”.
The attached instruction expressly limits that request to G6 preparation.
It is not the concrete action-time authorization required by G1, not an
Environment release, and not G7 acceptance. This is AI preparation, not
independent-human approval, CI success or qualification of G.

## Preserved authority and exact identities

G1–G5 approvals, original G4 failure/correction evidence, G5 checker failure/
reconciliation and Codex addenda remain unchanged. Separate local records
branch `records-local/tr01-c7-g6-preparation` starts at planning/records HEAD
`e3e8bd3a6ee0b3e465f0b228c6206e1d72910aef`.

| Identity | Exact value |
| --- | --- |
| G/current main | `706dc6a31f85733ba0c251f40b2c09f5a9312269` |
| G/A tree | `bf7c91fac7fe09d8458a327dd79464ea1a3973ad` |
| G ordered parents | B `0da401737f35d68b9404982baad7405fe997636a`, then A `ead19106aaad76d604e8595337b5ab2fddda68d0` |
| A ordered parents | B, then C7 |
| Frozen implementation C7 | `787d76decfa345e3c1104231e08d5ab00bc90259` |
| C7 tree | `aa0360267a0d1987626ae9650238d66f04f667b9` |
| C7 sole parent | `c795945c4a5d4815804a86b9d5f2bdc77573d38f` |
| Workflow path | `.github/workflows/ledgerly-canonical-postgresql.yml` |
| Workflow ID | `343787048` |
| Workflow bytes SHA-256 | `ad06da35f4269fbbf46e1fd4ccabf6082d309963e39b577e17ac948c546afc20` |
| Historical C7 producer pin, retained | B `0da401737f35d68b9404982baad7405fe997636a` |
| Candidate pin, retained | C7 |
| Authenticated owner | `Future00111`, GitHub user ID `318002590` |

Fresh read-only observation: **2026-10-14T18:24:05.884057–
18:24:21.244368 UTC**. All **49 checks passed**.
Remote immutable objects/trees match local objects; B/A/C7 ancestry to G is
verified. Complete, nontruncated remote G tree equals A. Exactly ten approved
paths differ from B, with all **518 outside-inventory union entries**, modes,
blobs and absences preserved. See retained complete tree and ten-path receipts.

PR26 is merged into G; its recorded base remains reviewed B. The recorded PR
base is not substituted for the current main ref. No synthetic pre-merge
merge SHA is used as G.

## Controls, pagination and credential exclusion

- G4 main mandatory PR/count-zero window remains unchanged; enforced admins,
  stale dismissal and conversation resolution true; no code-owner/last-push
  requirement. Complete native rule pagination and bypass allowance count
  **zero**, no next page. REST field omission alone is not the proof.
- Merge commits true; squash/rebase/auto merge false; repository policy
  settings and collaborator permissions unchanged.
- Frozen C–C7 refs, seven active no-bypass rulesets, effective update/delete/
  force blocks and C2–C7 strict GitHub Actions-source identity statuses unchanged.
- All candidate/producer pins unchanged. **Do not replace producer pin B with G.**
- `ledgerly-canonical`: required reviewer Future00111/318002590,
  `prevent_self_review=false`, retained `can_admins_bypass=true` capability
  **must not be used**. Required human-owner review remains mandatory.
- Custom admission remains exactly branch `main` plus branch
  `tr01/implementation-identity-successor-c7`; no tags/wildcards.
- Complete REST pages retained for policies, variables, secret names, refs,
  rulesets, collaborators, reviews, statuses and checks. Native policy/thread
  pagination is complete. Run pages include **16 canonical workflow runs**,
  all completed; no active conflicting run, no prior exact-G workflow run.
- Repository/Environment secret-name inventories are empty; variable inventories
  contain the retained pins only. No secret values were accessed. Development/
  shared Replit secret existence was recorded separately, never production.
  Those application secrets were **not passed to local fixture processes**.
- Local fixture subprocesses receive an explicit environment: tool PATH, isolated
  HOME/TMPDIR/Corepack cache, pinning settings and Git tooling settings only.
  No DATABASE_URL, PG target/credential, REPLIT, Helium, token or secret variable
  is inherited. Local Git-index permission is solely for detached review
  worktree index refresh, not GitHub bypass or container privilege.

No local G6 consumed marker was found in this preparation ledger and no remote
run on G was observed. Absence is a bounded observation, not a reservation of
future dispatch authority. Freshly check again at action time and stop if any
prior attempt, run, active conflict, new reviewer or control/source drift appears.
Do not cancel conflicting runs or silently retry.

## Exact activated workflow contract

Parsed exact G YAML with duplicate-key rejection. The fixture asserted:

1. Only `workflow_dispatch`; one protected-main-gated job; `contents: read`;
   concurrency `ledgerly-canonical-postgresql`, cancellation false.
2. Ubuntu 24.04, 20-minute job timeout, normal `ledgerly-canonical` Environment.
3. Root checkout uses `github.sha`, full history, no persisted credentials.
4. Candidate checkout uses the approved C7 variable, path `candidate`, depth 1,
   no persisted credentials. Local fixture candidate is detached at exact C7;
   actual coordinator verifies HEAD/cleanliness and C7 ancestry.
5. Checkout action pinned to
   `11bd71901bbe5b1630ceea73d27597364c9af683`.
6. Host prepares pnpm **10.26.1**, then runs
   `pnpm install --frozen-lockfile --ignore-scripts --filter workspace`.
7. Candidate coordinator runs with `identityMode=activated`, root G workflow
   root and separate exact-C7 implementation source.
8. Upload action pinned to
   `ea165f8d65b6e75b540449e92b4886f43607fa02`, `always()`, missing files error,
   retention 30 days. The sole upload glob is
   `candidate/docs/governance/evidence/ledgerly-44-ti-03-*.json`.
   Exact clean C7 contains only the schema under that glob before execution;
   no root G schema/evidence is substituted.

The host install is allowed to fetch pinned dependencies before the disposable
phase. This is not permission to enable networking inside isolated test/bootstrap
containers or weaken non-root/read-only/no-new-privileges boundaries.

## Actual safe fixture evidence and limits

Separate detached G, C7 and B worktrees were used under generated-artifacts,
without changing frozen branches or workspace runtime/package/lockfile sources.
The actual exact-G frozen host install passed with pnpm 10.26.1. Before any
broader harness dependencies, C7 resolved **AJV 8.20.0 from G's minimal host
node_modules**, with candidate node_modules absent. No API dependency link was
added to satisfy this fixture.

- Exact G YAML/source/root acceptance: PASS.
- Actual G/C7 trusted-context construction: PASS, **564 execution files**.
- In-memory schema-v2 activated evidence acceptance: PASS, simulated run
  metadata only; no synthetic passing TI-03 evidence file emitted.
- **10 rejection cases PASS:** C7 workflow attributed to G, forged C7 tree,
  G aliased as implementation, non-main ref, B without C7 ancestry, candidate
  workflow digest in activated evidence, wrong workflow-source binding, missing
  forged-database negative control, cleanup false, copied/unbranded trust context.
- Current offline suite: **1 static PASS, 0 failed, 6 image cases SKIPPED**.
  Historical G3 skips remain skips. No Docker/image/offline-runtime proof
  is claimed from this host-only run.
- No database, Docker, accounting test, migration, qualification or production/
  Helium access occurred. No TypeScript/runtime/package/schema source changed;
  no new application typecheck claim is made.

Two local harness incidents are preserved, not hidden:
the original source fixture was interrupted by Replit's Git-index guard after
the successful host install. Only the unfinished fixture was resumed with the
local Git permission; the install was not repeated. Both actual completed test
commands exited 0. The summary wrapper then asserted TAP-format counters,
but Node 24 emitted its default Unicode reporter. Its AssertionError remains
retained. An offline receipt reconciliation reads those already-saved results
(1 pass/0 fail/6 skips); **no tests, live reads or actions were retried** to
obtain a different result. See scripts, original logs and reconciliation receipt.

Fixture metadata is explicitly simulated. Neither context/schema acceptance
nor exact-C7's historical successful run qualifies G or authorizes dispatch.

## Review materials and remaining decision

- [Exact proposed dispatch and owner attestation](ledgerly-tr01-c7-g6-proposed-dispatch-and-attestation.md).
- [New activated evidence/cleanup checklist](ledgerly-tr01-c7-g6-evidence-cleanup-checklist.md).
- Tracked receipts: `ledgerly-tr01-c7-g6-preparation/`.
- Full raw readbacks, workflow bytes, scripts/logs and manifest:
  `generated-artifacts/ledgerly-c7-g6-preparation/`.
- Original relay SHA-256:
  `4ecb034c8c32dfcf42d92f718318821c1858bb107442671f04d505177ca4f996`.

**Stop here for exact action-time owner approval.** Do not dispatch from this
preparation instruction. No Environment approval API/automation, closure,
control write, push, runtime/workflow/schema change, migration, production/
Helium access, deployment, publishing, Phase A or follow-up implementation.
G6/G7 remain pending.
