// Read-only preflight for the existing draft integration PR. This does not publish,
// grant approval, retry a rejected operation, or verify remote reads itself.
import { transitionCoordinator } from './coordinator.mjs';

const repository = 'Future00111/ledgerpoint';
const branch = 'codex/whole-product-first-sprint';
const baseBranch = 'dev/w03-draft-invoice-slice';
const maxObservationAgeMs = 60_000;
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const requireValue = (ok, code) => { if (!ok) throw Object.assign(new Error(code), { code }); };

/** Inputs are fresh read-only GitHub observations, plus a separately reviewed
 * intent. Keep owner.token local. Do not persist inputs or log caught objects.
 * The caller must repeat reads immediately before the expected-head update and
 * stop on any approval rejection or CAS conflict; this result is not a lock.
 */
export function preflightPublication({ authority, pullRequest, destination, candidate, intent, owner, baseDestination }, { now = Date.now() } = {}) {
  requireValue(Number.isSafeInteger(now) && now >= 0, 'INVALID_TIME');
  for (const observation of [authority, pullRequest, destination, candidate]) {
    requireValue(observation && Number.isSafeInteger(observation.observedAt) && observation.observedAt >= 0
      && observation.observedAt <= now && now - observation.observedAt <= maxObservationAgeMs,
    'STALE_OBSERVATION');
    requireValue(observation.repository === repository, 'WRONG_REPOSITORY');
  }
  requireValue(intent && [intent.expectedHead, intent.expectedBaseSha, intent.candidateSha, intent.candidateTree,
    intent.authorCommit].every(sha), 'INVALID_INTENT');
  requireValue(typeof intent.authorBranch === 'string' && /^[A-Za-z0-9][A-Za-z0-9_./-]{0,200}$/.test(intent.authorBranch)
    && !intent.authorBranch.includes('..'), 'INVALID_AUTHOR_ORIGIN');
  requireValue(intent.reviewed === true && typeof intent.authorActor === 'string' && intent.authorActor.trim().length > 0
    && typeof intent.reviewer === 'string' && intent.reviewer.trim().length > 0
    && intent.authorActor.trim() !== intent.reviewer.trim(),
    'REVIEW_REQUIRED');
  const state = authority.value;
  requireValue(state?.repository === repository && state?.codeBranch === branch, 'WRONG_INTEGRATION_TARGET');
  requireValue(state.codeHead === intent.expectedHead, 'AUTHORITY_HEAD_CHANGED');
  requireValue(state.status === 'leased' && state.lease && now < state.lease.expiresAt,
    'LIVE_COORDINATOR_REQUIRED');
  requireValue(authority.observedAt >= state.updatedAt && sha(authority.sha), 'INVALID_AUTHORITY_OBSERVATION');
  // Existing transition validates all persisted state and fences the local token.
  // Discard the result: preflight must not renew or mutate the durable lease.
  const checked = transitionCoordinator(state, { type: 'renew', runId: owner?.runId, token: owner?.token, leaseMs: 1000 }, { now });
  requireValue(checked.status === 'leased', 'LIVE_COORDINATOR_REQUIRED');
  requireValue(destination.ref === `refs/heads/${branch}`, 'WRONG_INTEGRATION_TARGET');
  requireValue(destination.sha === intent.expectedHead, 'DESTINATION_HEAD_CHANGED');
  const pr = pullRequest.value;
  const expectedPr = state.integrationPullRequest ?? 27;
  const successor = state.publicationSuccessor;
  // One explicitly checkpointed transition after the owner merges the prior PR.
  // It permits only a reviewed FF on the same head branch, then a new draft PR.
  const bootstrap = successor?.predecessorPr === expectedPr &&
    sha(successor.mergeCommit) && successor.ownerApprovedMerge === true &&
    pr?.number === expectedPr && pr.state === 'closed' && pr.merged === true &&
    pr.merge_commit_sha === successor.mergeCommit &&
    intent.expectedBaseSha === successor.mergeCommit && sha(successor.preMergeBaseSha) &&
    pr.base?.sha === successor.preMergeBaseSha;
  requireValue(Number.isSafeInteger(expectedPr) && expectedPr > 0 && (bootstrap ||
    pr?.number === expectedPr && pr.state === 'open' && pr.draft === true && pr.merged === false),
    'DRAFT_PR_REQUIRED');
  requireValue(pr.head?.repo?.full_name === repository && pr.base?.repo?.full_name === repository
    && pr.head.ref === branch && pr.base.ref === baseBranch, 'PR_TARGET_CHANGED');
  if (bootstrap) {
    requireValue(baseDestination?.repository === repository && baseDestination.ref === `refs/heads/${baseBranch}` &&
      baseDestination.sha === intent.expectedBaseSha && Number.isSafeInteger(baseDestination.observedAt) &&
      baseDestination.observedAt >= authority.observedAt && baseDestination.observedAt <= now &&
      now-baseDestination.observedAt <= maxObservationAgeMs, 'SUCCESSOR_BASE_CHANGED');
  }
  requireValue(pr.head.sha === intent.expectedHead && (bootstrap || pr.base.sha === intent.expectedBaseSha), 'PR_HEAD_CHANGED');
  const commit = candidate.value;
  requireValue(commit?.sha === intent.candidateSha && commit.tree?.sha === intent.candidateTree,
    'CANDIDATE_IDENTITY_CHANGED');
  requireValue(commit.sha !== intent.expectedHead && Array.isArray(commit.parents) && commit.parents.length === 1
    && commit.parents[0]?.sha === intent.expectedHead, 'CANDIDATE_PARENT_CHANGED');
  return {
    version: 1,
    destination_kind: 'integration',
    pullRequest: expectedPr,
    successorDraftRequired: bootstrap,
    authorityCommit: authority.sha,
    authorityRevision: state.revision,
    coordinatorRunId: state.lease.runId,
    observedAt: now,
    candidateTree: intent.candidateTree,
    reviewedBy: intent.reviewer,
    authorOrigin: { actor: intent.authorActor, commit: intent.authorCommit, branch: intent.authorBranch },
    updateRef: { repository_full_name: repository, branch_name: branch,
      expected_sha: intent.expectedHead, sha: intent.candidateSha, force: false },
    approvalGranted: false,
    sourcePublished: false,
  };
}
