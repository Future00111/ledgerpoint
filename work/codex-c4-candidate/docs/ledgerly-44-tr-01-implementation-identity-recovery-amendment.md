# Ledgerly #44-TR-01 implementation identity recovery amendment

**Date:** 2026-09-21  
**Status:** APPROVED — DESIGN / GOVERNANCE ONLY  
**Scope:** Prospective recovery of the unavailable TR-01 implementation commit
identity  
**Implementation authority:** None

## 1. Purpose

The previously reviewed local implementation commit is no longer recoverable:

- former branch: `feat/ti03-option-e-redesign`;
- former commit: `b03627099616675924a88e9a30c7b5e6547c9166`; and
- current status:
  **HISTORICAL IMPLEMENTATION IDENTITY — OBJECT LOST / UNAVAILABLE**.

The former SHA must not be recreated, reproduced, fabricated, or assigned to a
replacement commit. Historical references remain truthful historical records
and must not be rewritten to imply that a future replacement identity existed
at the time of an earlier review.

This amendment defines a prospective identity-recovery process. It does not
claim that the current tree is byte-identical, equivalent, or otherwise proven
to be the lost commit.

## 2. Recovery basis

The recovery inspection found no authoritative copy of the former branch,
commit object, reflog entry, original bundle, GitHub object, or usable
checkpoint. Surviving implementation files, packages, reports, and historical
validation claims are reconciliation inputs only.

At the time of this amendment, the inspected tracked tree was clean at:

`0c5f869a3754887ce0911ad266d17b39b35fcf6f`

That SHA is a recovery starting point, not an approved replacement identity.
Old static-validation claims are historical context and cannot prove a future
candidate.

## 3. Prospective identities

The recovery model uses separate identities:

- `C`: the immutable candidate implementation commit;
- `S`: the commit supplying the workflow and governance source for a run; and
- `A`: the exact reviewed activation pull-request head; and
- `G`: the resulting protected-main merge commit.

During candidate qualification, `S = C`. After activation, `S = G` while the
qualified implementation remains `C`.

Neither `C` nor `G` restores or replaces the historical meaning of
`b036270...`. Only an explicit final identity approval may designate `C`:

**NEW AUTHORITATIVE IMPLEMENTATION IDENTITY**

## 4. Exact candidate branch

The only approved candidate ref is:

`refs/heads/tr01/implementation-identity-candidate`

Before use, it must be configured as a protected branch with review required,
force push and deletion prohibited, and no rebase, squash, amend, or cherry-pick
after review. Qualification may run only through protected
`workflow_dispatch`.

## 5. Mandatory fresh revalidation

Before `C` may become authoritative, the exact candidate must pass:

1. complete approved-inventory reconciliation and scoped diff review;
2. frozen, script-disabled dependency installation;
3. JavaScript syntax checks;
4. library and application TypeScript checks;
5. relevant unit and pure tests;
6. SQL, overlay, run-control, schema, grant, ACL, owner, function, and trigger
   comparison;
7. workflow permission, event, ref, action-pin, image-pin, and environment
   review;
8. strict evidence-schema compilation and rejection probes;
9. secret scanning;
10. deterministic execution-manifest recomputation;
11. fresh independent implementation and security review;
12. complete external PostgreSQL TI-03 qualification, including real
    database-backed canonical execution, concurrency, all negative controls,
    runtime-role verification, ownership/ACL/trigger verification, route
    isolation, cleanup, and accepted non-secret evidence; and
13. after activation, a protected-main run binding workflow source `G` to
    implementation source `C`.

An unavailable, incomplete, or failed item is a blocking failure. Phase A
remains prohibited.

## 6. Candidate qualification

The candidate process is:

1. establish and record a clean reconciled implementation tree;
2. complete local/static validation and independent read-only review;
3. create one immutable commit `C`;
4. publish exact `C` to the approved protected candidate ref;
5. have repository administration set the protected environment value
   `LEDGERLY_APPROVED_CANDIDATE_SHA=C`, with environment reviewers required;
6. fail closed unless `GITHUB_SHA`, checked-out implementation `HEAD`, the
   protected ref, and the environment value all identify exact `C`;
7. record `workflowSourceCommit=C` and `implementationSourceCommit=C`; and
8. complete TI-03 qualification and retain accepted evidence and its SHA-256.

Passing candidate qualification does not itself make `C` authoritative.

## 7. Governance activation

Only after candidate qualification, evidence review, fresh independent review,
and explicit final identity approval may `C` be designated the new
authoritative implementation identity.

After final identity approval, prepare exact activation head `A` so that `C`
and the recorded protected-main base `B` are both ancestors of `A`. Review the
exact `A -> B` pull-request diff. GitHub must create `G` using the ordinary
two-parent merge-commit method only:

- `G^1 = B`;
- `G^2 = A`; and
- protected `main` tip equals exact `G`.

Squash, rebase, fast-forward substitution, manual SHA assignment, and any
identity-changing alternative are prohibited. If `main` advances from `B`
before merge, approvals are invalidated and a new activation head/base pair
must be prepared and reviewed. The approved `A`/`G` tree inventory is limited
to:

- append-only governance records named by this amendment; and
- `.github/workflows/ledgerly-canonical-postgresql.yml`.

Any coordinator support for dual identities must already be in `C` and must
have been reviewed and qualified as part of `C`.

`G` is not known until the protected merge completes. It is verified
immediately from the protected-main tip and both exact parents, then recorded
in activated qualification evidence as workflow source `S`. It is never
embedded in or retroactively added to its own tree.

## 8. Activated dual-checkout contract

An activated run must:

1. treat `GITHUB_SHA` as workflow source `S`;
2. check out `S` at the workspace root;
3. check out exact `C`, from `LEDGERLY_APPROVED_CANDIDATE_SHA`, under
   `candidate/`;
4. invoke the reviewed coordinator from `candidate/`;
5. attribute the actual workflow digest to `S`;
6. attribute implementation and source-tree digests to `C`;
7. verify that root `HEAD = S`, candidate `HEAD = C`, `S` is protected main,
   `C` is a valid exact SHA, `C` is an ancestor of `S`, and both trees are
   clean; and
8. record distinct `workflowSourceCommit=S` and
   `implementationSourceCommit=C` fields.

The historical `sourceCommit` field must not be overloaded ambiguously.
The approved implementation package requires schema version 2, removes the
legacy field from new evidence and disposable run control, and rejects schema
version 1 for identity-recovery qualification. The disposable database is
created fresh for every run, so no durable SQL-row migration is permitted or
required.

No governance commit may contain or be amended to contain its own SHA. Exact
workflow source `S` is established at runtime from `GITHUB_SHA` and retained in
qualification evidence after the commit exists.

## 9. Gates and unchanged boundaries

Phase A remains blocked until:

- `G` is protected on `main`;
- `C` is verified as an ancestor of `G`;
- the protected environment remains bound to `C`;
- all active records agree; and
- the activated `S=G` / implementation `C` qualification passes.

This amendment does not authorize candidate creation, publication, executable
changes, GitHub configuration, qualification, production or `heliumdb` access,
48-B, Stage 3, #40-CF-01, deployment, publishing, or schema/accounting changes.

## 10. Authoritative record inventory

New records:

- `docs/ledgerly-44-tr-01-implementation-identity-recovery-amendment.md`;
- `docs/ledgerly-44-tr-01-implementation-identity-recovery-approval-record.md`;
- `docs/ledgerly-44-tr-01-implementation-identity-recovery-independent-review.md`;
- `docs/ledgerly-44-protected-github-baseline-ancestry-contract.md`; and
- `docs/ledgerly-44-tr-01-implementation-identity-recovery-implementation-approval-package.md`.

Existing records receive append-only prospective amendments only:

- `docs/ledgerly-44-tr-01-transactional-authority-provider-approval-package.md`;
- `docs/ledgerly-44-ti-03-external-ci-postgresql-implementation-approval-package.md`;
- `docs/ledgerly-44-ti-03-external-ci-postgresql-implementation-report.md`; and
- `docs/ledgerly-current-decision-register.md`.

Executable files remain separately gated:

- `.github/workflows/ledgerly-canonical-postgresql.yml`; and
- `scripts/ci/run-ledgerly-canonical-postgresql.mjs`.
