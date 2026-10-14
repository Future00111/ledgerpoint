# Ledgerly #44-TR-01 implementation identity recovery approval record

## Exact C7 development designation and activation preparation — 2026-10-13

**Current scope: G1 and G2 owner-approved; G3 preparation authorized. G4–G7 PENDING.**
Implementation C7 is **NEW AUTHORITATIVE IMPLEMENTATION IDENTITY**, development only:
787d76decfa345e3c1104231e08d5ab00bc90259, tree aa0360267a0d1987626ae9650238d66f04f667b9,
sole parent c795945c4a5d4815804a86b9d5f2bdc77573d38f.
The protected implementation ref is refs/heads/tr01/implementation-identity-successor-c7;
preserve all historical frozen refs and pins. G1 approves the five stated
single-owner human-review substitutions only under proposal commit
4f5e87d6bfb6c3a468c947903a23d3beedf7a676 (document SHA-256
ca8857b94eb5894c385805d372832d8df7cc364c88216eadb4683ea108ebf186).
Owner review is not independent-human approval. All technical checks remain required.

This is a constrained **review-branch preparation**, not activated protected main.
B=0da401737f35d68b9404982baad7405fe997636a; both B and C7 must be ancestors of A.
Outside the ten approved workflow/documentation paths, retain B blobs/modes/absence.
No A acceptance, G, live configuration, merge to main, dispatch, migration, production
access/deployment or Phase A is authorized here. A/G readback belongs outside A/G.
The retained text below is the historical baseline; this bounded addendum supersedes
only exact-C7 development designation and the explicitly approved G1 human substitutions.
All other scopes and safeguards retain their normal approval requirements.

### Exact owner decisions and evidence

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

The separate G1 approval at backup commit 68180fa598a5042df8111ea6c30e142d49176c86 names five replacements: fresh independent exact-C7 final review; two exact-A/B approvals; distinct Environment reviewer/self-review prevention; distinct second-human pre-dispatch review; independent activated-result review. Native configuration and each later owner decision are separate. Preserve the required normal owner Environment release; no administrator bypass.

## Retained historical baseline


**Date:** 2026-09-21  
**Status:** APPROVED — DESIGN / GOVERNANCE ONLY  
**Approved amendment:** `docs/ledgerly-44-tr-01-implementation-identity-recovery-amendment.md`

## Approved decision

The prospective identity-recovery model is approved.

The former identity remains:

- branch: `feat/ti03-option-e-redesign`;
- commit: `b03627099616675924a88e9a30c7b5e6547c9166`; and
- status:
  **HISTORICAL IMPLEMENTATION IDENTITY — OBJECT LOST / UNAVAILABLE**.

The approval adopts:

- distinct candidate implementation `C`, workflow source `S`, and activation
  commit `G`;
- exact candidate ref
  `refs/heads/tr01/implementation-identity-candidate`;
- complete fresh validation with no unavailable-check waiver;
- protected environment binding
  `LEDGERLY_APPROVED_CANDIDATE_SHA=C`;
- candidate qualification with `S=C`;
- final authority only through a later explicit identity approval;
- activation with `S=G`, implementation `C`, and verified `C -> G` ancestry;
- separate workflow and implementation evidence identities; and
- append-only prospective governance amendments.

## Authority granted

This approval authorizes governance documentation and preparation of a
non-executable implementation approval package only.

## Authority not granted

This approval does not authorize:

- creation of `C` or `G`;
- branch publication or protection changes;
- workflow, coordinator, schema, runtime, accounting, or package changes;
- GitHub environment configuration;
- qualification or Phase A;
- production or `heliumdb` access;
- 48-B, Stage 3, or #40-CF-01 implementation;
- deployment or publishing; or
- any claim that the current tree equals the lost commit.

Every executable or external action remains subject to separate explicit
approval.

## GitHub Environment reviewer semantics correction — subsequent approval

The separately reviewed proposal
`docs/ledgerly-44-tr-01-github-environment-reviewer-correction-proposal.md`
is explicitly approved **as design/governance only** for candidate
`d292f3a64c6253e022b40de8cf055f3e722ff1ea`. It corrects the
implementation package §9: listing multiple required reviewers in
`ledgerly-canonical` does not require multiple GitHub Environment approvals.
One listed reviewer approval releases a waiting deployment; where supported,
Prevent self-review must bar the initiator from providing that approval. The
second required human review is a distinct recorded pre-dispatch governance
gate, not a second native Environment approval.

Exact protected candidate ref, `workflow_dispatch` only, exact `C` binding
through `LEDGERLY_APPROVED_CANDIDATE_SHA`, identity validation, and all
qualification restrictions remain unchanged. The proposal's fallback for
unavailable native reviewer controls is **not approved**. Live feature
availability may be inspected read-only, but this approval does not authorize
GitHub configuration, workflow execution, qualification, production or
HeliumDB access, or Phase A. Separate configuration approval is required.

The subsequent read-only GitHub API response for the public repository's
existing `ledgerly-canonical` Environment returned a required-reviewers
protection rule with the `prevent_self_review` property present and currently
`false`, plus a protected-branches deployment policy. This establishes native
reviewer-rule availability in the live repository, but **not** compliance with
the corrected self-review gate. Enabling the setting, checking reviewer
identities, binding the exact Environment variable, and verifying the
effective configuration still require separate configuration approval.
