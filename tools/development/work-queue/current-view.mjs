import { explainTask } from './core.mjs';
// Read-only projection. Historical evidence is never rewritten into current acceptance.
export function currentView(catalog, authority, { now, publishedCommits = [] }) {
  const state = authority.queueState;
  const published = new Set(publishedCommits);
  const tasks = catalog.tasks.map(task => {
    const entry = state.tasks[task.id];
    const events = state.events.filter(e => e.taskId === task.id);
    const blockers = explainTask(catalog, state, task, { now }).blockers;
    const ancestors = new Set();
    const collect = id => {
      const t = catalog.tasks.find(t => t.id === id), e = state.tasks[id];
      for (const dep of [...t.dependencies, ...(e.discoveredDependencies ?? []), ...(e.blockers ?? []).filter(b => b.type === 'task').map(b => b.id)]) {
        if (!ancestors.has(dep)) { ancestors.add(dep); collect(dep); }
      }
    };
    collect(task.id);
    const lastReopen = Math.max(-1, ...state.events.filter(e => e.type === 'reopen' && (e.taskId === task.id || ancestors.has(e.taskId))).map(e => e.at));
    const outcomes = (entry.acceptedOutcomes ?? []).map(outcome => ({ ...outcome,
      current: outcome.acceptedAt > lastReopen && [...ancestors].every(id => state.tasks[id].status === 'done') }));
    const evidence = entry.evidence ?? null;
    const commit = evidence?.integratedCommit ?? evidence?.commit ?? null;
    return { id: task.id, title: task.title, originalCriteria: task.acceptance,
      childOutcomes: outcomes, remainingAcceptanceCriteria: entry.status === 'done' ? [] : task.acceptance,
      remainingWork: outcomes.filter(o => o.current).at(-1)?.remaining ?? null,
      source: authority.codeHead, candidate: commit, evidence,
      status: entry.status, eligible: explainTask(catalog, state, task, { now }).eligible,
      blockers: blockers.map(blocker => ({ ...blocker,
        responsible: blocker.type === 'task' ? blocker.id : 'coordinator',
        firstObservedAt: events.find(e => e.type === 'block' && e.blockers?.some(b => b.reason === blocker.reason))?.at ?? null,
        nextAction: blocker.type === 'task' ? `Reconcile acceptance of ${blocker.id}; preserve genuine dependency.` : 'Inspect current source; record precise resolution or executable prerequisite.' })),
      nextAction: outcomes.filter(o => o.current).at(-1)?.nextAction ?? (outcomes.some(o => !o.current && o.nextAction === entry.checkpoint) ? 'Reconcile reopened dependency before reusing historical next action.' : entry.checkpoint ?? null),
      publication: commit && published.has(commit) ? 'published' : 'not-established',
      integration: commit && published.has(commit) ? 'integration-branch' : 'not-established',
      acceptance: entry.status === 'done' ? 'parent-accepted' : outcomes.some(o => o.current) ? 'child-only' : 'parent-not-accepted' };
  });
  return { generatedAt: now, source: authority.codeHead, queueRevision: state.revision,
    originalRequirementCount: catalog.source?.source_bullet_count ?? null,
    note: 'Null means unknown. Parent criteria remain authoritative; child acceptance never closes a parent. Publication means integration branch, not merged/deployed.', tasks };
}
