# C4 live sequence executed — qualification failed, no retry

Owner authorization relayed through Codex approved the exact staged sequence and one fresh development/disposable qualification. Future00111 performed normal owner review under the recorded solo-operator exception; this is not independent human approval.

## Completed GitHub changes

- Producer [PR #15](https://github.com/Future00111/ledgerpoint/pull/15) marked ready and merged normally without bypass into protected main `af028bb647fbbdb81509539969b21a859e708f34`. Merge parents and all three reviewed producer file hashes verified. Candidate PR #14 remains draft and unmerged.
- New exact C4 active immutable ruleset installed with zero bypass actors, restricted updates/deletion/force pushes, strict GitHub Actions app 15368 status context and create-only exemption. Stored and effective rules verified.
- Exact C4 `273f714c876260636346b7fbcc588224e9795141` published once at `refs/heads/tr01/implementation-identity-successor-c4`. Tree `168f81192d1fea635cd3c038e6be3a709ab11a82` and sole parent `9d50d4e86696fd18eb7f877c9edfaba710b3572e` verified.
- C4 producer Environment pin equals actual merged main; prior C2/C3 pins retained. [Identity run 37677319290 attempt 1](https://github.com/Future00111/ledgerpoint/actions/runs/37677319290) passed both jobs and posted the bot-issued `tr01/c4-identity-validation` status on exact C4. Status is identity/non-DB validation only.
- Environment candidate pin changed to exact C4 and only the C3 branch policy replaced with C4. Final readback admits exactly main+C4, zero tag/wildcard policies, unchanged normal owner reviewer settings. C/C2/C3 refs/protections and main protections unchanged.

## Fresh qualification result

[Run 37677799309 attempt 1](https://github.com/Future00111/ledgerpoint/actions/runs/37677799309) failed in phase `test`. Workflow and implementation source both equal exact protected C4, candidate mode, verified ancestry, both checkouts clean. Owner attestation was recorded before dispatch; normal owner release was used without bypass.

The runner reaches the real test command, then a nested `pnpm` process tries to resolve `pnpm/latest` at registry.npmjs.org inside the isolated container and fails with `EAI_AGAIN`. This is the observed blocker; canonical posting/concurrency success is not established. Follow-up review should reproduce the nested child toolchain environment and repair pinned offline resolution while preserving the network restrictions. Frozen C4 must not be edited. No schema or accounting change has been inferred from this failure.

The schema-v2 failed-evidence artifact passed exact C4 JSON Schema and contract validation. All five cleanup flags are true: logical drop, database absent, container removed, network removed, credential material removed. Isolation records parent DATABASE_URL/Replit variables absent, no published ports, internal network, no socket/external route, successful secret scan and no production/Helium contact. Failed evidence is not qualification success; it contains no passed posting/concurrency/negative-control result.

Archive SHA-256 `1581afdc2b5efaa9fbee78fdc39fbbd37dc8c2337b13643cb163266adf9d5cff` matches GitHub metadata and downloaded bytes. Evidence JSON SHA-256 `36be537831cce910ddfc5b4ca1b7d217c85fb8d00178322e9f4c9bf41c9beaae` matches the runner marker.

## Retained evidence and remaining work

- [Full live record and final controls readback](ledgerly-tr01-c4-live-execution.json)
- [Pre-dispatch owner attestation](ledgerly-tr01-c4-owner-attestation.json)
- [Failed schema-v2 evidence](ledgerly-tr01-c4-fresh-qualification-evidence.json)
- [Qualification log](ledgerly-tr01-c4-qualification-37677799309-1.log)
- [Verified artifact archive](ledgerly-tr01-c4-qualification-37677799309-1.zip)
- [Identity producer log](ledgerly-tr01-c4-identity-37677319290-1.log)

Execution stopped after failure; no rerun/retry, production or Helium access occurred. Future repair/successor preparation remains separate from any new live qualification authorization. C4 remains frozen and eligible in the development Environment, but unqualified.
