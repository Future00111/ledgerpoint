# Ledgerly protected GitHub baseline ancestry contract

**Date:** 2026-09-21  
**Status:** APPROVED IN PRINCIPLE — IMPLEMENTATION SEPARATELY GATED

## 1. Identities

- `C` is the exact qualified implementation commit.
- `S` is the exact workflow-source commit for a run.
- `A` is the exact reviewed activation pull-request head.
- `B` is the exact protected-main base reviewed for that pull request.
- `G` is the resulting protected-main two-parent merge commit.

Candidate qualification uses `S=C`. Activated protected-main qualification
uses `S=G` and continues to execute exact implementation `C`.

## 2. Protected-main activation identity

The activation branch must be prepared so both `C` and exact base `B` are
ancestors of exact reviewed head `A`. The pull request must expose only the
approved activation inventory relative to `B`.

Only GitHub's ordinary merge-commit method is permitted. Squash, rebase,
identity-changing update, and manual or local main push are prohibited. The
post-merge verifier must require:

- protected-main tip is exact `G`;
- `G^1` is exact reviewed base `B`;
- `G^2` is exact reviewed head `A`;
- `C` is an ancestor of `A` and `G`; and
- the resulting `G` tree matches the reviewed merge result.

If protected `main` advances after review and before merge, stale approvals
must be dismissed and promotion must stop. A new `B`, corresponding `A`, full
diff, and approvals are required. The merge button must not be used while the
reviewed base differs from the live protected-main tip.

## 3. Candidate ref and environment

The exact candidate ref is:

`refs/heads/tr01/implementation-identity-candidate`

It must be protected, review-required, non-deletable, and non-force-pushable.
Reviewed history must not be rebased, squashed, amended, or cherry-picked.

An exact-name repository ruleset must exist before the first branch push. It
must require two approving reviews of exact `C`, dismiss stale approvals,
require resolution of review conversations and the identity-recovery validation
status, apply to administrators, and deny ordinary direct pushes and all force
pushes/deletions.

The only permitted bootstrap is a one-time, audited ruleset bypass by one
designated repository administrator to create the branch directly at already
reviewed exact `C`. The audit record must identify the actor, full `C`, ruleset,
time, and successful remote-tip equality check. The bypass must then be removed
or disabled before qualification. If the platform cannot enforce and evidence
this sequence, candidate publication stops.

The protected `ledgerly-canonical` environment must expose:

`LEDGERLY_APPROVED_CANDIDATE_SHA`

Only repository administration may set it, and environment reviewers must
approve its use. Moving the value to another commit is a new identity action,
not routine configuration.

## 4. Candidate-mode binding

Candidate mode must fail unless:

- the event is `workflow_dispatch`;
- `GITHUB_REF` is the exact protected candidate ref;
- `GITHUB_REF_PROTECTED` is true;
- `GITHUB_SHA` is exact `C`;
- checked-out `HEAD` is exact `C`; and
- `LEDGERLY_APPROVED_CANDIDATE_SHA` is exact `C`.

Both evidence identities equal `C` in this mode.

## 5. Activated-mode binding

Activated mode must fail unless:

- the event is `workflow_dispatch`;
- `GITHUB_REF` is `refs/heads/main`;
- `GITHUB_REF_PROTECTED` is true;
- root `HEAD` equals workflow source `S`;
- candidate checkout `HEAD` equals protected-environment value `C`;
- `C` is an ancestor of `S`;
- both checkouts are clean; and
- the actual workflow file is read and hashed from the `S` checkout.

The workflow-source checkout must use complete history (`fetch-depth: 0`).
Before ancestry evaluation it must verify that both full objects exist locally,
then execute the equivalent of:

`git merge-base --is-ancestor C S`

The candidate checkout must use `ref: C`, detached at the full SHA. A
shallow-history result, missing object, fetch fallback to a branch tip, or
network failure is a hard qualification failure.

Implementation manifests, tests, coordinators, lockfile, schema, SQL, and
runtime inputs are read from the `C` checkout only.

## 6. Evidence

Evidence must carry, without ambiguous aliasing:

- `workflowSourceCommit`;
- `implementationSourceCommit`;
- workflow digest from `S`;
- implementation/source-tree digest from `C`;
- exact ref and protected-ref state;
- protected-environment identity agreement;
- ancestry verification result; and
- clean-checkout results.
- exact activation base `B`, reviewed head `A`, resulting merge `G`, and
  verified parent relationships.

Candidate and activated evidence remain subject to the full TI-03 schema,
semantic checks, secret scan, runtime checks, negative controls, and cleanup
requirements.

## 7. Stop conditions

Stop without qualification if either SHA is absent, malformed, mutable,
disagrees with its checkout, has unverified ancestry, comes from an unprotected
ref, or cannot be attributed to the correct digest domain.

No fallback to one overloaded `sourceCommit`, a branch tip, a short SHA, a tag,
or an unprotected environment value is permitted.

No commit may be required to embed its own SHA. The exact workflow source is
recorded from `GITHUB_SHA` in post-commit run evidence.
