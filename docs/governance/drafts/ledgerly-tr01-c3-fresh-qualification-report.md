# Fresh C3 qualification — bootstrap failure, evidence verified; stopped

**Reporting correction from repair diagnosis:** the original saved JSON
reports `testContainerNoSocket=true` and `testContainerNoExternalRoute=true`.
The statements below that those flags were false were a reporting error,
not the artifact's contents. The original evidence bytes/hashes are unchanged.
Qualification remains failed; no canonical posting acceptance is inferred.

## Approved correction and guarded dispatch

Owner approved the name-only update of policy **61652697**, complete preflight,
one fresh qualification and normal owner review, with stop on any error.

The name-only PUT succeeded:
`{"name":"tr01/implementation-identity-successor-c3"}`.
Readback confirmed exactly two branch admissions: **main + C3**, no tags or
wildcards. Candidate pin is exact C3; merged-main source pin and the old C2
workflow pin remain correct. Custom policy and reviewer settings unchanged.

All preflight checks passed before dispatch: exact M/C3 SHA/tree/sole parent,
successful identity validation/bot status, frozen effective C3 rules,
retained C/C2 controls, no repository/Environment credentials and no competing
active run. The operation batch was fail-fast and dispatch was inside the
checked process, not a separately sequenced shell command.

- M: `65f3453c29f1eb1057bc66edc0cc7de508e87c2d`.
- C3: `1c26be19295902a38e1939b56ff99ae9a195d3de`.
- [Fresh qualification run 37655209030](https://github.com/Future00111/ledgerpoint/actions/runs/37655209030),
  attempt **1**; **one dispatch under this approval**, not a retry of the prior
  admission-blocked run.
- Normal owner pending-deployment release completed; no admin bypass or
  independent-human-review claim.

## Failure

The runner failed in **bootstrap**:

> forgedRunDatabaseMismatch runner probe did not reject

Logs also contain a preceding Drizzle PostgreSQL SQLSTATE **42830**
foreign-key uniqueness error. That is an additional observation, not a
proven root-cause diagnosis. No correction, immutable edit or rerun was made.
The bootstrap negative binding control did not demonstrate its required
rejection. Canonical posting/concurrency acceptance was not reached.

## Preserved and verified evidence

- [Schema2 failure JSON](../evidence/ledgerly-44-ti-03-failed-37655209030-1.json)
  SHA-256:
  `f1988848362c53a678691838b5c2008b0f8620420811e19ee64b064e6c3ec8fb`.
- [Artifact ZIP](ledgerly-tr01-c3-qualification-37655209030-1.zip),
  artifact **11498600750**, name `ledgerly-ti-03-37655209030-1`, SHA-256:
  `4cd4f8822e88e740e7b5772eb20f289bc053a820ea675348b73c8e9537ff6300`.
- [Run log](ledgerly-tr01-c3-qualification-37655209030-1.log), SHA-256:
  `23337576671fa68aeb6f7df7d723bb71bdc3f0f624ffe146266ac986563b3117`.
- [Verification/result readback](ledgerly-tr01-c3-fresh-qualification-result.json).
- [Successful complete preflight](ledgerly-tr01-c3-fresh-qualification-preflight.json).

Verification:

1. Downloaded ZIP hash matches GitHub artifact metadata and upload log.
2. Failure JSON hash matches its emitted log marker.
3. Uploaded schema bytes match immutable C3's schema. Actual C3 coordinator
   bytes were checked against Git and its real schema2 failure-contract
   validator accepted the failure document.
4. Run/attempt/repository/workflow/ref/identity mode and both source commits
   match this exact protected C3 dispatch. Node/PostgreSQL image pins match
   the reviewed immutable values.
5. All **five cleanup flags report true**: logical drop, database absent,
   container removed, network removed, credential material removed.
6. Evidence reports parent DB URL/Replit variables absent, no published
   ports, internal network, secret scan passed, and no production/Helium
   contact. **Test-container socket and external-route flags are false**:
   those acceptance probes were not proven. Do not claim full isolation.

The failed document lacks the passed-evidence source-digest/private-binding
and posting/concurrency/negative-control results. It is valid **failure
evidence**, not qualification success.

## Retained state and stop boundary

Final readback retains exactly main+C3 admission and the C3 candidate pin;
main M, reviewer/custom policy, C/C2 exact refs and full stored protections,
old C2 workflow pin and frozen C3 protection remain unchanged from preflight.
There is no pending release.

Stopped after the one fresh failure. No retry, further dispatch, immutable
edit, protection bypass or isolation relaxation. Development/disposable
scope and existing owner exception retained; no qualification acceptance,
production access or independent-human-review claim.
