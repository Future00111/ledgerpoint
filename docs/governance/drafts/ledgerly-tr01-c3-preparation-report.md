# Concrete C3 preparation completed — not qualified

## Code and review artifacts

- **C3:** `1c26be19295902a38e1939b56ff99ae9a195d3de`
- **Git tree:** `beb56d35539d81636b609602b3c57d167bc88888`
- **Sole parent:** reviewed offline correction
  `e7f43c70e45c068971aeb241ce1b01a30bb01e37`; its parent is immutable C2
  `3ab9edc28b4922ad82e68afb7b049d69514f91e1`.
- Local intended-C3 branch/worktree:
  `tr01/implementation-identity-successor-c3`,
  `.local/tr01-c3-candidate-preparation`.
- [Candidate inspection draft PR](https://github.com/Future00111/ledgerpoint/pull/11):
  ordinary head `review/tr01-c3-candidate`, base
  `review/tr01-c2-offline-pnpm`. **Do not merge this candidate PR into main or
  an immutable ancestor.** Its head is exact C3, but the immutable C3 ref is
  not published.
- [Protected-main producer draft PR](https://github.com/Future00111/ledgerpoint/pull/12):
  ordinary head `review/tr01-c3-identity-status`,
  commit `741b19155d5fb3dcdfce7705c72461d78f6e71c8`,
  tree `d71954f8e7048e261e6cc3d3119ad47a06b138ae`,
  sole parent/inspected main
  `87a4ff7d44be9bc21296e9623db16924488f76ae`.
  **Draft only: no merge or dispatch authorised/performed.**

C3 changes six identity/test files from the offline correction (eight cumulative
files from C2). The coordinator, disposable runner, SQL identity predicate,
schema and qualification workflow all name C3; tests reject coherent C2 aliases
and stale approved SHA pins. Accounting sources, application schema, security
overlay, package manifests, lockfiles, role/private-network/isolation/cleanup
logic are unchanged from C2. The offline Dockerfile is unchanged from the
tested review correction.

The separate producer adds only three C3 files; existing C2 producer and main
qualification workflow are unchanged. Its validation job is readonly and runs
non-DB/typecheck/offline checks. Its separate normal-owner-Environment-gated
writer requires the exact approved protected-main workflow source SHA and
exact remote C3 SHA/tree/single parent/ref with a second ref read. The status
context is `tr01/c3-identity-validation`; it explicitly is **NOT TI-03
qualification**. Its build-only manifest is invalid for qualification.

## Completed verification

| Check | Result |
|---|---|
| Expanded C3 identity/evidence acceptance suite | Passed; old C2 aliases/pin rejected |
| Actual C3 production Dockerfile from pinned Node base | Built; final node-user network-none pnpm/Drizzle check passed |
| Offline runtime regression suite | **3 passed, zero skipped**; read-only/no-network/no-new-privileges/missing-cache fail closed |
| Producer mock/workflow/source-fixture suite | **25 passed, zero skipped**, actual C3 manifest guard exercised |
| AI code review | Passed; not independent human signoff |
| Pinned, disposable, network-none PostgreSQL SQL identity smoke | 8 predicate cases passed: C3 and activated main accepted; C2 alias, commit mismatch, false protected/ancestry/both-clean flags rejected |
| SQL cleanup | Transaction rollback removed synthetic rows/DDL/temporary roles; container and anonymous volume absent |
| Main/C/C2 refs and live Environment/rules readback | Exact previous state; immutable C3 ref still absent |

Full hosted typechecks and canonical PostgreSQL posting/concurrency/negative
controls have **not** run for C3. No qualification success or production
readiness is claimed. The isolated SQL smoke is only predicate verification,
not DB bootstrap or canonical posting qualification.

## Exact digests

All ten candidate source digests, changed-file/producer-file hashes, patch/rule
hashes, image pins and final live-control readback are in
[preparation identity metadata](ledgerly-tr01-c3-preparation-identity.json).
The canonical execution file set has **561 files** and SHA-256
`5608ea5b074b8c603e4fa0963dbb57dda5cfe30d9ee7079704f0c17d1cd7e16f`.
This is preparation metadata, **not qualification evidence**.

- [Six-file diff from reviewed correction](ledgerly-tr01-c3-vs-reviewed-fix.patch)
- [Full eight-file C3-vs-C2 diff](ledgerly-tr01-c3-vs-c2.patch)
- [Separate producer diff from exact main](ledgerly-tr01-c3-producer-review.patch)
- [Unapplied exact-C3 ruleset payload](ledgerly-tr01-c3-ruleset-proposed.json)
- [Reproducible disposable SQL smoke](ledgerly-tr01-c3-sql-smoke.sh)
- [Captured SQL smoke/cleanup output](ledgerly-tr01-c3-sql-smoke-output.txt)
- [Exact later live steps and approval boundaries](ledgerly-tr01-c3-next-actions.md)

The previous C2 failure JSON remains SHA-256
`aa120080c81d43d34b4a7a2411b3e9ca61b311678de9f0758f60866cc11b79f2`,
failure evidence only.

## Authority and next step

Owner approval relayed through Codex authorised this concrete preparation and
ordinary review publication, **development/disposable PostgreSQL only**.
The existing owner-review exception is retained; none of this is independent
human review. Live Environment admissions/pins/protections, main, immutable
C/C2 and intended immutable C3 publication are untouched. No live identity
status or workflow dispatch was performed.

Next approval must explicitly cover review/merge of the producer PR, its final
main source pin, new exact-C3 protections and one-time immutable publication.
Validation and qualification dispatch/normal owner release remain separately
gated. Future qualification uses C3's candidate workflow, **not** the unchanged
main qualification entry point; then the exact Environment admission swap
retires C2 run eligibility without changing its frozen source/protections.