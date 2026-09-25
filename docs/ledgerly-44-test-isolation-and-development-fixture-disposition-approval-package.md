# #44 / #46 Canonical Test Isolation and Development Fixture Disposition Approval Package

**Status:** PROPOSED FOR APPROVAL — DECISION ONLY  
**Prepared:** 2026-08-26  
**Revised:** 2026-08-26 following independent design review  
**Environment:** Development only  
**Implementation authority:** None

> This package defines a proposed test-isolation design and a proposed one-time
> disposition boundary for synthetic development fixtures. It does not
> authorise code, configuration, schema, migration, database, secret, workflow,
> deployment, publishing, production, or fixture-cleanup work.

## 1. Decision requested

Approve or reject both of the following as one narrowly scoped safety package:

1. a schema-only disposable-database mechanism for canonical integration,
   transaction, failure-injection, and concurrency tests; and
2. a separately approved, one-time, administrative isolated-test reset for the
   exact retained synthetic development fixture graph recorded below.

Approval of this package would approve the design only. A later explicit
implementation instruction would still be required before either the test
harness or the retained fixtures may be changed.

## 2. Existing authority and non-negotiable boundaries

This package preserves:

- DEC-04: canonical accounting is server-generated, balanced, source-linked,
  idempotent, immutable, and changed only through controlled additive
  accounting mechanisms;
- DEC-17: authoritative accounting and necessary audit evidence have governed
  retention classifications;
- DEC-18: posted business accounting and audit evidence is not physically
  deleted, and disposal is not an accounting-correction mechanism;
- #40: a controlled environment containing test postings may be removed or
  restored only through an approved isolated test reset, never through a
  production accounting deletion path;
- #44: canonical headers, lines, relations, and audit events are append-only,
  and posting effects allow only the approved finalisation transitions;
- #44-SC-01: every canonical relation is company-scoped and bound to the
  resolved economic effect; and
- #44-RS-01: the development API connects directly as `ledgerly_api`, while
  protected canonical objects remain owned and guarded outside that role.

The following remain prohibited for every runtime, API, test-process, and
ordinary administrative operation:

- canonical `UPDATE`, `DELETE`, or `TRUNCATE` authority for `ledgerly_api`;
- trigger-disable, owner-role, superuser, or administrative authority for
  `ledgerly_api`;
- `SET ROLE` as a substitute for a direct API-role connection;
- weakening, replacing, or suspending the five `ENABLE ALWAYS` guards, except
  for the exact one-time development administrative fixture-reset exception in
  section 12 after a separate implementation instruction;
- committed canonical test writes in the normal development database;
- treating synthetic fixture disposal as an ordinary reversal or correction;
- production access, production posting, production cleanup, or deployment;
- a persistent change to the normal development `DATABASE_URL`; and
- BL-06, BL-07, #41, migration/backfill, RLS, or unrelated product work.

Production posting remains disabled.

## 3. Safety-gate evidence

The development API has been restarted and observed running directly as:

- `current_user = ledgerly_api`
- `session_user = ledgerly_api`

The approved role, ownership, ACL, trigger, escalation, mutation-resistance,
effect-transition, permitted-write, and public-default checks passed. The API
health endpoint and scheduler database access also passed.

The canonical integration suite then exercised valid committed canonical
transactions but failed in its teardown when it attempted:

```text
DELETE FROM accounting_audit_events ...
```

PostgreSQL correctly rejected that cleanup for `ledgerly_api`. No privilege was
broadened and no trigger was weakened.

This is a test-isolation defect, not evidence that the runtime API needs broad
canonical mutation authority.

## 4. Read-only provenance of the retained development fixtures

The following evidence was obtained through read-only development queries on
2026-08-26. No row was deleted, updated, anonymised, rewritten, reversed, or
corrected.

### 4.1 Exact synthetic company allowlist

| Test family | Company ID | Canonical effects / journals / lines / relations / audits |
|---|---|---:|
| Atomicity and concurrency | `bcb3569f-703f-46e8-b554-f0447c2d78df` | 3 / 3 / 6 / 2 / 3 |
| Fail-closed Company A | `33d1466a-a116-4bb7-bc82-a44fb38259c3` | 0 / 0 / 0 / 0 / 0 |
| Fail-closed Company B | `59f25ad4-c123-4db2-b50f-8c2f7360e3ea` | 0 / 0 / 0 / 0 / 0 |
| Happy path | `8944dfd1-4a76-41d3-be5f-1c9267c1f0c3` | 1 / 1 / 2 / 0 / 1 |
| SC-01 primary company | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | 4 / 4 / 8 / 3 / 4 |
| SC-01 other company | `74ee2198-2196-40fc-8eb3-2aa038f48358` | 0 / 0 / 0 / 0 / 0 |
| **Total** | **6 companies** | **8 / 8 / 16 / 5 / 8** |

The company names contain the expected `Canonical posting` test-family prefix
and generated UUID suffix. The three companies with canonical rows use
test-generated actor identifiers with the `canonical-owner-` prefix.

### 4.2 Canonical source and effect provenance

All eight effects and all eight journals have status `posted`.

| Source type | Posting kind | Count | Relationship |
|---|---|---:|---|
| `fixture_document` | `fixture_posting` | 3 | Original synthetic test postings |
| `canonical_journal` | `journal_reversal` | 2 | Additive reversal journals |
| `canonical_journal` | `journal_correction` | 3 | Additive correction journals |

The five relations comprise:

- one reversal and one correction for the atomicity/concurrency company; and
- one reversal and two distinct corrections for the SC-01 primary company.

Read-only integrity checks found:

- zero posted effects with a missing, cross-company, or wrong-effect journal;
- zero relations with a missing economic effect;
- zero relations with missing original or related journals;
- zero relation company mismatches;
- zero audit events with missing referenced effects; and
- zero legacy `journal_entries`.

The rows are therefore structurally valid canonical records produced by the
test source and test actors. Their synthetic provenance does not make them
mutable through the ordinary application boundary.

### 4.3 Associated ordinary fixture rows

The six companies also retain ordinary test setup rows:

| Test family | Company users | Chart accounts |
|---|---:|---:|
| Atomicity and concurrency | 1 | 2 |
| Fail-closed Company A | 1 | 2 |
| Fail-closed Company B | 0 | 1 |
| Happy path | 1 | 2 |
| SC-01 primary company | 1 | 2 |
| SC-01 other company | 0 | 0 |
| **Total** | **4** | **9** |

Read-only inspection of every public table with a `company_id` column found one
additional retained fixture class: six `workflow_activities`, one per synthetic
company. It found no other company-owned rows outside the tables enumerated in
section 4.4, including no bank accounts, bank transactions, customers,
suppliers, invoices, bills, documents, VAT rows, reconciliation rows, AI rows,
or legacy `journal_entries`.

The company IDs identify the fixture families but are not the disposal
authority. Only the exact row IDs and SHA-256 snapshots in section 4.4 form the
proposed disposition manifest.

### 4.4 Exact row-level fixture manifest

This manifest was captured read-only on 2026-08-26. Each hash is SHA-256 over
the UTF-8 bytes of PostgreSQL `to_jsonb(row)::text`. The complete manifest
contains exactly 70 rows. A later reset must reproduce every ID and hash before
doing anything, discover no additional dependent row, and delete only these
exact IDs. A predicate such as `DELETE ... WHERE company_id IN (...)` is
expressly forbidden.

#### `companies` (6)

| ID | SHA-256 |
|---|---|
| `33d1466a-a116-4bb7-bc82-a44fb38259c3` | `49c447589b73cf7821aa02a3a6299ba35e5268ca6e31a0be4ee6bd15fbf5131a` |
| `59f25ad4-c123-4db2-b50f-8c2f7360e3ea` | `f0c9b926df0c7bc8775ebc25cd0c61358f7090d7e0f3fa4db029e034f57b4e11` |
| `74ee2198-2196-40fc-8eb3-2aa038f48358` | `a2e32ee642274933dba479a3fbaf130769e8198f7a0cc4e6d64a16df9cfa7178` |
| `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `967357cba49bfb45dd864fd11319b2e1b9fbef9f24aa8100f627131fe56c9443` |
| `8944dfd1-4a76-41d3-be5f-1c9267c1f0c3` | `d742714381b0d2e33a1d2d5074dbb6558b5ae75e010fa4964a043d81d7d5bbab` |
| `bcb3569f-703f-46e8-b554-f0447c2d78df` | `2da12a14de8b8bdbc579e486b2ae5f3de7489aefd4cf9b630714cc1a2e791796` |

#### `company_users` (4)

| ID | Company ID | SHA-256 |
|---|---|---|
| `482ad404-a6c1-4cbe-87b7-251f0c60455c` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `c751e9afa7e1a2e9d80c2e575a39c0159ade36d9252c3c9a0e9a34e582a286c8` |
| `62701379-ff84-4b4f-b1aa-112794272e11` | `8944dfd1-4a76-41d3-be5f-1c9267c1f0c3` | `5c5762fbbc44f9eec07b519c9a624bb48d8e554bd441be40326d5679f0dcf08d` |
| `b100ad18-fbc1-4bd2-8245-fe8c1834e457` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `838da6326b0fb86259e53288a2035904e9d7e489b60f6d21b30e5f3782261ae5` |
| `df3484d7-19bc-4707-bf82-ac0aed39c17d` | `33d1466a-a116-4bb7-bc82-a44fb38259c3` | `d9c0eec57476290a444d0e985bbfb616bd5c6cb0077f9ea2e2cda60431cb8dd1` |

#### `chart_of_accounts` (9)

| ID | Company ID | SHA-256 |
|---|---|---|
| `0a52732b-f2a9-4b2c-a88b-2fb1469c297b` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `0396463a15c7865ecdb6538787fdc2eb1b4af8a2bd1c7bd57ab59f9069b31336` |
| `0b68665a-9f34-47be-b93c-b2c59619151c` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `281c473a3afae251fdf9680147cd1e0b74139bb281799d0739db8035c19aacf1` |
| `3d8fd152-aa40-4217-9520-53e9093feaf9` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `c0b26b51807980122b8cb4bd709af192d6e83bc85c00cdc294a98b7ca72f0c84` |
| `3ed069a5-1cbb-46c2-813f-8a86248d45eb` | `8944dfd1-4a76-41d3-be5f-1c9267c1f0c3` | `ed438454aa0ed5b14d8f7c72599e4d75a8c399c108e32101b50b0b0dc0d31f17` |
| `4c68a3d2-1b3e-4c15-b01d-02c188778524` | `33d1466a-a116-4bb7-bc82-a44fb38259c3` | `42d92b4691f87f0be029996d2d34be8c258d58dc9a3836125fe22895bf19882f` |
| `70574587-7f55-465e-bf3d-8578ec2c5543` | `59f25ad4-c123-4db2-b50f-8c2f7360e3ea` | `a2f03fa7b9b70c539029be0055bd77fd3fa6895afde333a40846c3f347454060` |
| `a48dd79e-1e74-48f7-9c1c-57af4d37eb52` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `05c34a3b466c4483e3907ba986e89030430a1a6421ea3e2b021afbd30e8332d9` |
| `b91d4a2a-8a35-4114-bc5f-39fad7fb9a3d` | `8944dfd1-4a76-41d3-be5f-1c9267c1f0c3` | `215f69b870756a7fb8b9da978fb2b2fbaa6c67a395382a30b225cb06369bd36b` |
| `c681f473-e649-43e6-9209-4b88edc21cc9` | `33d1466a-a116-4bb7-bc82-a44fb38259c3` | `67aa0892524f3d9a2cd8b48c645288496b180fd8a5a3a8207c1900892e1a9f1f` |

#### `workflow_activities` (6)

| ID | Company ID | SHA-256 |
|---|---|---|
| `02e76830-74d0-4d5d-abe2-3d3657adc515` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `1db6928dd345fa219a5326b0291945bd38ec5cbdada701032f1ff57ff87451ec` |
| `47c38407-cf8f-443b-a68a-962344febf2b` | `8944dfd1-4a76-41d3-be5f-1c9267c1f0c3` | `6d79b2081c71951ad0956e6a27958a4f8394f9c325fa8a3d98ad140ed442d08e` |
| `548f2696-19cd-47cf-b6b2-f9cf5c0c760f` | `59f25ad4-c123-4db2-b50f-8c2f7360e3ea` | `3f8c7f0ead3d960ddac46637c0758c0966b35d08c280225c3d5035b51ba782d1` |
| `649ab708-69c4-4e30-a95c-de3512627bd2` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `9766980f6ec4ee4af4b669b201c1d790bacf1a8f25651b426c926763dcfe4dde` |
| `c8c30ab7-3d07-4765-b5e2-7cb179218eb1` | `33d1466a-a116-4bb7-bc82-a44fb38259c3` | `4eb4d820d3607c57bab6bad0e0df3935005a5f172f88e570c4c49f34960c050c` |
| `eb4a7b03-f53e-441c-af7f-5e0b683d0967` | `74ee2198-2196-40fc-8eb3-2aa038f48358` | `fd5b9ced5137be5f49db9f30488128b3e88cc3351042f34e346dd280cca8803b` |

#### `accounting_posting_effects` (8)

| ID | Company ID | SHA-256 |
|---|---|---|
| `2b07281f-aecf-4d46-97dc-c3e7e2ab21e5` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `80de902155299057621ecea703f1049bf5ebd6cc7ae614960727e74b86670898` |
| `3df3c0d2-b84b-47b1-aff7-498fcd0f0bee` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `660177981792fb15440bc78b5b636376da6e4017779f42af7591959eaa02e926` |
| `759c661d-170f-41a5-a5e0-327e27d69236` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `52108442ee888e6ac37fb747ec2bf3fb393ff52acafee77eca0b940bfdaff97b` |
| `88dd2d7f-b868-4c5c-8d5e-92d15ee000e2` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `639d5102a980023f6208b9a1d4c2165dbf24424614dba9dc8fdd0bbcaa2482a6` |
| `9d31b3e6-557c-41a9-bf67-38611e8d3c1b` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `401dca1a4603cc6d93f7325cd53f3e56739d8964d29ef8dbe0e078d00da334c5` |
| `a1845b4d-38e6-4791-859a-2121f7b4b1e4` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `55bc0ac028a9b180f8a18b642c8fc720e7e949a64e609bab7713c0a0dba9cda5` |
| `b3021e41-d35a-49db-a496-c9c0ee61c7fb` | `8944dfd1-4a76-41d3-be5f-1c9267c1f0c3` | `906074cfa5dea24fdcf89dbc34aa309c1b41f2c58c07a5e7501b60412484d5c2` |
| `f74d4f48-b447-42fc-9a51-95e939e815f0` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `56d6b1eea6a9e214d8a7379257ac20d3a58eb14c6fcdc37648d55d73cba587a0` |

#### `canonical_journal_entries` (8)

| ID | Company ID | SHA-256 |
|---|---|---|
| `18fc4700-9ab5-4529-b24f-419956c32b2d` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `b9b54bd396fd9aed40a693d4cd0e63a10e2f90314aac416183c3f5b47d20c959` |
| `569fc54b-7e5d-4f19-bde7-bc9649d8cdb5` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `7383e049d4b29932da3786fbe0d686b4c9c12f4706b26501e05b1a44469b9684` |
| `62d10e95-3096-4549-bfc4-3df179dc05f0` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `33282a566fcd4eabb111eda97a7ffee76a958cb971dfa7991dfdf0a08d56da80` |
| `728557d8-053c-4ab8-adc0-8b79c7d014c3` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `484854c45041b08a9ffc38f5fa895c1666856adaf28a2aa1b1c1b50f6433c9c9` |
| `8c60c3de-7767-40c6-a577-fbbba2d4469b` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `55d1d331f0daad230fccf76027e2b5a0c2c73697caa0481573c53015ab620204` |
| `c3ac57c1-459b-4314-9fca-33aba8ad1a85` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `b4df643ab75cf23d7942e2bca26fc951d543694151b21fbd2fe0f6fdf4099460` |
| `ea74845a-54a7-4f72-9759-d58e8a058f1e` | `8944dfd1-4a76-41d3-be5f-1c9267c1f0c3` | `0a264399362c62c80f7644872b70058691aa9fdb85f64e5baa6833a9d3e3ee55` |
| `ee0b276b-c59d-4830-ab18-939766a56905` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `5c1921e076eb6b40e35d88850777628cde3309d5ff7506195b0967def2b5ace7` |

#### `canonical_journal_lines` (16)

| ID | Company ID | SHA-256 |
|---|---|---|
| `13ba4be3-6d21-481b-9515-4d1ce64e26f0` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `89154f25e33c38bdaa62254d8d0090a6de15edc78c76e0c1d1616ae5fe7d20e1` |
| `14bbb0a9-e0c3-46f8-839d-365088ee84c5` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `908c41f6d5120faaf571317950c48f12dad554cbc40e2d4b60700bf15c5c48c9` |
| `16ee8ddb-4a0d-4cde-bc46-56c11e8775b6` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `bdeb8ee5af8eb93cab2921d4363c601e28142169f920b4624eb5bbd7353a9945` |
| `187c299f-3114-4b18-8973-cbe14df80cf7` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `374a6bfe48a8df4036ccc4cd909d7b76d7354e8f190e7b31d95ab8ab9b4e84fa` |
| `315a9356-6ad9-4d59-8885-65b4378ad9b5` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `721fb2bf2507c91df94fc400b6f0091c601f470e0229e67db37d068235db0f54` |
| `3ef5c622-c6a9-4fce-bb32-039e20754d28` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `7aaf8e30defb812edfc250539e0d258a9196d8c406ccb6d85ec8bf4ae3ab23b5` |
| `4341e206-4c37-4fe4-9871-b50bb7353e4a` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `c6bdf167b85a9f1111580ef1bbf7b656a6be33847be177f3717a6db41d131222` |
| `47e11527-0c66-436a-9dc7-82e4dd35c452` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `121769d9eca13f6a88e4eae1e25951e3402f9607693a941bae20886a4f8ada6e` |
| `7fdb63ad-d615-4119-8732-a028082db72e` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `c2272b0d2bb6cf11aca4496c7c08f708a34d9d7162cb005429bd4c0e08440676` |
| `81e299b1-10ef-4e85-ad87-5b12051cbfe7` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `9263425d1bb9522f954badb2e3b779b172962618f4f08dcb8d75f3e36a264fa2` |
| `969e434c-a24b-497f-a332-14a5d32b6364` | `8944dfd1-4a76-41d3-be5f-1c9267c1f0c3` | `97f064421bc895099f70d3ff327fd44f089cb1e25c752e66b5024c37660c16fc` |
| `a8551afb-4a47-401e-a2b3-0e21b50398ee` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `c12ee6cc9a9c43d40ad22c8a90b3fa973d5913b5ff626ae7038a5c55c2b901d7` |
| `a9dd170b-438c-4fb0-b224-8c835affd3f6` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `daa6acd6e28aacff219d6e85ad2bbb14c89f98171fa73cda107975878d2f4994` |
| `d55b5121-7826-4bf9-927e-cde76a57c96c` | `8944dfd1-4a76-41d3-be5f-1c9267c1f0c3` | `29d26fa6684487bf66c43cbe2d2255971ed08b5001423c423dbafb5ff21cde89` |
| `d6b072ed-2a65-4387-aa6b-6d6610549f2b` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `c3303c1c29c8ec2455b8701d6b97ddc8bf2b05b8b80339190e9ab162749c203e` |
| `e8b033ec-192e-4b0f-9c06-f1688d0ba620` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `80b53577084eb5168141223d963050f1bc2f2c2fd6ad81a729c765c5b0a49032` |

#### `canonical_journal_relations` (5)

| ID | Company ID | SHA-256 |
|---|---|---|
| `0020f939-26d6-4ec3-a2ff-5423ce360c92` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `734ca47330b47a6d48a72c2d592005ed420d0cce5b8382565c57b4df89c4f8ff` |
| `565faf13-e333-4b34-9d42-bfb6fa9cf90e` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `4d53377abd2bafff0ac369ee2667a2c0b6453d00c3ebad71b7a1f03f983df8f5` |
| `5926e425-acaf-425c-9222-b99012322a86` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `5523e0a2384173c58859068ba9202f3d99bba5557981a84613a9bb33af105acf` |
| `801ffde1-9088-42b4-a81e-0e5d8fa29eb5` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `aa6b25d591130a0f5952fff545974ac58cea27c5a55874bc243f22da88ad3cd2` |
| `e099ba48-312f-41f2-84e6-822a6dd9dde0` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `aaa5f5f35dc25bf3f14857e4994882c8e5bb7ae11e3e4eb6b0704009aa983035` |

#### `accounting_audit_events` (8)

| ID | Company ID | SHA-256 |
|---|---|---|
| `28dc305b-cbd5-41d7-84de-8b1abb933af4` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `d1f282e688448592222d0c81941d23eff5ee10a462b83152d23cfc8f6199e887` |
| `3cc91be6-003b-4bba-a42e-fee020a4002a` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `51f5f60aa17f868f90b378a7b44547a6961d29fe3e86183a8067ea946029d7f4` |
| `595aba89-cf57-4eb1-801a-df0f2624a4e8` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `08452082ba5ae012ac6b059938d89eb1c071323424030444a03fe3df34b5fa21` |
| `6745056a-ef50-4b0c-9de1-f1e6d6736f57` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `d7eeb4e11293678d780d84e286d71359f1475c680c00b7b1a2efc6b168345237` |
| `73adc49c-bbb2-4060-8788-eb51d0d6f02d` | `bcb3569f-703f-46e8-b554-f0447c2d78df` | `d2e9a91f83ad0511775970421e8b21b363dd0a98e01954b1d96633f35a300117` |
| `8143b469-04fe-44d0-8807-2854b80b3cdb` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `b9b2e05c6f62b0b01997c5907ace4927b523f5887f1afa7165274c15bdb9fd12` |
| `9b0bcd5c-f32b-4467-91b0-847496af4bdb` | `7ac6faa1-b623-45d5-b8c2-e8d995dbc5da` | `335c2a857407b516b397822ec5076de5b888b51ccc21a1faffa71272b1873d46` |
| `9e93b7bb-2ffc-498c-9bc8-5786614644f8` | `8944dfd1-4a76-41d3-be5f-1c9267c1f0c3` | `992f13fc5358ca497a34414f82535e5f0f0707ba1ce000989819f9ac8dee01f7` |

Before a reset, a read-only dependency sweep must enumerate every foreign key
that can reference any manifested row and every public table with a
`company_id` column. It must prove that the only matching rows are the 70 rows
above. Any additional, missing, or hash-mismatched row cancels the reset.

## 5. Test-isolation options considered

### Option A — Outer transaction and rollback in the normal development database

**Not selected for the complete canonical integration suite.**

Transaction rollback is preferred where one test controls every statement
through one connection and one transaction. It is not sufficient for the
current complete suite because:

- the canonical public service methods open and commit their own transactions;
- an unrelated outer test transaction cannot roll back those independently
  committed writes;
- the retry/idempotency test intentionally uses multiple concurrent calls and
  database connections; and
- making all calls share one connection would stop testing the required
  multi-connection uniqueness, locking, and commit visibility behavior.

A future lower-level single-transaction test may use rollback isolation when
the tested function receives the same transaction handle. That does not replace
the required public-boundary and concurrency integration tests.

### Option B — Row cleanup in the normal development database

**Rejected.**

This would require one or more of:

- canonical `DELETE` or `TRUNCATE`;
- trigger suspension;
- owner-role or superuser access in the test process; or
- a persistent administrative cleanup function.

It would weaken the boundary being tested and would make a failed or malicious
test capable of mutating ordinary development accounting history.

### Option C — Schema-only disposable database

**Selected.**

A unique disposable database gives each canonical test run the same PostgreSQL
transaction, uniqueness, lock, trigger, role, and multi-connection semantics as
development without committing rows to the normal development database.

Cleanup is disposal of the isolated test database by an administrative
provisioner. It is not deletion through `ledgerly_api` and not an accounting
operation.

## 6. Selected canonical integration-test mechanism

### 6.1 Isolation unit

Use one uniquely named disposable PostgreSQL database per invocation of the
canonical integration test command.

The database must:

1. be created by the development administrative principal `postgres` through
   the Replit-managed development database administrative channel;
2. start from the exact two-stage bootstrap in section 6.2, never a data clone,
   template, or schema dump of live development;
3. contain no business, development, or prior test rows;
4. have the same canonical constraints, indexes, ownership, grants, four guard
   functions, and five `ENABLE ALWAYS` triggers as the normal development
   database;
5. grant the test process only a direct `ledgerly_api` connection; and
6. be dropped as a database after all test connections close, whether tests
   pass or fail.

The normal development database is never a fallback. Provisioning failure must
fail the suite before its first fixture insert.

### 6.2 Exact authoritative bootstrap

The authoritative bootstrap is exactly:

1. **Application schema:** `lib/db/src/schema/index.ts`, selected by
   `lib/db/drizzle.config.ts` and applied to the empty disposable database with
   `pnpm --filter @workspace/db run push`. `push-force`, a live database dump,
   a copy of `heliumdb`, or an inferred schema is prohibited.
2. **Canonical security overlay:** the later implementation must add one
   versioned, reviewed SQL artifact at
   `scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql`. That artifact is the
   sole executable authority for the disposable database's:
   - ownership transfers for the five canonical tables;
   - exact ordinary and canonical grants/revocations;
   - database and `public` schema ACL;
   - four approved `SECURITY DEFINER` guard functions with fixed
     `search_path`;
   - five named triggers; and
   - `ENABLE ALWAYS` state.

The overlay may reference the existing cluster roles `ledgerly_api` and
`ledgerly_canonical_owner`, but it must not create, alter, grant membership in,
or change credentials for either role. The roles must first pass the approved
RS-01 role-attribute and membership checks.

The implementation review must record SHA-256 digests for
`lib/db/src/schema/index.ts`,
`lib/db/drizzle.config.ts`, and
`scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql`. Those exact digests are
bound into the run identity before a disposable database is opened to the test
process. Any source change invalidates the run and requires a fresh review.

This package selects the overlay path and contract but does not create it. No
canonical integration run is permitted until the later implementation creates
that artifact and an independent review confirms it reproduces the current
approved development ownership, ACL, function, constraint/index, and trigger
catalog exactly.

### 6.3 Immutable run identity

Each run receives a cryptographically random UUID. Its database name is exactly:

```text
ledgerly_canonical_test_<run UUID as 32 lowercase hexadecimal characters>
```

Before applying the application schema, `postgres` creates a private
`ledgerly_test_control` schema and one-row `run_identity` table owned by
`postgres`. `ledgerly_api`, `PUBLIC`, and
`ledgerly_canonical_owner` receive no `USAGE` or table privileges on that
schema.

The immutable run record contains:

- run UUID;
- expected database name;
- environment marker exactly `development-disposable-test`;
- UTC creation timestamp;
- creator identity exactly `postgres`;
- originating project task reference;
- application-schema digest;
- security-overlay digest;
- expected test command; and
- a random run-binding nonce whose SHA-256 is also recorded in the external run
  evidence.

The row is inserted once before tests and is never updated. The administrative
cleanup operation must match the database name, run UUID, environment marker,
creator, both schema digests, and binding nonce against the external run
evidence before terminating a session or dropping the database. A name or
prefix match alone is never authority.

### 6.4 Provisioning and administrative privilege boundary

The provisioner and test process are separate trust boundaries.

The only approved administrative principal is the development cluster role
`postgres`, with both `current_user` and `session_user` verified as `postgres`.
It is accessed only through the Replit-managed development database
administrative channel by an explicitly authorised human or agent operation.
Its credential is never exposed to or inherited by a project script, test
child process, API workflow, application route, or `ledgerly_api`.

There is no reusable application-facing administrative provisioner. The
authorised administrative runbook may only:

- create a database with an allowlisted generated test-database prefix;
- insert and verify the exact run-identity binding;
- apply the two exact bootstrap stages in section 6.2;
- apply the approved RS-01 database/schema ACL, object ownership, functions,
  and trigger state;
- grant direct database access to `ledgerly_api`;
- verify an empty canonical and legacy baseline;
- terminate sessions connected to that exact disposable database after the
  suite; and
- drop that exact disposable database.

Before terminating sessions or dropping a database, `postgres` must verify:

- exact run UUID and expected database name;
- exact `development-disposable-test` marker;
- exact creator identity;
- exact source digests and binding nonce;
- the matching external run-evidence record;
- no connection from a normal API workflow; and
- the target is neither `heliumdb` nor any known production database.

The administrative operation must refuse to operate when:

- the target is the normal development database;
- the target is a production database;
- the generated name does not match the strict test allowlist;
- the complete internal/external run binding does not match;
- the database is unknown to the current authorised test run;
- any canonical or legacy row exists before test setup;
- expected ownership, grants, functions, or trigger states differ; or
- a credential or connection string would be printed.

If the Replit-managed administrative channel cannot target and bind the exact
disposable database without exposing administrative credentials to project
code, stop. Do not add a general-purpose admin script or environment secret as
a workaround.

### 6.5 Test-process connection

The canonical test child process receives an ephemeral `DATABASE_URL` that
selects the disposable database but authenticates directly as
`ledgerly_api`.

This value:

- exists only for the child test process;
- does not modify the workspace development secret;
- is not inherited by the API workflow;
- is never printed, persisted, committed, or placed in test output; and
- is cleared when the process exits.

The test must assert `current_user` and `session_user` are both
`ledgerly_api` before inserting fixtures.

### 6.6 Concurrency and multi-connection behavior

Concurrency tests open at least two independent pool connections to the same
disposable database and run the actual public canonical command concurrently.

Each concurrency case must include an explicit test-only synchronization
barrier or latch around the contested operation:

1. connection A and connection B begin independently;
2. both report that they have reached the defined pre-conflict synchronization
   point;
3. the test fails on timeout if either connection does not arrive;
4. one barrier release lets both proceed into the contested lock/uniqueness
   operation; and
5. the test records connection/backend identities, release time, results, and
   final database state.

Two unsynchronised promises are not concurrency evidence. The barrier may
coordinate test execution but must not replace, mock, or serialize the actual
PostgreSQL lock, transaction, or uniqueness behavior.

They must prove:

- one durable effect for the same idempotency identity;
- one linked journal for the winning effect;
- retry-safe equivalent results;
- no partial journal, line, relation, effect, or audit graph;
- actual lock/uniqueness behavior across connections;
- deterministic retry behavior after lock timeout or deadlock where tested; and
- no use of a privileged session.

Tests must not be serialized onto one transaction merely to make rollback easy.

### 6.7 Preventing normal-development contamination

Before the suite:

- capture read-only normal-development counts for the five canonical tables,
  legacy `journal_entries`, and `Canonical posting %` companies;
- verify the test database name differs from the normal development database;
  and
- verify the disposable baseline is empty.

After the suite and after disposable-database disposal:

- re-read the normal-development counts;
- require byte-for-byte equality of the captured count manifest;
- require the normal API identity and health check to remain unchanged; and
- fail verification if any new normal-development fixture is found.

No canonical row-cleanup hook may remain in the test suite.

## 7. Required implementation changes if later authorised

Only the following changes would be in scope:

1. Add the reviewed SQL overlay at
   `scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql`; do not add a reusable
   database-admin command to application or test code.
2. Add a non-privileged test-run coordinator that accepts an already
   provisioned disposable API-role URL and the externally created run identity.
   It must have no database-create/drop or session-termination capability.
3. Change the canonical integration-test command to:
   - verify the internal/external run identity and source digests;
   - launch the suite with its ephemeral API-role connection;
   - close all pools;
   - emit the non-secret completion evidence required for the separate
     administrative disposal step; and
   - verify the normal-development before/after manifest.
4. Remove canonical row deletion from `cleanCompanies` and other teardown
   paths.
5. Preserve unique per-test company, source, effect, and idempotency identities
   so tests can coexist inside one disposable run without row cleanup.
6. Add explicit runtime-identity, empty-baseline, privilege, ownership, and
   trigger-state assertions to the suite.
7. Add the explicit two-connection synchronization barrier and timeout evidence
   required by section 6.6.

No application posting behavior, production code path, canonical schema,
normal-development secret, or runtime role grant is approved to change by this
package.

## 8. Test-isolation privilege boundary

| Principal | Permitted | Prohibited |
|---|---|---|
| `ledgerly_api` test process | Same direct login and exact DML/EXECUTE rights as approved development API | Canonical update/delete/truncate, trigger changes, ownership, role assumption, database create/drop |
| `ledgerly_canonical_owner` | Own protected test-database objects and guard functions | Login, test execution, ordinary application access |
| Development `postgres` through the Replit-managed administrative channel | Exact run-bound disposable database create/bootstrap/session-termination/drop and the separately approved one-time fixture reset | Application test execution, exposure to project code, production access, unknown database access, generic cleanup |
| Normal development API | Continue current RS-01 runtime behavior | Awareness of or access to the disposable database |

The test environment is valid only if the API-role privilege matrix matches the
approved normal-development matrix.

## 9. Required regression and acceptance evidence

A later authorised implementation must pass:

1. direct disposable-session identity checks;
2. complete role, ownership, ACL, grant-option, membership, function-owner, and
   trigger-state checks;
3. permitted ordinary application DML;
4. permitted canonical inserts and only the approved effect transitions;
5. rejected canonical header, line, relation, and audit mutation;
6. rejected effect identity changes and invalid status transitions;
7. balanced posting, idempotent retry, correction, reversal, SC-01 identity,
   company isolation, final revalidation, failure injection, and concurrency;
8. BL-01-FI company-scope tests;
9. existing matcher, collections, VAT scenario, Phase 5, and Phase 6 suites;
10. the VAT integration suite where its own fixture isolation is confirmed;
11. workspace typecheck and API build;
12. API restart, scheduler access, logs, and health;
13. empty disposable baseline and successful database disposal; and
14. unchanged normal-development canonical, legacy, and fixture manifests.

The test command must also prove that a forced test failure still disposes of
only the exact disposable database and never attempts canonical row deletion.

## 10. Test-isolation stop conditions

Stop without broadening access if:

- the authoritative SQL overlay does not exist, has not passed independent
  review, or its digest differs from the bound run identity;
- schema-only provisioning cannot reproduce the approved trigger and ownership
  boundary;
- the test requires a privileged application connection;
- the disposable target cannot be distinguished conclusively from development
  and production;
- a child process could inherit administrative credentials;
- the suite can fall back to the normal development database;
- the concurrency test requires trigger suspension or canonical cleanup;
- normal-development counts change;
- the disposable database cannot be dropped without affecting another
  consumer;
- any connection string or credential would be logged; or
- implementation expands beyond test harness/configuration work.

## 11. Existing fixture classification

The retained rows are:

- development-only;
- synthetic and non-business;
- created solely by the controlled canonical integration tests;
- not migrated customer or accounting evidence;
- not production data;
- not authoritative business records;
- structurally valid and internally linked;
- unrelated to legacy `journal_entries`;
- not evidence of a real customer transaction or business accounting event;
  and
- currently protected by the same canonical database boundary as all other
  posted rows.

This classification permits an approval request for #40's isolated test reset.
It does not let the application treat the rows as drafts, delete them through
generic CRUD, or manufacture accounting reversals to make them disappear.

The classification is supported by the exact provenance:

- six generated `Canonical posting ... <UUID>` companies;
- test-only `fixture_document/fixture_posting` sources;
- test-generated `canonical-owner-...` actors;
- test-specific source, effect, correction, reversal, and idempotency values;
- no migrated source workflow, customer, supplier, invoice, bill, bank, VAT, or
  legacy journal rows;
- one workflow-activity setup row per generated test company; and
- the exact 70-row manifest and relationship checks in section 4.

An accounting reversal or correction is not the right disposition:

- it would preserve rather than remove the synthetic fixture graph;
- it would create additional synthetic posted accounting and audit evidence;
- it would misstate the reason as an accounting event; and
- it would confuse operational test hygiene with business accounting semantics.

### 11.1 Governance compatibility

- **DEC-04:** The runtime accounting model remains immutable and additive. The
  reset is not an accounting correction, does not create an application
  mutation path, and cannot affect business accounting. It is a one-time
  development environment reset for a proven synthetic graph.
- **DEC-17:** The rows are not customer accounting, legal, VAT,
  reconciliation, approval, or migrated evidence. No company-life or legal
  retention period attaches to synthetic integration-test state. The external
  reset evidence is retained as governance evidence.
- **DEC-18:** The rows are classified as temporary, synthetic,
  non-authoritative test artefacts, not authoritative business records.
  Disposal is allowed only through the controlled class-based exception and
  only while every provenance and dependency check still passes.
- **#40:** Section 18.2 expressly requires test postings in a controlled
  environment to be removed or restored through an approved isolated test
  reset, never through a production accounting deletion path. Section 12 is
  that isolated reset.
- **#44:** All runtime/API protections remain permanent. The administrative
  suspension below is an explicit one-time development exception executed by
  `postgres`, never by `ledgerly_api`, restored in the same atomic operation,
  and unavailable afterward.

If any provenance fact no longer supports this non-business,
non-authoritative-test classification, the governance basis fails and the
reset must not occur.

## 12. Selected one-time fixture-disposition mechanism

### 12.1 Selection

Use one explicit development-only administrative isolated-test reset against
the exact 70-row ID-and-hash manifest in section 4.4.

This is an exceptional test-environment hygiene operation under #40 section
18.2. It is not an ordinary accounting correction, DEC-18 lifecycle deletion
for real business evidence, an API capability, or a reusable product feature.

The exact administrative principal is the development cluster role `postgres`
accessed through the Replit-managed development database administrative
channel. Before the operation, both `current_user` and `session_user` must equal
`postgres`. The session must target `heliumdb`; it must not use the API
`DATABASE_URL`, and no credential may be passed to project code.

The approved `ENABLE ALWAYS` guards reject deletion even for ordinary owners,
so targeted physical disposal cannot occur while the guards execute. Trigger
suspension is therefore unavoidable for this selected mechanism. The
exception is explicit and limited to the five named triggers and one atomic
transaction in section 12.3. It grants no standing exception and installs no
cleanup function, route, migration, script, role, membership, or reusable
authority.

### 12.2 Required evidence before any reset

Before a later reset may begin:

1. stop only the development API workflow to prevent concurrent writes;
2. confirm the target is the development `heliumdb` database and not
   production;
3. verify the session is administrative and not `ledgerly_api`;
4. reproduce all 70 exact IDs and SHA-256 snapshots from section 4.4;
5. enumerate every foreign key capable of referencing a manifested row and
   every public table with a `company_id` column, and prove there is no
   unexpected dependent row;
6. capture the machine-readable 70-row manifest, dependency sweep, counts, and
   hashes in the governed pre-reset evidence record in section 12.4;
7. capture total counts and hashes for every unaffected canonical and legacy
   row set; and
8. abort on any difference from the approved provenance in section 4.

The approval must be cancelled rather than widened if any affected row no
longer matches the exact fixture graph.

### 12.3 Atomic administrative reset

If later and separately authorised, the reset must run as one administrative
transaction with an exclusive maintenance boundary:

1. acquire an administrative advisory lock dedicated to this one-time reset;
2. lock the five canonical tables and affected ordinary fixture tables against
   concurrent writes;
3. suspend exactly these triggers with
   `ALTER TABLE ... DISABLE TRIGGER <exact_name>`:
   - `ledgerly_accounting_audit_events_guard` on
     `public.accounting_audit_events`;
   - `ledgerly_canonical_journal_relations_guard` on
     `public.canonical_journal_relations`;
   - `ledgerly_canonical_journal_lines_guard` on
     `public.canonical_journal_lines`;
   - `ledgerly_accounting_posting_effects_guard` on
     `public.accounting_posting_effects`; and
   - `ledgerly_canonical_journal_entries_guard` on
     `public.canonical_journal_entries`;
4. do not suspend any foreign-key, internal, unrelated, or unnamed trigger;
5. issue ID-only deletes, with each statement containing exactly the IDs in
   section 4.4 and an exact expected affected-row count, in this order:
   - 8 accounting audit event IDs;
   - 5 canonical relation IDs;
   - 16 canonical line IDs;
   - 8 posting effect IDs;
   - 8 canonical journal entry IDs;
   - 6 workflow activity IDs;
   - 4 company membership IDs;
   - 9 chart-of-account IDs; and
   - 6 company IDs;
6. reject every company-wide, prefix, wildcard, source-type-only, actor-only,
   or `company_id IN (...)` deletion predicate;
7. restore each named trigger with
   `ALTER TABLE ... ENABLE ALWAYS TRIGGER <exact_name>` before any commit;
8. re-run trigger, function-owner, table-owner, role, ACL, and no-membership
   checks;
9. prove every manifested ID is absent;
10. prove all non-manifested canonical, ordinary, and legacy counts and hashes are
   unchanged; and
11. commit only when every check passes.

Any error must roll back the complete transaction, including trigger-state
changes. No partial reset is acceptable. If connection outcome is uncertain,
keep the API stopped and use a new `postgres` administrative session to verify
transaction outcome and all five `ENABLE ALWAYS` states before any restart.

### 12.4 Audit evidence for the reset

The reset uses two concrete evidence files:

- `docs/governance/evidence/ledgerly-44-fixture-reset-<execution-uuid>-authorisation.json`,
  committed in a dedicated content-addressed version-control commit before
  execution; and
- `docs/governance/evidence/ledgerly-44-fixture-reset-<execution-uuid>-result.json`,
  committed in a second dedicated content-addressed version-control commit
  immediately after commit or rollback.

The SHA-256 digest and commit identity of both files must also be recorded in
the platform-managed Task #46 validation/completion record and its Replit
checkpoint. A working-tree file, chat message, terminal output, or mutable
local note alone is not evidence.

Repository and workspace access controls restrict the records to authorised
collaborators. The files and their content-addressed commits must be retained
for at least as long as #40, #44, RS-01, and Task #46 governance evidence is
retained, and must remain reviewable after execution.

Together the two records must contain:

- the approved package reference;
- development-only target metadata without credentials;
- operator and reviewer identity;
- start and completion timestamps;
- exact 70-row ID-and-hash manifest;
- the foreign-key and company-owned-table dependency sweep;
- named triggers temporarily suspended and restored;
- before and after counts and hashes;
- all verification outcomes;
- transaction commit or rollback outcome; and
- confirmation that production was not contacted.

Do not insert a misleading business accounting event or correction merely to
audit administrative test-fixture disposal.

### 12.5 After the reset

After a successful reset:

1. restart only the development API workflow;
2. verify direct `ledgerly_api` identity;
3. verify all five triggers remain `ENABLE ALWAYS`;
4. rerun the complete RS-01 privilege and mutation-resistance matrix;
5. rerun health and scheduler access;
6. run canonical tests only through the approved disposable-database harness;
7. prove the normal development database remains fixture-free; and
8. keep production posting disabled.

## 13. Fixture-disposition privilege boundary

The one-time reset must never:

- grant canonical mutation rights to `ledgerly_api`;
- make `ledgerly_api` a member of the owner or administrative role;
- expose the operation through an API route, UI, generic CRUD, function
  executable by `ledgerly_api`, migration, or recurring script;
- use a company-name wildcard as the deletion authority;
- use company ownership as the deletion authority or affect any row outside the
  exact 70-row manifest;
- delete real business accounting or audit evidence;
- be reused for production or ordinary development cleanup; or
- remain installed as latent administrative functionality.

If a safe, atomic, exact reset cannot be proved, the fixtures must remain
retained and isolated. Failure to dispose of synthetic fixtures is safer than
weakening canonical immutability.

## 14. Fixture-disposition stop conditions

Stop without cleanup if:

- any manifested row is missing or its SHA-256 differs;
- any unexpected dependent row exists or refers to the manifested graph;
- an affected source, actor, or company no longer has unambiguous synthetic
  provenance;
- any trigger cannot be restored to `ENABLE ALWAYS` inside the transaction;
- any ownership, role, ACL, or function-security check changes;
- the operation requires a persistent bypass;
- the operation cannot preserve unaffected rows byte-for-byte;
- the administrative evidence record cannot be produced;
- the target could be production;
- production credentials or data are encountered; or
- the reset would become an ordinary accounting-deletion path.

## 15. Unrelated mockup build issue

The workspace-wide build currently reaches the mockup sandbox and fails because
that artifact's Vite configuration requires a `PORT` environment variable
during build. The API-specific build and workspace typecheck pass.

This issue is unrelated and non-blocking for the present test-isolation and
fixture-disposition decision. It does not justify broadening database access or
expanding this package. If later investigation shows a shared configuration
dependency, that finding requires separate scope and approval.

## 16. Approval choices

### Approve

Approval means:

- accept the schema-only disposable-database design as the required canonical
  integration-test boundary;
- accept the exact 70-row one-time administrative isolated-test reset design
  and its explicit five-trigger development exception;
- preserve every privilege and production boundary in this package; and
- require a later explicit implementation instruction before any change.

### Reject

Rejection means:

- do not refactor the tests;
- do not dispose of the retained fixtures;
- leave RS-01 protections in place;
- keep Task #46 incomplete; and
- keep production posting disabled.

No partial approval should be inferred from discussion or from the existence of
the retained fixtures.

READY FOR TEST-ISOLATION / FIXTURE-DISPOSITION APPROVAL