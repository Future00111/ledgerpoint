# C5 preparation outcome — draft review, local binding replay blocked

Root cause and offline repair are established. Exact C5 and separate producer
are available for draft review, **not live execution**. See
[the preparation report](ledgerly-tr01-c5-preparation-report.md) and
[exact identities/file hashes](ledgerly-tr01-c5-preparation-identity.json).

## First remaining action: isolated disposable binding verification

Run the existing six-case binding regression from exact C5
`3a5c6e1318b49edcdc7f0f918d3a01813f960e71` in a supported synthetic disposable
PostgreSQL environment with the existing internal-only, non-root, read-only,
no-new-privileges controls intact. Preserve its result and verify all cleanup.
This local runtime's bridge times out; shared network namespace creation is
denied by OCI. Do not use host/external networking, production/Helium
credentials, relaxed privileges, or altered identity checks as a workaround.

Concrete command after building the exact-source, build-only review image:

```sh
node scripts/ci/ledgerly-external-binding-regression.test.mjs \
  --disposable-review --base-image ledgerly-c5-offline-review:3a5c6e1
```

Use byte-exact source/image checks as in the preparation manifest. A successful
binding replay would remove this preparation blocker; it would **not** amount
to canonical hosted qualification success.

## Draft review objects

- Repair `6e8255949c3da130561f781614785f692796b621`:
  [PR 16](https://github.com/Future00111/ledgerpoint/pull/16).
- C5 `3a5c6e1318b49edcdc7f0f918d3a01813f960e71`, tree
  `3f2e22ccceb70ea50034b41af352a125b63cf127`, sole parent repair:
  [inspection PR 17](https://github.com/Future00111/ledgerpoint/pull/17).
- Producer `4f0fbd7a4ff75fbc4fadd57bc7ab2a7a38dc7f0b`, tree
  `fc88f3e99bc78d39f808a86fd1412c883bdb6e74`, sole parent main
  `af028bb647fbbdb81509539969b21a859e708f34`:
  [PR 18](https://github.com/Future00111/ledgerpoint/pull/18).

Do not merge repair or inspection PRs into frozen C4. Keep producer draft and
unmerged until the preparation blocker is cleared and later authorization is
received. No review branch is an immutable successor or protected candidate.

## Later live actions — not authorized or performed in this stage

After successful binding verification and later action-time authorization:

1. Freshly verify exact candidate/producer identities, main and live controls.
   Normally review/merge **only** the separate producer, without bypass, and
   record/read back actual merge SHA `M5`; no guessed merge SHA.
2. Proposed validation source variable is `TR01_C5_APPROVED_WORKFLOW_SHA=M5`.
   The source pin is **not set now**.
3. Prepared exact-only ruleset is
   [ledgerly-tr01-c5-ruleset-proposed.json](ledgerly-tr01-c5-ruleset-proposed.json):
   `refs/heads/tr01/implementation-identity-successor-c5`, active, empty bypass,
   update/deletion/non-fast-forward blocks, strict required status
   `tr01/c5-identity-validation` from GitHub Actions app `15368`,
   initial-create exemption. Do not apply or publish the immutable ref now.
4. After approved protection/publication, verify effective rules, SHA/tree/
   sole parent, then dispatch identity **once from exact M5**. Use normal
   owner Environment review under the existing exception, not admin bypass
   or an independent-human-review claim.
5. Only after identity succeeds and bot status is independently read back:
   proposed candidate pin is
   `LEDGERLY_APPROVED_CANDIDATE_SHA=3a5c6e1318b49edcdc7f0f918d3a01813f960e71`.
   Replace only the exact C4 Environment admission with exact C5, preserving
   main, custom policy, reviewer, and no tags/wildcards. Preserve all ancestor
   protections and old workflow source pins.
6. Fresh no-production/no-Helium credential preflight, then separately
   authorized single exact-C5 development qualification with normal owner
   review. Verify schema-2 artifact hashes/source/image/run bindings, posting,
   concurrency, negative controls, isolation and all five qualification
   cleanup flags. Stop on failure; preserve evidence; no retries/immutable
   edits. Do not retry C4 or enter Phase A.

These future actions require separate authorization. This document does not
grant it or claim that their preconditions have passed.
