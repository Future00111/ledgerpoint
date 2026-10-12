# TR-01 C7 protected-main activation — non-executable proposal

**2026-10-12 — proposal prepared; approval and execution gates open.**
No activation head A or merge G exists. Implementation-package §§2, 11–12 and
the protected-baseline ancestry contract remain controlling. Development
owner-only approval is not inherited as activation authority.

## Identities and divergence

- C7: `787d76decfa345e3c1104231e08d5ab00bc90259`.
- Prospective protected-main base B: `0da401737f35d68b9404982baad7405fe997636a`.
- Backed-up integration I: `085b7e0491d9adbbebcc7e8db384c575bcfa2aca`.
- B/C7 common ancestor: `b1eb9b22732cfefa79308a621198d8ce850a7c1c`.

C7 is not an ancestor of B or I; B is not an ancestor of I. B and C7 differ
on 1,113 paths, including 1,103 outside the activation inventory. Selected
file imports into I do not establish ancestry. Do not merge I or import
the entire C7 tree as an activation shortcut. This documentation branch is
based on I and is not A. See the
[feasibility record](ledgerly-tr01-c7-acceptance/activation-feasibility.json).

## Exact future A/B diff inventory

The future activation tree may differ from B only at:

1. `.github/workflows/ledgerly-canonical-postgresql.yml`
2. `docs/ledgerly-44-tr-01-implementation-identity-recovery-amendment.md`
3. `docs/ledgerly-44-tr-01-implementation-identity-recovery-approval-record.md`
4. `docs/ledgerly-44-tr-01-implementation-identity-recovery-independent-review.md`
5. `docs/ledgerly-44-protected-github-baseline-ancestry-contract.md`
6. `docs/ledgerly-44-tr-01-implementation-identity-recovery-implementation-approval-package.md`
7. `docs/ledgerly-44-tr-01-transactional-authority-provider-approval-package.md`
8. `docs/ledgerly-44-ti-03-external-ci-postgresql-implementation-approval-package.md`
9. `docs/ledgerly-44-ti-03-external-ci-postgresql-implementation-report.md`
10. `docs/ledgerly-current-decision-register.md`

Coordinator, runtime, SQL, schema, tests, package and lockfile changes are
excluded. Outside these ten paths, retain B's exact blob/mode, including
absence of paths absent from B. Draft files in this proposal are not additions
to the activation inventory. Any necessary expansion requires a separately
reviewed and approved amendment first.

After final identity approval, create an activation branch from fresh B and
incorporate C7 as a normal merge parent without rewriting either history.
Resolve the resulting tree deliberately under this inventory. Record exact A,
parents/tree, full `git diff B A`, and `C7 -> A` / `B -> A` proofs. Review
the full constrained result. File copying, cherry-pick, squash or rebase does
not substitute for the required ancestry.

## Concrete workflow prototype

[Proposed workflow text](ledgerly-tr01-c7-acceptance/proposed-activated-workflow.yml.txt)
and [patch against exact B](ledgerly-tr01-c7-acceptance/proposed-activated-workflow.patch)
are inert review artifacts, not installed workflows. They propose:

- Protected exact main, manual dispatch only, `contents: read`.
- Root checkout at exact `github.sha`, full history, no persisted credentials.
- Detached exact Environment-pinned C7 under `candidate/`; the C7 coordinator
  verifies exact heads, clean trees and C7 ancestry to S before database work.
- B root package has AJV exactly `8.20.0`; its lockfile and workspace config
  match C7. Keep B manifests. Install the host validator with frozen lockfile
  and scripts disabled; implementation/image inputs come from C7. Revalidate
  host dependency behavior against exact A before any activated run.
- Execute the candidate coordinator in activated mode. Workflow digest is
  from root S=G; implementation/source digests are from C7.
- Upload only `candidate/docs/governance/evidence/ledgerly-44-ti-03-*.json`:
  exact C7 schema/new activated evidence, excluding older root G schemas or
  evidence that could make artifact attribution ambiguous.
- Retain pinned actions/images, Environment, timeout, non-cancelling
  concurrency, always-run upload and all existing isolation/privilege rules.

This proposed workflow has not run. Exact-A validation and a real activated
qualification are still required. Frozen C7's workflow/code are unchanged.

## Current controls and proposed deltas

Fresh read-only inspection found:

| Control | Current | Requirement before activation |
| --- | --- | --- |
| Collaborators | One User, Future00111 | Resolve required distinct approvals |
| Main classic protection | Admin enforcement, force/deletion denied; no required PR approvals | Separately authorize/enforce two fresh approvals, stale dismissal and conversation resolution for exact A |
| Main effective rules API | Empty ruleset result; classic protection applies | Do not treat empty rulesets as unprotected main |
| Merge methods | Merge, squash and rebase enabled | Keep merge; separately approve disabling squash/rebase |
| Environment | Future00111 reviewer; self-review prevention false | Resolve activated-run reviewer governance; development exception excludes activated qualification |
| Candidate pin | Exact C7 | Preserve; no proposed pin change |
| Admission | Exact main and C7, no tags/wildcards | Preserve; no branch admission expansion |
| Historical pins and candidate protections | Preserved | Preserve; C7 producer source pin is not activated workflow identity |
| Repository/Environment secrets | Zero | Preserve credential exclusion/disposable isolation |

Concrete proposed repository settings, **not applied**:
`allow_merge_commit=true`, `allow_squash_merge=false`,
`allow_rebase_merge=false`; required approving review count 2, stale-review
dismissal true, conversation resolution true, retaining administrator
enforcement and force/deletion denial. No new A status context is fabricated.

The contract's two fresh approvals of exact A against exact B cannot be
satisfied by the current single collaborator or this author's work. Supply
eligible reviewers, or obtain a separately reviewed bounded governance
amendment; neither decision is approved here. Resolve activated-run reviewer
policy and specific run authorization separately. One listed Environment
reviewer releases a job; two listed names do not enforce two native approvals.

## Later execution sequence — separately gated

1. Complete [final C7 acceptance](ledgerly-tr01-c7-final-acceptance-proposal.md).
2. Recheck B/C7 and approved review policy. If B advances, restart A/B review.
3. Prepare constrained A; validate workflow syntax, frozen host installation,
   source attribution and rejection/acceptance fixtures in isolated review
   copies. Review fixtures are not qualification.
4. Obtain configuration authorization and required exact-A/B approvals;
   read back effective protections and merge methods.
5. Recheck main=B; merge through GitHub's ordinary merge method. Verify main=G,
   `G^1=B`, `G^2=A`, reviewed merge tree and C7 ancestry to A/G.
6. Record G outside G: no commit embeds its future self-SHA. Keep C7 pin and
   exact admission. Do not execute B's older main workflow.
7. Under specific run authorization and approved normal reviewer gate,
   dispatch once from G with S=G and implementation C7. Verify schema v2,
   bindings/digests/images, accounting/concurrency, all negative controls,
   isolation/security and all five cleanup flags.
8. Retain new activated evidence/hashes and complete independent result review.
   Then reconcile active records before considering a separately approved
   Phase A task.

Failure or unavailable execution stops dependent work with evidence retained.
No retry, alternate identity or relaxed reviewer/network/privilege fallback
is authorized. Deployment, production/HeliumDB, migration, 48-B, Stage 3 and
invoice/report implementation are outside this proposal.
