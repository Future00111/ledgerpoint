# Latest C5 outcome — binding replay verified; separate producer normally merged

This is the current execution outcome. The original
`ledgerly-tr01-c5-preparation-report.md`, `ledgerly-tr01-c5-next-actions.md` and
preparation manifest are preserved byte-for-byte as historical evidence of the
earlier local blocker. They no longer describe the current binding/merge state.

## Completed authorized work

1. Read and verified the preparation manifest, saved failure logs and next
   actions; freshly checked exact PR16/17/18 heads, bases, trees, parents and
   file hashes. No unsupported local bridge/shared-namespace retry occurred.
2. Published only an ordinary diagnostic branch,
   `review/tr01-c5-binding-diagnostic`, outside frozen C5/ancestor source.
   Its workflow has **contents:read only**, no Environment, deployment/status
   writer, secrets expressions or qualification dispatch. Exact C5 is checked
   out separately with no persisted GitHub checkout credentials.
3. Replayed the **unchanged six-case regression** on supported GitHub Actions
   using the existing internal network, non-root/read-only/no-new-privileges
   test client and synthetic ephemeral PostgreSQL 16.15.
4. Completed scoped automated technical review under the existing
   solo-operator owner exception. No merge-blocking defect was identified;
   there is **no independent-human approval claim**.
5. Freshly verified the separate producer and applicable main checks; marked
   only PR18 ready and merged it normally using the exact-head guard.
   No `--admin`, bypass, control relaxation or repair/inspection merge.

## Diagnostic runs and preserved evidence

### First diagnostic — cache preparation prerequisite missing

[Run 38262785180 attempt 1](https://github.com/Future00111/ledgerpoint/actions/runs/38262785180),
workflow source `7e8f709536fb2077df20d7407cbceeea2215d550`, verified exact C5
source/image, then failed before binding cases started. Exact C5's fixture uses
`--pull=never`; the fresh runner did not have the digest-pinned PostgreSQL image.
Docker returned 125. This was a diagnostic image-preparation omission, not a
database identity, schema or accounting failure. Cleanup completed.

Raw artifact SHA-256:
`d5fda320268646e36cdeb76883652a004e1c2f61f7e2525017504afb804a0fe1`.

The diagnostic wrapper alone was corrected to pull and verify the exact
PostgreSQL digest **before isolation**. No C5 file, runtime identity verifier,
private test networking or privilege setting changed.

### Successful binding diagnostic

[Run 38263226226 attempt 1](https://github.com/Future00111/ledgerpoint/actions/runs/38263226226),
workflow source `905337ccb9aaa89faa3b257e6b3e5695d13be393`, passed all six:

- Source digest parity: runtime orchestrator is not coordinator.
- Valid private binding passes actual PostgreSQL verifier.
- Forged run UUID rejected by private database binding.
- Old C4 identity rejected by private database binding.
- Forged nonce rejected by private database binding.
- Actual runner forged probe reaches intended rejection, not digest failure.

Verified exact checkout:
- Commit `3a5c6e1318b49edcdc7f0f918d3a01813f960e71`.
- Tree `3f2e22ccceb70ea50034b41af352a125b63cf127`.
- Sole parent `6e8255949c3da130561f781614785f692796b621`.
- Scoped source SHA-256 `5aa9e0137d6ad01b9643efe45372426f9e16eff14ed3386547aca8d0f0804f88`.
- Every scoped source blob rehashed against the exact local Git object.
- Image/source byte verification under network-none, read-only, UID 1000,
  no capabilities and no-new-privileges.
- Image ID `sha256:a6acd34e400010f39eb2581ae7e24843ff5c92c6b322d964dbeedc8f6901ad49`.
- PostgreSQL digest
  `sha256:bb3e1a57e5407e0a5280b4211980a5e537f4abd234a87014ac979849a78dd825`.
- Raw artifact SHA-256
  `8fff04ad61512f5db2ce55d463b626069f7732692c4909f36365745739e8608b`,
  independently matched to GitHub's immutable artifact digest.
- All reported raw log hashes independently verified.

The original fixture's four cleanup flags passed. Separate readback verified
no residual fixture containers/networks/derived images; all six final
diagnostic cleanup checks passed (containers, networks, derived images,
temporary fixtures/credentials, review image, prepared PostgreSQL image).

Raw archives, logs and result JSONs are preserved in:
- `ledgerly-tr01-c5/authorized-binding-run-38262785180/`.
- `ledgerly-tr01-c5/authorized-binding-run-38263226226/`.

This is **diagnostic binding replay**, not protected identity validation and
not full canonical posting/concurrency/negative-control/isolation
qualification. Synthetic review provenance cannot mint trusted qualification
evidence. Neither diagnostic ran production/Helium or canonical posting tests.

## Review and actual producer merge

- [Repair PR16](https://github.com/Future00111/ledgerpoint/pull/16):
  `6e8255949c3da130561f781614785f692796b621`, still draft/unmerged.
- [Inspection PR17](https://github.com/Future00111/ledgerpoint/pull/17):
  `3a5c6e1318b49edcdc7f0f918d3a01813f960e71`, still draft/unmerged.
- [Producer PR18](https://github.com/Future00111/ledgerpoint/pull/18):
  head `4f0fbd7a4ff75fbc4fadd57bc7ab2a7a38dc7f0b`, reviewed against exact base
  `af028bb647fbbdb81509539969b21a859e708f34`, normally merged.

Applicable check runs/statuses were empty and no required status/review gates
were configured. Admin enforcement and force-push/deletion restrictions
remained active; they were not removed or bypassed. Existing candidate and
producer typechecks, identity/acceptance checks and 27 producer tests were
already passed on unchanged source; they were not unnecessarily rerun.

**Actual M5:** `82e122115b99a6c206b5bd07743331398cae6bbe`.

Readback confirms main points to M5, merge tree is
`fc88f3e99bc78d39f808a86fd1412c883bdb6e74` (exact reviewed producer tree), and
merge parents are exactly:

1. `af028bb647fbbdb81509539969b21a859e708f34`.
2. `4f0fbd7a4ff75fbc4fadd57bc7ab2a7a38dc7f0b`.

Audit records are `authorized-automated-pr-review.md`,
`producer-normal-merge-preflight.json` and `authorized-merge-readback.json`
under `ledgerly-tr01-c5/`. Review comments were recorded on all three PRs.

## Read-only live preflight and stopping point

Before/after snapshots verify unchanged C/C2/C3/C4 refs and effective rules,
rulesets, main protection, Environment reviewer/custom branch policy,
candidate/workflow pins and zero CI repository/Environment secret names.
The **only intended main change** is the authorized producer merge.

Current admission remains exactly:
- Policy `61652671`: `main`, branch.
- Policy `61652697`: `tr01/implementation-identity-successor-c4`, branch.

Candidate pin remains exact frozen C4; C2/C3/C4 approved source pins are
unchanged; `TR01_C5_APPROVED_WORKFLOW_SHA` is not set. No immutable C5 ref exists.
No protection/publication, Environment pin/admission change, owner release,
hosted identity dispatch, canonical qualification dispatch, C4 retry,
production/Helium access or Phase A occurred.

**Paused for Codex's action-time confirmation on the exact next live values.**
See [current live next actions](ledgerly-tr01-c5-live-next-actions.md).
