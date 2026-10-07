# C3 producer merged normally; stop before live controls

## Completed authorised stage

Owner continuation relayed through Codex authorised marking exact producer
PR #12 ready and merging normally. It supersedes the earlier preparation-only
limit for this merge, not for security-sensitive controls or dispatch.

- [PR #12](https://github.com/Future00111/ledgerpoint/pull/12) was freshly
  verified as head `741b19155d5fb3dcdfce7705c72461d78f6e71c8`, base `main`
  at `87a4ff7d44be9bc21296e9623db16924488f76ae`, cleanly mergeable.
- Exactly three added files; all prepared file/patch/rules hashes unchanged.
  Required main PR-review/status-check fields were absent, no effective
  additional main rules applied, and admins remained enforced.
- Marked ready, then normal `gh pr merge --merge --match-head-commit`:
  **no admin bypass, force, auto-merge or branch deletion**.
- **Actual merge/main SHA M:**
  `65f3453c29f1eb1057bc66edc0cc7de508e87c2d`.
- **Merge tree:** `d71954f8e7048e261e6cc3d3119ad47a06b138ae`,
  identical to the tested producer review tree.
- **Two parents:** `87a4ff7d44be9bc21296e9623db16924488f76ae`,
  `741b19155d5fb3dcdfce7705c72461d78f6e71c8`.
- Fresh remote main equals M. [Inspection PR #11](https://github.com/Future00111/ledgerpoint/pull/11)
  remains open, draft and unmerged.

C3 was freshly verified unchanged: SHA
`1c26be19295902a38e1939b56ff99ae9a195d3de`, tree
`beb56d35539d81636b609602b3c57d167bc88888`, sole parent
`e7f43c70e45c068971aeb241ce1b01a30bb01e37`, with C2 ancestry intact.
The unchanged source retains the previous passing identity suite, actual
image build/3 offline tests, 25 producer tests with no skips, 8 disposable SQL
predicate cases, syntax and patch checks. No unnecessary test repeat.
Full hosted typechecks and canonical PostgreSQL qualification remain unrun.

## Precise ready-to-apply actions — NOT performed

Action-time confirmation through Codex is required before any of these:

1. Freshly ensure protected main still equals M and its producer hashes match.
   Add **only** Environment variable in `ledgerly-canonical`:
   `TR01_C3_APPROVED_WORKFLOW_SHA=65f3453c29f1eb1057bc66edc0cc7de508e87c2d`.
   This is actual merged main, not PR head, old main or C3.
2. Create a new active exact-C3 ruleset using
   [prepared payload](ledgerly-tr01-c3-ruleset-proposed.json), SHA-256
   `5242af99f9f96d09f7ee8600dbbfaf1e27d0f4b1383c2a8eda1474c68bb96ed0`.
   Exact include:
   `refs/heads/tr01/implementation-identity-successor-c3`; no exclusions or
   bypass actors. Block updates, deletion and non-fast-forward changes.
   Require `tr01/c3-identity-validation`, GitHub Actions app `15368`,
   strict policy true, initial-create exemption true. Verify stored conditions
   and effective rules before/after publication; leave C/C2/main rules alone.
3. Publish that immutable C3 ref **once**, no force, pointing exactly to
   `1c26be19295902a38e1939b56ff99ae9a195d3de`. Verify protected/frozen
   effective rules and exact remote SHA/tree/sole parent.

Keep existing qualification candidate pin/admissions untouched at this stage:

- `LEDGERLY_APPROVED_CANDIDATE_SHA=3ab9edc28b4922ad82e68afb7b049d69514f91e1`
- `TR01_C2_APPROVED_WORKFLOW_SHA=87a4ff7d44be9bc21296e9623db16924488f76ae`
- Exact Environment admissions remain only `main` and
  `tr01/implementation-identity-successor-c2`, no tags/wildcards.

Later, separately confirmed validation would dispatch
`ledgerly-tr01-c3-identity-status.yml` on exact main M with normal owner
Environment release. Only after it succeeds and further confirmation would
the qualification candidate pin become exact C3 and the exact C2 admission
be replaced by exact C3, retaining main. Qualification then uses
`ledgerly-canonical-postgresql.yml` on C3, **not main**, with a fresh run and
normal owner release. None of those changes, dispatches or approvals occurred.

## Recorded evidence and retained boundaries

[Merge identity/readback JSON](ledgerly-tr01-c3-producer-merge-identity.json)
records the actual merge identity, producer file SHA-256 digests, reused
verification, unchanged live-control readback and unapplied next values.
The earlier preparation JSON remains a historical pre-merge snapshot.

Main protection, Environment settings, admissions/pins, rules inventory,
C2 effective freeze/status rules and exact C/C2 refs remain unchanged.
Intended immutable C3 remains absent. No source-pin/admission/protection
change, immutable publication, workflow dispatch, deployment approval or
isolation relaxation was performed.

Development/disposable PostgreSQL only. Existing owner exception retained;
no independent-human-review claim, qualification acceptance or production
access is implied.
