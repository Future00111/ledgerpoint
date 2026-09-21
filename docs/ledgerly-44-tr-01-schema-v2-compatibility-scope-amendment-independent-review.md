# Ledgerly #44-TR-01 schema-v2 compatibility scope amendment — independent review

**Date:** 2026-09-21  
**Review type:** Fresh independent read-only architecture and security review  
**Amendment:** `docs/ledgerly-44-tr-01-schema-v2-compatibility-scope-amendment.md`

## Review questions

The reviewer must determine:

1. whether both added files are strictly required for schema-v2 qualification;
2. whether legacy `source_commit` / `sourceCommit` behavior is identified
   exactly and removed rather than translated;
3. whether all approved C/S identity and protection fields are propagated
   without ambiguity;
4. whether the runner and overlay changes remain limited to external-CI
   qualification compatibility;
5. whether accounting, normal runtime, roles, ACLs, owners, triggers, and
   production boundaries remain unchanged;
6. whether tests cover valid candidate/activated bindings and every relevant
   legacy, mixed, malformed, mismatched, privilege, and cleanup rejection;
7. whether no third file expansion is required; and
8. whether implementation may resume only after explicit amendment approval.

## Current verdict

**PASS**

The initial review confirmed that both requested files are necessary and that
no third file expansion is required. It required these document corrections:

- use the already-approved producer names
  `LEDGERLY_CANONICAL_TEST_SOURCE_REF` and
  `LEDGERLY_CANONICAL_TEST_REF_PROTECTED`;
- require each boolean environment value to equal literal string `"true"`;
- convert accepted flag values to actual JSON boolean `true`, including
  candidate `ancestryVerified`; and
- use type-sensitive JSONB boolean comparisons in the overlay so strings,
  nulls, numbers, arrays, objects, missing values, and false cannot coerce or
  throw into acceptance.

The follow-up review confirmed:

- both added files are strictly required;
- legacy `sourceCommit` / `source_commit` is removed without alias,
  derivation, preservation, or translation;
- the eight schema-v2 identity fields propagate consistently through the
  approved environment, runner JSON, private row, and verifier;
- candidate mode requires `S=C` and actual JSON boolean
  `ancestryVerified: true`;
- changes remain confined to external-CI qualification compatibility;
- accounting and normal runtime semantics remain unchanged;
- owner, `SECURITY DEFINER`, fixed search path, ACL, role, trigger, target,
  production, and `heliumdb` protections remain unchanged;
- the tests and rejection probes are sufficient; and
- no third file expansion is required.

Security finding: none.

**TR-01 SCHEMA-V2 COMPATIBILITY SCOPE AMENDMENT READY — EXPLICIT APPROVAL
REQUIRED**

No implementation, validation, commit, GitHub configuration, publication,
PostgreSQL qualification, or Phase A authority is granted.

## Approval disposition

The amendment was explicitly approved on 2026-09-21 and incorporated into the
authoritative candidate `C` implementation package. A subsequent fresh
independent package review passed and found that no third executable file is
required.

Candidate implementation may resume within the exact approved eight-file
inventory. Candidate creation, GitHub configuration, publication, database
access, qualification, and Phase A remain unauthorized.