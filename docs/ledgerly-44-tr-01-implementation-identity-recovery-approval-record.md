# Ledgerly #44-TR-01 implementation identity recovery approval record

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
