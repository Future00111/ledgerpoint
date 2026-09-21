# Ledgerly #44-TR-01 implementation identity recovery — implementation approval package

**Date:** 2026-09-21  
**Status:** PLANNING / APPROVAL ONLY — NO IMPLEMENTATION AUTHORISED  
**Dependency:** Approved identity-recovery amendment and approval record  
**Decision requested:** Approval to implement this exact identity-recovery
boundary

> This package is non-executable. It does not modify code, workflows, packages,
> schema, databases, GitHub settings, branches, task state, production,
> `heliumdb`, or accounting data. It does not authorize qualification or Phase
> A.

## 1. Objective

Implement the smallest fail-closed mechanism needed to reconcile the surviving
TR-01/TI-03 implementation state, create one immutable candidate identity,
qualify it on the protected GitHub runner, approve it prospectively, and
activate a dual-identity protected-main contract.

The historical commit
`b03627099616675924a88e9a30c7b5e6547c9166` remains
**HISTORICAL IMPLEMENTATION IDENTITY — OBJECT LOST / UNAVAILABLE**.

## 2. Exact implementation file inventory

Candidate `C` may change only the following executable or contract files:

- `.github/workflows/ledgerly-canonical-postgresql.yml`;
- `scripts/ci/run-ledgerly-canonical-postgresql.mjs`;
- `scripts/sql/ledgerly-44-ti-03-external-ci-run-control.sql`;
- `docs/governance/evidence/ledgerly-44-ti-03-evidence.schema.json`;
- `docs/ledgerly-44-ti-03-external-ci-postgresql-implementation-report.md`;
- `scripts/ci/run-ledgerly-canonical-postgresql.test.mjs`.

Reconciliation inputs that must not change merely to manufacture equivalence:

- `.dockerignore`;
- `.ci/ledgerly-canonical/Dockerfile.test`;
- `package.json`;
- `pnpm-lock.yaml`;
- `scripts/sql/ledgerly-44-rs-01-disposable-overlay.sql`;
- `artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs`;
- `artifacts/api-server/src/services/accounting/canonicalPosting.ts`; and
- `artifacts/api-server/src/services/accounting/canonicalPosting.integration.test.ts`.

If reconciliation proves that a file in the second list requires a substantive
change, implementation must stop and request an amended inventory before
creating `C`.

The reviewed activation pull-request head `A`, and therefore the resulting
governance activation tree at `G`, may change only:

- `.github/workflows/ledgerly-canonical-postgresql.yml`;
- `docs/ledgerly-44-tr-01-implementation-identity-recovery-amendment.md`;
- `docs/ledgerly-44-tr-01-implementation-identity-recovery-approval-record.md`;
- `docs/ledgerly-44-tr-01-implementation-identity-recovery-independent-review.md`;
- `docs/ledgerly-44-protected-github-baseline-ancestry-contract.md`;
- `docs/ledgerly-44-tr-01-implementation-identity-recovery-implementation-approval-package.md`;
- `docs/ledgerly-44-tr-01-transactional-authority-provider-approval-package.md`;
- `docs/ledgerly-44-ti-03-external-ci-postgresql-implementation-approval-package.md`;
- `docs/ledgerly-44-ti-03-external-ci-postgresql-implementation-report.md`; and
- `docs/ledgerly-current-decision-register.md`.

Coordinator, SQL, schema, runtime, package, and canonical-test changes are not
permitted in `G`.

No file in `A` or `G` may state or reserve `G`'s own SHA. `GITHUB_SHA` establishes
exact workflow source `S` only after `G` exists, and protected-main evidence
records it without amending `G`.

## 3. Current-tree reconciliation procedure

Before editing:

1. record full current `HEAD`, branch, tracked-tree state, and untracked files;
2. verify the lost branch and object remain unavailable without altering refs;
3. enumerate every file named by the TI-03 implementation report, TR-01
   package, workflow manifest, coordinator source manifest, and this package;
4. record SHA-256 for every input;
5. compare each file with the approved TI-03/TR-01 design and report;
6. classify each difference as unchanged approved content, required
   identity-recovery change, unrelated current-tree change, or unresolved;
7. verify package/lockfile and pinned-image consistency; and
8. obtain independent read-only approval of the reconciliation before
   candidate creation.

No surviving file or historical validation claim may be labelled equivalent to
the lost object without authoritative proof.

## 4. Required workflow changes

The workflow must support two explicit modes:

### 4.1 Candidate mode

- exact ref `refs/heads/tr01/implementation-identity-candidate`;
- protected `workflow_dispatch` only;
- `S=C`;
- one exact checkout;
- protected environment value equals `C`; and
- evidence records both identity fields as `C`.

### 4.2 Activated mode

- exact ref `refs/heads/main`;
- protected `workflow_dispatch` only;
- root checkout remains `S`;
- exact implementation `C` is checked out under `candidate/`;
- coordinator is invoked from `candidate/`;
- workflow path supplied for hashing comes from root `S`;
- `C` ancestry to `S` is verified; and
- evidence records separate `S` and `C`.

The workflow must retain minimal `contents: read` permissions, protected
environment review, pinned GitHub actions, pinned images, bounded timeout,
non-cancelling concurrency, always-run evidence upload, and no untrusted
pull-request or fork execution.

The workflow-source checkout must use `fetch-depth: 0`. Activated mode must
verify that exact `C` and `S` objects exist in that checkout and run
`git merge-base --is-ancestor C S`. It must check out `candidate/` with
`ref: C` at the full SHA. It must not fetch a candidate branch tip, tag, or
abbreviated SHA as a substitute.

## 5. Coordinator changes

The coordinator must:

- parse and validate exact full SHAs for workflow and implementation sources;
- require `LEDGERLY_APPROVED_CANDIDATE_SHA`;
- distinguish candidate and activated refs without a permissive fallback;
- verify both checkout heads and clean-tree state;
- prove `C` is an ancestor of `S` in activated mode;
- resolve every source-manifest path against the explicit candidate root;
- resolve and hash the workflow against the explicit workflow-source root;
- keep the runtime/container build context bound to `C`;
- populate distinct evidence and private-run-control fields;
- preserve all existing event, environment, database-target, role, image,
  network, secret, negative-control, and cleanup checks; and
- reject old evidence or bindings whose identity semantics are ambiguous.

## 6. Exact schema-v2, SQL, and compatibility contract

Identity-recovery qualification uses evidence `schemaVersion: 2`. Version 1
remains historical evidence only and must be rejected by candidate and
activated qualification acceptance.

In schema version 2:

- remove `ci.sourceCommit`;
- require `ci.workflowSourceCommit`;
- require `ci.implementationSourceCommit`;
- require `ci.identityMode`, exactly `candidate` or `activated`;
- require `ci.sourceRef`, exactly the candidate ref in candidate mode or
  `refs/heads/main` in activated mode;
- require `ci.refProtected: true`;
- remove `binding.sourceCommit`;
- require `binding.workflowSourceCommit`;
- require `binding.implementationSourceCommit`;
- require `binding.ancestryVerified: true`;
- require `binding.workflowCheckoutClean: true`; and
- require `binding.implementationCheckoutClean: true`.

Both commit fields use `^[0-9a-f]{40}$`. In candidate mode they must be equal.
In activated mode they may differ, but `implementationSourceCommit` must be a
verified ancestor of `workflowSourceCommit`.

The version-2 private run-control table uses exact columns:

- `identity_mode`;
- `ci_source_ref`;
- `ci_ref_protected`;
- `workflow_source_commit`;
- `implementation_source_commit`;
- `ancestry_verified`;
- `workflow_checkout_clean`; and
- `implementation_checkout_clean`.

The legacy `source_commit` column is removed from the version-2 definition.
Because every TI-03 database is newly created and destroyed within one run,
there is no durable row migration, `ALTER` compatibility path, or mixed-version
table. Version-2 SQL is applied only to a fresh disposable database.

The exact SQL policy is:

- both commit columns are full lowercase SHAs;
- `ci_ref_protected`, both clean flags, and `ancestry_verified` are true;
- candidate mode requires exact candidate ref, candidate workflow ref suffix,
  and equal workflow/implementation SHAs;
- activated mode requires exact main ref, main workflow ref suffix, and
  database-bound evidence that `C -> S` was verified before bootstrap; and
- any other mode, ref, workflow-ref suffix, null, legacy field, or mismatch is
  rejected.

`workflow_sha256` is computed from workflow-source `S`.
`source_tree_sha256` and every implementation digest are computed from
implementation-source `C`.

The validator must reject version 1, mixed-version, legacy-field,
missing-field, extra-field, short-SHA, mismatched-SHA, wrong-mode, wrong-ref,
wrong-workflow-ref, false-ancestry, dirty-checkout, and wrong-digest-domain
fixtures.

## 7. Mandatory validation commands and categories

At minimum, run:

```text
node --check scripts/ci/run-ledgerly-canonical-postgresql.mjs
node --check artifacts/api-server/scripts/runCanonicalPostingDisposable.mjs
pnpm install --frozen-lockfile --ignore-scripts
pnpm run typecheck:libs
pnpm run typecheck
pnpm --filter @workspace/api-server run test:canonical-posting
```

Also complete:

- strict AJV 8.20.0 schema compilation;
- schema rejection fixtures for both identity modes;
- coordinator preflight rejection outside approved GitHub contexts;
- workflow static review and action/image-pin verification;
- SQL/run-control/overlay parity review;
- PostgreSQL role, ACL, owner, function, and `ENABLE ALWAYS` trigger review;
- deterministic source-manifest recomputation;
- secret scan;
- cleanup-failure injection; and
- fresh independent implementation/security review.

The schema application command inside the disposable harness remains:

`pnpm --filter @workspace/db run push`

The exact canonical command remains:

`pnpm --filter @workspace/api-server run test:canonical-posting`

## 8. Candidate creation and branch procedure

Only after reconciliation and local validation pass:

1. confirm the approved file inventory and clean tracked tree;
2. create one bounded candidate commit `C`;
3. record full `C` and per-file digests outside `C` without amending it;
4. independently review exact `C`;
5. create an exact-name GitHub ruleset for the candidate ref before the branch
   exists;
6. require two approving reviews of exact `C`, stale-approval dismissal,
   resolved conversations, and the identity-recovery validation status;
7. apply the ruleset to administrators, deny ordinary direct push, and
   prohibit force push and deletion;
8. permit one designated repository administrator a one-time audited bypass to
   create the branch directly at already reviewed exact `C`;
9. record actor, full `C`, ruleset, time, and remote-tip equality;
10. remove or disable that bypass before qualification; and
11. reject any remote identity that differs from local `C`.

Candidate creation and publication require a later explicit implementation
instruction.

## 9. Protected environment procedure

Repository administration must:

1. retain protected environment `ledgerly-canonical`;
2. require environment reviewers;
3. set `LEDGERLY_APPROVED_CANDIDATE_SHA` to full exact `C`;
4. confirm no secret value is required for the SHA;
5. prevent workflow code from changing the value; and
6. record the binding in non-secret evidence.

At least two required environment reviewers must approve the qualification
deployment. Administrators and automation must not have an unrecorded bypass.
If GitHub cannot enforce or expose the required branch/environment state, the
process stops rather than weakening the contract.

Changing the value requires a new candidate review and identity approval
process.

## 10. Candidate qualification

Candidate qualification must run on the exact protected candidate ref and prove:

- `S=C` identity agreement;
- deterministic source and workflow digests;
- pinned-image construction;
- private run binding;
- disposable PostgreSQL bootstrap;
- runtime exclusively as `ledgerly_api`;
- database-backed canonical posting and explicit concurrency evidence;
- all approved negative controls;
- ownership, ACL, role, function, and trigger protections;
- no published database port, Docker socket, external route, production, or
  `heliumdb` contact;
- cleanup binding and logical/physical/credential removal;
- valid, non-secret evidence; and
- retained evidence path and SHA-256.

Failure or unavailable execution is not qualification.

## 11. Final identity approval gate

Passing qualification leaves `C` as a candidate. A separate approval must
review:

- exact `C`;
- reconciliation;
- local/static validation;
- independent implementation/security review;
- accepted TI-03 evidence and SHA-256; and
- all blocking and cleanup results.

Only that approval may designate `C`:

**NEW AUTHORITATIVE IMPLEMENTATION IDENTITY**

## 12. Governance activation and activated qualification

After final identity approval:

1. record exact protected-main base `B`;
2. prepare exact activation pull-request head `A` so `C` and `B` are both
   ancestors of `A`;
3. limit the `A -> B` diff to the approved activation inventory;
4. require two fresh approvals of exact `A` against exact `B`;
5. disable squash and rebase and permit only GitHub's ordinary merge-commit
   method;
6. stop if protected `main` no longer equals `B`; update the activation branch,
   record a new `A`/`B`, and repeat review rather than merging stale approval;
7. merge through protected GitHub review, defining the resulting merge commit
   as `G`;
8. verify protected-main tip equals `G`, `G^1=B`, `G^2=A`, and `C` is an
   ancestor of both `A` and `G`;
9. keep the protected environment bound to `C`;
10. run the activated workflow with `S=G` and implementation `C`;
11. verify ancestry, both checkouts, digest attribution, all TI-03 controls,
    and cleanup;
12. retain activated evidence and SHA-256; and
13. independently review the activated result.

Phase A remains blocked until this sequence passes and all active governance
records agree.

## 13. Stop conditions

Stop and return for approval if:

- the approved inventory is incomplete or requires expansion;
- current content cannot be reconciled to approved design;
- either identity is missing, short, mutable, or mismatched;
- branch or environment protection cannot be proved;
- the exact candidate branch cannot be bootstrapped under the audited one-time
  bypass and then locked before qualification;
- `C` is not an ancestor of `S`;
- complete workflow-source history or either exact commit object is
  unavailable;
- protected-main base advances after activation review;
- merge configuration permits or produces squash, rebase, a rewritten head,
  wrong parent order, or any result other than exact reviewed `B` and `A`
  parents;
- protected-main tip, `GITHUB_SHA`, or either parent does not equal the
  post-merge recorded `G`, `B`, and `A`;
- a workflow digest would come from `C` when execution came from `S`;
- implementation inputs would come from `S` instead of `C`;
- schema compatibility is ambiguous;
- any mandatory local, static, database-backed, negative-control, security, or
  cleanup check fails or is unavailable;
- implementation would weaken role, ACL, owner, function, trigger, network,
  credential, or cleanup controls;
- production, `heliumdb`, 48-B, Stage 3, #40-CF-01, deployment, publishing, or
  Phase A is required; or
- historical records would need to be rewritten.

## 14. Requested decision

This package is ready for independent read-only review. It remains
non-executable until the user gives a separate explicit implementation
approval.
