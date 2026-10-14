# G6 single dispatch — stopped at human Environment review

## Outcome — 2026-10-14

**One approved dispatch consumed. Human Environment review pending.
G7 pending. No qualification result exists for G at this handoff.**

Actual run: [38621069723](https://github.com/Future00111/ledgerpoint/actions/runs/38621069723),
attempt **1**, event `workflow_dispatch`, source branch `main`, exact G
`706dc6a31f85733ba0c251f40b2c09f5a9312269`.
Actual job: [116048423733](https://github.com/Future00111/ledgerpoint/actions/runs/38621069723/job/116048423733),
`Disposable canonical PostgreSQL qualification`, workflow job key
`canonical-postgresql`. Run and job are **waiting**, conclusion null;
job steps are empty at the retained readback.

Pending Environment is exact `ledgerly-canonical`, ID `20664477675`,
required reviewer **Future00111**, user ID `318002590`.
The API says the authenticated user can approve; this is a capability,
**not agent authorization**, and was not exercised.
The owner must personally open the actual run, inspect G/C7/attempt/job,
then use normal **Review deployments → ledgerly-canonical → Approve and deploy**.
That GitHub label releases this development job, not a production deployment.
No API approval, UI click, bypass or automated release was performed.

## Approval and fresh preflight

See [the recorded owner approval](../ledgerly-tr01-c7-g6-owner-dispatch-approval.md).
Approval record commit: `ea73d7a04fac8738aa193965897b0391ea7a7c68`.
Owner quote **“i approve G6”** is attributed to the relay through Codex,
not a signature or independent-human review.
The original prepared package and historical approval/failure/fixture
records remain unchanged.

Fresh full read-only preflight:
**2026-10-14T19:07:06.578393Z–19:07:21.276811Z**, **49/49 passed**.
Exact G/A tree `bf7c91fac7fe09d8458a327dd79464ea1a3973ad`,
ordered G parents [B `0da401737f35d68b9404982baad7405fe997636a`,
A `ead19106aaad76d604e8595337b5ab2fddda68d0`], C7 ancestry,
ten permitted paths and all outside-B blobs/modes/absence reconfirmed.
Native policy pagination complete, zero bypass actors; G4 window,
merge-only settings, frozen refs/protections, pins, owner Environment gate
and exact main+C7 admission unchanged. Repository/Environment secret-name
counts zero; no secret values, production or Helium accessed.
No prior G workflow run or active conflicting canonical run was found.

Frozen C7 remains `787d76decfa345e3c1104231e08d5ab00bc90259`;
historical producer pin remains B. Workflow ID `343787048`, exact G path
`.github/workflows/ledgerly-canonical-postgresql.yml`, SHA-256
`ad06da35f4269fbbf46e1fd4ccabf6082d309963e39b577e17ac948c546afc20`.
This establishes intended C7 execution through the exact workflow/pin;
the waiting job has not checked out or qualified it yet.

## Exact action and readback

An exclusive, fsynced consumed marker was persisted **before** the
immediate main=G read and the sole POST. `action-decision.json` binds
approval, actual actor, source/control/native-policy/run preflight receipts
and their SHA-256 hashes. No retry code or alternate request was used.

POST `repos/Future00111/ledgerpoint/actions/workflows/343787048/dispatches`,
API version `2022-11-28`, exact body `{"ref":"main"}` plus one LF,
15 bytes, SHA-256
`455eddddcfdd09a482991d88045379bf46c72f839eb6640decc52657470b3f74`.

Request window:
**2026-10-14T19:07:56.806135Z–19:07:58.611191Z**.
Response **HTTP 204**, one request, exit 0.
GitHub request ID `D3EA:3F8732:3078308:486D4C7:6ACFD30D`.
Unique run created **2026-10-14T19:07:58Z**, within that window;
workflow ID/path, G/main, event, attempt, actor and triggering actor
Future00111/318002590 all match. Main readback remains exact G.
Immediate source checks are **not an atomic main-ref lease**.

## Retained records and limits

Tracked receipts: `docs/governance/drafts/ledgerly-tr01-c7-g6-dispatch/`.
Full raw controls, policy pages, source/tree, run inventory, scripts and
logs: `generated-artifacts/ledgerly-c7-g6-authorized-dispatch/`.
The readback verification file contains receipt SHA-256 hashes.
Separate local branch: `records-local/tr01-c7-g6-authorized-dispatch`.
No push. No other live write, source/control/closure change, merge, rerun,
cancellation, migration, production/Helium contact, deployment/publishing
or Phase A. No automatic polling through the human gate.

Historical C7 evidence and local source fixtures do not qualify G.
G3's six skips remain skips. After a personally authorized human release,
actual new schema2 artifact/source/run/image/accounting/concurrency/
18-negative-control/five-cleanup evidence must still be verified;
G7 result acceptance and closure remain separate. No follow-up started.
