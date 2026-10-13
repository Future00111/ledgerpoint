# Exact C7 development designation and G3 activation preparation

**2026-10-13 — G1/G2 owner-approved; G3 preparation complete. G4–G7 PENDING.**
AI preparation/verification, not independent-human review or A/B acceptance.

## Backup and owner designation

Normally backed up `proposal-local/tr01-c7-single-owner-exception`; Git remote
and authenticated GitHub readback confirm exact
`68180fa598a5042df8111ea6c30e142d49176c86`.
No force push, other-ref push or main/frozen update was used.

G2 is recorded in
`docs/governance/ledgerly-tr01-c7-development-designation-approval.md`,
local record commit `c18f2e10a3606b5d5624372973ba3845dc0d00fa`.
The owner designates exact C7 as the **NEW AUTHORITATIVE IMPLEMENTATION
IDENTITY**, **development only** under the approved G1 exception.
Rechecked G1 exact revision/approval, C7 tree/parent, existing run/attempt/
success, artifact/evidence/schema bytes and strict schema-v2 acceptance,
18 negative controls, five cleanup flags and reconciled log archive hashes.
No new qualification or database work occurred.

## Exact activation preparation identities

- Draft PR: https://github.com/Future00111/ledgerpoint/pull/26
- Ordinary review branch: `activation/tr01-c7-development`.
- A / verified remote head: `ead19106aaad76d604e8595337b5ab2fddda68d0`.
- A tree: `bf7c91fac7fe09d8458a327dd79464ea1a3973ad`.
- A first parent / exact reviewed B:
  `0da401737f35d68b9404982baad7405fe997636a`.
- A second parent / exact C7:
  `787d76decfa345e3c1104231e08d5ab00bc90259`.
- C7 tree: `aa0360267a0d1987626ae9650238d66f04f667b9`;
  sole parent `c795945c4a5d4815804a86b9d5f2bdc77573d38f`.
- A workflow SHA-256:
  `ad06da35f4269fbbf46e1fd4ccabf6082d309963e39b577e17ac948c546afc20`.
- C7 564-file execution-domain SHA-256:
  `fcd81d162cbfc406853bdd13c853cd49f81fd814622a7f90116724e668eb82d1`.

A was prepared in a separate worktree as a normal local merge of C7 from B.
The deliberate merge resolution restores B everywhere outside the approved
inventory; it does not import the divergent C7/integration runtime tree.
This local ancestry preparation is not the separately gated protected-main
merge G. **No G exists from this preparation.**

Exactly the ten allowed paths differ: the canonical workflow plus the nine
governance documents listed in the activation proposal. All other Git blobs,
modes and path absences equal B. The nine documents were absent from B and
retain the workspace historical baselines with explicit bounded G1/G2/G3
addenda; historical reviews are not asserted to be fresh human approvals.
No TypeScript, application/runtime, SQL, schema, package or lockfile changed.
Workflow equals the reviewed prototype except for its terminating LF.

## Preparation validation results

| Check | Result and limits |
| --- | --- |
| Full tree/inventory and parent/ancestry comparison | PASS; B and C7 are ancestors; exactly ten changed paths; all other B entries/absences identical |
| YAML parse and safety assertions | PASS; unique keys, manual/protected-main guards, pinned actions, separate exact checkouts, no persisted credentials, frozen install, activated invocation and candidate-only always-run upload |
| Actual isolated host installation | PASS; pnpm 10.26.1, frozen lockfile, ignore scripts, root workspace filter; no tracked source changes |
| Actual C7 module dependency resolution | PASS; without candidate node_modules, module resolves AJV 8.20.0 from A host install and imports without running qualification |
| Actual A/C7 source-context fixture | PASS; positive context, nine non-workflow digests equal qualified C7, correct A workflow digest; five negative source/ref/ancestry cases rejected |
| C7 external binding regression | PASS; no database work |
| C7 schema convergence regression | PASS; mocked calls, no schema push |
| C7 identity/acceptance suite | PASS; fixtures test acceptance/rejection and source separation, not actual GitHub authorization |
| B-exact producer contract | 28 cases passed, plus the previously optional actual-C7 case passed in a targeted run; 29 covered, no failures |
| C7 offline policy suite | Static policy case passed; six image-dependent cases skipped because no image was supplied; no image build/container test claimed |

Host validation ran locally on NixOS with Node 24.13.0, not hosted Ubuntu
24.04. Corepack shims/cache used an isolated writable directory rather than
changing the immutable/global Nix toolchain. The exact pinned prepare/install
steps and candidate AJV fallback were executed there.

The minimal host installation intentionally lacks API `pg`. For the broader
acceptance harness, existing API dependencies were linked only after verifying
the API manifest and lockfile byte-exact against C7. This test-only link was
not added to A or required by the prepared hosted workflow. The producer test
belongs to B/A, not C7; it was run from its proper source.

Preserved initial review-harness setup failures: absent API dependency, wrong
producer-test source and local Git index-scrutiny permission. Corrected only
the harness dependency/source/command-local index permission, not frozen code
or GitHub controls. Those are not failed qualification runs.
The local context fixture simulates CI metadata and reports itself explicitly
as not qualification evidence. No synthetic passing TI-03 artifact was emitted.

## Evidence retention and remaining gates

Per-file Git blob/mode/SHA-256, identities and check receipts:
`ledgerly-tr01-c7-activation-preparation/validation.json`.
Full B/A patch, host install and fixture/unit logs:
`generated-artifacts/ledgerly-pr25-ai-review/g3-*` and the copied host logs there.
Historical failure logs remain retained, not silently replaced.

Fresh main=B readbacks were required before preparation, publication and draft
PR creation. Draft PR readback confirms exact A/B and draft/open state.
Main, all frozen refs, Environment, rulesets and main protection compare
unchanged across publication. Local workspace runtime/history is preserved;
the review worktree is separate, A is pinned by its local and remote branch.

G4 must separately approve exact live configuration/restoration values and
verify effective readback. G5 must accept exact A/B and reviewed merge tree
before any ordinary main merge, rechecking main=B. G6 must separately
authorize one exact-G activated development dispatch and normal owner release
after all preflights. G7 must accept the new result/cleanup separately.
The owner exception and development designation do not approve these actions.

The existing candidate qualification remains exact-C7 only. This report is
not activated qualification, production assurance or Phase A permission.
No controls/pins/admission/reviewer changes, protected-main merge, qualification
dispatch, migration, production/Helium access or deployment occurred.
