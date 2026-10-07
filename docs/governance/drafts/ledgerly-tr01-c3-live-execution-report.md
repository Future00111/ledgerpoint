# C3 live execution — identity passed, qualification blocked; stopped

## Authorised scope and completed actions

Specific action-time owner approval was relayed through Codex for exact C3
protection/publication, merged-main source pin, one identity validation, then
only after success exact qualification pin/admission replacement and one
development/disposable qualification with normal owner release.
Existing owner exception retained; no admin bypass or independent-human-review
claim.

Fresh preflight verified:

- Main M: `65f3453c29f1eb1057bc66edc0cc7de508e87c2d`.
- C3: `1c26be19295902a38e1939b56ff99ae9a195d3de`.
- C3 tree: `beb56d35539d81636b609602b3c57d167bc88888`.
- C3 sole parent: `e7f43c70e45c068971aeb241ce1b01a30bb01e37`.
- No repository or canonical Environment secrets; no competing active run.

Completed:

1. Set `TR01_C3_APPROVED_WORKFLOW_SHA` to exact M.
2. Created active exact-C3 ruleset **24663898** from the prepared payload:
   no bypass, update/deletion/non-fast-forward blocks, required
   `tr01/c3-identity-validation` from GitHub Actions app **15368**, strict
   checks and initial-create exemption. Stored and effective rules verified
   before and after one-time publication.
3. Published `refs/heads/tr01/implementation-identity-successor-c3` once,
   exactly C3; verified protected/frozen SHA/tree/sole parent.
4. Dispatched identity validation once from exact M:
   [run 37652252967](https://github.com/Future00111/ledgerpoint/actions/runs/37652252967).
   Readonly validation succeeded, normal owner pending-deployment approval
   was submitted, identity job succeeded, and `github-actions[bot]` posted
   the named success status on exact C3. Both jobs passed, including hosted
   typechecks, identity/producer tests and offline image smoke.
5. After that success, set `LEDGERLY_APPROVED_CANDIDATE_SHA` to exact C3.

## Concrete failure and sequencing error

The exact branch-policy replacement request for policy **61652697** returned
**HTTP 422**:

> Invalid request: `"type" is not a permitted key.`

The request was PUT with `{"name":"tr01/implementation-identity-successor-c3",
"type":"branch"}`. It reused the creation shape for an update. The existing
policy's branch type is retained; the correction would omit `type`.

The shell batch lacked fail-fast handling, so the subsequent `gh workflow run`
executed despite the nonzero preflight exit. This was an agent sequencing
error, not an approved relaxation of the gate.

The single qualification dispatch
[run 37652657227](https://github.com/Future00111/ledgerpoint/actions/runs/37652657227)
completed **failure**, attempt **1**, before any job steps. GitHub annotations:

> Branch "tr01/implementation-identity-successor-c3" is not allowed to deploy
> to ledgerly-canonical due to environment protection rules.

> The deployment was rejected or didn't satisfy other protection rules.

No pending deployment, normal qualification release, retry or second dispatch
occurred. No job steps ran; zero artifacts exist. Therefore there is **no new
TI-03 schema2 evidence or artifact hash**, and posting/concurrency/negative
controls/isolation/five-cleanup-flag qualification cannot be claimed.
The Environment gate failed closed before database/test execution.

All further live writes/releases stopped on this concrete failure. Immutable
C3 was not edited.

## Exact retained partial state

| Control | Current value |
|---|---|
| `TR01_C3_APPROVED_WORKFLOW_SHA` | `65f3453c29f1eb1057bc66edc0cc7de508e87c2d` |
| `LEDGERLY_APPROVED_CANDIDATE_SHA` | `1c26be19295902a38e1939b56ff99ae9a195d3de` |
| Old `TR01_C2_APPROVED_WORKFLOW_SHA` | unchanged: `87a4ff7d44be9bc21296e9623db16924488f76ae` |
| Environment branch admissions | unchanged: exactly `main` + `tr01/implementation-identity-successor-c2` |
| C3 publication/status/protections | published once, identity success, frozen |

Custom branch policy, normal reviewer settings, no tag/wildcard admissions,
C/C2 exact refs and existing C2 status/freeze controls remain unchanged.
Qualification pin and branch admission currently disagree; do not treat the
package as qualified or silently resume/retry.

## Preserved record and unapplied correction

[Execution/failure readback JSON](ledgerly-tr01-c3-live-execution-result.json)
preserves source identities, stored/effective rules, identity run/jobs/status,
normal identity release, qualification run/jobs/check annotations, empty
artifact inventory, exact current controls and error details.
Its SHA-256:
`28b7728c7dcf6d1fffdd6f305ea9cb88d3eaaff9634bae1036e189c767f184a1`.
It is a control-stage failure record, **not fabricated qualification evidence**.

After a fresh instruction following this stop, the admission correction is:

```text
PUT repos/Future00111/ledgerpoint/environments/ledgerly-canonical/deployment-branch-policies/61652697
{"name":"tr01/implementation-identity-successor-c3"}
```

Retain branch type, main policy, custom mode and reviewer controls; verify
exact main+C3 admission and both source/candidate pins before any dispatch.
Any recovery command must explicitly fail closed on preflight errors.
No correction or new dispatch is authorised/performed by this stopped stage.
