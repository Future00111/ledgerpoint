# Exact C7 — G2 development-only identity designation

**Decision date:** 2026-10-13.
**Status:** OWNER-APPROVED G2 — DEVELOPMENT ONLY.

## Actual owner decision

Recorded from the owner's direct workspace instruction (`lee449`):

> G2: After rechecking the G1 record and verified acceptance evidence, I approve exact C7 787d76decfa345e3c1104231e08d5ab00bc90259 as the NEW AUTHORITATIVE IMPLEMENTATION IDENTITY for development only. Accept its recorded source/tree/parent, reconciled evidence, qualification run 38284785813 attempt 1, 18 negative controls and five cleanup results.

Exact C7 is designated:

**NEW AUTHORITATIVE IMPLEMENTATION IDENTITY**

**Scope: development only, under the approved single-owner G1 exception.**
This owner decision is not an independent-human review or production release.

- Commit: `787d76decfa345e3c1104231e08d5ab00bc90259`.
- Tree: `aa0360267a0d1987626ae9650238d66f04f667b9`.
- Sole parent: `c795945c4a5d4815804a86b9d5f2bdc77573d38f`.
- G1 proposal: `4f5e87d6bfb6c3a468c947903a23d3beedf7a676`;
  proposal SHA-256 `ca8857b94eb5894c385805d372832d8df7cc364c88216eadb4683ea108ebf186`.
- G1 approval source:
  `docs/governance/ledgerly-tr01-c7-single-owner-g1-approval.md`, backed up
  at `68180fa598a5042df8111ea6c30e142d49176c86`.
- Qualification: existing GitHub run `38284785813`, attempt 1, success at
  exact C7; no new run performed.
- Accepted artifact ZIP SHA-256:
  `a21a4f0de4938876e5b17457d91a16f177d037af4e5ffcbb258194ccb60f83de`.
- Evidence SHA-256:
  `bd6df83ad8c0512db825b7afbc0cb29314c9e04ce1fc13bfe10e368d69a3332b`.
- Schema SHA-256:
  `6ba3d5f595f81e81db238b843c16b667e775384952855482ce9a978775d6ca0f`.
- Reconciled original/fresh log ZIPs:
  `bbf0b248bde5938492a5189fd1d12d9383ab11866a2835262c38d5812c557f06` /
  `f61c2abb73f30412af4918ab82f36c2f3a7abc804c6ebe6a0d0b344db5656b52`.

Before recording designation, rechecked the exact G1 proposal/approval, C7
tree/parent, authenticated existing run source/attempt/success, original
artifact integrity and evidence/schema bytes, strict schema-v2 validation,
all 18 true negative controls and all five true cleanup flags. The retained
log reconciliation receipts and archive hashes agree. Prior exact-source,
concurrency, privilege and isolation review receipts remain retained.

## Separate G3 instruction and unchanged pending gates

The owner separately instructed:

> G3: Prepare the constrained activation head from exact main base 0da401737f35d68b9404982baad7405fe997636a. Require C7 and that base as ancestors, obey the ten-path inventory, validate the result and return exact identities and a draft PR. Stop if main has advanced.
> G4–G7 remain pending: no live control changes, merge, qualification run, migration, deployment or Phase A.

G3 authorizes review-branch preparation/publication of a draft PR only, including
the local merge ancestry necessary to prepare A. It does not authorize merging
the PR into main. Preparation evidence will be recorded separately outside A.
If live main differs from the named B, stop preparation/publication.

G1 and G2 are approved; G3 preparation is authorized, not exact-A acceptance.
G4 configuration, G5 exact-A/B approval and protected-main merge, G6 dispatch/
normal owner release, and G7 activated-result acceptance remain **PENDING**.
No live control/pin/admission/reviewer change, protected-main merge, new
qualification, migration, deployment, production/Helium access or Phase A is
authorized by this record. Frozen C through C7 and historical evidence remain
unchanged. Existing candidate qualification applies only to exact C7, not A/G.
