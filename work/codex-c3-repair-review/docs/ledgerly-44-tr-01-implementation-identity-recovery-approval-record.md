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
