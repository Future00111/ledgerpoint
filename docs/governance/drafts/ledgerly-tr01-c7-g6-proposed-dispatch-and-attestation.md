# G6 proposed one-shot dispatch and owner attestation

**PROPOSED ONLY. NOT EXECUTED. G6/G7 PENDING.**

## Exact request proposed for separate action-time authorization

```text
POST https://api.github.com/repos/Future00111/ledgerpoint/actions/workflows/343787048/dispatches
X-GitHub-Api-Version: 2022-11-28
Content-Type: application/json
```

Exact UTF-8 body, with one terminating LF:

```json
{"ref":"main"}
```

Exact payload: **15 bytes**, SHA-256
`455eddddcfdd09a482991d88045379bf46c72f839eb6640decc52657470b3f74`.
No inputs or alternative ref. These bytes are retained in the accompanying
`proposed-dispatch.json` and `dispatch-specification.json`. The workflow's
registered path is `.github/workflows/ledgerly-canonical-postgresql.yml`;
its numeric ID is bound to that path in the retained fresh metadata.
The proposed API request is not sent by this package.

Main must freshly equal G `706dc6a31f85733ba0c251f40b2c09f5a9312269`;
workflow digest must remain
`ad06da35f4269fbbf46e1fd4ccabf6082d309963e39b577e17ac948c546afc20`.
Candidate remains C7 `787d76decfa345e3c1104231e08d5ab00bc90259`.
Historical producer pin stays B `0da401737f35d68b9404982baad7405fe997636a`.

Before any approved request, repeat the complete source/control/credential/run
preflight and bind actor/receipt hashes to the decision. Current preparation
receipts are not a lasting authorization or proof that future controls match.
Create a single-use dispatch marker before the request. Any timeout/failure/
ambiguous response consumes that attempt: read back only to establish outcome;
no retry, rerun, alternate identity or automatic cancellation.

Current preparation receipt SHA-256 values (not substitutes for fresh
action-time receipts):

- Actor and full controls:
  `f63976017fd59c81d57dfe5b758860ad9882b2c2407b85b91006a2b97374b84e`.
- Complete native policy:
  `47cc031f957b26eee16a4eacb4741c06037348056e428550c2cd5f567a5232b0`.
- Actual G/C7 source-attribution fixture:
  `134b7070ab1fc784d3a2e53843bbd844896be0c1d1d9569ff53bd1b291fd50f8`.
- Remote G commit:
  `2eec4d266f228e961e57f5204fa20a61f04006c948ef4b7b64819964975fac13`.
- Complete remote G/A tree:
  `7f64e0a9eae8f102ee502408e614588fda5e00e06d49cf67850a9337411ebf0c`.

### Non-atomic main-ref race

GitHub resolves `ref=main` when processing dispatch. This endpoint/body has
**no expected-head compare-and-swap field**. An immediate main=G read and a
ban on unrelated main writes do not establish an atomic base/ref lease.
After dispatch, actual workflow/run source bindings must be G. If they differ
or cannot be uniquely established, stop; do not release the Environment,
rerun, substitute a SHA/ref or claim the wrong run as this approval.
Report the actual run URL promptly, without inventing it in advance.

## Expected observed run and evidence bindings

| Field | Required actual value |
| --- | --- |
| Workflow | ID `343787048`, exact registered path/name |
| Repository | `Future00111/ledgerpoint` |
| Event | `workflow_dispatch` |
| Source ref/head branch | `refs/heads/main` / `main` |
| Run head SHA / workflow source commit | exact G |
| Expected workflow ref | `Future00111/ledgerpoint/.github/workflows/ledgerly-canonical-postgresql.yml@refs/heads/main` |
| Run attempt | **1**; rerun forbidden |
| Initiator/triggering actor | `Future00111`, ID `318002590`, verified at action time/readback |
| Job | `canonical-postgresql` |
| Environment | `ledgerly-canonical`, required human-owner review |
| Mode | `activated` |
| Implementation source commit | exact frozen C7 |
| Workflow source SHA-256 | exact G workflow digest above |
| Implementation execution-tree SHA-256 | `fcd81d162cbfc406853bdd13c853cd49f81fd814622a7f90116724e668eb82d1` |
| Run ID, URL, job ID, artifact ID, UUID/nonce/database name | **UNKNOWN UNTIL ACTUAL RUN**; never reuse historical values |

Dispatch success is normally an HTTP 204 with no run ID. Bind the newly
created run uniquely using workflow ID, event, owner, timestamp window, G
and attempt 1, retaining full readback. A run not attributable to this one
authorized request is a hold, not grounds for another dispatch.

## Proposed owner pre-dispatch attestation wording

**Draft for owner review; the following is NOT an approval already given.**
The final package checksum, payload checksum, actor and fresh action-time
receipt hashes must be identified in the actual recorded decision:

> I approve G6 only for one manual workflow_dispatch of workflow 343787048
> in Future00111/ledgerpoint with the exact reviewed {"ref":"main"} payload,
> at exact main G 706dc6a31f85733ba0c251f40b2c09f5a9312269, using only frozen
> C7 787d76decfa345e3c1104231e08d5ab00bc90259 as the implementation.
> I identify the exact reviewed package/payload and fresh action-time
> source/control receipt hashes in this decision. I attest that actor,
> source/tree/ancestry, effective protections, pins, exact Environment
> admission/reviewer, credential exclusion, no prior consumed dispatch and
> no active conflict still match. I accept the G1 single-owner risks,
> the non-atomic main-ref dispatch race, absent new head CI and the six
> retained image-test skips. This is one development-only attempt, with no
> retry or alternate identity. Stop on failure, drift or ambiguity.
> This authorizes dispatch only, not automation of Environment release,
> G7 acceptance, closure, production, deployment or Phase A.

Do not record this draft in an approval ledger as the owner's words.
The existing “next task” preparation request does not satisfy this attestation.

## Actual HUMAN owner Environment release

After a separately authorized successful dispatch, return **the actual run URL**.
The human owner opens that run in GitHub Actions, inspects the exact workflow,
G/C7/attempt and job, opens **Review deployments**, selects
`ledgerly-canonical`, and uses the normal **Approve and deploy** review action
only if the attested values still match. This GitHub label releases the
development job; it is not authorization for a production deployment.

The release is a human owner action for that actual job/run, not an AI-supplied
approval or independent-human review. Same-owner review is permitted only by
the recorded exception and retained `prevent_self_review=false`.
Do not invoke administrator bypass, remove reviewers, synthesize approval through
an API, or claim the existing bypass capability was disabled.
If the normal review UI/path is unavailable or the source is wrong, hold.

No future run URL exists to provide now. No dispatch/release was performed.
G7 result acceptance and conditional closure remain separate.
