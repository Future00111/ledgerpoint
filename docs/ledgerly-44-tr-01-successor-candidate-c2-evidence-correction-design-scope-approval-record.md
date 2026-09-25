# TR-01 C2 evidence correction — design and scope approval record

**Date:** 2026-09-25
**Source:** `attached_assets/Pasted-TR-01-SUCCESSOR-CANDIDATE-C2-EVIDENCE-CORRECTION-DESIGN_1790349096928.txt`
**Reviewed design:** `docs/ledgerly-44-tr-01-successor-candidate-evidence-acceptance-correction-proposal.md`
**Status:** EXACT SIX-FILE DESIGN / SCOPE AND LITERAL C2 REF NAME APPROVED;
FRESH INDEPENDENT PACKAGE REVIEW PASSED; IMPLEMENTATION AND ALL EXECUTION
SEPARATELY GATED

The owner approved the design and exact six-file scope after the proposal
received an independent read-only architecture/security **PASS on the
proposal only**. This approval is non-executable. It does not approve an
implementation package, create C2, authorize a GitHub change, dispatch
qualification, run Phase A, or contact production or HeliumDB.

`C=d292f3a64c6253e022b40de8cf055f3e722ff1ea` remains an **immutable,
unqualified, non-authoritative predecessor**. Its commit and protected
`refs/heads/tr01/implementation-identity-candidate` must not be amended,
rebased, squashed, moved, repointed, replaced, deleted, or force-pushed. No
validation status is inferred for C.

## Approved correction inventory — exactly six files

| Path | Purpose / why required | Evidence / qualification impact | Accounting-runtime impact |
| --- | --- | --- | --- |
| `docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json` | Require exactly the ten approved digest keys for passed v2 evidence; reject absent, partial, malformed or extra entries; recognize the exact successor candidate ref. Existing binding schema permits missing/empty maps and only the old ref. | Fail-closed evidence shape and C2 identity. | None. |
| `scripts/ci/run-ledgerly-canonical-postgresql.mjs` | Verify every passed-evidence digest and the source-tree digest against independently calculated, identity-bound S/C2 checkout inputs; align candidate-ref guards. Current acceptance does not compare domains or digests. | Wrong-domain or untrusted evidence cannot pass acceptance. | None; CI-only acceptance/preflight. |
| `scripts/ci/run-ledgerly-canonical-postgresql.test.mjs` | Exercise the actual passed-evidence acceptance path and exhaustive digest-domain/legacy negative probes, plus valid v2 cases and C2 ref fixtures. Existing coverage is insufficient. | Fresh proof of rejection and valid acceptance. | None; tests only. |
| `.github/workflows/ledgerly-canonical-postgresql.yml` | Replace the old candidate-mode exact-ref allowance with the new exact C2 candidate ref while preserving protected manual dispatch and activated-main separation. The old workflow will not authorize a new ref. | C2 candidate workflow path can be gated without moving C. | None; CI workflow only. |
| `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs` | Align the disposable runner's candidate-ref identity checks with C2. No producer defect has been established; do not change its digest calculation. | C2 private-run identity remains checkable. | None; disposable test runner only. |
| `scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql` | Align exact candidate/ref and workflow-ref checks in disposable run-control SQL; otherwise it rejects C2. | Fresh disposable runs can bind exactly C2, not arbitrary refs. | None; no production or application SQL change. |

No seventh executable or contract file is approved. In particular, no
accounting posting code, security overlay, production schema, package
lockfile, Dockerfile, or workflow image construction is in scope. The two
governance documents recording this approval and its future implementation
package are **not** C2 implementation files. If a seventh implementation
file or a substantive accounting-runtime change becomes necessary, stop
for a new design/scope decision; do not infer permission from this record.

## Approved prospective identity and evidence model

The attached source approved the separate exact candidate-ref strategy
but did not literally name a ref. After the first independent package
review identified this gap, the owner **explicitly approved** the
proposal's exact literal `refs/heads/tr01/implementation-identity-successor-c2`
in a separate answer on 2026-09-25. This resolves the name decision;
it does not create, publish, or protect any ref, and does not approve
implementation or live configuration. C2's SHA will be determined only
after independently reviewed implementation on a normal descendant of
C. Do not derive C2
from a history-clean audit snapshot, substitute a tag, use a wildcard ref,
or move C's ref. Candidate execution requires protected S=C2; activated
execution retains the later protected-main S and C2 ancestry model without
changing A/B/G governance or granting activation.

Accepted passed schema-v2 evidence must include the exact ten-key
`binding.sourceDigests` map, reject legacy or mixed-v1/v2 identities, and
verify `workflow` against the authenticated workflow-source checkout S.
`sourceTree` and all other implementation digest keys must be checked
against the authenticated implementation checkout C2. The independent
expected digests must not be copied from or aliased to submitted evidence.
`binding.sourceTreeSha256` must equal the verified implementation-tree
digest. A candidate's S and C2 can have identical commit IDs and bytes;
role/path/root-bound checks, plus activated-mode distinct-S/C2 probes,
are required rather than a false claim that a hash reveals physical read
origin. Valid v2 candidate and activated evidence must still pass.
Early failed/preflight evidence may remain representable without claiming
passed qualification.

The reviewed finding is **producer defect not established; accounting-runtime
defect not established**. This design approval does not license changing
the producer, accounting posting, financial ledgers, privileges, or
production/HeliumDB dataflow. Frozen accounting controls remain frozen.

## Gates retained

Fresh frozen-install, syntax, TypeScript, focused and security tests,
schema-v2 and wrong-domain acceptance probes, source-manifest and ref
parity checks, inventory reconciliation, and independent implementation/
security review must precede C2 creation. Exact committed C2 requires
independent verification against the reviewed tree. Separate authorizations
are required for implementation, GitHub publication/protection, Environment
SHA/ref changes, owner pre-dispatch attestation, and disposable PostgreSQL
qualification. Required GitHub validation status is not waived or
manufactured for C; it must be created and enforced for exact C2 only when
the corrected protected workflow path is ready.

The previous development-only solo-operator exceptions were approved for
exact C; this design record **does not silently transfer their live
configuration authority or owner attestation to C2**. Extending/restating
that governance for exact C2 requires explicit later approval before live
configuration or dispatch. Production, HeliumDB, activated-main approval,
and Phase A remain outside this approval.

## Fresh independent package-review result

The first review **FAILED — exact literal C2 ref not explicitly approved.** The reviewer
confirmed the six-file technical design, no accounting-runtime expansion,
C preservation, digest-domain requirements, validation plan and later
operational gates, but found that the source attachment approved a
strategy rather than the proposal's placeholder string. The subsequent
explicit owner answer above resolves **only that finding**, subject to
fresh independent read-only review of the reconciled package.

That fresh independent read-only re-review **PASSED**: exactly six
implementation files, no accounting-runtime expansion, immutable C,
prospective normally-descended C2 on the expressly approved literal
ref, mandatory independently verified S/C2 digest provenance and
rejection probes, valid v2 acceptance, and complete future validation
requirements. It found no remaining design blocker. This is a
document/package verdict, **not** an implementation or exact-C2
review. No code change, GitHub configuration, qualification,
production/HeliumDB contact or Phase A is authorized by it.