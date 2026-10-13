# C7 G4 application — partial configuration, stopped on HTTP 422

**STOPPED. G4 setup is incomplete; G5–G7 remain PENDING.**
AI-generated execution report, not independent-human approval.

## Approval and fresh preflight

The owner approved exact reviewed ZIP SHA-256
`b7d0c84cbcf8f73a43691ae242ec84f494b97757b4c37b59fa55e1a0a6eeccaa`
and its closure plan requiring two approvals, with no merge or dispatch.
The approval is recorded in
`docs/governance/ledgerly-tr01-c7-g4-configuration-approval.md`.

ZIP CRC and every manifest member hash passed. The two request bodies were
extracted directly from that ZIP, not amended. Acting account readback matched
`Future00111` / `318002590`. Fresh checks from 14:38:52 to 14:39:09 UTC on
2026-10-13 matched the approved sources, main protection, repository settings,
Environment/reviewer/admissions, candidate/producer pins, all seven frozen
refs/rulesets/effective rules, collaborators and secret-name inventories.

- A / draft PR #26: `ead19106aaad76d604e8595337b5ab2fddda68d0`.
- Main / B: `0da401737f35d68b9404982baad7405fe997636a`.
- C7: `787d76decfa345e3c1104231e08d5ab00bc90259`.

## Exact operations and results

| Operation | Result |
| --- | --- |
| `PATCH /repos/Future00111/ledgerpoint`, ZIP repository payload | Succeeded; subsequent API GET verified |
| `PUT /repos/Future00111/ledgerpoint/branches/main/protection`, ZIP protection payload | **Rejected HTTP 422**; no retry or alternate payload |

Repository settings now are:

```json
{
  "allow_merge_commit": true,
  "allow_squash_merge": false,
  "allow_rebase_merge": false,
  "allow_auto_merge": false
}
```

Squash/rebase changed from enabled to disabled. Merge remained enabled and
auto-merge remained disabled. Branch-deletion/update settings did not change.

At 14:39:15 UTC the second request was rejected:

```json
{
  "message": "Validation Failed",
  "errors": [
    "Only organization repositories can have users and team restrictions"
  ],
  "documentation_url": "https://docs.github.com/rest/branches/branch-protection#update-branch-protection",
  "status": "422"
}
```

The repository is user-owned. The reviewed body contains an explicit empty
`bypass_pull_request_allowances` users/teams/apps block and
`restrictions:null`. The provider rejected organization-only restriction
semantics; it did not identify the precise offending property. The optional
bypass-allowance block is a likely cause, **not a write-probed diagnosis**.
No omission experiment, adjusted PUT, UI workaround or permission expansion
was attempted. The earlier generic package checks did not establish provider
acceptance of this body for a personal repository.

## Read-only verification after failure

Ten preservation/readback checks passed:

- Main remained exact B; PR #26 remained OPEN/draft at exact A/B.
- Full main classic protection remained byte-for-byte equivalent to its
  approved snapshot: administrator enforcement true, force/deletion false,
  **required-PR policy absent**, conversation resolution false.
- Native UI-backed GraphQL main policy remained
  `requiresApprovingReviews=false`, `requiredApprovingReviewCount=null`,
  administrator enforcement true, conversation resolution false.
- Environment gate, required owner reviewer, self-review setting, existing
  administrator-bypass capability and exact main+C7 admission remained intact.
- Candidate and historical producer pins remained unchanged.
- All seven frozen refs and full active/no-bypass rulesets remained unchanged.
- The successful merge-only settings remained installed; unrelated captured
  repository settings remained unchanged.

**The zero-review mandatory ordinary-PR path was not installed.** Do not
describe main as unprotected, but also do not infer mandatory PR enforcement
from its existing classic protection or the successful merge-method PATCH.
An authenticated browser settings inspection was not performed and is not
claimed; read-only API/native-policy results are retained separately.

## Closure and stop condition

The stated two-approval closure plan is owner-approved but **not applied**.
Its reviewed main-protection body shares the optional restriction fields in
the rejected request; successful provider acceptance is not established.
The owner explicitly required stopping on failure. No closure attempt,
automatic rollback, retry, bypass or weaker historical-policy restoration
followed the error. Already strengthened merge-only settings were retained.

No merge, PR-ready transition, status publication, workflow dispatch,
Environment release, migration, deployment, production/Helium access or
Phase A occurred. G5–G7 must not proceed while this configuration hold remains.

## Evidence and next required decision

The companion `ledgerly-tr01-c7-g4-application/` directory retains the original
audit, ZIP-extracted request bytes, successful PATCH response/readback,
preflight native-policy readback, and post-failure verification. The failed
operation's original audit marker is preserved as written at request start;
the recorded HTTP 422 and post-failure unchanged-protection proof establish
its rejected outcome. Full raw readbacks and the applied command are retained
under ignored `generated-artifacts/ledgerly-c7-g4-package/application/`.

The approved ZIP, original G3 receipts and historical six-skip reconciliation
remain unchanged. No test/qualification result has been relabelled.

The next configuration action would require a **separately reviewed corrected
personal-repository payload package**, bound to the current partially applied
state and including a compatible closure payload. This report does not
prepare, approve or apply that correction. No further write is authorized by
the failure report.
