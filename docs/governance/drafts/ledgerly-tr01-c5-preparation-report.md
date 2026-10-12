# C5 offline child-toolchain repair — draft preparation, binding replay blocked

## Outcome

The byte-exact C4 failure is reproduced and the smallest production repair is
implemented. C5 is prepared on an ordinary review branch, with a separate
protected-main producer draft. Local toolchain checks pass. **Disposable database
binding replay remains blocked by this local container runtime.** No binding or
full qualification success is claimed, and no live C5 step is ready to execute
until that blocker is resolved without relaxing isolation.

Draft review:
- [Repair PR 16](https://github.com/Future00111/ledgerpoint/pull/16).
- [C5 inspection PR 17](https://github.com/Future00111/ledgerpoint/pull/17).
- [Separate producer PR 18](https://github.com/Future00111/ledgerpoint/pull/18).

Repair/candidate PRs target frozen C4 for inspection only. **Never merge into
C4.** Producer targets main but remains draft and unmerged.

## Exact source identities

| Object | Commit | Git tree | Sole parent |
|---|---|---|---|
| Frozen C4 | `273f714c876260636346b7fbcc588224e9795141` | `168f81192d1fea635cd3c038e6be3a709ab11a82` | `9d50d4e86696fd18eb7f877c9edfaba710b3572e` |
| Repair | `6e8255949c3da130561f781614785f692796b621` | `16effb7c9d69f5f964300664fecb356ab20a4846` | `273f714c876260636346b7fbcc588224e9795141` |
| Prepared C5 | `3a5c6e1318b49edcdc7f0f918d3a01813f960e71` | `3f2e22ccceb70ea50034b41af352a125b63cf127` | `6e8255949c3da130561f781614785f692796b621` |
| Separate producer | `4f0fbd7a4ff75fbc4fadd57bc7ab2a7a38dc7f0b` | `fc88f3e99bc78d39f808a86fd1412c883bdb6e74` | `af028bb647fbbdb81509539969b21a859e708f34` |

## Root cause and reproduction

Qualification [37677799309 attempt 1](https://github.com/Future00111/ledgerpoint/actions/runs/37677799309)
failed when the external runner constructed its sanitized child environment.
The image correctly prepared pnpm `10.26.1` under `/opt/corepack` and disabled
latest resolution, auto-pinning and network access, but the allowlist omitted
all four Corepack settings. The nested pnpm process therefore did not use that
prepared cache/policy and attempted `registry.npmjs.org/pnpm/latest`.

This is an orchestration/toolchain environment propagation defect, **not
evidence of an accounting or database-schema defect**. The previous smoke
checks exercised top-level pnpm under the image environment, not the runner's
actual sanitized child. That was the coverage gap.

The reproduction used the existing exact-C4 image. Its runtime file SHA-256,
`7cebf815c526ae282c91d54ca3ad3e5364c5dbab3648b85d1f1109c0a0da7871`,
matches the frozen Git blob. The new review fixture extracts the actual
external allowlist and calls the actual runtime process executor with the real
canonical esbuild invocation. It reproduces the same pnpm/latest failure under
UID 1000, network none, read-only root, no capabilities and no-new-privileges.
Only synthetic environment markers/connection strings are supplied; no
database is accessed by this fixture.

## Smallest production change

Only the external child allowlist gains:

```text
COREPACK_HOME=/opt/corepack
COREPACK_DEFAULT_TO_LATEST=0
COREPACK_ENABLE_AUTO_PIN=0
COREPACK_ENABLE_NETWORK=0
```

These are fixed values, not inherited arbitrary parent variables. PATH and the
existing explicit synthetic/test database bindings remain as before. No
package, lockfile, image security setting, credential exclusion, database
identity verifier, posting implementation, cleanup control or network policy
is relaxed.

The repair changes three files:
- `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs`.
- `scripts/ci/ledgerly-offline-pnpm.test.mjs`.
- New `scripts/ci/ledgerly-nested-offline-review.mjs`.

C5 additionally changes the candidate ref consistently in the qualification
workflow, coordinator/runtime, private run-control SQL and schema-2 evidence
contract. Existing identity/acceptance and binding tests are updated to the C5
ref and reject old C4; older rejection coverage remains. The producer contains
only three new C5 workflow/status/test files. Exact per-file hashes, changes,
parents and trees are in [the identity record](ledgerly-tr01-c5-preparation-identity.json).

## Verification and limitations

| Check | Result |
|---|---|
| Byte-exact C4 actual sanitized nested compilation | Expected pnpm/latest rejection reproduced; temporary fixture cleaned |
| Repair-image offline suite | 6/6 passed, no skips |
| Exact C5 production Dockerfile build | Passed; image `sha256:c2bed5e9ede13b01f24c8125ef8a239c3f538aced7ebd2592e3054aed716d2a8` |
| C5 offline suite, actual real-source compile and nested pnpm/Node invocation | 6/6 passed, no skips |
| Empty writable actual cache | Rejected specifically by Corepack network-disabled policy, without latest lookup |
| Empty read-only actual cache | Rejected locally before any package-manager fallback |
| Existing identity/acceptance suite plus C4 aliases/pin/coherent evidence rejection | Passed |
| Candidate library and workspace typechecks | Passed |
| Producer library and workspace typechecks | Passed |
| Separate producer tests including C3 and C4 rejection | 27/27 passed, no skips |
| Disposable PostgreSQL binding regression | **BLOCKED**, not passed |
| Full canonical posting/concurrency/negative-control/isolation qualification | **Not run** |

The PostgreSQL 16.15 synthetic fixture starts locally and reports ready, but
the non-root test client remains in TCP SYN-SENT to the private internal bridge
endpoint. It never reaches database verification. The alternative kept the
internal disposable PostgreSQL network namespace, no host ports/binds/socket,
read-only/non-root/no-new-privileges; the runtime denied creation with
`open /proc/.../ns/mnt: permission denied`. This diagnostic adapter is not part
of the candidate, image or qualification. Do not infer a schema or identity
failure from either infrastructure error.

Failure logs are preserved. After each attempt the fixture's cleanup reports
container, network, derived image and fixture deletion. A separate Docker and
filesystem readback confirms no `ledgerly-binding-review*` containers,
networks, images or temporary credential/fixture directories remain. No
production or Helium connection was used.

Logs, raw binary diffs, format-patches and their SHA-256 hashes are saved under
[`ledgerly-tr01-c5/`](ledgerly-tr01-c5/); see the identity record for the manifest.
The build-only source fixture deliberately cannot qualify as trusted evidence.

## Preserved live state

Read-only before/after comparisons verify unchanged protected main
`af028bb647fbbdb81509539969b21a859e708f34`, frozen C/C2/C3/C4 refs and effective
rules, rulesets, main protection, exact Environment admission/reviewer/pins and
zero repository/Environment CI secret names. Qualification remains pinned to
C4, and C4's approved producer source remains M4. Existing owner exception
remains; there is **no independent-human-review claim**.

Only ordinary repair/review branches and draft PRs were published. No merge,
immutable C5 ref publication, live source pin/admission/protection mutation,
Environment release, hosted dispatch, C4 retry, production/Helium access or
Phase A occurred.

Next actions are separately gated in
[the C5 next-actions record](ledgerly-tr01-c5-next-actions.md).
