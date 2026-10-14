# Ledgerly #44-TR-01 implementation identity recovery independent review

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

The historical architecture review below and retained author/AI reviews are not fresh independent-human approval of C7 or A. The owner knowingly substitutes single-owner decisions under G1. No independent-human reviewer, signature or completed activated-result review is claimed. P25-E1 was resolved by original/fresh retained archive hashes, two byte-exact shared logs and seven normalized step sequences covering 452 lines.

## Retained historical baseline


**Date:** 2026-09-21  
**Review type:** Independent read-only architecture and security review  
**Scope:** Recovery amendment and non-executable implementation approval
package

## Review history

### Initial amendment-design review

The original recovery design failed review until it:

- made external database-backed TI-03 qualification mandatory;
- fixed the authoritative governance paths;
- separated candidate implementation `C` from workflow source `S`;
- defined governance activation `G`;
- eliminated commit self-reference; and
- required protected-main activated qualification.

After those corrections, the amendment design passed.

### Initial implementation-package review

The first package review returned **FAIL** because:

- schema-v2 and disposable SQL compatibility semantics were undecided;
- candidate and activation file inventories were not exact;
- the independent-review record was absent;
- governance self-reference was not explicitly prohibited;
- candidate branch bootstrap and bypass controls were under-specified; and
- activated ancestry verification conflicted with shallow checkout.

The package was revised prospectively to:

- mandate evidence schema version 2;
- remove legacy `sourceCommit` / `source_commit` from new qualification
  evidence and fresh disposable run control;
- enumerate exact version-2 evidence fields, SQL columns, constraints,
  compatibility behavior, and rejection fixtures;
- enumerate every permitted `C` and `G` path;
- prohibit recording `G` inside `G`;
- require an exact-name ruleset, two reviews, administrator enforcement, a
  one-time audited bootstrap bypass, and bypass removal before qualification;
  and
- require complete workflow-source history and exact `C -> S` ancestry proof.

### Activation-identity follow-up review

The second review confirmed those corrections but returned **FAIL** because a
pre-created `G` could be rewritten by normal pull-request promotion. The
package now defines:

- `B` as the exact reviewed protected-main base;
- `A` as the exact reviewed activation pull-request head;
- `G` as the resulting GitHub two-parent merge commit;
- merge-commit-only promotion with squash and rebase prohibited;
- invalidation and complete re-review if `main` advances from `B`; and
- post-merge verification of main tip, `G^1=B`, `G^2=A`, `C` ancestry, and
  `GITHUB_SHA=G`.

### Schema-v2 compatibility scope approval follow-up review

After explicit approval of the independently reviewed schema-v2 compatibility
scope amendment, a fresh read-only package review confirmed:

- the authoritative candidate `C` inventory contains exactly the original six
  paths plus
  `scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql` and
  `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs`;
- those two paths are no longer listed as reconciliation inputs that must not
  change;
- no third executable, SQL, schema, workflow, runtime, package, governance, or
  test path is authorized;
- the existing focused test path remains the approved location for
  identity-contract coverage;
- legacy `sourceCommit` / `source_commit` must be removed without translation;
- all eight schema-v2 identity fields, literal environment boolean parsing,
  actual JSON boolean emission, type-sensitive JSONB comparison, and
  legacy/mixed rejection remain mandatory;
- accounting, normal runtime, roles, ACLs, ownership, triggers, production,
  `heliumdb`, 48-B, Stage 3, #40-CF-01, and Phase A remain unchanged or
  excluded; and
- implementation may resume, but candidate creation, GitHub configuration,
  publication, database access, and qualification remain unauthorized.

No additional executable file is necessary. Security finding: none.

## Current verdict

**PASS**

The final review confirmed:

- `b03627099616675924a88e9a30c7b5e6547c9166` remains historical, lost, and
  non-equivalent to every prospective identity;
- schema version 2 and fresh disposable SQL have exact, fail-closed identity
  semantics;
- candidate, workflow, activation-head, base, and merge identities are
  unambiguous;
- candidate and activation inventories are exact;
- branch, environment, review, bootstrap, ancestry, digest, and post-merge
  controls are sufficient;
- fresh database-backed candidate and activated qualification are mandatory;
- historical records remain append-only and truthful;
- Phase A remains blocked; and
- production, `heliumdb`, 48-B, Stage 3, and #40-CF-01 remain excluded.

Security finding: none.

**TR-01 SCHEMA-V2 COMPATIBILITY AMENDMENT APPROVED — CANDIDATE IMPLEMENTATION
PACKAGE READY TO RESUME**

Candidate implementation may resume only within the exact approved eight-file
inventory. No candidate creation, GitHub configuration, publication,
qualification, database access, or Phase A authority is granted by this
record.