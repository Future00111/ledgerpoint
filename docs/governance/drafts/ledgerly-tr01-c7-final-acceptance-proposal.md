# TR-01 C7 final acceptance — proposal for review

**2026-10-12 — technical evidence verified; final identity designation pending.**
The owner requested preparation and review publication of this package and an
activation proposal. This is not approval of authoritative identity, altered
review requirements, activation, a new run, Phase A or production.

## Decision proposed

Following fresh exact-C7 implementation/security review and a separate explicit
decision, designate C7 the **NEW AUTHORITATIVE IMPLEMENTATION IDENTITY** for
TR-01/TI-03. Implementation-package §11 controls that gate. This package does
not record the decision as granted; activation remains separate under §12.

| Identity | Exact value |
| --- | --- |
| Implementation C7 | `787d76decfa345e3c1104231e08d5ab00bc90259` |
| C7 Git tree | `aa0360267a0d1987626ae9650238d66f04f667b9` |
| C7 sole parent | `c795945c4a5d4815804a86b9d5f2bdc77573d38f` |
| Candidate ref | `refs/heads/tr01/implementation-identity-successor-c7` |
| Protected main / prospective B | `0da401737f35d68b9404982baad7405fe997636a` |
| Composite integration I | `085b7e0491d9adbbebcc7e8db384c575bcfa2aca` |
| I tree | `62fb0075bbc79f804fbcb80dc87a8a83a4601a04` |
| I parent | `07551a8e340f9de54b84340adf6185f0a08de9e7` |

This documentation branch is based on I. Its head is not activation A or G.
No A/G exists. The lost historical `b03627099616675924a88e9a30c7b5e6547c9166`
is not reconstructed or declared equivalent. C through C6 remain immutable;
earlier failures remain failure evidence.

## Retained qualification evidence

[Identity run 38283941466](https://github.com/Future00111/ledgerpoint/actions/runs/38283941466)
passed at exact main B, attempt 1. It is identity validation, not qualification.
[Qualification run 38284785813](https://github.com/Future00111/ledgerpoint/actions/runs/38284785813)
passed candidate mode, attempt 1, with workflow S=C7 and implementation C=C7.
Normal owner Environment releases were recorded. No bypass or independent
human approval is claimed.

- Artifact ID `11762063960`, name `ledgerly-ti-03-38284785813-1`.
- Archive SHA-256: `a21a4f0de4938876e5b17457d91a16f177d037af4e5ffcbb258194ccb60f83de`.
- Evidence SHA-256: `bd6df83ad8c0512db825b7afbc0cb29314c9e04ce1fc13bfe10e368d69a3332b`.
- Schema SHA-256: `6ba3d5f595f81e81db238b843c16b667e775384952855482ce9a978775d6ca0f`.
- Logs archive SHA-256: `bbf0b248bde5938492a5189fd1d12d9383ab11866a2835262c38d5812c557f06`.
- Original evidence path:
  `docs/governance/evidence/ledgerly-44-ti-03-e91f7ef1-4da2-4c08-b16b-5028c429f296.json`.
- Execution domain: 564 files, SHA-256
  `fcd81d162cbfc406853bdd13c853cd49f81fd814622a7f90116724e668eb82d1`.

[Exact evidence](ledgerly-tr01-c7-acceptance/qualification-evidence.json) and
[exact C7 schema](ledgerly-tr01-c7-acceptance/qualification-evidence.schema.json)
are original artifact bytes, not newly produced evidence. These retained copies
preserve the record beyond GitHub artifact retention. The
[evidence index](ledgerly-tr01-c7-acceptance/evidence-index.json) includes all
ten independently verified source digests, run/image/binding identities and
review boundaries. Technical verification is complete; the final governance
acceptance decision remains pending.

| Requirement | Verified result |
| --- | --- |
| Accounting | 6 passed, 0 failed, 0 skipped |
| Negative controls | All 18 passed |
| Concurrency | Two distinct backends/transactions reached the barrier before release; overlap proven |
| Cleanup | Logical drop, database absence, container, network and credential removal all true |
| Evidence | Schema v2, all ten source digests, exact run/attempt/ref/image/private binding verified |
| Bootstrap | Known FK/index ordering recovery, clean convergence, seven validated FKs |
| Journal lock | Wrong-scope rejection, direct mutation and temporary-shadow denial, same-transaction lock proof |
| Database security | API unprivileged with immutable UPDATE/DELETE/TRUNCATE denied; owner NOLOGIN; zero memberships; five ALWAYS triggers |
| Isolation | Disposable internal network; no published port, socket or external route; secret scan passed |
| Production / HeliumDB | Contact flags false; no migration or deployment |

The identity run also passed 29 producer, 19 schema/fixture and seven offline
tests plus the acceptance test file, with no failures/skips. The earlier
read-only diagnostic is supplementary review evidence, not qualification or
a C6 retry.

## Reconciliation and review

C7 fixes sanitized child module/toolchain resolution, incorrect rejection
fixtures, immutable-header lock permission and schema-push convergence. The
owner routine acquires the lock in the caller's transaction without API
immutable mutation rights. Unknown schema errors remain fatal. Stale candidate
identities and review/build-only provenance are rejected.

See the [scoped author security review](ledgerly-tr01-c7-implementation-security-review.md).
It is not an independent review. Neither the older independent design review
nor the owner-only development qualification exception satisfies fresh
exact-C7 final review or activation approvals. Those gates remain pending.

I imported 14 exact C7 files and three exact B producer files, with 25 changed
files and 39 other preserved local commits. Its remote tip, imported bytes and
unchanged GitHub controls were independently verified. Replit reports full
typecheck and 56 non-database tests passed; ignored raw Replit logs were not
independently retrieved. Matching 17 files does not qualify the composite I or
establish C7 ancestry to I.

## Remaining decisions

1. Obtain fresh independent implementation/security review of exact C7;
   identify the reviewer, scope and findings, and resolve findings.
2. Record a separate final decision on exact C7, reconciliation, evidence
   hashes and cleanup outside frozen C7. No approval is recorded here.
3. Review the [activation proposal](ledgerly-tr01-c7-protected-main-activation-proposal.md),
   including two-review policy, exact A/B/tree/ancestry and merge settings.
4. Only under separate approvals prepare A, enforce controls, review exact
   A/B, merge ordinarily to G, then qualify and independently review activated
   S=G with implementation C7.

BL-06/BL-07, source-freshness policy, production release, Phase A, 48-B,
Stage 3 and migration/cutover remain outside this preparation.
