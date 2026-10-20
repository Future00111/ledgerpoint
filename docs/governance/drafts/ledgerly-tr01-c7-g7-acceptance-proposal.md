# G7 acceptance proposal — run 38621069723 / attempt 1

**G7: ACCEPTED on the user's explicit instruction. This qualification stage is complete.**

See [recorded acceptance](ledgerly-tr01-c7-g7-acceptance/owner-acceptance.md) and the structured decision in owner-acceptance.json. The review below is preserved as the supporting proposal.

Prepared on 2026-10-20 from the original GitHub artifact, attempt-specific logs and API metadata. This is a review proposal, not an owner attestation or governance closure. No new qualification run, production operation or Phase A authorization is represented.

## Decision scope and identity

| Item | Verified value |
| --- | --- |
| Repository | Future00111/ledgerpoint |
| Run | [38621069723, attempt 1](https://github.com/Future00111/ledgerpoint/actions/runs/38621069723) |
| Job | [116048423733](https://github.com/Future00111/ledgerpoint/actions/runs/38621069723/job/116048423733), canonical-postgresql |
| Event / source ref | workflow_dispatch / refs/heads/main, protected |
| Identity mode | activated |
| Workflow source G | `706dc6a31f85733ba0c251f40b2c09f5a9312269` |
| Implementation C7 | `787d76decfa345e3c1104231e08d5ab00bc90259` |
| Actor / triggering actor / Environment reviewer | Future00111 |
| Run created | 2026-10-14T19:07:58Z |
| Job execution | 2026-10-20T18:20:59Z to 18:22:00Z (61 seconds) |
| GitHub outcome | success; all nine job steps successful |
| Run UUID | `283124e1-47d4-4754-ae97-e0f59c2f579e` |
| Disposable database | `ledgerly_canonical_test_283124e147d44754ae97e0f59c2f579e` |
| Nonce SHA-256 | `27c8a1fe756842bc5e1213ca4519a7e587465eae3a9396efbee79d73dc0954a0` |

The Environment approval record is retained in reviews.json. The API response does not supply a precise approval timestamp; the job execution timestamps above are not represented as approval timestamps.

## Verification outcome

Strict AJV 2020 validation with AJV 8.20.0 and the frozen C7 coordinator's branded, source-bound acceptance validator passed. The validator recomputed all ten source digests from fresh detached G and C7 checkouts and verified clean tracked trees plus C7 ancestry in G. The execution-tree digest covers 564 files. Uploaded schema bytes equal the schema at C7.

The offline verification receipt records 19 passing groups. Additional archive/marker verification passed: unique safe ZIP member names, no symlinks or duplicate JSON keys, valid CRCs, exactly two expected artifact members, and completion-marker agreement. These are evidence-review checks, not extra qualification tests.

The previous preparation host checkout had moved to another commit. It was excluded from source attribution; fresh exact detached checkouts were used. Its existing AJV installation was reused, with version 8.20.0 checked. No application dependencies were installed or database/Docker commands run during this review.

## Accounting tests — 6/6 PASS

| # | Test in original qualification log | Result |
| --- | --- | --- |
| 1 | canonical integration suite is bound to an empty API-role disposable database | PASS |
| 2 | canonical posting persists a balanced immutable journal, audit, and retry-safe effect | PASS |
| 3 | canonical posting fails closed for stale sources, closed periods, invalid accounts, and company mismatch | PASS |
| 4 | canonical posting is atomic under audit failure, concurrent retries, and additive reversal | PASS |
| 5 | SC-01 enforces company-scoped relation identity, uniqueness, and atomic rollback | PASS |
| 6 | owner journal locks serialize transactions without API mutation privileges | PASS |

Original test summary: tests 6; pass 6; fail 0; cancelled 0; skipped 0; todo 0; duration 625.940792 ms. These six integration results are distinct from historical offline image-dependent skips, which remain historical skips.

## Concurrency checks — PASS

Concurrent retry arrivals use backend PIDs **179 and 180**, with distinct transaction IDs **891 and 892**. Arrival timestamps are **1792520516844** and **1792520516850**; barrier release is **1792520516850**. Both transactions arrived before release, and overlapProven is true. The log marker exactly matches the artifact.

The independent owner-mediated journal-lock test passed using backend PIDs **186 and 187**. Function owner is ledgerly_canonical_owner; callerHasUpdate is false. Scoped lookup rejection, direct mutation denial, temporary-shadow rejection and transactional row-lock serialization are all true. The original test log and evidence agree.

## Negative controls — 18/18 PASS

| # | Control | Recorded result | Reviewed rejection meaning |
| --- | --- | --- | --- |
| 1 | `missingRunBinding` | PASS | Missing UUID binding rejected with required-run-id diagnostic. |
| 2 | `forgedRunDatabaseMismatch` | PASS | Forged UUID/database binding rejected by private run-binding verification. |
| 3 | `malformedUri` | PASS | Malformed target rejected as Invalid URL. |
| 4 | `targetChangingQuery` | PASS | Target-changing or duplicate query parameter rejected. |
| 5 | `wrongHost` | PASS | Non-exact host rejected. |
| 6 | `wrongPort` | PASS | Non-exact port rejected. |
| 7 | `wrongDatabase` | PASS | Non-exact database rejected. |
| 8 | `wrongRole` | PASS | Non-exact role rejected. |
| 9 | `parentDatabaseUrl` | PASS | Inherited parent DATABASE_URL rejected. |
| 10 | `replitMarker` | PASS | Inherited Replit marker rejected. |
| 11 | `inheritedPgOverride` | PASS | Inherited PostgreSQL target override rejected. |
| 12 | `unpinnedImage` | PASS | Unpinned image rejected by image guard. |
| 13 | `untrustedEvent` | PASS | Untrusted workflow event rejected. |
| 14 | `unauthorizedWorkflow` | PASS | Unauthorized workflow identity rejected. |
| 15 | `cleanupBindingMismatch` | PASS | Mismatched cleanup UUID fails private binding count check. |
| 16 | `evidenceCredentialPattern` | PASS | Credential-shaped evidence rejected by sanitizer. |
| 17 | `roleEscalation` | PASS | API role escalation and SET ROLE postgres denied in runtime marker. |
| 18 | `triggerDisable` | PASS | Trigger disable and canonical delete denied in runtime marker. |

The first eleven runner probes require specific rejection diagnostics in the reviewed coordinator. Image, event, workflow and credential-pattern probes require rejection of isolated mutations. Cleanup mismatch uses the private binding check; privilege controls are supported by runtime markers. Quiet per-control stderr is not retained in the uploaded artifact/log, so individual rejection reasons are established by source review plus the hash-bound success flags, not by 18 separately preserved stderr transcripts.

## Cleanup checks — 5/5 PASS

| Check | Recorded result | Evidence meaning |
| --- | --- | --- |
| `logicalDrop` | PASS | Run-bound logical DROP DATABASE completed after exact UUID/database/nonce/creator/runtime verification. |
| `databaseAbsent` | PASS | Post-drop database-catalog absence check succeeded. |
| `containerRemoved` | PASS | Disposable PostgreSQL container removal and inspect-absence check succeeded. |
| `networkRemoved` | PASS | Disposable network removal and inspect-absence check succeeded. |
| `credentialMaterialRemoved` | PASS | Credential directory recursive removal completed successfully; no separate stat receipt retained. |

The frozen cleanup path verifies the exact run UUID, database, nonce, creator postgres and runtime ledgerly_api before logical destruction. The five true flags are in the validated final evidence, written after cleanup. Quiet SQL/Docker cleanup output is not separately retained. This review verifies the recorded checks and their source implementation; it does not claim to re-inspect resources after the disposable runner ended.

## Bootstrap, privileges and isolation

The API role is LOGIN with no superuser, inheritance, CREATE DATABASE, CREATE ROLE, replication or BYPASSRLS; the canonical owner is NOLOGIN with the same restrictions. No API role memberships are present. All five canonical tables are owner-owned. API ACLs grant SELECT/INSERT on append-only tables, with UPDATE additionally present only on posting effects. The private schema ACL remains postgres-only.

The evidence contains 17 constraints, four posting-effect indexes, seven validated relation foreign keys, five ENABLE ALWAYS triggers, an empty initial canonical baseline and private run binding. Journal-lock function ownership, SECURITY DEFINER, volatile designation, fixed pg_catalog/pg_temp search path, API-only execute permission and absence of API update/delete/truncate privileges were checked. Six guard/verifier functions and their fixed search paths are retained in the original evidence.

Isolation flags confirm no parent DATABASE_URL or Replit variables, no published ports, an internal network, no test-container Docker socket and no external route. Helium and production contact flags are false; the credential scan passed. Reviewed Dockerfile runs as node; runner options restrict capabilities, privileges and filesystem access.

PostgreSQL reports 16.15. Pinned image identities are retained in the evidence. Node 24.13.0 and pnpm 10.26.1 are recorded; the Docker build includes a successful non-network toolchain check as the node user. Node runtime version is a coordinator-recorded field rather than a separate runtime-version transcript.

### Disclosed bootstrap recovery

The initial Drizzle push encountered the specifically handled SQLSTATE 42830 ordering error involving accounting_posting_effects. The reviewed C7 coordinator added its narrow prerequisite index and completed a second successful push. Evidence records recoveredOrdering=true and pushes=2. This was an approved bootstrap recovery within attempt 1, not a failed accounting test or GitHub rerun.

## Artifact integrity and retention

| Object | SHA-256 |
| --- | --- |
| Original artifact ZIP | `41ccf0941649ffd35e9e1e5e5d588e46f3a2b3579af943fffe2f720e7fdd048f` |
| Original attempt log ZIP | `d72c9e314446911beb8005f62226693a320e514d5a5aee4f4f36473eb32aa0de` |
| Evidence JSON | `1ed8e4b18f0a3809230ba0715eef9f10640e36ba1101f4a2f8dce57998a73c1a` |
| Schema JSON | `6ba3d5f595f81e81db238b843c16b667e775384952855482ce9a978775d6ca0f` |

Artifact **12288971026**, named **ledgerly-ti-03-38621069723-1**, is 5,290 bytes. Its ZIP digest matches GitHub artifact metadata and the upload log. The artifact contains only the evidence JSON and frozen schema. GitHub expiry is 2026-11-19T18:21:58Z. Original ZIPs, extracted members, logs, API metadata, full member inventories, source digest receipt and verification script/results are retained in the sibling `ledgerly-tr01-c7-g7-acceptance/` directory.

| Source component | Recomputed SHA-256 |
| --- | --- |
| sourceTree | `fcd81d162cbfc406853bdd13c853cd49f81fd814622a7f90116724e668eb82d1` |
| applicationSchema | `67c2c27243abcdd35c1e6c5e3fa78fc7f537dce914677a8ef799ba1eb116f564` |
| drizzleConfig | `57862221556f24a1accd28b283876930c403ad7c86b79d87cfb5c9c200ba6258` |
| securityOverlay | `779d76aa3ab065d5bb1f5a08c9ea807cf4bc3166d0fdc1b59c21c81140404081` |
| runControlSql | `cf7c294738f2400e5ce5ab7abcb1cc111bd8100a62386d075306ced6395bf00b` |
| coordinator | `224275124927ffabc03a0720acb67bd4b2d3e99db8183d1c2eca4283e7440427` |
| testSources | `2573b8b7be50acaadc68be89c6de53dbdb9279132455dac99fa02206bca916ac` |
| lockfile | `3b8329fff64eab80ec5dfe8d875f80502789520faea4680d2fd0e7f0b4703f1b` |
| workflow | `ad06da35f4269fbbf46e1fd4ccabf6082d309963e39b577e17ac948c546afc20` |
| orchestrator | `3699a2ad28b5d2e3e652529c2d26bec8b7c84b7ff658fa8a08b4ae6f456ef54b` |

Fresh read-only main/C7 and Environment/variable observations are retained. The configured candidate pin remains C7; the approved-workflow pin retains its G6 meaning and was not changed to G. The approved Environment configuration includes can_admins_bypass=true; this is disclosed retained configuration, not a bypass used by this run. No controls were altered during verification.

## Original proposed acceptance wording — retained for context

> I accept the G7 evidence for GitHub run 38621069723, attempt 1, workflow source G 706dc6a31f85733ba0c251f40b2c09f5a9312269 and implementation C7 787d76decfa345e3c1104231e08d5ab00bc90259, limited to the activated disposable-CI qualification. I have reviewed the six accounting passes with no skips, concurrent transaction and journal-lock evidence, all 18 negative controls, all five cleanup checks, source bindings and artifact digests, including the documented bootstrap recovery and evidence granularity limits.

Acceptance authority: **User's explicit instruction in ChatGPT; recorded by Codex on their behalf**  
Acceptance recorded at: **2026-10-20T20:02:25.181504+01:00 (Europe/London)**  
Acceptance record/reference: **ledgerly-tr01-c7-g7-acceptance/owner-acceptance.json**  
G7 qualification stage: **COMPLETE**

This proposal does not itself authorize production, Phase A, another dispatch, a rerun, a push or changes to frozen controls. The user's subsequent acceptance is recorded in the linked decision.

## Review sources

- `ledgerly-tr01-c7-g6-evidence-cleanup-checklist.md`
- `ledgerly-tr01-c7-g6-review-attestation-package.md`
- `ledgerly-tr01-c7-g6-dispatch-report.md`
- Original run, artifact and attempt logs retained alongside this proposal.
- Frozen C7 coordinator and orchestrator, G workflow, and exact C7 execution sources.
