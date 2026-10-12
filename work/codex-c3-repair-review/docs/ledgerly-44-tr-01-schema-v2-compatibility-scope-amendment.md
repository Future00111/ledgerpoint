# Ledgerly #44-TR-01 schema-v2 compatibility scope amendment

**Date:** 2026-09-21  
**Status:** APPROVED — INCORPORATED INTO CANDIDATE IMPLEMENTATION PACKAGE  
**Parent package:** `docs/ledgerly-44-tr-01-implementation-identity-recovery-implementation-approval-package.md`  
**Purpose:** Add exactly two files required to complete the already-approved
schema-v2 qualification binding

## 1. Reason for this amendment

The approved identity-recovery package removes the ambiguous legacy
`sourceCommit` / `source_commit` identity and replaces it with distinct
workflow-source and implementation-source identities.

The currently authorized coordinator, run-control SQL, evidence schema,
workflow, report, and focused test can implement most of that contract.
However, qualification cannot complete because two existing files remain bound
to the legacy identity:

- `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs`; and
- `scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql`.

These files were not included in the original candidate change inventory.
Leaving either unchanged would make the schema-v2 private binding
non-executable or force a prohibited legacy compatibility fallback.

This amendment expands candidate `C` by those two paths only.

## 2. Disposable runner requirement

### 2.1 Current legacy behavior

`artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs` currently:

- requires `LEDGERLY_CANONICAL_TEST_SOURCE_COMMIT`;
- reads it into `ci.sourceCommit`;
- constructs the private verification JSON with
  `sourceCommit: ci.sourceCommit`; and
- passes that JSON to
  `public.ledgerly_verify_external_disposable_run(...)`.

This collapses workflow source `S` and implementation source `C` into one
ambiguous value. It cannot represent activated mode, where `S=G` while the
qualified implementation remains `C`.

### 2.2 Exact schema-v2 replacement

The runner must remove:

- required environment variable
  `LEDGERLY_CANONICAL_TEST_SOURCE_COMMIT`;
- `ci.sourceCommit`; and
- binding property `sourceCommit`.

It must require and validate:

- `LEDGERLY_CANONICAL_TEST_IDENTITY_MODE`;
- `LEDGERLY_CANONICAL_TEST_SOURCE_REF`;
- `LEDGERLY_CANONICAL_TEST_REF_PROTECTED`;
- `LEDGERLY_CANONICAL_TEST_WORKFLOW_SOURCE_COMMIT`;
- `LEDGERLY_CANONICAL_TEST_IMPLEMENTATION_SOURCE_COMMIT`;
- `LEDGERLY_CANONICAL_TEST_ANCESTRY_VERIFIED`;
- `LEDGERLY_CANONICAL_TEST_WORKFLOW_CHECKOUT_CLEAN`; and
- `LEDGERLY_CANONICAL_TEST_IMPLEMENTATION_CHECKOUT_CLEAN`.

The values must map without aliases to the private JSON binding:

- `identityMode`;
- `ciSourceRef`;
- `ciRefProtected`;
- `workflowSourceCommit`;
- `implementationSourceCommit`;
- `ancestryVerified`;
- `workflowCheckoutClean`; and
- `implementationCheckoutClean`.

The runner must enforce:

- both commit identities are lowercase full 40-character Git SHAs;
- each protected/ancestry/clean environment value equals the literal string
  `"true"`; every other string, including case variants and truthy-looking
  values, is rejected;
- the four accepted strings are converted to JavaScript boolean `true` before
  binding construction, so `ciRefProtected`, `ancestryVerified`,
  `workflowCheckoutClean`, and `implementationCheckoutClean` are actual JSON
  booleans, never strings;
- candidate mode uses exact ref
  `refs/heads/tr01/implementation-identity-candidate`, requires `S=C`, and
  requires and emits `ancestryVerified: true`;
- activated mode uses exact ref `refs/heads/main`;
- no legacy variable or binding property can satisfy a missing v2 value; and
- unknown mode, ref, mixed identity, malformed SHA, false flag, or legacy-only
  input fails before canonical tests run.

The runner remains an unprivileged `ledgerly_api` process. It does not acquire
database-administrator authority and does not select either identity from
caller-controlled application input.

## 3. Disposable overlay requirement

### 3.1 Current legacy behavior

`scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql` defines the
postgres-owned, fixed-search-path, `SECURITY DEFINER` function:

`public.ledgerly_verify_external_disposable_run(uuid, jsonb, text)`

The function currently accepts a binding only when:

`r.source_commit = p_binding->>'sourceCommit'`

The version-2 run-control table removes `source_commit`, so this predicate
cannot execute against the approved fresh schema. Retaining a shadow
`source_commit` column or silently deriving it from one of the v2 identities
would preserve the exact ambiguity schema v2 is intended to remove.

### 3.2 Exact schema-v2 replacement

The verifier must remove the legacy predicate and compare every v2 field
directly:

- `r.identity_mode = p_binding->>'identityMode'`;
- `r.ci_source_ref = p_binding->>'ciSourceRef'`;
- `r.ci_ref_protected IS TRUE` and
  `p_binding->'ciRefProtected' = 'true'::jsonb`;
- `r.workflow_source_commit =
  p_binding->>'workflowSourceCommit'`;
- `r.implementation_source_commit =
  p_binding->>'implementationSourceCommit'`;
- `r.ancestry_verified IS TRUE` and
  `p_binding->'ancestryVerified' = 'true'::jsonb`;
- `r.workflow_checkout_clean IS TRUE` and
  `p_binding->'workflowCheckoutClean' = 'true'::jsonb`; and
- `r.implementation_checkout_clean IS TRUE` and
  `p_binding->'implementationCheckoutClean' = 'true'::jsonb`.

These JSONB comparisons are type-sensitive. Missing values, JSON null, string
`"true"`, false, numbers, arrays, objects, and other non-boolean values return
false and are not cast or coerced. The function must continue to compare all
existing run UUID, database, environment, CI, digest, command, nonce, image,
expiry, production-prohibition, and `heliumdb`-prohibition fields.

The function signature, owner, fixed `search_path`, `SECURITY DEFINER`
attribute, PUBLIC revocation, and `ledgerly_api` execute-only grant remain
unchanged.

## 4. Runtime and accounting semantics

Neither file expansion changes accounting behavior outside qualification
compatibility.

The amendment does not change:

- canonical journal, line, relation, effect, or audit rules;
- posting calculations or transaction behavior;
- application routes or normal API runtime;
- database schema used by the Ledgerly product;
- `ledgerly_api` product privileges;
- `ledgerly_canonical_owner` ownership;
- immutable or constrained-transition triggers;
- production configuration or credentials;
- the canonical test command; or
- any production or `heliumdb` target.

The overlay change is confined to the disposable external-CI verification
function. The runner change is confined to
`LEDGERLY_CANONICAL_TEST_MODE=external-ci` binding verification before the
approved disposable canonical suite runs.

Every run uses a fresh disposable PostgreSQL database. There is no persistent
row migration, backfill, mixed-version table, or production migration.

## 5. Exact tests and rejection probes

### 5.1 Disposable runner tests

Focused tests must prove that the runner:

1. accepts a complete candidate-mode v2 environment only when `S=C`, the ref
   is the exact protected candidate ref, and all flags are true;
2. accepts a complete activated-mode v2 environment only with exact main ref,
   distinct valid `S` and `C` where applicable, and all flags true;
3. emits all eight v2 private-binding properties with exact values;
4. never emits `sourceCommit`;
5. rejects missing, empty, uppercase, short, nonhex, or mismatched commit
   identities;
6. rejects unknown modes and wrong refs;
7. rejects candidate mode when `S != C`;
8. rejects false, missing, malformed, or truthy-nonboolean protected,
   ancestry, or clean flags;
9. rejects case variants and every value other than literal environment string
   `"true"` for those flags;
10. rejects legacy-only
   `LEDGERLY_CANONICAL_TEST_SOURCE_COMMIT`;
11. rejects mixed legacy/v2 identity input rather than preferring either form;
12. emits actual JSON boolean `true` for all four flags, including candidate
    `ancestryVerified`;
13. performs binding verification before invoking the canonical test command;
    and
14. preserves the existing parent-URL, production-marker, Replit, `PG*`,
    credential, target, digest, image, and runtime-role rejection behavior.

### 5.2 Overlay and SQL parity tests

Static and disposable-database probes must prove:

1. no `r.source_commit` or `p_binding->>'sourceCommit'` reference remains in
   the external verifier;
2. each of the eight v2 JSON fields maps to its exact run-control column;
3. all existing binding predicates remain present;
4. candidate-mode valid binding returns true;
5. activated-mode valid binding returns true;
6. each missing, null, malformed, false, or mismatched v2 field returns false;
7. JSON string `"true"`, numbers, arrays, objects, and other non-boolean flag
   values return false without a cast error;
8. version-1, legacy-only, and mixed identity JSON return false;
9. swapped workflow and implementation SHAs return false;
10. wrong mode/ref combinations return false;
11. a row/binding mismatch in either digest domain returns false;
12. incorrect nonce, expired row, production allowance, or `heliumdb`
    allowance returns false;
13. function owner remains `postgres`;
14. `SECURITY DEFINER` and fixed search path remain;
15. PUBLIC has no execute privilege;
16. `ledgerly_api` has execute-only access and no private table/schema access;
    and
17. all canonical immutable and constrained-transition triggers remain
    `ENABLE ALWAYS`.

### 5.3 Integrated qualification probes

The complete candidate qualification must additionally prove:

- schema version 2 accepts the same C/S values verified by the runner and
  overlay;
- evidence, private run-control row, workflow context, runtime binding, and
  source digests agree;
- no legacy identity appears in accepted evidence or the private row;
- canonical posting and concurrency behavior remain unchanged;
- all existing negative controls pass;
- cleanup and exact resource absence pass; and
- production contact and `heliumdb` contact remain zero.

Targeted tests do not replace the complete TI-03 candidate qualification.

## 6. Exact expanded candidate inventory

If this amendment is explicitly approved, add only:

- `scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql`; and
- `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs`

to the previously approved candidate `C` inventory.

No other executable, SQL, schema, workflow, runtime, package, governance, or
test path is added by this amendment.

The existing focused test file
`scripts/ci/run-ledgerly-canonical-postgresql.test.mjs` remains the approved
location for identity-contract tests. Existing canonical integration tests are
validation inputs and must not be edited under this amendment.

## 7. Stop conditions

Stop and request further approval if implementation requires:

- another file;
- retention or derivation of legacy `source_commit` / `sourceCommit`;
- a product-schema migration or persistent compatibility layer;
- a changed verifier signature or privilege expansion;
- weakened owner, ACL, search-path, trigger, role, or target controls;
- accounting/runtime behavior outside external-CI qualification;
- production or `heliumdb` access;
- GitHub configuration, publication, candidate creation, qualification, or
  Phase A under this design-only amendment; or
- acceptance of legacy or mixed evidence as schema-v2 success.

## 8. Approval decision

This amendment was explicitly approved on 2026-09-21. Its exact two-file
expansion is incorporated into the authoritative candidate `C` inventory.

Candidate implementation may resume under the existing implementation
approval. This amendment does not authorize candidate creation, GitHub
configuration, publication, qualification, database access, or Phase A.
