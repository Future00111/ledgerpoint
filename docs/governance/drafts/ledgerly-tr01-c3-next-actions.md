# C3 exact next actions — producer merged; live controls pending

**Latest approved correction/fresh run:** name-only policy update succeeded;
admission is now exactly main+C3 with matching C3 pin. All preflights passed
before one fresh normal-owner-released qualification. It failed in bootstrap
because the forged-run database-mismatch probe did not reject. Schema2 failure
artifact/hashes were verified and preserved; no retries or immutable edits.
See [current fresh-run report](ledgerly-tr01-c3-fresh-qualification-report.md).
Earlier admission-blocked and preparation stages below remain historical.

**Latest action-time execution:** C3 protections/publication and source pin
are applied; identity validation passed with normal owner release. Candidate
pin is now C3, but the admission update failed HTTP 422. A shell sequencing
error dispatched the single qualification, which failed at the unchanged
Environment gate with no job steps/artifact. All further writes/releases and
retries are stopped. See
[current execution/failure report](ledgerly-tr01-c3-live-execution-report.md).
The earlier stage instructions below are historical, not current authority
to resume after this failure.

The owner's later continuation through Codex authorised normal ready/merge of
exact producer PR #12. That stage is completed; actual main merge M is
`65f3453c29f1eb1057bc66edc0cc7de508e87c2d`. See
[merge report](ledgerly-tr01-c3-producer-merge-report.md) and
[merge identity/readback](ledgerly-tr01-c3-producer-merge-identity.json).
**Stop before all remaining live security-sensitive actions:** source pins,
admissions, protections and immutable publication need action-time confirmation
through Codex. No dispatch or deployment approval is authorised at this stage.
Development/disposable PostgreSQL only; the existing owner exception remains,
with no independent-human-review claim.

## Frozen local identities

| Object | Exact identity |
|---|---|
| C | `d292f3a64c6253e022b40de8cf055f3e722ff1ea` |
| C2 | `3ab9edc28b4922ad82e68afb7b049d69514f91e1` |
| Reviewed offline correction / C3 sole parent | `e7f43c70e45c068971aeb241ce1b01a30bb01e37` |
| C3 | `1c26be19295902a38e1939b56ff99ae9a195d3de` |
| C3 Git tree | `beb56d35539d81636b609602b3c57d167bc88888` |
| Intended immutable C3 ref, **not published** | `refs/heads/tr01/implementation-identity-successor-c3` |
| Protected-main producer base inspected | `87a4ff7d44be9bc21296e9623db16924488f76ae` |
| Actual normal producer merge / current main M | `65f3453c29f1eb1057bc66edc0cc7de508e87c2d` |
| New status context | `tr01/c3-identity-validation` |

C3 inherits the tested offline Dockerfile verbatim. Its six changes from the
reviewed correction are the candidate ref in the coordinator, disposable
runner, SQL run-control identity predicate, schema, qualification workflow and
tests; it additionally requires the approved candidate SHA to equal the event
SHA. Old C2 aliases and stale pins fail closed. Accounting, application schema,
security overlay, package manifests, lockfiles, private network, role,
cleanup and journal/posting behavior are unchanged.

The separate producer review branch adds three new C3 files to exact protected
main. It does not replace the C2 producer or install C3 accounting into main.
The new readonly validation job runs typechecks, pure identity tests, producer
mock/workflow tests and an actual offline Docker smoke. Its build-only manifest
is deliberately not a valid qualification manifest. Only the subsequent job
gets Environment admission and `statuses: write`; that job checks its approved
protected-main source SHA and exact remote C3 SHA/tree/single parent/ref twice.
Its status explicitly says **NOT TI-03 qualification**.

## Live readback after authorised normal producer merge

- Repository `Future00111/ledgerpoint`; authenticated CLI owner `Future00111`.
- Protected main: `65f3453c29f1eb1057bc66edc0cc7de508e87c2d`; protection unchanged, admins enforced,
  force push/deletion prohibited, no required PR review/check fields.
- Environment `ledgerly-canonical`: custom exact branch policies, only `main`
  and `tr01/implementation-identity-successor-c2`, no tag policies.
- Existing required reviewer remains `Future00111`, self-review prevention
  false and admin-bypass capability true. Use normal owner release, **not**
  bypass. These settings are not independent-human-review controls.
- Environment variable `LEDGERLY_APPROVED_CANDIDATE_SHA` remains C2.
- Environment variable `TR01_C2_APPROVED_WORKFLOW_SHA` remains the old
  `87a4ff7d44be9bc21296e9623db16924488f76ae`, not new main M.
- Active C/C2 rulesets remain unchanged, no bypass actors. C2 requires
  `tr01/c2-identity-validation` from GitHub Actions app `15368`, strict status
  policy and create-only check exemption; updates/force updates/deletion blocked.
- Remote intended C3 ref did not exist at inspection.

## Remaining live preparation — action-time confirmation required

1. **Completed:** exact producer PR #12 was marked ready and merged normally
   without bypass. PR #11 stays draft and unmerged: candidate inspection only.
2. **Ready, not applied:** actual main commit **M** and unchanged producer
   digests are recorded. Freshly verify main still equals M, then add Environment
   variable
   `TR01_C3_APPROVED_WORKFLOW_SHA=65f3453c29f1eb1057bc66edc0cc7de508e87c2d`
   only after confirmation. Do not use C3, the review PR head, or old main.
   Leave `TR01_C2_APPROVED_WORKFLOW_SHA` unchanged.
3. Create a *new*, active, exact-C3 ruleset from
   `ledgerly-tr01-c3-ruleset-proposed.json`. This mirrors C2 restrictions but
   names only C3 and requires `tr01/c3-identity-validation` from app `15368`.
   Do not edit C/C2/main protections or introduce bypass actors. Verify both
   stored conditions **and effective branch rules** before and after creation.
   The create-only exemption solves initial branch/status ordering; it does
   not permit subsequent updates.
4. Publish the immutable C3 ref **once**, pointing exactly to
   `1c26be19295902a38e1939b56ff99ae9a195d3de`; no force, amend, merge or
   rewritten parent. Verify remote ref, SHA, tree and sole parent and that
   effective rules make it protected/frozen. Ordinary review publication is
   not this step.
5. Leave Environment admissions/pins for qualification unchanged until the
   separately authorised status validation succeeds. Do not dispatch a
   qualification as part of these live-preparation steps.

Example publication command **only after the separate approval and rule checks**:

```sh
timeout --kill-after=2s 30s git \
  -c credential.helper= -c 'credential.helper=!gh auth git-credential' \
  push https://github.com/Future00111/ledgerpoint.git \
  1c26be19295902a38e1939b56ff99ae9a195d3de:refs/heads/tr01/implementation-identity-successor-c3
```

Only the separately authorised ready/normal merge of producer PR #12 occurred.
No live control, immutable-publication or dispatch command above/below occurred.

## Later validation/qualification — separately authorised, normal owner release

1. From exact protected main **M**, manually dispatch
   `ledgerly-tr01-c3-identity-status.yml` on `main`, then perform normal owner
   Environment release. No failed-run retry or reused prior run authorisation.
   Check its exact workflow SHA/source pin, C3 checkout identity, upstream
   non-DB/offline checks and bot-issued status on C3. A successful status is
   identity/non-DB verification only.
2. After success and separate approval, retarget Environment
   `LEDGERLY_APPROVED_CANDIDATE_SHA` from C2 to the exact C3 SHA.
   Replace **only** the exact C2 Environment deployment policy with the exact
   C3 policy. Preserve `main`, custom-branch-policy mode, required owner review
   settings and zero tag/wildcard admissions. C2 source and protections remain
   frozen; only its old *run eligibility* is retired. Read back both variables
   and the exact two-policy allowlist before allowing qualification.
3. Manually dispatch `ledgerly-canonical-postgresql.yml` on
   `tr01/implementation-identity-successor-c3`, **not main**. Exact protected
   main's existing qualification workflow is the old entry point and does not
   select C3 using this pin. C3's candidate mode binds workflow and implementation
   to the same C3 commit. Perform normal owner Environment release; do not bypass.
4. Review the new run/attempt, exact schema/evidence/artifact digests, source and
   image bindings, all posting/concurrency/negative controls, four isolation
   probes and all five cleanup flags. Preserve failure evidence if it fails.
   No acceptance or production/Helium access follows from this preparation.

Illustrative future dispatch commands, **not performed**:

```sh
gh workflow run ledgerly-tr01-c3-identity-status.yml --repo Future00111/ledgerpoint --ref main
gh workflow run ledgerly-canonical-postgresql.yml --repo Future00111/ledgerpoint \
  --ref tr01/implementation-identity-successor-c3
```

## Review artifacts

- `ledgerly-tr01-c3-vs-reviewed-fix.patch`: six-file identity successor diff.
- `ledgerly-tr01-c3-vs-c2.patch`: full eight-file cumulative candidate diff.
- `ledgerly-tr01-c3-producer-review.patch`: separate protected-main producer diff.
- `ledgerly-tr01-c3-preparation-identity.json`: exact commit identities, hashes,
  review publication identifiers and verification results; **not evidence**.
- `ledgerly-tr01-c3-ruleset-proposed.json`: concrete, unapplied rule payload.
- `ledgerly-tr01-c3-preparation-report.md`: results and final review links.