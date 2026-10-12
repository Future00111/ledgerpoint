## Superseding C7 status — 2026-10-12

This C5 pending-action snapshot is historical and must not be replayed.
Exact C7 qualification passed; the selective integration was committed and
backed up. See [current next actions](ledgerly-tr01-c7-next-actions.md) and
[acceptance proposal](ledgerly-tr01-c7-final-acceptance-proposal.md).
The current instruction covers preparation only, not final identity approval,
activation, control changes, another qualification or Phase A.

# Current C5 next actions — binding passed, producer M5 recorded; live changes paused

Authoritative completed outcome:
[authorized execution report](ledgerly-tr01-c5-authorized-execution-report.md).
The earlier preparation next-actions record is historical.

Prerequisites completed: six-case isolated binding replay, exact review,
clean applicable checks, normal separate-producer merge and actual readback.
These are **not** full qualification success. No independent-human claim.

## Exact ready-to-confirm identities and values

- C5 commit: `3a5c6e1318b49edcdc7f0f918d3a01813f960e71`.
- Tree: `3f2e22ccceb70ea50034b41af352a125b63cf127`.
- Sole parent: `6e8255949c3da130561f781614785f692796b621`.
- Actual merged validation source **M5**:
  `82e122115b99a6c206b5bd07743331398cae6bbe`.
- Proposed Environment source variable:
  `TR01_C5_APPROVED_WORKFLOW_SHA=82e122115b99a6c206b5bd07743331398cae6bbe`.
- Proposed immutable branch:
  `refs/heads/tr01/implementation-identity-successor-c5` at exact C5.
- Prepared rules:
  [ledgerly-tr01-c5-ruleset-proposed.json](ledgerly-tr01-c5-ruleset-proposed.json):
  active, exact-only ref, empty bypass, update/deletion/non-fast-forward
  blocks, strict required status `tr01/c5-identity-validation` from GitHub
  Actions app `15368`, initial-create exemption.

**Stop before setting that source pin or applying any security-sensitive
protection/publication/access change. Codex must obtain action-time confirmation
on these concrete values. No such change is already made.**

## Later dependency order, after applicable confirmation

1. Freshly reverify M5/source bytes, exact C5/tree/sole parent, all frozen
   ancestors/current controls and credential exclusion. Preserve every old
   source pin and protection. Apply only the separately confirmed C5 source
   pin and prepared protection, then publish exact immutable C5 once.
   Read back effective rules and immutable identity; no edits/retries.
2. Dispatch `ledgerly-tr01-c5-identity-status.yml` **once from exact M5**.
   Use normal owner Environment review under the existing exception, no
   admin bypass or independent-human approval claim. Verify run source,
   exact candidate, successful validation and GitHub Actions app `15368`
   status on exact C5/context `tr01/c5-identity-validation`.
3. Only after identity/status success and the applicable action-time approval,
   proposed candidate variable:
   `LEDGERLY_APPROVED_CANDIDATE_SHA=3a5c6e1318b49edcdc7f0f918d3a01813f960e71`.
   Name-only replace policy **61652697** from
   `tr01/implementation-identity-successor-c4` to
   `tr01/implementation-identity-successor-c5`.
   Preserve policy **61652671** `main`, both policy types `branch`, custom
   policy, reviewer/no-bypass settings, and no tags/wildcards. Read back
   exactly main+C5 and the exact candidate pin.
4. Fresh no-production/no-Helium credential and isolation preflight.
   Only after the preceding gates and specific execution authorization:
   dispatch **one fresh exact-C5 development/disposable canonical
   qualification**, with normal owner review. Verify schema-2 artifact
   digest/source/image/run bindings, posting, concurrency, negative controls,
   isolation and all five qualification cleanup flags.

On any mismatch/failure preserve evidence and stop dependent work. Do not
retry C4, weaken controls, broaden networking/privileges/secrets, merge
repair/inspection into frozen C4, or enter Phase A.

The confirmed read-only baseline is in
`ledgerly-tr01-c5/authorized-controls-after.json`; actual merge readback is in
`ledgerly-tr01-c5/authorized-merge-readback.json`.
