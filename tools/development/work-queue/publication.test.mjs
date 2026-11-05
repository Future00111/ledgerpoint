import test from 'node:test';
import assert from 'node:assert/strict';
import { initialCoordinatorState, transitionCoordinator } from './coordinator.mjs';
import { preflightPublication } from './publication.mjs';

const repository = 'Future00111/ledgerpoint', branch = 'codex/whole-product-first-sprint';
const head = 'a'.repeat(40), next = 'b'.repeat(40), tree = 'c'.repeat(40), base = 'd'.repeat(40);
const owner = { runId: 'test-coordinator', token: 'local-only-fencing-token' };
function fixture() {
  const state = transitionCoordinator(initialCoordinatorState({ repository, codeBranch: branch, codeHead: head,
    catalogPath: 'docs/development/work-backlog.json', statePath: 'docs/development/work-state.json' }),
  { type: 'acquire', ...owner, leaseMs: 120_000 }, { now: 1000 });
  const snapshot = value => ({ repository, observedAt: 1000, value });
  return {
    authority: { ...snapshot(state), sha: 'e'.repeat(40) },
    pullRequest: snapshot({ number: 27, state: 'open', draft: true, merged: false,
      head: { repo: { full_name: repository }, ref: branch, sha: head },
      base: { repo: { full_name: repository }, ref: 'dev/w03-draft-invoice-slice', sha: base } }),
    destination: { repository, observedAt: 1000, ref: `refs/heads/${branch}`, sha: head },
    candidate: snapshot({ sha: next, tree: { sha: tree }, parents: [{ sha: head }] }),
    intent: { expectedHead: head, expectedBaseSha: base, candidateSha: next, candidateTree: tree,
      authorCommit: 'f'.repeat(40), authorBranch: 'codex/lp-2121-worker', authorActor: 'worker', reviewed: true, reviewer: 'independent-root' },
    owner: { ...owner },
  };
}
const preflight = input => preflightPublication(input, { now: 1001 });
test('worker provenance is distinct from the single permitted integration destination; no input mutation or token output', () => {
  const input = fixture(), before = structuredClone(input), result = preflight(input);
  assert.deepEqual(input, before);
  assert.deepEqual(result.updateRef, { repository_full_name: repository, branch_name: branch,
    expected_sha: head, sha: next, force: false });
  assert.equal(result.destination_kind, 'integration');
  assert.equal(result.authorOrigin.branch, 'codex/lp-2121-worker');
  assert.equal(result.approvalGranted, false); assert.equal(result.sourcePublished, false);
  assert.equal(JSON.stringify(result).includes(owner.token), false);
  assert.equal(JSON.stringify(result).includes(input.authority.value.lease.tokenSha256), false);
});
const cases = [
  ['worker destination', x => { x.destination.ref = 'refs/heads/codex/lp-2121-worker'; }, 'WRONG_INTEGRATION_TARGET'],
  ['state destination', x => { x.destination.ref = 'refs/heads/codex/ledgerly-work-queue-state'; }, 'WRONG_INTEGRATION_TARGET'],
  ['authority changed branch', x => { x.authority.value.codeBranch = 'codex/lp-worker'; }, 'WRONG_INTEGRATION_TARGET'],
  ['authority changed head', x => { x.authority.value.codeHead = next; }, 'AUTHORITY_HEAD_CHANGED'],
  ['destination changed head', x => { x.destination.sha = next; }, 'DESTINATION_HEAD_CHANGED'],
  ['wrong PR', x => { x.pullRequest.value.number = 28; }, 'DRAFT_PR_REQUIRED'],
  ['closed PR', x => { x.pullRequest.value.state = 'closed'; }, 'DRAFT_PR_REQUIRED'],
  ['ready PR', x => { x.pullRequest.value.draft = false; }, 'DRAFT_PR_REQUIRED'],
  ['merged PR', x => { x.pullRequest.value.merged = true; }, 'DRAFT_PR_REQUIRED'],
  ['fork head', x => { x.pullRequest.value.head.repo.full_name = 'other/ledgerpoint'; }, 'PR_TARGET_CHANGED'],
  ['fork base', x => { x.pullRequest.value.base.repo.full_name = 'other/ledgerpoint'; }, 'PR_TARGET_CHANGED'],
  ['changed PR branch', x => { x.pullRequest.value.head.ref = 'codex/lp-worker'; }, 'PR_TARGET_CHANGED'],
  ['changed PR base branch', x => { x.pullRequest.value.base.ref = 'main'; }, 'PR_TARGET_CHANGED'],
  ['changed PR head', x => { x.pullRequest.value.head.sha = next; }, 'PR_HEAD_CHANGED'],
  ['changed PR base SHA', x => { x.pullRequest.value.base.sha = next; }, 'PR_HEAD_CHANGED'],
  ['changed candidate', x => { x.candidate.value.sha = head; }, 'CANDIDATE_IDENTITY_CHANGED'],
  ['changed tree', x => { x.candidate.value.tree.sha = head; }, 'CANDIDATE_IDENTITY_CHANGED'],
  ['author ancestry is not published ancestry', x => { x.candidate.value.parents[0].sha = x.intent.authorCommit; }, 'CANDIDATE_PARENT_CHANGED'],
  ['merge candidate', x => { x.candidate.value.parents.push({ sha: base }); }, 'CANDIDATE_PARENT_CHANGED'],
  ['missing review', x => { x.intent.reviewed = false; }, 'REVIEW_REQUIRED'],
  ['self approval', x => { x.intent.reviewer = x.intent.authorActor; }, 'REVIEW_REQUIRED'],
  ['padded self approval', x => { x.intent.reviewer = ` ${x.intent.authorActor} `; }, 'REVIEW_REQUIRED'],
  ['missing author', x => { delete x.intent.authorActor; }, 'REVIEW_REQUIRED'],
  ['empty author', x => { x.intent.authorActor = ' '; }, 'REVIEW_REQUIRED'],
  ['wrong token', x => { x.owner.token = 'wrong'; }, 'OWNER_FENCED'],
  ['digest used as token', x => { x.owner.token = x.authority.value.lease.tokenSha256; }, 'OWNER_FENCED'],
  ['wrong run', x => { x.owner.runId = 'different'; }, 'OWNER_FENCED'],
  ['idle authority', x => { x.authority.value.status = 'idle'; x.authority.value.lease = null; }, 'LIVE_COORDINATOR_REQUIRED'],
  ['expired lease', x => { x.authority.value.lease.expiresAt = 1001; }, 'LIVE_COORDINATOR_REQUIRED'],
  ['malformed authority', x => { x.authority.value.revision = -1; }, 'INVALID_STATE'],
  ['mixed token state', x => { x.authority.value.lease.token = owner.token; }, 'INVALID_STATE'],
  ['malformed intent', x => { x.intent.candidateSha = 'not-a-sha'; }, 'INVALID_INTENT'],
  ['unsafe author origin', x => { x.intent.authorBranch = '../worker'; }, 'INVALID_AUTHOR_ORIGIN'],
];
for (const [name, change, code] of cases) test(`rejects ${name} without leaking local token`, () => {
  const input = fixture(); change(input);
  assert.throws(() => preflight(input), error => error.code === code && !String(error).includes(owner.token));
});
for (const key of ['authority', 'pullRequest', 'destination', 'candidate']) {
  test(`rejects wrong repository in ${key}`, () => {
    const input = fixture(); input[key].repository = 'other/ledgerpoint';
    assert.throws(() => preflight(input), { code: 'WRONG_REPOSITORY' });
  });
  test(`requires fresh non-future ${key} observation`, () => {
    for (const observedAt of [-1, null, 1002]) {
      const input = fixture(); input[key].observedAt = observedAt;
      assert.throws(() => preflight(input), { code: 'STALE_OBSERVATION' });
    }
    assert.throws(() => preflightPublication(fixture(), { now: 61_001 }), { code: 'STALE_OBSERVATION' });
  });
}
test('rejects time before authority update and never mutates a lease to extend its life', () => {
  const input = fixture(); input.authority.value.updatedAt = 1001;
  assert.throws(() => preflight(input), { code: 'INVALID_AUTHORITY_OBSERVATION' });
  for (const now of [-1, NaN, Infinity, 1.2]) assert.throws(() => preflightPublication(fixture(), { now }), { code: 'INVALID_TIME' });
});
