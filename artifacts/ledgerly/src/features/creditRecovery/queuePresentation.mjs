import { canConfirmCandidate, filterClaims, isOpenClaim, isOverdue, remainingTotal } from './model.mjs';

/** View metadata only. Matching remains an explicit protected server command. */
export function reviewableCandidates(claim) {
  return (claim.candidates ?? []).filter(candidate => canConfirmCandidate(claim, candidate, true));
}

export function creditQueue(claims, filter, search, date) {
  const base = filterClaims(claims, ['matches', 'overdue'].includes(filter) ? 'all' : filter, search);
  return base.filter(claim => filter === 'matches' ? reviewableCandidates(claim).length > 0
    : filter === 'overdue' ? isOverdue(claim, date) : true).sort((a, b) => {
      const first = followUpPresentation(a, date), second = followUpPresentation(b, date);
      return first.rank - second.rank || (second.ageDays ?? -1) - (first.ageDays ?? -1)
        || String(a.id).localeCompare(String(b.id));
    });
}

export function queueSummary(claims, date) {
  const open = claims.filter(isOpenClaim);
  // An unavailable server figure must not become a reassuring zero.
  const amountsAvailable = open.every(claim => typeof claim.remaining?.gross_pence === 'string'
    && /^-?\d+$/.test(claim.remaining.gross_pence));
  return {
    remaining: amountsAvailable ? remainingTotal(claims) : undefined,
    waiting: open.length,
    overdue: claims.filter(claim => isOverdue(claim, date)).length,
    matches: claims.filter(claim => reviewableCandidates(claim).length > 0).length,
  };
}


function dayNumber(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time / 86400000 : null;
}

/** Suggested work only: never claims a supplier has been contacted or a reminder sent. */
export function followUpPresentation(claim, date) {
  const current = dayNumber(date);
  const start = dayNumber(claim.returned_on || (typeof claim.created_at === 'string' ? claim.created_at.slice(0, 10) : null));
  const ageDays = current !== null && start !== null && current >= start ? current - start : null;
  const due = dayNumber(claim.expected_by);
  const overdueDays = current !== null && due !== null && current > due ? current - due : 0;
  const ageLabel = ageDays === null ? 'Age unavailable' : `${ageDays} ${ageDays === 1 ? 'day' : 'days'} since ${claim.returned_on ? 'return' : 'tracking began'}`;
  if (!isOpenClaim(claim)) return { rank: 4, priority: 'Closed', next: 'No follow-up needed', ageDays, ageLabel };
  if (claim.status === 'needs_review') return { rank: 0, priority: 'Review first', next: 'Check the original item and receipt history', ageDays, ageLabel };
  if (reviewableCandidates(claim).length) return { rank: 1, priority: 'Match to review', next: 'Review the posted credit before following up', ageDays, ageLabel };
  if (overdueDays) return { rank: 2, priority: 'Follow up', next: `${overdueDays} ${overdueDays === 1 ? 'day' : 'days'} past expected date — contact the supplier`, ageDays, ageLabel };
  return { rank: 3, priority: 'Waiting', next: due === null ? 'No expected date recorded — check with the supplier' : `Expected by ${claim.expected_by}`, ageDays, ageLabel };
}
