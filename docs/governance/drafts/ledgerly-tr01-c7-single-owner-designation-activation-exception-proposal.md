# Exact C7 single-owner designation and development activation exception

**Status: PROPOSED — NOT APPROVED.**
**Author:** Replit Agent, drafting for owner review; not an independent-human
reviewer or approving authority.
**Scope:** Final exact-C7 designation and one later development/disposable
protected-main activation qualification, subject to the separate gates below.
The request to back up the AI review and draft this document is **not**
approval of this exception, a final designation, configuration, merge or run.

## 1. Decision requested and exact identities

Propose a narrow replacement of the unavailable independent-human review
requirements with explicit, auditable decisions by the authorized repository
owner, currently identified as GitHub account `Future00111`. Verify the acting
owner identity at decision time; an AI summary is not an owner signature.

- Exact implementation C7: `787d76decfa345e3c1104231e08d5ab00bc90259`.
- C7 tree: `aa0360267a0d1987626ae9650238d66f04f667b9`.
- C7 sole parent: `c795945c4a5d4815804a86b9d5f2bdc77573d38f`.
- Existing candidate qualification: run `38284785813`, attempt 1; six
  accounting tests, 18 negative controls and all five cleanup checks passed.
- Existing identity run: `38283941466`; not accounting qualification.
- Current prospective protected-main base B:
  `0da401737f35d68b9404982baad7405fe997636a`.
- Backed-up AI review: `acc93b0dedc4da2163a3aaa4108b8a183057a5e5`,
  branch `review-local/tr01-c7-acceptance-pr25`.
- Updated acceptance PR #25 reviewed at
  `ecfd853daed4b51344f751e9d3afb4136d202719`.
- Future activation A and resulting ordinary merge G: **not prepared or
  approved by this proposal**. No placeholder is an approved SHA.

The review/integration branches are not A, G or exact C7. The log-archive
finding P25-E1 is resolved by retained original bytes and independently checked
content comparisons; that does not itself accept the package or designate C7.
Existing author and AI reviews remain accurately labelled.

## 2. Human requirements proposed for replacement

The controlling implementation approval package §§8–12 and protected-baseline
ancestry contract remain operative unless an explicit exception decision
names the following replacements. The earlier C/C2 and successor
candidate-development owner exceptions do not extend to this scope.

| Requirement | Proposed exact-C7 development substitute | What is lost |
| --- | --- | --- |
| Fresh independent exact-C7 implementation/security review feeding final designation (§11, including the fresh exact-C review prerequisite) | Owner reviews the complete immutable source, author/AI findings and accepted evidence, then explicitly accepts the lack of a fresh independent-human review | Independent security judgment and separation from the implementer/operator |
| Two fresh approvals of exact A against exact B (§12.4 and ancestry contract) | One authenticated owner decision identifies full A, B, reviewed tree/diff and findings, followed by a separately authorized ordinary GitHub PR merge | Two-person branch approval and independent protection against owner mistakes |
| Environment approver distinct from initiator, with self-review prevented where supported (§9) | Keep the required owner reviewer; permit the same owner to initiate and release this specific development job through the normal Environment review path | Independent Environment release; release is owner self-review, not dual control |
| Separate pre-dispatch reviewer distinct from initiator and Environment approver (§9) | Owner records a fresh pre-dispatch attestation of exact G/C7, effective controls, credential exclusion and evidence prerequisites | A second independent check immediately before execution |
| Independent review of activated results (§12.13) | Owner separately verifies the new artifact, exact bindings, all required results and cleanup, records the absence of independent-human result review, and accepts only the development result | Independent detection of incomplete, misattributed or misleading run evidence |

These are explicit waivers/substitutions, **not satisfied independent reviews**.
Historical approvals are not rewritten. Publication-time clauses and existing
frozen-candidate protections are not reopened, and no candidate ref is changed.
Other independent-human requirements, especially production, migration/cutover
and Phase A, are not replaced.

### GitHub semantics must be honest

An author cannot supply an approving GitHub review of their own PR. Do not set
one required approval and claim that the author can meet it; do not count an
AI, bot, second account or a comment as a distinct human approval.

If this exception is approved, the later **configuration proposal** must
describe an enforceable ordinary-PR path with zero required approving reviews
for the bounded owner-only activation window, while retaining administrator
coverage, actual required checks and conversation resolution. Verify that the
provider can enforce/read back that intended PR policy. If not, stop for a new
decision, not a direct-main push or bypass. Stale-owner attestations must be
invalidated manually; zero-review policy is not native dismissal of an
owner's external attestation. Actual unresolved conversations/findings remain
blocking.

This is a departure from the approved two-review activation policy, even though
the recorded current main policy has no required review count. Do not describe
the current setting as already authorizing activation. Branch policy settings
can affect other PRs, not just A: record the window, prohibit other main writes
under this exception and explicitly acknowledge that its exact-A limitation is
a manual governance restriction unless separately enforced and demonstrated.

Keep the normal `ledgerly-canonical` owner-review gate. Same-owner release
would require `prevent_self_review=false` under separately approved policy.
Do not remove required reviewers or use administrator bypass. A native release
is still a human owner action; automation must not synthesize it. If this
normal path is unavailable, stop rather than fall back to bypass.

## 3. Risks the owner would have to accept

1. The same person may implement, designate, review A, merge, dispatch,
   release and accept results. No independent person challenges the decision.
2. Owner account compromise, misunderstanding or rushed review can authorize
   both changes and execution. Immutable/source checks do not establish good
   human judgment or the safety of a newly reviewed workflow.
3. AI/author reviews and passing automated tests can share blind spots;
   passing development qualification is not end-to-end or production assurance.
4. A manual attestation may be omitted, stale or attached to the wrong SHA.
   GitHub does not independently validate all its contents.
5. C7/main/integration histories diverge. A wrong merge tree, extra path or
   source-role mix-up can invalidate the intended activation despite familiar
   filenames or a green historical candidate run.
6. Temporary repository-wide review/merge settings can affect unrelated work.
   The owner-only permission must not become an indefinite general exemption.

Accepting these governance risks cannot waive a failed technical check,
material unresolved defect, missing evidence or incomplete cleanup.

## 4. Technical and identity safeguards not replaced

- Preserve all frozen C through C7 refs, exact trees/history, effective
  update/delete/force-push restrictions, required authenticated identity
  statuses and absence of candidate bypass. No immutable amendments, ref
  moves, republishing, tags or substitute implementation.
- Preserve the exact C7 Environment pin, exact main+C7 branch admission,
  custom policy, required owner reviewer and no tags/wildcards. Preserve
  historical producer/source pins and required status producer identities;
  those pins are not silently repurposed as the activated workflow identity.
- Retain protected-main administrator enforcement and actual required checks;
  no failing/missing check is bypassed and no fictitious status is invented.
  Ordinary merge only: proposed later merge methods are merge enabled,
  squash/rebase disabled. No direct/local main push or administrator bypass.
- Build future A from fresh exact B with both B and C7 as ancestors. The full
  B/A diff must stay within the existing **ten-path** inventory in the C7
  activation proposal; all other blobs/modes/absences remain B-exact. This
  draft is not an eleventh activation path. Any expansion needs another
  approved amendment before preparation/merge.
- Review exact A/B and recompute the intended merge tree against Git objects.
  If main advances, stop and prepare/review a new A/B; no stale approval.
  After an authorized ordinary merge require main=G, G^1=B, G^2=A, matching
  reviewed tree, and C7 ancestry to A/G.
- Activated mode remains `S=G`, implementation=C7. Require protected main,
  manual dispatch, root G checkout with full history, detached C7 checkout,
  exact objects/clean trees, source/database/run identity and ancestry.
  Workflow digest comes from G; all implementation digests/inputs from C7.
- Validate exact-A syntax, host frozen dependency/module resolution and
  source-attribution/rejection fixtures before merge/run. The inert prototype
  has not executed and is not validated merely by approving this proposal.
- Preserve pinned actions/images/toolchains and offline sanitized nested
  invocations, read-only/non-root/no-new-privileges runtime and network
  isolation. No registry access is enabled to make an isolated test pass.
- Use synthetic fresh disposable PostgreSQL only; runtime remains
  `ledgerly_api`, with protected owner/ACL/function/trigger/immutable posting
  controls, company/journal locks and concurrency proofs unchanged.
- No customer data, production/HeliumDB secrets, credentials, network route
  or contact. Check names/presence only, never retrieve secret values.
- Accept only strict schema-v2 evidence with correct separate source/image/
  run/attempt/private-database bindings, all accounting/concurrency/security
  and negative controls, and all five fail-closed cleanup results.
  Upload candidate-path evidence/schema only; verify archive/member hashes
  against exact sources, retaining originals and provenance.
- On any mismatch, failed/unavailable check or cleanup uncertainty: stop,
  retain failure evidence, do not retry, change identities, weaken checks or
  infer success. Repair requires a separately approved successor/process.

## 5. Separate decisions and action-time approvals

All rows below are **PENDING**. They are separate decisions, not authority
conferred by this draft or by the owner's backup instruction.

| Gate | Required decision/evidence before action |
| --- | --- |
| G1 — Governance exception | Owner explicitly approves this exact proposal/revision, each named human replacement, risks, exact-C7 scope and expiry; record authenticated actor, UTC time and decision outside frozen C7 |
| G2 — Final designation | Separate owner review/acceptance of C7 source/tree/parent, findings, original qualification artifact/evidence/schema/log hashes, 18 controls and five cleanup results; explicitly record `NEW AUTHORITATIVE IMPLEMENTATION IDENTITY` with development-only scope and this exception reference |
| G3 — Activation preparation | Separate instruction to prepare constrained A from freshly verified B; record full A/B/tree/parents/inventory, validation receipts and source-role checks. This proposal does not create A |
| G4 — Configuration | Present exact ready-to-apply values/diffs, API targets and pre/post snapshots for the owner-review PR policy, merge-only settings, normal owner Environment semantics and restoration plan; obtain explicit approval before any live setting change. Retain pins/admission/frozen controls |
| G5 — Exact A/B acceptance and merge | Owner records full exact A/B and reviewed result-tree acceptance under the approved exception; separately authorizes one ordinary PR merge. Recheck main=B and all controls/checks immediately before merging; then read back actual G/parents/tree outside G |
| G6 — One activated development run | Separate action-time owner authorization for one manual dispatch at exact recorded G using exact C7, after fresh no-production/Helium preflight and all validations. Record workflow/path/digest, effective Environment and ref bindings. Then require normal owner Environment release for the actual run URL, not administrator bypass |
| G7 — Result acceptance and closure | Verify original new artifact/schema, all source/image/run/database bindings, accounting/concurrency/negative/security controls and five cleanup flags; obtain a separate owner development-result decision explicitly replacing independent-human result review; close the exception and retain evidence |

Messages may record several decisions only if they explicitly distinguish each
scope/action and provide the required exact values. Unknown A/G cannot be
preapproved; a generic “continue” or approval of G1 is not G4/G5/G6. Relay-based
owner decisions must identify the actual message/actor and verification limits;
do not invent signatures, independent review or an Environment release.

## 6. Expiry and scope exclusions

Proposed exception is exact-C7 and single-use: one authorized activation merge
and at most one activated development dispatch. A failed run consumes its
dispatch authority; no automatic retry. Changed C7, A after acceptance, B
advancement, reviewer/owner policy, intended scope or controls invalidates the
corresponding action approval. Introducing an eligible independent reviewer
before execution requires reconsidering this exception rather than ignoring
the normal review route.

G4 must include a separately approved post-window control/restoration plan.
After completion, failure or revocation, refuse further owner-only activation
use regardless of remaining native settings; restore the approved normal human
review policy through authorized configuration, without undoing strengthened
immutable/status/merge safeguards. Keep the full audit trail.

No production designation/readiness, migration, deployment, HeliumDB access,
48-B, Stage 3, invoice/runtime implementation or Phase A is authorized.
Even successful owner-accepted activated development evidence does not satisfy
the independent-human requirements for those later scopes. No live
configuration change, merge or run has occurred under this proposal.

## References

- [Final C7 acceptance proposal](ledgerly-tr01-c7-final-acceptance-proposal.md)
- [Protected-main activation proposal and ten-path inventory](ledgerly-tr01-c7-protected-main-activation-proposal.md)
- [AI review](ledgerly-tr01-c7-pr25-ai-review.md) and
  [provenance addendum](ledgerly-tr01-c7-pr25-ai-review-ecfd853-addendum.md)
- Implementation approval package §§8–13:
  `docs/ledgerly-44-tr-01-implementation-identity-recovery-implementation-approval-package.md`
- Ancestry contract:
  `docs/ledgerly-44-protected-github-baseline-ancestry-contract.md`
- Prior candidate-only exception, explicitly excluding final designation and
  activated-main qualification:
  `docs/governance/ledgerly-tr01-c2-owner-only-qualification-approval.md`
